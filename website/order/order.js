'use strict';
/* Harbinger storefront — customer ordering page (QR table ordering, pickup, delivery).
   Talks only to the gateway's public API. All text is inserted with textContent (no HTML injection). */
(function(){
  var API='';  // same origin as the gateway
  var T={
    en:{menu:'Menu',cart:'Cart',view:'View cart',add:'Add',empty:'Your cart is empty',checkout:'Checkout',type:'Order type',pickup:'Pickup',delivery:'Delivery',dinein:'Dine-in',
      name:'Your name',phone:'Phone number',address:'Delivery address',note:'Notes for the restaurant',place:'Place order',total:'Total',deliveryFee:'Delivery fee',subtotal:'Subtotal',
      payNote:'Pay on delivery / at the counter. Taxes and any service charges are confirmed by the restaurant.',table:'Table',closed:'We are not taking online orders right now.',unavail:'Unavailable',close:'Close',
      received:'Order received',trackCode:'Your tracking code',s_new:'Waiting for the restaurant to accept your order…',s_accepted:'Your order was accepted',s_preparing:'Being prepared',s_ready:'Ready',s_out:'Out for delivery',s_delivered:'Completed — enjoy!',
      s_rejected:'Sorry, the restaurant could not accept this order.',s_cancelled:'This order was cancelled.',newOrder:'Order again',eta:'Estimated time',min:'min',loadFail:'Could not load the menu. Please try again.',sending:'Sending…',minOrder:'Minimum order for delivery is'},
    ar:{menu:'القائمة',cart:'السلة',view:'عرض السلة',add:'إضافة',empty:'سلتك فارغة',checkout:'إتمام الطلب',type:'نوع الطلب',pickup:'استلام',delivery:'توصيل',dinein:'داخل المطعم',
      name:'الاسم',phone:'رقم الهاتف',address:'عنوان التوصيل',note:'ملاحظات للمطعم',place:'إرسال الطلب',total:'الإجمالي',deliveryFee:'رسوم التوصيل',subtotal:'المجموع الفرعي',
      payNote:'الدفع عند الاستلام أو عند الكاشير. يؤكد المطعم الضرائب ورسوم الخدمة إن وجدت.',table:'طاولة',closed:'لا نستقبل الطلبات عبر الإنترنت حالياً.',unavail:'غير متوفر',close:'إغلاق',
      received:'تم استلام الطلب',trackCode:'رمز تتبع طلبك',s_new:'بانتظار قبول المطعم لطلبك…',s_accepted:'تم قبول طلبك',s_preparing:'قيد التحضير',s_ready:'جاهز',s_out:'في الطريق إليك',s_delivered:'تم — بالهناء والشفاء!',
      s_rejected:'عذراً، لم يتمكن المطعم من قبول الطلب.',s_cancelled:'تم إلغاء الطلب.',newOrder:'اطلب مرة أخرى',eta:'الوقت المتوقع',min:'دقيقة',loadFail:'تعذر تحميل القائمة. حاول مرة أخرى.',sending:'جارٍ الإرسال…',minOrder:'الحد الأدنى للتوصيل'}
  };
  var lang=(function(){try{return localStorage.getItem('hb_lang')||(navigator.language||'en').slice(0,2)}catch(e){return 'en'}})(); if(lang!=='ar')lang='en';
  var t=function(k){return T[lang][k]||T.en[k]||k};
  var S={menu:null,cat:null,cart:{},type:'pickup',table:new URLSearchParams(location.search).get('t')||'',view:'menu',track:null,tracking:null,err:'',busy:false};
  try{S.track=localStorage.getItem('hb_track')}catch(e){}
  if(!/^[A-Za-z0-9 _-]{1,12}$/.test(S.table))S.table='';
  if(S.table)S.type='dine-in';
  var app=document.getElementById('app'), timer=null;

  function h(tag,attrs,kids){
    var e=document.createElement(tag);
    Object.keys(attrs||{}).forEach(function(k){
      var v=attrs[k]; if(v==null||v===false)return;
      if(k==='class')e.className=v; else if(k==='text')e.textContent=v; else if(k.indexOf('on')===0)e.addEventListener(k.slice(2),v); else e.setAttribute(k,v===true?'':v);
    });
    (kids||[]).forEach(function(c){if(c==null)return;e.appendChild(typeof c==='string'?document.createTextNode(c):c)});
    return e;
  }
  var money=function(n){var d=S.menu&&Number.isInteger(S.menu.decimals)?S.menu.decimals:2;return (S.menu?S.menu.currency+' ':'')+Number(n).toFixed(d)};
  var nm=function(i){return (lang==='ar'&&i.nameAr)?i.nameAr:i.name};
  function cartLines(){
    if(!S.menu)return [];
    return Object.keys(S.cart).map(function(id){var it=S.menu.items.filter(function(x){return x.id===id})[0];return it&&S.cart[id]>0?{it:it,qty:S.cart[id]}:null}).filter(Boolean);
  }
  function totals(){
    var sub=cartLines().reduce(function(a,l){return a+l.it.price*l.qty},0), fee=S.type==='delivery'?(+S.menu.online.deliveryFee||0):0;
    return {sub:sub,fee:fee,total:Math.round((sub+fee)*100)/100,count:cartLines().reduce(function(a,l){return a+l.qty},0)};
  }
  function setLang(l){lang=l;try{localStorage.setItem('hb_lang',l)}catch(e){}render()}

  function header(){
    return h('header',{class:'top'},[
      h('div',null,[h('h1',{text:S.menu?S.menu.business:'…'}),S.table&&S.menu?h('span',{class:'badge',text:t('table')+' '+S.table}):null]),
      h('button',{class:'lang',type:'button',onclick:function(){setLang(lang==='ar'?'en':'ar')},'aria-label':'Language',text:lang==='ar'?'English':'العربية'})
    ]);
  }
  function itemCard(i){
    var q=S.cart[i.id]||0;
    var ctrl=!i.available?h('span',{class:'muted',text:t('unavail')}):q>0?
      h('span',{class:'qty'},[h('button',{type:'button','aria-label':'-',onclick:function(){chg(i.id,-1)},text:'−'}),h('b',{text:String(q)}),h('button',{type:'button','aria-label':'+',onclick:function(){chg(i.id,1)},text:'+'})]):
      h('button',{class:'btn primary',type:'button',onclick:function(){chg(i.id,1)},text:t('add')});
    return h('div',{class:'item'},[h('h3',{text:nm(i)}),h('div',{class:'row'},[h('span',{class:'price',text:money(i.price)}),ctrl])]);
  }
  function chg(id,d){var v=Math.max(0,Math.min(50,(S.cart[id]||0)+d));if(v)S.cart[id]=v;else delete S.cart[id];persistCart();render()}
  function persistCart(){try{sessionStorage.setItem('hb_cart',JSON.stringify(S.cart))}catch(e){}}

  function menuView(){
    var cats=S.menu.categories.filter(function(c){return S.menu.items.some(function(i){return i.categoryId===c.id})});
    if(!S.cat||!cats.some(function(c){return c.id===S.cat}))S.cat=cats[0]&&cats[0].id;
    var tt=totals();
    var root=h('div',null,[header(),
      !S.menu.online.open?h('div',{class:'closed',text:t('closed')}):null,
      h('nav',{class:'cats'},cats.map(function(c){return h('button',{type:'button',class:c.id===S.cat?'on':'',onclick:function(){S.cat=c.id;render()},text:(lang==='ar'&&c.nameAr)?c.nameAr:c.name})})),
      h('main',null,[h('div',{class:'grid'},S.menu.items.filter(function(i){return i.categoryId===S.cat}).map(itemCard))]),
      tt.count?h('div',{class:'cartbar'},[h('div',null,[h('b',{text:tt.count+' × '}),h('span',{text:money(tt.sub)})]),h('button',{class:'btn primary',type:'button',onclick:function(){S.view='checkout';render()},text:t('view')})]):null]);
    return root;
  }
  function field(label,id,attrs,tag){
    var el=h(tag||'input',Object.assign({id:id,name:id},attrs||{}));
    return h('label',{for:id},[label,el]);
  }
  function checkoutView(){
    var tt=totals(), o=S.menu.online, types=[['pickup',t('pickup'),o.pickup],['delivery',t('delivery'),o.delivery],['dine-in',t('dinein'),o.dineIn&&!!S.table]].filter(function(x){return x[2]});
    if(!types.some(function(x){return x[0]===S.type}))S.type=types[0]?types[0][0]:'pickup';
    var saved={};try{saved=JSON.parse(localStorage.getItem('hb_cust')||'{}')}catch(e){}
    saved=Object.assign(saved,S.draft||{});
    var errBox=h('p',{class:'err',role:'alert',text:S.err});
    var form=h('form',{novalidate:true,onsubmit:function(e){e.preventDefault();submit(form,errBox)}},[
      h('div',{class:'types',role:'group','aria-label':t('type')},types.map(function(x){return h('button',{type:'button',class:S.type===x[0]?'on':'',onclick:function(){S.type=x[0];render()},text:x[1]})})),
      field(t('name'),'name',{required:true,maxlength:60,autocomplete:'name',value:saved.name||''}),
      field(t('phone'),'phone',{required:true,type:'tel',maxlength:20,autocomplete:'tel',inputmode:'tel',value:saved.phone||''}),
      S.type==='delivery'?field(t('address'),'address',{required:true,maxlength:200,autocomplete:'street-address',value:saved.address||''}):null,
      field(t('note'),'note',{maxlength:200,value:saved.note||''}),
      h('div',null,cartLines().map(function(l){return h('div',{class:'line'},[h('span',{text:l.qty+' × '+nm(l.it)}),h('span',{text:money(l.it.price*l.qty)})])})),
      h('div',{class:'line'},[h('span',{text:t('subtotal')}),h('span',{text:money(tt.sub)})]),
      tt.fee?h('div',{class:'line'},[h('span',{text:t('deliveryFee')}),h('span',{text:money(tt.fee)})]):null,
      h('div',{class:'tot'},[h('span',{text:t('total')}),h('span',{text:money(tt.total)})]),
      h('p',{class:'muted',text:t('payNote')}),errBox,
      h('button',{class:'btn primary',type:'submit',disabled:S.busy||!o.open,text:S.busy?t('sending'):t('place')})
    ]);
    return h('div',null,[header(),h('div',{class:'sheet'},[h('div',{class:'panel',role:'dialog','aria-modal':'true','aria-label':t('checkout')},[
      h('div',{class:'line'},[h('h2',{text:t('checkout')}),h('button',{class:'btn ghost',type:'button',onclick:function(){S.view='menu';S.err='';render()},text:t('close')})]),form])])]);
  }
  function submit(form,errBox){
    var fd=new FormData(form), tt=totals(); if(S.busy)return;
    var body={type:S.type,table:S.type==='dine-in'?S.table:'',customer:{name:fd.get('name'),phone:fd.get('phone'),address:fd.get('address')||''},note:fd.get('note')||'',
      lines:cartLines().map(function(l){return {itemId:l.it.id,qty:l.qty}}),clientId:S.clientId||(S.clientId=Math.random().toString(36).slice(2)+Date.now().toString(36))};
    if(S.type==='delivery'&&tt.sub<(+S.menu.online.minOrder||0)){S.err=t('minOrder')+' '+money(S.menu.online.minOrder);errBox.textContent=S.err;return}
    S.busy=true;S.err='';render();
    fetch(API+'/api/public/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(function(r){return r.json().then(function(j){return {ok:r.ok,j:j}})}).then(function(x){
      S.busy=false;
      if(!x.ok){S.err=(x.j&&x.j.error)||'Error';render();return}
      try{localStorage.setItem('hb_track',x.j.track);localStorage.setItem('hb_cust',JSON.stringify({name:body.customer.name,phone:body.customer.phone}))}catch(e){}
      S.track=x.j.track;S.tracking=x.j;S.cart={};persistCart();S.clientId=null;S.view='track';render();poll();
    }).catch(function(){S.busy=false;S.err='Network error. Please try again.';render()});
  }
  function trackView(){
    var st=S.tracking||{status:'new'}, order=['new','accepted','preparing','ready','out','delivered'], idx=order.indexOf(st.status);
    var text=t('s_'+st.status)||st.status;
    return h('div',null,[header(),h('div',{class:'track'},[h('h2',{text:t('received')}),h('p',{class:'muted',text:t('trackCode')}),h('div',{class:'code',text:S.track||''}),
      h('div',{class:'steps','aria-hidden':'true'},order.map(function(s,i){return h('span',{class:'step'+(i<=idx?' on':'')})})),
      h('p',{text:text,role:'status'}),st.etaMins&&['delivered','rejected','cancelled'].indexOf(st.status)<0?h('p',{class:'muted',text:t('eta')+': ~'+st.etaMins+' '+t('min')}):null,
      h('button',{class:'btn primary',type:'button',onclick:function(){S.view='menu';S.tracking=null;S.track=null;try{localStorage.removeItem('hb_track')}catch(e){}render()},text:t('newOrder')})])]);
  }
  function poll(){
    clearTimeout(timer); if(S.view!=='track'||!S.track)return;
    fetch(API+'/api/public/orders/'+encodeURIComponent(S.track)).then(function(r){return r.ok?r.json():null}).then(function(j){
      if(!j){S.view='menu';S.track=null;S.tracking=null;try{localStorage.removeItem('hb_track')}catch(e){}render();return}
      S.tracking=j;render();
      if(['delivered','rejected','cancelled'].indexOf(j.status)<0)timer=setTimeout(poll,8000);
    }).catch(function(){timer=setTimeout(poll,15000)});
  }
  function render(){
    if(S.view==='checkout'){var dr={};['name','phone','address','note'].forEach(function(k){var el=document.getElementById(k);if(el)dr[k]=el.value});if(Object.keys(dr).length)S.draft=Object.assign(S.draft||{},dr)}
    document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';
    var ae=document.activeElement, id=ae&&ae.id, v=ae&&ae.value;
    var node=!S.menu?h('p',{class:'msg',text:t('loadFail')}):S.view==='track'?trackView():S.view==='checkout'?checkoutView():menuView();
    app.replaceChildren(node);
    if(id){var el=document.getElementById(id);if(el){el.focus();if(v!=null&&'value' in el&&!el.value)el.value=v}}
  }
  function init(){
    try{S.cart=JSON.parse(sessionStorage.getItem('hb_cart')||'{}')}catch(e){S.cart={}}
    fetch(API+'/api/public/menu').then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(m){
      S.menu=m;document.title=m.business;
      if(S.track){S.view='track';S.tracking=null;poll()}
      render();
    }).catch(function(){render()});
  }
  init();
})();
