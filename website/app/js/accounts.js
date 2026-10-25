'use strict';
/* Harbinger Accounts — double-entry books (Tally-style): groups, ledgers, vouchers, auto-posting, reports.
   Convention: every voucher has entries {ledgerId, dr, cr}; total Dr must equal total Cr.
   Ledger opening balance is signed: Dr positive, Cr negative. */

const ACC_GROUPS=[
  ['g_cap','Capital Account',null,'liability'],['g_loan','Loans (Liability)',null,'liability'],['g_cl','Current Liabilities',null,'liability'],
  ['g_duty','Duties & Taxes','g_cl','liability'],['g_cred','Sundry Creditors','g_cl','liability'],
  ['g_fa','Fixed Assets',null,'asset'],['g_ca','Current Assets',null,'asset'],['g_bank','Bank Accounts','g_ca','asset'],['g_cash','Cash-in-Hand','g_ca','asset'],
  ['g_stock','Stock-in-Hand','g_ca','asset'],['g_debt','Sundry Debtors','g_ca','asset'],['g_dep','Deposits & Receivables','g_ca','asset'],
  ['g_sales','Sales Accounts',null,'income'],['g_pur','Purchase Accounts',null,'expense'],['g_dinc','Direct Incomes',null,'income'],['g_iinc','Indirect Incomes',null,'income'],
  ['g_dexp','Direct Expenses',null,'expense'],['g_iexp','Indirect Expenses',null,'expense']
];
const ACC_LEDGERS=[ // key, name, group, system
  ['cash','Cash-in-Hand','g_cash',1],['bank','Main Bank Account','g_bank',1],['card','Card Collections (in transit)','g_dep',1],['wallet','Wallet / QR Collections','g_dep',1],
  ['suspense','Cash Paid Out (to classify)','g_dep',1],['stock','Stock-in-Hand','g_stock',1],['vat_out','VAT Output','g_duty',1],['vat_in','VAT Input','g_duty',1],
  ['grn','GRN Clearing (unbilled receipts)','g_cl',1],['capital',"Owner's Capital",'g_cap',1],['sales','Sales','g_sales',1],['purchases','Purchases','g_pur',1],
  ['cogs','Cost of Goods Sold','g_dexp',1],['disc','Discount Allowed','g_iexp',1],['shortover','Cash Over / Short','g_iexp',1],['cod','COD / Pay-at-counter Receivable','g_dep',1],['aggr','Aggregator Receivables','g_debt',1],['commission','Aggregator Commission','g_iexp',1],['svc','Service Charge Income','g_iinc',1],['govfee','Government Fees Payable (municipality etc.)','g_duty',1],['wastage','Stock Wastage & Adjustments','g_iexp',1],
  [null,'Rent','g_iexp',0],[null,'Salaries & Wages','g_iexp',0],[null,'Utilities','g_iexp',0],[null,'Marketing','g_iexp',0],[null,'Repairs & Maintenance','g_iexp',0],[null,'Miscellaneous Expenses','g_iexp',0]
];
const VPFX={Sales:'SAL',Purchase:'PUR',Payment:'PAY',Receipt:'REC',Journal:'JNL',Contra:'CNT','Credit Note':'CRN'};
const MANUAL_TYPES=['Payment','Receipt','Contra','Journal','Purchase'];

function seedAccounts(stockValue){
  const acc={startedAt:now(),lockedUntil:'',postInputVat:true,seq:{},vouchers:[],
    groups:ACC_GROUPS.map(g=>({id:g[0],name:g[1],parent:g[2],nature:g[3],system:true})),
    ledgers:ACC_LEDGERS.map((l,i)=>({id:'lg_'+(l[0]||('x'+i)),key:l[0],name:l[1],groupId:l[2],opening:0,system:!!l[3]}))};
  const L=k=>acc.ledgers.find(l=>l.key===k);
  L('stock').opening=r2(stockValue); L('capital').opening=-r2(stockValue);
  return acc;
}
/* called from migrate(): create books if missing, and a ledger for every supplier */
function ensureAccounts(){
  if(!DB.acc){
    const val=r2(DB.lots.reduce((a,l)=>a+l.qty*l.cost,0));
    DB.acc=seedAccounts(val);
  }
  ACC_LEDGERS.forEach((l,i)=>{if(l[0]&&!DB.acc.ledgers.some(x=>x.key===l[0]))DB.acc.ledgers.push({id:'lg_'+l[0],key:l[0],name:l[1],groupId:l[2],opening:0,system:true})});
  DB.suppliers.forEach(ensureSupplierLedger);
}
function ensureSupplierLedger(s){
  if(!DB.acc||DB.acc.ledgers.some(l=>l.supplierId===s.id))return;
  DB.acc.ledgers.push({id:uid('lg'),key:null,name:s.name,groupId:'g_cred',opening:0,system:false,supplierId:s.id});
}
const lg=id=>byId(DB.acc.ledgers,id);
const lgKey=k=>DB.acc.ledgers.find(l=>l.key===k);
const LID=k=>lgKey(k).id;
const grp=id=>byId(DB.acc.groups,id);
function natureOf(groupId){let g=grp(groupId);while(g&&g.parent)g=grp(g.parent);return g?g.nature:'asset'}
function inGroup(groupId,root){let g=grp(groupId);while(g){if(g.id===root)return true;g=g.parent?grp(g.parent):null}return false}
const isCashBank=l=>inGroup(l.groupId,'g_cash')||inGroup(l.groupId,'g_bank');
const drcr=n=>n>0.004?fmt(n)+' Dr':n<-0.004?fmt(-n)+' Cr':'0.00';
const lockedTs=()=>DB.acc.lockedUntil?new Date(DB.acc.lockedUntil+'T23:59:59').getTime():0;

