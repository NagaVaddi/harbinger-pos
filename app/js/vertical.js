'use strict';
/* Industry behaviours: weighed items & scan weights (supermarket), size/colour variants (retail), prescriptions & controlled drugs (pharmacy),
   providers & insurance (clinic/hospital billing, salon), and roles per business type. */

/* ---------- roles by business type ---------- */
const ROLE_LABELS={owner:'Owner',admin:'Admin',manager:'Manager',cashier:'Cashier',waiter:'Waiter',kitchen:'Kitchen',accountant:'Accountant',stock_keeper:'Store keeper',pharmacist:'Pharmacist',billing:'Billing clerk',technician:'Technician'};
const ROLE_SETS={restaurant:['admin','manager','cashier','waiter','kitchen','accountant'],supermarket:['admin','manager','cashier','stock_keeper','accountant'],retail:['admin','manager','cashier','stock_keeper','accountant'],
  pharmacy:['admin','manager','pharmacist','cashier','stock_keeper','accountant'],clinic:['admin','manager','billing','pharmacist','stock_keeper','accountant'],salon:['admin','manager','cashier','accountant']};
const ROLE_TYPE_LABELS={tailor:{cashier:'Front desk',technician:'Tailor / cutter'},butcher:{cashier:'Counter'},garage:{manager:'Service advisor',cashier:'Front desk',technician:'Mechanic',stock_keeper:'Parts keeper'},tyre:{cashier:'Counter',technician:'Tyre fitter',stock_keeper:'Tyre store keeper'},pharmacy:{manager:'Pharmacist-in-charge',cashier:'Counter assistant'},clinic:{manager:'Billing manager',admin:'Administrator'},salon:{cashier:'Front desk'},retail:{cashier:'Sales assistant'}};
const roleLabel=r=>((ROLE_TYPE_LABELS[bizType()]||{})[r])||ROLE_LABELS[r]||r;
const rolesForType=()=>ROLE_SETS[bizType()]||ROLE_SETS.restaurant;
const ROLE_NOTES={owner:'Everything',admin:'Everything except ownership',manager:'Operations, stock, reports, approvals, refunds',cashier:'Register, customers, own orders',waiter:'Take orders and view orders',kitchen:'Kitchen display only',accountant:'Accounts, e-invoicing and reports',
  stock_keeper:'Stock room only (receive, count, adjust)',pharmacist:'Register, stock, prescriptions and controlled-drug approval',billing:'Billing desk: register, patients, bills',technician:'Job tickets only: see and update the status of assigned work'};

/* ---------- controlled-drug approval (pharmacist / manager PIN) ---------- */
function requirePharmacist(reason,cb){
  if(can('controlled')){cb(ME);return}
  modal({title:'Pharmacist approval',body:'<p class="muted">'+esc(reason)+'</p><label>Pharmacist / manager PIN<input name="pin" type="password" inputmode="numeric" maxlength="6" autocomplete="off" autofocus></label><p class="err" id="pinErr"></p>',
    enter:el=>$('.btn.primary',el).click(),
    actions:[{label:tr('Cancel')},{label:'Approve',cls:'primary',fn:el=>{
      const pin=formData(el).pin, u=DB.users.find(x=>x.active&&x.pin&&x.pin===pin&&PERMS[x.role]&&PERMS[x.role].indexOf('controlled')>=0);
      if(!u){$('#pinErr',el).textContent='Invalid PIN';return false} audit('approval',reason+' by '+u.username); cb(u);
    }}]});
}

