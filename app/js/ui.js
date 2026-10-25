'use strict';
/* Harbinger POS — UI helpers: modal, toast, tables, charts, csv, receipt */

const A={}, I={}, C={};   // click / input / change handlers (data-act, data-in, data-ch)

function toast(msg,type){
  let box=$('#toasts'); if(!box){box=document.createElement('div');box.id='toasts';box.setAttribute('aria-live','polite');document.body.appendChild(box)}
  const t=document.createElement('div'); t.className='toast '+(type||'ok'); t.textContent=msg; box.appendChild(t);
  setTimeout(()=>{t.classList.add('out');setTimeout(()=>t.remove(),300)},type==='err'?4500:2600);
}

let _modalEl=null, _lastFocus=null;
function modal(o){
  closeModal(true);
  _lastFocus=document.activeElement;
  const el=document.createElement('div'); el.className='modal-back';
  el.innerHTML='<div class="modal'+(o.wide?' wide':'')+'" role="dialog" aria-modal="true" aria-label="'+esc(o.title)+'">'+
    '<div class="modal-h"><h3>'+esc(o.title)+'</h3><button class="x" type="button" aria-label="Close" data-modal-x>×</button></div>'+
    '<div class="modal-b">'+o.body+'</div><div class="modal-f"></div></div>';
  const f=$('.modal-f',el);
  (o.actions||[]).forEach(a=>{
    const b=document.createElement('button'); b.type='button'; b.className='btn '+(a.cls||'ghost'); b.textContent=a.label;
    b.addEventListener('click',()=>{ if(a.fn&&a.fn(el)===false)return; if(!a.keep)closeModal() });
    f.appendChild(b);
  });
  if(!(o.actions||[]).length)f.remove();
  el.addEventListener('mousedown',e=>{if(e.target===el&&!o.sticky)closeModal()});
  $('[data-modal-x]',el).addEventListener('click',()=>closeModal());
  el.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&!o.sticky){closeModal();return}
    if(e.key==='Enter'&&o.enter&&e.target.tagName!=='TEXTAREA'&&e.target.tagName!=='BUTTON'){e.preventDefault();o.enter(el)}
  });
  document.body.appendChild(el); _modalEl=el;
  const first=$('[autofocus],input:not([type=hidden]),select,textarea',el); if(first)setTimeout(()=>first.focus(),30);
  if(o.onOpen)o.onOpen(el);
  return el;
}
function closeModal(silent){
  if(_modalEl){_modalEl.remove();_modalEl=null; if(!silent&&_lastFocus&&_lastFocus.focus&&document.contains(_lastFocus))try{_lastFocus.focus()}catch(e){}}
}
function formData(root){
  const out={};
  $$('[name]',root).forEach(i=>{
    if(i.type==='checkbox')out[i.name]=i.checked;
    else if(i.type==='radio'){if(i.checked)out[i.name]=i.value}
    else out[i.name]=i.value;
  });
  return out;
}
function confirmBox(msg,fn,label){
  modal({title:'Please confirm',body:'<p>'+esc(msg)+'</p>',actions:[{label:'Cancel'},{label:label||'Confirm',cls:'danger',fn:()=>{fn()}}]});
}
/* manager PIN override */
function requireManager(reason,cb){
  if(can('discount_override')&&can('refund')){cb(ME);return}
  modal({title:'Manager approval',body:'<p class="muted">'+esc(reason)+'</p><label>Manager PIN<input name="pin" type="password" inputmode="numeric" maxlength="6" autocomplete="off" autofocus></label><p class="err" id="pinErr"></p>',
    enter:el=>$('.btn.primary',el).click(),
    actions:[{label:'Cancel'},{label:'Approve',cls:'primary',fn:el=>{
      const pin=formData(el).pin, u=DB.users.find(x=>x.active&&(x.role==='manager'||x.role==='admin')&&x.pin===pin);
      if(!u){$('#pinErr',el).textContent='Invalid PIN';return false}
      audit('approval',reason+' by '+u.username); cb(u);
    }}]});
}

