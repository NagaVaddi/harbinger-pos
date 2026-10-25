'use strict';
/* Harbinger Online & Delivery Apps
   - Online ordering / QR table ordering: the public storefront (website/order) talks to the gateway server; this module pulls
     those orders into the POS ("inbox"), lets staff accept / reject / progress them, and pushes status back for guest tracking.
   - Delivery apps (Talabat, Deliveroo, Careem, Noon, HungerStation, Jahez…): orders arrive through the gateway webhooks in one
     normalised shape; items are mapped to POS items; payouts and commission are accounted for.
   Real marketplace connections need each platform's partner credentials and run on the gateway server (see server/README.md). */

const chName=k=>(CHANNELS.find(c=>c[0]===k)||[k,k==='storefront'?'Own website / QR':k])[1];
const ONLINE_DEFAULT={open:true,pickup:true,delivery:true,dineIn:true,deliveryFee:5,minOrder:20,prepMins:20};
const onl=()=>Object.assign({},ONLINE_DEFAULT,DB.settings.online||{});
const chCfg=k=>Object.assign({enabled:false,storeId:'',commission:20,commissionVat:true},DB.channels[k]||{});

/* ---------- gateway connection ---------- */
const gwBase=()=>{const u=(DB.settings.gateway&&DB.settings.gateway.url||'').trim().replace(/\/+$/,'');if(u)return u;return /^https?:$/.test(location.protocol)?location.origin:''};
const gwKey=()=>{try{return localStorage.getItem('hb_gwkey')||''}catch(e){return ''}};
async function gw(path,opt){
  const base=gwBase(); if(!base)throw new Error('Gateway not configured');
  const ctl=new AbortController(), t=setTimeout(()=>ctl.abort(),8000);
  try{
    const r=await fetch(base+path,{method:(opt&&opt.method)||'GET',signal:ctl.signal,headers:{'Content-Type':'application/json','Authorization':'Bearer '+gwKey()},body:opt&&opt.body?JSON.stringify(opt.body):undefined});
    if(r.status===401)throw new Error('Gateway rejected the API key');
    if(!r.ok)throw new Error('Gateway error '+r.status);
    return await r.json();
  }finally{clearTimeout(t)}
}
function menuSnapshot(){
  const s=DB.settings,o=onl();
  return {business:s.business,currency:s.currency,decimals:curDec(),taxLabel:s.taxLabel||'',vatPct:s.vatPct,taxInclusive:s.taxInclusive,
    online:{open:o.open,pickup:o.pickup,delivery:o.delivery,dineIn:o.dineIn,deliveryFee:+o.deliveryFee,minOrder:+o.minOrder,prepMins:+o.prepMins},
    categories:DB.categories.map(c=>({id:c.id,name:c.name,nameAr:c.nameAr||''})),
    items:DB.items.filter(i=>i.active&&i.sku!=='DELIVERY').map(i=>({id:i.id,name:i.name,nameAr:i.nameAr||'',price:i.price,categoryId:i.categoryId,available:!i.track||stockOf(i.id)>0||!!s.allowNegative}))};
}
let _syncing=false;
async function syncGateway(manual){
  if(_syncing||!ME||!can('online')||!gwBase()||!gwKey()){if(manual)toast('Set the gateway URL and API key in Online → Setup','err');return}
  _syncing=true;
  try{
    const snap=JSON.stringify(menuSnapshot());
    if(snap!==UIS.lastMenu){await gw('/api/menu',{method:'POST',body:JSON.parse(snap)});UIS.lastMenu=snap}
    const inbox=await gw('/api/inbox'); let n=0;
    (inbox.orders||[]).forEach(o=>{if(!DB.online.some(x=>x.id===o.id)){DB.online.push(Object.assign({orderId:null,history:[{ts:now(),status:'new'}]},o,{status:'new',dirty:false}));n++}});
    if((inbox.orders||[]).length)await gw('/api/inbox/ack',{method:'POST',body:{ids:inbox.orders.map(o=>o.id)}});
    for(const r of DB.online.filter(x=>x.dirty)){await gw('/api/orders/'+encodeURIComponent(r.id)+'/status',{method:'POST',body:{status:r.status,etaMins:onl().prepMins}});r.dirty=false}
    UIS.gw='ok';UIS.gwErr='';
    if(n){save();toast(n+' new online order'+(n>1?'s':''));if(!UIS.kmute)beep();render()}
    else if(manual){toast('Gateway in sync');render()}
    else if(location.hash.indexOf('#/online')===0&&!$('.modal-back'))render();
  }catch(e){UIS.gw='err';UIS.gwErr=e.name==='AbortError'?'timed out':e.message;if(manual)toast('Sync failed: '+UIS.gwErr,'err')}
  finally{_syncing=false}
}
const newOnlineCount=()=>DB.online.filter(o=>o.status==='new').length;

