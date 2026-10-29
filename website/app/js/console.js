'use strict';
/* Harbinger Console views. All user-supplied values pass through esc() before reaching innerHTML. */

const UIS={q:{},from:null,to:null,ordStatus:'all'};
const completed=()=>DB.orders.filter(o=>o.status==='completed');
const searchBox=(key,ph)=>'<input id="q-'+key+'" class="search" type="search" data-in="q" data-key="'+key+'" placeholder="'+esc(ph||'Search…')+'" value="'+esc(UIS.q[key]||'')+'" aria-label="'+esc(ph||'Search')+'">';
I.q=el=>{UIS.q[el.dataset.key]=el.value;render()};
const match=(q,arr)=>{q=(q||'').trim().toLowerCase();return !q||arr.some(v=>String(v==null?'':v).toLowerCase().indexOf(q)>=0)};
/* pagination: paged(key,rows) → {rows,html}; page size and page are remembered per table */
function paged(key,rows){
  const st=(UIS.pg=UIS.pg||{})[key]||(UIS.pg[key]={page:1,size:10}), pages=Math.max(1,Math.ceil(rows.length/st.size)); if(st.page>pages)st.page=pages;
  const a=(st.page-1)*st.size, b=Math.min(rows.length,a+st.size), nums=[];
  for(let p=1;p<=pages;p++)if(p<=3||p>pages-2||Math.abs(p-st.page)<=1)nums.push(p);
  const btns=nums.map((p,i)=>(i&&p-nums[i-1]>1?'<span class="muted">…</span>':'')+'<button type="button" class="pg'+(p===st.page?' on':'')+'" data-act="pg" data-id="'+key+'|'+p+'">'+p+'</button>').join('');
  return {rows:rows.slice(a,b),html:rows.length>st.size||st.size!==10?'<div class="pager"><label class="inl"><select data-ch="pgsize" data-key="'+key+'" aria-label="Rows per page">'+[10,20,50,100].map(n=>'<option'+(n===st.size?' selected':'')+'>'+n+'</option>').join('')+'</select></label><span class="muted sm">Showing '+(rows.length?a+1:0)+' to '+b+' of '+rows.length+' results</span><span class="sp"></span>'+
    '<button type="button" class="pg" data-act="pg" data-id="'+key+'|'+Math.max(1,st.page-1)+'" aria-label="Previous">‹</button>'+btns+'<button type="button" class="pg" data-act="pg" data-id="'+key+'|'+Math.min(pages,st.page+1)+'" aria-label="Next">›</button></div>':''};
}
A['pg']=d=>{const p=d.id.split('|');UIS.pg[p[0]].page=+p[1];render()};
C.pgsize=el=>{const st=UIS.pg[el.dataset.key];st.size=+el.value;st.page=1;render()};
function tabs(base,list,cur){
  return '<div class="tabs" role="tablist">'+list.map(t=>'<a role="tab" class="'+(t[0]===cur?'on':'')+'" href="#/'+base+'/'+t[0]+'">'+esc(t[1])+'</a>').join('')+'</div>';
}
const head=(title,sub,actions)=>'<div class="ph"><div><h1>'+esc(title)+'</h1>'+(sub?'<p class="muted">'+esc(sub)+'</p>':'')+'</div><div class="pa">'+(actions||'')+'</div></div>';
const btn=(label,act,id,cls)=>'<button type="button" class="btn '+(cls||'ghost')+'" data-act="'+act+'"'+(id?' data-id="'+esc(id)+'"':'')+'>'+esc(label)+'</button>';

/* ================= Catalog ================= */
function vCatalog(tab){
  tab=tab||'items';
  let body='';
  if(tab==='categories'){
    const rows=DB.categories;
    body='<div class="bar">'+btn('+ Add category','cat-edit')+'</div>'+tbl([{h:'Category',r:r=>esc(r.name)},{h:'Arabic name',r:r=>esc(r.nameAr||'—')},{h:'Items',cls:'r',r:r=>DB.items.filter(i=>i.categoryId===r.id).length},
      ...(bm('kitchen')?[{h:'KOT Printer',r:r=>r.kotPrinter?'Printer '+r.kotPrinter:'<span class="muted">—</span>'}]:[]),
      {h:'',cls:'r',r:r=>btn('Edit','cat-edit',r.id)+' '+btn('Delete','cat-del',r.id,'danger')}],rows,'No categories.');
  }else{
    const cf=UIS.q.catf||'all';
    const all_=DB.items.filter(i=>(cf==='all'||i.categoryId===cf)&&match(UIS.q.items,[i.name,i.nameAr,i.sku,i.barcode,i.size,i.brand])), pg=paged('items',all_), rows=pg.rows;
    body='<div class="bar">'+searchBox('items','Search name, SKU or barcode')+
      '<select data-ch="catf" aria-label="Filter by category"><option value="all">All categories</option>'+DB.categories.map(c=>'<option value="'+c.id+'"'+(cf===c.id?' selected':'')+'>'+esc(c.name)+'</option>').join('')+'</select>'+
      '<span class="sp"></span>'+btn('Import CSV','item-import')+btn('Export CSV','item-export')+btn('+ Add item','item-edit',null,'primary')+'</div>'+
      tbl([{h:'Item',r:r=>'<b>'+esc(r.name)+'</b>'+(r.nameAr?'<br><span class="muted sm">'+esc(r.nameAr)+'</span>':'')},{h:'SKU / barcode',r:r=>esc(r.sku)+'<br><span class="muted sm">'+esc(r.barcode||'')+'</span>'},
        {h:'Pack size',r:r=>esc(r.size||(r.unit&&r.weighed?'per '+r.unit:'—'))},{h:'Category',r:r=>esc(catName(r.categoryId))},{h:'Price',cls:'r',r:r=>fmt(r.price)},{h:'Cost',cls:'r',r:r=>fmt(r.cost)},
        {h:'Margin',cls:'r',r:r=>r.price>0?Math.round((r.price-r.cost)/r.price*100)+'%':'—'},{h:'Stock',cls:'r',r:r=>r.track?stockOf(r.id):'—'},
        {h:'Status',r:r=>badge(r.active?'Active':'Archived',r.active?'ok':'')},
        {h:'',cls:'r',r:r=>btn('Edit','item-edit',r.id)+' '+btn('Copy','item-dup',r.id)+' '+btn(r.active?'Archive':'Restore','item-toggle',r.id)}],rows,'No items match.')+pg.html;
  }
  return head(tr('Products'),'Items, categories and prices')+tabs('catalog',[['items','Items'],['categories','Categories']],tab)+body;
}
C.catf=el=>{UIS.q.catf=el.value;render()};
function itemForm(it){
  it=it||{active:true,tax:true,track:true,reorder:10,price:0,cost:0,categoryId:DB.categories[0]&&DB.categories[0].id};
  return '<div class="form2">'+field('Name','name',it.name,{req:1,af:1})+field('Arabic name (optional — filled automatically, you can edit it)','nameAr',it.nameAr)+field('SKU','sku',it.sku)+field('Barcode','barcode',it.barcode)+
    select('Category','categoryId',DB.categories.map(c=>[c.id,c.name]),it.categoryId)+field('Reorder level','reorder',it.reorder,{type:'number',min:0})+
    field('Price','price',it.price,{type:'number',step:'0.01',min:0})+field('Cost (optional)','cost',it.cost,{type:'number',step:'0.01',min:0})+
    select('Preferred supplier','supplierId',[['','— none —']].concat(DB.suppliers.map(s=>[s.id,s.name])),it.supplierId||'')+field('Supplier lead time (days)','leadDays',it.leadDays!=null?it.leadDays:2,{type:'number',min:0})+itemExtraFields(it)+'</div>'+
    '<div class="chks">'+check('VAT applies','tax',it.tax)+check('Track stock','track',it.track)+check('Active (sellable)','active',it.active)+itemExtraChecks(it)+'</div>';
}
function saveItem(id,d){
  const name=d.name.trim(); if(!name){toast('Name is required','err');return false}
  const price=num(d.price),cost=num(d.cost); if(price<0||cost<0){toast('Price and cost cannot be negative','err');return false}
  const sku=d.sku.trim()||('SKU'+String(DB.items.length+1).padStart(3,'0')), bc=d.barcode.trim();
  if(DB.items.some(x=>x.id!==id&&x.sku.toLowerCase()===sku.toLowerCase())){toast('SKU already exists','err');return false}
  if(bc&&DB.items.some(x=>x.id!==id&&x.barcode===bc)){toast('Barcode already exists','err');return false}
  const rec={name:name,nameAr:d.nameAr.trim(),sku:sku,barcode:bc,categoryId:d.categoryId,price:price,cost:cost,tax:!!d.tax,track:!!d.track,reorder:Math.max(0,num(d.reorder)),active:!!d.active,supplierId:d.supplierId||'',leadDays:d.leadDays===''?2:Math.max(0,Math.round(num(d.leadDays)))};
  Object.assign(rec,itemExtra(d));
  if(id){Object.assign(itemById(id),rec);audit('item.update',name)}else{rec.id=uid('i');DB.items.push(rec);audit('item.create',name)}
  save();toast('Item saved');render();
}
A['item-edit']=d=>{
  const id=d.id, it=id?itemById(id):null;
  modal({title:it?'Edit item':'New item',body:itemForm(it),wide:true,onOpen:bindArabicAuto,actions:[{label:'Cancel'},{label:'Save',cls:'primary',fn:el=>saveItem(id,formData(el))}]});
};
A['item-dup']=d=>{const it=itemById(d.id);if(!it)return;const c=Object.assign({},it,{id:uid('i'),name:it.name+' (copy)',sku:it.sku+'-C',barcode:''});DB.items.push(c);save();toast('Duplicated');render()};
A['item-toggle']=d=>{const it=itemById(d.id);it.active=!it.active;audit('item.toggle',it.name);save();render()};
A['item-export']=()=>downloadCSV('items',[['name','sku','barcode','category','price','cost','reorder','vat','active']].concat(DB.items.map(i=>[i.name,i.sku,i.barcode,catName(i.categoryId),i.price,i.cost,i.reorder,i.tax?1:0,i.active?1:0])));
A['item-import']=()=>{
  modal({title:'Import items (CSV)',body:'<p class="muted">Columns: <code>name, sku, barcode, category, price, cost</code> (header row required). Existing SKUs are updated; new categories are created.</p><input type="file" name="f" accept=".csv,text/csv" autofocus>',
    actions:[{label:'Cancel'},{label:'Import',cls:'primary',fn:el=>{
      const f=$('[name=f]',el).files[0]; if(!f){toast('Choose a CSV file','err');return false}
      if(f.size>2e6){toast('File too large (2 MB max)','err');return false}
      const rd=new FileReader(); rd.onload=()=>{
        const rows=parseCSV(String(rd.result).replace(/^﻿/,'')); if(rows.length<2){toast('No data rows found','err');return}
        const h=rows[0].map(x=>x.trim().toLowerCase()), ix=n=>h.indexOf(n);
        if(ix('name')<0||ix('price')<0){toast('CSV needs at least name and price columns','err');return}
        let add=0,upd=0,bad=0;
        rows.slice(1).forEach(r=>{
          const name=(r[ix('name')]||'').trim(), price=num(r[ix('price')]); if(!name||price<0){bad++;return}
          const cn=ix('category')>=0?(r[ix('category')]||'').trim():''; let cat=DB.categories.find(c=>c.name.toLowerCase()===cn.toLowerCase());
          if(!cat){cat=cn?{id:uid('c'),name:cn,nameAr:''}:DB.categories[0]; if(cn)DB.categories.push(cat)}
          const sku=(ix('sku')>=0&&(r[ix('sku')]||'').trim())||('SKU'+String(DB.items.length+add+1).padStart(3,'0'));
          const ex=DB.items.find(x=>x.sku.toLowerCase()===sku.toLowerCase());
          const rec={name:name,sku:sku,barcode:ix('barcode')>=0?(r[ix('barcode')]||'').trim():'',categoryId:cat.id,price:price,cost:ix('cost')>=0?num(r[ix('cost')]):0};
          if(ex){Object.assign(ex,rec);upd++}else{DB.items.push(Object.assign({id:uid('i'),nameAr:'',tax:true,track:true,reorder:10,active:true},rec));add++}
        });
        audit('item.import',add+' added, '+upd+' updated'); save(); toast('Imported: '+add+' new, '+upd+' updated'+(bad?', '+bad+' skipped':'')); render();
      };
      rd.readAsText(f);
    }}]});
};
A['cat-edit']=d=>{
  const c=d.id?byId(DB.categories,d.id):null;
  const kp=DB.settings.kotPrinters||4;
  const printerSel=bm('kitchen')?'<span></span>'+select('KOT Printer','kotPrinter',[['','— None —']].concat(Array.from({length:kp},(_,i)=>[(i+1).toString(),'Printer '+(i+1)])),c&&c.kotPrinter?String(c.kotPrinter):''):'';
  modal({title:c?'Edit category':'New category',body:'<div class="form2">'+field('Name','name',c&&c.name,{req:1,af:1})+field('Arabic name','nameAr',c&&c.nameAr)+printerSel+'</div>',
    enter:el=>$('.btn.primary',el).click(),
    actions:[{label:'Cancel'},{label:'Save',cls:'primary',fn:el=>{const f=formData(el),n=f.name.trim();if(!n){toast('Name required','err');return false}
      const kotP=bm('kitchen')&&f.kotPrinter?parseInt(f.kotPrinter,10):undefined;
      if(c){c.name=n;c.nameAr=f.nameAr.trim();if(bm('kitchen'))c.kotPrinter=kotP}else DB.categories.push({id:uid('c'),name:n,nameAr:f.nameAr.trim(),kotPrinter:kotP});save();render()}}]});
};
A['cat-kot-save']=()=>{
  const sec=document.getElementById('catKotSection'); if(!sec)return;
  const f=formData(sec);
  DB.categories.forEach(c=>{const v=f['ckp_'+c.id];c.kotPrinter=v?parseInt(v,10):undefined});
  save();toast('KOT printer mapping saved');
};
A['cat-del']=d=>{
  if(DB.items.some(i=>i.categoryId===d.id)){toast('Move or archive the items in this category first','err');return}
  confirmBox('Delete this category?',()=>{DB.categories=DB.categories.filter(c=>c.id!==d.id);save();render()},'Delete');
};