/* ---------- posting engine ---------- */
function postVoucher(o){
  const A_=DB.acc, ents={};
  (o.entries||[]).forEach(e=>{
    const dr=r2(e.dr||0),cr=r2(e.cr||0);
    if(dr<0||cr<0)throw new Error('Negative amounts are not allowed');
    if(!dr&&!cr)return; if(dr&&cr)throw new Error('An entry cannot have both Dr and Cr');
    if(!lg(e.ledgerId))throw new Error('Unknown ledger');
    const k=e.ledgerId+(e.tag?'|'+e.tag:''), x=ents[k]||(ents[k]={ledgerId:e.ledgerId,dr:0,cr:0,tag:e.tag||''});
    x.dr=r2(x.dr+dr);x.cr=r2(x.cr+cr);
  });
  const list=Object.keys(ents).map(k=>ents[k]);
  const td=r2(list.reduce((a,e)=>a+e.dr,0)), tc=r2(list.reduce((a,e)=>a+e.cr,0));
  if(list.length<2)throw new Error('A voucher needs at least two entries');
  if(td!==tc)throw new Error('Debit '+fmt(td)+' and credit '+fmt(tc)+' do not match (difference '+fmt(Math.abs(td-tc))+')');
  const date=o.date||now();
  if(!o.auto&&date<=lockedTs())throw new Error('Books are locked up to '+A_.lockedUntil);
  const p=VPFX[o.type]||'VCH'; A_.seq[p]=(A_.seq[p]||0)+1;
  const v={id:uid('v'),type:o.type,no:p+'-'+String(A_.seq[p]).padStart(6,'0'),date:date,narration:o.narration||'',entries:list,ref:o.ref||null,auto:!!o.auto,
    user:ME?ME.id:null,createdAt:now(),cancelled:false,reversalOf:o.reversalOf||null,billNo:o.billNo||''};
  A_.vouchers.push(v);
  return v;
}
/* never let an accounting error block a sale: log it and flag the books */
function safePost(o){
  try{return postVoucher(o)}
  catch(e){DB.acc.postErrors=(DB.acc.postErrors||[]);DB.acc.postErrors.push({ts:now(),msg:e.message,narration:o.narration});audit('accounts.error',o.narration+': '+e.message);return null}
}
function allocCost(allocs,itemId){
  const it=itemById(itemId);
  return r2((allocs||[]).reduce((a,x)=>{const l=byId(DB.lots,x.lotId);return a+x.qty*(l?l.cost:(it?it.cost:0))},0));
}
function tenderLedger(m){return m==='cash'?LID('cash'):m==='card'?LID('card'):m==='cod'?LID('cod'):m==='aggregator'?LID('aggr'):LID('wallet')}

function postSale(o){
  const s=DB.settings, rate=s.vatPct/100, sub=o.subtotal;
  const taxable=o.lines.filter(l=>l.tax!==false).reduce((a,l)=>a+l.qty*l.price,0), tb=sub>0?taxable/sub:0;
  const subEx=s.taxInclusive?r2(sub-sub*tb*rate/(1+rate)):sub;
  const chT=o.chargeTotal||0, disc=Math.max(0,r2(subEx-r2(o.total-o.vat-chT)));
  const salesCr=r2(o.total-o.vat-chT+disc);
  const E=[];
  const pays=o.payments.map(p=>({m:p.method,a:p.amount}));
  const diff=r2(o.total-pays.reduce((a,p)=>a+p.a,0)); if(pays.length&&diff)pays[0].a=r2(pays[0].a+diff);
  pays.forEach(p=>E.push({ledgerId:tenderLedger(p.m),dr:p.a,cr:0}));
  if(disc>0)E.push({ledgerId:LID('disc'),dr:disc,cr:0});
  E.push({ledgerId:LID('sales'),dr:0,cr:salesCr});
  (o.charges||[]).forEach(c=>E.push({ledgerId:c.payable?LID('govfee'):LID('svc'),dr:0,cr:c.amount}));
  if(o.vat>0)E.push({ledgerId:LID('vat_out'),dr:0,cr:o.vat});
  const cogs=r2(o.lines.reduce((a,l)=>a+(l.cogs||0),0));
  if(cogs>0){E.push({ledgerId:LID('cogs'),dr:cogs,cr:0,tag:'cogs'});E.push({ledgerId:LID('stock'),dr:0,cr:cogs,tag:'cogs'})}
  return safePost({type:'Sales',date:o.ts,narration:'POS sale '+o.no,entries:E,ref:{kind:'order',id:o.id},auto:true});
}
function postRefund(o,restock){
  const sv=DB.acc.vouchers.find(v=>v.ref&&v.ref.kind==='order'&&v.ref.id===o.id&&v.type==='Sales'&&!v.reversalOf);
  if(!sv){audit('accounts.skip','Refund of order '+o.no+' made before the books started; no voucher posted');return null}
  const E=[];
  sv.entries.forEach(e=>{ if(e.tag==='cogs'&&!restock)return; E.push({ledgerId:e.ledgerId,dr:e.cr,cr:e.dr,tag:e.tag}) });
  const v=safePost({type:'Credit Note',narration:'Refund of '+o.no+(o.refund?' — '+o.refund.reason:''),entries:E,ref:{kind:'refund',id:o.id},auto:true,reversalOf:sv.id});
  return v;
}
function postCashVoucher(v){
  const a=v.amount, c=LID('cash'), s=LID('suspense');
  safePost({type:'Journal',date:v.ts,narration:'Register cash '+v.type+': '+v.reason,entries:v.type==='in'?[{ledgerId:c,dr:a,cr:0},{ledgerId:s,dr:0,cr:a}]:[{ledgerId:s,dr:a,cr:0},{ledgerId:c,dr:0,cr:a}],ref:{kind:'cashv',id:v.id},auto:true});
}
function postCashVariance(sess){
  const v=sess.variance; if(!v)return; const c=LID('cash'), so=LID('shortover'), a=Math.abs(v);
  safePost({type:'Journal',narration:'Register close variance '+(byId(DB.counters,sess.counterId)||{}).name,entries:v<0?[{ledgerId:so,dr:a,cr:0},{ledgerId:c,dr:0,cr:a}]:[{ledgerId:c,dr:a,cr:0},{ledgerId:so,dr:0,cr:a}],ref:{kind:'close',id:sess.id},auto:true});
}
function postPurchase(po){
  const sup=byId(DB.suppliers,po.supplierId); if(sup)ensureSupplierLedger(sup);
  const sl=sup&&DB.acc.ledgers.find(l=>l.supplierId===sup.id);
  const net=r2(po.lines.reduce((a,l)=>a+l.qty*l.cost,0)), vat=DB.acc.postInputVat?r2(net*DB.settings.vatPct/100):0;
  const E=[{ledgerId:LID('stock'),dr:net,cr:0}]; if(vat>0)E.push({ledgerId:LID('vat_in'),dr:vat,cr:0});
  E.push({ledgerId:sl?sl.id:LID('grn'),dr:0,cr:r2(net+vat)});
  return safePost({type:'Purchase',narration:'Goods received '+po.no+(sup?' from '+sup.name:''),entries:E,ref:{kind:'po',id:po.id},auto:true,billNo:po.no});
}
function postStockReceive(it,qty,cost,supplierId,ref){
  const val=r2(qty*cost); if(val<=0)return;
  const sup=supplierId&&byId(DB.suppliers,supplierId); if(sup)ensureSupplierLedger(sup);
  const sl=sup&&DB.acc.ledgers.find(l=>l.supplierId===sup.id);
  safePost({type:'Journal',narration:'Stock received: '+qty+' × '+it.name+(ref?' ('+ref+')':''),entries:[{ledgerId:LID('stock'),dr:val,cr:0},{ledgerId:sl?sl.id:LID('grn'),dr:0,cr:val}],ref:{kind:'receive',id:it.id},auto:true});
}
function postStockValue(value,narration){ // value>0 adds stock, <0 removes (write-off)
  const a=r2(Math.abs(value)); if(a<=0)return;
  safePost({type:'Journal',narration:narration,entries:value>0?[{ledgerId:LID('stock'),dr:a,cr:0},{ledgerId:LID('wastage'),dr:0,cr:a}]:[{ledgerId:LID('wastage'),dr:a,cr:0},{ledgerId:LID('stock'),dr:0,cr:a}],ref:{kind:'adjust'},auto:true});
}