/* ---------- accepting an order into the POS ---------- */
function deliveryItem(){
  let it=DB.items.find(i=>i.sku==='DELIVERY');
  if(!it){it={id:uid('i'),name:'Delivery fee',nameAr:'',sku:'DELIVERY',barcode:'',categoryId:DB.categories[0].id,price:0,cost:0,tax:true,track:false,reorder:0,active:false};DB.items.push(it)}
  return it;
}
function resolveItem(rec,l){
  if(l.itemId&&itemById(l.itemId)&&itemById(l.itemId).active)return itemById(l.itemId);
  const ext=l.ext||{}, m=ext.id&&DB.itemMap[rec.channel+':'+ext.id]; if(m&&itemById(m))return itemById(m);
  const mn=DB.itemMap[rec.channel+':name:'+String(l.name||'').toLowerCase()]; if(mn&&itemById(mn))return itemById(mn);
  if(ext.sku){const s=DB.items.find(i=>i.active&&i.sku.toLowerCase()===String(ext.sku).toLowerCase());if(s)return s}
  const n=String(l.name||'').toLowerCase(); return DB.items.find(i=>i.active&&i.name.toLowerCase()===n)||null;
}
function findOrMakeGuest(c){
  if(!c||!c.phone)return null;
  const p=String(c.phone).replace(/\s+/g,''), g=DB.customers.find(x=>x.phone===p);
  if(g)return g.id;
  const ng={id:uid('g'),name:String(c.name||'Online guest').slice(0,60),phone:p,email:'',points:0,visits:0,spend:0,notes:'Created from online order',created:now()};
  DB.customers.push(ng);return ng.id;
}
function anyOpenSession(){return DB.sessions.find(s=>!s.closedAt)||null}
A['on-accept']=d=>{
  const rec=byId(DB.online,d.id); if(!rec||rec.status!=='new')return;
  const sess=anyOpenSession(); if(!sess){toast('Open a register first (Register → Open register) so the sale can be recorded','err');return}
  const unresolved=rec.lines.filter(l=>!resolveItem(rec,l));
  if(unresolved.length){mapItemsModal(rec,unresolved);return}
  const agg=rec.channel!=='storefront', cart=rec.lines.map(l=>{const it=resolveItem(rec,l);return {key:uid('l'),itemId:it.id,qty:l.qty,note:l.note||'',price:agg&&l.price!=null?+l.price:undefined}});
  if(rec.type==='delivery'&&+rec.deliveryFee>0)cart.push({key:uid('l'),itemId:deliveryItem().id,qty:1,note:'',price:+rec.deliveryFee});
  const S={cart:cart,customerId:findOrMakeGuest(rec.customer),code:null,manual:null,redeem:0,type:rec.type==='delivery'?'delivery':rec.type==='dine-in'?'dine-in':'takeaway',table:rec.table||''};
  const T=computeTotals(S), payMethod=rec.payment==='cod'?'cod':(rec.payment==='prepaid'||agg?'aggregator':'cod');
  if(agg&&rec.total&&Math.abs(T.total-rec.total)>0.5)toast('Note: POS total '+fmt(T.total)+' differs from the app total '+fmt(rec.total),'err');
  const order=finalizeOrder(S,sess,[{method:payMethod,amount:T.total,tendered:T.total}],0,{onlineId:rec.id,channel:rec.channel,onlineNo:rec.track||rec.id});
  if(!order)return;
  rec.orderId=order.id;rec.status='accepted';rec.dirty=true;rec.history.push({ts:now(),status:'accepted',by:ME.id});audit('online.accept',rec.id+' → '+order.no);save();toast('Accepted → sent to kitchen as #'+order.no);render();
};
function mapItemsModal(rec,lines){
  const opts=DB.items.filter(i=>i.active).sort((a,b)=>a.name.localeCompare(b.name)).map(i=>'<option value="'+i.id+'">'+esc(i.name)+' — '+fmt(i.price)+'</option>').join('');
  modal({title:'Match items to your menu',wide:true,body:'<p class="muted sm">These items from '+esc(chName(rec.channel))+' are not matched yet. Pick the POS item for each; the match is remembered for next time.</p>'+
    lines.map((l,i)=>'<div class="vrow2"><div><b>'+esc(l.name)+'</b><br><span class="muted sm">'+(l.ext&&l.ext.id?'ID '+esc(l.ext.id)+' · ':'')+'qty '+l.qty+(l.price!=null?' · '+fmt(l.price):'')+'</span></div><select name="m'+i+'"><option value="">— choose —</option>'+opts+'</select></div>').join(''),
    actions:[{label:'Cancel'},{label:'Save matches & accept',cls:'primary',fn:el=>{
      const f=formData(el); if(lines.some((l,i)=>!f['m'+i])){toast('Choose an item for every line','err');return false}
      lines.forEach((l,i)=>{const key=l.ext&&l.ext.id?rec.channel+':'+l.ext.id:rec.channel+':name:'+String(l.name||'').toLowerCase();DB.itemMap[key]=f['m'+i]});
      save();setTimeout(()=>A['on-accept']({id:rec.id}),0);}}]});
}
A['on-reject']=d=>{
  const rec=byId(DB.online,d.id);
  modal({title:'Reject order '+(rec.track||rec.id),body:select('Reason','reason',[['busy','Kitchen too busy'],['closed','Closed'],['stock','Item(s) unavailable'],['address','Outside delivery area'],['other','Other']],'busy'),
    actions:[{label:'Cancel'},{label:'Reject order',cls:'danger',fn:el=>{rec.status='rejected';rec.reason=formData(el).reason;rec.dirty=true;rec.history.push({ts:now(),status:'rejected',by:ME.id});audit('online.reject',rec.id+' '+rec.reason);save();render()}}]});
};
const NEXT={ready:{delivery:['out','Out for delivery'],pickup:['delivered','Handed over'],'dine-in':['delivered','Served']},out:{delivery:['delivered','Delivered']}};
A['on-set']=d=>{
  const p=d.id.split('|'), rec=byId(DB.online,p[0]), st=p[1]; if(!rec)return;
  rec.status=st;rec.dirty=true;rec.history.push({ts:now(),status:st,by:ME.id});
  const o=rec.orderId&&byId(DB.orders,rec.orderId);
  if(o&&o.kds){if(st==='ready'&&o.kds.status!=='ready'){o.kds.status='ready';o.kds.readyTs=now()}if(st==='out'||st==='delivered')o.kds.status='done'}
  save();render();
};
function onKdsChange(o,st){ // called from the kitchen display
  const rec=o.onlineId&&byId(DB.online,o.onlineId); if(!rec||rec.status==='rejected')return;
  const map={preparing:'preparing',ready:'ready'}, ns=map[st]; if(!ns||rec.status===ns)return;
  if(['new','accepted','preparing'].indexOf(rec.status)<0)return;
  rec.status=ns;rec.dirty=true;rec.history.push({ts:now(),status:ns,by:ME?ME.id:null});
}
A['on-settle']=d=>{
  const rec=byId(DB.online,d.id), o=byId(DB.orders,rec.orderId);
  if(!o||o.settlement)return;
  modal({title:'Receive payment — '+money(o.total),body:select('Received as','method',[['cash','Cash'],['card','Card'],['wallet','Wallet / QR']],'cash'),
    actions:[{label:'Cancel'},{label:'Record payment',cls:'primary',fn:el=>{
      const m=formData(el).method; postCodSettle(o,m);o.settlement={ts:now(),method:m,by:ME.id};
      if(m==='cash'){const s=anyOpenSession();if(s)DB.vouchers.push({id:uid('v'),sessionId:s.id,ts:now(),type:'in',amount:o.total,reason:'Online order cash #'+o.no,userId:ME.id})}
      audit('online.settle',o.no+' '+m);save();toast('Payment recorded');render();}}]});
};