/* ---------- html building blocks ---------- */
function tbl(cols,rows,empty){
  if(!rows.length)return '<div class="empty">'+esc(empty||'Nothing to show yet.')+'</div>';
  return '<div class="tbl-wrap"><table><thead><tr>'+cols.map(c=>'<th'+(c.cls?' class="'+c.cls+'"':'')+'>'+esc(c.h)+'</th>').join('')+'</tr></thead><tbody>'+
    rows.map(r=>'<tr>'+cols.map(c=>'<td'+(c.cls?' class="'+c.cls+'"':'')+'>'+c.r(r)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
}
const badge=(t,k)=>'<span class="badge '+(k||'')+'">'+esc(t)+'</span>';
function field(label,name,val,opts){
  opts=opts||{}; const t=opts.type||'text';
  return '<label>'+esc(label)+'<input name="'+name+'" type="'+t+'" value="'+esc(val==null?'':val)+'"'+(opts.req?' required':'')+(opts.step?' step="'+opts.step+'"':'')+(opts.min!=null?' min="'+opts.min+'"':'')+(opts.ph?' placeholder="'+esc(opts.ph)+'"':'')+(opts.af?' autofocus':'')+(opts.max?' maxlength="'+opts.max+'"':'')+'></label>';
}
function select(label,name,options,val){
  return '<label>'+esc(label)+'<select name="'+name+'">'+options.map(o=>{const v=Array.isArray(o)?o[0]:o,l=Array.isArray(o)?o[1]:o;return '<option value="'+esc(v)+'"'+(String(v)===String(val)?' selected':'')+'>'+esc(l)+'</option>'}).join('')+'</select></label>';
}
const check=(label,name,val)=>'<label class="chk"><input type="checkbox" name="'+name+'"'+(val?' checked':'')+'> '+esc(label)+'</label>';

function barChart(data,opts){
  opts=opts||{}; const W=640,H=200,pl=44,pb=28,pt=10,pr=8;
  const max=Math.max.apply(null,data.map(d=>d.value).concat([1]));
  const step=Math.pow(10,Math.floor(Math.log10(max))); let top=Math.ceil(max/step)*step; if(top<=0)top=1;
  const bw=(W-pl-pr)/data.length;
  let s='<svg viewBox="0 0 '+W+' '+H+'" class="chart" role="img" aria-label="'+esc(opts.label||'Bar chart')+'">';
  for(let i=0;i<=4;i++){const y=pt+(H-pt-pb)*(1-i/4);s+='<line x1="'+pl+'" x2="'+(W-pr)+'" y1="'+y+'" y2="'+y+'" class="grid"/><text x="'+(pl-6)+'" y="'+(y+4)+'" class="ax" text-anchor="end">'+fmt(top*i/4).replace(/\.00$/,'')+'</text>'}
  data.forEach((d,i)=>{
    const h=(H-pt-pb)*(d.value/top), x=pl+i*bw+bw*0.2, y=H-pb-h;
    s+='<rect x="'+x+'" y="'+y+'" width="'+(bw*0.6)+'" height="'+Math.max(h,0)+'" rx="4" class="bar"><title>'+esc(d.label)+': '+fmt(d.value)+'</title></rect>';
    s+='<text x="'+(x+bw*0.3)+'" y="'+(H-8)+'" class="ax" text-anchor="middle">'+esc(d.label)+'</text>';
  });
  return s+'</svg>';
}

/* ---------- CSV (formula-injection safe) ---------- */
function csvCell(v){
  let s=v==null?'':String(v);
  if(/^[=+\-@\t\r]/.test(s))s="'"+s;
  return /[",\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;
}
function downloadCSV(name,rows){
  const blob=new Blob(['﻿'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name+'.csv'; document.body.appendChild(a); a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);
}
function parseCSV(text){
  const rows=[]; let row=[],cur='',q=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(q){ if(c==='"'){ if(text[i+1]==='"'){cur+='"';i++} else q=false } else cur+=c }
    else if(c==='"')q=true;
    else if(c===','){row.push(cur);cur=''}
    else if(c==='\n'||c==='\r'){ if(c==='\r'&&text[i+1]==='\n')i++; row.push(cur);cur=''; if(row.some(x=>x!==''))rows.push(row); row=[] }
    else cur+=c;
  }
  row.push(cur); if(row.some(x=>x!==''))rows.push(row);
  return rows;
}

/* ---------- receipts ---------- */
function receiptHtml(o){
  const s=DB.settings, cu=byId(DB.customers,o.customerId), ct=byId(DB.counters,o.counterId), taxOn=s.vatPct>0, mode=rLang();
  const nm=l=>{const it=itemById(l.itemId),ar=it&&it.nameAr;return mode==='ar'&&ar?esc(ar):(mode==='both'&&ar?esc(l.name)+'<br><span dir="rtl">'+esc(ar)+'</span>':esc(l.name))};
  const L=o.lines.map(l=>'<tr><td>'+l.qty+'× '+nm(l)+(l.note?'<br><small>'+esc(l.note)+'</small>':'')+'</td><td class="r">'+fmt(r2(l.qty*l.price))+'</td></tr>').join('');
  const D=o.discounts.map(d=>'<tr><td>'+esc(d.label)+'</td><td class="r">-'+fmt(d.amount)+'</td></tr>').join('');
  const C=(o.charges||[]).map(c=>'<tr><td>'+esc(c.name)+' '+c.pct+'%</td><td class="r">'+fmt(c.amount)+'</td></tr>').join('');
  const mname={cash:'Cash',card:'Card',wallet:'Wallet / QR'};
  const P=o.payments.map(p=>'<tr><td>'+esc(mname[p.method]?rt(mname[p.method]):p.method.toUpperCase())+'</td><td class="r">'+fmt(p.tendered!=null?p.tendered:p.amount)+'</td></tr>').join('');
  const title=(taxOn&&s.trn?rt('TAX INVOICE'):rt('RECEIPT'))+(o.status==='refunded'?' — '+rt('REFUNDED'):'');
  return '<div class="rcpt"'+(mode==='ar'?' dir="rtl"':'')+'>'+
    '<div class="c"><strong>'+esc(s.business)+'</strong><br>'+esc(s.address)+(s.phone?'<br>'+esc(s.phone):'')+(s.trn?'<br>'+esc(rt('Tax registration no.'))+': '+esc(s.trn):'')+'</div>'+
    '<div class="c"><strong>'+esc(title)+'</strong></div>'+
    '<div class="meta">#'+esc(o.no)+'<br>'+fmtDT(o.ts)+'<br>'+esc(rt('Cashier'))+': '+esc(userName(o.userId))+(ct?' · '+esc(ct.name):'')+'<br>'+esc(o.type)+(o.table?' · '+esc(rt('Table'))+' '+esc(o.table):'')+(cu?'<br>'+esc(rt('Guest'))+': '+esc(cu.name):'')+'</div>'+
    '<table>'+L+'</table><hr><table>'+
    '<tr><td>'+esc(rt('Subtotal'))+'</td><td class="r">'+fmt(o.subtotal)+'</td></tr>'+D+C+
    (taxOn?'<tr><td>'+esc(rt(taxWord()))+' '+s.vatPct+'% '+(s.taxInclusive?'(incl.)':'')+'</td><td class="r">'+fmt(o.vat)+'</td></tr>':'')+
    '<tr class="tot"><td>'+esc(rt('Total').toUpperCase())+'</td><td class="r">'+esc(s.currency)+' '+fmt(o.total)+'</td></tr></table><hr><table>'+P+
    (o.change>0?'<tr><td>'+esc(rt('Change'))+'</td><td class="r">'+fmt(o.change)+'</td></tr>':'')+'</table>'+
    (cu&&(o.pointsEarned||o.pointsRedeemed)?'<div class="c small">'+esc(rt('Points earned'))+': '+o.pointsEarned+' · '+esc(rt('redeemed'))+': '+o.pointsRedeemed+'</div>':'')+
    (typeof eInvBlock==='function'?eInvBlock(o):'')+'<div class="c small">'+esc(s.footer)+'</div></div>';
}
function printHtml(html){
  let p=$('#printArea'); if(!p){p=document.createElement('div');p.id='printArea';document.body.appendChild(p)}
  p.innerHTML=html; window.print();
}
function showReceipt(o,extra){
  modal({title:'Receipt #'+o.no,body:receiptHtml(o),actions:(extra||[]).concat([{label:'WhatsApp',keep:true,fn:()=>{waReceipt(o);return false}},{label:'Print',cls:'primary',keep:true,fn:()=>{printHtml(receiptHtml(o));return false}},{label:'Close'}])});
}
function zReportHtml(sess){
  const s=DB.settings, st=sessionStats(sess), ct=byId(DB.counters,sess.counterId);
  const T=Object.keys(st.tender).map(k=>'<tr><td>'+esc(k.toUpperCase())+'</td><td class="r">'+fmt(st.tender[k])+'</td></tr>').join('');
  return '<div class="rcpt"><div class="c"><strong>'+esc(s.business)+'</strong><br>Z REPORT — DAY END</div>'+
    '<div class="meta">'+esc(ct?ct.name:'')+'<br>Opened: '+fmtDT(sess.openedAt)+' by '+esc(userName(sess.openedBy))+'<br>Closed: '+fmtDT(sess.closedAt)+(sess.closedBy?' by '+esc(userName(sess.closedBy)):'')+'</div><hr><table>'+
    '<tr><td>Orders</td><td class="r">'+st.orders+'</td></tr><tr><td>Gross sales</td><td class="r">'+fmt(st.gross)+'</td></tr>'+
    '<tr><td>Discounts</td><td class="r">-'+fmt(st.discounts)+'</td></tr><tr><td>VAT</td><td class="r">'+fmt(st.vat)+'</td></tr>'+
    '<tr class="tot"><td>Net sales</td><td class="r">'+fmt(st.net)+'</td></tr></table><hr><strong>Tenders</strong><table>'+T+'</table><hr><table>'+
    '<tr><td>Opening float</td><td class="r">'+fmt(sess.float)+'</td></tr><tr><td>Cash sales</td><td class="r">'+fmt(st.cashSales)+'</td></tr>'+
    '<tr><td>Cash in</td><td class="r">'+fmt(st.vin)+'</td></tr><tr><td>Cash out</td><td class="r">-'+fmt(st.vout)+'</td></tr>'+
    '<tr><td>Cash refunds</td><td class="r">-'+fmt(st.refunds)+'</td></tr><tr class="tot"><td>Expected cash</td><td class="r">'+fmt(st.expected)+'</td></tr>'+
    (sess.counted!=null?'<tr><td>Counted</td><td class="r">'+fmt(sess.counted)+'</td></tr><tr class="tot"><td>Variance</td><td class="r">'+(sess.variance>0?'+':'')+fmt(sess.variance)+'</td></tr>':'')+
    '</table><div class="c small">Refunded orders: '+st.refundedOrders+'</div></div>';
}