/* ---------- adding items to the ticket ---------- */
function pushLine(line,it){
  const plain=!it.weighed&&!line.rx&&!line.provider&&!line.note&&!line.serial;
  const ex=plain&&R.cart.find(x=>x.itemId===it.id&&!x.note&&!x.rx&&!x.provider&&!x.serial&&!itemById(x.itemId).weighed);
  if(ex)ex.qty=rq(ex.qty+line.qty);else R.cart.push(line);
}
function addItemFlow(it,presetQty){
  if(!it)return;
  if(stockLeft(it)<=0&&!DB.settings.allowNegative){toast(it.name+(DB.settings.blockExpired&&stockOf(it.id)>0?' — only expired stock left':' is out of stock'),'err');return}
  const line={key:uid('l'),itemId:it.id,qty:presetQty||1,note:''}, steps=[];
  if(it.weighed&&!presetQty)steps.push(cb=>weightModal(it,null,w=>{line.qty=w;cb()}));
  if(it.rx&&bm('rx'))steps.push(cb=>rxModal(it,r=>{line.rx=r;cb()}));
  if(it.serial&&bm('serial'))steps.push(cb=>serialModal(it,line,cb));
  if(bm('provider')&&it.kind==='service'){ if(R.provider)line.provider=R.provider; else steps.push(cb=>providerModal(p=>{line.provider=p;R.provider=p;cb()})) }
  (function run(i){if(i>=steps.length){pushLine(line,it);render();const q=$('#rq');if(q)q.focus();return}steps[i](()=>run(i+1))})(0);
}
function weightModal(it,curLine,cb){
  const unit=it.unit||'kg', room=sellableOf(it.id)-R.cart.filter(l=>l.itemId===it.id&&l!==curLine).reduce((a,l)=>a+l.qty,0);
  modal({title:dn(it)+' — weight',body:field('Weight ('+unit+')','w',curLine?curLine.qty:'',{type:'number',step:'0.001',min:0,af:1})+'<p class="muted sm">'+money(it.price)+' per '+esc(unit)+(it.track?' · '+rq(room)+' '+esc(unit)+' available':'')+'. Enter the weight shown on the scale.</p>',
    enter:el=>$('.btn.primary',el).click(),
    actions:[{label:tr('Cancel')},{label:curLine?'Update':'Add',cls:'primary',fn:el=>{const w=rq(num(formData(el).w));
      if(w<=0){toast('Enter the weight','err');return false}
      if(it.track&&!DB.settings.allowNegative&&w>room){toast('Only '+rq(room)+' '+unit+' available','err');return false}
      cb(w)}}]});
}
function rxModal(it,cb){
  const cu=byId(DB.customers,R.customerId);
  const open=appr=>modal({title:'Prescription — '+it.name,wide:true,sticky:true,body:'<p class="muted sm">'+(it.controlled?'<b>Controlled medicine.</b> ':'')+'Record the prescription before dispensing. This is kept in the prescription register.</p><div class="form2">'+
      field('Prescription no.','no','',{af:1,max:30})+field('Prescriber (doctor)','doctor','',{max:60})+field('Patient name','patient',cu?cu.name:'',{max:60})+(it.controlled?field('Patient / collector ID no.','idNo','',{max:30}):'<span></span>')+'</div>',
    enter:el=>$('.btn.primary',el).click(),
    actions:[{label:tr('Cancel')},{label:'Confirm prescription',cls:'primary',fn:el=>{const f=formData(el);
      if(!f.no.trim()||!f.doctor.trim()||!f.patient.trim()){toast('Prescription no., doctor and patient are required','err');return false}
      if(it.controlled&&!f.idNo.trim()){toast('ID number is required for controlled medicines','err');return false}
      cb({no:f.no.trim(),doctor:f.doctor.trim(),patient:f.patient.trim(),idNo:(f.idNo||'').trim(),controlled:!!it.controlled,approvedBy:appr?appr.id:null})}}]});
  if(it.controlled)requirePharmacist('Controlled medicine: '+it.name,a=>setTimeout(()=>open(a),0));else open(null);
}
function providerModal(cb){
  const list=DB.providers.filter(p=>p.active);
  modal({title:'Who provided the service?',body:'<div class="picks">'+(list.map(p=>'<button type="button" class="pick" data-pv="'+p.id+'"><b>'+esc(p.name)+'</b><span class="muted">'+esc(p.dept||'')+'</span></button>').join('')||'<div class="empty">No providers yet. Add them under Team.</div>')+'</div>',
    onOpen:el=>el.addEventListener('click',e=>{const b=e.target.closest('[data-pv]');if(b){closeModal(true);cb(b.dataset.pv)}}),
    actions:[{label:'No provider',fn:()=>{cb('')}}]});
}
const providerName=id=>{const p=byId(DB.providers,id);return p?p.name:''};
A['r-provider']=d=>{const l=R.cart.find(x=>x.key===d.id);providerModal(p=>{if(l)l.provider=p;R.provider=p;render()})};
A['r-weigh']=d=>{const l=R.cart.find(x=>x.key===d.id);if(!l)return;weightModal(itemById(l.itemId),l,w=>{l.qty=w;render()})};
A['r-variants']=d=>{
  const list=DB.items.filter(i=>i.active&&i.group===d.id), first=list[0];
  modal({title:first?first.group:'Choose option',body:'<div class="picks">'+list.map(i=>{const left=i.track?sellableOf(i.id):Infinity;return '<button type="button" class="pick" data-vi="'+i.id+'"'+(left<=0?' disabled':'')+'><b>'+esc(i.variant||i.name)+'</b><span class="muted">'+fmt(i.price)+(i.track?' · '+(left>0?rq(left)+' left':'out of stock'):'')+'</span></button>'}).join('')+'</div>',
    onOpen:el=>el.addEventListener('click',e=>{const b=e.target.closest('[data-vi]');if(b&&!b.disabled){closeModal(true);addItemFlow(itemById(b.dataset.vi))}}),actions:[{label:tr('Close')}]});
};
/* quantity widget on a ticket line */
function lineQtyUi(l){
  const it=itemById(l.itemId);
  if(it&&it.weighed)return '<button type="button" class="lnk" data-act="r-weigh" data-id="'+l.key+'">⚖ '+rq(l.qty)+' '+esc(it.unit||'kg')+'</button>';
  return '<button type="button" class="q" data-act="r-dec" data-id="'+l.key+'" aria-label="Decrease">−</button><span class="qn">'+l.qty+'</span><button type="button" class="q" data-act="r-inc" data-id="'+l.key+'" aria-label="Increase">+</button>';
}
const lineMeta=l=>(l.rx?'<div class="muted sm">Rx '+esc(l.rx.no)+' · '+esc(l.rx.doctor)+(l.rx.controlled?' · <b>controlled</b>':'')+'</div>':'')+(l.provider?'<div class="muted sm">'+esc(providerName(l.provider))+' <button type="button" class="lnk" data-act="r-provider" data-id="'+l.key+'">change</button></div>':'');
/* tiles: group size/colour variants into one tile for retail */
function tilesHtml(items){
  const seen={}, out=[];
  items.forEach(i=>{
    if(bm('variants')&&i.group){ if(seen[i.group])return; seen[i.group]=1;
      const vs=items.filter(x=>x.group===i.group), left=vs.reduce((a,x)=>a+(x.track?Math.max(0,sellableOf(x.id)):1e9),0), prices=vs.map(x=>x.price), pr=Math.min.apply(null,prices)===Math.max.apply(null,prices)?fmt(prices[0]):fmt(Math.min.apply(null,prices))+'+';
      out.push('<button type="button" class="tile'+(left<=0?' out':'')+'" data-act="r-variants" data-id="'+esc(i.group)+'"'+(left<=0?' disabled':'')+'><span class="tn">'+esc(i.group)+'</span><span class="tp">'+pr+'</span><span class="ts">'+vs.length+' options</span></button>');
      return}
    const left=stockLeft(i), out_=left<=0&&!DB.settings.allowNegative;
    out.push('<button type="button" class="tile'+(out_?' out':'')+'" data-act="r-add" data-id="'+i.id+'"'+(out_?' disabled':'')+'><span class="tn">'+esc(dn(i))+'</span><span class="tp">'+fmt(i.price)+(i.weighed?' / '+esc(i.unit||'kg'):'')+'</span>'+
      (i.track&&left<=i.reorder&&left>0?'<span class="ts">'+rq(left)+' '+tr('left')+'</span>':'')+(out_?'<span class="ts bad">'+tr('Out of stock')+'</span>':'')+(i.rx&&bm('rx')?'<span class="ts">Rx</span>':'')+'</button>');
  });
  return out.join('')||'<div class="empty">No items match.</div>';
}
/* barcode helpers: "3*barcode" multiplies; EAN-13 starting with 2 carries a weight (2 + 5-digit PLU + 5-digit grams + check) */
/* EAN-13 check digit for the first 12 digits */
function ean13Check(d12){let s=0;for(let i=0;i<12;i++)s+=(+d12[i])*(i%2?3:1);return (10-(s%10))%10}
function parseScan(raw){
  const bc=typeof bcCfg==='function'?bcCfg():{allowSku:'1',qtyMult:'1'};
  let q=String(raw).trim(), mult=1; const m=bc.qtyMult!=='0'&&q.match(/^(\d{1,3})\s*[*xX]\s*(.+)$/); if(m){mult=+m[1];q=m[2].trim()}
  if(bm('weighed')&&typeof parseScaleCode==='function'){const sp=parseScaleCode(q);if(sp)return sp}
  const it=DB.items.find(i=>i.active&&(i.barcode===q||(bc.allowSku!=='0'&&i.sku.toLowerCase()===q.toLowerCase())||(i.plu&&i.plu===q)));
  return it?{item:it,qty:mult,weight:false}:null;
}

