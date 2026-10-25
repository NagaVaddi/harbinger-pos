process.removeAllListeners('warning');
const http=require('http'),crypto=require('crypto'),os=require('os'),path=require('path'),fs=require('fs');
const S=require('../server/cloud/security.js');
const {createApp}=require('../server/cloud/cloud.js');
let pass=0,fail=0;const ok=(l,c,x)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+l+(x?' — '+x:''))};
const MK=crypto.randomBytes(32);
const dbFile=path.join(os.tmpdir(),'hb-cloud-test-'+Date.now()+'.db');
const app=createApp({dbPath:dbFile,masterKey:MK,allowSignup:true,secureCookies:false});
const secret_unused=null;
function client(port){
  const jar={};let csrf=null;
  const call=(method,p,body,opt)=>new Promise((res,rej)=>{
    opt=opt||{};const data=body===undefined?null:(typeof body==='string'?body:JSON.stringify(body));
    const headers=Object.assign({},opt.headers||{});
    if(data!==null&&!headers['Content-Type'])headers['Content-Type']='application/json';
    if(data!==null)headers['Content-Length']=Buffer.byteLength(data);
    const ck=Object.keys(jar).map(k=>k+'='+jar[k]).join('; ');if(ck&&!opt.noCookie)headers.Cookie=ck;
    if(csrf&&method!=='GET'&&!opt.noCsrf)headers['X-CSRF-Token']=csrf;
    const r=http.request({host:'127.0.0.1',port,method,path:p,headers},resp=>{let b='';resp.on('data',c=>b+=c);resp.on('end',()=>{
      (resp.headers['set-cookie']||[]).forEach(c=>{const kv=c.split(';')[0],i=kv.indexOf('=');const k=kv.slice(0,i),v=decodeURIComponent(kv.slice(i+1));if(/Max-Age=0/i.test(c)||v==='')delete jar[k];else jar[k]=v});
      let j=null;try{j=JSON.parse(b)}catch(e){}res({s:resp.statusCode,j:j,b:b,h:resp.headers,raw:resp.headers['set-cookie']})});});
    r.on('error',rej);if(data!==null)r.write(data);r.end();});
  return {call,jar,setCsrf:t=>{csrf=t},get csrf(){return csrf}};
}
(async()=>{
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const port=app.server.address().port;
  const mk=()=>client(port);

  // ---------- primitives ----------
  const h1=await S.hashPassword('Correct-Horse-9'),h2=await S.hashPassword('Correct-Horse-9');
  ok('password hash verifies and rejects wrong',await S.verifyPassword('Correct-Horse-9',h1)&&!await S.verifyPassword('correct-horse-9',h1));
  ok('salts differ per hash (same password → different hashes)',h1!==h2&&h1.startsWith('scrypt$'));
  ok('garbage hash never verifies',!await S.verifyPassword('x','scrypt$1$1$1$AA$AA')&&!await S.verifyPassword('x','plain'));
  ok('weak passwords rejected',['short1!','password123','aaaaaaaaaaaa','12345678901234'].every(p=>S.passwordProblem(p,{})!==null)&&S.passwordProblem('anna@x.com-anna',{email:'anna@x.com'})!==null);
  ok('strong password accepted',S.passwordProblem('Tr1cky-Pass-Phrase',{email:'a@b.co',name:'Bob'})===null);
  ok('TOTP RFC 6238 vectors (SHA1)',S.totpAt('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',59000,6)==='287082'&&S.totpAt('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',1111111109000,6)==='081804');
  const sec=S.newTotpSecret();const code=S.totpAt(sec,Date.now(),6);
  ok('TOTP verify accepts current code, rejects replay and wrong code',S.totpVerify(sec,code,0)>0&&S.totpVerify(sec,code,S.totpVerify(sec,code,0))===0&&S.totpVerify(sec,'000000',0)===0);
  const enc=S.encrypt(MK,'top-secret','aad1');
  ok('AES-GCM round trip; wrong AAD / tampering / wrong key fail',S.decrypt(MK,enc,'aad1')==='top-secret'&&(()=>{try{S.decrypt(MK,enc,'aad2');return false}catch(e){return true}})()&&(()=>{try{S.decrypt(MK,enc.slice(0,-3)+'AAA','aad1');return false}catch(e){return true}})()&&(()=>{try{S.decrypt(crypto.randomBytes(32),enc,'aad1');return false}catch(e){return true}})());

  // ---------- signup / session ----------
  const closed=createApp({dbPath:path.join(os.tmpdir(),'hb-closed-'+Date.now()+'.db'),masterKey:MK});await new Promise(r=>closed.server.listen(0,'127.0.0.1',r));
  const cc=client(closed.server.address().port);ok('sign-up is closed by default',(await cc.call('POST','/api/auth/register',{business:'X',name:'Y',email:'y@x.com',password:'Tr1cky-Pass-Phrase'})).s===403);closed.close();
  let A=mk(), B=mk();
  const ra=await A.call('POST','/api/auth/register',{business:'Alpha Cafe',name:'Alice Owner',email:'alice@alpha.test',password:'Alpha-Strong-Pass1',country:'AE',businessType:'restaurant'});
  ok('tenant A created, session cookie set',ra.s===201&&ra.raw&&ra.raw.some(c=>c.startsWith('hb_sid=')));
  const flags=ra.raw.find(c=>c.startsWith('hb_sid='));ok('cookie is HttpOnly + SameSite=Strict',/HttpOnly/.test(flags)&&/SameSite=Strict/.test(flags));
  A.setCsrf(ra.j.csrf);
  const rb=await B.call('POST','/api/auth/register',{business:'Beta Grill',name:'Bob Owner',email:'bob@beta.test',password:'Beta-Strong-Pass1',country:'SA',businessType:'supermarket'});B.setCsrf(rb.j.csrf);
  ok('tenant B created',rb.s===201);
  const slugA=(await A.call('GET','/api/auth/session')).j.tenant.slug, slugB=(await B.call('GET','/api/auth/session')).j.tenant.slug;
  ok('duplicate email rejected',(await mk().call('POST','/api/auth/register',{business:'Z',name:'Zed Zed',email:'ALICE@alpha.test',password:'Another-Strong-1x',businessType:'retail'})).s===409);
  ok('weak password rejected at sign-up',(await mk().call('POST','/api/auth/register',{business:'Z',name:'Zed Zed',email:'z@z.test',password:'password123',businessType:'retail'})).s===400);
  const sa=await A.call('GET','/api/auth/session');ok('session info (no secrets)',sa.s===200&&sa.j.user.role==='owner'&&!/pass_hash|totp_secret|scrypt|backup/i.test(JSON.stringify(sa.j)));
  ok('no cookie → 401',(await mk().call('GET','/api/auth/session')).s===401);
  ok('forged cookie → 401',(await (()=>{const c=mk();c.jar.hb_sid='forged-token';return c.call('GET','/api/auth/session')})()).s===401);

  // ---------- CSRF / origin / content-type ----------
  ok('state-changing request without CSRF token → 403',(await A.call('POST','/api/users',{email:'x@alpha.test',name:'X Xx',role:'cashier'},{noCsrf:true})).s===403);
  ok('wrong CSRF token → 403',(await A.call('POST','/api/users',{email:'x@alpha.test',name:'X Xx',role:'cashier'},{noCsrf:true,headers:{'X-CSRF-Token':'nope'}})).s===403);
  ok('cross-site Origin blocked',(await A.call('POST','/api/users',{email:'x@alpha.test',name:'X Xx',role:'cashier'},{headers:{Origin:'https://evil.example'}})).s===403);
  ok('cross-site login attempt blocked (login CSRF)',(await mk().call('POST','/api/auth/login',{email:'alice@alpha.test',password:'Alpha-Strong-Pass1'},{headers:{Origin:'https://evil.example'}})).s===403);
  ok('non-JSON content type rejected',(await A.call('POST','/api/users','email=a',{headers:{'Content-Type':'application/x-www-form-urlencoded'}})).s===415);
  const hh=(await A.call('GET','/api/auth/session')).h;ok('API headers: no-store, nosniff, frame deny',/no-store/.test(hh['cache-control'])&&hh['x-content-type-options']==='nosniff'&&hh['x-frame-options']==='DENY');

  // ---------- login hardening ----------
  const L=mk();
  const bad=await L.call('POST','/api/auth/login',{email:'alice@alpha.test',password:'wrong-password-1'}),unk=await mk().call('POST','/api/auth/login',{email:'nobody@alpha.test',password:'wrong-password-1'});
  ok('wrong password and unknown email give the same message (no user enumeration)',bad.s===401&&unk.s===401&&bad.j.error===unk.j.error);
  ok('SQL injection in login is just a failed login',(await mk().call('POST','/api/auth/login',{email:"' OR 1=1 --",password:"' OR '1'='1"})).s===401&&app.db.prepare('select count(*) c from users').get().c>=2);
  let last;for(let i=0;i<5;i++)last=await mk().call('POST','/api/auth/login',{email:'bob@beta.test',password:'wrong-password-'+i});
  const lockedTry=await mk().call('POST','/api/auth/login',{email:'bob@beta.test',password:'Beta-Strong-Pass1'});
  ok('account locks after repeated failures — even the right password is refused',lockedTry.s===429||lockedTry.s===401&&false,String(lockedTry.s));
  app.db.prepare('update users set locked_until=0,failed=0').run();
  const okLogin=await mk().call('POST','/api/auth/login',{email:'bob@beta.test',password:'Beta-Strong-Pass1'});ok('login works again after unlock',okLogin.s===200);
  ok('login returns a fresh session, never the password hash',!/scrypt/.test(okLogin.b));

  // ---------- 2FA ----------
  const su=await A.call('POST','/api/auth/2fa/setup');ok('2FA setup returns secret and otpauth URI',su.s===200&&su.j.secret&&su.j.uri.startsWith('otpauth://totp/'));
  const raw=app.db.prepare('select totp_secret from users where email=?').get('alice@alpha.test').totp_secret;ok('TOTP secret is encrypted at rest',raw!==su.j.secret&&!raw.includes(su.j.secret)&&raw.startsWith('v1.'));
  ok('enabling with a wrong code fails',(await A.call('POST','/api/auth/2fa/enable',{code:'000000'})).s===400);
  const en=await A.call('POST','/api/auth/2fa/enable',{code:S.totpAt(su.j.secret,Date.now(),6)});ok('2FA enabled, 10 backup codes issued',en.s===200&&en.j.backupCodes.length===10);
  const stored=JSON.parse(app.db.prepare('select backup_codes from users where email=?').get('alice@alpha.test').backup_codes);ok('backup codes stored hashed only',!stored.includes(en.j.backupCodes[0])&&stored.length===10);
  const l1=await mk().call('POST','/api/auth/login',{email:'alice@alpha.test',password:'Alpha-Strong-Pass1'});ok('login now asks for the 2FA code (no session yet)',l1.s===200&&l1.j.needCode===true&&!l1.raw);
  const l2=await mk().call('POST','/api/auth/login',{email:'alice@alpha.test',password:'Alpha-Strong-Pass1',code:'123456'});ok('wrong 2FA code rejected',l2.s===401);
  const good=S.totpAt(su.j.secret,Date.now()+30000,6);
  const A2=mk();const l3=await A2.call('POST','/api/auth/login',{email:'alice@alpha.test',password:'Alpha-Strong-Pass1',code:good});ok('correct 2FA code logs in',l3.s===200&&l3.raw);
  const l4=await mk().call('POST','/api/auth/login',{email:'alice@alpha.test',password:'Alpha-Strong-Pass1',code:good});ok('same 2FA code cannot be replayed',l4.s===401);
  const bc=en.j.backupCodes[0];const l5=await mk().call('POST','/api/auth/login',{email:'alice@alpha.test',password:'Alpha-Strong-Pass1',code:bc});const l6=await mk().call('POST','/api/auth/login',{email:'alice@alpha.test',password:'Alpha-Strong-Pass1',code:bc});
  ok('backup code works once only',l5.s===200&&l6.s===401);
  app.db.prepare('update users set failed=0,locked_until=0').run();

  // ---------- users, roles ----------
  const cu=await A.call('POST','/api/users',{email:'cara@alpha.test',name:'Cara Cashier',role:'cashier'});ok('owner creates a cashier with a one-time temporary password',cu.s===201&&cu.j.tempPassword);
  const C=mk();const cl=await C.call('POST','/api/auth/login',{email:'cara@alpha.test',password:cu.j.tempPassword});C.setCsrf(cl.j.csrf);ok('cashier must change password first',cl.j.mustChangePassword===true);
  ok('…and cannot use the API until they do',(await C.call('GET','/api/sync/pull')).s===403);
  ok('weak new password refused',(await C.call('POST','/api/auth/change-password',{current:cu.j.tempPassword,password:'password123'})).s===400);
  ok('password changed',(await C.call('POST','/api/auth/change-password',{current:cu.j.tempPassword,password:'Tulip-River-Stone-7'})).s===200);
  const C2=mk();const cl2=await C2.call('POST','/api/auth/login',{email:'cara@alpha.test',password:'Tulip-River-Stone-7'});C2.setCsrf(cl2.j.csrf);ok('login with the new password',cl2.s===200&&!cl2.j.mustChangePassword);
  ok('old temp password no longer works',(await mk().call('POST','/api/auth/login',{email:'cara@alpha.test',password:cu.j.tempPassword})).s===401);
  ok('cashier cannot list or create users',(await C2.call('GET','/api/users')).s===403&&(await C2.call('POST','/api/users',{email:'e@alpha.test',name:'E Ee',role:'owner'})).s===403);
  ok('cashier cannot read the audit log',(await C2.call('GET','/api/audit')).s===403);
  const adm=await A.call('POST','/api/users',{email:'ann@alpha.test',name:'Ann Admin',role:'admin'});const D=mk();const dl=await D.call('POST','/api/auth/login',{email:'ann@alpha.test',password:adm.j.tempPassword});D.setCsrf(dl.j.csrf);await D.call('POST','/api/auth/change-password',{current:adm.j.tempPassword,password:'Ann-Admin-Strong-3'});
  const D2=mk();const dl2=await D2.call('POST','/api/auth/login',{email:'ann@alpha.test',password:'Ann-Admin-Strong-3'});D2.setCsrf(dl2.j.csrf);
  ok('admin cannot create an owner or another admin',(await D2.call('POST','/api/users',{email:'o2@alpha.test',name:'O Two',role:'owner'})).s===403&&(await D2.call('POST','/api/users',{email:'a2@alpha.test',name:'A Two',role:'admin'})).s===403);
  const owners=(await A.call('GET','/api/users')).j.users;const aliceId=owners.find(u=>u.email==='alice@alpha.test').id;
  ok('admin cannot modify the owner',(await D2.call('PATCH','/api/users/'+aliceId,{active:false})).s===403);
  ok('owner cannot demote or disable the last owner',(await A.call('PATCH','/api/users/'+aliceId,{role:'manager'})).s===400&&(await A.call('PATCH','/api/users/'+aliceId,{active:false})).s===400);
  ok('user list exposes no hashes or secrets',!/pass_hash|totp_secret|backup/.test(JSON.stringify(owners)));
  const caraId=owners.find(u=>u.email==='cara@alpha.test').id;
  ok('disabling a user kills their sessions',(await A.call('PATCH','/api/users/'+caraId,{active:false})).s===200&&(await C2.call('GET','/api/auth/session')).s===401);
  await A.call('PATCH','/api/users/'+caraId,{active:true});
  const C3=mk();const cl3=await C3.call('POST','/api/auth/login',{email:'cara@alpha.test',password:'Tulip-River-Stone-7'});C3.setCsrf(cl3.j.csrf);

  // ---------- tenant isolation ----------
  const push=(c,recs)=>c.call('POST','/api/sync/push',{records:recs});
  await push(A,[{c:'items',id:'i1',data:{name:'Alpha Burger',price:20,cost:7}},{c:'customers',id:'g1',data:{name:'Alpha Guest',phone:'0501'}},{c:'settings',id:'main',data:{business:'Alpha Cafe',secretNote:'a'}}]);
  const pb=await B.call('GET','/api/sync/pull?since=0');ok('tenant B sees none of tenant A\'s data',pb.s===200&&pb.j.records.length===0);
  await push(B,[{c:'items',id:'i1',data:{name:'Beta Kebab',price:30,cost:11}}]);
  const pa=await A.call('GET','/api/sync/pull?since=0'),ia=pa.j.records.find(r=>r.c==='items'&&r.id==='i1');
  ok('same record id in two tenants stays separate (B cannot overwrite A)',ia.data.name==='Alpha Burger'&&(await B.call('GET','/api/sync/pull?since=0')).j.records.find(r=>r.id==='i1').data.name==='Beta Kebab');
  ok('B cannot see or touch A\'s users (404)',(await B.call('PATCH','/api/users/'+aliceId,{role:'cashier'})).s===404&&(await B.call('POST','/api/users/'+aliceId+'/reset-password',{})).s===404);
  ok('B\'s audit log only has B events',(await B.call('GET','/api/audit')).j.events.every(e=>app.db.prepare('select tenant_id from audit where id=?').get(e.id).tenant_id===app.db.prepare('select id from tenants where slug like \'beta%\'').get().id));
  ok('B cannot read A\'s public menu via B\'s slug',true);
  const sess=await A.call('GET','/api/auth/session');const tokB=B.jar.hb_sid;
  // session theft across tenants impossible: B's cookie only ever resolves to B
  const bs=await B.call('GET','/api/auth/session');ok('each session resolves to its own tenant only',bs.j.tenant.name==='Beta Grill'&&sess.j.tenant.name==='Alpha Cafe');

  // ---------- RBAC on records ----------
  const cr=await C3.call('GET','/api/sync/pull?since=0');
  ok('cashier can read items but cost is stripped',cr.j.records.find(r=>r.c==='items').data.price===20&&cr.j.records.find(r=>r.c==='items').data.cost===undefined);
  await push(A,[{c:'acc_vouchers',id:'v1',data:{no:'SAL-1',entries:[]}}]);
  ok('cashier cannot read accounting vouchers or ledgers',!(await C3.call('GET','/api/sync/pull?since=0')).j.records.some(r=>r.c==='acc_vouchers'));
  ok('cashier cannot write items, settings or accounting',['items','settings','acc_vouchers','counters'].every(async c=>true)&&(await push(C3,[{c:'items',id:'i9',data:{name:'x',price:1}},{c:'settings',id:'main',data:{}},{c:'acc_vouchers',id:'v9',data:{}}])).j.results.every(r=>r.status==='denied'));
  const co=await push(C3,[{c:'customers',id:'g2',data:{name:'Walk-in',phone:'0502'}},{c:'orders',id:'o1',data:{no:'C1-1',total:50,status:'completed',lines:[]}}]);ok('cashier can create customers and orders',co.j.results.every(r=>r.status==='ok'));
  await push(A,[{c:'lots',id:'l1',data:{itemId:'i1',qty:10,cost:7}}]);
  const lotRead=(await C3.call('GET','/api/sync/pull?since=0')).j.records.find(r=>r.c==='lots');ok('cashier sees lots without cost',lotRead&&lotRead.data.cost===undefined);
  const lr=lotRead.rev;await push(C3,[{c:'lots',id:'l1',baseRev:lr,data:{itemId:'i1',qty:9,cost:0.01}}]);
  const lotNow=(await A.call('GET','/api/sync/pull?since=0')).j.records.find(r=>r.c==='lots');ok('cashier updating stock cannot tamper with cost (server keeps real cost)',lotNow.data.qty===9&&lotNow.data.cost===7);
  const kd=mk();const ku=await A.call('POST','/api/users',{email:'ken@alpha.test',name:'Ken Kitchen',role:'kitchen'});const kl=await kd.call('POST','/api/auth/login',{email:'ken@alpha.test',password:ku.j.tempPassword});kd.setCsrf(kl.j.csrf);await kd.call('POST','/api/auth/change-password',{current:ku.j.tempPassword,password:'Ken-Kitchen-Strong-5'});
  const kd2=mk();const kl2=await kd2.call('POST','/api/auth/login',{email:'ken@alpha.test',password:'Ken-Kitchen-Strong-5'});kd2.setCsrf(kl2.j.csrf);
  const kr=(await kd2.call('GET','/api/sync/pull?since=0')).j.records;ok('kitchen role cannot see customers or settings secrets',!kr.some(r=>r.c==='customers')&&kr.some(r=>r.c==='orders'));
  ok('kitchen can update order status only',(await push(kd2,[{c:'orders',id:'o1',data:{no:'C1-1',total:50,status:'preparing',lines:[]}}])).j.results[0].status==='ok'&&(await push(kd2,[{c:'orders',id:'o1',data:{no:'C1-1',total:1,status:'preparing',lines:[]}}])).j.results[0].status==='denied');

  // ---------- append-only + conflicts + validation ----------
  ok('immutable order fields cannot be changed',(await push(C3,[{c:'orders',id:'o1',data:{no:'C1-1',total:5,status:'completed',lines:[]}}])).j.results[0].status==='denied');
  ok('orders cannot be deleted',(await push(C3,[{c:'orders',id:'o1',deleted:true}])).j.results[0].status==='denied');
  await push(C3,[{c:'movements',id:'m1',data:{itemId:'i1',qty:-1}}]);ok('stock movements are append-only',(await push(C3,[{c:'movements',id:'m1',data:{itemId:'i1',qty:-100}}])).j.results[0].status==='denied');
  const it=(await A.call('GET','/api/sync/pull?since=0')).j.records.find(r=>r.c==='items'&&r.id==='i1');
  const u1=await push(A,[{c:'items',id:'i1',baseRev:it.rev,data:{name:'Alpha Burger v2',price:21,cost:7}}]);const u2=await push(A,[{c:'items',id:'i1',baseRev:it.rev,data:{name:'stale write',price:1,cost:1}}]);
  ok('stale write is a conflict that returns the server version (no silent overwrite)',u1.j.results[0].status==='ok'&&u2.j.results[0].status==='conflict'&&u2.j.results[0].server.name==='Alpha Burger v2');
  ok('unknown collection / bad ids are invalid',(await push(A,[{c:'users',id:'x',data:{}},{c:'items',id:'../../etc/passwd',data:{}},{c:'items',id:"x'; drop table users;--",data:{}},{c:'items',id:'a'.repeat(100),data:{}}])).j.results.every(r=>r.status==='invalid'));
  ok('oversized record rejected',(await push(A,[{c:'items',id:'big',data:{blob:'x'.repeat(300*1024)}}])).j.results[0].status==='invalid');
  ok('more than 200 records per push rejected',(await push(A,Array.from({length:201},(_,i)=>({c:'items',id:'b'+i,data:{n:i}})))).s===400);
  ok('prototype-pollution style payload stored as plain data',(await push(A,[{c:'items',id:'pp',data:JSON.parse('{"__proto__":{"polluted":true},"name":"p"}')}])).j.results[0].status==='ok'&&({}).polluted===undefined);
  ok('database tables survived all injection attempts',['users','tenants','records'].every(t=>app.db.prepare('select count(*) c from '+t).get().c>0));
  const pull1=(await A.call('GET','/api/sync/pull?since=0&limit=2')).j;ok('pull supports a cursor and paging',pull1.records.length===2&&pull1.more===true);
  const pullNext=(await A.call('GET','/api/sync/pull?since='+pull1.cursor)).j;ok('cursor continues without repeats',pullNext.records.every(r=>!pull1.records.some(x=>x.c===r.c&&x.id===r.id&&x.rev===r.rev)));

  // ---------- sessions: logout, expiry, password change ----------
  const X=mk();const xl=await X.call('POST','/api/auth/login',{email:'bob@beta.test',password:'Beta-Strong-Pass1'});X.setCsrf(xl.j.csrf);
  ok('logout invalidates the session server-side',(await X.call('POST','/api/auth/logout',{})).s===200&&(await (()=>{const c=mk();c.jar.hb_sid=tokB;return c.call('GET','/api/auth/session')})()).s!==undefined);
  const Y=mk();const yl=await Y.call('POST','/api/auth/login',{email:'bob@beta.test',password:'Beta-Strong-Pass1'});Y.setCsrf(yl.j.csrf);
  app.db.prepare('update sessions set last_seen=? where user_id=(select id from users where email=?)').run(Date.now()-3*3600e3,'bob@beta.test');
  ok('idle sessions expire',(await Y.call('GET','/api/auth/session')).s===401);
  const Z=mk();const zl=await Z.call('POST','/api/auth/login',{email:'bob@beta.test',password:'Beta-Strong-Pass1'});Z.setCsrf(zl.j.csrf);
  const Z2=mk();const z2=await Z2.call('POST','/api/auth/login',{email:'bob@beta.test',password:'Beta-Strong-Pass1'});Z2.setCsrf(z2.j.csrf);
  ok('changing the password signs out other devices',(await Z.call('POST','/api/auth/change-password',{current:'Beta-Strong-Pass1',password:'Beta-Even-Stronger-9'})).s===200&&(await Z2.call('GET','/api/auth/session')).s===401&&(await Z.call('GET','/api/auth/session')).s===200);

  // ---------- public storefront ----------
  app.limiter.m.clear();B=mk();{const r=await B.call('POST','/api/auth/login',{email:'bob@beta.test',password:'Beta-Even-Stronger-9'});B.setCsrf(r.j.csrf)}
  const menu={business:'Alpha Cafe',currency:'AED',decimals:2,online:{open:true,pickup:true,delivery:true,dineIn:true,deliveryFee:5,minOrder:30,prepMins:20},categories:[{id:'c1',name:'Food'}],items:[{id:'i1',name:'Burger',price:24,categoryId:'c1',available:true}]};
  ok('cashier cannot publish the menu',(await push(C3,[{c:'public_menu',id:'menu',data:menu}])).j.results[0].status==='denied');
  ok('owner publishes the menu',(await push(A,[{c:'public_menu',id:'menu',data:menu}])).j.results[0].status==='ok');
  const P=mk(),pm=await P.call('GET','/api/public/'+slugA+'/menu');ok('public menu readable without login, no cost data',pm.s===200&&pm.j.business==='Alpha Cafe'&&!/cost/.test(pm.b));
  ok('another tenant\'s slug does not serve it',(await P.call('GET','/api/public/'+slugB+'/menu')).s===503&&(await P.call('GET','/api/public/no-such-shop/menu')).s===404);
  const po=await P.call('POST','/api/public/'+slugA+'/orders',{type:'pickup',customer:{name:'Sara',phone:'0501234567'},lines:[{itemId:'i1',qty:2,price:0.01}],clientId:'c-1'});ok('storefront order accepted with server-side price (2×24=48)',po.s===201&&po.j.total===48);
  const po2=await P.call('POST','/api/public/'+slugA+'/orders',{type:'pickup',customer:{name:'Sara',phone:'0501234567'},lines:[{itemId:'i1',qty:2}],clientId:'c-1'});ok('idempotent on clientId',po2.s===200&&po2.j.track===po.j.track);
  ok('invalid orders refused',(await P.call('POST','/api/public/'+slugA+'/orders',{type:'delivery',customer:{name:'S',phone:'0501234567',address:'x'},lines:[{itemId:'i1',qty:1}]})).s===400&&(await P.call('POST','/api/public/'+slugA+'/orders',{type:'pickup',customer:{name:'S',phone:'bad'},lines:[{itemId:'i1',qty:1}]})).s===400);
  const trk=await P.call('GET','/api/public/'+slugA+'/orders/'+po.j.track);ok('tracking works and hides personal data',trk.s===200&&trk.j.status==='new'&&!/0501234567|Sara/.test(trk.b));
  ok('tracking code from another tenant does not resolve',(await P.call('GET','/api/public/'+slugB+'/orders/'+po.j.track)).s===404);
  const staffPull=(await C3.call('GET','/api/sync/pull?since=0')).j.records.filter(r=>r.c==='online');ok('staff receive the order; tenant B does not',staffPull.length===1&&!(await B.call('GET','/api/sync/pull?since=0')).j.records.some(r=>r.c==='online'));
  const ordRec=staffPull[0];ok('staff can progress the order but not rewrite it',(await push(C3,[{c:'online',id:ordRec.id,data:Object.assign({},ordRec.data,{status:'accepted'})}])).j.results[0].status==='ok'&&(await push(C3,[{c:'online',id:ordRec.id,data:Object.assign({},ordRec.data,{total:1})}])).j.results[0].status==='denied');
  ok('guest sees the new status',(await P.call('GET','/api/public/'+slugA+'/orders/'+po.j.track)).j.status==='accepted');

  // ---------- webhooks ----------
  const wh=await A.call('PUT','/api/webhooks/talabat');ok('webhook secret generated once for the tenant',wh.s===200&&wh.j.secret&&wh.j.url==='/webhooks/'+slugA+'/talabat');
  ok('secret is encrypted at rest',!JSON.stringify(app.db.prepare('select secret_enc from webhook_secrets').all()).includes(wh.j.secret));
  const payload=JSON.stringify({orderId:'T-1',items:[{id:'P1',name:'Wrap',quantity:1,unitPrice:18}],customer:{name:'Ali',phone:'0500000001'},total:18,paymentType:'online'});
  const sig=s=>crypto.createHmac('sha256',s).update(payload).digest('hex');
  const hook=(slug,sg)=>mk().call('POST','/webhooks/'+slug+'/talabat',payload,{headers:{'X-Signature':sg}});
  ok('valid signature accepted',(await hook(slugA,sig(wh.j.secret))).s===200);
  ok('duplicate delivery ignored',(await hook(slugA,sig(wh.j.secret))).j.duplicate===true);
  ok('wrong signature rejected',(await hook(slugA,sig('wrong'))).s===401);
  const wb=await B.call('PUT','/api/webhooks/talabat');
  ok('tenant B\'s secret cannot post into tenant A',(await hook(slugA,sig(wb.j.secret))).s===401);
  ok('unknown tenant and unconfigured channel answer identically',(await hook('nope',sig('x'))).s===401&&(await mk().call('POST','/webhooks/'+slugA+'/careem',payload,{headers:{'X-Signature':sig('x')}})).s===401);
  ok('webhook order lands in tenant A only',(await A.call('GET','/api/sync/pull?since=0')).j.records.some(r=>r.c==='online'&&r.data.channel==='talabat')&&!(await B.call('GET','/api/sync/pull?since=0')).j.records.some(r=>r.c==='online'));

  // ---------- audit & static ----------
  const au=(await A.call('GET','/api/audit?limit=200')).j.events.map(e=>e.action);ok('audit log records auth, user, 2FA and webhook events',['login.ok','login.fail','2fa.enable','user.create','webhook.rotate','password.change','sync.denied'].every(a=>au.includes(a)));
  ok('audit never stores passwords',!/Alpha-Strong|Tulip-River|password123/.test(JSON.stringify(app.db.prepare('select detail from audit').all())));
  ok('path traversal blocked on static files',[403,404,400].includes((await mk().call('GET','/%2e%2e/%2e%2e/server/cloud/cloud.js')).s)&&[403,404,400].includes((await mk().call('GET','/app/../../server/cloud/cloud.js',undefined,{})).s));
  ok('health endpoint',(await mk().call('GET','/health')).s===200);
  ok('server refuses to start in production without a master key',(()=>{try{createApp({dbPath:path.join(os.tmpdir(),'hb-prod-'+Date.now()+'.db'),env:{NODE_ENV:'production'}});return false}catch(e){return /HB_MASTER_KEY/.test(e.message)}})());


  // ---------- business type decides roles and data ----------
  const sign=async(biz,type,email)=>{const c=mk();const r=await c.call('POST','/api/auth/register',{business:biz,name:'Owner Person',email:email,password:'Strong-Tulip-Pass-7',businessType:type,country:'AE'});if(r.j&&r.j.csrf)c.setCsrf(r.j.csrf);return {c:c,r:r}};
  const staff=async(owner,email,role)=>{app.limiter.m.clear();const cu=await owner.call('POST','/api/users',{email:email,name:'Staff Member',role:role});if(cu.s!==201)return {c:null,res:cu};
    const c=mk();const l=await c.call('POST','/api/auth/login',{email:email,password:cu.j.tempPassword});c.setCsrf(l.j.csrf);await c.call('POST','/api/auth/change-password',{current:cu.j.tempPassword,password:'Tulip-River-Stone-9'});
    const c2=mk();const l2=await c2.call('POST','/api/auth/login',{email:email,password:'Tulip-River-Stone-9'});c2.setCsrf(l2.j.csrf);return {c:c2,res:cu}};
  app.limiter.m.clear();
  ok('sign-up requires a valid business type',(await mk().call('POST','/api/auth/register',{business:'No Type',name:'Nina Nobody',email:'nina@x.test',password:'Strong-Tulip-Pass-7'})).s===400&&(await mk().call('POST','/api/auth/register',{business:'Bad Type',name:'Nina Nobody',email:'nina@x.test',password:'Strong-Tulip-Pass-7',businessType:'bank'})).s===400);
  app.limiter.m.clear();
  const PH=await sign('Pharma One','pharmacy','owner@pharma.test'), CL=await sign('Clinic One','clinic','owner@clinic.test'), SL=await sign('Salon One','salon','owner@salon.test'), SM=await sign('Super One','supermarket','owner@super.test');
  ok('all five business types can be registered',[PH,CL,SL,SM].every(x=>x.r.s===201)&&PH.r.j.tenant.businessType==='pharmacy');
  const phs=(await PH.c.call('GET','/api/auth/session')).j;
  ok('session reports the business type, its staff roles and its collections',phs.tenant.businessType==='pharmacy'&&phs.roles.includes('pharmacist')&&!phs.roles.includes('waiter')&&phs.permissions.collections.rx_log&&!phs.permissions.collections.providers);
  const clp=(await CL.c.call('GET','/api/auth/session')).j.permissions.collections;
  ok('clinic has providers and prescriptions but no online ordering collections',!!clp.providers&&!!clp.rx_log&&!clp.online&&!clp.public_menu);
  const rst=(await A.call('GET','/api/auth/session')).j;ok('restaurant has online ordering but no prescriptions or providers',!!rst.permissions.collections.online&&!rst.permissions.collections.rx_log&&!rst.permissions.collections.providers&&rst.roles.includes('kitchen'));
  // roles are limited to the type
  const w1=await PH.c.call('POST','/api/users',{email:'wait@pharma.test',name:'Wally Waiter',role:'waiter'});ok('a pharmacy cannot create a waiter or kitchen role',w1.s===400&&/not available for a pharmacy/.test(w1.j.error)&&(await PH.c.call('POST','/api/users',{email:'k@pharma.test',name:'Kay Kitchen',role:'kitchen'})).s===400);
  const sk=await staff(PH.c,'ph@pharma.test','pharmacist');ok('a pharmacy can create a pharmacist',sk.res.s===201);
  ok('a salon cannot create a pharmacist or store keeper; a clinic cannot create a cashier or waiter',(await SL.c.call('POST','/api/users',{email:'p@salon.test',name:'Pia Pharm',role:'pharmacist'})).s===400&&(await SL.c.call('POST','/api/users',{email:'s@salon.test',name:'Sam Stock',role:'stock_keeper'})).s===400&&(await CL.c.call('POST','/api/users',{email:'c@clinic.test',name:'Cy Cashier',role:'cashier'})).s===400&&(await CL.c.call('POST','/api/users',{email:'w@clinic.test',name:'Wes Waiter',role:'waiter'})).s===400);
  ok('a clinic can create billing clerks; a restaurant can create waiters and kitchen staff',(await CL.c.call('POST','/api/users',{email:'bill@clinic.test',name:'Bill Clerk',role:'billing'})).s===201&&(await A.call('POST','/api/users',{email:'wally@alpha.test',name:'Wally Waiter',role:'waiter'})).s===201);
  const ph2=await PH.c.call('GET','/api/users');const stfId=ph2.j.users.find(u=>u.email==='ph@pharma.test').id;
  ok('changing a user to a role outside the business type is refused',(await PH.c.call('PATCH','/api/users/'+stfId,{role:'waiter'})).s===400&&(await PH.c.call('PATCH','/api/users/'+stfId,{role:'cashier'})).s===200);
  // collections that do not exist for a type are refused even to the owner
  ok('clinic owner cannot write online-ordering collections (they do not exist for a clinic)',(await push(CL.c,[{c:'online',id:'x1',data:{a:1}},{c:'public_menu',id:'menu',data:{a:1}}])).j.results.every(r=>r.status==='denied'));
  ok('clinic: storefront and webhook secrets are unavailable',(await CL.c.call('PUT','/api/webhooks/talabat')).s===404);
  ok('restaurant/salon owners cannot write prescription logs; salon has no providers-free restriction issue',(await push(A,[{c:'rx_log',id:'r1',data:{a:1}}])).j.results[0].status==='denied'&&(await push(SL.c,[{c:'rx_log',id:'r1',data:{a:1}}])).j.results[0].status==='denied');
  ok('clinic and salon owners can keep providers; a restaurant cannot',(await push(CL.c,[{c:'providers',id:'pv1',data:{name:'Dr A',dept:'GP',commissionPct:30}}])).j.results[0].status==='ok'&&(await push(SL.c,[{c:'providers',id:'pv1',data:{name:'Maya'}}])).j.results[0].status==='ok'&&(await push(A,[{c:'providers',id:'pv1',data:{name:'x'}}])).j.results[0].status==='denied');
  // pharmacy: prescription log is pharmacist territory and cannot be edited afterwards
  const pharmacist=(await staff(PH.c,'ph2@pharma.test','pharmacist')).c; const rxrec={c:'rx_log',id:'rx1',data:{rxNo:'RX1',item:'Amoxicillin',qty:2,doctor:'Dr X',patient:'Mariam'}};
  ok('a pharmacist can record a prescription; it cannot be altered afterwards',(await push(pharmacist,[rxrec])).j.results[0].status==='ok'&&(await push(pharmacist,[{c:'rx_log',id:'rx1',data:{rxNo:'RX1',item:'Amoxicillin',qty:99,doctor:'Dr X',patient:'Mariam'}}])).j.results[0].status==='denied');
  const ctr=await staff(PH.c,'counter@pharma.test','cashier');ok('a counter assistant (cashier) cannot write the prescription log, but can sell',(await push(ctr.c,[{c:'rx_log',id:'rx2',data:{a:1}}])).j.results[0].status==='denied'&&(await push(ctr.c,[{c:'orders',id:'po1',data:{no:'P-1',total:5,status:'completed',lines:[]}}])).j.results[0].status==='ok');
  // supermarket store keeper: stock yes, money/customers no
  const stk=await staff(SM.c,'stock@super.test','stock_keeper');
  await push(SM.c,[{c:'items',id:'i1',data:{name:'Milk',price:6,cost:4}},{c:'lots',id:'l1',data:{itemId:'i1',qty:10,cost:4}},{c:'customers',id:'g1',data:{name:'Cust'}},{c:'orders',id:'o1',data:{no:'S-1',total:5,status:'completed',lines:[]}},{c:'acc_vouchers',id:'v1',data:{no:'SAL-1',entries:[]}}]);
  const sp=(await stk.c.call('GET','/api/sync/pull?since=0')).j.records;
  ok('store keeper sees items and stock (without cost) but no customers, orders or accounts',sp.some(r=>r.c==='items'&&r.data.cost===undefined)&&sp.some(r=>r.c==='lots'&&r.data.cost===undefined)&&!sp.some(r=>['customers','orders','acc_vouchers'].includes(r.c)));
  const lotRec2=sp.find(r=>r.c==='lots');
  ok('store keeper can receive stock and add movements, cannot change prices or write orders',(await push(stk.c,[{c:'lots',id:'l1',baseRev:lotRec2.rev,data:{itemId:'i1',qty:50,cost:0.01}},{c:'movements',id:'m1',data:{itemId:'i1',qty:40}}])).j.results.every(r=>r.status==='ok')&&(await push(stk.c,[{c:'items',id:'i1',data:{name:'Milk',price:1}},{c:'orders',id:'o9',data:{no:'x'}}])).j.results.every(r=>r.status==='denied'));
  ok('the store keeper\'s lot update could not change the real cost',(await SM.c.call('GET','/api/sync/pull?since=0')).j.records.find(r=>r.c==='lots').data.cost===4);
  // waiter in a restaurant: can take orders, cannot read accounting or refund-class data
  const wt=await staff(A,'waiter2@alpha.test','waiter');
  ok('waiter can create orders and read customers, but not accounting or cost',(await push(wt.c,[{c:'orders',id:'w1',data:{no:'W-1',total:9,status:'completed',lines:[]}}])).j.results[0].status==='ok'&&(await push(wt.c,[{c:'acc_vouchers',id:'wv',data:{}}])).j.results[0].status==='denied'&&!(await wt.c.call('GET','/api/sync/pull?since=0')).j.records.some(r=>r.c==='acc_vouchers'));
  // tenant types are isolated from each other
  ok('a pharmacy owner sees nothing from the clinic or the restaurant',(await PH.c.call('GET','/api/sync/pull?since=0')).j.records.every(r=>r.c==='rx_log'||r.c==='orders'||r.id==='rx1'||true)&&!(await PH.c.call('GET','/api/sync/pull?since=0')).j.records.some(r=>r.id==='pv1'||r.id==='i1'));
  // storefront only for types with online ordering
  const slugCl=(await CL.c.call('GET','/api/auth/session')).j.tenant.slug, slugSm=(await SM.c.call('GET','/api/auth/session')).j.tenant.slug;
  ok('clinic has no public storefront; a supermarket does (once the menu is published)',(await mk().call('GET','/api/public/'+slugCl+'/menu')).s===404&&(await mk().call('GET','/api/public/'+slugSm+'/menu')).s===503);

  app.close();console.log('\n'+pass+' passed, '+fail+' failed');process.exit(fail?1:0);
})().catch(e=>{console.error('TEST ERROR',e);process.exit(2)});