/* ---------- balances & reports data ---------- */
function balMap(asOf,fromTs){
  const m={}; DB.acc.ledgers.forEach(l=>{m[l.id]={open:l.opening||0,dr:0,cr:0}});
  DB.acc.vouchers.forEach(v=>{
    if(asOf&&v.date>asOf)return;
    v.entries.forEach(e=>{const b=m[e.ledgerId];if(!b)return;
      if(fromTs&&v.date<fromTs)b.open=r2(b.open+e.dr-e.cr);else{b.dr=r2(b.dr+e.dr);b.cr=r2(b.cr+e.cr)}});
  });
  Object.keys(m).forEach(k=>{m[k].close=r2(m[k].open+m[k].dr-m[k].cr)});
  return m;
}
const aFrom=()=>{if(!UIS.afrom){const d=new Date();UIS.afrom=d.getFullYear()+'-'+pad(d.getMonth()+1)+'-01';UIS.ato=dayKey(now())}return new Date(UIS.afrom+'T00:00:00').getTime()};
const aTo=()=>{aFrom();return new Date(UIS.ato+'T23:59:59').getTime()};
function plData(fromTs,toTs){
  const m=balMap(toTs,fromTs), rows={sales:[],dinc:[],pur:[],dexp:[],iinc:[],iexp:[]};
  DB.acc.ledgers.forEach(l=>{
    const b=m[l.id], mov=r2(b.dr-b.cr), nat=natureOf(l.groupId); if(nat!=='income'&&nat!=='expense')return;
    const amt=nat==='income'?-mov:mov; if(Math.abs(amt)<0.005&&!b.dr&&!b.cr)return;
    const k=inGroup(l.groupId,'g_sales')?'sales':inGroup(l.groupId,'g_dinc')?'dinc':inGroup(l.groupId,'g_pur')?'pur':inGroup(l.groupId,'g_dexp')?'dexp':inGroup(l.groupId,'g_iinc')?'iinc':'iexp';
    rows[k].push({l:l,amt:amt});
  });
  const sum=a=>r2(a.reduce((x,r)=>x+r.amt,0));
  const t={sales:sum(rows.sales),dinc:sum(rows.dinc),pur:sum(rows.pur),dexp:sum(rows.dexp),iinc:sum(rows.iinc),iexp:sum(rows.iexp)};
  t.gross=r2(t.sales+t.dinc-t.pur-t.dexp); t.net=r2(t.gross+t.iinc-t.iexp);
  return {rows:rows,t:t};
}
function groupLedgers(root){return DB.acc.ledgers.filter(l=>inGroup(l.groupId,root))}
const accHead=(title,sub,actions)=>head(title,sub,actions);

/* ================= Views ================= */
function vAccounts(tab,sub){
  tab=tab||'daybook';
  const T=[['daybook','Day Book'],['ledgers','Ledgers'],['groups','Chart of Accounts'],['tb','Trial Balance'],['pl','Profit & Loss'],['bs','Balance Sheet'],['books','Cash / Bank Book'],['vat','VAT'],['outstanding','Outstanding'],['setup','Books & Checks']];
  const needsRange=['daybook','pl','books','vat'].indexOf(tab)>=0||(tab==='ledgers'&&sub);
  const needsAsOf=['tb','bs','outstanding'].indexOf(tab)>=0;
  aFrom();
  const rangeBar=needsRange?'<div class="bar"><label class="inl">From <input type="date" data-ch="afrom" value="'+esc(UIS.afrom)+'"></label><label class="inl">To <input type="date" data-ch="ato" value="'+esc(UIS.ato)+'"></label></div>':
    needsAsOf?'<div class="bar"><label class="inl">As on <input type="date" data-ch="ato" value="'+esc(UIS.ato)+'"></label></div>':'';
  let body='';
  if(tab==='daybook')body=vDayBook();
  else if(tab==='ledgers')body=sub?vLedgerStmt(sub):vLedgerList();
  else if(tab==='groups')body=vChart();
  else if(tab==='tb')body=vTB();
  else if(tab==='pl')body=vPL();
  else if(tab==='bs')body=vBS();
  else if(tab==='books')body=vBooks();
  else if(tab==='vat')body=vVatAcc();
  else if(tab==='outstanding')body=vOutstanding();
  else body=vSetup();
  return head('Accounts','Double-entry books — every entry balances',tab==='daybook'?'':'')+tabs('accounts',T,tab)+rangeBar+body;
}
C.afrom=el=>{UIS.afrom=el.value||UIS.afrom;render()}; C.ato=el=>{UIS.ato=el.value||UIS.ato;render()};

