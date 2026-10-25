'use strict';
/* Harbinger Cloud — multi-tenant API (one deployment, many owners).
   Every query is scoped by the tenant stored on the authenticated SESSION, never by anything the client sends.
   Requires Node 22.5+ (built-in SQLite).  Run: node server/cloud/cloud.js   (see server/cloud/README.md) */
const http=require('http'), fs=require('fs'), path=require('path'), crypto=require('crypto');
const {DatabaseSync}=require('node:sqlite');
const S=require('./security');
const {normalize}=require('../channels');

/* ---------- roles & collection policy (enforced on the server) ---------- */
const ROLES=['owner','admin','manager','cashier','accountant','kitchen'];
const ALL=ROLES, STAFF=['owner','admin','manager'], FIN=['owner','admin','accountant'], SELL=['owner','admin','manager','cashier'];
const COSTROLES=['owner','admin','manager','accountant'];
const POLICY={
  settings:{read:ALL,write:['owner','admin']},
  items:{read:ALL,write:STAFF,protect:{cost:COSTROLES}},
  categories:{read:ALL,write:STAFF},
  customers:{read:['owner','admin','manager','cashier','accountant'],write:SELL},
  offers:{read:ALL,write:STAFF}, codes:{read:SELL,write:STAFF},
  counters:{read:ALL,write:['owner','admin']},
  sessions:{read:['owner','admin','manager','cashier','accountant'],write:SELL},
  orders:{read:ALL,write:['owner','admin','manager','cashier','kitchen'],appendOnly:true,mutable:['status','refund','kds','settlement','einv','einvCredit','onlineId']},
  lots:{read:['owner','admin','manager','cashier','accountant'],write:SELL,protect:{cost:COSTROLES}},
  movements:{read:['owner','admin','manager','cashier','accountant'],write:SELL,appendOnly:true,mutable:[],protect:{}},
  cash_vouchers:{read:['owner','admin','manager','cashier','accountant'],write:SELL,appendOnly:true,mutable:[]},
  suppliers:{read:['owner','admin','manager','accountant'],write:['owner','admin','manager']},
  purchase_orders:{read:['owner','admin','manager','accountant'],write:['owner','admin','manager']},
  acc_ledgers:{read:FIN,write:FIN}, acc_groups:{read:FIN,write:FIN},
  acc_vouchers:{read:FIN,write:FIN,appendOnly:true,mutable:['cancelled']},
  online:{read:['owner','admin','manager','cashier','kitchen'],write:['owner','admin','manager','cashier'],appendOnly:true,mutable:['status','orderId','history','dirty','reason']},
  public_menu:{read:ALL,write:STAFF}
};
const MAX_RECORD=256*1024, MAX_PUSH=200, ID_RE=/^[A-Za-z0-9_.:-]{1,80}$/;
const can=(role,coll,mode)=>!!(POLICY[coll]&&POLICY[coll][mode]&&POLICY[coll][mode].indexOf(role)>=0);
const redact=(role,coll,data)=>{const p=POLICY[coll]&&POLICY[coll].protect;if(!p)return data;const o=Object.assign({},data);Object.keys(p).forEach(f=>{if(p[f].indexOf(role)<0)delete o[f]});return o};
const permissions=role=>({collections:Object.keys(POLICY).reduce((o,c)=>{o[c]={read:can(role,c,'read'),write:can(role,c,'write')};return o},{}),manageUsers:['owner','admin'].indexOf(role)>=0,viewAudit:['owner','admin'].indexOf(role)>=0});