/* ================= Stock Room ================= */
function vStock(tab){
  tab=tab||'onhand'; let body='';
  const T=[['onhand','Manage Stock'],['receive','Receive'],['lots','Stock Batches'],['ledger','Stock History'],['reorder','Reorder'],['suppliers','Suppliers'],['pos','Purchase orders']].concat(bm('breakdown')?[['breakdown','Breakdown']]:[],bm('weighed')?[['scale','Weighing Management']]:[],[['count','Stock Count'],['barcodes','Barcode Config']]);
  if(tab==='onhand'){
    const all_=DB.items.filter(i=>i.track&&match(UIS.q.stock,[i.name,i.sku,i.barcode])), pg=paged('stock',all_);
    const last=id=>{const m=DB.movements.find(x=>x.itemId===id);return m?m.ts:0}, dmg=id=>rq(-DB.movements.filter(m=>m.itemId===id&&m.type==='waste').reduce((a,m)=>a+m.qty,0));
    body='<div class="bar">'+searchBox('stock','Search here…')+'<span class="sp"></span>'+btn('Export CSV','stock-export')+'</div>'+
    tbl([{h:'Product',r:r=>'<b>'+esc(r.name)+'</b><br><span class="muted sm">'+esc(r.sku||'')+'</span>'},{h:'Total',cls:'r',r:r=>stockOf(r.id)},{h:'Available',cls:'r',r:r=>sellableOf(r.id)},{h:'Damaged',cls:'r',r:r=>dmg(r.id)||'—'},{h:'Last activity',r:r=>last(r.id)?fmtDT(last(r.id)):'—'},
      {h:'Reorder at',cls:'r',r:r=>r.reorder},{h:'Value',cls:'r',r:r=>fmt(DB.lots.filter(l=>l.itemId===r.id&&l.qty>0).reduce((a,l)=>a+l.qty*l.cost,0))},
      {h:'Status',r:r=>{const s=stockOf(r.id);return s<=0?badge('Out','bad'):s<=r.reorder?badge('Low','warn'):badge('OK','ok')}},
      {h:'',cls:'r',r:r=>btn('Receive','stock-receive',r.id)+' '+btn('Adjust','stock-adjust',r.id)}],pg.rows,'No data found.')+pg.html;
  }else if(tab==='receive'){
    body='<div class="card narrow"><h2>Receive stock</h2><p class="muted">Record a delivery as a new lot with expiry and cost.</p><div id="recvForm">'+recvForm()+'</div>'+btn('Receive stock','do-receive',null,'primary')+'</div>';
  }else if(tab==='lots'){
    const rows=DB.lots.filter(l=>l.qty!==0&&match(UIS.q.lots,[(itemById(l.itemId)||{}).name,l.lotNo,(itemById(l.itemId)||{}).barcode])).sort((a,b)=>(a.expiry||9e15)-(b.expiry||9e15)), pg=paged('lots',rows);
    const dmg=l=>rq(-DB.movements.filter(m=>m.lotId===l.id&&m.type==='waste').reduce((a,m)=>a+m.qty,0)), upd=l=>Math.max(l.receivedAt||0,...DB.movements.filter(m=>m.lotId===l.id).map(m=>m.ts));
    body='<div class="bar">'+searchBox('lots','Search here…')+'<span class="sp"></span><a class="btn primary" href="#/stock/receive">+ Add</a></div>'+tbl([{h:'Product name',r:r=>'<b>'+esc((itemById(r.itemId)||{}).name||'?')+'</b>'},{h:'Batch number',r:r=>esc(r.lotNo)},{h:'Bar code',r:r=>esc((itemById(r.itemId)||{}).barcode||'—')},{h:'Total stock',cls:'r',r:r=>r.qty},{h:'Damaged stock',cls:'r',r:r=>dmg(r)||'—'},
      {h:'Expiry',r:r=>r.expiry?(r.expiry<now()?badge(fmtDate(r.expiry)+' · expired','bad'):r.expiry<daysFromNow(14)?badge(fmtDate(r.expiry)+' · soon','warn'):fmtDate(r.expiry)):'—'},{h:'Created at',r:r=>r.receivedAt?fmtDT(r.receivedAt):'—'},{h:'Updated at',r:r=>fmtDT(upd(r))}],pg.rows,'No data found.')+pg.html;
  }else if(tab==='ledger'){
    const rows=DB.movements.filter(m=>match(UIS.q.ledger,[(itemById(m.itemId)||{}).name,m.ref,m.type])).slice(0,300);
    body='<div class="bar">'+searchBox('ledger','Search item, type or reference')+'<span class="sp"></span>'+btn('Export CSV','ledger-export')+'</div>'+tbl([{h:'When',r:r=>fmtDT(r.ts)},{h:'Item',r:r=>esc((itemById(r.itemId)||{}).name||'?')},{h:'Type',r:r=>badge(r.type,r.qty>0?'ok':'')},{h:'Qty',cls:'r',r:r=>(r.qty>0?'+':'')+r.qty},{h:'Ref',r:r=>esc(r.ref)+(r.note?' · '+esc(r.note):'')},{h:'By',r:r=>esc(userName(r.user))}],rows,'No movements yet.');
  }else if(tab==='reorder'){
    body=vReorder();
  }else if(tab==='count'){body=vStockCount();
  }else if(tab==='breakdown'){body=vBreakdown();
  }else if(tab==='scale'){body=vScaleSetup();
  }else if(tab==='barcodes'){body=vBarcodes();
  }else if(tab==='suppliers'){
    body='<div class="bar"><span class="sp"></span>'+btn('+ Add supplier','sup-edit',null,'primary')+'</div>'+tbl([{h:'Supplier',r:r=>'<b>'+esc(r.name)+'</b>'},{h:'Phone',r:r=>esc(r.phone||'—')},{h:'Email',r:r=>esc(r.email||'—')},{h:'Terms',r:r=>esc(r.terms||'—')},{h:'',cls:'r',r:r=>btn('Edit','sup-edit',r.id)+' '+btn('Delete','sup-del',r.id,'danger')}],DB.suppliers,'No suppliers.');
  }else{
    body='<div class="bar"><span class="sp"></span>'+btn('+ New purchase order','po-edit',null,'primary')+'</div>'+tbl([{h:'PO',r:r=>'<b>'+esc(r.no)+'</b>'},{h:'Supplier',r:r=>esc((byId(DB.suppliers,r.supplierId)||{}).name||'?')},{h:'Created',r:r=>fmtDate(r.ts)},{h:'Lines',cls:'r',r:r=>r.lines.length},
      {h:'Total',cls:'r',r:r=>fmt(r.lines.reduce((a,l)=>a+l.qty*l.cost,0))},{h:'Status',r:r=>badge(r.status,r.status==='received'?'ok':r.status==='ordered'?'warn':'')},
      {h:'',cls:'r',r:r=>(r.status==='draft'?btn('Mark ordered','po-status',r.id+'|ordered'):'')+(r.status==='ordered'?' '+btn('Receive all','po-receive',r.id,'primary'):'')+(r.status!=='received'?' '+btn('Delete','po-del',r.id,'danger'):'')}],DB.pos.slice().reverse(),'No purchase orders.');
  }
  return head('Stock Room','Lots, receiving, suppliers and purchase orders')+tabs('stock',T,tab)+body;
}
function recvForm(itemId){
  return '<div class="form2">'+select('Item','itemId',DB.items.filter(i=>i.track).map(i=>[i.id,i.name]),itemId)+field('Quantity','qty','',{type:'number',step:'any',min:0})+
    field('Unit cost','cost','',{type:'number',step:'0.01',min:0})+field('Lot number','lotNo','')+field('Expiry date','expiry','',{type:'date'})+field('Reference (invoice no.)','ref','')+
    select('Supplier (for accounts)','supplierId',[['','— none (GRN clearing) —']].concat(DB.suppliers.map(s=>[s.id,s.name])),'')+'</div>';
}
function doReceive(f){
  const it=itemById(f.itemId), qty=num(f.qty); if(!it||qty<=0){toast('Choose an item and a quantity above zero','err');return false}
  const cost=f.cost===''?it.cost:num(f.cost); if(cost<0){toast('Cost cannot be negative','err');return false}
  receiveLot(it.id,f.lotNo.trim(),f.expiry?new Date(f.expiry+'T23:59:59').getTime():null,qty,cost,f.ref.trim()||'Receive');
  postStockReceive(it,qty,cost,f.supplierId,f.ref.trim());
  if(f.cost!=='')it.cost=cost; audit('stock.receive',it.name+' +'+qty); save(); toast('Received '+qty+' × '+it.name); return true;
}
A['do-receive']=()=>{const r=$('#recvForm');if(doReceive(formData(r))){$('#recvForm').innerHTML=recvForm()}};
A['stock-receive']=d=>modal({title:'Receive stock',body:recvForm(d.id),actions:[{label:'Cancel'},{label:'Receive',cls:'primary',fn:el=>{if(!doReceive(formData(el)))return false;render()}}]});
A['stock-adjust']=d=>{
  const it=itemById(d.id);
  modal({title:'Adjust — '+it.name,body:'<p class="muted">On hand: <b>'+stockOf(it.id)+'</b></p><div class="form2">'+select('Type','kind',[['count','Set counted quantity'],['waste','Waste / spoilage'],['add','Add (found)'],['remove','Remove (loss)']],'count')+field('Quantity','qty','',{type:'number',step:'any',min:0,af:1})+'</div>'+field('Reason (required)','reason',''),
    actions:[{label:'Cancel'},{label:'Apply',cls:'primary',fn:el=>{
      const f=formData(el), q=num(f.qty), reason=f.reason.trim();
      if(f.qty===''||q<0){toast('Enter a quantity','err');return false} if(!reason){toast('A reason is required','err');return false}
      let delta=f.kind==='count'?rq(q-stockOf(it.id)):(f.kind==='add'?q:-q);
      if(delta===0){toast('No change');return}
      if(Math.abs(delta*it.cost)>200&&!can('discount_override')){toast('Large adjustments need a manager','err');return false}
      if(delta>0){receiveLot(it.id,'ADJ-'+Date.now().toString(36),null,delta,it.cost,'Adjustment: '+reason);DB.movements[0].type='adjust';postStockValue(r2(delta*it.cost),'Stock adjustment (+) '+it.name+': '+reason)}
      else{
        const avail=lotsOf(it.id).filter(l=>l.qty>0).reduce((a,l)=>a+l.qty,0);
        if(-delta>avail){toast('Not enough stock to remove that quantity','err');return false}
        let need=-delta,val=0;
        lotsOf(it.id).forEach(l=>{if(need<=0||l.qty<=0)return;const t=Math.min(l.qty,need);l.qty=rq(l.qty-t);need=rq(need-t);val=r2(val+t*l.cost);logMove(it.id,l.id,f.kind==='waste'?'waste':'adjust',-t,'Adjustment: '+reason,'')});
        postStockValue(-val,(f.kind==='waste'?'Wastage ':'Stock adjustment (−) ')+it.name+': '+reason);
      }
      audit('stock.adjust',it.name+' '+delta+' ('+reason+')'); save(); toast('Stock updated'); render();
    }}]});
};
A['stock-export']=()=>downloadCSV('stock-on-hand',[['item','sku','on hand','reorder','value']].concat(DB.items.filter(i=>i.track).map(i=>[i.name,i.sku,stockOf(i.id),i.reorder,r2(DB.lots.filter(l=>l.itemId===i.id&&l.qty>0).reduce((a,l)=>a+l.qty*l.cost,0))])));
A['ledger-export']=()=>downloadCSV('stock-ledger',[['when','item','type','qty','ref','by']].concat(DB.movements.map(m=>[new Date(m.ts).toISOString(),(itemById(m.itemId)||{}).name,m.type,m.qty,m.ref,userName(m.user)])));
A['sup-edit']=d=>{
  const s=d.id?byId(DB.suppliers,d.id):null;
  modal({title:s?'Edit supplier':'New supplier',body:'<div class="form2">'+field('Name','name',s&&s.name,{req:1,af:1})+field('Phone','phone',s&&s.phone)+field('Email','email',s&&s.email,{type:'email'})+field('Payment terms','terms',s&&s.terms)+'</div>',
    actions:[{label:'Cancel'},{label:'Save',cls:'primary',fn:el=>{const f=formData(el);if(!f.name.trim()){toast('Name required','err');return false}
      const rec={name:f.name.trim(),phone:f.phone.trim(),email:f.email.trim(),terms:f.terms.trim()};if(s)Object.assign(s,rec);else DB.suppliers.push(Object.assign({id:uid('s')},rec));
      DB.suppliers.forEach(ensureSupplierLedger);const sl=DB.acc.ledgers.find(l=>s&&l.supplierId===s.id);if(sl)sl.name=rec.name;save();render()}}]});
};
A['sup-del']=d=>{if(DB.pos.some(p=>p.supplierId===d.id)){toast('Supplier has purchase orders','err');return}confirmBox('Delete this supplier?',()=>{DB.suppliers=DB.suppliers.filter(s=>s.id!==d.id);save();render()},'Delete')};
let _poLines=[];
function poLinesHtml(){
  return _poLines.length?tbl([{h:'Item',r:r=>esc((itemById(r.itemId)||{}).name)},{h:'Qty',cls:'r',r:r=>r.qty},{h:'Unit cost',cls:'r',r:r=>fmt(r.cost)}],_poLines):'<div class="empty">No lines yet.</div>';
}
A['po-edit']=()=>{
  if(!DB.suppliers.length){toast('Add a supplier first','err');return}
  _poLines=[];
  const draw=el=>{$('#poLines',el).innerHTML=poLinesHtml()};
  modal({title:'New purchase order',wide:true,sticky:true,body:select('Supplier','supplierId',DB.suppliers.map(s=>[s.id,s.name]),'')+
    '<div class="form2 mt">'+select('Item','itemId',DB.items.filter(i=>i.track).map(i=>[i.id,i.name]),'')+field('Qty','qty','',{type:'number',step:'any',min:0})+field('Unit cost','cost','',{type:'number',step:'0.01',min:0})+'<div class="end"><button type="button" class="btn ghost" id="poAdd">Add line</button></div></div><div id="poLines">'+poLinesHtml()+'</div>',
    onOpen:el=>$('#poAdd',el).addEventListener('click',()=>{const f=formData(el),it=itemById(f.itemId),q=num(f.qty);if(!it||q<=0){toast('Choose item and quantity','err');return}
      _poLines.push({itemId:it.id,qty:q,cost:f.cost===''?it.cost:num(f.cost)});draw(el)}),
    actions:[{label:'Cancel'},{label:'Save draft',cls:'primary',fn:el=>{if(!_poLines.length){toast('Add at least one line','err');return false}
      DB.seq.po++;DB.pos.push({id:uid('po'),no:'PO-'+String(DB.seq.po).padStart(4,'0'),supplierId:formData(el).supplierId,ts:now(),status:'draft',lines:_poLines.slice()});audit('po.create','PO-'+DB.seq.po);save();render()}}]});
};
A['po-status']=d=>{const p=d.id.split('|');const po=byId(DB.pos,p[0]);po.status=p[1];save();render()};
A['po-del']=d=>confirmBox('Delete this purchase order?',()=>{DB.pos=DB.pos.filter(p=>p.id!==d.id);save();render()},'Delete');
A['po-receive']=d=>{const po=byId(DB.pos,d.id);if(po.status==='received')return;po.lines.forEach(l=>receiveLot(l.itemId,po.no,null,l.qty,l.cost,po.no));po.status='received';postPurchase(po);audit('po.receive',po.no);save();toast(po.no+' received into stock');render()};

