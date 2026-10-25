'use strict';
/* Trades: customer credit accounts, job orders / job cards with advances, carcass breakdown, vehicles, tyre DOT & warranty, cutting-note presets. */

/* ================= Customer credit (khata) ================= */
function customerLedger(cid){
  let l=DB.acc.ledgers.find(x=>x.customerId===cid);
  if(!l){const c=byId(DB.customers,cid);l={id:uid('lg'),key:null,name:'Customer — '+(c?c.name:'?'),groupId:'g_debt',opening:0,system:false,customerId:cid};DB.acc.ledgers.push(l)}
  return l;
}
function creditBalances(){
  const m=balMap(null), out={}; DB.acc.ledgers.forEach(l=>{if(l.customerId)out[l.customerId]=m[l.id].close}); return out;
}
const creditBalance=cid=>creditBalances()[cid]||0;
const creditLimitOf=cu=>Math.max(0,+(cu&&cu.creditLimit)||0);
function creditRoom(cu){return r2(creditLimitOf(cu)-creditBalance(cu.id))}
/* FIFO ageing: payments clear the oldest charges first */
function agingFor(ledgerId){
  const l=byId(DB.acc.ledgers,ledgerId), rows=[];
  if((l.opening||0)>0)rows.push({ts:DB.acc.startedAt,dr:l.opening,cr:0,c:0});
  DB.acc.vouchers.forEach(v=>v.entries.forEach(e=>{if(e.ledgerId===ledgerId)rows.push({ts:v.date,dr:e.dr,cr:e.cr,c:v.createdAt})}));
  rows.sort((a,b)=>a.ts-b.ts||a.c-b.c);
  const open=[]; let carry=0; /* a payment made before the charge it covers (prepayment) offsets the next charges */
  rows.forEach(r=>{ if(r.dr>0){let amt=r.dr;if(carry>0){const t=Math.min(carry,amt);carry=r2(carry-t);amt=r2(amt-t)}if(amt>0.004)open.push({ts:r.ts,amt:amt})}
    if(r.cr>0){let c=r.cr;while(c>0.004&&open.length){const o=open[0],t=Math.min(o.amt,c);o.amt=r2(o.amt-t);c=r2(c-t);if(o.amt<=0.004)open.shift()}if(c>0.004)carry=r2(carry+c)}});
  const b={'0–30 days':0,'31–60 days':0,'61–90 days':0,'90+ days':0};
  open.forEach(o=>{const d=(now()-o.ts)/864e5;b[d<=30?'0–30 days':d<=60?'31–60 days':d<=90?'61–90 days':'90+ days']=r2(b[d<=30?'0–30 days':d<=60?'31–60 days':d<=90?'61–90 days':'90+ days']+o.amt)});
  return b;
}
function creditAging(){
  const tot={'0–30 days':0,'31–60 days':0,'61–90 days':0,'90+ days':0}, rows=[];
  DB.acc.ledgers.filter(l=>l.customerId).forEach(l=>{const bal=balMap(null)[l.id].close; if(bal<=0.004)return; const a=agingFor(l.id);Object.keys(a).forEach(k=>{tot[k]=r2(tot[k]+a[k])});rows.push({cid:l.customerId,name:(byId(DB.customers,l.customerId)||{}).name||l.name,bal:bal,old:a['90+ days']+a['61–90 days']})});
  return {tot:tot,rows:rows.sort((a,b)=>b.bal-a.bal)};
}
function postCustomerPayment(cu,method,amount,date,sess){
  const l=customerLedger(cu.id);
  const v=postVoucher({type:'Receipt',date:date||now(),narration:'Payment received from '+cu.name+' ('+method+')',entries:[{ledgerId:tenderLedger(method),dr:amount,cr:0},{ledgerId:l.id,dr:0,cr:amount}],ref:{kind:'custpay',id:cu.id}});
  if(method==='cash'){const s=sess||anyOpenSession();if(s)DB.vouchers.push({id:uid('v'),sessionId:s.id,ts:date||now(),type:'in',amount:amount,reason:'Customer payment '+cu.name,userId:ME.id})}
  audit('credit.payment',cu.name+' '+method+' '+amount);return v;
}
A['cust-pay']=d=>{
  const cu=byId(DB.customers,d.id), bal=creditBalance(cu.id);
  modal({title:'Receive payment — '+cu.name,body:'<p class="muted sm">Balance owed: <b>'+money(bal)+'</b></p><div class="form2">'+field('Amount','amount',bal>0?bal:'',{type:'number',step:'0.01',min:0,af:1})+select('Received as','method',[['cash','Cash'],['card','Card'],['wallet','Wallet / QR'],['bank','Bank transfer']],'cash')+'</div>',
    enter:el=>$('.btn.primary',el).click(),
    actions:[{label:tr('Cancel')},{label:'Record payment',cls:'primary',fn:el=>{const f=formData(el),a=r2(num(f.amount));
      if(a<=0){toast('Enter the amount received','err');return false} if(a>bal+0.005){toast('That is more than the '+fmt(bal)+' owed','err');return false}
      try{const v=f.method==='bank'?postVoucher({type:'Receipt',narration:'Bank payment from '+cu.name,entries:[{ledgerId:LID('bank'),dr:a,cr:0},{ledgerId:customerLedger(cu.id).id,dr:0,cr:a}],ref:{kind:'custpay',id:cu.id}}):postCustomerPayment(cu,f.method,a);
        save();toast('Recorded '+v.no);render()}catch(e){toast(e.message,'err');return false}}}]});
};
A['cust-stmt']=d=>{
  const cu=byId(DB.customers,d.id), l=customerLedger(cu.id), rows=stmtRows(l.id,0,now()+1e6);
  modal({title:'Statement — '+cu.name,wide:true,body:'<p class="sm">Credit limit <b>'+money(creditLimitOf(cu))+'</b> · balance <b>'+money(creditBalance(cu.id))+'</b></p>'+
    tbl([{h:'Date',r:r=>r.open?'':fmtDate(r.v.date)},{h:'Details',r:r=>r.open?'<i>Opening</i>':esc(r.v.narration||r.v.type)},{h:'Charged',cls:'r',r:r=>r.dr?fmt(r.dr):''},{h:'Paid',cls:'r',r:r=>r.cr?fmt(r.cr):''},{h:'Balance',cls:'r',r:r=>fmt(r.bal)}],rows,'No activity.'),
    actions:[{label:'Print',cls:'primary',keep:true,fn:()=>{printHtml('<h3>'+esc(DB.settings.business)+' — statement of account</h3><p>'+esc(cu.name)+' · '+fmtDate(now())+'</p>'+tbl([{h:'Date',r:r=>r.open?'':fmtDate(r.v.date)},{h:'Details',r:r=>r.open?'Opening':esc(r.v.narration||r.v.type)},{h:'Charged',cls:'r',r:r=>r.dr?fmt(r.dr):''},{h:'Paid',cls:'r',r:r=>r.cr?fmt(r.cr):''},{h:'Balance',cls:'r',r:r=>fmt(r.bal)}],rows,''));return false}},
      (cu.phone?{label:'WhatsApp reminder',keep:true,fn:()=>{const link=waLink(cu.phone,'Hello '+cu.name.split(' ')[0]+', your balance at '+DB.settings.business+' is '+money(creditBalance(cu.id))+'. Thank you.');if(link)window.open(link,'_blank','noopener,noreferrer');return false}}:{label:tr('Close')}),{label:tr('Close')}]});
};