/* ---------- Online Orders page ---------- */
function vOnline(tab){
  tab=tab||'inbox';
  const T=[['inbox','Orders'+(newOnlineCount()?' ('+newOnlineCount()+')':'')],['apps','Delivery apps'],['qr','QR & links'],['setup','Setup']];
  const body=tab==='apps'?vApps():tab==='qr'?vQrCodes():tab==='setup'?vOnlineSetup():vInbox();
  return head('Online & Delivery','Website, QR table ordering and delivery-app orders in one queue')+tabs('online',T.map(t=>[t[0],t[1]]),tab)+body;
}
function vInbox(){
  const status=UIS.gw==='ok'?badge('Gateway connected','ok'):UIS.gw==='err'?badge('Gateway: '+(UIS.gwErr||'error'),'bad'):badge('Gateway not connected','warn');
  const today=dayKey(now()), rows=DB.online.filter(o=>o.status!=='delivered'&&o.status!=='rejected'&&o.status!=='cancelled'||dayKey(o.ts)===today).sort((a,b)=>b.ts-a.ts).slice(0,200);
  const age=o=>{const m=Math.floor((now()-o.ts)/60000);return m<1?'now':m+' min'};
  const act=o=>{
    if(o.status==='new')return btn('Accept','on-accept',o.id,'primary')+' '+btn('Reject','on-reject',o.id,'danger');
    const nx=(NEXT[o.status]||{})[o.type]; const ord=o.orderId&&byId(DB.orders,o.orderId);
    let h='';
    if(o.status==='accepted'||o.status==='preparing')h+=btn('Mark ready','on-set',o.id+'|ready','ghost')+' ';
    if(nx)h+=btn(nx[1],'on-set',o.id+'|'+nx[0],'primary')+' ';
    if(ord&&!ord.settlement&&ord.payments.some(p=>p.method==='cod')&&(o.status==='out'||o.status==='delivered'||o.status==='ready'))h+=btn('Receive payment','on-settle',o.id)+' ';
    return h;
  };
  const payB=o=>o.payment==='prepaid'||o.channel!=='storefront'?badge('Prepaid (app)','ok'):(o.orderId&&byId(DB.orders,o.orderId)&&byId(DB.orders,o.orderId).settlement)?badge('Paid','ok'):badge(o.type==='delivery'?'Cash on delivery':'Pay at counter','warn');
  const stB=o=>badge(o.status,o.status==='new'?'bad':o.status==='rejected'||o.status==='cancelled'?'':'ok');
  return '<div class="bar">'+status+'<span class="sp"></span>'+btn('Sync now','gw-sync')+'</div>'+
    tbl([{h:'Order',r:r=>'<b>'+esc(r.track||r.id)+'</b><br><span class="muted sm">'+esc(chName(r.channel))+(r.source==='qr'?' · QR':'')+'</span>'},{h:'Age',r:r=>'<span class="'+(r.status==='new'&&now()-r.ts>3*60000?'neg':'')+'">'+age(r)+'</span>'},
      {h:'Type',r:r=>esc(r.type)+(r.table?' · '+esc(r.table):'')},{h:'Guest',r:r=>esc((r.customer||{}).name||'—')+'<br><span class="muted sm">'+esc((r.customer||{}).phone||'')+'</span>'},
      {h:'Items',r:r=>'<span class="sm">'+esc(r.lines.map(l=>l.qty+'× '+l.name).join(', ').slice(0,90))+'</span>'},{h:'Total',cls:'r',r:r=>fmt(r.total)},{h:'Payment',r:payB},{h:'Status',r:stB},
      {h:'',cls:'r',r:r=>act(r)+btn('View','on-view',r.id)}],rows,'No online orders yet. Share the QR codes or connect a delivery app.');
}
A['gw-sync']=()=>syncGateway(true);
A['on-view']=d=>{
  const o=byId(DB.online,d.id), c=o.customer||{};
  modal({title:'Order '+(o.track||o.id),wide:true,body:'<p>'+badge(chName(o.channel),'')+' '+badge(o.type,'')+(o.table?' '+badge('Table '+o.table,''):'')+' '+badge(o.status,'ok')+'</p>'+
    '<div class="form2"><div><b>Guest</b><br>'+esc(c.name||'—')+'<br>'+esc(c.phone||'')+'</div><div><b>Address / notes</b><br>'+esc(c.address||'—')+(o.note?'<br><i>'+esc(o.note)+'</i>':'')+'</div></div>'+
    tbl([{h:'Item',r:r=>esc(r.name)+(r.note?'<br><span class="muted sm">'+esc(r.note)+'</span>':'')},{h:'Qty',cls:'r',r:r=>r.qty},{h:'Price',cls:'r',r:r=>r.price!=null?fmt(r.price):'—'}],o.lines)+
    '<p class="sm">Delivery fee '+fmt(o.deliveryFee||0)+' · <b>Total '+fmt(o.total)+'</b></p><p class="muted sm">'+o.history.map(h=>esc(h.status)+' '+fmtDT(h.ts)).join(' → ')+'</p>',
    actions:[(c.phone?{label:'WhatsApp guest',keep:true,fn:()=>{const l=waLink(c.phone,'Hi '+(c.name||'')+', this is '+DB.settings.business+' about your order '+(o.track||'')+'.');if(l)window.open(l,'_blank','noopener,noreferrer');return false}}:{label:'Close'}),{label:'Close'}]});
};