/* ================= Guests ================= */
const gTabs=()=>[['directory','Directory'],['segments','Segments & win-back']].concat(bm('credit')?[['credit','Credit accounts']]:[]);
function vGuests(tab){
  if(tab==='segments')return head('Guests','Who to reward and who to win back')+tabs('guests',gTabs(),'segments')+vSegments();
  if(tab==='credit'&&bm('credit'))return head('Guests','Credit accounts and customer balances')+tabs('guests',gTabs(),'credit')+vCreditBook();
  const CB=bm('credit')?creditBalances():{};
  const rows0=DB.customers.filter(c=>match(UIS.q.guests,[c.name,c.phone,c.email])), pg=paged('guests',rows0), rows=pg.rows;
  return head('Guests','Directory and loyalty')+tabs('guests',gTabs(),'directory')+'<div class="bar">'+searchBox('guests','Search name, phone or email')+'<span class="sp"></span>'+btn('Export CSV','guest-export')+btn('+ Add guest','guest-edit',null,'primary')+'</div>'+
    tbl([{h:'Customer ID',r:r=>'<span class="muted">CU-'+esc(String(r.id).replace(/[^A-Za-z0-9]/g,'').slice(-6).toUpperCase())+'</span>'},{h:'Customer',r:r=>'<b>'+esc(r.name)+'</b>'+(r.notes?'<br><span class="muted sm">'+esc(r.notes)+'</span>':'')},{h:'Phone',r:r=>esc(r.phone||'—')},{h:'Registered on',r:r=>r.created?fmtDT(r.created):'—'},{h:'Visits',cls:'r',r:r=>r.visits},{h:'Spend',cls:'r',r:r=>fmt(r.spend)},{h:'Points',cls:'r',r:r=>r.points},{h:'Status',r:r=>r.inactive?badge('Inactive',''):badge('Active','ok')},
      ...(bm('credit')?[{h:'Owes',cls:'r',r:r=>{const b=CB[r.id]||0;return b>0.004?'<b class="neg">'+fmt(b)+'</b>':'—'}}]:[]),
      {h:'',cls:'r',r:r=>btn('View','guest-view',r.id)+' '+btn('Edit','guest-edit',r.id)}],rows,'No guests match.')+pg.html;
}
A['guest-export']=()=>downloadCSV('guests',[['name','phone','email','visits','spend','points']].concat(DB.customers.map(c=>[c.name,c.phone,c.email,c.visits,c.spend,c.points])));
function guestForm(c){return '<div class="form2">'+field('Name','name',c&&c.name,{req:1,af:1})+field('Phone','phone',c&&c.phone,{type:'tel'})+field('Email','email',c&&c.email,{type:'email'})+field('Notes','notes',c&&c.notes)+guestExtraFields(c)+'</div>'}
function saveGuest(c,f,after){
  const name=f.name.trim(); if(!name){toast('Name required','err');return false}
  const phone=f.phone.trim(); if(phone&&DB.customers.some(x=>x!==c&&x.phone===phone)){toast('That phone number already exists','err');return false}
  const rec=Object.assign({name:name,phone:phone,email:f.email.trim(),notes:f.notes.trim()},guestExtra(f));
  let g=c; if(c)Object.assign(c,rec);else{g=Object.assign({id:uid('g'),points:0,visits:0,spend:0,created:now()},rec);DB.customers.push(g)}
  save();toast('Guest saved'); if(after)after(g); else render();
}
A['guest-edit']=d=>{const c=d.id?byId(DB.customers,d.id):null;modal({title:c?'Edit guest':'New guest',body:guestForm(c),actions:[{label:'Cancel'},{label:'Save',cls:'primary',fn:el=>saveGuest(c,formData(el))}]})};
A['guest-view']=d=>{
  const c=byId(DB.customers,d.id), ords=DB.orders.filter(o=>o.customerId===c.id).reverse().slice(0,20);
  modal({title:c.name,wide:true,body:'<div class="kpis sm"><div class="kpi"><span class="kl">Points</span><strong>'+c.points+'</strong></div><div class="kpi"><span class="kl">Visits</span><strong>'+c.visits+'</strong></div><div class="kpi"><span class="kl">Spend</span><strong>'+money(c.spend)+'</strong></div></div>'+
    tbl([{h:'#',r:r=>esc(r.no)},{h:'When',r:r=>fmtDT(r.ts)},{h:'Total',cls:'r',r:r=>fmt(r.total)},{h:'Status',r:r=>badge(r.status,r.status==='completed'?'ok':'bad')}],ords,'No orders yet.'),
    actions:can('discount_override')?[{label:'Adjust points',keep:true,fn:()=>{closeModal();A['guest-points']({id:c.id});return false}},{label:'Close'}]:[{label:'Close'}]});
};
A['guest-points']=d=>{const c=byId(DB.customers,d.id);modal({title:'Adjust points — '+c.name,body:field('Points change (+/−)','delta','',{type:'number',step:'1',af:1})+field('Reason','reason',''),
  actions:[{label:'Cancel'},{label:'Apply',cls:'primary',fn:el=>{const f=formData(el),n=Math.round(num(f.delta));if(!n||!f.reason.trim()){toast('Enter points and a reason','err');return false}
    if(c.points+n<0){toast('Balance cannot go below zero','err');return false}c.points+=n;audit('points.adjust',c.name+' '+n+' ('+f.reason.trim()+')');save();toast('Points updated');render()}}]})};