/* ---------- insurance ---------- */
function insurerLedger(name){
  name=String(name||'Insurer').trim().slice(0,60)||'Insurer';
  let l=DB.acc.ledgers.find(x=>x.insurer===name);
  if(!l){l={id:uid('lg'),key:null,name:'Insurance — '+name,groupId:'g_debt',opening:0,system:false,insurer:name};DB.acc.ledgers.push(l)}
  return l;
}
const insurers=()=>{const s={};DB.customers.forEach(c=>{if(c.insurer)s[c.insurer]=1});DB.acc.ledgers.forEach(l=>{if(l.insurer)s[l.insurer]=1});return Object.keys(s).sort()};
function insuranceDefaults(rem){
  const cu=byId(DB.customers,R.customerId), cp=cu&&cu.insurer?Math.min(100,Math.max(0,+cu.copay||0)):0;
  return {insurer:cu&&cu.insurer||'',amount:cu&&cu.insurer?r2(rem*(100-cp)/100):rem,copay:cp};
}
function vClaims(){
  const m=balMap(null), rows=DB.acc.ledgers.filter(l=>l.insurer).map(l=>({l:l,bal:m[l.id].close})).filter(r=>Math.abs(r.bal)>0.004);
  return '<section class="card mt"><h2>Insurance claims outstanding</h2>'+tbl([{h:'Insurer',r:r=>'<b>'+esc(r.l.insurer)+'</b>'},{h:'Receivable',cls:'r',r:r=>fmt(r.bal)},{h:'',cls:'r',r:r=>btn('Record settlement','ins-settle',r.l.id,'primary')}],rows,'No claims outstanding.')+
    '<p class="muted sm">Claims are created when a bill is paid with the Insurance tender. Record the insurer\'s payment here, including any rejected amount.</p></section>';
}
A['ins-settle']=d=>{
  const l=byId(DB.acc.ledgers,d.id), owed=r2(balMap(null)[l.id].close);
  modal({title:'Settlement — '+l.insurer,body:'<p class="muted sm">Receivable: <b>'+money(owed)+'</b></p><div class="form2">'+field('Claim amount settled','gross',owed,{type:'number',step:'0.01',min:0,af:1})+field('Rejected / written off','rej',0,{type:'number',step:'0.01',min:0})+'</div><div id="insPrev" class="sm muted"></div>',
    onOpen:el=>{const p=()=>{const f=formData(el);$('#insPrev',el).innerHTML='Bank receives <b>'+fmt(r2(num(f.gross)-num(f.rej)))+'</b>'};el.addEventListener('input',p);p()},
    actions:[{label:tr('Cancel')},{label:'Post settlement',cls:'primary',fn:el=>{const f=formData(el),g=r2(num(f.gross)),rej=r2(num(f.rej));
      if(g<=0||rej<0||rej>g){toast('Check the amounts','err');return false} if(g>owed+0.005){toast('More than the '+fmt(owed)+' receivable','err');return false}
      try{const E=[{ledgerId:LID('bank'),dr:r2(g-rej),cr:0}];if(rej>0)E.push({ledgerId:LID('insrej'),dr:rej,cr:0});E.push({ledgerId:l.id,dr:0,cr:g});
        const v=postVoucher({type:'Receipt',narration:l.insurer+' claim settlement (rejected '+fmt(rej)+')',entries:E,ref:{kind:'inssettle',id:l.id}});audit('insurance.settle',v.no);save();toast('Posted '+v.no);render()}catch(e){toast(e.message,'err');return false}}}]});
};

