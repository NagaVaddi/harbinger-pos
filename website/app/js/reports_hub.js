'use strict';
/* Reports hub: one page that lists every report in groups (Sales, Accounts, Inventory), plus the four inventory reports:
   stock report, item activity, stock adjustments, expiry / batch report. */

const RH_ICONS={
  sales:'M4 19V9M10 19V5M16 19v-8M22 19H2',
  accounts:'M5 3h11l3 3v15H5zM9 9h6M9 13h6M9 17h3',
  stock:'M3 8l9-5 9 5v9l-9 5-9-5zM3 8l9 5 9-5M12 13v9'
};
const rhIcon=k=>'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+RH_ICONS[k]+'"/></svg>';

function reportGroups(){
  const sales=[['reports/sales','Sales summary','Every completed bill, day by day, with discounts and tax'],['reports/items','By item','Best sellers and slow movers'],['reports/category','By category','Revenue and share per category'],
    ['reports/payments','Payments','Cash, card and other tender totals'],['reports/staff','By cashier','Bills and discounts per team member'],['reports/margin','Margin per bill','Cost, tax and profit on each bill'],
    ['reports/vat','Tax report',(DB.settings.taxLabel||'VAT')+' collected on sales in the range'],['reports/hourly','Busy hours','Which hours and days are busiest'],['reports/menu','Menu profit','Popularity against profit for each item'],['reports/risk','Risk alerts','Unusual discounts, voids and refunds']];
  if(bm('rx'))sales.push(['reports/rx','Prescription register','Every prescription dispensed, with controlled medicines']);
  if(bm('provider'))sales.push(['reports/provider','Provider earnings','Revenue and commission per provider']);
  if(bm('serial'))sales.push(['reports/warranty','Warranty register','Tyres sold with DOT code and warranty end date']);
  if(bm('vehicle'))sales.push(['reports/vehicle','Vehicle history','Invoices and job cards for a plate number']);
  const acc=can('accounts')?[['reports/acc-summary','Accounts summary','Cash, receivables, payables, stock, tax and profit in one place, with customer ageing'],['reports/acc-stock','Stock report (books)','Stock value by category, reconciled to the stock ledger'],['reports/acc-vat',(DB.settings.taxLabel||'VAT')+' summary','Taxable sales, output and input tax by month'],['accounts/daybook','Day Book','Every voucher in date order'],['accounts/pl','Profit & Loss','Income, cost of sales and expenses'],['accounts/bs','Balance Sheet','What you own and owe on a date'],['accounts/tb','Trial Balance','All ledger balances; debits equal credits'],
    ['accounts/books','Cash / Bank Book','Receipts and payments by cash and bank ledger'],['accounts/outstanding','Outstanding','Receivables and payables'],['accounts/ledgers','Ledger statements','Open any ledger and see its entries'],['accounts/vat',(DB.settings.taxLabel||'VAT')+' ledger view','Tax ledgers for the selected dates']].concat(bm('credit')?[['guests/credit','Customer credit & ageing','Who owes you, and for how long']]:[]):[];
  const inv=[['reports/inv-stock','Stock report','Quantity, value and status of every tracked item'],['reports/inv-activity','Item activity','Every movement of one item: in, out and running balance'],['reports/inv-adjust','Stock adjustments','Counts, corrections and wastage with value lost'],
    ['reports/inv-expiry','Expiry / batch report','Batches by expiry date, so you can act before they spoil'],['reports/valuation','Stock valuation','Total stock value at cost'],['stock/reorder','Reorder suggestions','What to buy, based on sales speed']];
  const out=[{k:'accounts',title:'Accounts reports',items:acc},{k:'stock',title:'Inventory reports',items:inv},{k:'sales',title:'Sales & operations',items:sales}];
  return out.filter(g=>g.items.length);
}
function vReportHub(){
  return head(tr('Reports'),'Choose a report to view')+reportGroups().map(g=>'<h2 class="rh-t">'+esc(g.title)+'</h2><div class="rhub">'+g.items.map(r=>
    '<a class="rcard" href="#/'+r[0]+'"><span class="ri">'+rhIcon(g.k)+'</span><span class="rt2"><b>'+esc(tr(r[1]))+'</b><small>'+esc(r[2])+'</small></span><span class="chev" aria-hidden="true">›</span></a>').join('')+'</div>').join('');
}
const reportNav=tab=>'<p class="sm"><a href="#/reports">← All reports</a></p>'+tabs('reports',reportTabs(),tab);