/* ================= Promotions ================= */
function vPromos(tab){
  tab=tab||'offers'; let body='';
  const today=dayKey(now());
  if(tab==='codes'){
    const rows=DB.codes.filter(c=>match(UIS.q.codes,[c.code,c.name])).slice().reverse(), st=c=>!c.active?badge('Off',''):(c.expiry&&c.expiry<today)?badge('Expired','bad'):(c.limit&&c.used>=c.limit)?badge('Used up','warn'):badge('Active','ok');
    body='<div class="bar">'+searchBox('codes','Search here…')+'<span class="sp"></span>'+btn('+ Add','code-edit',null,'primary')+'</div>'+tbl([{h:'Code',r:r=>'<b>'+esc(r.code)+'</b>'},{h:'Name',r:r=>esc(r.name||'—')},{h:'Discount',r:r=>(r.type==='pct'?r.value+'%':money(r.value))+(r.min?'<br><span class="muted sm">min spend '+fmt(r.min)+'</span>':'')},
      {h:'Validity',r:r=>r.expiry?'until '+esc(r.expiry):'No expiry'},{h:'Used / limit',r:r=>r.used+' / '+(r.limit||'∞')},{h:'Status',r:r=>st(r)},{h:'Created',r:r=>r.created?fmtDate(r.created):'—'},{h:'',cls:'r',r:r=>btn(r.active?'Turn off':'Turn on','code-toggle',r.id)+' '+btn('Edit','code-edit',r.id)+' '+btn('Delete','code-del',r.id,'danger')}],rows,'No data found.');
  }else{
    const rows=DB.offers.filter(o=>match(UIS.q.offers,[o.name,o.type,catName(o.categoryId)])).slice().reverse();
    body='<div class="bar">'+searchBox('offers','Search here…')+'<p class="muted sm">The best applicable automatic offer is applied at the register.</p><span class="sp"></span>'+btn('+ Add','offer-edit',null,'primary')+'</div>'+tbl([{h:'Title',r:r=>'<b>'+esc(r.name)+'</b>'+(r.startTime&&r.endTime?'<br><span class="muted sm">'+r.startTime+'–'+r.endTime+' daily</span>':'')},
      {h:'Product',r:r=>r.type==='cat_pct'?esc(catName(r.categoryId)):'Whole order'+(r.min?'<br><span class="muted sm">min spend '+fmt(r.min)+'</span>':'')},{h:'Discount type',r:r=>r.type==='order_pct'?r.value+'% off':r.type==='order_amt'?money(r.value)+' off':r.value+'% off category'},
      {h:'Valid from',r:r=>r.startDate?esc(r.startDate):'—'},{h:'Valid until',r:r=>r.endDate?esc(r.endDate):'—'},{h:'Status',r:r=>offerActive(r)?badge('Live now','ok'):badge(r.active?'Scheduled':'Off','')},{h:'Created',r:r=>r.created?fmtDate(r.created):'—'},
      {h:'',cls:'r',r:r=>btn(r.active?'Turn off':'Turn on','offer-toggle',r.id)+' '+btn('Edit','offer-edit',r.id)+' '+btn('Delete','offer-del',r.id,'danger')}],rows,'No data found.');
  }
  return head('Promotions','Automatic offers and promo codes')+tabs('promos',[['offers','Offers'],['codes','Promo codes']],tab)+body;
}
A['offer-edit']=d=>{
  const o=d.id?byId(DB.offers,d.id):{type:'order_pct',value:10,min:0,active:true,categoryId:DB.categories[0]&&DB.categories[0].id};
  modal({title:d.id?'Edit offer':'New offer',wide:true,body:'<div class="form2">'+field('Name','name',o.name,{req:1,af:1})+select('Type','type',[['order_pct','% off whole order'],['order_amt','Amount off whole order'],['cat_pct','% off a category']],o.type)+
    field('Value','value',o.value,{type:'number',step:'0.01',min:0})+field('Minimum spend','min',o.min,{type:'number',step:'0.01',min:0})+select('Category (for category offers)','categoryId',DB.categories.map(c=>[c.id,c.name]),o.categoryId)+'<span></span>'+
    field('Daily start time','startTime',o.startTime,{type:'time'})+field('Daily end time','endTime',o.endTime,{type:'time'})+field('Start date','startDate',o.startDate,{type:'date'})+field('End date','endDate',o.endDate,{type:'date'})+'</div>'+check('Active','active',o.active),
    actions:[{label:'Cancel'},{label:'Save',cls:'primary',fn:el=>{const f=formData(el),v=num(f.value);if(!f.name.trim()||v<=0){toast('Name and a value above zero are required','err');return false}
      if(f.type!=='order_amt'&&v>100){toast('Percent cannot exceed 100','err');return false}
      if((f.startTime&&!f.endTime)||(!f.startTime&&f.endTime)){toast('Set both start and end time','err');return false}
      const rec={name:f.name.trim(),type:f.type,value:v,min:num(f.min),categoryId:f.categoryId,startTime:f.startTime,endTime:f.endTime,startDate:f.startDate,endDate:f.endDate,active:!!f.active};
      if(d.id)Object.assign(o,rec);else DB.offers.push(Object.assign({id:uid('o'),created:now()},rec));save();render()}}]});
};
A['offer-toggle']=d=>{const o=byId(DB.offers,d.id);if(o){o.active=!o.active;save();render()}};
A['code-toggle']=d=>{const c=byId(DB.codes,d.id);if(c){c.active=!c.active;save();render()}};
A['offer-del']=d=>confirmBox('Delete this offer?',()=>{DB.offers=DB.offers.filter(o=>o.id!==d.id);save();render()},'Delete');
A['code-edit']=d=>{
  const c=d.id?byId(DB.codes,d.id):{type:'pct',value:10,min:0,limit:0,active:true};
  modal({title:d.id?'Edit code':'New code',body:'<div class="form2">'+field('Code','code',c.code,{req:1,af:1})+field('Name','name',c.name,{max:40})+select('Type','type',[['pct','Percent'],['amt','Fixed amount']],c.type)+field('Value','value',c.value,{type:'number',step:'0.01',min:0})+field('Minimum spend','min',c.min,{type:'number',step:'0.01',min:0})+
    field('Usage limit (0 = unlimited)','limit',c.limit,{type:'number',min:0})+field('Expiry date','expiry',c.expiry,{type:'date'})+'</div>'+check('Active','active',c.active),
    actions:[{label:'Cancel'},{label:'Save',cls:'primary',fn:el=>{const f=formData(el),code=f.code.trim().toUpperCase().replace(/\s+/g,''),v=num(f.value);
      if(!code||v<=0){toast('Code and value are required','err');return false}if(f.type==='pct'&&v>100){toast('Percent cannot exceed 100','err');return false}
      if(DB.codes.some(x=>x.id!==d.id&&x.code===code)){toast('Code already exists','err');return false}
      const rec={name:(f.name||'').trim(),code:code,type:f.type,value:v,min:num(f.min),limit:Math.max(0,Math.round(num(f.limit))),expiry:f.expiry,active:!!f.active};
      if(d.id)Object.assign(c,rec);else DB.codes.push(Object.assign({id:uid('p'),used:0,created:now()},rec));save();render()}}]});
};
A['code-del']=d=>confirmBox('Delete this code?',()=>{DB.codes=DB.codes.filter(c=>c.id!==d.id);save();render()},'Delete');

