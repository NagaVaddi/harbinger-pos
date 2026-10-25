'use strict';
/* Harbinger Gateway — zero-dependency Node server.
   Public:   GET /api/public/menu · POST /api/public/orders · GET /api/public/orders/:track
   POS app:  (Bearer API key) POST /api/menu · GET /api/inbox · POST /api/inbox/ack · POST /api/orders/:id/status · GET /api/ping · GET /api/outbox
   Apps:     POST /webhooks/:channel   (HMAC-SHA256 signed, secret in env WEBHOOK_SECRET_<CHANNEL>)
   Static:   serves ../website (marketing site, /app/ POS, /order/ storefront)
   Run:      node server/gateway.js     (PORT, HOST, DATA_FILE, HARBINGER_API_KEY, PUBLIC_ORIGINS, WEBHOOK_SECRET_TALABAT …) */

const http=require('http'), fs=require('fs'), path=require('path'), crypto=require('crypto');
const {normalize}=require('./channels');

const PORT=+process.env.PORT||8787, HOST=process.env.HOST||'127.0.0.1';
const DATA_FILE=process.env.DATA_FILE||path.join(__dirname,'data.json');
const STATIC=path.resolve(process.env.STATIC_DIR||path.join(__dirname,'..','website'));
const ORIGINS=(process.env.PUBLIC_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean);
const MAX_BODY=+process.env.MAX_BODY||256*1024;

/* ---------- persistence ---------- */
let D={apiKey:'',menu:null,orders:{},inbox:[],seen:{},outbox:[],clientIds:{}}, firstRun=false;
try{D=Object.assign(D,JSON.parse(fs.readFileSync(DATA_FILE,'utf8')))}catch(e){firstRun=true}
if(process.env.HARBINGER_API_KEY)D.apiKey=process.env.HARBINGER_API_KEY;
if(!D.apiKey){D.apiKey=crypto.randomBytes(24).toString('hex');firstRun=true}
let saveT=null;
function save(){clearTimeout(saveT);saveT=setTimeout(()=>{try{const tmp=DATA_FILE+'.tmp';fs.writeFileSync(tmp,JSON.stringify(D),{mode:0o600});fs.renameSync(tmp,DATA_FILE)}catch(e){console.error('save failed:',e.message)}},150)}
function prune(){ // keep the file small: drop finished orders older than 7 days
  const cut=Date.now()-7*864e5;
  Object.keys(D.orders).forEach(id=>{const o=D.orders[id];if(o.ts<cut&&['delivered','rejected','cancelled'].indexOf(o.status)>=0)delete D.orders[id]});
  Object.keys(D.seen).forEach(k=>{if(D.seen[k]<cut)delete D.seen[k]});
  Object.keys(D.clientIds).forEach(k=>{if(D.clientIds[k].ts<cut)delete D.clientIds[k]});
  D.outbox=D.outbox.filter(x=>x.ts>cut);
}
setInterval(()=>{prune();save()},3600e3).unref();

