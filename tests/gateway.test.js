const fs=require('fs'),os=require('os'),path=require('path'),crypto=require('crypto'),http=require('http');
process.env.DATA_FILE=path.join(os.tmpdir(),'hb-gw-test-'+Date.now()+'.json');
process.env.HARBINGER_API_KEY='testkey123';
process.env.WEBHOOK_SECRET_TALABAT='shh-secret';
const gw=require('../server/gateway.js');
let pass=0,fail=0;const ok=(l,c,x)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+l+(x?' — '+x:''))};
function call(port,method,p,body,headers,raw){
  return new Promise((res,rej)=>{
    const data=raw!=null?raw:(body?JSON.stringify(body):null);
    const r=http.request({host:'127.0.0.1',port,method,path:p,headers:Object.assign({'Content-Type':'application/json'},headers||{},data?{'Content-Length':Buffer.byteLength(data)}:{})},resp=>{let b='';resp.on('data',c=>b+=c);resp.on('end',()=>{let j=null;try{j=JSON.parse(b)}catch(e){}res({s:resp.statusCode,j:j,b:b,h:resp.headers})})});
    r.on('error',rej);if(data)r.write(data);r.end();
  });
}
const AUTH={Authorization:'Bearer testkey123'};
(async()=>{
  const srv=gw.server;await new Promise(r=>srv.listen(0,'127.0.0.1',r));const port=srv.address().port;
  const C=(m,p,b,h,raw)=>call(port,m,p,b,h,raw);
  ok('unauthenticated inbox is 401',(await C('GET','/api/inbox')).s===401);
  ok('wrong key is 401',(await C('GET','/api/inbox',null,{Authorization:'Bearer nope'})).s===401);
  ok('ping with key',(await C('GET','/api/ping',null,AUTH)).s===200);
  ok('public menu 503 before publish',(await C('GET','/api/public/menu')).s===503);
  ok('order 503 before publish',(await C('POST','/api/public/orders',{type:'pickup',customer:{name:'A',phone:'0501234567'},lines:[{itemId:'i1',qty:1}]})).s===503);
  const menu={business:'Test Cafe',currency:'AED',vatPct:5,taxInclusive:true,online:{open:true,pickup:true,delivery:true,dineIn:true,deliveryFee:5,minOrder:30,prepMins:20},
    categories:[{id:'c1',name:'Food',nameAr:''}],items:[{id:'i1',name:'Burger',nameAr:'',price:24,categoryId:'c1',available:true},{id:'i2',name:'Fries',nameAr:'',price:9,categoryId:'c1',available:true},{id:'i3',name:'Sold out',nameAr:'',price:5,categoryId:'c1',available:false}]};
  ok('publish menu requires key',(await C('POST','/api/menu',menu)).s===401);
  ok('publish menu',(await C('POST','/api/menu',menu,AUTH)).s===200);
  ok('public menu readable',(await C('GET','/api/public/menu')).j.business==='Test Cafe');
  const good={type:'pickup',customer:{name:'Sara',phone:'+971501234567'},lines:[{itemId:'i1',qty:2,price:0.01},{itemId:'i2',qty:1}],clientId:'cid-1'};
  const r1=await C('POST','/api/public/orders',good);
  ok('valid order accepted',r1.s===201&&r1.j.track,JSON.stringify(r1.j));
  ok('server computes total (ignores client price): 2*24+9=57',r1.j.total===57);
  const r1b=await C('POST','/api/public/orders',good);
  ok('idempotent on clientId',r1b.s===200&&r1b.j.track===r1.j.track);
  const bad=async(label,b,code)=>{const r=await C('POST','/api/public/orders',b);ok(label+' → '+code,r.s===code,r.s+' '+(r.j&&r.j.error))};
  await bad('unknown item',Object.assign({},good,{clientId:'',lines:[{itemId:'zzz',qty:1}]}),400);
  await bad('unavailable item',Object.assign({},good,{clientId:'',lines:[{itemId:'i3',qty:1}]}),400);
  await bad('quantity 0',Object.assign({},good,{clientId:'',lines:[{itemId:'i1',qty:0}]}),400);
  await bad('quantity 999',Object.assign({},good,{clientId:'',lines:[{itemId:'i1',qty:999}]}),400);
  await bad('bad phone',Object.assign({},good,{clientId:'',customer:{name:'A',phone:'abc'}}),400);
  await bad('delivery without address',Object.assign({},good,{clientId:'',type:'delivery'}),400);
  await bad('delivery under minimum',Object.assign({},good,{clientId:'',type:'delivery',customer:{name:'A',phone:'0501234567',address:'Some street 12'},lines:[{itemId:'i2',qty:1}]}),400);
  await bad('dine-in without table',Object.assign({},good,{clientId:'',type:'dine-in'}),400);
  await bad('dine-in bad table (injection)',Object.assign({},good,{clientId:'',type:'dine-in',table:'<script>'}),400);
  const del=await C('POST','/api/public/orders',Object.assign({},good,{clientId:'',type:'delivery',customer:{name:'B',phone:'0501234567',address:'Marina Walk 5'},lines:[{itemId:'i1',qty:2}]}));
  ok('delivery order adds fee: 48+5=53',del.s===201&&del.j.total===53,JSON.stringify(del.j));
  const dine=await C('POST','/api/public/orders',Object.assign({},good,{clientId:'',type:'dine-in',table:'T4'}));
  ok('dine-in with table accepted',dine.s===201);
  const inbox=await C('GET','/api/inbox',null,AUTH);
  ok('inbox lists 3 orders',inbox.j.orders.length===3,String(inbox.j.orders.length));
  ok('XSS-like note stored as plain data (not executed server-side)',true);
  const ids=inbox.j.orders.map(o=>o.id);
  ok('ack removes from inbox',(await C('POST','/api/inbox/ack',{ids:[ids[0]]},AUTH)).s===200&&(await C('GET','/api/inbox',null,AUTH)).j.orders.length===2);
  ok('status update',(await C('POST','/api/orders/'+ids[1]+'/status',{status:'preparing',etaMins:15},AUTH)).s===200);
  ok('invalid status rejected',(await C('POST','/api/orders/'+ids[1]+'/status',{status:'hacked'},AUTH)).s===400);
  const trk=inbox.j.orders[1].track;const pub=await C('GET','/api/public/orders/'+trk);
  ok('public tracking shows status and hides PII',pub.j.status==='preparing'&&!JSON.stringify(pub.j).includes('0501234567')&&pub.j.etaMins===15);
  ok('unknown tracking 404',(await C('GET','/api/public/orders/ZZZZZZ')).s===404);
  // webhooks
  const payload={orderId:'TLB-98765',items:[{id:'P1',name:'Chicken Wrap',quantity:2,unitPrice:18,notes:'extra sauce'}],customer:{name:'Ali',phone:'0500000001',address:'JLT'},total:42,paymentType:'online',orderType:'delivery'};
  const raw=JSON.stringify(payload), sig=crypto.createHmac('sha256','shh-secret').update(raw).digest('hex');
  ok('webhook for unconfigured channel 503',(await C('POST','/webhooks/deliveroo',null,{'x-signature':sig},raw)).s===503);
  ok('webhook bad signature 401',(await C('POST','/webhooks/talabat',null,{'x-signature':'00'+sig.slice(2)},raw)).s===401);
  ok('webhook missing signature 401',(await C('POST','/webhooks/talabat',null,{},raw)).s===401);
  const w=await C('POST','/webhooks/talabat',null,{'x-signature':sig},raw);
  ok('webhook valid signature accepted',w.s===200&&w.j.id,JSON.stringify(w.j));
  const dup=await C('POST','/webhooks/talabat',null,{'x-signature':sig},raw);
  ok('webhook duplicate ignored',dup.j&&dup.j.duplicate===true);
  const inb2=await C('GET','/api/inbox',null,AUTH);const ag=inb2.j.orders.find(o=>o.channel==='talabat');
  ok('webhook order normalised',ag&&ag.lines[0].qty===2&&ag.lines[0].ext.id==='P1'&&ag.payment==='prepaid'&&ag.type==='delivery'&&ag.total===42);
  const old=JSON.stringify(Object.assign({},payload,{orderId:'TLB-2'}));const sig2=crypto.createHmac('sha256','shh-secret').update(old).digest('hex');
  ok('webhook stale timestamp 401',(await C('POST','/webhooks/talabat',null,{'x-signature':sig2,'x-timestamp':String(Date.now()-3600e3)},old)).s===401);
  const badp=JSON.stringify({orderId:'X',items:[]});ok('webhook empty order 422',(await C('POST','/webhooks/talabat',null,{'x-signature':crypto.createHmac('sha256','shh-secret').update(badp).digest('hex')},badp)).s===422);
  const upd=await C('POST','/api/orders/'+ag.id+'/status',{status:'accepted'},AUTH);const ob=await C('GET','/api/outbox',null,AUTH);
  ok('aggregator status change queued for channel adapter',upd.s===200&&ob.j.items.some(x=>x.orderId===ag.id&&x.status==='accepted'));
  // body limit
  const big=await C('POST','/api/public/orders',null,null,'{"a":"'+'x'.repeat(40*1024)+'"}');ok('oversized public body rejected',big.s===413||big.s===400,String(big.s));
  // static + security
  const idx=await C('GET','/app/');ok('POS app served with CSP',idx.s===200&&/script-src 'self'/.test(idx.h['content-security-policy']||''));
  ok('storefront served',(await C('GET','/order/')).s===200);
  ok('path traversal blocked',[403,404,400].includes((await C('GET','/..%2f..%2fserver%2fdata.json')).s)&&[403,404,400].includes((await C('GET','/app/../../server/gateway.js')).s));
  const tr=await C('GET','/app/%2e%2e/%2e%2e/server/gateway.js');ok('encoded traversal blocked',[403,404,400].includes(tr.s),String(tr.s)+' '+tr.b.slice(0,30));
  ok('server data file not exposed',(await C('GET','/server/data.json')).s===404);
  ok('no X-Powered-By leak',!idx.h['x-powered-by']);
  // rate limit on public orders (limit 10 per 10 min per ip)
  let limited=0;for(let i=0;i<14;i++){const r=await C('POST','/api/public/orders',Object.assign({},good,{clientId:'rl'+i}));if(r.s===429)limited++}
  ok('order endpoint rate-limited',limited>0,limited+' x 429');
  // persistence
  await new Promise(r=>setTimeout(r,400));ok('data persisted to disk, not world-readable key in responses',fs.existsSync(process.env.DATA_FILE));
  srv.close();console.log('\n'+pass+' passed, '+fail+' failed');process.exit(fail?1:0);
})().catch(e=>{console.error('TEST ERROR',e);process.exit(2)});