/* ---------- prescription register & logging ---------- */
function logRx(order){
  order.lines.forEach(l=>{ if(!l.rx)return;
    const lots=(l.allocs||[]).map(a=>{const x=byId(DB.lots,a.lotId);return x?x.lotNo+(x.expiry?' exp '+dayKey(x.expiry):''):''}).filter(Boolean).join(', ');
    DB.rxLog.push({id:uid('rx'),ts:order.ts,orderNo:order.no,item:l.name,qty:l.qty,batch:lots,rxNo:l.rx.no,doctor:l.rx.doctor,patient:l.rx.patient,idNo:l.rx.idNo||'',controlled:!!l.rx.controlled,by:order.userId,approvedBy:l.rx.approvedBy||''});
  });
}
function vRxRegister(){
  const f=new Date((UIS.from||dayKey(now()-29*864e5))+'T00:00:00').getTime(), t=new Date((UIS.to||dayKey(now()))+'T23:59:59').getTime();
  const rows=DB.rxLog.filter(r=>r.ts>=f&&r.ts<=t&&match(UIS.q.rx,[r.patient,r.doctor,r.rxNo,r.item])).slice().reverse();
  window._csv=[['date','order','medicine','qty','batch','rx no','doctor','patient','id no','controlled','dispensed by','approved by']].concat(rows.map(r=>[new Date(r.ts).toISOString(),r.orderNo,r.item,r.qty,r.batch,r.rxNo,r.doctor,r.patient,r.idNo,r.controlled?'yes':'',userName(r.by),userName(r.approvedBy)]));window._csvName='prescription-register';
  return '<div class="bar"><label class="inl">From <input type="date" data-ch="from" value="'+esc(UIS.from||dayKey(now()-29*864e5))+'"></label><label class="inl">To <input type="date" data-ch="to" value="'+esc(UIS.to||dayKey(now()))+'"></label>'+searchBox('rx','Patient, doctor, Rx no. or medicine')+'<span class="sp"></span>'+btn('Export CSV','rep-export')+'</div>'+
    tbl([{h:'Date',r:r=>fmtDT(r.ts)},{h:'Medicine',r:r=>'<b>'+esc(r.item)+'</b>'+(r.controlled?' '+badge('controlled','bad'):'')},{h:'Qty',cls:'r',r:r=>r.qty},{h:'Batch',r:r=>esc(r.batch)},{h:'Rx / doctor',r:r=>esc(r.rxNo)+'<br><span class="muted sm">'+esc(r.doctor)+'</span>'},{h:'Patient',r:r=>esc(r.patient)+(r.idNo?'<br><span class="muted sm">ID '+esc(r.idNo)+'</span>':'')},{h:'By',r:r=>esc(userName(r.by))+(r.approvedBy?'<br><span class="muted sm">approved '+esc(userName(r.approvedBy))+'</span>':'')}],rows.slice(0,400),'No prescriptions dispensed in this range.');
}