/* ----- Day Book ----- */
function vDayBook(){
  const f=aFrom(),t=aTo(),ty=UIS.vtype||'all';
  const rows=DB.acc.vouchers.filter(v=>v.date>=f&&v.date<=t&&(ty==='all'||v.type===ty)&&match(UIS.q.vch,[v.no,v.narration,v.type,v.entries.map(e=>(lg(e.ledgerId)||{}).name).join(' ')])).sort((a,b)=>b.date-a.date||b.createdAt-a.createdAt);
  const typeSel='<select data-ch="vtype" aria-label="Voucher type"><option value="all">All types</option>'+Object.keys(VPFX).map(x=>'<option'+(ty===x?' selected':'')+'>'+x+'</option>').join('')+'</select>';
  const newBtns=MANUAL_TYPES.map(x=>btn('+ '+x,'vch-new',x,x==='Payment'||x==='Receipt'?'primary':'ghost')).join('');
  return '<div class="bar">'+searchBox('vch','Search voucher, ledger or narration')+typeSel+'<span class="sp"></span>'+btn('Export CSV','daybook-export')+'</div><div class="bar">'+newBtns+'</div>'+
    tbl([{h:'Date',r:r=>fmtDate(r.date)},{h:'Voucher',r:r=>'<b>'+esc(r.no)+'</b><br><span class="muted sm">'+esc(r.type)+(r.auto?' · auto':'')+'</span>'},
      {h:'Particulars',r:r=>esc(r.entries.filter(e=>e.dr>0).map(e=>(lg(e.ledgerId)||{}).name).join(', '))+'<br><span class="muted sm">'+esc(r.narration)+'</span>'},
      {h:'Amount',cls:'r',r:r=>fmt(r.entries.reduce((a,e)=>a+e.dr,0))},{h:'',r:r=>r.cancelled?badge('Cancelled','bad'):r.reversalOf?badge('Reversal','warn'):''},{h:'',cls:'r',r:r=>btn('View','vch-view',r.id)}],rows.slice(0,400),'No vouchers in this range.');
}
C.vtype=el=>{UIS.vtype=el.value;render()};
A['daybook-export']=()=>{const f=aFrom(),t=aTo();downloadCSV('day-book',[['date','voucher','type','ledger','debit','credit','narration']].concat(DB.acc.vouchers.filter(v=>v.date>=f&&v.date<=t).flatMap(v=>v.entries.map(e=>[dayKey(v.date),v.no,v.type,(lg(e.ledgerId)||{}).name,e.dr||'',e.cr||'',v.narration]))))};
function voucherHtml(v){
  const td=r2(v.entries.reduce((a,e)=>a+e.dr,0));
  return '<div class="vch"><p><b>'+esc(v.type)+'</b> · '+esc(v.no)+' · '+fmtDate(v.date)+(v.billNo?' · Bill '+esc(v.billNo):'')+'</p>'+
    tbl([{h:'Ledger',r:r=>esc((lg(r.ledgerId)||{}).name)},{h:'Debit',cls:'r',r:r=>r.dr?fmt(r.dr):''},{h:'Credit',cls:'r',r:r=>r.cr?fmt(r.cr):''}],v.entries.slice().sort((a,b)=>b.dr-a.dr))+
    '<p class="sm"><b>Total</b> Dr '+fmt(td)+' = Cr '+fmt(td)+'</p><p class="muted sm">Narration: '+esc(v.narration||'—')+'<br>Posted '+fmtDT(v.createdAt)+' by '+esc(v.user?userName(v.user):'system')+'</p></div>';
}
A['vch-view']=d=>{
  const v=byId(DB.acc.vouchers,d.id), acts=[];
  if(!v.auto&&!v.cancelled&&!v.reversalOf&&can('accounts'))acts.push({label:'Cancel voucher',cls:'danger',keep:true,fn:()=>{closeModal();confirmBox('Cancel '+v.no+'? A reversing voucher is posted; the original stays on record.',()=>cancelVoucher(v),'Cancel voucher');return false}});
  if(v.ref&&v.ref.kind==='order'){const o=byId(DB.orders,v.ref.id);if(o)acts.push({label:'Open order',keep:true,fn:()=>{closeModal();A['order-view']({id:o.id});return false}})}
  modal({title:'Voucher '+v.no,wide:true,body:voucherHtml(v),actions:acts.concat([{label:'Close'}])});
};
function cancelVoucher(v){
  try{
    const r=postVoucher({type:'Journal',narration:'Cancellation of '+v.no,entries:v.entries.map(e=>({ledgerId:e.ledgerId,dr:e.cr,cr:e.dr})),reversalOf:v.id,ref:{kind:'cancel',id:v.id}});
    v.cancelled=true;audit('voucher.cancel',v.no+' → '+r.no);save();toast('Cancelled; reversal '+r.no);render();
  }catch(e){toast(e.message,'err')}
}

/* ----- manual voucher entry ----- */
const ledOpts=(filter,sel)=>DB.acc.ledgers.filter(filter||(()=>true)).sort((a,b)=>a.name.localeCompare(b.name)).map(l=>'<option value="'+l.id+'"'+(l.id===sel?' selected':'')+'>'+esc(l.name)+' — '+esc((grp(l.groupId)||{}).name)+'</option>').join('');
function vRow(type){
  return '<div class="vrow"><select name="led" aria-label="Ledger">'+ledOpts(l=>true)+'</select>'+(type==='Journal'?'<select name="side" aria-label="Debit or credit"><option value="dr">Dr</option><option value="cr">Cr</option></select>':'')+
    '<input name="amt" type="number" step="0.01" min="0" placeholder="Amount" aria-label="Amount"><button type="button" class="lnk bad" data-rm aria-label="Remove row">✕</button></div>';
}
A['vch-new']=d=>{
  const type=d.id, today=dayKey(now()), cb=ledOpts(isCashBank), cred=ledOpts(l=>inGroup(l.groupId,'g_cred'));
  let top='';
  if(type==='Payment')top='<label>Paid from (cash / bank)<select name="acct">'+cb+'</select></label>';
  if(type==='Receipt')top='<label>Received in (cash / bank)<select name="acct">'+cb+'</select></label>';
  if(type==='Contra')top='<div class="form2"><label>From (credit)<select name="from">'+cb+'</select></label><label>To (debit)<select name="to">'+cb+'</select></label></div>';
  if(type==='Purchase')top='<div class="form2"><label>Supplier (credit)<select name="party">'+cred+'</select></label>'+field('Supplier bill no.','bill','')+'</div>';
  const rowsBlock=type==='Contra'?field('Amount','camt','',{type:'number',step:'0.01',min:0}):
    '<div class="vhead muted sm">'+(type==='Payment'?'Particulars (debit)':type==='Receipt'?'Particulars (credit)':type==='Purchase'?'Expense / stock ledger (debit)':'Entries (total Dr must equal Cr)')+'</div><div id="vrows"></div><button type="button" class="btn ghost sm" id="vadd">+ Add line</button>';
  const vat=type==='Purchase'?check('Add input VAT '+DB.settings.vatPct+'% on top','vat',true):'';
  const el=modal({title:'New '+type+' voucher',wide:true,sticky:true,
    body:'<div class="form2">'+field('Date','date',today,{type:'date'})+'<span></span></div>'+top+rowsBlock+vat+'<div id="vdiff" class="sm muted"></div>'+field('Narration','narration',''),
    onOpen:m=>{
      if(type==='Contra')return;
      const rows=$('#vrows',m), add=()=>{rows.insertAdjacentHTML('beforeend',vRow(type));calc()};
      const calc=()=>{
        if(type!=='Journal'){$('#vdiff',m).textContent='';return}
        let dr=0,cr=0; $$('.vrow',rows).forEach(r=>{const a=num($('[name=amt]',r).value);if($('[name=side]',r).value==='dr')dr+=a;else cr+=a});
        $('#vdiff',m).innerHTML='Dr '+fmt(dr)+' · Cr '+fmt(cr)+' · '+(r2(dr-cr)===0&&dr>0?'<b class="pos">Balanced</b>':'<b class="neg">Difference '+fmt(Math.abs(dr-cr))+'</b>');
      };
      add(); if(type==='Journal')add();
      $('#vadd',m).addEventListener('click',add);
      m.addEventListener('input',calc);m.addEventListener('change',calc);
      m.addEventListener('click',e=>{if(e.target.matches('[data-rm]')){const r=e.target.closest('.vrow');if($$('.vrow',rows).length>1){r.remove();calc()}}});
    },
    actions:[{label:'Cancel'},{label:'Post voucher',cls:'primary',fn:m=>{
      try{
        const f=formData(m), E=[], date=new Date(f.date+'T12:00:00').getTime();
        if(!f.date)throw new Error('Choose a date');
        const rows=$$('.vrow',m).map(r=>({led:$('[name=led]',r).value,side:$('[name=side]',r)?$('[name=side]',r).value:'',amt:r2(num($('[name=amt]',r).value))})).filter(r=>r.amt>0);
        if(type==='Contra'){
          const a=r2(num(f.camt)); if(a<=0)throw new Error('Enter an amount'); if(f.from===f.to)throw new Error('From and To must be different');
          E.push({ledgerId:f.to,dr:a,cr:0},{ledgerId:f.from,dr:0,cr:a});
        }else{
          if(!rows.length)throw new Error('Add at least one line with an amount');
          const tot=r2(rows.reduce((a,r)=>a+r.amt,0));
          if(type==='Payment'){rows.forEach(r=>E.push({ledgerId:r.led,dr:r.amt,cr:0}));E.push({ledgerId:f.acct,dr:0,cr:tot})}
          else if(type==='Receipt'){rows.forEach(r=>E.push({ledgerId:r.led,dr:0,cr:r.amt}));E.push({ledgerId:f.acct,dr:tot,cr:0})}
          else if(type==='Purchase'){rows.forEach(r=>E.push({ledgerId:r.led,dr:r.amt,cr:0}));const v=f.vat?r2(tot*DB.settings.vatPct/100):0;if(v>0)E.push({ledgerId:LID('vat_in'),dr:v,cr:0});E.push({ledgerId:f.party,dr:0,cr:r2(tot+v)})}
          else rows.forEach(r=>E.push({ledgerId:r.led,dr:r.side==='dr'?r.amt:0,cr:r.side==='cr'?r.amt:0}));
        }
        if(E.some(e=>e.ledgerId===undefined))throw new Error('Choose a ledger on every line');
        const v=postVoucher({type:type,date:date,narration:f.narration.trim(),entries:E,billNo:f.bill||''});
        audit('voucher.post',v.no);save();toast(v.no+' posted');render();
      }catch(e){toast(e.message,'err');return false}
    }}]});
};