/* ---------- app factory ---------- */
function createApp(opt){
  opt=opt||{};
  const env=opt.env||process.env, prod=env.NODE_ENV==='production';
  const dbPath=opt.dbPath||env.HB_DB||path.join(__dirname,'harbinger.db');
  const db=new DatabaseSync(dbPath); db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  db.exec(`
  create table if not exists tenants(id text primary key,slug text unique not null,name text not null,country text,status text not null default 'active',created_at integer not null);
  create table if not exists users(id text primary key,tenant_id text not null references tenants(id),email text unique not null,name text not null,role text not null,pass_hash text not null,must_change integer not null default 0,
    totp_secret text,totp_enabled integer not null default 0,totp_last integer not null default 0,backup_codes text,failed integer not null default 0,locked_until integer not null default 0,active integer not null default 1,created_at integer not null,last_login integer);
  create index if not exists users_tenant on users(tenant_id);
  create table if not exists sessions(id_hash text primary key,user_id text not null references users(id),tenant_id text not null,csrf text not null,created_at integer not null,last_seen integer not null,expires_at integer not null,ip text,ua text);
  create index if not exists sessions_user on sessions(user_id);
  create table if not exists records(tenant_id text not null,coll text not null,id text not null,rev integer not null,deleted integer not null default 0,data text not null,seq integer not null,updated_by text,primary key(tenant_id,coll,id));
  create index if not exists records_seq on records(tenant_id,seq);
  create table if not exists tenant_seq(tenant_id text primary key,seq integer not null);
  create table if not exists audit(id integer primary key autoincrement,tenant_id text,user_id text,action text not null,detail text,ip text,ts integer not null);
  create index if not exists audit_tenant on audit(tenant_id,id);
  create table if not exists tracks(tenant_id text not null,track text not null,order_id text not null,primary key(tenant_id,track));
  create table if not exists webhook_secrets(tenant_id text not null,channel text not null,secret_enc text not null,primary key(tenant_id,channel));
  create table if not exists webhook_seen(tenant_id text not null,key text not null,ts integer not null,primary key(tenant_id,key));
  `);
  let MK=opt.masterKey||S.loadMasterKey(env);
  if(!MK){
    if(prod)throw new Error('HB_MASTER_KEY is required in production (openssl rand -base64 32)');
    const kf=path.join(path.dirname(dbPath),'dev-master.key');
    try{MK=Buffer.from(fs.readFileSync(kf,'utf8').trim(),'base64')}catch(e){MK=crypto.randomBytes(32);try{fs.writeFileSync(kf,MK.toString('base64'),{mode:0o600})}catch(x){}}
    console.warn('[cloud] DEV master key in use. Set HB_MASTER_KEY for any real deployment.');
  }
  const lim=new S.Limiter();
  const cfg={allowSignup:opt.allowSignup!=null?opt.allowSignup:env.ALLOW_SIGNUP==='1',idleMs:(+env.SESSION_IDLE_MIN||120)*60e3,absMs:(+env.SESSION_MAX_HOURS||12)*3600e3,
    trustProxy:!!(opt.trustProxy||env.TRUST_PROXY),origins:(env.ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean),
    secureCookies:opt.secureCookies!=null?opt.secureCookies:prod,staticDir:path.resolve(env.STATIC_DIR||path.join(__dirname,'..','..','website'))};

  const q={
    tenantBySlug:db.prepare('select * from tenants where slug=? and status=\'active\''),
    userByEmail:db.prepare('select * from users where email=?'),
    userById:db.prepare('select * from users where id=? and tenant_id=?'),
    usersOfTenant:db.prepare('select id,email,name,role,active,totp_enabled,must_change,last_login,created_at from users where tenant_id=? order by created_at'),
    sessionByHash:db.prepare('select s.*,u.email,u.name,u.role,u.active,u.must_change,u.totp_enabled,t.name tname,t.slug tslug,t.status tstatus from sessions s join users u on u.id=s.user_id join tenants t on t.id=s.tenant_id where s.id_hash=?'),
    audit:db.prepare('insert into audit(tenant_id,user_id,action,detail,ip,ts) values (?,?,?,?,?,?)')
  };
  const now=()=>Date.now();
  const audit=(tid,uid,action,detail,ip)=>{try{q.audit.run(tid||null,uid||null,action,String(detail||'').slice(0,500),ip||null,now())}catch(e){}};
  const tx=fn=>{db.exec('BEGIN IMMEDIATE');try{const r=fn();db.exec('COMMIT');return r}catch(e){try{db.exec('ROLLBACK')}catch(x){}throw e}};
  const nextSeq=tid=>{const r=db.prepare('select seq from tenant_seq where tenant_id=?').get(tid);const n=(r?r.seq:0)+1;db.prepare('insert into tenant_seq(tenant_id,seq) values (?,?) on conflict(tenant_id) do update set seq=excluded.seq').run(tid,n);return n};

  /* ---------- http helpers ---------- */
  const reqSecure=req=>!!(req.socket.encrypted||(cfg.trustProxy&&req.headers['x-forwarded-proto']==='https'));
  const ipOf=req=>(cfg.trustProxy&&String(req.headers['x-forwarded-for']||'').split(',')[0].trim())||req.socket.remoteAddress||'?';
  function send(res,code,obj,extra){
    const h=Object.assign({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer','Cross-Origin-Resource-Policy':'same-origin','Permissions-Policy':'camera=(), microphone=(), geolocation=()'},extra||{});
    if(res._secure)h['Strict-Transport-Security']='max-age=31536000; includeSubDomains';
    if(code===413){h.Connection='close';res.on('finish',()=>{if(res.req&&res.req.socket)res.req.socket.destroy()})}
    res.writeHead(code,h);res.end(JSON.stringify(obj));
  }
  const readBody=(req,max)=>new Promise((resolve,reject)=>{let n=0;const ch=[];req.on('data',c=>{if(n>max)return;n+=c.length;if(n>max){ch.length=0;reject(Object.assign(new Error('Payload too large'),{status:413}));return}ch.push(c)});req.on('end',()=>resolve(Buffer.concat(ch)));req.on('error',reject)});
  async function jsonBody(req,max){
    if(!/^application\/json(\s*;|$)/i.test(String(req.headers['content-type']||'')))throw Object.assign(new Error('Content-Type must be application/json'),{status:415});
    const raw=await readBody(req,max||64*1024); try{const b=JSON.parse(raw.toString('utf8'));if(b===null||typeof b!=='object'||Array.isArray(b))throw 0;return b}catch(e){throw Object.assign(new Error('Invalid JSON'),{status:400})}
  }
  function originOk(req){ /* blocks cross-site form posts / login CSRF: if an Origin is sent it must be us or allow-listed */
    const o=req.headers.origin; if(!o)return true; if(cfg.origins.indexOf(o)>=0)return true;
    try{return new URL(o).host===req.headers.host}catch(e){return false}
  }
  const cookieOpts=(req,maxAge)=>({secure:cfg.secureCookies||reqSecure(req),maxAge:maxAge});
  const str=(v,max)=>String(v==null?'':v).replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max);
  const emailOk=e=>/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(e)&&e.length<=254;
  const slugify=s=>String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40)||'business';

  /* ---------- sessions ---------- */
  function createSession(req,res,user){
    const tok=S.token(), csrf=S.token(), t=now();
    db.prepare('insert into sessions(id_hash,user_id,tenant_id,csrf,created_at,last_seen,expires_at,ip,ua) values (?,?,?,?,?,?,?,?,?)').run(S.sha(tok),user.id,user.tenant_id,csrf,t,t,t+cfg.absMs,ipOf(req),str(req.headers['user-agent'],200));
    db.prepare('update users set last_login=?,failed=0,locked_until=0 where id=?').run(t,user.id);
    res._cookies=(res._cookies||[]).concat(S.cookie('hb_sid',tok,cookieOpts(req,Math.floor(cfg.absMs/1000))));
    return csrf;
  }
  function auth(req,res){
    const tok=S.parseCookies(req.headers.cookie).hb_sid; if(!tok)return null;
    const s=q.sessionByHash.get(S.sha(tok)); if(!s)return null;
    const t=now();
    if(t>s.expires_at||t-s.last_seen>cfg.idleMs||!s.active||s.tstatus!=='active'){db.prepare('delete from sessions where id_hash=?').run(s.id_hash);return null}
    if(t-s.last_seen>60e3)db.prepare('update sessions set last_seen=? where id_hash=?').run(t,s.id_hash);
    return {sid:s.id_hash,uid:s.user_id,tid:s.tenant_id,role:s.role,email:s.email,name:s.name,csrf:s.csrf,mustChange:!!s.must_change,tenant:{name:s.tname,slug:s.tslug},twofa:!!s.totp_enabled};
  }
  const sessionInfo=a=>({user:{id:a.uid,email:a.email,name:a.name,role:a.role,twofa:a.twofa,mustChangePassword:a.mustChange},tenant:a.tenant,csrf:a.csrf,permissions:permissions(a.role)});

  /* ---------- auth handlers ---------- */
  async function register(req,res,ip){
    if(!cfg.allowSignup)return send(res,403,{error:'Sign-up is closed. Ask the operator for an invitation.'});
    if(lim.hit('reg|'+ip,5,3600e3))return send(res,429,{error:'Too many sign-ups from this address.'});
    const b=await jsonBody(req), email=str(b.email,254).toLowerCase(), name=str(b.name,80), biz=str(b.business,80), country=str(b.country,3).toUpperCase();
    if(!emailOk(email)||!name||!biz)return send(res,400,{error:'Business name, your name and a valid email are required.'});
    const pp=S.passwordProblem(b.password,{email:email,name:name}); if(pp)return send(res,400,{error:pp});
    if(q.userByEmail.get(email))return send(res,409,{error:'An account with that email already exists.'});
    const hash=await S.hashPassword(b.password), tid=S.newId('t'), uid=S.newId('u'); let slug=slugify(biz);
    tx(()=>{
      if(db.prepare('select 1 from tenants where slug=?').get(slug))slug=slug+'-'+crypto.randomBytes(2).toString('hex');
      db.prepare('insert into tenants(id,slug,name,country,created_at) values (?,?,?,?,?)').run(tid,slug,biz,country||null,now());
      db.prepare('insert into users(id,tenant_id,email,name,role,pass_hash,created_at) values (?,?,?,?,?,?,?)').run(uid,tid,email,name,'owner',hash,now());
    });
    audit(tid,uid,'tenant.create',biz,ip);
    const user={id:uid,tenant_id:tid}, csrf=createSession(req,res,user);
    return send(res,201,{ok:true,csrf:csrf,tenant:{name:biz,slug:slug}},{'Set-Cookie':res._cookies});
  }
  async function login(req,res,ip){
    const b=await jsonBody(req), email=str(b.email,254).toLowerCase();
    if(lim.hit('lip|'+ip,30,600e3)||lim.hit('lem|'+email,10,600e3))return send(res,429,{error:'Too many attempts. Try again in a few minutes.'});
    const u=q.userByEmail.get(email), generic={error:'Invalid email or password.'};
    if(!u){await S.verifyPassword(String(b.password||''),await S.dummyHash());audit(null,null,'login.fail','unknown email',ip);return send(res,401,generic)}
    if(u.locked_until>now()){audit(u.tenant_id,u.id,'login.locked','',ip);return send(res,429,{error:'This account is temporarily locked. Try again later.'})}
    const ok=await S.verifyPassword(String(b.password||''),u.pass_hash);
    const fail=why=>{
      const f=u.failed+1; let lock=0; if(f>=5)lock=now()+Math.min(24*3600e3,15*60e3*Math.pow(2,Math.floor((f-5)/1)));
      db.prepare('update users set failed=?,locked_until=? where id=?').run(f,lock,u.id);audit(u.tenant_id,u.id,'login.fail',why,ip);return send(res,401,generic);
    };
    if(!ok)return fail('bad password');
    if(!u.active)return fail('inactive');
    const t=db.prepare('select status from tenants where id=?').get(u.tenant_id); if(!t||t.status!=='active')return fail('tenant suspended');
    if(u.totp_enabled){
      const code=str(b.code,20).replace(/\s+/g,'');
      if(!code)return send(res,200,{needCode:true});
      let good=false;
      const step=S.totpVerify(S.decrypt(MK,u.totp_secret,u.id),code,u.totp_last);
      if(step){db.prepare('update users set totp_last=? where id=?').run(step,u.id);good=true}
      else{ /* backup code, single use */
        const codes=JSON.parse(u.backup_codes||'[]'), h=S.sha(code.toUpperCase()), i=codes.indexOf(h);
        if(i>=0){codes.splice(i,1);db.prepare('update users set backup_codes=? where id=?').run(JSON.stringify(codes),u.id);good=true;audit(u.tenant_id,u.id,'2fa.backup_used','',ip)}
      }
      if(!good)return fail('bad 2fa code');
    }
    const csrf=createSession(req,res,u); audit(u.tenant_id,u.id,'login.ok','',ip);
    return send(res,200,{ok:true,csrf:csrf,mustChangePassword:!!u.must_change},{'Set-Cookie':res._cookies});
  }

  /* ---------- record sync (tenant-isolated, role-checked) ---------- */
  function pull(a,url){
    const since=Math.max(0,parseInt(url.searchParams.get('since'))||0), limit=Math.min(500,Math.max(1,parseInt(url.searchParams.get('limit'))||300));
    const colls=Object.keys(POLICY).filter(c=>can(a.role,c,'read')); if(!colls.length)return {records:[],cursor:since,more:false};
    const rows=db.prepare('select coll,id,rev,deleted,data,seq from records where tenant_id=? and seq>? and coll in ('+colls.map(()=>'?').join(',')+') order by seq limit ?').all(a.tid,since,...colls,limit+1);
    const more=rows.length>limit; if(more)rows.pop();
    return {records:rows.map(r=>({c:r.coll,id:r.id,rev:r.rev,deleted:!!r.deleted,data:r.deleted?null:redact(a.role,r.coll,JSON.parse(r.data))})),cursor:rows.length?rows[rows.length-1].seq:since,more:more};
  }
  function applyRecord(a,r){
    if(!r||typeof r!=='object')return {status:'invalid'};
    const c=r.c, id=r.id; if(!POLICY[c]||typeof id!=='string'||!ID_RE.test(id))return {c:c,id:id,status:'invalid'};
    if(!can(a.role,c,'write')){audit(a.tid,a.uid,'sync.denied',c+'/'+id,null);return {c:c,id:id,status:'denied'}}
    const pol=POLICY[c], cur=db.prepare('select rev,deleted,data from records where tenant_id=? and coll=? and id=?').get(a.tid,c,id);
    const del=!!r.deleted; let data=null;
    if(!del){
      if(r.data===null||typeof r.data!=='object'||Array.isArray(r.data))return {c:c,id:id,status:'invalid'};
      data=r.data; if(JSON.stringify(data).length>MAX_RECORD)return {c:c,id:id,status:'invalid',error:'record too large'};
    }
    if(cur&&!cur.deleted&&pol.appendOnly){
      if(del)return {c:c,id:id,status:'denied',error:'append-only'};
      const old=JSON.parse(cur.data), mut=pol.mutable||[], keys=new Set(Object.keys(old).concat(Object.keys(data)));
      for(const k of keys){if(mut.indexOf(k)<0&&JSON.stringify(old[k])!==JSON.stringify(data[k]))return {c:c,id:id,status:'denied',error:'field "'+k+'" is immutable'}}
    }else if(cur&&r.baseRev!==cur.rev){
      return {c:c,id:id,status:'conflict',rev:cur.rev,server:cur.deleted?null:redact(a.role,c,JSON.parse(cur.data)),deleted:!!cur.deleted};
    }
    if(!cur&&r.baseRev)return {c:c,id:id,status:'conflict',rev:0,server:null};
    if(cur&&pol.protect&&!del){ /* a role that cannot see a field may not change it either: keep the server's value */
      const old=JSON.parse(cur.data);Object.keys(pol.protect).forEach(f=>{if(pol.protect[f].indexOf(a.role)<0){if(f in old)data[f]=old[f];else delete data[f]}});
    }else if(!cur&&pol.protect&&!del){Object.keys(pol.protect).forEach(f=>{if(pol.protect[f].indexOf(a.role)<0)delete data[f]})}
    const rev=cur?cur.rev+1:1, seq=nextSeq(a.tid);
    db.prepare('insert into records(tenant_id,coll,id,rev,deleted,data,seq,updated_by) values (?,?,?,?,?,?,?,?) on conflict(tenant_id,coll,id) do update set rev=excluded.rev,deleted=excluded.deleted,data=excluded.data,seq=excluded.seq,updated_by=excluded.updated_by')
      .run(a.tid,c,id,rev,del?1:0,del?'{}':JSON.stringify(data),seq,a.uid);
    if(c==='online'&&data&&data.track)db.prepare('insert or replace into tracks(tenant_id,track,order_id) values (?,?,?)').run(a.tid,String(data.track).toUpperCase(),id);
    return {c:c,id:id,status:'ok',rev:rev,seq:seq};
  }
  function push(a,b){
    if(!Array.isArray(b.records)||b.records.length>MAX_PUSH)return {error:'Send 1–'+MAX_PUSH+' records per request'};
    const out=tx(()=>b.records.map(r=>applyRecord(a,r)));
    const n={};out.forEach(o=>{if(o.status==='ok')n[o.c]=(n[o.c]||0)+1});if(Object.keys(n).length)audit(a.tid,a.uid,'sync.push',JSON.stringify(n),null);
    return {results:out};
  }

  /* ---------- public storefront (per tenant) ---------- */
  function pubMenu(tid){const r=db.prepare('select data from records where tenant_id=? and coll=\'public_menu\' and id=\'menu\' and deleted=0').get(tid);return r?JSON.parse(r.data):null}
  function validateOrder(menu,b){
    if(!menu)throw Object.assign(new Error('Menu is not published yet'),{status:503});
    const o=menu.online||{}; if(!o.open)throw Object.assign(new Error('Online ordering is closed right now'),{status:409});
    const type=b.type; if(['pickup','delivery','dine-in'].indexOf(type)<0)throw new Error('Choose pickup, delivery or dine-in');
    if((type==='pickup'&&!o.pickup)||(type==='delivery'&&!o.delivery)||(type==='dine-in'&&!o.dineIn))throw new Error('That order type is not available');
    const c={name:str(b.customer&&b.customer.name,60),phone:str(b.customer&&b.customer.phone,20).replace(/\s+/g,''),address:str(b.customer&&b.customer.address,200)};
    if(!c.name)throw new Error('Please enter your name'); if(!/^\+?[0-9]{7,15}$/.test(c.phone))throw new Error('Please enter a valid phone number'); if(type==='delivery'&&c.address.length<5)throw new Error('Please enter your delivery address');
    const table=type==='dine-in'?str(b.table,12):''; if(type==='dine-in'&&!/^[A-Za-z0-9 _-]{1,12}$/.test(table))throw new Error('Table number is missing');
    if(!Array.isArray(b.lines)||!b.lines.length||b.lines.length>40)throw new Error('Your cart is empty');
    const dec=Number.isInteger(menu.decimals)&&menu.decimals>=0&&menu.decimals<=3?menu.decimals:2, p=Math.pow(10,dec), r2=n=>Math.round((n+Number.EPSILON)*p)/p;
    const items=new Map((menu.items||[]).map(i=>[i.id,i])); let sub=0; const lines=[];
    for(const l of b.lines){const it=items.get(String(l&&l.itemId)),qty=Math.floor(+l.qty);if(!it)throw new Error('An item in your cart is no longer on the menu');if(!it.available)throw new Error(str(it.name,60)+' is currently unavailable');if(!(qty>=1&&qty<=50))throw new Error('Invalid quantity');sub=r2(sub+it.price*qty);lines.push({itemId:it.id,name:it.name,qty:qty,price:it.price,note:str(l.note,80)})}
    const fee=type==='delivery'?r2(+o.deliveryFee||0):0; if(type==='delivery'&&sub<(+o.minOrder||0))throw new Error('Minimum order for delivery is '+o.minOrder+' '+menu.currency);
    return {type:type,table:table,customer:c,lines:lines,deliveryFee:fee,total:r2(sub+fee),note:str(b.note,200),payment:'cod'};
  }
  async function publicRoutes(req,res,url,ip){
    const m=url.pathname.match(/^\/api\/public\/([a-z0-9-]{1,40})\/(menu|orders)(?:\/([A-Za-z0-9]{4,12}))?$/); if(!m)return send(res,404,{error:'Not found'});
    if(lim.hit('pub|'+ip,240,60e3))return send(res,429,{error:'Too many requests'});
    const t=q.tenantBySlug.get(m[1]); if(!t)return send(res,404,{error:'Not found'});
    if(req.method==='GET'&&m[2]==='menu'){const menu=pubMenu(t.id);return menu?send(res,200,menu):send(res,503,{error:'Menu not published yet'})}
    if(req.method==='POST'&&m[2]==='orders'&&!m[3]){
      if(lim.hit('pubtry|'+ip,60,600e3))return send(res,429,{error:'Too many requests. Please try again later.'});
      const b=await jsonBody(req,32*1024), cid=str(b.clientId,40);
      if(cid){const prev=db.prepare('select order_id from tracks where tenant_id=? and track=?').get(t.id,'C:'+cid);if(prev){const r=db.prepare('select data from records where tenant_id=? and coll=\'online\' and id=?').get(t.id,prev.order_id);if(r){const d=JSON.parse(r.data);return send(res,200,{track:d.track,status:d.status,total:d.total})}}}
      let v;try{v=validateOrder(pubMenu(t.id),b)}catch(e){return send(res,e.status||400,{error:e.message})}
      if(lim.hit('puborder|'+t.id+'|'+ip,10,600e3))return send(res,429,{error:'Too many orders from this device. Please try again later.'});
      const id='ON-'+crypto.randomBytes(6).toString('base64url'), track=crypto.randomBytes(5).toString('hex').toUpperCase().slice(0,6);
      const rec=Object.assign({id:id,track:track,ts:now(),channel:'storefront',source:v.table?'qr':'web',status:'new'},v);
      tx(()=>{const seq=nextSeq(t.id);db.prepare('insert into records(tenant_id,coll,id,rev,deleted,data,seq,updated_by) values (?,?,?,?,?,?,?,?)').run(t.id,'online',id,1,0,JSON.stringify(rec),seq,'public');
        db.prepare('insert into tracks(tenant_id,track,order_id) values (?,?,?)').run(t.id,track,id);if(cid)db.prepare('insert or ignore into tracks(tenant_id,track,order_id) values (?,?,?)').run(t.id,'C:'+cid,id)});
      return send(res,201,{track:track,status:'new',total:rec.total});
    }
    if(req.method==='GET'&&m[2]==='orders'&&m[3]){
      const tr=db.prepare('select order_id from tracks where tenant_id=? and track=?').get(t.id,m[3].toUpperCase()); if(!tr)return send(res,404,{error:'Order not found'});
      const r=db.prepare('select data from records where tenant_id=? and coll=\'online\' and id=?').get(t.id,tr.order_id); if(!r)return send(res,404,{error:'Order not found'});
      const d=JSON.parse(r.data);return send(res,200,{track:d.track,status:d.status,type:d.type,total:d.total});
    }
    return send(res,405,{error:'Method not allowed'});
  }
  async function webhook(req,res,url,ip){
    const m=url.pathname.match(/^\/webhooks\/([a-z0-9-]{1,40})\/([a-z0-9_-]{2,20})$/); if(!m||req.method!=='POST')return send(res,404,{error:'Not found'});
    if(lim.hit('hook|'+ip,300,60e3))return send(res,429,{error:'Too many requests'});
    const t=q.tenantBySlug.get(m[1]); const row=t&&db.prepare('select secret_enc from webhook_secrets where tenant_id=? and channel=?').get(t.id,m[2]);
    const raw=await readBody(req,256*1024); if(!row)return send(res,401,{error:'Bad signature'}); /* same answer for unknown tenant/channel */
    const secret=S.decrypt(MK,row.secret_enc,t.id+'|'+m[2]), sig=String(req.headers['x-signature']||'').replace(/^sha256=/,''), exp=crypto.createHmac('sha256',secret).update(raw).digest('hex');
    if(!sig||!S.safeEq(sig,exp)){audit(t.id,null,'webhook.badsig',m[2],ip);return send(res,401,{error:'Bad signature'})}
    const ts=+req.headers['x-timestamp'];if(ts&&Math.abs(now()-(ts<1e12?ts*1000:ts))>5*60e3)return send(res,401,{error:'Stale request'});
    let body;try{body=JSON.parse(raw.toString('utf8'))}catch(e){return send(res,400,{error:'Invalid JSON'})}
    let n;try{n=normalize(m[2],body)}catch(e){return send(res,422,{error:e.message})}
    const key=m[2]+':'+n.extId; if(db.prepare('select 1 from webhook_seen where tenant_id=? and key=?').get(t.id,key))return send(res,200,{ok:true,duplicate:true});
    const id='AG-'+crypto.randomBytes(6).toString('base64url'), rec=Object.assign({id:id,ts:now(),status:'new'},n);
    tx(()=>{db.prepare('insert into webhook_seen(tenant_id,key,ts) values (?,?,?)').run(t.id,key,now());const seq=nextSeq(t.id);db.prepare('insert into records(tenant_id,coll,id,rev,deleted,data,seq,updated_by) values (?,?,?,?,?,?,?,?)').run(t.id,'online',id,1,0,JSON.stringify(rec),seq,'webhook:'+m[2])});
    return send(res,200,{ok:true,id:id});
  }

  /* ---------- authenticated routes ---------- */
  async function api(req,res,url,ip){
    const M=req.method, p=url.pathname;
    if(!originOk(req))return send(res,403,{error:'Cross-site request blocked'});
    if(p==='/api/auth/login'&&M==='POST')return login(req,res,ip);
    if(p==='/api/auth/register'&&M==='POST')return register(req,res,ip);
    const a=auth(req,res); if(!a){if(lim.hit('anon|'+ip,120,60e3))return send(res,429,{error:'Too many requests'});return send(res,401,{error:'Sign in required'})}
    if(M!=='GET'&&M!=='HEAD'&&!S.safeEq(req.headers['x-csrf-token']||'',a.csrf))return send(res,403,{error:'Missing or invalid CSRF token'});
    if(p==='/api/auth/session'&&M==='GET')return send(res,200,sessionInfo(a));
    if(p==='/api/auth/logout'&&M==='POST'){db.prepare('delete from sessions where id_hash=?').run(a.sid);audit(a.tid,a.uid,'logout','',ip);return send(res,200,{ok:true},{'Set-Cookie':S.cookie('hb_sid','',cookieOpts(req,0))})}
    if(p==='/api/auth/logout-all'&&M==='POST'){db.prepare('delete from sessions where user_id=?').run(a.uid);audit(a.tid,a.uid,'logout.all','',ip);return send(res,200,{ok:true},{'Set-Cookie':S.cookie('hb_sid','',cookieOpts(req,0))})}
    if(p==='/api/auth/change-password'&&M==='POST'){
      const b=await jsonBody(req), u=q.userById.get(a.uid,a.tid);
      if(lim.hit('chpw|'+a.uid,10,600e3))return send(res,429,{error:'Too many attempts'});
      if(!await S.verifyPassword(String(b.current||''),u.pass_hash))return send(res,403,{error:'Current password is incorrect.'});
      const pp=S.passwordProblem(b.password,{email:u.email,name:u.name}); if(pp)return send(res,400,{error:pp});
      if(await S.verifyPassword(String(b.password),u.pass_hash))return send(res,400,{error:'Choose a different password.'});
      db.prepare('update users set pass_hash=?,must_change=0 where id=?').run(await S.hashPassword(b.password),u.id);
      db.prepare('delete from sessions where user_id=? and id_hash<>?').run(u.id,a.sid); audit(a.tid,a.uid,'password.change','',ip);return send(res,200,{ok:true});
    }
    if(a.mustChange)return send(res,403,{error:'You must change your password first.',mustChangePassword:true});
    if(p==='/api/auth/2fa/setup'&&M==='POST'){const sec=S.newTotpSecret();db.prepare('update users set totp_secret=?,totp_enabled=0 where id=?').run(S.encrypt(MK,sec,a.uid),a.uid);return send(res,200,{secret:sec,uri:S.otpauthUri('Harbinger POS',a.email,sec)})}
    if(p==='/api/auth/2fa/enable'&&M==='POST'){
      const b=await jsonBody(req), u=q.userById.get(a.uid,a.tid); if(!u.totp_secret)return send(res,400,{error:'Start setup first.'});
      const step=S.totpVerify(S.decrypt(MK,u.totp_secret,u.id),b.code,0); if(!step)return send(res,400,{error:'That code is not valid.'});
      const codes=S.newBackupCodes(); db.prepare('update users set totp_enabled=1,totp_last=?,backup_codes=? where id=?').run(step,JSON.stringify(codes.map(c=>S.sha(c))),u.id);
      db.prepare('delete from sessions where user_id=? and id_hash<>?').run(u.id,a.sid);audit(a.tid,a.uid,'2fa.enable','',ip);return send(res,200,{ok:true,backupCodes:codes});
    }
    if(p==='/api/auth/2fa/disable'&&M==='POST'){
      const b=await jsonBody(req), u=q.userById.get(a.uid,a.tid); if(!await S.verifyPassword(String(b.password||''),u.pass_hash))return send(res,403,{error:'Password is incorrect.'});
      db.prepare('update users set totp_enabled=0,totp_secret=null,backup_codes=null where id=?').run(u.id);audit(a.tid,a.uid,'2fa.disable','',ip);return send(res,200,{ok:true});
    }
    /* users (owner/admin) */
    if(p==='/api/users'&&M==='GET'){if(['owner','admin'].indexOf(a.role)<0)return send(res,403,{error:'Not allowed'});return send(res,200,{users:q.usersOfTenant.all(a.tid)})}
    if(p==='/api/users'&&M==='POST'){
      if(['owner','admin'].indexOf(a.role)<0)return send(res,403,{error:'Not allowed'});
      const b=await jsonBody(req), email=str(b.email,254).toLowerCase(), name=str(b.name,80), role=b.role;
      if(!emailOk(email)||!name||ROLES.indexOf(role)<0)return send(res,400,{error:'Name, valid email and role are required.'});
      if((role==='owner'||role==='admin')&&a.role!=='owner')return send(res,403,{error:'Only the owner can create owners or admins.'});
      if(q.userByEmail.get(email))return send(res,409,{error:'That email is already registered.'});
      const temp=crypto.randomBytes(9).toString('base64url')+'a1', uid=S.newId('u');
      db.prepare('insert into users(id,tenant_id,email,name,role,pass_hash,must_change,created_at) values (?,?,?,?,?,?,1,?)').run(uid,a.tid,email,name,role,await S.hashPassword(temp),now());
      audit(a.tid,a.uid,'user.create',email+' as '+role,ip);return send(res,201,{id:uid,tempPassword:temp});
    }
    const um=p.match(/^\/api\/users\/([A-Za-z0-9_-]{1,40})(\/reset-password)?$/);
    if(um){
      if(['owner','admin'].indexOf(a.role)<0)return send(res,403,{error:'Not allowed'});
      const u=q.userById.get(um[1],a.tid); if(!u)return send(res,404,{error:'Not found'});       /* tenant-scoped lookup: other tenants' ids look like "not found" */
      if((u.role==='owner'||u.role==='admin')&&a.role!=='owner'&&u.id!==a.uid)return send(res,403,{error:'Only the owner can change owners or admins.'});
      if(um[2]&&M==='POST'){const temp=crypto.randomBytes(9).toString('base64url')+'a1';db.prepare('update users set pass_hash=?,must_change=1,failed=0,locked_until=0 where id=?').run(await S.hashPassword(temp),u.id);db.prepare('delete from sessions where user_id=?').run(u.id);audit(a.tid,a.uid,'user.reset_password',u.email,ip);return send(res,200,{tempPassword:temp})}
      if(!um[2]&&M==='PATCH'){
        const b=await jsonBody(req), upd={};
        if(b.role!==undefined){if(ROLES.indexOf(b.role)<0)return send(res,400,{error:'Unknown role'});if((b.role==='owner'||b.role==='admin'||u.role==='owner')&&a.role!=='owner')return send(res,403,{error:'Only the owner can change owner/admin roles.'});upd.role=b.role}
        if(b.active!==undefined){if(u.id===a.uid&&!b.active)return send(res,400,{error:'You cannot disable your own account.'});upd.active=b.active?1:0}
        if(b.name!==undefined)upd.name=str(b.name,80);
        const owners=db.prepare('select count(*) c from users where tenant_id=? and role=\'owner\' and active=1').get(a.tid).c;
        if(u.role==='owner'&&owners<=1&&((upd.role&&upd.role!=='owner')||upd.active===0))return send(res,400,{error:'A business must keep at least one active owner.'});
        const ks=Object.keys(upd); if(ks.length){db.prepare('update users set '+ks.map(k=>k+'=?').join(',')+' where id=?').run(...ks.map(k=>upd[k]),u.id);if(upd.role!==undefined||upd.active===0)db.prepare('delete from sessions where user_id=?').run(u.id);audit(a.tid,a.uid,'user.update',u.email+' '+JSON.stringify(upd),ip)}
        return send(res,200,{ok:true});
      }
    }
    if(p==='/api/audit'&&M==='GET'){if(['owner','admin'].indexOf(a.role)<0)return send(res,403,{error:'Not allowed'});
      return send(res,200,{events:db.prepare('select id,user_id,action,detail,ip,ts from audit where tenant_id=? order by id desc limit ?').all(a.tid,Math.min(500,parseInt(url.searchParams.get('limit'))||100))})}
    if(p.startsWith('/api/webhooks/')&&M==='PUT'){
      if(['owner','admin'].indexOf(a.role)<0)return send(res,403,{error:'Not allowed'});
      const ch=p.slice(14); if(!/^[a-z0-9_-]{2,20}$/.test(ch))return send(res,400,{error:'Bad channel'});
      const secret=crypto.randomBytes(32).toString('hex');db.prepare('insert or replace into webhook_secrets(tenant_id,channel,secret_enc) values (?,?,?)').run(a.tid,ch,S.encrypt(MK,secret,a.tid+'|'+ch));
      audit(a.tid,a.uid,'webhook.rotate',ch,ip);return send(res,200,{channel:ch,secret:secret,url:'/webhooks/'+a.tenant.slug+'/'+ch});
    }
    if(p==='/api/sync/pull'&&M==='GET')return send(res,200,pull(a,url));
    if(p==='/api/sync/push'&&M==='POST'){const b=await jsonBody(req,2*1024*1024);const r=push(a,b);return send(res,r.error?400:200,r)}
    return send(res,404,{error:'Not found'});
  }

  /* ---------- static files + router ---------- */
  const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8'};
  const CSP="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'";
  function serveStatic(req,res,pathname){
    let p;try{p=decodeURIComponent(pathname)}catch(e){res.writeHead(400);return res.end('Bad request')}
    if(p.indexOf('\0')>=0){res.writeHead(400);return res.end('Bad request')}
    let file=path.resolve(cfg.staticDir,'.'+path.sep+p.replace(/^\/+/,'')); if(file!==cfg.staticDir&&!file.startsWith(cfg.staticDir+path.sep)){res.writeHead(403);return res.end('Forbidden')}
    fs.stat(file,(e,st)=>{if(!e&&st.isDirectory()){if(!p.endsWith('/')){res.writeHead(301,{Location:p+'/'});return res.end()}file=path.join(file,'index.html')}
      fs.readFile(file,(err,buf)=>{if(err){res.writeHead(404,{'Content-Type':'text/plain'});return res.end('Not found')}
        const h={'Content-Type':MIME[path.extname(file).toLowerCase()]||'application/octet-stream','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Cache-Control':'no-cache'};
        if(/^\/(app|order)\//.test(p)){h['Content-Security-Policy']=CSP;h['X-Frame-Options']='DENY'} if(res._secure)h['Strict-Transport-Security']='max-age=31536000; includeSubDomains';
        res.writeHead(200,h);res.end(buf)})});
  }
  async function handle(req,res){
    res._secure=reqSecure(req);
    const url=new URL(req.url,'http://x'), p=url.pathname, ip=ipOf(req);
    try{
      if(p==='/health')return send(res,200,{ok:true});
      if(p.startsWith('/api/public/'))return await publicRoutes(req,res,url,ip);
      if(p.startsWith('/api/'))return await api(req,res,url,ip);
      if(p.startsWith('/webhooks/'))return await webhook(req,res,url,ip);
      if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);return res.end()}
      return serveStatic(req,res,p==='/'?'/index.html':p);
    }catch(e){
      if(e&&e.status)return send(res,e.status,{error:e.message});
      console.error('[cloud] error:',e&&e.message);return send(res,500,{error:'Server error'});
    }
  }
  const server=http.createServer((req,res)=>{handle(req,res)});
  server.requestTimeout=20000;server.headersTimeout=10000;
  /* housekeeping: expired sessions and old webhook ids */
  const hk=setInterval(()=>{try{db.prepare('delete from sessions where expires_at<?').run(now());db.prepare('delete from webhook_seen where ts<?').run(now()-7*864e5)}catch(e){}},600e3);hk.unref();
  return {server,db,config:cfg,limiter:lim,close:()=>{clearInterval(hk);try{server.close()}catch(e){}try{db.close()}catch(e){}}};
}
module.exports={createApp,POLICY,ROLES,permissions};
if(require.main===module){
  const app=createApp(), port=+process.env.PORT||8788, host=process.env.HOST||'127.0.0.1';
  app.server.listen(port,host,()=>{console.log('Harbinger Cloud on http://'+host+':'+port+'  (sign-up '+(app.config.allowSignup?'OPEN':'closed')+')');if(host==='127.0.0.1')console.log('Local only. Put it behind HTTPS and set HOST/TRUST_PROXY for real use.')});
}