/* ================= Job orders / job cards ================= */
const JOB_FLOW={tailor:[['received','Received'],['cutting','Cutting'],['stitching','Stitching'],['ready','Ready for pickup'],['delivered','Delivered']],
  garage:[['estimate','Estimate'],['approved','Approved'],['inprogress','In progress'],['ready','Ready'],['delivered','Delivered']]};
const jobKind=()=>biz().jobKind||'tailor';
const jobFlow=()=>JOB_FLOW[jobKind()];
const stLabel=s=>(JOB_FLOW.tailor.concat(JOB_FLOW.garage).concat([['cancelled','Cancelled']]).find(x=>x[0]===s)||[s,s])[1];
const jobOpen=j=>j.status!=='delivered'&&j.status!=='cancelled';
const jobAdvance=j=>r2((j.advances||[]).reduce((a,x)=>a+x.amount,0));
function jobCart(j){return j.lines.map(l=>({key:uid('l'),itemId:l.itemId,qty:l.qty,note:l.note||'',price:l.price!=null?l.price:undefined,provider:l.provider||j.assignee||''}))}
function jobTotals(j){return computeTotals({cart:jobCart(j),customerId:j.customerId,code:null,manual:null,redeem:0,type:'takeaway',table:''})}
const jobBalance=j=>r2(jobTotals(j).total-jobAdvance(j));
const isOverdue=j=>jobOpen(j)&&j.due&&j.due<dayStart(now());
const custName=id=>(byId(DB.customers,id)||{}).name||'—';
const GARMENTS={Kandura:['length','shoulder','chest','waist','sleeve','neck','cuff'],Suit:['chest','waist','hip','shoulder','sleeve','jacket length','inseam','outseam'],Trousers:['waist','hip','thigh','inseam','outseam','hem'],Shirt:['length','shoulder','chest','waist','sleeve','neck'],Abaya:['length','shoulder','bust','sleeve','hip'],Dress:['length','bust','waist','hip','shoulder','sleeve'],Other:['length','chest','waist','hip']};

function postAdvance(j,method,amount){
  const cu=byId(DB.customers,j.customerId);
  const v=postVoucher({type:'Receipt',narration:'Advance for '+j.no+(cu?' — '+cu.name:''),entries:[{ledgerId:tenderLedger(method),dr:amount,cr:0},{ledgerId:LID('advances'),dr:0,cr:amount}],ref:{kind:'advance',id:j.id}});
  if(method==='cash'){const s=anyOpenSession();if(s)DB.vouchers.push({id:uid('v'),sessionId:s.id,ts:now(),type:'in',amount:amount,reason:'Advance '+j.no,userId:ME.id})}
  j.advances.push({id:uid('a'),ts:now(),method:method,amount:amount,by:ME.id,voucher:v.no});
  return v;
}
function refundAdvances(j,amount,reason){
  const a=r2(amount); if(a<=0)return null;
  const v=postVoucher({type:'Payment',narration:'Advance refund '+j.no+' — '+reason,entries:[{ledgerId:LID('advances'),dr:a,cr:0},{ledgerId:LID('cash'),dr:0,cr:a}],ref:{kind:'advancerefund',id:j.id}});
  const s=anyOpenSession();if(s)DB.vouchers.push({id:uid('v'),sessionId:s.id,ts:now(),type:'out',amount:a,reason:'Advance refund '+j.no,userId:ME.id});
  j.advances.push({id:uid('a'),ts:now(),method:'cash',amount:-a,by:ME.id,voucher:v.no,refund:true});
  return v;
}
function jobHist(j,status){j.history.push({ts:now(),status:status,by:ME?ME.id:null})}
function newJobNo(){DB.seq.job++;return 'JOB-'+String(DB.seq.job).padStart(4,'0')}