/* ================= Team ================= */
function vTeamBase(){
  const roleBadge=r=>badge(roleLabel(r),r==='admin'?'warn':r==='manager'?'ok':'');
  return head('Team','People, roles and access')+'<div class="bar"><span class="sp"></span>'+btn('+ Add person','user-edit',null,'primary')+'</div>'+
    tbl([{h:'Name',r:r=>'<b>'+esc(r.name)+'</b>'},{h:'Username',r:r=>esc(r.username)},{h:'Role',r:r=>roleBadge(r.role)},{h:'Status',r:r=>badge(r.active?'Active':'Disabled',r.active?'ok':'')},{h:'',cls:'r',r:r=>btn('Edit','user-edit',r.id)}],DB.users,'No users.')+
    '<section class="card mt"><h2>Role access</h2><p class="muted sm">Cashier: Register, Guests, own Orders. Manager: everything except Team and Settings. Admin: everything. Discount caps per role are set in Settings.</p></section>';
}
A['user-edit']=d=>{
  const u=d.id?byId(DB.users,d.id):null;
  modal({title:u?'Edit person':'New person',body:'<div class="form2">'+field('Name','name',u&&u.name,{req:1,af:1})+field('Username','username',u&&u.username,{req:1})+select('Role','role',roleOptions(u),u?u.role:'cashier')+
    field('Manager PIN (4–6 digits)','pin',u&&u.pin,{max:6})+field(u?'New password (leave blank to keep)':'Password (min 8)','password','',{type:'password'})+'</div>'+check('Active','active',u?u.active:true),
    actions:[{label:'Cancel'},{label:'Save',cls:'primary',fn:el=>{
      const f=formData(el),un=f.username.trim().toLowerCase();
      if(!f.name.trim()||!/^[a-z0-9._-]{3,}$/.test(un)){toast('Name and a username (3+ letters/numbers) are required','err');return false}
      if(DB.users.some(x=>x.id!==d.id&&x.username===un)){toast('Username already exists','err');return false}
      if(f.pin&&!/^\d{4,6}$/.test(f.pin)){toast('PIN must be 4–6 digits','err');return false}
      if(!u&&f.password.length<8){toast('Password must be at least 8 characters','err');return false}
      if(f.password&&f.password.length<8){toast('Password must be at least 8 characters','err');return false}
      const active=!!f.active;
      if(u&&u.role==='admin'&&(f.role!=='admin'||!active)&&DB.users.filter(x=>x.role==='admin'&&x.active&&x.id!==u.id).length===0){toast('Keep at least one active admin','err');return false}
      if(u&&u.id===ME.id&&!active){toast('You cannot disable your own account','err');return false}
      if(u&&un!==u.username&&!f.password){toast('Changing the username requires setting a new password','err');return false}
      const rec={name:f.name.trim(),username:un,role:f.role,pin:f.pin,active:active};
      if(u){Object.assign(u,rec);if(f.password)u.pass=hashPw(un,f.password)}
      else DB.users.push(Object.assign({id:uid('u'),pass:hashPw(un,f.password)},rec));
      audit('user.save',un);save();render();
    }}]});
};

/* ================= Outlets (registers) ================= */
function vOutlets(tab){
  tab=tab||'registers';
  let body='';
  if(tab==='sessions'){
    const rows=DB.sessions.slice().reverse();
    body=tbl([{h:'Register',r:r=>esc((byId(DB.counters,r.counterId)||{}).name)},{h:'Opened',r:r=>fmtDT(r.openedAt)+'<br><span class="muted sm">'+esc(userName(r.openedBy))+'</span>'},{h:'Closed',r:r=>r.closedAt?fmtDT(r.closedAt):badge('Open','ok')},
      {h:'Float',cls:'r',r:r=>fmt(r.float)},{h:'Net sales',cls:'r',r:r=>fmt(sessionStats(r).net)},{h:'Variance',cls:'r',r:r=>r.closedAt?'<span class="'+(Math.abs(r.variance)>0.009?(r.variance<0?'neg':'pos'):'')+'">'+(r.variance>0?'+':'')+fmt(r.variance)+'</span>':'—'},
      {h:'',cls:'r',r:r=>btn(r.closedAt?'Z report':'Live X report','z-view',r.id)}],rows,'No register sessions yet.');
  }else if(tab==='vouchers'){
    const rows=DB.vouchers.slice().reverse();
    body=tbl([{h:'When',r:r=>fmtDT(r.ts)},{h:'Type',r:r=>badge(r.type,r.type==='in'?'ok':'warn')},{h:'Amount',cls:'r',r:r=>fmt(r.amount)},{h:'Reason',r:r=>esc(r.reason)},{h:'By',r:r=>esc(userName(r.userId))},{h:'',cls:'r',r:r=>btn('Slip','tx-slip',r.id)}],rows,'No cash vouchers or refunds yet.');
  }else{
    body='<div class="bar">'+searchBox('counters','Search here…')+'<span class="sp"></span>'+btn('+ Add','counter-edit',null,'primary')+'</div>'+tbl([{h:'#',r:r=>DB.counters.indexOf(r)+1},{h:'Name',r:r=>'<b>'+esc(r.name)+'</b>'},{h:'Username',r:r=>esc(r.code)},
      {h:'Staff / shifts',r:r=>{const ss=DB.sessions.filter(s=>s.counterId===r.id);return new Set(ss.map(s=>s.openedBy)).size+' staff · '+ss.length+' shifts'}},{h:'Active session',r:r=>{const s=openSession(r.id);return s?badge(userName(s.openedBy),'ok')+' <span class="muted sm">since '+fmtDT(s.openedAt)+'</span>':'—'}},{h:'Status',r:r=>r.active?badge('Active','ok'):badge('Disabled','')},
      {h:'Orders',cls:'r',r:r=>DB.orders.filter(o=>o.counterId===r.id).length},{h:'',cls:'r',r:r=>btn('Edit','counter-edit',r.id)+(openSession(r.id)?'':' '+btn('Delete','counter-del',r.id,'danger'))}],DB.counters.filter(c=>match(UIS.q.counters,[c.name,c.code])),'No data found.');
  }
  return head('Outlets & Registers','Registers, sessions and cash control')+tabs('outlets',[['registers','Registers'],['sessions','Sessions & Z reports'],['vouchers','Cash vouchers']],tab)+body;
}
A['counter-edit']=d=>{
  const c=d.id?byId(DB.counters,d.id):null;
  modal({title:c?'Edit register':'New register',body:'<div class="form2">'+field('Name','name',c&&c.name,{req:1,af:1})+field('Short code (receipt prefix)','code',c&&c.code,{max:4})+'</div>'+check('Active','active',c?c.active:true),
    actions:[{label:'Cancel'},{label:'Save',cls:'primary',fn:el=>{const f=formData(el),code=f.code.trim().toUpperCase();if(!f.name.trim()||!/^[A-Z0-9]{1,4}$/.test(code)){toast('Name and a 1–4 character code are required','err');return false}
      if(DB.counters.some(x=>x.id!==d.id&&x.code===code)){toast('Code already used','err');return false}
      if(c){c.name=f.name.trim();c.code=code;c.active=!!f.active}else DB.counters.push({id:uid('k'),name:f.name.trim(),code:code,active:!!f.active});save();render()}}]});
};
A['counter-del']=d=>{if(DB.orders.some(o=>o.counterId===d.id)){toast('This register has orders; disable it instead','err');return}confirmBox('Delete this register?',()=>{DB.counters=DB.counters.filter(c=>c.id!==d.id);save();render()},'Delete')};
A['z-view']=d=>{const s=byId(DB.sessions,d.id);const tmp=s.closedAt?s:Object.assign({},s,{closedAt:now(),closedBy:ME.id});modal({title:s.closedAt?'Z report':'X report (live)',body:zReportHtml(tmp),actions:[{label:'Print',cls:'primary',keep:true,fn:()=>{printHtml(zReportHtml(tmp));return false}},{label:'Close'}]})};