/* ---------- providers (doctors / stylists) ---------- */
function providerRevenue(from,to){
  const agg={}; DB.orders.filter(o=>o.status==='completed'&&o.ts>=from&&o.ts<=to).forEach(o=>o.lines.forEach(l=>{ if(!l.provider)return;
    const p=byId(DB.providers,l.provider),a=agg[l.provider]||(agg[l.provider]={id:l.provider,name:p?p.name:'(removed)',dept:p?p.dept:'',pct:p?p.commissionPct||0:0,n:0,rev:0});
    const ex=DB.settings.taxInclusive&&l.tax!==false?l.price/(1+DB.settings.vatPct/100):l.price; a.n+=l.qty;a.rev=r2(a.rev+l.qty*ex)}));
  return Object.keys(agg).map(k=>{const a=agg[k];a.comm=r2(a.rev*a.pct/100);return a}).sort((a,b)=>b.rev-a.rev);
}
function vProviderReport(){
  const f=new Date((UIS.from||dayKey(now()-29*864e5))+'T00:00:00').getTime(), t=new Date((UIS.to||dayKey(now()))+'T23:59:59').getTime(), rows=providerRevenue(f,t);
  window._csv=[['provider','department','services','revenue ex tax','commission %','commission']].concat(rows.map(r=>[r.name,r.dept,r.n,r.rev,r.pct,r.comm]));window._csvName='provider-earnings';
  return '<div class="bar"><label class="inl">From <input type="date" data-ch="from" value="'+esc(UIS.from||dayKey(now()-29*864e5))+'"></label><label class="inl">To <input type="date" data-ch="to" value="'+esc(UIS.to||dayKey(now()))+'"></label><span class="sp"></span>'+btn('Export CSV','rep-export')+'</div>'+
    tbl([{h:'Provider',r:r=>'<b>'+esc(r.name)+'</b><br><span class="muted sm">'+esc(r.dept)+'</span>'},{h:'Services',cls:'r',r:r=>r.n},{h:'Revenue',cls:'r',r:r=>fmt(r.rev)},{h:'Commission',cls:'r',r:r=>r.pct+'% · '+fmt(r.comm)}],rows,'No provider-attributed services in this range.');
}
function vProviders(){
  return '<section class="card mt"><h2>Providers <span class="muted sm">'+(bizType()==='clinic'?'doctors and departments':'stylists and therapists')+'</span></h2><div class="bar"><span class="sp"></span>'+btn('+ Add provider','provider-edit',null,'primary')+'</div>'+
    tbl([{h:'Name',r:r=>'<b>'+esc(r.name)+'</b>'},{h:'Department',r:r=>esc(r.dept||'—')},{h:'Commission',cls:'r',r:r=>r.commissionPct+'%'},{h:'Status',r:r=>badge(r.active?'Active':'Off',r.active?'ok':'')},{h:'',cls:'r',r:r=>btn('Edit','provider-edit',r.id)}],DB.providers,'No providers yet.')+'</section>';
}
A['provider-edit']=d=>{
  const p=d.id?byId(DB.providers,d.id):null;
  modal({title:p?'Edit provider':'New provider',body:'<div class="form2">'+field('Name','name',p&&p.name,{req:1,af:1})+field('Department / specialty','dept',p&&p.dept)+field('Commission %','pct',p?p.commissionPct:0,{type:'number',min:0,max:100,step:'0.1'})+'<span></span></div>'+check('Active','active',p?p.active:true),
    actions:[{label:tr('Cancel')},{label:tr('Save'),cls:'primary',fn:el=>{const f=formData(el);if(!f.name.trim()){toast('Name required','err');return false}
      const rec={name:f.name.trim(),dept:f.dept.trim(),commissionPct:Math.min(100,Math.max(0,num(f.pct))),active:!!f.active};if(p)Object.assign(p,rec);else DB.providers.push(Object.assign({id:uid('pv')},rec));save();render()}}]});
};