/* ----- page ----- */
function vJobs(tab){
  tab=tab||'board'; const flow=jobFlow(), q=UIS.q.jobs;
  const all=DB.jobs.filter(j=>match(q,[j.no,j.title,custName(j.customerId),(j.vehicle||{}).plate,j.notes]));
  const card=j=>{const bal=jobBalance(j),ov=isOverdue(j),prov=providerName(j.assignee);
    return '<button type="button" class="jcard'+(ov?' late':'')+'" data-act="job-open" data-id="'+j.id+'"><b>'+esc(j.no)+'</b> <span class="muted sm">'+esc(custName(j.customerId))+'</span><div>'+esc(j.title||'')+'</div>'+
      (j.vehicle&&j.vehicle.plate?'<div class="sm">🚗 '+esc(j.vehicle.plate)+' '+esc((j.vehicle.make||'')+' '+(j.vehicle.model||''))+'</div>':'')+
      '<div class="sm muted">'+(j.due?'Due '+fmtDate(j.due)+(ov?' — <b class="neg">overdue</b>':''):'No due date')+(prov?' · '+esc(prov):'')+'</div><div class="sm">Balance <b>'+fmt(bal)+'</b></div></button>'};
  let body;
  if(tab==='all'){
    body=tbl([{h:'Job',r:r=>'<b>'+esc(r.no)+'</b><br><span class="muted sm">'+fmtDate(r.ts)+'</span>'},{h:'Customer',r:r=>esc(custName(r.customerId))},{h:'Work',r:r=>esc(r.title||'')+((r.vehicle&&r.vehicle.plate)?'<br><span class="muted sm">'+esc(r.vehicle.plate)+'</span>':'')},{h:'Due',r:r=>r.due?fmtDate(r.due):'—'},
      {h:'Status',r:r=>badge(stLabel(r.status),r.status==='delivered'?'ok':r.status==='cancelled'?'':isOverdue(r)?'bad':'warn')},{h:'Total',cls:'r',r:r=>fmt(jobTotals(r).total)},{h:'Balance',cls:'r',r:r=>fmt(jobOpen(r)?jobBalance(r):0)},{h:'',cls:'r',r:r=>btn('Open','job-open',r.id)}],all.slice().reverse(),'No jobs yet.');
  }else{
    body='<div class="jboard">'+flow.filter(f=>f[0]!=='delivered').map(f=>{const list=all.filter(j=>j.status===f[0]);return '<section class="jcol"><h3>'+esc(f[1])+' <span class="count">'+list.length+'</span></h3>'+(list.map(card).join('')||'<div class="empty">—</div>')+'</section>'}).join('')+'</div>';
  }
  return head(tr('Job orders'),jobKind()==='tailor'?'Orders with measurements, advance and balance':'Job cards with vehicle, parts, labour and approval',btn('+ New '+(jobKind()==='tailor'?'job order':'job card'),'job-new',null,'primary'))+
    tabs('jobs',[['board','Board'],['all','All jobs']],tab)+'<div class="bar">'+searchBox('jobs','Search job no., customer, vehicle plate or work')+'</div>'+body;
}
/* ----- create / edit ----- */
function jobLineRow(l){
  const items=DB.items.filter(i=>i.active).sort((a,b)=>a.name.localeCompare(b.name));
  return '<div class="vrow3"><select name="li" aria-label="Item">'+items.map(i=>'<option value="'+i.id+'"'+(l&&l.itemId===i.id?' selected':'')+'>'+esc(i.name)+' — '+fmt(i.price)+'</option>').join('')+'</select><input name="lq" type="number" step="any" min="0" value="'+esc(l?l.qty:1)+'" aria-label="Quantity"><input name="lp" type="number" step="0.01" min="0" value="'+esc(l&&l.price!=null?l.price:'')+'" placeholder="price" aria-label="Price override"><button type="button" class="lnk bad" data-rm aria-label="Remove line">✕</button></div>';
}
function measureGrid(garment,vals){
  const f=GARMENTS[garment]||GARMENTS.Other;
  return '<div class="measure">'+f.map(k=>'<label>'+esc(k)+'<input name="m_'+esc(k)+'" value="'+esc((vals||{})[k]||'')+'" maxlength="8" inputmode="decimal"></label>').join('')+'</div>';
}
A['job-new']=()=>jobModal(null);
A['job-edit']=d=>jobModal(byId(DB.jobs,d.id));
function jobModal(j){
  const edit=!!j, kind=jobKind(), cust=DB.customers.slice().sort((a,b)=>a.name.localeCompare(b.name)), provs=DB.providers.filter(p=>p.active);
  const cu0=edit?byId(DB.customers,j.customerId):null;
  const garment0=edit&&j.meas?j.meas.garment:'Kandura';
  const body=select('Customer','customerId',[['','— choose or add new —']].concat(cust.map(c=>[c.id,c.name+(c.phone?' · '+c.phone:'')])),edit?j.customerId:'')+
    '<div class="form2">'+field('Customer name (if new)','newName','',{max:60})+field('Customer phone (if new)','newPhone','',{type:'tel',max:20})+'</div>'+
    '<div class="form2">'+field(kind==='tailor'?'Work (e.g. 2 kandura, 1 suit)':'Complaint / work requested','title',edit?j.title:'',{max:120})+field('Due date','due',edit&&j.due?dayKey(j.due):'',{type:'date'})+
    select('Assigned to','assignee',[['','— not assigned —']].concat(provs.map(p=>[p.id,p.name])),edit?j.assignee:'')+field('Notes','notes',edit?j.notes:'',{max:200})+'</div>'+
    (kind==='tailor'?'<h3>Measurements <span class="muted sm">inches or cm — be consistent</span></h3>'+select('Garment','garment',Object.keys(GARMENTS).map(g=>[g,g]),garment0)+'<div id="mgrid">'+measureGrid(garment0,edit&&j.meas?j.meas.values:(cu0&&cu0.measurements&&cu0.measurements[garment0]))+'</div>':
     '<h3>Vehicle</h3>'+(cu0&&cu0.vehicles&&cu0.vehicles.length?select('Saved vehicles','pick',[['','— type below —']].concat(cu0.vehicles.map((v,i)=>[String(i),v.plate+' '+(v.make||'')+' '+(v.model||'')])),''):'<div id="vpick"></div>')+
       '<div class="form2">'+field('Plate number','plate',edit&&j.vehicle?j.vehicle.plate:'',{max:14})+field('Make','make',edit&&j.vehicle?j.vehicle.make:'',{max:20})+field('Model','model',edit&&j.vehicle?j.vehicle.model:'',{max:24})+field('Year','year',edit&&j.vehicle?j.vehicle.year:'',{max:4})+field('Odometer (km)','odo',edit&&j.vehicle?j.vehicle.odo:'',{type:'number',min:0})+'<span></span></div>')+
    '<h3>Items, parts &amp; services</h3><div id="jlines"></div><button type="button" class="btn ghost sm" id="jadd">+ Add line</button>'+
    (edit?'':'<h3>Advance <span class="muted sm">optional</span></h3><div class="form2">'+field('Advance received','adv','',{type:'number',step:'0.01',min:0})+select('Paid by','advm',[['cash','Cash'],['card','Card'],['wallet','Wallet / QR'],['bank','Bank transfer']],'cash')+'</div>');
  modal({title:edit?'Edit '+j.no:'New '+(kind==='tailor'?'job order':'job card'),wide:true,sticky:true,body:body,
    onOpen:el=>{
      const rows=$('#jlines',el), add=l=>rows.insertAdjacentHTML('beforeend',jobLineRow(l));
      (edit?j.lines:[null]).forEach(add);
      $('#jadd',el).addEventListener('click',()=>add(null));
      el.addEventListener('click',e=>{if(e.target.matches('[data-rm]')){const r=e.target.closest('.vrow3');if($$('.vrow3',rows).length>1)r.remove()}});
      const gsel=$('[name=garment]',el), csel=$('[name=customerId]',el);
      const refill=()=>{if(!gsel)return;const c=byId(DB.customers,csel.value),vals=c&&c.measurements&&c.measurements[gsel.value];$('#mgrid',el).innerHTML=measureGrid(gsel.value,vals)};
      if(gsel){gsel.addEventListener('change',refill);csel.addEventListener('change',refill)}
      const pk=$('[name=pick]',el); if(pk)pk.addEventListener('change',()=>{const c=byId(DB.customers,csel.value),v=c&&c.vehicles&&c.vehicles[+pk.value];if(v){['plate','make','model','year'].forEach(k=>{$('[name='+k+']',el).value=v[k]||''})}});
    },
    actions:[{label:tr('Cancel')},{label:edit?tr('Save'):'Create',cls:'primary',fn:el=>{
      const f=formData(el); let cid=f.customerId;
      if(!cid){const nm=(f.newName||'').trim();if(!nm){toast('Choose a customer or enter a new name','err');return false}
        const ng={id:uid('g'),name:nm.slice(0,60),phone:(f.newPhone||'').replace(/\s+/g,''),email:'',points:0,visits:0,spend:0,notes:'',created:now(),creditLimit:0};DB.customers.push(ng);cid=ng.id}
      const lines=$$('.vrow3',el).map(r=>({itemId:$('[name=li]',r).value,qty:rq(num($('[name=lq]',r).value)),price:$('[name=lp]',r).value===''?undefined:Math.max(0,num($('[name=lp]',r).value))})).filter(l=>l.itemId&&l.qty>0);
      if(!lines.length){toast('Add at least one line','err');return false}
      if(!(f.title||'').trim()){toast('Describe the work','err');return false}
      const job=edit?j:{id:uid('j'),no:newJobNo(),ts:now(),advances:[],history:[],status:jobFlow()[0][0],orderId:null};
      Object.assign(job,{customerId:cid,title:f.title.trim(),due:f.due?new Date(f.due+'T12:00:00').getTime():'',assignee:f.assignee||'',notes:(f.notes||'').trim(),lines:lines,kind:kind});
      if(kind==='tailor'){const vals={};(GARMENTS[f.garment]||[]).forEach(k=>{const v=(f['m_'+k]||'').trim();if(v)vals[k]=v});job.meas={garment:f.garment,values:vals};
        const c=byId(DB.customers,cid);if(c&&Object.keys(vals).length){c.measurements=c.measurements||{};c.measurements[f.garment]=vals}}
      else{const veh={plate:(f.plate||'').trim().toUpperCase(),make:(f.make||'').trim(),model:(f.model||'').trim(),year:(f.year||'').trim(),odo:f.odo||''};job.vehicle=veh;rememberVehicle(cid,veh)}
      if(!edit){jobHist(job,job.status);DB.jobs.push(job);
        const adv=r2(num(f.adv));if(adv>0){const total=jobTotals(job).total;if(adv>total+0.005){toast('Advance cannot be more than the job total ('+fmt(total)+')','err');DB.jobs.pop();DB.seq.job--;return false}
          try{if(f.advm==='bank'){const v=postVoucher({type:'Receipt',narration:'Advance for '+job.no,entries:[{ledgerId:LID('bank'),dr:adv,cr:0},{ledgerId:LID('advances'),dr:0,cr:adv}],ref:{kind:'advance',id:job.id}});job.advances.push({id:uid('a'),ts:now(),method:'bank',amount:adv,by:ME.id,voucher:v.no})}else postAdvance(job,f.advm,adv)}catch(e){toast(e.message,'err')}}}
      job.customerName=custName(cid);
      audit(edit?'job.edit':'job.create',job.no);save();toast((edit?'Saved ':'Created ')+job.no);render();if(!edit)setTimeout(()=>A['job-open']({id:job.id}),0);
    }}]});
}
function rememberVehicle(cid,veh){
  const c=byId(DB.customers,cid); if(!c||!veh.plate)return; c.vehicles=c.vehicles||[];
  const ex=c.vehicles.find(v=>v.plate===veh.plate); if(ex)Object.assign(ex,{make:veh.make||ex.make,model:veh.model||ex.model,year:veh.year||ex.year});else c.vehicles.push({plate:veh.plate,make:veh.make,model:veh.model,year:veh.year});
}
/* ----- detail ----- */
A['job-open']=d=>{
  const j=byId(DB.jobs,d.id); if(!j)return; const T=jobTotals(j), adv=jobAdvance(j), bal=r2(T.total-adv), flow=jobFlow(), cu=byId(DB.customers,j.customerId);
  const steps='<div class="steps2">'+flow.map(f=>'<button type="button" class="stp'+(j.status===f[0]?' on':'')+'" data-act="job-status" data-id="'+j.id+'|'+f[0]+'"'+(f[0]==='delivered'||!jobOpen(j)?' disabled':'')+'>'+esc(f[1])+'</button>').join('')+'</div>';
  const meas=j.meas?'<p class="sm"><b>'+esc(j.meas.garment)+'</b> measurements: '+(Object.keys(j.meas.values).map(k=>esc(k)+' '+esc(j.meas.values[k])).join(' · ')||'—')+'</p>':'';
  const veh=j.vehicle&&j.vehicle.plate?'<p class="sm">🚗 <b>'+esc(j.vehicle.plate)+'</b> '+esc((j.vehicle.make||'')+' '+(j.vehicle.model||'')+' '+(j.vehicle.year||''))+(j.vehicle.odo?' · '+esc(j.vehicle.odo)+' km':'')+'</p>':'';
  const next=j.nextService&&(j.nextService.date||j.nextService.km)?'<p class="sm">Next service: <b>'+(j.nextService.date?fmtDate(j.nextService.date):'')+'</b> '+(j.nextService.km?'/ '+esc(j.nextService.km)+' km':'')+'</p>':'';
  const acts=[];
  if(jobOpen(j)){
    acts.push({label:'Add advance',keep:true,fn:()=>{closeModal();A['job-adv']({id:j.id});return false}});
    acts.push({label:'Edit',keep:true,fn:()=>{closeModal();jobModal(j);return false}});
    if(jobKind()==='garage')acts.push({label:'Next service…',keep:true,fn:()=>{closeModal();A['job-next']({id:j.id});return false}});
    acts.push({label:'Cancel job',cls:'danger',keep:true,fn:()=>{closeModal();A['job-cancel']({id:j.id});return false}});
    acts.push({label:'Bill & deliver',cls:'primary',keep:true,fn:()=>{closeModal();billJob(j.id);return false}});
  }
  acts.push({label:'Print ticket',keep:true,fn:()=>{printHtml(jobTicketHtml(j));return false}});
  if(cu&&cu.phone)acts.push({label:'WhatsApp',keep:true,fn:()=>{const msg=j.status==='ready'?'Hello '+cu.name.split(' ')[0]+', your '+(jobKind()==='tailor'?'order':'vehicle')+' ('+j.no+') is ready for pickup at '+DB.settings.business+'.':'Hello '+cu.name.split(' ')[0]+', update on '+j.no+': '+stLabel(j.status)+'.';const l=waLink(cu.phone,msg);if(l)window.open(l,'_blank','noopener,noreferrer');return false}});
  acts.push({label:tr('Close')});
  modal({title:j.no+' — '+custName(j.customerId),wide:true,body:'<p>'+badge(stLabel(j.status),j.status==='delivered'?'ok':isOverdue(j)?'bad':'warn')+' <span class="muted sm">'+esc(j.title||'')+(j.due?' · due '+fmtDate(j.due):'')+(j.assignee?' · '+esc(providerName(j.assignee)):'')+'</span></p>'+steps+meas+veh+next+
    tbl([{h:'Item',r:r=>esc((itemById(r.itemId)||{}).name||'?')+(r.note?'<br><span class="muted sm">'+esc(r.note)+'</span>':'')},{h:'Qty',cls:'r',r:r=>r.qty},{h:'Price',cls:'r',r:r=>fmt(r.price!=null?r.price:(itemById(r.itemId)||{}).price||0)},{h:'Total',cls:'r',r:r=>fmt(r2(r.qty*(r.price!=null?r.price:(itemById(r.itemId)||{}).price||0)))}],j.lines)+
    '<div class="sums"><div class="tr"><span>Total (incl. tax)</span><span>'+fmt(T.total)+'</span></div><div class="tr"><span>Advances received</span><span>−'+fmt(adv)+'</span></div><div class="tr tot"><span>Balance due</span><span>'+esc(DB.settings.currency)+' '+fmt(bal)+'</span></div></div>'+
    ((j.advances||[]).length?'<p class="muted sm">'+j.advances.map(a=>fmtDT(a.ts)+' '+(a.refund?'refund ':'')+esc(a.method)+' '+fmt(Math.abs(a.amount))).join(' · ')+'</p>':'')+
    (j.notes?'<p class="muted sm">Notes: '+esc(j.notes)+'</p>':''),actions:acts});
};
A['job-status']=d=>{
  const p=d.id.split('|'), j=byId(DB.jobs,p[0]); if(!j||!jobOpen(j))return;
  if(p[1]==='delivered'){billJob(j.id);return}
  if(j.status===p[1])return;
  if(jobKind()==='garage'&&p[1]==='approved')j.estimate={approved:true,at:now()};
  j.status=p[1];jobHist(j,p[1]);audit('job.status',j.no+' → '+p[1]);save();render();A['job-open']({id:j.id});
};
A['job-adv']=d=>{
  const j=byId(DB.jobs,d.id), bal=jobBalance(j);
  modal({title:'Advance — '+j.no,body:'<p class="muted sm">Balance due: <b>'+money(bal)+'</b></p><div class="form2">'+field('Amount','amt','',{type:'number',step:'0.01',min:0,af:1})+select('Paid by','m',[['cash','Cash'],['card','Card'],['wallet','Wallet / QR'],['bank','Bank transfer']],'cash')+'</div>',enter:el=>$('.btn.primary',el).click(),
    actions:[{label:tr('Cancel')},{label:'Record advance',cls:'primary',fn:el=>{const f=formData(el),a=r2(num(f.amt));if(a<=0){toast('Enter an amount','err');return false}if(a>bal+0.005){toast('More than the balance due','err');return false}
      try{if(f.m==='bank'){const v=postVoucher({type:'Receipt',narration:'Advance for '+j.no,entries:[{ledgerId:LID('bank'),dr:a,cr:0},{ledgerId:LID('advances'),dr:0,cr:a}],ref:{kind:'advance',id:j.id}});j.advances.push({id:uid('a'),ts:now(),method:'bank',amount:a,by:ME.id,voucher:v.no})}else postAdvance(j,f.m,a);
        audit('job.advance',j.no+' '+a);save();toast('Advance recorded');render();setTimeout(()=>A['job-open']({id:j.id}),0)}catch(e){toast(e.message,'err');return false}}}]});
};
A['job-next']=d=>{
  const j=byId(DB.jobs,d.id), ns=j.nextService||{};
  modal({title:'Next service — '+j.no,body:'<div class="form2">'+field('Due date','date',ns.date?dayKey(ns.date):'',{type:'date',af:1})+field('Or at odometer (km)','km',ns.km||'',{type:'number',min:0})+'</div><p class="muted sm">You will see this on the dashboard when it is close, with a WhatsApp reminder.</p>',
    actions:[{label:tr('Cancel')},{label:tr('Save'),cls:'primary',fn:el=>{const f=formData(el);j.nextService={date:f.date?new Date(f.date+'T12:00:00').getTime():'',km:f.km||''};save();render();setTimeout(()=>A['job-open']({id:j.id}),0)}}]});
};
A['job-cancel']=d=>{
  const j=byId(DB.jobs,d.id), adv=jobAdvance(j);
  requireManager('Cancel '+j.no+(adv>0?' and refund the advance of '+money(adv):''),()=>{
    modal({title:'Cancel '+j.no,body:'<p>'+(adv>0?'The advance of <b>'+money(adv)+'</b> will be refunded in cash.':'No advance was taken.')+'</p>'+field('Reason','reason','',{af:1}),
      actions:[{label:'Keep job'},{label:'Cancel job',cls:'danger',fn:el=>{const r=(formData(el).reason||'').trim();if(!r){toast('A reason is required','err');return false}
        try{if(adv>0)refundAdvances(j,adv,r);j.status='cancelled';j.cancelReason=r;jobHist(j,'cancelled');audit('job.cancel',j.no+' '+r);save();toast('Job cancelled');render()}catch(e){toast(e.message,'err');return false}}}]});
  });
};
function jobTicketHtml(j){
  const T=jobTotals(j), adv=jobAdvance(j), cu=byId(DB.customers,j.customerId);
  return '<div class="rcpt"><div class="c"><strong>'+esc(DB.settings.business)+'</strong><br>'+esc(DB.settings.address)+'</div><div class="c"><strong>'+esc(tr('Job orders').toUpperCase())+' '+esc(j.no)+'</strong></div>'+
    '<div class="meta">'+fmtDT(j.ts)+'<br>'+esc(custName(j.customerId))+(cu&&cu.phone?' · '+esc(cu.phone):'')+(j.due?'<br>Due: '+fmtDate(j.due):'')+(j.vehicle&&j.vehicle.plate?'<br>Vehicle: '+esc(j.vehicle.plate)+' '+esc((j.vehicle.make||'')+' '+(j.vehicle.model||'')):'')+'</div>'+
    (j.meas?'<div class="small">'+esc(j.meas.garment)+': '+Object.keys(j.meas.values).map(k=>esc(k)+' '+esc(j.meas.values[k])).join(', ')+'</div>':'')+'<hr><table>'+
    j.lines.map(l=>{const it=itemById(l.itemId)||{name:'?',price:0};return '<tr><td>'+esc(l.qty)+'× '+esc(it.name)+'</td><td class="r">'+fmt(r2(l.qty*(l.price!=null?l.price:it.price)))+'</td></tr>'}).join('')+'</table><hr><table><tr><td>Total</td><td class="r">'+fmt(T.total)+'</td></tr><tr><td>Advance paid</td><td class="r">'+fmt(adv)+'</td></tr><tr class="tot"><td>BALANCE</td><td class="r">'+fmt(r2(T.total-adv))+'</td></tr></table><div class="c small">Please bring this slip when collecting.</div></div>';
}
/* ----- bill & deliver through the register ----- */
function billJob(id){
  const j=byId(DB.jobs,id); if(!j||!jobOpen(j))return;
  regReset(); R.cart=jobCart(j); R.customerId=j.customerId; R.jobId=j.id; R.vehicle=j.vehicle||null; R.provider=j.assignee||''; R.type='takeaway';
  toast('Job loaded into the POS — press Pay to collect the balance'); location.hash='#/register'; render();
}
function finishJob(order,jobId){
  const j=jobId&&byId(DB.jobs,jobId); if(!j)return;
  j.status='delivered'; j.orderId=order.id; j.deliveredTs=now(); jobHist(j,'delivered'); audit('job.delivered',j.no+' → '+order.no);
  /* advances larger than the final bill (job was reduced) go back to the customer */
  const used=r2(order.payments.filter(p=>p.method==='advance').reduce((a,p)=>a+p.amount,0)), left=r2(jobAdvance(j)-used);
  if(left>0.004)try{refundAdvances(j,left,'balance after final bill '+order.no)}catch(e){audit('job.refund.error',j.no+': '+e.message)}
}
const dueSoon=days=>DB.jobs.filter(j=>jobOpen(j)&&j.due&&j.due<=now()+days*864e5);
const serviceDueList=()=>DB.jobs.filter(j=>j.nextService&&j.nextService.date&&j.nextService.date<=now()+14*864e5&&!DB.jobs.some(x=>x!==j&&x.vehicle&&j.vehicle&&x.vehicle.plate===j.vehicle.plate&&x.ts>j.ts&&x.status!=='cancelled'));