/* ================= Orders ================= */
function vOrders(){
  const own=!can('dashboard');
  let rows=DB.orders.slice().reverse().filter(o=>(UIS.ordStatus==='all'||o.status===UIS.ordStatus)&&(!own||o.userId===ME.id)&&match(UIS.q.orders,[o.no,(byId(DB.customers,o.customerId)||{}).name,userName(o.userId),o.total]));
  return head('Orders',own?'Your orders':'All orders')+'<div class="bar">'+searchBox('orders','Search order #, guest, cashier or amount')+
    '<select data-ch="ordStatus" aria-label="Status"><option value="all">All</option><option value="completed"'+(UIS.ordStatus==='completed'?' selected':'')+'>Completed</option><option value="refunded"'+(UIS.ordStatus==='refunded'?' selected':'')+'>Refunded</option></select><span class="sp"></span>'+(own?'':btn('Export CSV','orders-export'))+'</div>'+
    tbl([{h:'#',r:r=>'<b>'+esc(r.no)+'</b>'},{h:'When',r:r=>fmtDT(r.ts)},{h:'Type',r:r=>esc(r.type)+(r.table?' · '+esc(r.table):'')},{h:'Guest',r:r=>esc((byId(DB.customers,r.customerId)||{}).name||'—')},{h:'Cashier',r:r=>esc(userName(r.userId))},
      {h:'Paid by',r:r=>esc(r.payments.map(p=>p.method).join(' + '))},{h:'Total',cls:'r',r:r=>fmt(r.total)},{h:'Status',r:r=>badge(r.status,r.status==='completed'?'ok':'bad')},{h:'',cls:'r',r:r=>btn('Open','order-view',r.id)}],rows.slice(0,300),'No orders match.');
}
C.ordStatus=el=>{UIS.ordStatus=el.value;render()};
A['orders-export']=()=>downloadCSV('orders',[['order','time','type','guest','cashier','subtotal','discount','vat','total','status','payments']].concat(DB.orders.map(o=>[o.no,new Date(o.ts).toISOString(),o.type,(byId(DB.customers,o.customerId)||{}).name||'',userName(o.userId),o.subtotal,o.discountTotal,o.vat,o.total,o.status,o.payments.map(p=>p.method+':'+p.amount).join(' ')])));
A['order-view']=d=>{
  const o=byId(DB.orders,d.id), act=[];
  if(o.status==='completed')act.push({label:'Refund…',cls:'danger',keep:true,fn:()=>{closeModal();A['order-refund']({id:o.id});return false}});
  showReceipt(o,act);
};
A['order-refund']=d=>{
  const o=byId(DB.orders,d.id);
  requireManager('Refund order #'+o.no+' ('+money(o.total)+')',appr=>{
    modal({title:'Refund order #'+o.no,body:'<p>Refund <b>'+money(o.total)+'</b> to the original tender. This cannot be undone.</p>'+field('Reason (required)','reason','',{af:1})+check('Return items to stock','restock',true),
      actions:[{label:'Cancel'},{label:'Refund',cls:'danger',fn:el=>{
        const f=formData(el); if(!f.reason.trim()){toast('Reason is required','err');return false}
        if(o.status!=='completed'){toast('Already refunded','err');return false}
        o.status='refunded';o.refund={ts:now(),by:appr.id,reason:f.reason.trim(),restock:!!f.restock};
        if(f.restock)o.lines.forEach(l=>returnStock(l.allocs,l.itemId,'Refund #'+o.no));
        postRefund(o,!!f.restock);
        if(typeof einvStamp==='function'&&o.einv)einvStamp(o,'credit');
        const cu=byId(DB.customers,o.customerId); if(cu){cu.points=Math.max(0,cu.points-(o.pointsEarned||0)+(o.pointsRedeemed||0));cu.spend=r2(Math.max(0,cu.spend-o.total));cu.visits=Math.max(0,cu.visits-1)}
        if(o.code){const c=byId(DB.codes,o.code);if(c&&c.used>0)c.used--}
        const cash=r2(o.payments.filter(p=>p.method==='cash').reduce((a,p)=>a+p.amount,0)), os=openSession(o.counterId)||DB.sessions.find(x=>!x.closedAt&&x.openedBy===ME.id);
        if(cash>0&&os)DB.vouchers.push({id:uid('v'),sessionId:os.id,ts:now(),type:'refund',amount:cash,reason:'Refund #'+o.no,userId:ME.id});
        audit('order.refund','#'+o.no+' '+money(o.total)+' — '+f.reason.trim()+' (approved by '+appr.username+')');save();toast('Order refunded');render();
      }}]});
  });
};