/* ---------- inventory reports ---------- */
const invRange=()=>{repRange();return [new Date(UIS.from+'T00:00:00').getTime(),new Date(UIS.to+'T23:59:59').getTime()]};
const invRangeBar=()=>'<label class="inl">From <input type="date" data-ch="from" value="'+esc(UIS.from)+'"></label><label class="inl">To <input type="date" data-ch="to" value="'+esc(UIS.to)+'"></label>';
const lotValue=id=>r2(DB.lots.filter(l=>l.itemId===id&&l.qty>0).reduce((a,l)=>a+l.qty*l.cost,0));
const kpi_=(l,v,cls)=>'<div class="kpi"><span class="kl">'+esc(l)+'</span><strong class="'+(cls||'')+'">'+v+'</strong></div>';
const MOVE_LABEL={receive:'Received',sale:'Sold',refund:'Returned to stock',waste:'Wastage',adjust:'Adjustment',breakdown:'Cut (breakdown)'};
const unitOf=it=>it&&it.unit?it.unit:'';

function vInvReport(tab){
  let body='',csv=null,bar='';
  if(tab==='inv-stock'){
    const f=UIS.invst||'all', rows=DB.items.filter(i=>i.active&&i.track&&match(UIS.q.invs,[i.name,i.sku,i.barcode,i.size,i.brand])).map(i=>{const q=stockOf(i.id);return {i:i,q:q,val:lotValue(i.id),retail:r2(Math.max(0,q)*i.price),st:q<=0?'out':q<=i.reorder?'low':'ok'}}).filter(r=>f==='all'||r.st===f);
    const tot=r2(rows.reduce((a,r)=>a+r.val,0)), ret=r2(rows.reduce((a,r)=>a+r.retail,0));
    bar=searchBox('invs','Search item, SKU or barcode')+'<select data-ch="invst" aria-label="Status">'+[['all','All items'],['low','Low stock'],['out','Out of stock'],['ok','Healthy']].map(o=>'<option value="'+o[0]+'"'+(f===o[0]?' selected':'')+'>'+o[1]+'</option>').join('')+'</select>';
    body='<div class="kpis">'+kpi_('Items',rows.length)+kpi_('Stock value (cost)',money(tot))+kpi_('Stock value (selling)',money(ret))+kpi_('Low stock',rows.filter(r=>r.st==='low').length,'')+kpi_('Out of stock',rows.filter(r=>r.st==='out').length,rows.some(r=>r.st==='out')?'neg':'')+'</div>'+
      tbl([{h:'Item',r:r=>'<b>'+esc(r.i.name)+'</b><br><span class="muted sm">'+esc(r.i.sku||'')+'</span>'},{h:'Category',r:r=>esc(catName(r.i.categoryId))},{h:'On hand',cls:'r',r:r=>r.q+' '+esc(unitOf(r.i))},{h:'Reorder at',cls:'r',r:r=>r.i.reorder},
        {h:'Status',r:r=>r.st==='out'?badge('Out','bad'):r.st==='low'?badge('Low','warn'):badge('OK','ok')},{h:'Cost / unit',cls:'r',r:r=>fmt(r.i.cost)},{h:'Value (cost)',cls:'r',r:r=>fmt(r.val)},{h:'Value (selling)',cls:'r',r:r=>fmt(r.retail)}],rows,'No items match.');
    csv=[['item','sku','category','on hand','unit','reorder at','status','cost','value at cost','value at selling price']].concat(rows.map(r=>[r.i.name,r.i.sku,catName(r.i.categoryId),r.q,unitOf(r.i),r.i.reorder,r.st,r.i.cost,r.val,r.retail]));
  }else if(tab==='inv-activity'){
    const items=DB.items.filter(i=>i.active&&i.track).sort((a,b)=>a.name.localeCompare(b.name)), id=UIS.iaItem&&items.some(i=>i.id===UIS.iaItem)?UIS.iaItem:(items[0]||{}).id, it=itemById(id), rg=invRange();
    bar='<select data-ch="iaitem" aria-label="Item">'+items.map(i=>'<option value="'+i.id+'"'+(i.id===id?' selected':'')+'>'+esc(i.name)+'</option>').join('')+'</select>'+invRangeBar();
    if(!it){body='<div class="empty">No tracked items yet.</div>'}
    else{
      const all=DB.movements.filter(m=>m.itemId===id), after=all.filter(m=>m.ts>rg[1]).reduce((a,m)=>a+m.qty,0), inR=all.filter(m=>m.ts>=rg[0]&&m.ts<=rg[1]).sort((a,b)=>a.ts-b.ts);
      const closing=rq(stockOf(id)-after), inQ=rq(inR.filter(m=>m.qty>0).reduce((a,m)=>a+m.qty,0)), outQ=rq(-inR.filter(m=>m.qty<0).reduce((a,m)=>a+m.qty,0)), opening=rq(closing-inQ+outQ);
      let run=opening; const rows=inR.map(m=>{run=rq(run+m.qty);return {m:m,run:run}});
      body='<div class="kpis">'+kpi_('Opening',opening+' '+unitOf(it))+kpi_('In',inQ)+kpi_('Out',outQ)+kpi_('Closing',closing+' '+unitOf(it))+'</div>'+
        tbl([{h:'When',r:r=>fmtDT(r.m.ts)},{h:'Type',r:r=>esc(MOVE_LABEL[r.m.type]||r.m.type)},{h:'Reference',r:r=>esc(r.m.ref||'')+(r.m.note?' <span class="muted sm">'+esc(r.m.note)+'</span>':'')},{h:'In',cls:'r',r:r=>r.m.qty>0?r.m.qty:''},{h:'Out',cls:'r',r:r=>r.m.qty<0?-r.m.qty:''},{h:'Balance',cls:'r',r:r=>r.run},{h:'By',r:r=>esc(userName(r.m.user))}],rows,'No movement in this period.')+
        '<p class="muted sm">The system keeps the latest 5,000 stock movements. For older history use the Day Book and stock ledger.</p>';
      csv=[['when','type','reference','in','out','balance','by']].concat(rows.map(r=>[new Date(r.m.ts).toISOString(),r.m.type,r.m.ref,r.m.qty>0?r.m.qty:'',r.m.qty<0?-r.m.qty:'',r.run,userName(r.m.user)]));
    }
  }else if(tab==='inv-adjust'){
    const rg=invRange(), rows=DB.movements.filter(m=>(m.type==='adjust'||m.type==='waste')&&m.ts>=rg[0]&&m.ts<=rg[1]).sort((a,b)=>b.ts-a.ts).map(m=>{const l=byId(DB.lots,m.lotId),it=itemById(m.itemId);return {m:m,it:it,lot:l,val:r2(m.qty*(l?l.cost:(it?it.cost:0)))}});
    const lossW=r2(-rows.filter(r=>r.m.type==='waste').reduce((a,r)=>a+r.val,0)), lossA=r2(-rows.filter(r=>r.m.type==='adjust'&&r.val<0).reduce((a,r)=>a+r.val,0)), gain=r2(rows.filter(r=>r.m.type==='adjust'&&r.val>0).reduce((a,r)=>a+r.val,0));
    bar=invRangeBar();
    body='<div class="kpis">'+kpi_('Adjustments',rows.length)+kpi_('Wastage (value)',money(lossW),lossW>0?'neg':'')+kpi_('Count shortages (value)',money(lossA),lossA>0?'neg':'')+kpi_('Count gains (value)',money(gain))+'</div>'+
      tbl([{h:'When',r:r=>fmtDT(r.m.ts)},{h:'Item',r:r=>'<b>'+esc(r.it?r.it.name:'?')+'</b>'},{h:'Type',r:r=>r.m.type==='waste'?badge('Wastage','warn'):badge('Adjustment','')},{h:'Batch',r:r=>esc(r.lot?r.lot.lotNo:'—')},{h:'Qty',cls:'r',r:r=>(r.m.qty>0?'+':'')+r.m.qty},{h:'Value',cls:'r',r:r=>'<span class="'+(r.val<0?'neg':'')+'">'+fmt(r.val)+'</span>'},{h:'Reason',r:r=>esc((r.m.ref||'').replace(/^(Adjustment|Wastage): ?/,''))},{h:'By',r:r=>esc(userName(r.m.user))}],rows,'No adjustments or wastage in this period.');
    csv=[['when','item','type','batch','qty','value','reason','by']].concat(rows.map(r=>[new Date(r.m.ts).toISOString(),r.it?r.it.name:'',r.m.type,r.lot?r.lot.lotNo:'',r.m.qty,r.val,r.m.ref,userName(r.m.user)]));
  }else{ // inv-expiry
    const f=UIS.ieSt||'all', t=now(), cls=l=>!l.expiry?'none':l.expiry<t?'expired':l.expiry<=t+7*864e5?'d7':l.expiry<=t+30*864e5?'d30':l.expiry<=t+90*864e5?'d90':'later';
    const all=DB.lots.filter(l=>l.qty>0&&byId(DB.items,l.itemId)), rows=all.filter(l=>(f==='all'||cls(l)===f)&&match(UIS.q.inve,[(itemById(l.itemId)||{}).name,l.lotNo])).sort((a,b)=>(a.expiry||9e15)-(b.expiry||9e15));
    const sumV=k=>r2(all.filter(l=>cls(l)===k).reduce((a,l)=>a+l.qty*l.cost,0));
    bar=searchBox('inve','Search item or batch')+'<select data-ch="iest" aria-label="Expiry status">'+[['all','All batches'],['expired','Expired'],['d7','Within 7 days'],['d30','Within 30 days'],['d90','Within 90 days'],['later','Later'],['none','No expiry date']].map(o=>'<option value="'+o[0]+'"'+(f===o[0]?' selected':'')+'>'+o[1]+'</option>').join('')+'</select>';
    body='<div class="kpis">'+kpi_('Batches in stock',all.length)+kpi_('Expired (value)',money(sumV('expired')),sumV('expired')>0?'neg':'')+kpi_('Within 7 days',money(sumV('d7')))+kpi_('Within 30 days',money(r2(sumV('d7')+sumV('d30'))))+'</div>'+
      tbl([{h:'Item',r:r=>'<b>'+esc((itemById(r.itemId)||{}).name)+'</b>'},{h:'Batch',r:r=>esc(r.lotNo)},{h:'Received',r:r=>r.receivedAt?fmtDate(r.receivedAt):'—'},{h:'Qty',cls:'r',r:r=>r.qty},{h:'Cost',cls:'r',r:r=>fmt(r.cost)},{h:'Value',cls:'r',r:r=>fmt(r.qty*r.cost)},
        {h:'Expiry',r:r=>r.expiry?fmtDate(r.expiry):'—'},{h:'Days left',cls:'r',r:r=>r.expiry?Math.ceil((r.expiry-t)/864e5):'—'},{h:'Status',r:r=>{const c=cls(r);return c==='expired'?badge('Expired','bad'):c==='d7'?badge('≤ 7 days','bad'):c==='d30'?badge('≤ 30 days','warn'):c==='d90'?badge('≤ 90 days','warn'):c==='none'?badge('No expiry',''):badge('OK','ok')}}],rows,'No batches match.');
    csv=[['item','batch','received','qty','cost','value','expiry','days left','status']].concat(rows.map(r=>[(itemById(r.itemId)||{}).name,r.lotNo,r.receivedAt?dayKey(r.receivedAt):'',r.qty,r.cost,r2(r.qty*r.cost),r.expiry?dayKey(r.expiry):'',r.expiry?Math.ceil((r.expiry-t)/864e5):'',cls(r)]));
  }
  window._csv=csv; window._csvName='report-'+tab;
  const titles={'inv-stock':'Stock report','inv-activity':'Item activity','inv-adjust':'Stock adjustments','inv-expiry':'Expiry / batch report'};
  return head(titles[tab],'Inventory report')+reportNav(tab)+'<div class="bar">'+bar+'<span class="sp"></span>'+(csv?btn('Export CSV','rep-export'):'')+btn('Print','rep-print')+'</div>'+body;
}
C.invst=el=>{UIS.invst=el.value;render()};
C.iest=el=>{UIS.ieSt=el.value;render()};
C.iaitem=el=>{UIS.iaItem=el.value;render()};
A['rep-print']=()=>window.print();

