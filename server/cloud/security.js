'use strict';
/* Harbinger Cloud — security primitives (no third-party dependencies).
   Passwords: scrypt with per-user salt. Tokens: 256-bit random, stored only as SHA-256. 2FA: RFC 6238 TOTP.
   Secrets at rest: AES-256-GCM with a master key from the environment. */
const crypto=require('crypto'), util=require('util');
const scrypt=util.promisify(crypto.scrypt);

const SCRYPT={N:32768,r:8,p:1,keylen:32,maxmem:128*1024*1024};
async function hashPassword(pw){
  const salt=crypto.randomBytes(16), h=await scrypt(String(pw).normalize('NFKC'),salt,SCRYPT.keylen,{N:SCRYPT.N,r:SCRYPT.r,p:SCRYPT.p,maxmem:SCRYPT.maxmem});
  return ['scrypt',SCRYPT.N,SCRYPT.r,SCRYPT.p,salt.toString('base64'),h.toString('base64')].join('$');
}
async function verifyPassword(pw,stored){
  try{
    const p=String(stored).split('$'); if(p[0]!=='scrypt'||p.length!==6)return false;
    const N=+p[1],r=+p[2],pp=+p[3]; if(!(N>=16384&&N<=1048576&&r>=1&&r<=16&&pp>=1&&pp<=4))return false;
    const salt=Buffer.from(p[4],'base64'), want=Buffer.from(p[5],'base64');
    const got=await scrypt(String(pw).normalize('NFKC'),salt,want.length,{N:N,r:r,p:pp,maxmem:128*1024*1024});
    return got.length===want.length&&crypto.timingSafeEqual(got,want);
  }catch(e){return false}
}
let _dummy=null; /* verifying against this when the user does not exist keeps response time the same */
const dummyHash=async()=>_dummy||(_dummy=await hashPassword('dummy-password-for-timing-equalisation'));

const COMMON=new Set(['password','password1','password12','password123','passw0rd','123456','12345678','123456789','1234567890','12345678910','qwerty','qwerty123','qwertyuiop','abc123','letmein','welcome','welcome1','admin','admin123','administrator','iloveyou','monkey','dragon','football','master','login','princess','sunshine','changeme','harbinger','harbinger123','manager123','cashier123','restaurant','restaurant1','111111','000000','1q2w3e4r','zaq12wsx','p@ssw0rd','p@ssword']);
function passwordProblem(pw,ctx){
  pw=String(pw==null?'':pw);
  if(pw.length<10)return 'Password must be at least 10 characters.';
  if(pw.length>128)return 'Password must be at most 128 characters.';
  const low=pw.toLowerCase();
  if(COMMON.has(low))return 'That password is too common.';
  if(/^(.)\1+$/.test(pw))return 'Password cannot be one repeated character.';
  const local=String(ctx&&ctx.email||'').split('@')[0].toLowerCase();
  if(local.length>=4&&low.includes(local))return 'Password cannot contain your email name.';
  const nm=String(ctx&&ctx.name||'').toLowerCase().replace(/\s+/g,'');
  if(nm.length>=4&&low.includes(nm))return 'Password cannot contain your name.';
  if(!/[a-zA-Z]/.test(pw)||!/[0-9\W_]/.test(pw))return 'Use letters plus at least one number or symbol.';
  return null;
}

const token=()=>crypto.randomBytes(32).toString('base64url');
const sha=s=>crypto.createHash('sha256').update(String(s)).digest('base64url');
const safeEq=(a,b)=>{const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&crypto.timingSafeEqual(x,y)};
const newId=p=>p+'_'+crypto.randomBytes(9).toString('base64url');