/* ================= Reports ================= */
function repRange(){
  if(!UIS.from){UIS.from=dayKey(now()-6*864e5);UIS.to=dayKey(now())}
  const a=new Date(UIS.from+'T00:00:00').getTime(), b=new Date(UIS.to+'T23:59:59').getTime();
  return DB.orders.filter(o=>o.ts>=a&&o.ts<=b);
}
C.from=el=>{UIS.from=el.value||UIS.from;render()}; C.to=el=>{UIS.to=el.value||UIS.to;render()};
const REPORTS=[['menu','Menu profit'],['risk','Risk alerts'],['hourly','Busy hours'],['sales','Sales summary'],['items','By item'],['category','By category'],['payments','Payments'],['staff','By cashier'],['vat','VAT'],['margin','Margin per bill'],['valuation','Stock valuation'],['expiry','Expiry']];
function vReports(tab){
  tab=tab||''; if(!tab)return vReportHub(); if(tab.indexOf('inv-')===0)return vInvReport(tab); if(tab.indexOf('acc-')===0)return vAccReport(tab);
  if(tab==='menu'||tab==='hourly'||tab==='risk'||tab==='rx'||tab==='provider'||tab==='warranty'||tab==='vehicle')return head('Insights','Reports with date filters and CSV export')+reportNav(tab)+(tab==='menu'?vMenuEng():tab==='hourly'?vHourly():tab==='rx'?vRxRegister():tab==='provider'?vProviderReport():tab==='warranty'?vWarranty():tab==='vehicle'?vVehicleHistory():vRisk());
  const all=repRange(), done=all.filter(o=>o.status==='completed'), ref=all.filter(o=>o.status==='refunded');
  let body='',csv=null;
  const sum=(a,k)=>r2(a.reduce((s,o)=>s+o[k],0));
  const kp=(l,v)=>'<div class="kpi"><span class="kl">'+esc(l)+'</span><strong>'+v+'</strong></div>';
  if(tab==='sales'){
    const days={}; done.forEach(o=>{const k=dayKey(o.ts);(days[k]=days[k]||[]).push(o)});
    const keys=Object.keys(days).sort(); const rows=keys.map(k=>({day:k,n:days[k].length,gross:sum(days[k],'subtotal'),disc:sum(days[k],'discountTotal'),vat:sum(days[k],'vat'),net:sum(days[k],'total')}));
    body='<div class="kpis">'+kp('Net sales',money(sum(done,'total')))+kp('Orders',done.length)+kp('Average order',money(done.length?sum(done,'total')/done.length:0))+kp('Refunds',ref.length+' · '+money(sum(ref,'total')))+'</div>'+
      '<section class="card">'+barChart(rows.map(r=>({label:r.day.slice(5),value:r.net})),{label:'Net sales by day'})+'</section>'+
      tbl([{h:'Day',r:r=>r.day},{h:'Orders',cls:'r',r:r=>r.n},{h:'Gross',cls:'r',r:r=>fmt(r.gross)},{h:'Discounts',cls:'r',r:r=>fmt(r.disc)},{h:'VAT',cls:'r',r:r=>fmt(r.vat)},{h:'Net',cls:'r',r:r=>fmt(r.net)}],rows,'No sales in this range.');
    csv=[['day','orders','gross','discounts','vat','net']].concat(rows.map(r=>[r.day,r.n,r.gross,r.disc,r.vat,r.net]));
  }else if(tab==='items'||tab==='category'){
    const agg={}; done.forEach(o=>o.lines.forEach(l=>{const it=itemById(l.itemId),k=tab==='items'?l.name:catName(it&&it.categoryId);const a=agg[k]||(agg[k]={name:k,qty:0,rev:0,cost:0});a.qty+=l.qty;a.rev=r2(a.rev+l.qty*l.price);a.cost=r2(a.cost+l.qty*(l.cost||0))}));
    const rows=Object.keys(agg).map(k=>agg[k]).sort((a,b)=>b.rev-a.rev);
    body=tbl([{h:tab==='items'?'Item':'Category',r:r=>esc(r.name)},{h:'Qty',cls:'r',r:r=>r.qty},{h:'Sales',cls:'r',r:r=>fmt(r.rev)},{h:'Cost',cls:'r',r:r=>fmt(r.cost)},{h:'Margin',cls:'r',r:r=>r.rev?Math.round((r.rev-r.cost)/r.rev*100)+'%':'—'}],rows,'No sales in this range.');
    csv=[[tab,'qty','sales','cost']].concat(rows.map(r=>[r.name,r.qty,r.rev,r.cost]));
  }else if(tab==='payments'){
    const agg={}; all.forEach(o=>o.payments.forEach(p=>{const a=agg[p.method]||(agg[p.method]={m:p.method,paid:0,refunded:0,n:0});a.n++;if(o.status==='completed')a.paid=r2(a.paid+p.amount);else a.refunded=r2(a.refunded+p.amount)}));
    const rows=Object.keys(agg).map(k=>agg[k]);
    body=tbl([{h:'Method',r:r=>esc(r.m.toUpperCase())},{h:'Payments',cls:'r',r:r=>r.n},{h:'Collected',cls:'r',r:r=>fmt(r.paid)},{h:'Refunded',cls:'r',r:r=>fmt(r.refunded)}],rows,'No payments in this range.');
    csv=[['method','payments','collected','refunded']].concat(rows.map(r=>[r.m,r.n,r.paid,r.refunded]));
  }else if(tab==='staff'){
    const agg={}; done.forEach(o=>{const a=agg[o.userId]||(agg[o.userId]={name:userName(o.userId),n:0,net:0,disc:0});a.n++;a.net=r2(a.net+o.total);a.disc=r2(a.disc+o.discountTotal)});
    ref.forEach(o=>{const a=agg[o.userId]||(agg[o.userId]={name:userName(o.userId),n:0,net:0,disc:0});a.refunds=(a.refunds||0)+1});
    const rows=Object.keys(agg).map(k=>agg[k]).sort((a,b)=>b.net-a.net);
    body=tbl([{h:'Cashier',r:r=>esc(r.name)},{h:'Orders',cls:'r',r:r=>r.n},{h:'Net sales',cls:'r',r:r=>fmt(r.net)},{h:'Avg order',cls:'r',r:r=>fmt(r.n?r.net/r.n:0)},{h:'Discounts',cls:'r',r:r=>fmt(r.disc)},{h:'Refunds',cls:'r',r:r=>r.refunds||0}],rows,'No sales in this range.');
    csv=[['cashier','orders','net','discounts','refunds']].concat(rows.map(r=>[r.name,r.n,r.net,r.disc,r.refunds||0]));
  }else if(tab==='vat'){
    const days={}; done.forEach(o=>{const k=dayKey(o.ts);const a=days[k]||(days[k]={day:k,total:0,vat:0});a.total=r2(a.total+o.total);a.vat=r2(a.vat+o.vat)});
    const rows=Object.keys(days).sort().map(k=>days[k]);
    body='<div class="kpis">'+kp('Sales incl. VAT',money(sum(done,'total')))+kp('VAT collected ('+DB.settings.vatPct+'%)',money(sum(done,'vat')))+kp('Net of VAT',money(sum(done,'total')-sum(done,'vat')))+'</div>'+
      tbl([{h:'Day',r:r=>r.day},{h:'Total',cls:'r',r:r=>fmt(r.total)},{h:'VAT',cls:'r',r:r=>fmt(r.vat)}],rows,'No sales in this range.');
    csv=[['day','total','vat']].concat(rows.map(r=>[r.day,r.total,r.vat]));
  }else if(tab==='margin'){
    const rows=done.map(o=>{const cost=r2(o.lines.reduce((a,l)=>a+l.qty*(l.cost||0),0));const netEx=r2(o.total-o.vat);return {no:o.no,ts:o.ts,rev:o.total,cost:cost,profit:r2(netEx-cost)}}).sort((a,b)=>a.profit-b.profit);
    body='<p class="muted sm">Profit = sale excluding VAT minus item cost. Lowest margin first.</p>'+tbl([{h:'#',r:r=>esc(r.no)},{h:'When',r:r=>fmtDT(r.ts)},{h:'Sale',cls:'r',r:r=>fmt(r.rev)},{h:'Cost',cls:'r',r:r=>fmt(r.cost)},{h:'Profit',cls:'r',r:r=>'<span class="'+(r.profit<0?'neg':'')+'">'+fmt(r.profit)+'</span>'}],rows.slice(0,300),'No sales in this range.');
    csv=[['order','sale','cost','profit']].concat(rows.map(r=>[r.no,r.rev,r.cost,r.profit]));
  }else if(tab==='valuation'){
    const rows=DB.items.filter(i=>i.track).map(i=>({name:i.name,qty:stockOf(i.id),value:r2(DB.lots.filter(l=>l.itemId===i.id&&l.qty>0).reduce((a,l)=>a+l.qty*l.cost,0))}));
    body='<div class="kpis">'+kp('Total stock value',money(rows.reduce((a,r)=>a+r.value,0)))+'</div>'+tbl([{h:'Item',r:r=>esc(r.name)},{h:'Qty',cls:'r',r:r=>r.qty},{h:'Value',cls:'r',r:r=>fmt(r.value)}],rows,'No tracked items.');
    csv=[['item','qty','value']].concat(rows.map(r=>[r.name,r.qty,r.value]));
  }else{
    const rows=DB.lots.filter(l=>l.qty>0&&l.expiry).sort((a,b)=>a.expiry-b.expiry);
    body=tbl([{h:'Item',r:r=>esc((itemById(r.itemId)||{}).name)},{h:'Lot',r:r=>esc(r.lotNo)},{h:'Qty',cls:'r',r:r=>r.qty},{h:'Value at cost',cls:'r',r:r=>fmt(r.qty*r.cost)},{h:'Expiry',r:r=>r.expiry<now()?badge(fmtDate(r.expiry)+' · expired','bad'):r.expiry<daysFromNow(14)?badge(fmtDate(r.expiry)+' · soon','warn'):fmtDate(r.expiry)}],rows,'No lots with expiry dates.');
    csv=[['item','lot','qty','expiry']].concat(rows.map(r=>[(itemById(r.itemId)||{}).name,r.lotNo,r.qty,dayKey(r.expiry)]));
  }
  window._csv=csv; window._csvName='report-'+tab;
  const needsRange=['valuation','expiry'].indexOf(tab)<0;
  return head('Insights','Reports with date filters and CSV export')+reportNav(tab)+
    '<div class="bar">'+(needsRange?'<label class="inl">From <input type="date" data-ch="from" value="'+esc(UIS.from)+'"></label><label class="inl">To <input type="date" data-ch="to" value="'+esc(UIS.to)+'"></label>':'')+'<span class="sp"></span>'+(csv?btn('Export CSV','rep-export'):'')+'</div>'+body;
}
A['rep-export']=()=>{if(window._csv)downloadCSV(window._csvName,window._csv)};