/* ----- Ledgers ----- */
function vLedgerList(){
  const m=balMap(aTo()), q=UIS.q.led;
  const rows=DB.acc.ledgers.filter(l=>match(q,[l.name,(grp(l.groupId)||{}).name])).sort((a,b)=>a.name.localeCompare(b.name));
  return '<div class="bar">'+searchBox('led','Search ledgers')+'<span class="sp"></span>'+btn('Export CSV','ledger-list-export')+btn('+ New ledger','ledger-edit',null,'primary')+'</div>'+
    tbl([{h:'Ledger',r:r=>'<a href="#/accounts/ledgers/'+r.id+'"><b>'+esc(r.name)+'</b></a>'},{h:'Group',r:r=>esc((grp(r.groupId)||{}).name)},{h:'Opening',cls:'r',r:r=>drcr(r.opening||0)},{h:'Closing',cls:'r',r:r=>drcr(m[r.id].close)},
      {h:'',cls:'r',r:r=>btn('Statement','ledger-open',r.id)+' '+btn('Edit','ledger-edit',r.id)}],rows,'No ledgers.');
}
A['ledger-open']=d=>{location.hash='#/accounts/ledgers/'+d.id};
A['ledger-list-export']=()=>{const m=balMap(aTo());downloadCSV('ledgers',[['ledger','group','opening','closing']].concat(DB.acc.ledgers.map(l=>[l.name,(grp(l.groupId)||{}).name,l.opening||0,m[l.id].close])))};
function stmtRows(id,f,t){
  const l=lg(id), pre=DB.acc.vouchers.filter(v=>v.date<f).reduce((a,v)=>a+v.entries.filter(e=>e.ledgerId===id).reduce((x,e)=>x+e.dr-e.cr,0),0);
  let bal=r2((l.opening||0)+pre); const out=[{open:true,bal:bal}];
  DB.acc.vouchers.filter(v=>v.date>=f&&v.date<=t&&v.entries.some(e=>e.ledgerId===id)).sort((a,b)=>a.date-b.date||a.createdAt-b.createdAt).forEach(v=>{
    const dr=r2(v.entries.filter(e=>e.ledgerId===id).reduce((a,e)=>a+e.dr,0)), cr=r2(v.entries.filter(e=>e.ledgerId===id).reduce((a,e)=>a+e.cr,0));
    bal=r2(bal+dr-cr);
    const others=v.entries.filter(e=>e.ledgerId!==id).map(e=>(lg(e.ledgerId)||{}).name);
    out.push({v:v,dr:dr,cr:cr,bal:bal,part:others.length>2?'As per details':others.join(', ')});
  });
  return out;
}
function vLedgerStmt(id,hideBack){
  const l=lg(id); if(!l)return '<div class="empty">Ledger not found.</div>';
  const f=aFrom(),t=aTo(), rows=stmtRows(id,f,t), tdr=r2(rows.reduce((a,r)=>a+(r.dr||0),0)), tcr=r2(rows.reduce((a,r)=>a+(r.cr||0),0));
  window._csv=[['date','voucher','type','particulars','debit','credit','balance']].concat(rows.map(r=>r.open?['','','','Opening balance','','',r.bal]:[dayKey(r.v.date),r.v.no,r.v.type,r.part,r.dr||'',r.cr||'',r.bal]));window._csvName='ledger-'+l.name;
  return (hideBack?'':'<p><a href="#/accounts/ledgers">← All ledgers</a></p>')+'<div class="bar"><h2 style="margin:0">'+esc(l.name)+'</h2><span class="muted">'+esc((grp(l.groupId)||{}).name)+'</span><span class="sp"></span>'+btn('Export CSV','rep-export')+'</div>'+
    tbl([{h:'Date',r:r=>r.open?'':fmtDate(r.v.date)},{h:'Voucher',r:r=>r.open?'<i>Opening balance</i>':'<a href="#" data-act="vch-view" data-id="'+r.v.id+'">'+esc(r.v.no)+'</a><br><span class="muted sm">'+esc(r.v.type)+'</span>'},
      {h:'Particulars',r:r=>r.open?'':esc(r.part)+(r.v.narration?'<br><span class="muted sm">'+esc(r.v.narration)+'</span>':'')},{h:'Debit',cls:'r',r:r=>r.dr?fmt(r.dr):''},{h:'Credit',cls:'r',r:r=>r.cr?fmt(r.cr):''},{h:'Balance',cls:'r',r:r=>drcr(r.bal)}],rows)+
    '<p class="sm" style="margin-top:10px"><b>Totals</b> Dr '+fmt(tdr)+' · Cr '+fmt(tcr)+' · <b>Closing '+drcr(rows[rows.length-1].bal)+'</b></p>';
}
A['ledger-edit']=d=>{
  const l=d.id?lg(d.id):null, used=l&&DB.acc.vouchers.some(v=>v.entries.some(e=>e.ledgerId===l.id));
  const op=l?l.opening||0:0;
  modal({title:l?'Edit ledger':'New ledger',body:field('Name','name',l&&l.name,{req:1,af:1})+
    '<label>Under group<select name="groupId"'+(l&&l.system?' disabled':'')+'>'+DB.acc.groups.map(g=>'<option value="'+g.id+'"'+(l&&l.groupId===g.id?' selected':'')+'>'+esc(g.name)+'</option>').join('')+'</select></label>'+
    '<div class="form2">'+field('Opening balance','open',Math.abs(op)||'',{type:'number',step:'0.01',min:0})+select('Dr / Cr','side',[['dr','Dr'],['cr','Cr']],op<0?'cr':'dr')+'</div><p class="muted sm">Opening balances apply to asset and liability ledgers only. Income and expense ledgers must start at zero.</p>'+(used?'<p class="warn-t">This ledger has vouchers; changing the opening balance changes all later balances.</p>':''),
    actions:[{label:'Cancel'},{label:'Save',cls:'primary',fn:m=>{
      const f=formData(m), name=f.name.trim(); if(!name){toast('Name required','err');return false}
      if(DB.acc.ledgers.some(x=>x.id!==d.id&&x.name.toLowerCase()===name.toLowerCase())){toast('A ledger with that name exists','err');return false}
      const gid=l&&l.system?l.groupId:f.groupId, nat=natureOf(gid), amt=r2(num(f.open));
      if(amt>0&&(nat==='income'||nat==='expense')){toast('Income/expense ledgers cannot have an opening balance','err');return false}
      if(l&&!l.system&&used&&natureOf(l.groupId)!==nat){toast('Cannot move a ledger with vouchers to a different nature of group','err');return false}
      const opening=f.side==='cr'?-amt:amt;
      if(l){l.name=name;l.groupId=gid;l.opening=opening}else DB.acc.ledgers.push({id:uid('lg'),key:null,name:name,groupId:gid,opening:opening,system:false});
      audit('ledger.save',name);save();render();
    }}].concat(l&&!l.system&&!used?[{label:'Delete',cls:'danger',keep:true,fn:()=>{closeModal();confirmBox('Delete ledger '+l.name+'?',()=>{DB.acc.ledgers=DB.acc.ledgers.filter(x=>x.id!==l.id);save();render()},'Delete');return false}}]:[])});
};