/* ---------- TOTP (RFC 6238 / 4226) ---------- */
const B32='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function b32encode(buf){let bits=0,val=0,out='';for(const b of buf){val=(val<<8)|b;bits+=8;while(bits>=5){out+=B32[(val>>>(bits-5))&31];bits-=5}}if(bits>0)out+=B32[(val<<(5-bits))&31];return out}
function b32decode(s){let bits=0,val=0;const out=[];for(const c of String(s).replace(/=+$/,'').toUpperCase()){const i=B32.indexOf(c);if(i<0)continue;val=(val<<5)|i;bits+=5;if(bits>=8){out.push((val>>>(bits-8))&255);bits-=8}}return Buffer.from(out)}
function hotp(key,counter,digits){
  const buf=Buffer.alloc(8);buf.writeBigUInt64BE(BigInt(counter));
  const h=crypto.createHmac('sha1',key).update(buf).digest(), o=h[h.length-1]&15;
  const code=((h[o]&127)<<24|h[o+1]<<16|h[o+2]<<8|h[o+3])%Math.pow(10,digits);
  return String(code).padStart(digits,'0');
}
const totpAt=(secretB32,ms,digits)=>hotp(b32decode(secretB32),Math.floor(ms/30000),digits||6);
/* returns the matched time-step (for replay protection) or 0 */
function totpVerify(secretB32,code,lastStep,ms){
  code=String(code||'').replace(/\s+/g,''); if(!/^\d{6}$/.test(code))return 0;
  const key=b32decode(secretB32), step=Math.floor((ms||Date.now())/30000);
  for(let d=-1;d<=1;d++){const s=step+d; if(s<=(lastStep||0))continue; if(safeEq(hotp(key,s,6),code))return s}
  return 0;
}
const newTotpSecret=()=>b32encode(crypto.randomBytes(20));
const otpauthUri=(issuer,account,secret)=>'otpauth://totp/'+encodeURIComponent(issuer)+':'+encodeURIComponent(account)+'?secret='+secret+'&issuer='+encodeURIComponent(issuer)+'&algorithm=SHA1&digits=6&period=30';
const newBackupCodes=()=>Array.from({length:10},()=>b32encode(crypto.randomBytes(7)).slice(0,10));

/* ---------- encryption at rest ---------- */
function loadMasterKey(env){
  const raw=env.HB_MASTER_KEY; if(raw){const k=Buffer.from(raw,'base64'); if(k.length!==32)throw new Error('HB_MASTER_KEY must be 32 bytes, base64-encoded (openssl rand -base64 32)'); return k}
  return null;
}
function encrypt(key,plain,aad){
  const iv=crypto.randomBytes(12), c=crypto.createCipheriv('aes-256-gcm',key,iv); if(aad)c.setAAD(Buffer.from(aad));
  const ct=Buffer.concat([c.update(String(plain),'utf8'),c.final()]), tag=c.getAuthTag();
  return ['v1',iv.toString('base64url'),tag.toString('base64url'),ct.toString('base64url')].join('.');
}
function decrypt(key,blob,aad){
  const p=String(blob).split('.'); if(p[0]!=='v1'||p.length!==4)throw new Error('bad ciphertext');
  const d=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(p[1],'base64url')); if(aad)d.setAAD(Buffer.from(aad)); d.setAuthTag(Buffer.from(p[2],'base64url'));
  return Buffer.concat([d.update(Buffer.from(p[3],'base64url')),d.final()]).toString('utf8');
}

/* ---------- misc ---------- */
function parseCookies(h){const o={};String(h||'').split(';').forEach(p=>{const i=p.indexOf('=');if(i>0)o[p.slice(0,i).trim()]=decodeURIComponent(p.slice(i+1).trim())});return o}
function cookie(name,val,opt){
  let s=name+'='+encodeURIComponent(val)+'; Path=/; HttpOnly; SameSite=Strict';
  if(opt&&opt.secure)s+='; Secure'; if(opt&&opt.maxAge!=null)s+='; Max-Age='+opt.maxAge; return s;
}
class Limiter{
  constructor(){this.m=new Map();setInterval(()=>{const t=Date.now();this.m.forEach((b,k)=>{if(t>b.reset)this.m.delete(k)})},60e3).unref()}
  hit(key,max,windowMs){const t=Date.now(),b=this.m.get(key)||{n:0,reset:t+windowMs};if(t>b.reset){b.n=0;b.reset=t+windowMs}b.n++;this.m.set(key,b);return b.n>max}
}
module.exports={hashPassword,verifyPassword,dummyHash,passwordProblem,token,sha,safeEq,newId,totpAt,totpVerify,newTotpSecret,otpauthUri,newBackupCodes,b32encode,b32decode,
  loadMasterKey,encrypt,decrypt,parseCookies,cookie,Limiter};