/* ---------- Delivery apps ---------- */
function vApps(){
  const m=balMap(null), recv=r2(m[LID('aggr')].close), base=gwBase()||'https://YOUR-GATEWAY';
  const cc=DB.settings.country, rows=CHANNELS.map(c=>{const cf=chCfg(c[0]);return {k:c[0],name:c[1],cf:cf,pop:(c[2]||[]).indexOf(cc)>=0,orders:DB.online.filter(o=>o.channel===c[0]).length}}).sort((a,b)=>(b.pop-a.pop)||(b.cf.enabled-a.cf.enabled));
  return '<div class="kpis"><div class="kpi"><span class="kl">Owed by delivery apps</span><strong>'+money(recv)+'</strong><span class="muted sm">Aggregator Receivables ledger</span></div></div>'+
    '<div class="card"><p class="sm"><b>How it connects.</b> Each app sends orders to your gateway at <code>'+esc(base)+'/webhooks/&lt;app&gt;</code>. Talabat and Deliveroo give API access only to approved partners; Noon Food and Careem are usually connected through a middleware service such as Deliverect. Ask the app for partner credentials, then set them on the gateway server (see <code>server/README.md</code>). Until then you can try the full flow with <b>Send test order</b>.</p></div>'+
    tbl([{h:'App',r:r=>'<b>'+esc(r.name)+'</b>'+(r.pop?' '+badge('Common in '+((COUNTRIES[cc]||{}).name||'your country'),'ok'):'')},{h:'Status',r:r=>r.cf.enabled?badge('Enabled','ok'):badge('Not connected','')},{h:'Store ID',r:r=>esc(r.cf.storeId||'—')},{h:'Commission',cls:'r',r:r=>r.cf.commission+'%'},{h:'Orders',cls:'r',r:r=>r.orders},
      {h:'',cls:'r',r:r=>btn('Configure','ch-edit',r.k)+' '+btn('Test order','ch-test',r.k)+' '+btn('Menu CSV','ch-menu',r.k)+' '+btn('Payout','ch-payout',r.k,'primary')}],rows)+
    '<section class="card mt"><h2>Item matches <span class="muted sm">app items → your POS items</span></h2>'+
    tbl([{h:'Key',r:r=>esc(r[0])},{h:'POS item',r:r=>esc((itemById(r[1])||{}).name||'(deleted)')},{h:'',cls:'r',r:r=>btn('Remove','map-del',r[0],'danger')}],Object.keys(DB.itemMap).map(k=>[k,DB.itemMap[k]]),'No matches saved yet. They are created the first time you accept an app order with unmatched items.')+'</section>';
}
A['ch-edit']=d=>{
  const cf=chCfg(d.id);
  modal({title:chName(d.id)+' settings',body:check('Enabled (accept orders from this app)','enabled',cf.enabled)+'<div class="form2">'+field('Store / branch ID on the app','storeId',cf.storeId)+field('Commission %','commission',cf.commission,{type:'number',min:0,max:100,step:'0.1'})+'</div>'+check('Commission invoice carries VAT (claim as input VAT)','commissionVat',cf.commissionVat)+
    '<p class="muted sm">Webhook URL for this app: <code>'+esc((gwBase()||'https://YOUR-GATEWAY')+'/webhooks/'+d.id)+'</code>. The shared secret is set on the gateway server, never here.</p>',
    actions:[{label:'Cancel'},{label:'Save',cls:'primary',fn:el=>{const f=formData(el);DB.channels[d.id]={enabled:!!f.enabled,storeId:f.storeId.trim(),commission:Math.min(100,Math.max(0,num(f.commission))),commissionVat:!!f.commissionVat};save();render()}}]});
};
A['ch-test']=d=>{
  const first=DB.items.filter(i=>i.active&&i.sku!=='DELIVERY')[0]||{name:'Burger',price:20};
  const lines=[{ext:{id:'TP-1001',name:first.name+' (app)'},name:first.name+' (app)',qty:2,price:first.price,note:'No onion'},{ext:{id:'TP-2002',name:'Cola Can'},name:'Cola Can',qty:2,price:5,note:''}];
  const tot=r2(lines.reduce((a,l)=>a+l.qty*l.price,0)+6);
  DB.online.push({id:'TEST-'+Date.now().toString(36),track:'#'+Math.floor(1000+Math.random()*9000),ts:now(),channel:d.id,source:'aggregator',type:'delivery',table:'',customer:{name:'Test Customer',phone:'0500000000',address:'Marina Walk, Dubai'},
    lines:lines,note:'Test order — no real customer',deliveryFee:6,total:tot,payment:'prepaid',status:'new',orderId:null,dirty:false,history:[{ts:now(),status:'new'}]});
  save();toast('Test order added to the queue');location.hash='#/online/inbox';render();
};
A['ch-menu']=d=>{
  const rows=[['pos_id','sku','name','name_ar','category','price']].concat(DB.items.filter(i=>i.active&&i.sku!=='DELIVERY').map(i=>[i.id,i.sku,i.name,i.nameAr||'',catName(i.categoryId),i.price]));
  downloadCSV('menu-for-'+d.id,rows);
};
A['map-del']=d=>{delete DB.itemMap[d.id];save();render()};
A['ch-payout']=d=>{
  const cf=chCfg(d.id), m=balMap(null), owed=r2(m[LID('aggr')].close), gross0=r2(DB.orders.filter(o=>o.channel===d.id&&o.status==='completed').reduce((a,o)=>a+o.total,0));
  modal({title:chName(d.id)+' payout',body:'<p class="muted sm">Record the amount the app paid into your bank. Gross sales less commission (and VAT on commission) should equal the bank amount.</p><div class="form2">'+
    field('Gross sales being settled','gross',Math.min(owed,gross0)||owed,{type:'number',step:'0.01',min:0,af:1})+field('Commission %','pct',cf.commission,{type:'number',step:'0.1',min:0})+'</div><div id="payPrev" class="sm muted"></div>',
    onOpen:el=>{const prev=()=>{const f=formData(el),g=num(f.gross),c=r2(g*num(f.pct)/100),v=cf.commissionVat?r2(c*DB.settings.vatPct/100):0;$('#payPrev',el).innerHTML='Commission '+fmt(c)+(v?' + VAT '+fmt(v):'')+' → bank receives <b>'+fmt(r2(g-c-v))+'</b>'};el.addEventListener('input',prev);prev()},
    actions:[{label:'Cancel'},{label:'Post settlement',cls:'primary',fn:el=>{
      const f=formData(el),g=r2(num(f.gross)); if(g<=0){toast('Enter the gross amount','err');return false}
      if(g>owed+0.005){toast('That is more than the '+fmt(owed)+' currently owed by delivery apps','err');return false}
      const c=r2(g*num(f.pct)/100),v=cf.commissionVat?r2(c*DB.settings.vatPct/100):0;
      try{const vch=postAggrSettlement(chName(d.id),g,c,v);audit('aggregator.payout',vch.no);save();toast('Posted '+vch.no);render()}catch(e){toast(e.message,'err');return false}
    }}]});
};