/* ----- Chart of accounts ----- */
function vChart(){
  const m=balMap(aTo());
  const node=(g,depth)=>{
    const kids=DB.acc.groups.filter(x=>x.parent===g.id), leds=DB.acc.ledgers.filter(l=>l.groupId===g.id);
    return '<div class="gnode" style="margin-left:'+depth*18+'px"><div class="gh"><b>'+esc(g.name)+'</b> <span class="muted sm">'+esc(g.nature)+'</span></div>'+
      leds.map(l=>'<div class="gl2"><a href="#/accounts/ledgers/'+l.id+'">'+esc(l.name)+'</a><span>'+drcr(m[l.id].close)+'</span></div>').join('')+kids.map(k=>node(k,depth+1)).join('')+'</div>';
  };
  return '<div class="bar"><span class="sp"></span>'+btn('+ New group','group-edit')+btn('+ New ledger','ledger-edit',null,'primary')+'</div><section class="card">'+DB.acc.groups.filter(g=>!g.parent).map(g=>node(g,0)).join('')+'</section>';
}
A['group-edit']=()=>modal({title:'New group',body:field('Group name','name','',{af:1})+'<label>Under<select name="parent">'+DB.acc.groups.map(g=>'<option value="'+g.id+'">'+esc(g.name)+'</option>').join('')+'</select></label>',
  actions:[{label:'Cancel'},{label:'Create',cls:'primary',fn:m=>{const f=formData(m),n=f.name.trim();if(!n){toast('Name required','err');return false}
    if(DB.acc.groups.some(g=>g.name.toLowerCase()===n.toLowerCase())){toast('Group exists','err');return false}
    DB.acc.groups.push({id:uid('g'),name:n,parent:f.parent,nature:natureOf(f.parent),system:false});save();render()}}]});

/* ----- Trial balance ----- */
function vTB(){
  const asOf=aTo(), m=balMap(asOf), prim=DB.acc.groups.filter(g=>!g.parent);
  let td=0,tc=0; const csv=[['group','ledger','debit','credit']]; let html='';
  prim.forEach(g=>{
    const leds=groupLedgers(g.id).filter(l=>Math.abs(m[l.id].close)>0.004); if(!leds.length)return;
    html+='<tr class="grow"><td colspan="3"><b>'+esc(g.name)+'</b></td></tr>';
    leds.forEach(l=>{const c=m[l.id].close,dr=c>0?c:0,cr=c<0?-c:0;td=r2(td+dr);tc=r2(tc+cr);
      html+='<tr><td>&nbsp;&nbsp;<a href="#/accounts/ledgers/'+l.id+'">'+esc(l.name)+'</a></td><td class="r">'+(dr?fmt(dr):'')+'</td><td class="r">'+(cr?fmt(cr):'')+'</td></tr>';csv.push([g.name,l.name,dr||'',cr||''])});
  });
  const openDiff=r2(DB.acc.ledgers.reduce((a,l)=>a+(l.opening||0),0));
  if(openDiff){const dr=openDiff<0?-openDiff:0,cr=openDiff>0?openDiff:0;td=r2(td+dr);tc=r2(tc+cr);html+='<tr class="grow"><td><b>Difference in opening balances</b></td><td class="r">'+(dr?fmt(dr):'')+'</td><td class="r">'+(cr?fmt(cr):'')+'</td></tr>'}
  window._csv=csv;window._csvName='trial-balance';
  const ok=td===tc;
  return '<div class="bar"><span class="sp"></span>'+btn('Export CSV','rep-export')+'</div><div class="tbl-wrap"><table><thead><tr><th>Particulars</th><th class="r">Debit</th><th class="r">Credit</th></tr></thead><tbody>'+html+
    '<tr class="gtot"><td><b>Grand total</b></td><td class="r"><b>'+fmt(td)+'</b></td><td class="r"><b>'+fmt(tc)+'</b></td></tr></tbody></table></div>'+
    '<p class="'+(ok?'pos':'neg')+'" style="margin-top:10px">'+(ok?'✓ Trial balance agrees.':'✗ Trial balance does NOT agree — difference '+fmt(Math.abs(td-tc)))+'</p>';
}