/* ---------- account reports ---------- */
function vAccReport(tab){
  if(!can('accounts')||!DB.acc)return head('Reports','')+'<div class="empty">You do not have access to accounting reports.</div>';
  let body='',csv=null,bar='',title='';
  const m=balMap(null), sum=(root,sign)=>r2(groupLedgers(root).reduce((a,l)=>a+sign*m[l.id].close,0));
  if(tab==='acc-summary'){
    title='Accounts summary';
    const mt=plData(new Date(new Date().getFullYear(),new Date().getMonth(),1).getTime(),now()), vat=r2(-m[LID('vat_out')].close-m[LID('vat_in')].close), ag=creditAging(), owed=creditOwed();
    const rows=[['Cash & bank',sum('g_cash',1)+sum('g_bank',1)],['Receivables (debtors)',sum('g_debt',1)],['Stock at cost (books)',m[LID('stock')].close],['Payables (creditors)',sum('g_cred',-1)],[(DB.settings.taxLabel||'VAT')+' payable (output − input)',vat],['Customer advances held',DB.acc.ledgers.some(l=>l.key==='advances')?r2(-m[LID('advances')].close):0],['Net profit this month',mt.t.net]];
    body='<div class="kpis">'+rows.slice(0,4).map(r=>kpi_(r[0],money(r2(r[1])))).join('')+kpi_(rows[4][0],money(r2(rows[4][1])))+kpi_('Net profit this month',money(mt.t.net),mt.t.net<0?'neg':'pos')+'</div>'+
      '<div class="cols2"><section class="card"><h2>Position</h2>'+tbl([{h:'Account',r:r=>esc(r[0])},{h:'Balance',cls:'r',r:r=>fmt(r2(r[1]))}],rows,'')+'</section>'+
      '<section class="card"><h2>Receivables ageing</h2>'+(owed>0?mixBars(objRows(ag.tot))+tbl([{h:'Customer',r:r=>esc(r.name)},{h:'Owes',cls:'r',r:r=>fmt(r.bal)},{h:'60+ days',cls:'r',r:r=>r.old>0?'<span class="neg">'+fmt(r.old)+'</span>':'—'}],ag.rows.slice(0,8),''):'<div class="empty">No customer credit outstanding.</div>')+'<p class="sm"><a href="#/accounts/outstanding">All receivables and payables</a></p></section></div>';
    csv=[['account','balance']].concat(rows.map(r=>[r[0],r2(r[1])]));
  }else if(tab==='acc-stock'){
    title='Stock report (books)';
    const cats={}; DB.items.filter(i=>i.track).forEach(i=>{const k=catName(i.categoryId),q=stockOf(i.id),v=lotValue(i.id);const a=cats[k]||(cats[k]={k:k,n:0,q:0,v:0});a.n++;a.q=rq(a.q+Math.max(0,q));a.v=r2(a.v+v)});
    const rows=Object.keys(cats).map(k=>cats[k]).sort((a,b)=>b.v-a.v), inv=r2(rows.reduce((a,r)=>a+r.v,0)), led=r2(m[LID('stock')].close), diff=r2(led-inv);
    body='<div class="kpis">'+kpi_('Stock value (item batches)',money(inv))+kpi_('Stock in the books (ledger)',money(led))+kpi_('Difference',money(diff),Math.abs(diff)>1?'neg':'pos')+'</div>'+
      tbl([{h:'Category',r:r=>'<b>'+esc(r.k)+'</b>'},{h:'Items',cls:'r',r:r=>r.n},{h:'Units on hand',cls:'r',r:r=>r.q},{h:'Value at cost',cls:'r',r:r=>fmt(r.v)},{h:'Share',cls:'r',r:r=>inv>0?Math.round(r.v/inv*100)+'%':'—'}],rows,'No tracked items.')+
      '<p class="muted sm">'+(Math.abs(diff)>1?'The books and the stock batches differ. Check Accounts → Books & Checks, or post a stock revaluation.':'The stock ledger agrees with the item batches.')+' Item-level detail: <a href="#/reports/inv-stock">Stock report</a>.</p>';
    csv=[['category','items','units','value at cost']].concat(rows.map(r=>[r.k,r.n,r.q,r.v]));
  }else{
    title=(DB.settings.taxLabel||'VAT')+' summary';
    const rg=invRange(); bar=invRangeBar();
    const mo={}, key=t=>{const d=new Date(t);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')}, row=k=>mo[k]||(mo[k]={k:k,taxable:0,out:0,inn:0});
    DB.orders.filter(o=>o.ts>=rg[0]&&o.ts<=rg[1]&&(o.status==='completed'||o.status==='refunded')).forEach(o=>{const r=row(key(o.ts)),sg=o.status==='refunded'?0:1;r.taxable=r2(r.taxable+sg*(o.total-o.vat));r.out=r2(r.out+sg*o.vat)});
    const vin=LID('vat_in'); DB.acc.vouchers.forEach(v=>{if(v.cancelled||v.date<rg[0]||v.date>rg[1])return;v.entries.forEach(e=>{if(e.ledgerId===vin){const r=row(key(v.date));r.inn=r2(r.inn+e.dr-e.cr)}})});
    const rows=Object.keys(mo).sort().map(k=>mo[k]), T={t:r2(rows.reduce((a,r)=>a+r.taxable,0)),o:r2(rows.reduce((a,r)=>a+r.out,0)),i:r2(rows.reduce((a,r)=>a+r.inn,0))};
    body=(DB.settings.vatPct>0?'':'<p class="muted">Tax is switched off for this business (rate 0%).</p>')+'<div class="kpis">'+kpi_('Taxable sales (ex-tax)',money(T.t))+kpi_('Output tax (on sales)',money(T.o))+kpi_('Input tax (on purchases)',money(T.i))+kpi_('Net payable',money(r2(T.o-T.i)),T.o-T.i>0?'neg':'pos')+'</div>'+
      tbl([{h:'Month',r:r=>'<b>'+esc(r.k)+'</b>'},{h:'Taxable sales',cls:'r',r:r=>fmt(r.taxable)},{h:'Output tax',cls:'r',r:r=>fmt(r.out)},{h:'Input tax',cls:'r',r:r=>fmt(r.inn)},{h:'Net payable',cls:'r',r:r=>fmt(r2(r.out-r.inn))}],rows,'No sales in this period.')+
      '<p class="muted sm">Refunded bills are excluded. This is a summary to help you prepare your return, not the return itself.</p>';
    csv=[['month','taxable sales','output tax','input tax','net payable']].concat(rows.map(r=>[r.k,r.taxable,r.out,r.inn,r2(r.out-r.inn)]));
  }
  window._csv=csv;window._csvName='report-'+tab;
  return head(title,'Accounts report')+reportNav(tab)+'<div class="bar">'+bar+'<span class="sp"></span>'+btn('Export CSV','rep-export')+btn('Print','rep-print')+'</div>'+body;
}