/* ================= Vehicles, tyre DOT codes and warranty ================= */
const normPlate=p=>String(p||'').toUpperCase().replace(/\s+/g,' ').trim();
A['r-vehicle']=()=>{
  const cu=byId(DB.customers,R.customerId), saved=(cu&&cu.vehicles)||[], cur=R.vehicle||{};
  modal({title:'Vehicle',body:(saved.length?select('Saved vehicles','pick',[['','— type below —']].concat(saved.map((v,i)=>[String(i),v.plate+' '+(v.make||'')+' '+(v.model||'')])),''):'')+'<div class="form2">'+field('Plate number','plate',cur.plate||'',{max:14,af:1})+field('Make','make',cur.make||'',{max:20})+field('Model','model',cur.model||'',{max:24})+field('Year','year',cur.year||'',{max:4})+'</div>',
    enter:el=>$('.btn.primary',el).click(),
    onOpen:el=>{const pk=$('[name=pick]',el);if(pk)pk.addEventListener('change',()=>{const v=saved[+pk.value];if(v)['plate','make','model','year'].forEach(k=>{$('[name='+k+']',el).value=v[k]||''})})},
    actions:[{label:'No vehicle',fn:()=>{R.vehicle=null;render()}},{label:tr('Cancel')},{label:tr('Save'),cls:'primary',fn:el=>{const f=formData(el);if(!f.plate.trim()){toast('Enter the plate number','err');return false}R.vehicle={plate:normPlate(f.plate),make:f.make.trim(),model:f.model.trim(),year:f.year.trim()};render()}}]});
};
function dotAge(code){ // WWYY → age in years (null if invalid)
  if(!/^\d{4}$/.test(code))return null; const w=+code.slice(0,2), y=2000+(+code.slice(2)); if(w<1||w>53)return null;
  return (now()-new Date(y,0,1+(w-1)*7).getTime())/(365.25*864e5);
}
function serialModal(it,line,cb){
  modal({title:dn(it)+' — quantity and DOT codes',sticky:true,body:'<div class="form2">'+field('Quantity','qty',line.qty||4,{type:'number',min:1,max:50,af:1})+'<span></span></div>'+field('DOT codes, one per tyre, separated by commas (e.g. 2524, 2524)','dot','',{max:80})+'<p class="muted sm">DOT = week and year of manufacture (2524 = week 25 of 2024). It is stored for the warranty register. Tyres older than 6 years are flagged.</p><p id="dotWarn" class="warn-t"></p>',
    enter:el=>$('.btn.primary',el).click(),
    onOpen:el=>{const chk=()=>{const codes=formData(el).dot.split(/[,\s]+/).filter(Boolean),old=codes.filter(c=>{const a=dotAge(c);return a!=null&&a>6}),bad=codes.filter(c=>dotAge(c)==null);$('#dotWarn',el).textContent=(bad.length?'Check format: '+bad.join(', ')+'. ':'')+(old.length?old.length+' tyre(s) are older than 6 years.':'')};el.addEventListener('input',chk)},
    actions:[{label:tr('Cancel')},{label:'Add',cls:'primary',fn:el=>{const f=formData(el),q=Math.max(1,Math.floor(num(f.qty))),codes=f.dot.split(/[,\s]+/).filter(Boolean);
      if(codes.some(c=>dotAge(c)==null)){toast('DOT codes must be 4 digits: week then year, e.g. 2524','err');return false}
      if(codes.length&&codes.length!==q){toast('Enter '+q+' DOT code(s) or leave it empty','err');return false}
      if(it.track&&!DB.settings.allowNegative&&q>stockLeft(it)){toast('Only '+stockLeft(it)+' in stock','err');return false}
      line.qty=q;line.serial=codes;cb()}}]});
}
function recordWarranty(order){
  order.lines.forEach(l=>{const it=itemById(l.itemId);if(!it||!it.serial)return;const n=Math.max(1,Math.round(l.qty)),codes=(l.serial&&l.serial.length===n)?l.serial:Array.from({length:n},()=>'');
    codes.forEach(code=>DB.warranty.push({id:uid('w'),ts:order.ts,orderNo:order.no,orderId:order.id,customerId:order.customerId||null,plate:(order.vehicle||{}).plate||'',item:l.name,brand:it.brand||'',size:it.size||'',dot:code,months:it.warrantyMonths||0,expires:(it.warrantyMonths||0)>0?order.ts+it.warrantyMonths*30.44*864e5:null}))});
}
A['war-export']=()=>downloadCSV('warranty-register',[['date','order','plate','customer','tyre','brand','size','DOT','warranty months','expires']].concat(DB.warranty.map(w=>[dayKey(w.ts),w.orderNo,w.plate,custName(w.customerId),w.item,w.brand,w.size,w.dot,w.months,w.expires?dayKey(w.expires):''])));
A['r-vehicle-x']=()=>{R.vehicle=null;render()};
function vWarranty(){
  const rows=DB.warranty.filter(w=>match(UIS.q.war,[w.plate,w.dot,w.item,w.orderNo,custName(w.customerId)])).slice().reverse();
  return '<div class="bar">'+searchBox('war','Search plate, DOT, customer or tyre')+'<span class="sp"></span>'+btn('Export CSV','war-export')+'</div>'+
    tbl([{h:'Sold',r:r=>fmtDate(r.ts)+'<br><span class="muted sm">'+esc(r.orderNo)+'</span>'},{h:'Vehicle',r:r=>esc(r.plate||'—')+'<br><span class="muted sm">'+esc(custName(r.customerId))+'</span>'},{h:'Tyre',r:r=>'<b>'+esc(r.item)+'</b>'},{h:'DOT',r:r=>esc(r.dot||'—')+(r.dot&&dotAge(r.dot)>6?' '+badge('old','warn'):'')},
      {h:'Warranty',r:r=>r.expires?(r.expires<now()?badge('expired '+fmtDate(r.expires),'bad'):badge('until '+fmtDate(r.expires),'ok')):'—'}],rows.slice(0,400),'No tyres with serial or warranty recorded yet.');
}
function vVehicleHistory(){
  const q=normPlate(UIS.vh||''), ords=q?DB.orders.filter(o=>o.vehicle&&normPlate(o.vehicle.plate).indexOf(q)>=0&&o.status==='completed'):[], jobs=q?DB.jobs.filter(j=>j.vehicle&&normPlate(j.vehicle.plate).indexOf(q)>=0):[];
  return '<div class="bar"><label class="inl">Plate number <input id="vhq" class="search" value="'+esc(UIS.vh||'')+'" data-in="vh" placeholder="e.g. A 12345"></label></div>'+
    (q?'<h3>Invoices</h3>'+tbl([{h:'Date',r:r=>fmtDT(r.ts)},{h:'Invoice',r:r=>esc(r.no)},{h:'Work / items',r:r=>esc(r.lines.map(l=>l.qty+'× '+l.name).join(', ').slice(0,100))},{h:'Total',cls:'r',r:r=>fmt(r.total)},{h:'',cls:'r',r:r=>btn('Open','order-view',r.id)}],ords.slice().reverse(),'No invoices for this plate.')+
      (bm('jobs')?'<h3 class="mt">Job cards</h3>'+tbl([{h:'Job',r:r=>esc(r.no)},{h:'Date',r:r=>fmtDate(r.ts)},{h:'Work',r:r=>esc(r.title)},{h:'Status',r:r=>badge(stLabel(r.status),'')},{h:'',cls:'r',r:r=>btn('Open','job-open',r.id)}],jobs,'No job cards.'):''):'<div class="empty">Type a plate number to see its history.</div>');
}
I.vh=el=>{UIS.vh=el.value;render()};