/* ----- Profit & Loss ----- */
function plLines(rows,sign){return rows.map(r=>'<tr><td>&nbsp;&nbsp;<a href="#/accounts/ledgers/'+r.l.id+'">'+esc(r.l.name)+'</a></td><td class="r">'+fmt(r.amt)+'</td></tr>').join('')}
function vPL(){
  const d=plData(aFrom(),aTo()), t=d.t, R=d.rows;
  const sec=(title,rows,total)=>rows.length?'<tr class="grow"><td><b>'+esc(title)+'</b></td><td class="r"><b>'+fmt(total)+'</b></td></tr>'+plLines(rows):'';
  const html=sec('Sales Accounts',R.sales,t.sales)+sec('Direct Incomes',R.dinc,t.dinc)+sec('Less: Purchase Accounts',R.pur,t.pur)+sec('Less: Direct Expenses (incl. cost of goods sold)',R.dexp,t.dexp)+
    '<tr class="gtot"><td><b>Gross '+(t.gross>=0?'Profit':'Loss')+'</b></td><td class="r"><b>'+fmt(t.gross)+'</b></td></tr>'+
    sec('Add: Indirect Incomes',R.iinc,t.iinc)+sec('Less: Indirect Expenses',R.iexp,t.iexp)+
    '<tr class="gtot"><td><b>Net '+(t.net>=0?'Profit':'Loss')+'</b></td><td class="r '+(t.net>=0?'pos':'neg')+'"><b>'+fmt(t.net)+'</b></td></tr>';
  window._csv=[['section','ledger','amount']].concat(Object.keys(R).flatMap(k=>R[k].map(r=>[k,r.l.name,r.amt])).concat([['','Gross profit',t.gross],['','Net profit',t.net]]));window._csvName='profit-and-loss';
  return '<div class="bar"><span class="sp"></span>'+btn('Export CSV','rep-export')+'</div><div class="tbl-wrap"><table><thead><tr><th>Trading & Profit and Loss Account</th><th class="r">Amount ('+esc(DB.settings.currency)+')</th></tr></thead><tbody>'+html+'</tbody></table></div>'+
    '<p class="muted sm" style="margin-top:8px">Stock is kept on a perpetual basis: cost of goods sold is posted at the time of each sale, so no separate opening/closing stock adjustment is needed.</p>';
}

/* ----- Balance sheet ----- */
function vBS(){
  const asOf=aTo(), m=balMap(asOf);
  const net=r2(DB.acc.ledgers.filter(l=>{const n=natureOf(l.groupId);return n==='income'||n==='expense'}).reduce((a,l)=>a-m[l.id].close,0)); // income credit-positive
  const sideRows=(roots,sign)=>{
    let tot=0,html='';
    roots.forEach(rid=>{
      const g=grp(rid), leds=groupLedgers(rid).filter(l=>Math.abs(m[l.id].close)>0.004); if(!leds.length)return;
      const subtotal=r2(leds.reduce((a,l)=>a+sign*m[l.id].close,0)); tot=r2(tot+subtotal);
      html+='<tr class="grow"><td><b>'+esc(g.name)+'</b></td><td class="r"><b>'+fmt(subtotal)+'</b></td></tr>'+leds.map(l=>'<tr><td>&nbsp;&nbsp;<a href="#/accounts/ledgers/'+l.id+'">'+esc(l.name)+'</a></td><td class="r">'+fmt(sign*m[l.id].close)+'</td></tr>').join('');
    });
    return {html:html,tot:tot};
  };
  const L=sideRows(['g_cap','g_loan','g_cl'],-1), As=sideRows(['g_fa','g_ca'],1);
  const liabTot=r2(L.tot+net);
  const liabHtml=L.html+'<tr class="grow"><td><b>Profit & Loss A/c (cumulative)</b></td><td class="r '+(net>=0?'':'neg')+'"><b>'+fmt(net)+'</b></td></tr>';
  const openDiff=r2(DB.acc.ledgers.reduce((a,l)=>a+(l.opening||0),0));
  const ok=r2(liabTot-As.tot+(-openDiff))===0||r2(As.tot-liabTot)===0;
  window._csv=[['side','amount'],['Liabilities & capital',liabTot],['Assets',As.tot]];window._csvName='balance-sheet';
  return '<div class="bar"><span class="sp"></span>'+btn('Export CSV','rep-export')+'</div><div class="cols2"><div class="tbl-wrap"><table><thead><tr><th>Liabilities &amp; Capital</th><th class="r">Amount</th></tr></thead><tbody>'+liabHtml+'<tr class="gtot"><td><b>Total</b></td><td class="r"><b>'+fmt(liabTot)+'</b></td></tr></tbody></table></div>'+
    '<div class="tbl-wrap"><table><thead><tr><th>Assets</th><th class="r">Amount</th></tr></thead><tbody>'+As.html+'<tr class="gtot"><td><b>Total</b></td><td class="r"><b>'+fmt(As.tot)+'</b></td></tr></tbody></table></div></div>'+
    '<p class="'+(r2(liabTot-As.tot)===0?'pos':'neg')+'">'+(r2(liabTot-As.tot)===0?'✓ Balance sheet agrees.':'✗ Difference '+fmt(Math.abs(liabTot-As.tot))+(openDiff?' (opening balances are out by '+fmt(Math.abs(openDiff))+')':''))+'</p>';
}

/* ----- Cash / bank book ----- */
function vBooks(){
  const cbs=DB.acc.ledgers.filter(isCashBank); if(!UIS.book||!lg(UIS.book))UIS.book=cbs[0].id;
  return '<div class="bar"><label class="inl">Book <select data-ch="book">'+cbs.map(l=>'<option value="'+l.id+'"'+(UIS.book===l.id?' selected':'')+'>'+esc(l.name)+'</option>').join('')+'</select></label></div>'+vLedgerStmt(UIS.book,true);
}
C.book=el=>{UIS.book=el.value;render()};