/* ---------- QR codes & links ---------- */
function storeUrl(table){const b=gwBase();return (b||'https://YOUR-GATEWAY')+'/order/'+(table?'?t='+encodeURIComponent(table):'')}
function vQrCodes(){
  const n=Math.max(1,Math.min(60,UIS.qrTables||12));
  const cards=Array.from({length:n},(_,i)=>'T'+(i+1));
  return '<div class="bar"><label class="inl">Number of tables <input type="number" min="1" max="60" value="'+n+'" data-ch="qrTables" style="width:90px"></label><span class="sp"></span>'+btn('Print table QR sheet','qr-print',null,'primary')+'</div>'+
    (gwBase()?'':'<p class="warn-t">Gateway URL not set — the QR codes below point to a placeholder. Open this app through your gateway (http://localhost:8787/app/) or set the URL in Setup.</p>')+
    '<div class="card"><h2>Ordering links</h2><p class="sm">Pickup / delivery: <code>'+esc(storeUrl(''))+'</code></p><div style="width:140px">'+qrSvg(storeUrl(''))+'</div></div>'+
    '<section class="qrgrid mt">'+cards.map(t=>'<div class="qrcard"><div class="qrimg">'+qrSvg(storeUrl(t))+'</div><b>Table '+esc(t)+'</b></div>').join('')+'</section>';
}
C.qrTables=el=>{UIS.qrTables=Math.max(1,Math.min(60,+el.value||12));render()};
A['qr-print']=()=>{
  const n=Math.max(1,Math.min(60,UIS.qrTables||12));
  printHtml('<div class="qrsheet"><style>.qrsheet{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;font-family:sans-serif}.qrc{border:1px solid #000;padding:12px;text-align:center;break-inside:avoid}.qrc svg{width:100%;max-width:200px}.qrc h2{margin:6px 0}</style>'+
    Array.from({length:n},(_,i)=>'<div class="qrc"><div><b>'+esc(DB.settings.business)+'</b></div>'+qrSvg(storeUrl('T'+(i+1)))+'<h2>Table '+(i+1)+'</h2><div>Scan to view the menu and order</div></div>').join('')+'</div>');
};