/* ---------- helpers ---------- */
const rid=n=>crypto.randomBytes(n).toString('base64url');
const safeEq=(a,b)=>{const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&crypto.timingSafeEqual(x,y)};
const clean=(s,max)=>String(s==null?'':s).replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max);
const decs=()=>{const d=D.menu&&D.menu.decimals;return Number.isInteger(d)&&d>=0&&d<=3?d:2};
const r2=n=>{const p=Math.pow(10,decs());return Math.round((n+Number.EPSILON)*p)/p};
function send(res,code,obj,extra){
  const body=JSON.stringify(obj);
  if(code===413){extra=Object.assign({Connection:'close'},extra);res.on('finish',()=>{if(res.req&&res.req.socket)res.req.socket.destroy()})}
  res.writeHead(code,Object.assign({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},extra||{}));
  res.end(body);
}
function readBody(req,max){
  return new Promise((resolve,reject)=>{
    let size=0;const chunks=[];
    req.on('data',c=>{if(size>max)return;size+=c.length;if(size>max){chunks.length=0;reject(Object.assign(new Error('Payload too large'),{status:413}));return}chunks.push(c)});
    req.on('end',()=>resolve(Buffer.concat(chunks)));
    req.on('error',reject);
  });
}
const buckets=new Map();
function limited(ip,key,max,windowMs){
  const k=key+'|'+ip, t=Date.now(), b=buckets.get(k)||{n:0,reset:t+windowMs};
  if(t>b.reset){b.n=0;b.reset=t+windowMs}
  b.n++;buckets.set(k,b);return b.n>max;
}
setInterval(()=>{const t=Date.now();buckets.forEach((b,k)=>{if(t>b.reset)buckets.delete(k)})},60e3).unref();
const clientIp=req=>(process.env.TRUST_PROXY&&String(req.headers['x-forwarded-for']||'').split(',')[0].trim())||req.socket.remoteAddress||'?';
const authed=req=>{const h=String(req.headers.authorization||'');return h.startsWith('Bearer ')&&safeEq(h.slice(7),D.apiKey)};
function cors(req,res){
  const o=req.headers.origin; if(o&&ORIGINS.indexOf(o)>=0){res.setHeader('Access-Control-Allow-Origin',o);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type')}
}

/* ---------- public storefront API ---------- */
function validateOrder(b){
  const m=D.menu; if(!m)throw Object.assign(new Error('Menu is not published yet'),{status:503});
  if(!m.online||!m.online.open)throw Object.assign(new Error('Online ordering is closed right now'),{status:409});
  const type=b.type; if(['pickup','delivery','dine-in'].indexOf(type)<0)throw new Error('Choose pickup, delivery or dine-in');
  if(type==='pickup'&&!m.online.pickup||type==='delivery'&&!m.online.delivery||type==='dine-in'&&!m.online.dineIn)throw new Error('That order type is not available');
  const cust={name:clean(b.customer&&b.customer.name,60),phone:clean(b.customer&&b.customer.phone,20).replace(/\s+/g,''),address:clean(b.customer&&b.customer.address,200)};
  if(!cust.name)throw new Error('Please enter your name');
  if(!/^\+?[0-9]{7,15}$/.test(cust.phone))throw new Error('Please enter a valid phone number');
  if(type==='delivery'&&cust.address.length<5)throw new Error('Please enter your delivery address');
  const table=type==='dine-in'?clean(b.table,12):''; if(type==='dine-in'&&!/^[A-Za-z0-9 _-]{1,12}$/.test(table))throw new Error('Table number is missing — scan the QR code on your table');
  if(!Array.isArray(b.lines)||!b.lines.length||b.lines.length>40)throw new Error('Your cart is empty');
  const items=new Map(m.items.map(i=>[i.id,i])); let subtotal=0; const lines=[];
  for(const l of b.lines){
    const it=items.get(String(l&&l.itemId)), qty=Math.floor(+l.qty);
    if(!it)throw new Error('An item in your cart is no longer on the menu');
    if(!it.available)throw new Error(it.name+' is currently unavailable');
    if(!(qty>=1&&qty<=50))throw new Error('Invalid quantity');
    subtotal=r2(subtotal+it.price*qty); lines.push({itemId:it.id,name:it.name,qty:qty,price:it.price,note:clean(l.note,80)});
  }
  const fee=type==='delivery'?r2(+m.online.deliveryFee||0):0;
  if(type==='delivery'&&subtotal<(+m.online.minOrder||0))throw new Error('Minimum order for delivery is '+m.online.minOrder+' '+m.currency);
  return {type:type,table:table,customer:cust,lines:lines,deliveryFee:fee,total:r2(subtotal+fee),note:clean(b.note,200),payment:'cod'};
}
function publicStatus(o){return {track:o.track,status:o.status,type:o.type,etaMins:o.etaMins||null,total:o.total,updated:o.updated||o.ts}}

/* ---------- request router ---------- */
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8','.csv':'text/csv'};
const CSP="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'; object-src 'none'";
function serveStatic(req,res,pathname){
  let p; try{p=decodeURIComponent(pathname)}catch(e){res.writeHead(400);return res.end('Bad request')}
  if(p.indexOf('\0')>=0){res.writeHead(400);return res.end('Bad request')}
  let file=path.resolve(STATIC,'.'+path.sep+p.replace(/^\/+/,''));
  if(file!==STATIC&&!file.startsWith(STATIC+path.sep)){res.writeHead(403);return res.end('Forbidden')}
  fs.stat(file,(e,st)=>{
    if(!e&&st.isDirectory()){if(!p.endsWith('/')){res.writeHead(301,{Location:p+'/'});return res.end()}file=path.join(file,'index.html')}
    fs.readFile(file,(err,buf)=>{
      if(err){res.writeHead(404,{'Content-Type':'text/plain'});return res.end('Not found')}
      const h={'Content-Type':MIME[path.extname(file).toLowerCase()]||'application/octet-stream','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Cache-Control':'no-cache'};
      if(/^\/(app|order)\//.test(p))h['Content-Security-Policy']=CSP;
      res.writeHead(200,h);res.end(buf);
    });
  });
}
async function handle(req,res){
  const u=new URL(req.url,'http://x'), p=u.pathname, ip=clientIp(req), M=req.method;
  if(p.startsWith('/api/public/')){
    cors(req,res); if(M==='OPTIONS'){res.writeHead(204);return res.end()}
    if(M==='GET'&&p==='/api/public/menu'){if(limited(ip,'menu',120,60e3))return send(res,429,{error:'Too many requests'});if(!D.menu)return send(res,503,{error:'Menu not published yet'});return send(res,200,D.menu)}
    if(M==='POST'&&p==='/api/public/orders'){
      if(limited(ip,'order-try',60,10*60e3))return send(res,429,{error:'Too many requests. Please try again later.'});
      let b; try{b=JSON.parse((await readBody(req,32*1024)).toString('utf8'))}catch(e){return send(res,e.status||400,{error:e.status===413?'Payload too large':'Invalid request'})}
      const cid=clean(b.clientId,40); if(cid&&D.clientIds[cid])return send(res,200,D.clientIds[cid].result);
      let v; try{v=validateOrder(b)}catch(e){return send(res,e.status||400,{error:e.message})}
      if(limited(ip,'order',10,10*60e3))return send(res,429,{error:'Too many orders from this device. Please try again later.'});
      const id='ON-'+rid(6), track=rid(6).toUpperCase().replace(/[^A-Z0-9]/g,'X').slice(0,6);
      const o=Object.assign({id:id,track:track,ts:Date.now(),channel:'storefront',source:v.table?'qr':'web',status:'new',updated:Date.now()},v);
      D.orders[id]=o;D.inbox.push(id);
      const result={track:track,status:'new',etaMins:D.menu&&D.menu.online?D.menu.online.prepMins:null,total:o.total};
      if(cid)D.clientIds[cid]={ts:Date.now(),result:result};
      save();return send(res,201,result);
    }
    const m=p.match(/^\/api\/public\/orders\/([A-Za-z0-9]{4,12})$/);
    if(M==='GET'&&m){if(limited(ip,'track',120,60e3))return send(res,429,{error:'Too many requests'});const o=Object.values(D.orders).find(x=>x.track===m[1].toUpperCase());return o?send(res,200,publicStatus(o)):send(res,404,{error:'Order not found'})}
    return send(res,404,{error:'Not found'});
  }
  if(p.startsWith('/api/')){
    if(!authed(req)){if(limited(ip,'authfail',20,10*60e3))return send(res,429,{error:'Too many attempts'});return send(res,401,{error:'Unauthorized'})}
    if(M==='GET'&&p==='/api/ping')return send(res,200,{ok:true,name:'Harbinger Gateway',time:Date.now()});
    if(M==='POST'&&p==='/api/menu'){let b;try{b=JSON.parse((await readBody(req,MAX_BODY)).toString('utf8'))}catch(e){return send(res,400,{error:'Invalid JSON'})}
      if(!b||!Array.isArray(b.items)||!Array.isArray(b.categories))return send(res,400,{error:'Invalid menu'});D.menu=b;save();return send(res,200,{ok:true,items:b.items.length})}
    if(M==='GET'&&p==='/api/inbox')return send(res,200,{orders:D.inbox.map(id=>D.orders[id]).filter(Boolean)});
    if(M==='POST'&&p==='/api/inbox/ack'){let b;try{b=JSON.parse((await readBody(req,64*1024)).toString('utf8'))}catch(e){return send(res,400,{error:'Invalid JSON'})}
      const ids=Array.isArray(b.ids)?b.ids.map(String):[];D.inbox=D.inbox.filter(id=>ids.indexOf(id)<0);save();return send(res,200,{ok:true})}
    const m=p.match(/^\/api\/orders\/([^/]+)\/status$/);
    if(M==='POST'&&m){let b;try{b=JSON.parse((await readBody(req,16*1024)).toString('utf8'))}catch(e){return send(res,400,{error:'Invalid JSON'})}
      const o=D.orders[decodeURIComponent(m[1])];const ok=['accepted','preparing','ready','out','delivered','rejected','cancelled'];
      if(!o)return send(res,404,{error:'Unknown order'});if(ok.indexOf(b.status)<0)return send(res,400,{error:'Invalid status'});
      o.status=b.status;o.updated=Date.now();if(b.etaMins)o.etaMins=Math.max(1,Math.min(240,Math.round(+b.etaMins)));
      if(o.channel!=='storefront')D.outbox.push({id:rid(6),ts:Date.now(),channel:o.channel,orderId:o.id,extId:o.extId,status:b.status}); // a channel adapter forwards these to the app's API
      save();return send(res,200,{ok:true})}
    if(M==='GET'&&p==='/api/outbox')return send(res,200,{items:D.outbox});
    return send(res,404,{error:'Not found'});
  }
  const wm=p.match(/^\/webhooks\/([a-z0-9_-]{2,20})$/);
  if(wm){
    if(M!=='POST')return send(res,405,{error:'POST only'});
    if(limited(ip,'hook',300,60e3))return send(res,429,{error:'Too many requests'});
    const ch=wm[1], secret=process.env['WEBHOOK_SECRET_'+ch.toUpperCase().replace(/-/g,'_')];
    if(!secret)return send(res,503,{error:'Channel not configured'});
    let raw;try{raw=await readBody(req,MAX_BODY)}catch(e){return send(res,e.status||400,{error:'Bad body'})}
    const sig=String(req.headers['x-signature']||req.headers['x-hub-signature-256']||'').replace(/^sha256=/,'');
    const exp=crypto.createHmac('sha256',secret).update(raw).digest('hex');
    if(!sig||!safeEq(sig,exp))return send(res,401,{error:'Bad signature'});
    const ts=+req.headers['x-timestamp']; if(ts&&Math.abs(Date.now()-(ts<1e12?ts*1000:ts))>5*60e3)return send(res,401,{error:'Stale request'});
    let body;try{body=JSON.parse(raw.toString('utf8'))}catch(e){return send(res,400,{error:'Invalid JSON'})}
    let n;try{n=normalize(ch,body)}catch(e){return send(res,422,{error:e.message})}
    const key=ch+':'+n.extId; if(D.seen[key])return send(res,200,{ok:true,duplicate:true});
    D.seen[key]=Date.now();
    const id='AG-'+rid(6), o=Object.assign({id:id,ts:Date.now(),updated:Date.now(),status:'new'},n);
    D.orders[id]=o;D.inbox.push(id);save();return send(res,200,{ok:true,id:id});
  }
  if(M!=='GET'&&M!=='HEAD'){res.writeHead(405);return res.end()}
  if(p==='/')return serveStatic(req,res,'/index.html');
  return serveStatic(req,res,p);
}
const server=http.createServer((req,res)=>{handle(req,res).catch(e=>{console.error('request error:',e.message);if(!res.headersSent)send(res,500,{error:'Server error'});else res.end()})});
server.requestTimeout=15000;server.headersTimeout=10000;
if(require.main===module){
  server.listen(PORT,HOST,()=>{
    console.log('Harbinger Gateway on http://'+HOST+':'+PORT+'   (POS: /app/  storefront: /order/)');
    if(firstRun){console.log('\nAPI key (shown once, enter it in the app under Online & Delivery → Setup):\n  '+D.apiKey+'\n');save()}
    else console.log('API key: stored in '+DATA_FILE+' (or HARBINGER_API_KEY)');
    if(HOST==='127.0.0.1')console.log('Listening on this computer only. Set HOST=0.0.0.0 and use HTTPS (reverse proxy) to serve customers.');
  });
}
module.exports={server,D:()=>D,save};