/* ================= Butcher: cutting notes and carcass breakdown ================= */
function notePresetsHtml(){const p=biz().notePresets;return p?'<div class="chips" style="margin-top:8px">'+p.map(x=>'<button type="button" class="chip" data-np="'+esc(x)+'">'+esc(x)+'</button>').join('')+'</div>':''}
function bindNotePresets(el){el.addEventListener('click',e=>{const b=e.target.closest('[data-np]');if(!b)return;const i=$('[name=note]',el),v=i.value.trim();i.value=(v?v+', ':'')+b.dataset.np;i.focus()})}
const BD_SHELF_DAYS=4;
function bdRow(sel,qty){
  const it=DB.items.filter(i=>i.active&&i.track&&i.weighed&&i.id!==(sel||'')).sort((a,b)=>a.name.localeCompare(b.name));
  return '<div class="vrow3 bdrow"><select name="bo" data-ch="bdcalc" aria-label="Cut / output item">'+it.map(i=>'<option value="'+i.id+'">'+esc(i.name)+'</option>').join('')+'</select><input name="bq" type="number" step="0.001" min="0" value="'+esc(qty||'')+'" data-in="bdcalc" placeholder="kg" aria-label="Weight"><span class="muted sm">kg</span><button type="button" class="lnk bad" data-act="bd-del" aria-label="Remove">✕</button></div>';
}
function vBreakdown(){
  const src=DB.items.filter(i=>i.active&&i.track&&i.weighed).sort((a,b)=>a.name.localeCompare(b.name)), recent=DB.breakdowns.slice(-8).reverse();
  return '<div class="card narrow"><h2>Carcass breakdown</h2><p class="muted sm">Cut a whole carcass or primal into saleable cuts. The cost of the source is spread over the cuts you get out, so waste is included in their cost and your stock value stays correct.</p>'+
    '<div class="form2"><label>Source<select id="bdSrc" data-ch="bdcalc">'+src.map(i=>'<option value="'+i.id+'">'+esc(i.name)+' — '+rq(stockOf(i.id))+' '+esc(i.unit||'kg')+' in stock</option>').join('')+'</select></label>'+field('Weight to cut (kg)','bdQty','',{type:'number',step:'0.001',min:0}).replace('name="bdQty"','name="bdQty" id="bdQty" data-in="bdcalc"')+'</div>'+
    '<h3>Cuts obtained</h3><div id="bdRows">'+bdRow('', '')+bdRow('', '')+bdRow('', '')+'</div><div class="bar"><button type="button" class="btn ghost sm" data-act="bd-add">+ Add cut</button></div><div id="bdPrev" class="sm muted"></div><div class="bar mt">'+btn('Post breakdown','bd-post',null,'primary')+'</div></div>'+
    '<section class="card mt"><h2>Recent breakdowns</h2>'+tbl([{h:'When',r:r=>fmtDT(r.ts)},{h:'Source',r:r=>esc(r.srcName)},{h:'In',cls:'r',r:r=>rq(r.qty)+' kg'},{h:'Out',cls:'r',r:r=>rq(r.qty-r.wasteKg)+' kg'},{h:'Yield',cls:'r',r:r=>r.yieldPct+'%'},{h:'Waste value',cls:'r',r:r=>fmt(r.wasteValue)}],recent,'No breakdowns yet.')+'</section>';
}
A['bd-add']=()=>{$('#bdRows').insertAdjacentHTML('beforeend',bdRow('',''))};
A['bd-del']=(d,el)=>{const rows=$$('.bdrow');if(rows.length>1&&el)el.closest('.bdrow').remove();bdCalc()};
function bdRead(){return {src:($('#bdSrc')||{}).value,qty:rq(num(($('#bdQty')||{}).value)),outs:$$('.bdrow').map(r=>({id:$('[name=bo]',r).value,qty:rq(num($('[name=bq]',r).value))})).filter(o=>o.id&&o.qty>0)}}
function bdCalc(){
  const p=$('#bdPrev'); if(!p)return; const r=bdRead(), out=rq(r.outs.reduce((a,o)=>a+o.qty,0)); if(!r.qty){p.textContent='';return}
  const waste=rq(r.qty-out), yp=r.qty?Math.round(out/r.qty*1000)/10:0, src=itemById(r.src), val=src?r2(r.qty*(src.cost||0)):0;
  p.innerHTML='Cuts '+out+' kg of '+r.qty+' kg → yield <b>'+yp+'%</b>, waste <b>'+waste+' kg</b>'+(waste<0?' <span class="neg">(cuts weigh more than the source)</span>':'')+(out>0&&src?' · cost per kg of cuts ≈ <b>'+fmt(val/out)+'</b>':'');
}
I.bdcalc=bdCalc; C.bdcalc=bdCalc;
function doBreakdown(srcId,qty,outs){
  const src=itemById(srcId); if(!src)throw new Error('Choose the source item');
  if(qty<=0)throw new Error('Enter the weight to cut'); if(!outs.length)throw new Error('Enter at least one cut');
  const out=rq(outs.reduce((a,o)=>a+o.qty,0)); if(out>qty+0.0005)throw new Error('The cuts weigh more ('+out+' kg) than the source ('+qty+' kg)');
  if(outs.some(o=>o.id===srcId))throw new Error('A cut cannot be the same as the source');
  if(sellableOf(srcId)<qty)throw new Error('Only '+sellableOf(srcId)+' kg of '+src.name+' in stock');
  DB.seq.bd=(DB.seq.bd||0)+1; const no='BD-'+String(DB.seq.bd).padStart(4,'0');
  const allocs=deductStock(srcId,qty,'Breakdown '+no,'breakdown'), value=allocCost(allocs,srcId), perKg=out>0?value/out:0;
  outs.forEach(o=>receiveLot(o.id,no,now()+BD_SHELF_DAYS*864e5,o.qty,perKg,'Breakdown '+no));
  const waste=rq(qty-out), rec={id:uid('bd'),no:no,ts:now(),srcId:srcId,srcName:src.name,qty:qty,outs:outs.map(o=>({itemId:o.id,name:(itemById(o.id)||{}).name,qty:o.qty})),wasteKg:waste,yieldPct:Math.round(out/qty*1000)/10,value:value,wasteValue:r2(waste*(qty?value/qty:0)),by:ME.id};
  DB.breakdowns.push(rec); audit('breakdown',no+' '+src.name+' '+qty+'kg → '+out+'kg'); save(); return rec;
}
A['bd-post']=()=>{const r=bdRead();try{const rec=doBreakdown(r.src,r.qty,r.outs);toast(rec.no+' posted: yield '+rec.yieldPct+'%');render()}catch(e){toast(e.message,'err')}};