/* ---------- Setup ---------- */
function vOnlineSetup(){
  const o=onl(), g=DB.settings.gateway||{};
  return '<form id="onlForm" class="card narrow" autocomplete="off"><h2>Storefront</h2><div class="form2">'+field('Delivery fee','deliveryFee',o.deliveryFee,{type:'number',min:0,step:'0.01'})+field('Minimum order (delivery)','minOrder',o.minOrder,{type:'number',min:0,step:'0.01'})+field('Preparation time (minutes)','prepMins',o.prepMins,{type:'number',min:1})+'<span></span></div>'+
    '<div class="chks">'+check('Accepting orders now','open',o.open)+check('Pickup','pickup',o.pickup)+check('Delivery','delivery',o.delivery)+check('Dine-in (QR at table)','dineIn',o.dineIn)+'</div>'+
    '<h2>Gateway connection</h2><div class="form2">'+field('Gateway URL (blank = same site)','url',g.url||'',{ph:'https://orders.yourdomain.com'})+field('API key (kept in this browser only)','key',gwKey(),{type:'password'})+'</div>'+
    '<p class="muted sm">Start the gateway with <code>node server/gateway.js</code>; it prints the API key on first start. Without a gateway, online ordering and delivery-app webhooks cannot reach this app.</p>'+
    '<div class="bar mt"><button class="btn primary" type="submit">Save</button>'+btn('Test connection','gw-test')+'<span class="sp"></span>'+(UIS.gw==='ok'?badge('Connected','ok'):UIS.gw==='err'?badge('Error: '+(UIS.gwErr||''),'bad'):badge('Not connected','warn'))+'</div></form>';
}
function bindOnline(){
  const f=$('#onlForm'); if(!f)return;
  f.addEventListener('submit',e=>{e.preventDefault();const d=formData(f);
    DB.settings.online={open:!!d.open,pickup:!!d.pickup,delivery:!!d.delivery,dineIn:!!d.dineIn,deliveryFee:Math.max(0,num(d.deliveryFee)),minOrder:Math.max(0,num(d.minOrder)),prepMins:Math.max(1,Math.round(num(d.prepMins))||20)};
    DB.settings.gateway={url:d.url.trim()};
    try{localStorage.setItem('hb_gwkey',d.key.trim())}catch(x){}
    UIS.lastMenu=null;audit('online.settings','');save();toast('Saved');syncGateway(false);render();});
}
A['gw-test']=async()=>{const f=$('#onlForm');if(f){const d=formData(f);DB.settings.gateway={url:d.url.trim()};try{localStorage.setItem('hb_gwkey',d.key.trim())}catch(x){}}
  try{const h=await gw('/api/ping');UIS.gw='ok';toast('Connected to '+(h.name||'gateway'));}catch(e){UIS.gw='err';UIS.gwErr=e.message;toast('Connection failed: '+e.message,'err')}render()};
