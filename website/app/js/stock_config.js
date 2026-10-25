'use strict';
/* Stock Room → Scale setup and Barcodes.
   Scale: how the shop's weighing scale prints its labels (prefix, PLU length, weight or price), PLU list, test, export for the scale.
   Barcodes: scanner rules, internal EAN-13 numbering for items without a barcode, shelf-label printing. */

const SCALE_DEF={prefix:'2',pluLen:6,valueLen:5,mode:'weight',div:1000,check:'1'};
const BC_DEF={prefix:'99',allowSku:'1',qtyMult:'1',next:1,labelCols:3,showPrice:'1'};
const scaleCfg=()=>Object.assign({},SCALE_DEF,DB.settings.scale||{});
const bcCfg=()=>Object.assign({},BC_DEF,DB.settings.barcode||{});
const padN=(n,l)=>String(n).padStart(l,'0');
const scaleOk=c=>/^\d{1,2}$/.test(c.prefix)&&c.prefix.length+(+c.pluLen)+(+c.valueLen)===12;

/* ---------- EAN-13 drawing ---------- */
const EAN_L=['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
const EAN_G=['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'];
const EAN_R=['1110010','1100110','1101100','1000010','1011100','1001110','1010000','1000100','1001000','1110100'];
const EAN_P=['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'];
const isEan13=c=>/^\d{13}$/.test(c)&&ean13Check(c.slice(0,12))===+c[12];
function ean13Svg(code,h){
  if(!isEan13(code))return '';
  const par=EAN_P[+code[0]]; let bits='101';
  for(let i=1;i<=6;i++)bits+=(par[i-1]==='L'?EAN_L:EAN_G)[+code[i]];
  bits+='01010'; for(let i=7;i<=12;i++)bits+=EAN_R[+code[i]]; bits+='101';
  const H=h||50, X=9; let bars='',i=0;
  while(i<bits.length){if(bits[i]==='1'){let j=i;while(bits[j]==='1')j++;const guard=(i<3||(i>=45&&i<50)||i>=92);bars+='<rect x="'+(X+i)+'" y="0" width="'+(j-i)+'" height="'+(guard?H+4:H)+'"/>';i=j}else i++}
  return '<svg class="ean" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 113 '+(H+13)+'" role="img" aria-label="Barcode '+code+'"><rect width="113" height="'+(H+13)+'" fill="#fff"/><g fill="#000">'+bars+'</g><g font-family="monospace" font-size="9" fill="#000"><text x="1" y="'+(H+11)+'">'+code[0]+'</text><text x="'+(X+4)+'" y="'+(H+11)+'" textLength="38">'+code.slice(1,7)+'</text><text x="'+(X+50)+'" y="'+(H+11)+'" textLength="38">'+code.slice(7)+'</text></g></svg>';
}

/* ---------- scale codes ---------- */
function makeScaleCode(it,qty){
  const c=scaleCfg(), plu=padN(String(it.plu||'0'),+c.pluLen), v=c.mode==='price'?Math.round(qty*it.price*100):Math.round(qty*(+c.div));
  const d12=c.prefix+plu+padN(v,+c.valueLen); if(d12.length!==12)return '';
  return d12+ean13Check(d12);
}
/* returns {item,qty} for a scale label, or null */
function parseScaleCode(q){
  const c=scaleCfg(); if(!/^\d{13}$/.test(q)||q.indexOf(c.prefix)!==0||!scaleOk(c))return null;
  if(c.check==='1'&&ean13Check(q.slice(0,12))!==+q[12])return null;
  const p=c.prefix.length, plu=q.slice(p,p+(+c.pluLen)), val=parseInt(q.slice(p+(+c.pluLen),12),10);
  const it=DB.items.find(i=>i.active&&i.weighed&&i.plu&&padN(String(i.plu),+c.pluLen)===plu); if(!it)return null;
  const qty=c.mode==='price'?(it.price>0?rq(val/100/it.price):0):rq(val/(+c.div));
  return qty>0?{item:it,qty:qty,weight:true}:null;
}

/* ---------- Stock Room tabs ---------- */
function vScaleSetup(){
  const c=scaleCfg(), items=DB.items.filter(i=>i.active&&i.weighed).sort((a,b)=>a.name.localeCompare(b.name)), missing=items.filter(i=>!i.plu).length, ok=scaleOk(c), s0=items.find(i=>i.plu);
  const sample=s0&&ok?makeScaleCode(s0,1.25):'';
  return '<div class="card narrow"><h2>Weighing scale label format</h2><p class="muted sm">Set this to match how your scale prints its barcode, so scanning a label puts the right item and weight on the bill. A standard 13-digit scale label is: <b>prefix + item code (PLU) + weight or price + check digit</b>.</p>'+
    '<div id="scForm"><div class="form2">'+field('Label starts with (1–2 digits)','prefix',c.prefix,{max:2})+select('PLU digits','pluLen',[[4,'4'],[5,'5'],[6,'6']],c.pluLen)+select('Weight / price digits','valueLen',[[4,'4'],[5,'5'],[6,'6']],c.valueLen)+
    select('The label holds','mode',[['weight','Weight'],['price','Total price']],c.mode)+select('Weight unit in the label','div',[[1000,'Grams (1250 = 1.250 kg)'],[100,'10-gram steps (125 = 1.25 kg)'],[10,'100-gram steps (12 = 1.2 kg)'],[1,'Whole units']],c.div)+select('Verify check digit','check',[['1','Yes (recommended)'],['0','No — my scale does not print one']],c.check)+'</div>'+
    '<p class="'+(ok?'muted':'neg')+' sm">'+(ok?'Format: <code>'+esc(c.prefix)+' '+'P'.repeat(+c.pluLen)+' '+(c.mode==='price'?'T':'W').repeat(+c.valueLen)+' C</code> — 13 digits.':'Prefix + PLU digits + value digits must add up to 12 (the 13th is the check digit).')+'</p>'+
    '<div class="bar">'+btn('Save scale settings','sc-save',null,'primary')+'</div></div></div>'+
    '<section class="card mt"><h2>Test a label</h2><div class="bar"><input id="scTestIn" class="search" placeholder="Scan or type a 13-digit scale label" maxlength="13" inputmode="numeric" aria-label="Scale label"><button type="button" class="btn ghost" data-act="sc-test">Test</button></div><p id="scTestOut" class="sm muted">'+
    (sample?'Example: '+esc(s0.name)+' at 1.250 kg is <b>'+sample+'</b>':'Give a weighed item a PLU to see an example label.')+'</p>'+(sample?'<div style="max-width:200px">'+ean13Svg(sample)+'</div>':'')+'</section>'+
    '<section class="card mt"><h2>Item codes (PLU) for the scale</h2><div class="bar"><span class="muted sm">'+items.length+' weighed items · '+missing+' without a PLU</span><span class="sp"></span>'+(missing?btn('Assign missing PLUs','sc-plu-auto'):'')+btn('Export for the scale (CSV)','sc-export',null,'primary')+'</div>'+
    tbl([{h:'PLU',r:r=>r.plu?'<b>'+esc(padN(String(r.plu),+c.pluLen))+'</b>':'<span class="neg">missing</span>'},{h:'Item',r:r=>esc(r.name)},{h:'Price',cls:'r',r:r=>fmt(r.price)+' / '+esc(r.unit||'kg')},{h:'',cls:'r',r:r=>btn('Set PLU','sc-plu-edit',r.id)}],items,'No weighed items yet. Open an item in the catalogue and tick "Sold by weight".')+'</section>';
}
A['sc-save']=()=>{
  const f=formData($('#scForm')), c={prefix:String(f.prefix||'').trim(),pluLen:+f.pluLen,valueLen:+f.valueLen,mode:f.mode==='price'?'price':'weight',div:+f.div||1000,check:f.check==='0'?'0':'1'};
  if(!scaleOk(c)){toast('Prefix + PLU digits + value digits must be 12 in total','err');return}
  const bp=bcCfg().prefix; if(bp.indexOf(c.prefix)===0||c.prefix.indexOf(bp)===0){toast('This prefix clashes with your internal barcode prefix ('+bp+'). Change one of them.','err');return}
  DB.settings.scale=c;audit('scale.config',JSON.stringify(c));save();toast('Scale settings saved');render();
};
A['sc-test']=()=>{
  const q=($('#scTestIn').value||'').trim(), o=$('#scTestOut'), p=parseScaleCode(q);
  o.className='sm '+(p?'pos':'neg'); o.textContent=p?(p.item.name+' — '+p.qty+' '+(p.item.unit||'kg')+' = '+money(r2(p.qty*p.item.price))):'Not recognised. Check the prefix, digit counts and that the item has this PLU.';
};
A['sc-plu-auto']=()=>{
  const c=scaleCfg(), used={}; DB.items.forEach(i=>{if(i.plu)used[String(+i.plu||i.plu)]=1}); let n=1,made=0;
  DB.items.filter(i=>i.active&&i.weighed&&!i.plu).forEach(i=>{while(used[String(n)])n++;i.plu=String(n);used[String(n)]=1;made++});
  if(String(n).length>+c.pluLen){toast('Not enough PLU digits for that many items','err');return}
  audit('scale.plu.auto',made+' PLUs');save();toast(made+' PLU codes assigned');render();
};
A['sc-plu-edit']=d=>{
  const it=byId(DB.items,d.id), c=scaleCfg();
  modal({title:'PLU — '+it.name,body:field('PLU (digits, up to '+c.pluLen+')','plu',it.plu||'',{max:+c.pluLen,af:1}),enter:el=>$('.btn.primary',el).click(),
    actions:[{label:tr('Cancel')},{label:tr('Save'),cls:'primary',fn:el=>{const v=String(formData(el).plu||'').trim();
      if(!/^\d+$/.test(v)){toast('Digits only','err');return false} if(v.length>+c.pluLen){toast('At most '+c.pluLen+' digits','err');return false}
      if(DB.items.some(x=>x!==it&&x.plu&&+x.plu===+v)){toast('That PLU is already used','err');return false}
      it.plu=String(+v);save();render()}}]});
};
A['sc-export']=()=>{
  const c=scaleCfg(), items=DB.items.filter(i=>i.active&&i.weighed&&i.plu);
  downloadCSV('scale-plu-list',[['PLU','name','price per '+(items[0]&&items[0].unit||'kg'),'unit','shelf life (days)','tare']].concat(items.map(i=>[padN(String(i.plu),+c.pluLen),i.name,i.price,i.unit||'kg',i.shelfDays||'','0'])));
};

/* ---------- Barcodes ---------- */
function bcKind(code){return !code?'missing':isEan13(code)?'EAN-13':/^\d{8}$/.test(code)?'EAN-8 / UPC-E':'Other (text)'}
function vBarcodes(){
  const c=bcCfg(), items=DB.items.filter(i=>i.active&&match(UIS.q.bc,[i.name,i.sku,i.barcode])), missing=DB.items.filter(i=>i.active&&!i.barcode&&!i.weighed&&i.kind!=='service').length;
  return '<div class="card narrow"><h2>Scanner & numbering</h2><p class="muted sm">A barcode scanner types the code and presses Enter, so no driver is needed. These options control how the register treats what it reads.</p>'+
    '<div id="bcForm"><div class="form2">'+field('Internal barcode prefix (2–3 digits)','prefix',c.prefix,{max:3})+select('Accept item code (SKU) when scanned','allowSku',[['1','Yes'],['0','No — barcodes only']],c.allowSku)+select('Allow "3*barcode" quantity entry','qtyMult',[['1','Yes'],['0','No']],c.qtyMult)+select('Labels per row','labelCols',[[2,'2 (large)'],[3,'3 (medium)'],[4,'4 (small)']],c.labelCols)+'</div>'+
    '<div class="bar">'+btn('Save barcode settings','bc-save',null,'primary')+'</div></div></div>'+
    '<section class="card mt"><h2>Items without a barcode</h2><p class="muted sm"><b>'+missing+'</b> items have no barcode. Create internal EAN-13 codes (prefix <code>'+esc(c.prefix)+'</code> + number + check digit) and print labels to stick on the shelf or product.</p><div class="bar">'+(missing?btn('Create barcodes for '+missing+' items','bc-gen',null,'primary'):'')+btn('Print labels…','bc-labels')+'</div></section>'+
    '<div class="bar mt">'+searchBox('bc','Search item, SKU or barcode')+'</div>'+
    tbl([{h:'Item',r:r=>'<b>'+esc(r.name)+'</b><br><span class="muted sm">'+esc(r.sku||'')+'</span>'},{h:'Barcode',r:r=>esc(r.barcode||(r.weighed&&r.plu?'PLU '+r.plu+' (scale)':'—'))},{h:'Type',r:r=>{const k=bcKind(r.barcode);return k==='missing'?(r.weighed?badge('Scale item',''):badge('Missing','warn')):k==='EAN-13'?badge(k,'ok'):badge(k,'')}},{h:'',cls:'r',r:r=>r.barcode&&isEan13(r.barcode)?btn('Print label','bc-label-one',r.id):''}],items.slice(0,300),'No items match.');
}
A['bc-save']=()=>{
  const f=formData($('#bcForm')), cur=bcCfg(), p=String(f.prefix||'').trim();
  if(!/^\d{2,3}$/.test(p)){toast('Prefix must be 2 or 3 digits','err');return}
  const sp=scaleCfg().prefix; if(p.indexOf(sp)===0){toast('The prefix cannot start with the scale prefix ('+sp+')','err');return}
  DB.settings.barcode=Object.assign({},cur,{prefix:p,allowSku:f.allowSku==='0'?'0':'1',qtyMult:f.qtyMult==='0'?'0':'1',labelCols:+f.labelCols||3});save();toast('Barcode settings saved');render();
};
A['bc-gen']=()=>{
  const c=bcCfg(), list=DB.items.filter(i=>i.active&&!i.barcode&&!i.weighed&&i.kind!=='service'); if(!list.length)return;
  confirmBox('Create an internal EAN-13 barcode for '+list.length+' items? Existing barcodes are not touched.',()=>{
    const used={}; DB.items.forEach(i=>{if(i.barcode)used[i.barcode]=1}); let n=+c.next||1;
    list.forEach(i=>{let code;do{const d12=c.prefix+padN(n++,12-c.prefix.length);code=d12+ean13Check(d12)}while(used[code]);used[code]=1;i.barcode=code});
    DB.settings.barcode=Object.assign({},c,{next:n});audit('barcode.gen',list.length+' items');save();toast(list.length+' barcodes created');render();
  },'Create');
};
A['bc-label-one']=d=>labelSheet([byId(DB.items,d.id)],1,true);
A['bc-labels']=()=>{
  const cats=DB.categories.map(k=>[k.id,k.name]);
  modal({title:'Print barcode labels',body:select('Which items','scope',[['nobc','Items I just created / all with a barcode'],['all','All items with an EAN-13 barcode']].concat(cats.map(k=>['c:'+k[0],'Category: '+k[1]])),'all')+'<div class="form2">'+field('Copies of each','copies',1,{type:'number',min:1,max:20})+select('Show price','price',[['1','Yes'],['0','No']],bcCfg().showPrice)+'</div>',
    actions:[{label:tr('Cancel')},{label:'Print',cls:'primary',fn:el=>{const f=formData(el);let list=DB.items.filter(i=>i.active&&isEan13(i.barcode||''));
      if(f.scope.indexOf('c:')===0)list=list.filter(i=>i.categoryId===f.scope.slice(2));
      if(!list.length){toast('No items with a valid EAN-13 barcode in that selection','err');return false}
      labelSheet(list,Math.max(1,Math.min(20,Math.floor(num(f.copies)))),f.price!=='0')}}]});
};
function labelSheet(items,copies,showPrice){
  const cols=+bcCfg().labelCols||3, cells=[];
  items.forEach(it=>{if(!it||!isEan13(it.barcode||''))return;for(let k=0;k<copies;k++)cells.push('<div class="lbl"><div class="ln1">'+esc(it.name)+'</div>'+ean13Svg(it.barcode,40)+(showPrice?'<div class="lp">'+esc(DB.settings.currency)+' '+fmt(it.price)+'</div>':'')+'</div>')});
  if(!cells.length){toast('Nothing to print','err');return}
  printHtml('<style>.lblg{display:grid;grid-template-columns:repeat('+cols+',1fr);gap:6px}.lbl{border:1px dashed #bbb;padding:6px;text-align:center;break-inside:avoid;font-family:sans-serif}.ln1{font-size:11px;font-weight:600;margin-bottom:3px;height:26px;overflow:hidden}.ean{width:100%;max-width:170px;height:auto}.lp{font-size:15px;font-weight:700}</style><div class="lblg">'+cells.join('')+'</div>');
}

/* ================= Stock count (cycle count) =================
   Start a count for everything or one category, enter what is physically on the shelf (optionally "blind": expected quantities hidden),
   review the variances with their value, then post. Differences are applied against the quantity expected when the count started,
   so sales made during the count are not counted as losses. Posting writes stock movements and a stock/wastage journal. */
const counts=()=>(DB.counts=DB.counts||[]);
function applyStockDelta(it,delta,reason){
  if(delta>0){receiveLot(it.id,'CNT-'+Date.now().toString(36),null,delta,it.cost,'Count: '+reason);DB.movements[0].type='adjust';postStockValue(r2(delta*it.cost),'Stock count (+) '+it.name+': '+reason);return r2(delta*it.cost)}
  let need=-delta,val=0;
  lotsOf(it.id).forEach(l=>{if(need<=0||l.qty<=0)return;const t=Math.min(l.qty,need);l.qty=rq(l.qty-t);need=rq(need-t);val=r2(val+t*l.cost);logMove(it.id,l.id,'adjust',-t,'Count: '+reason,'')});
  if(need>0)throw new Error('Not enough stock to remove '+need+' of '+it.name);
  postStockValue(-val,'Stock count (−) '+it.name+': '+reason);return -val;
}
const countVar=l=>l.counted==null?null:rq(l.counted-l.expected);
function countSummary(c){
  const rows=c.lines.filter(l=>l.counted!=null), v=rows.map(l=>({l:l,d:countVar(l),it:itemById(l.itemId)})).filter(x=>x.it&&x.d!==0);
  return {counted:rows.length,total:c.lines.length,diffs:v,down:r2(v.filter(x=>x.d<0).reduce((a,x)=>a+x.d*x.it.cost,0)),up:r2(v.filter(x=>x.d>0).reduce((a,x)=>a+x.d*x.it.cost,0))};
}
function vStockCount(){
  const open=UIS.countOpen&&counts().find(c=>c.id===UIS.countOpen);
  if(open)return vCountSheet(open);
  const rows=counts().slice().reverse();
  return '<div class="card narrow"><h2>Start a stock count</h2><p class="muted sm">Walk the shelves, enter what you find, and post the differences. Use a blind count so counters are not influenced by the system quantity.</p><div id="cntForm"><div class="form2">'+
    select('What to count','scope',[['all','All tracked items']].concat(DB.categories.map(k=>['c:'+k.id,'Category: '+k.name])),'all')+select('Blind count','blind',[['1','Yes — hide expected quantities'],['0','No — show expected']],'1')+'</div>'+btn('Start count','count-start',null,'primary')+'</div></div>'+
    '<section class="card mt"><h2>Counts</h2>'+tbl([{h:'Count',r:r=>'<b>'+esc(r.no)+'</b><br><span class="muted sm">'+fmtDT(r.ts)+' · '+esc(userName(r.by))+'</span>'},{h:'Scope',r:r=>esc(r.scopeLabel)},{h:'Items',cls:'r',r:r=>r.lines.length},{h:'Status',r:r=>r.status==='posted'?badge('Posted','ok'):badge('In progress','warn')},
      {h:'Shortage (value)',cls:'r',r:r=>r.status==='posted'?'<span class="neg">'+fmt(-r.result.down)+'</span>':'—'},{h:'Surplus (value)',cls:'r',r:r=>r.status==='posted'?fmt(r.result.up):'—'},{h:'',cls:'r',r:r=>btn(r.status==='posted'?'View':'Continue','count-open',r.id)}],rows,'No counts yet.')+'</section>';
}
function vCountSheet(c){
  const posted=c.status==='posted', S=countSummary(c);
  return '<p class="sm"><a href="#" data-act="count-close">← All counts</a></p><div class="kpis"><div class="kpi"><span class="kl">Count</span><strong>'+esc(c.no)+'</strong></div><div class="kpi"><span class="kl">Counted</span><strong>'+S.counted+' / '+S.total+'</strong></div><div class="kpi"><span class="kl">Shortage (value)</span><strong class="neg">'+money(-S.down)+'</strong></div><div class="kpi"><span class="kl">Surplus (value)</span><strong>'+money(S.up)+'</strong></div></div>'+
    '<div class="bar">'+(posted?'':btn('Post differences','count-post',c.id,'primary')+btn('Count everything as expected','count-fill',c.id)+btn('Cancel count','count-cancel',c.id,'danger'))+'<span class="sp"></span></div>'+
    tbl([{h:'Item',r:r=>'<b>'+esc((itemById(r.itemId)||{}).name||'?')+'</b>'},{h:'Expected',cls:'r',r:r=>c.blind&&!posted&&r.counted==null?'—':r.expected},
      {h:'Counted',cls:'r',r:r=>posted?(r.counted==null?'—':r.counted):'<input class="cnt" type="number" step="any" min="0" data-in="cnt" data-cid="'+c.id+'" data-iid="'+r.itemId+'" value="'+(r.counted==null?'':r.counted)+'" aria-label="Counted quantity">'},
      {h:'Difference',cls:'r',r:r=>{const d=countVar(r);return d==null?'':'<span class="'+(d<0?'neg':d>0?'pos':'')+'">'+(d>0?'+':'')+d+'</span>'}}],c.lines,'')+
    (posted?'<p class="muted sm">Posted '+fmtDT(c.postedAt)+'. Variances are in Reports → Stock adjustments.</p>':'<p class="muted sm">Quantities save as you type. Items you leave empty are not adjusted.</p>');
}
I.cnt=el=>{const c=counts().find(x=>x.id===el.dataset.cid),l=c&&c.lines.find(x=>x.itemId===el.dataset.iid);if(l&&c.status==='open'){l.counted=el.value===''?null:Math.max(0,rq(num(el.value)));save()}};
A['count-start']=()=>{
  const f=formData($('#cntForm')), cat=f.scope.indexOf('c:')===0?f.scope.slice(2):null;
  const items=DB.items.filter(i=>i.active&&i.track&&(!cat||i.categoryId===cat)).sort((a,b)=>a.name.localeCompare(b.name)); if(!items.length){toast('No tracked items in that scope','err');return}
  DB.seq.count=(DB.seq.count||0)+1;
  const c={id:uid('cn'),no:'CNT-'+String(DB.seq.count).padStart(4,'0'),ts:now(),by:ME.id,status:'open',blind:f.blind!=='0',scopeLabel:cat?'Category: '+catName(cat):'All tracked items',lines:items.map(i=>({itemId:i.id,expected:stockOf(i.id),counted:null}))};
  counts().push(c);UIS.countOpen=c.id;audit('count.start',c.no);save();render();
};
A['count-open']=d=>{UIS.countOpen=d.id;render()};
A['count-close']=()=>{UIS.countOpen=null;render()};
A['count-fill']=d=>{const c=counts().find(x=>x.id===d.id);if(c&&c.status==='open'){c.lines.forEach(l=>{if(l.counted==null)l.counted=l.expected});save();render()}};
A['count-cancel']=d=>confirmBox('Cancel this count? Nothing is adjusted.',()=>{DB.counts=counts().filter(x=>x.id!==d.id);UIS.countOpen=null;audit('count.cancel',d.id);save();render()},'Cancel count');
A['count-post']=d=>{
  const c=counts().find(x=>x.id===d.id); if(!c||c.status!=='open')return; const S=countSummary(c);
  if(!S.counted){toast('Enter at least one counted quantity','err');return}
  if(Math.abs(S.down)+S.up>200&&!can('discount_override')){toast('Large differences need a manager to post','err');return}
  confirmBox('Post '+S.diffs.length+' differences ('+money(-S.down)+' shortage, '+money(S.up)+' surplus)? Stock and the books are adjusted.',()=>{
    try{S.diffs.forEach(x=>applyStockDelta(x.it,x.d,c.no))}catch(e){toast(e.message,'err');return}
    c.status='posted';c.postedAt=now();c.postedBy=ME.id;c.result={up:S.up,down:S.down,items:S.diffs.length};audit('count.post',c.no+' '+S.diffs.length+' diffs');save();toast('Count posted');render();
  },'Post');
};