/* ================= dashboard widgets & helpers for these types ================= */
const overdueJobsHtml=()=>{
  const list=DB.jobs.filter(j=>jobOpen(j)&&j.due&&j.due<=now()+864e5).sort((a,b)=>a.due-b.due).slice(0,8);
  return card('Due & overdue','jobs due within a day',tbl([{h:'Job',r:r=>'<a href="#" data-act="job-open" data-id="'+r.id+'"><b>'+esc(r.no)+'</b></a><br><span class="muted sm">'+esc(r.title||'')+'</span>'},{h:'Customer',r:r=>esc(custName(r.customerId))},{h:'Due',r:r=>isOverdue(r)?'<span class="neg">'+fmtDate(r.due)+' (late)</span>':fmtDate(r.due)},{h:'Balance',cls:'r',r:r=>fmt(jobBalance(r))}],list,'Nothing is due or overdue.'));
};

/* ================= Credit book (Guests → Credit accounts) ================= */
const creditOwed=()=>{const b=creditBalances();return r2(Object.keys(b).reduce((a,k)=>a+Math.max(0,b[k]),0))};
function vCreditBook(){
  const bal=creditBalances(), ag=creditAging(), over60=r2(ag.tot['61–90 days']+ag.tot['90+ days']);
  const rows=DB.customers.filter(c=>match(UIS.q.credit,[c.name,c.phone])&&(Math.abs(bal[c.id]||0)>0.004||creditLimitOf(c)>0)).sort((a,b)=>(bal[b.id]||0)-(bal[a.id]||0));
  return '<div class="kpis sm"><div class="kpi"><span class="kl">Owed to you</span><strong>'+money(creditOwed())+'</strong></div><div class="kpi"><span class="kl">Older than 60 days</span><strong class="'+(over60>0?'neg':'')+'">'+money(over60)+'</strong></div><div class="kpi"><span class="kl">Accounts with a balance</span><strong>'+ag.rows.length+'</strong></div></div>'+
    '<section class="card"><h2>Ageing</h2>'+mixBars(objRows(ag.tot))+'</section><div class="bar mt">'+searchBox('credit','Search customer')+'</div>'+
    tbl([{h:'Customer',r:r=>'<b>'+esc(r.name)+'</b><br><span class="muted sm">'+esc(r.phone||'')+'</span>'},{h:'Limit',cls:'r',r:r=>fmt(creditLimitOf(r))},{h:'Owes',cls:'r',r:r=>{const b=bal[r.id]||0;return b>0.004?'<b class="neg">'+fmt(b)+'</b>':fmt(b)}},
      {h:'Available',cls:'r',r:r=>fmt(Math.max(0,creditLimitOf(r)-(bal[r.id]||0)))},{h:'',cls:'r',r:r=>((bal[r.id]||0)>0.004?btn('Receive payment','cust-pay',r.id,'primary'):'')+' '+btn('Statement','cust-stmt',r.id)}],rows,'No credit accounts yet. Give a customer a credit limit on the Directory tab.');
}