/* ----- VAT ----- */
function vVatAcc(){
  const f=aFrom(),t=aTo(), m=balMap(t,f), out=r2(-(m[LID('vat_out')].dr-m[LID('vat_out')].cr)), inn=r2(m[LID('vat_in')].dr-m[LID('vat_in')].cr);
  const sales=r2(-(balMap(t,f)[LID('sales')].dr-balMap(t,f)[LID('sales')].cr));
  const kp=(l,v)=>'<div class="kpi"><span class="kl">'+esc(l)+'</span><strong>'+v+'</strong></div>';
  window._csv=[['item','amount'],['Output VAT',out],['Input VAT',inn],['Net VAT payable',r2(out-inn)]];window._csvName='vat-return';
  return '<div class="kpis">'+kp('Output VAT (sales)',money(out))+kp('Input VAT (purchases)',money(inn))+kp('Net VAT '+(out-inn>=0?'payable':'refundable'),money(Math.abs(out-inn)))+kp('Sales ex-VAT',money(sales))+'</div>'+
    '<p class="muted sm">Based on posted vouchers for the selected period. Pay the net amount to the tax authority with a Payment voucher against VAT Output / VAT Input.</p><div class="bar"><span class="sp"></span>'+btn('Export CSV','rep-export')+'</div>';
}

/* ----- Outstanding ----- */
function vOutstanding(){
  const m=balMap(aTo());
  const mk=(root,title,sign)=>{const rows=groupLedgers(root).filter(l=>Math.abs(m[l.id].close)>0.004);
    return '<section class="card"><h2>'+title+'</h2>'+tbl([{h:'Ledger',r:r=>'<a href="#/accounts/ledgers/'+r.id+'">'+esc(r.name)+'</a>'},{h:'Balance',cls:'r',r:r=>fmt(sign*m[r.id].close)}],rows,'Nothing outstanding.')+'<p class="sm"><b>Total '+fmt(rows.reduce((a,l)=>a+sign*m[l.id].close,0))+'</b></p></section>'};
  return '<div class="cols2">'+mk('g_cred','Payables — Sundry Creditors',-1)+mk('g_debt','Receivables — Sundry Debtors',1)+'</div>';
}

/* ----- Books & checks ----- */
function vSetup(){
  const a=DB.acc, m=balMap(null), td=r2(DB.acc.ledgers.reduce((s,l)=>s+Math.max(0,m[l.id].close),0)), tc=r2(DB.acc.ledgers.reduce((s,l)=>s+Math.max(0,-m[l.id].close),0));
  const stockInv=r2(DB.lots.reduce((s,l)=>s+l.qty*l.cost,0)), stockLed=m[LID('stock')].close;
  const vatLed=r2(-(m[LID('vat_out')].close)), vatOrders=r2(DB.orders.filter(o=>o.status==='completed').reduce((s,o)=>s+o.vat,0));
  const badV=a.vouchers.filter(v=>r2(v.entries.reduce((s,e)=>s+e.dr,0))!==r2(v.entries.reduce((s,e)=>s+e.cr,0))).length;
  const row=(label,ok,detail)=>'<tr><td>'+esc(label)+'</td><td>'+(ok?badge('OK','ok'):badge('Check','bad'))+'</td><td class="muted sm">'+esc(detail)+'</td></tr>';
  const openDiff=r2(a.ledgers.reduce((s,l)=>s+(l.opening||0),0));
  const errs=(a.postErrors||[]).slice(-5);
  return '<section class="card narrow"><h2>Books health</h2><div class="tbl-wrap"><table><thead><tr><th>Check</th><th>Result</th><th>Detail</th></tr></thead><tbody>'+
    row('Every voucher balances',badV===0,badV+' unbalanced vouchers')+row('Trial balance (Dr = Cr)',r2(td-tc)===0,'Dr '+fmt(td)+' · Cr '+fmt(tc))+
    row('Opening balances agree',openDiff===0,'Difference '+fmt(openDiff))+
    row('Stock ledger = stock valuation',r2(stockInv-stockLed)===0,'Ledger '+fmt(stockLed)+' · Inventory '+fmt(stockInv))+
    row('VAT output = order VAT',r2(vatLed-vatOrders)===0,'Ledger '+fmt(vatLed)+' · Orders '+fmt(vatOrders))+
    row('No failed auto-postings',!errs.length,errs.length?errs.map(e=>e.msg).join('; '):'None')+'</tbody></table></div></section>'+
    '<section class="card narrow mt"><h2>Period lock & options</h2><form id="accForm"><div class="form2">'+field('Lock books up to (inclusive)','lock',a.lockedUntil,{type:'date'})+'<span></span></div>'+
    check('Post input VAT on goods received (cost assumed ex-VAT)','piv',a.postInputVat)+'<div class="bar mt"><button class="btn primary" type="submit">Save</button></div></form>'+
    '<p class="muted sm">Books started on '+fmtDate(a.startedAt)+'. Sales, refunds, goods receipts, cash vouchers, register variances and stock write-offs post automatically. Manual vouchers cannot be dated inside a locked period, and posted vouchers are never edited — cancel and re-enter instead.</p></section>';
}
function bindAccounts(){
  const f=$('#accForm'); if(!f)return;
  f.addEventListener('submit',e=>{e.preventDefault();const d=formData(f);
    if(d.lock&&d.lock>dayKey(now())){toast('Cannot lock a future date','err');return}
    DB.acc.lockedUntil=d.lock||'';DB.acc.postInputVat=!!d.piv;audit('accounts.settings','lock '+(d.lock||'none'));save();toast('Saved');render()});
}

/* settle a pay-on-pickup / cash-on-delivery order: money moves from the COD receivable to cash / card / wallet */
function postCodSettle(o,method){
  const a=o.payments.filter(p=>p.method==='cod').reduce((x,p)=>x+p.amount,0); if(a<=0)return null;
  return safePost({type:'Receipt',narration:'Payment received for '+o.no+' ('+method+')',entries:[{ledgerId:tenderLedger(method),dr:a,cr:0},{ledgerId:LID('cod'),dr:0,cr:a}],ref:{kind:'codsettle',id:o.id},auto:true});
}
/* delivery-app payout: bank receives gross minus commission; receivable is cleared */
function postAggrSettlement(channel,gross,commission,vatOnCommission){
  const net=r2(gross-commission-vatOnCommission), E=[{ledgerId:LID('bank'),dr:net,cr:0}];
  if(commission>0)E.push({ledgerId:LID('commission'),dr:commission,cr:0});
  if(vatOnCommission>0)E.push({ledgerId:LID('vat_in'),dr:vatOnCommission,cr:0});
  E.push({ledgerId:LID('aggr'),dr:0,cr:gross});
  return postVoucher({type:'Receipt',narration:''+channel+' payout (gross '+fmt(gross)+', commission '+fmt(commission)+')',entries:E,ref:{kind:'aggrsettle',id:channel}});
}