/* ---------- forms: fields that depend on the business type ---------- */
function itemExtraFields(it){
  let h='';
  if(bm('weighed'))h+=field('Unit (pcs / kg / l)','unit',it.unit||'pcs',{max:6})+field('PLU / scale code','plu',it.plu||'',{max:12});
  if(bm('variants'))h+=field('Group (e.g. T-Shirt)','group',it.group||'',{max:60})+field('Variant (size / colour)','variant',it.variant||'',{max:30});
  if(bm('provider'))h+=select('Type','kind',[['product','Product'],['service','Service']],it.kind||'product');
  if(bm('serial'))h+=field('Tyre size (e.g. 205/55R16)','size',it.size||'',{max:20})+field('Brand','brand',it.brand||'',{max:30})+field('Warranty (months)','warrantyMonths',it.warrantyMonths||0,{type:'number',min:0,max:120});
  return h;
}
function itemExtraChecks(it){
  return (bm('weighed')?check('Sold by weight / length / volume','weighed',it.weighed):'')+(bm('serial')?check('Record DOT / serial per piece','serial',it.serial):'')+(bm('rx')?check('Prescription only (Rx)','rx',it.rx)+check('Controlled medicine','controlled',it.controlled):'');
}
function itemExtra(d){
  const o={}; ['unit','plu','group','variant','kind'].forEach(k=>{if(d[k]!==undefined)o[k]=String(d[k]).trim()}); ['weighed','rx','controlled','serial'].forEach(k=>{if(k in d)o[k]=!!d[k]});
  if(d.warrantyMonths!==undefined)o.warrantyMonths=Math.max(0,Math.round(num(d.warrantyMonths)));
  ['size','brand'].forEach(k=>{if(d[k]!==undefined)o[k]=String(d[k]).trim()});
  if(o.kind==='service'){o.track=false}
  return o;
}
function guestExtraFields(c){
  c=c||{}; let h=bm('credit')?field('Credit limit (0 = cash only)','creditLimit',c.creditLimit||0,{type:'number',min:0,step:'1'}):''; if(!bm('insurance'))return h;
  return h+field('Patient file / MRN no.','mrn',c.mrn||'',{max:30})+field('Insurer','insurer',c.insurer||'',{max:60})+field('Policy / member no.','policy',c.policy||'',{max:40})+field('Patient co-pay %','copay',c.copay!=null?c.copay:0,{type:'number',min:0,max:100,step:'1'});
}
function guestExtra(f){
  const o={}; ['mrn','insurer','policy'].forEach(k=>{if(f[k]!==undefined)o[k]=String(f[k]).trim()}); if(f.creditLimit!==undefined)o.creditLimit=Math.max(0,num(f.creditLimit)); if(f.copay!==undefined)o.copay=Math.min(100,Math.max(0,num(f.copay))); return o;
}
function roleOptions(u){
  const list=rolesForType().slice(); if(u&&list.indexOf(u.role)<0)list.push(u.role);
  return list.map(r=>[r,roleLabel(r)]);
}
function reportTabs(){
  return REPORTS.concat([['inv-stock','Stock report'],['inv-activity','Item activity'],['inv-adjust','Adjustments'],['inv-expiry','Expiry / batch']],can('accounts')?[['acc-summary','Accounts summary'],['acc-stock','Stock (books)'],['acc-vat','Tax summary']]:[],bm('rx')?[['rx','Prescription register']]:[],bm('provider')?[['provider','Provider earnings']]:[],bm('serial')?[['warranty','Warranty register']]:[],bm('vehicle')?[['vehicle','Vehicle history']]:[]);
}
function vTeam(){return vTeamBase()+(bm('provider')?vProviders():'')}
function bizSettingsHtml(){
  const cur=bizType();
  return '<h2>Business type</h2><p class="muted sm">Current: <b>'+esc(biz().name)+'</b> — '+esc(biz().desc)+'. The type decides which screens, staff roles and dashboard you get.</p><div class="bizgrid">'+
    Object.keys(BIZ).map(k=>'<div class="bizcard'+(k===cur?' on':'')+'"><div class="bi">'+BIZ[k].icon+'</div><b>'+esc(BIZ[k].name)+'</b><span class="muted sm">'+esc(BIZ[k].desc)+'</span>'+(k===cur?'<span class="badge ok">Current</span>':'<button type="button" class="btn ghost sm" data-act="biz-switch" data-id="'+k+'">Load this type</button>')+'</div>').join('')+'</div>';
}
function applyBizDefaults(type){const p=BIZ[type]||BIZ.restaurant;DB.settings.businessType=type;DB.settings.minMarginPct=p.minMargin;DB.settings.blockExpired=p.blockExpired}