/* ================= sample data for the new types ================= */
function demoJobs(){
  if(!bm('jobs')||!DB.customers.length)return 0;
  const pick=a=>a[Math.floor(Math.random()*a.length)], flow=jobFlow().filter(f=>f[0]!=='delivered').map(f=>f[0]), kind=jobKind();
  const works=kind==='tailor'?['2 kandura','Suit (2-piece)','Abaya + sheyla','Wedding dress','3 shirts','Trousers alteration']:['Full service + oil change','Brake pads front','A/C not cooling','Battery replacement','Check engine light','Pre-purchase inspection'];
  const svc=DB.items.filter(i=>i.active&&i.kind==='service'), part=DB.items.filter(i=>i.active&&i.kind!=='service'&&i.track);
  const provs=DB.providers.filter(p=>p.active); let n=0;
  for(let k=0;k<8;k++){
    const cu=pick(DB.customers), lines=[], s=pick(svc); if(!s)break;
    lines.push({itemId:s.id,qty:kind==='tailor'?pick([1,2,3]):1});
    if(kind==='garage'&&part.length&&Math.random()<0.7)lines.push({itemId:pick(part).id,qty:1});
    const j={id:uid('j'),no:newJobNo(),ts:now()-Math.floor(Math.random()*6)*864e5,advances:[],history:[],status:flow[k%flow.length],orderId:null,kind:kind,customerId:cu.id,title:pick(works),
      due:dayStart(now())+(k%3===0?-1:k%3===1?1:3)*864e5+12*36e5,assignee:provs.length?pick(provs).id:'',notes:'',lines:lines};
    if(kind==='tailor')j.meas={garment:'Kandura',values:{length:'58',chest:'44',sleeve:'24'}};
    else{const v=(cu.vehicles&&cu.vehicles[0])||{plate:'A '+(10000+k*731),make:'Toyota',model:'Camry',year:'2019'};j.vehicle={plate:v.plate,make:v.make,model:v.model,year:v.year,odo:String(60000+k*3100)};
      if(k%4===0)j.nextService={date:now()+(k%8===0?5:40)*864e5,km:''}}
    jobHist(j,j.status);DB.jobs.push(j);
    const adv=r2(Math.min(jobTotals(j).total*0.3,500));if(adv>=10&&k%2===0){try{postAdvance(j,'cash',Math.floor(adv))}catch(e){}}
    n++;
  }
  return n;
}
function demoBreakdowns(){
  if(!bm('breakdown'))return 0;
  const w=DB.items.filter(i=>i.active&&i.track&&i.weighed), srcs=w.filter(i=>/carcass|quarter/i.test(i.name)), cuts=w.filter(i=>!/carcass|quarter/i.test(i.name));
  if(!srcs.length||cuts.length<3)return 0; let n=0;
  for(let k=0;k<6;k++){
    const src=srcs[k%srcs.length], qty=30+k*4, pickCuts=cuts.slice(k%3,(k%3)+4), share=qty*(0.78+Math.random()*0.1)/pickCuts.length;
    try{const rec=doBreakdown(src.id,qty,pickCuts.map(c=>({id:c.id,qty:rq(share)})));rec.ts=now()-(6-k)*2*864e5;n++}catch(e){}
  }
  return n;
}