/* ================= Settings ================= */
function vSettings(){
  if(!can('settings'))return head('Control Panel','Access restricted')+
    '<section class="card narrow"><p class="warn-t">Only administrators can access the Control Panel.</p><p class="muted">Ask your admin to update settings for you.</p></section>';
  const s=DB.settings;
  const f=s.features||{};
  const featToggle=(key,label,desc)=>{
    const on=f[key]!==false;
    return '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:12px 0;border-bottom:1px solid var(--border)">'+
      '<div><b>'+esc(label)+'</b><p class="muted sm" style="margin:2px 0 0">'+esc(desc)+'</p></div>'+
      '<label style="flex-shrink:0;display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-ch="feat-toggle" data-id="'+esc(key)+'"'+(on?' checked':'')+' style="width:16px;height:16px;cursor:pointer" aria-label="'+esc(label)+'"> <span class="muted sm">'+(on?'On':'Off')+'</span></label></div>';
  };
  return head('Control Panel','Business profile, tax, loyalty and data')+
  '<section class="card narrow"><h2>System Modules</h2><p class="muted sm" style="margin-bottom:12px">Enable or disable features for this business. Changes apply immediately.</p>'+
  featToggle('businessHours','Enable Business Hours','Show an auto-close popup when the register exceeds its configured closing time.')+
  featToggle('kotPrinting','Enable KOT Printers','Send kitchen order tickets to network printers on each new sale.')+
  featToggle('tableManagement','Enable Table Management','Show dine-in type, table number input, and the kitchen display in the register.')+
  '</section>'+
  '<form id="setForm" class="card narrow" autocomplete="off"><h2>Business</h2><div class="form2">'+field('Business name','business',s.business)+field('Tax registration no. (TRN)','trn',s.trn)+field('Address','address',s.address)+field('Phone','phone',s.phone)+
  field('Currency code','currency',s.currency,{max:4})+field('Receipt footer','footer',s.footer)+field('Country dialling code (WhatsApp)','countryCode',s.countryCode||'971',{max:4})+
  field('Minimum ticket margin % (0 = off)','minMarginPct',s.minMarginPct!=null?s.minMarginPct:15,{type:'number',min:0,max:100})+'</div>'+
  ''+bizSettingsHtml()+'<h2>Country & region</h2><div class="form2">'+select('Country','country',countryList(),s.country||'XX')+'<div class="end"><button type="button" class="btn ghost" data-act="country-apply">Apply country defaults</button></div></div><p class="muted sm">'+esc((COUNTRIES[s.country]||COUNTRIES.XX).note)+' Rates and rules change — confirm with your tax authority.</p>'+
  '<h2>Tax & charges</h2><div class="form2">'+field('Tax rate %','vatPct',s.vatPct,{type:'number',step:'0.01',min:0})+select('Prices are','taxInclusive',[['1','Tax-inclusive'],['0','Tax-exclusive']],s.taxInclusive?'1':'0')+
  field('Tax label (VAT / GST / Sales tax)','taxLabel',s.taxLabel||'')+field('Currency decimals','decimals',curDec(),{type:'number',min:0,max:3})+'</div>'+
  '<p class="muted sm">Service charge / municipality fee style add-ons (leave a % at 0 to switch off). Rules differ by country and licence — check what you may charge.</p>'+
  [0,1,2].map(i=>{const c=(s.charges||[])[i]||{};return '<div class="chrow">'+field('Charge '+(i+1)+' name','ch'+i+'_name',c.name||'')+field('%','ch'+i+'_pct',c.pct||0,{type:'number',min:0,max:100,step:'0.01'})+
    '<div class="chks">'+check('Taxable','ch'+i+'_tax',c.taxable)+check('Dine-in only','ch'+i+'_dine',!c.types||c.types.length===1&&c.types[0]==='dine-in')+check('Owed to government','ch'+i+'_gov',c.payable)+'</div></div>'}).join('')+
  '<h2>Receipts</h2><div class="form2">'+select('Receipt language','receiptLang',[['en','English'],['ar','العربية'],['both','English + Arabic']],s.receiptLang||'en')+'<span></span></div>'+
  '<h2>Loyalty</h2><div class="form2">'+field('Points earned per currency unit','pointsPerAed',s.pointsPerAed,{type:'number',step:'0.01',min:0})+field('Currency value of 1 point','pointValue',s.pointValue,{type:'number',step:'0.01',min:0})+'</div>'+
  '<h2>Discount caps (max % without manager approval)</h2><div class="form2">'+field('Admin %','capA',s.caps.admin,{type:'number',min:0})+field('Manager %','capM',s.caps.manager,{type:'number',min:0})+field('Cashier %','capC',s.caps.cashier,{type:'number',min:0})+'</div>'+
  (bm('kitchen')&&f.kotPrinting!==false?'<h2>Kitchen & KOT</h2><div class="form2">'+field('Number of KOT printers (0 = off)','kotPrinters',s.kotPrinters||0,{type:'number',min:0,max:8})+'<span></span></div>':'')+
  '<h2>Appearance & behaviour</h2><div class="form2">'+select('Brand theme','theme',[['A','Theme A — blue & cyan (default)'],['B','Theme B — navy & red']],s.theme)+select('Display size','density',[['compact','Compact (more on screen)'],['comfortable','Comfortable (larger)']],s.density||'compact')+select('Mode','mode',[['auto','Match device'],['light','Light'],['dark','Dark']],s.mode)+'</div>'+
  check('Allow invoicing when stock is zero or short','allowNegative',s.allowNegative)+
  '<h2 style="margin-top:20px">Item note presets</h2><p class="muted sm">Quick modifier buttons shown when adding a note to an order line. One per line (blank = use defaults).</p>'+
  '<textarea name="notePresets" rows="4" style="width:100%;box-sizing:border-box;padding:8px;font-size:.9em;font-family:inherit;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text)">'+esc((s.notePresets||[]).join('\n'))+'</textarea>'+
  '<div class="bar mt"><button class="btn primary" type="submit">Save settings</button></div></form>'+
  '<section class="card narrow mt" id="bizHoursSection"><h2>Operating Hours &amp; Shift Control</h2><p class="muted sm">Set daily hours. The system can auto-prompt shift close at closing time.</p>'+
  (()=>{const bh=s.businessHours||[];const DAYS=[['Mon','Monday'],['Tue','Tuesday'],['Wed','Wednesday'],['Thu','Thursday'],['Fri','Friday'],['Sat','Saturday'],['Sun','Sunday']];
    return '<div>'+DAYS.map(([abbr,full],i)=>{const d=bh[i]||{day:full,enabled:true,open:'08:00',close:'22:00'};
      return '<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">'+
        '<label style="display:flex;align-items:center;gap:8px;width:90px;cursor:pointer"><input type="checkbox" id="bh_on_'+i+'"'+(d.enabled?' checked':'')+' style="width:15px;height:15px;flex-shrink:0;cursor:pointer"> <span>'+esc(abbr)+'</span></label>'+
        '<label style="display:flex;align-items:center;gap:6px;font-size:.85em;color:var(--muted)">Open <input type="time" id="bh_open_'+i+'" value="'+esc(d.open||'08:00')+'" style="padding:4px 6px;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--text);font-size:.9em"></label>'+
        '<label style="display:flex;align-items:center;gap:6px;font-size:.85em;color:var(--muted)">Close <input type="time" id="bh_close_'+i+'" value="'+esc(d.close||'22:00')+'" style="padding:4px 6px;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--text);font-size:.9em"></label>'+
        '</div>';}).join('')+'</div>';})() +
  '<label style="display:flex;align-items:flex-start;gap:10px;margin-top:16px;cursor:pointer"><input type="checkbox" id="bh_autoclose"'+(s.autoCloseShift?' checked':'')+' style="width:15px;height:15px;margin-top:3px;flex-shrink:0;cursor:pointer"><div><b>Auto-prompt shift close at closing time</b><p class="muted sm" style="margin:2px 0 0">Locks the POS with a Z-report when business hours end</p></div></label>'+
  '<div class="bar mt"><button class="btn primary" data-act="biz-hours-save">&#128196; Save Business Hours</button></div></section>'+
  (bm('kitchen')&&f.kotPrinting!==false?(()=>{
    const kp=DB.settings.kotPrinters||4;
    const opts=[['','— None —']].concat(Array.from({length:kp},(_,i)=>[(i+1).toString(),'Printer '+(i+1)]));
    const rows=DB.categories.length?DB.categories.map(c=>'<tr><td style="padding:8px 10px;vertical-align:middle"><b>'+esc(c.name)+'</b>'+(c.nameAr?'<br><span class="muted sm">'+esc(c.nameAr)+'</span>':'')+'</td><td style="padding:6px 10px">'+select('','ckp_'+c.id,opts,c.kotPrinter?String(c.kotPrinter):'')+'</td></tr>').join(''):'<tr><td colspan="2" style="padding:10px;color:var(--muted)">No categories yet. Add categories first.</td></tr>';
    return '<section class="card narrow mt" id="catKotSection"><h2>Category KOT Printer</h2><p class="muted sm">Route each category to its KOT printer. Printer count set in Kitchen &amp; KOT above.</p><table style="width:100%"><thead><tr><th style="text-align:left;padding:4px 10px;color:var(--muted)">Category</th><th style="text-align:left;padding:4px 10px;color:var(--muted)">KOT Printer</th></tr></thead><tbody>'+rows+'</tbody></table><div class="bar mt">'+btn('Save KOT mapping','cat-kot-save')+'</div></section>';
  })():'')+
  '<section class="card narrow mt"><h2>Data</h2><p class="muted sm">This demo stores data in this browser only. Back up regularly.</p><div class="bar">'+btn('Download backup (JSON)','backup')+btn('Restore from backup','restore')+btn('Load sample sales','demo-data')+btn('Reset to demo data','reset','', 'danger')+'</div></section>'+
  '<section class="card narrow mt"><h2>Audit log</h2>'+tbl([{h:'When',r:r=>fmtDT(r.ts)},{h:'User',r:r=>esc(userName(r.user))},{h:'Action',r:r=>esc(r.action)},{h:'Detail',r:r=>esc(r.detail)}],DB.audit.slice(0,40),'No activity yet.')+'</section>';
}
function bindSettings(){
  const f=$('#setForm'); if(!f)return;
  f.addEventListener('submit',e=>{
    e.preventDefault(); const d=formData(f), s=DB.settings;
    const vat=num(d.vatPct); if(vat<0||vat>100){toast('VAT must be 0–100','err');return}
    const caps=[num(d.capA),num(d.capM),num(d.capC)]; if(caps.some(c=>c<0||c>100)){toast('Caps must be 0–100','err');return}
    const npRaw=(d.notePresets||'').split('\n').map(x=>x.trim()).filter(Boolean);
    const notePresets=npRaw.length?npRaw:null;
    Object.assign(s,{business:d.business.trim()||'My Business',trn:d.trn.trim(),address:d.address.trim(),phone:d.phone.trim(),currency:(d.currency.trim()||'AED').toUpperCase(),footer:d.footer.trim(),
      vatPct:vat,taxInclusive:d.taxInclusive==='1',country:d.country,taxLabel:(d.taxLabel||'').trim(),decimals:d.decimals===''?null:Math.min(3,Math.max(0,Math.round(num(d.decimals)))),receiptLang:d.receiptLang,
      charges:[0,1,2].map(i=>({id:'ch'+i,name:(d['ch'+i+'_name']||'').trim()||('Charge '+(i+1)),pct:Math.min(100,Math.max(0,num(d['ch'+i+'_pct']))),taxable:!!d['ch'+i+'_tax'],types:d['ch'+i+'_dine']?['dine-in']:[],payable:!!d['ch'+i+'_gov']})).filter(c=>c.pct>0),pointsPerAed:Math.max(0,num(d.pointsPerAed)),pointValue:Math.max(0.01,num(d.pointValue)),caps:{admin:caps[0],manager:caps[1],cashier:caps[2]},theme:d.theme,mode:d.mode,density:d.density||'compact',allowNegative:!!d.allowNegative,countryCode:(d.countryCode||'971').replace(/\D/g,'')||'971',minMarginPct:Math.min(100,Math.max(0,num(d.minMarginPct))),kotPrinters:Math.min(8,Math.max(0,Math.round(num(d.kotPrinters||0)))),notePresets:notePresets});
    audit('settings.save','');save();applyTheme();toast('Settings saved');render();
  });
}
C['feat-toggle']=el=>{
  if(!DB.settings.features)DB.settings.features={businessHours:true,kotPrinting:true,tableManagement:true};
  const key=el.dataset.id;
  DB.settings.features[key]=el.checked;
  audit('settings.feature',key+'='+(el.checked?'on':'off'));save();toast('Module '+(el.checked?'enabled':'disabled'));render();
};
A['biz-hours-save']=()=>{
  const DAYS=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  DB.settings.businessHours=DAYS.map((day,i)=>{
    const on=$('#bh_on_'+i),op=$('#bh_open_'+i),cl=$('#bh_close_'+i);
    return {day:day,enabled:!!(on&&on.checked),open:(op&&op.value)||'08:00',close:(cl&&cl.value)||'22:00'};
  });
  DB.settings.autoCloseShift=!!($('#bh_autoclose')&&$('#bh_autoclose').checked);
  audit('settings.biz-hours','');save();toast('Business hours saved');
};
A.backup=()=>{DB.lastBackup=now();save();const b=new Blob([JSON.stringify(DB)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='harbinger-backup-'+dayKey(now())+'.json';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)};
A.restore=()=>modal({title:'Restore backup',body:'<p class="warn-t">This replaces ALL current data.</p><input type="file" name="f" accept=".json,application/json" autofocus>',actions:[{label:'Cancel'},{label:'Restore',cls:'danger',fn:el=>{
  const f=$('[name=f]',el).files[0]; if(!f){toast('Choose a backup file','err');return false}
  const rd=new FileReader(); rd.onload=()=>{try{const d=JSON.parse(rd.result);if(!d||!d.settings||!Array.isArray(d.items)||!Array.isArray(d.users)||!d.users.length)throw 0;DB=d;migrate();save();logout();toast('Backup restored — please sign in again');location.hash='#/';render()}catch(e){toast('That file is not a valid Harbinger backup','err')}};rd.readAsText(f)}}]});
A.reset=()=>confirmBox('Erase everything and reload the demo data?',()=>{DB=seed();migrate();save();logout();location.hash='#/';render()},'Reset');
