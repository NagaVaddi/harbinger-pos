'use strict';
/* Harbinger Regions — country profiles (GCC first, then a few others and a fully custom option),
   Arabic / RTL, receipt language, first-run setup, and delivery apps by country.
   Profile values are DEFAULTS to be confirmed with the local tax authority: rates and rules change. */

const COUNTRIES={
  AE:{name:'United Arab Emirates',nameAr:'الإمارات العربية المتحدة',cur:'AED',dec:2,vat:5,taxLabel:'VAT',idLabel:'TRN',dial:'971',einv:'AE',
      note:'VAT 5%. E-invoicing is being phased in through accredited service providers (see E-Invoicing page). Service charges and municipality fees differ by emirate and licence — configure under Tax & charges.'},
  SA:{name:'Saudi Arabia',nameAr:'المملكة العربية السعودية',cur:'SAR',dec:2,vat:15,taxLabel:'VAT',idLabel:'VAT registration no.',dial:'966',einv:'SA',
      note:'VAT 15%. ZATCA e-invoicing is mandatory: this app prints the Phase 1 QR code; Phase 2 signing and reporting need ZATCA onboarding.'},
  BH:{name:'Bahrain',nameAr:'مملكة البحرين',cur:'BHD',dec:3,vat:10,taxLabel:'VAT',idLabel:'VAT account no.',dial:'973',einv:'none',
      note:'VAT 10%. Dinar uses 3 decimals. E-invoicing is under development by the National Bureau for Revenue — not yet supported here.'},
  OM:{name:'Oman',nameAr:'سلطنة عُمان',cur:'OMR',dec:3,vat:5,taxLabel:'VAT',idLabel:'VATIN',dial:'968',einv:'OM',
      note:'VAT 5%. Rial uses 3 decimals. Oman is phasing in e-invoicing (Fawtara, Peppol-based); this app produces an unverified UBL draft only.'},
  KW:{name:'Kuwait',nameAr:'الكويت',cur:'KWD',dec:3,vat:0,taxLabel:'',idLabel:'Tax / licence no.',dial:'965',einv:'none',
      note:'No VAT at present. Dinar uses 3 decimals. Receipts are issued without tax lines.'},
  QA:{name:'Qatar',nameAr:'قطر',cur:'QAR',dec:2,vat:0,taxLabel:'',idLabel:'Tax card no.',dial:'974',einv:'none',
      note:'No VAT at present (a GCC-framework VAT has been announced for the future). An e-invoicing law has been approved — not yet supported here.'},
  EG:{name:'Egypt',nameAr:'مصر',cur:'EGP',dec:2,vat:14,taxLabel:'VAT',idLabel:'Tax registration no.',dial:'20',einv:'none',note:'VAT 14%. Egypt has its own mandatory e-receipt / e-invoice system — not supported here.'},
  JO:{name:'Jordan',nameAr:'الأردن',cur:'JOD',dec:3,vat:16,taxLabel:'GST',idLabel:'Tax no.',dial:'962',einv:'none',note:'General sales tax 16%. Dinar uses 3 decimals.'},
  GB:{name:'United Kingdom',nameAr:'المملكة المتحدة',cur:'GBP',dec:2,vat:20,taxLabel:'VAT',idLabel:'VAT number',dial:'44',einv:'none',note:'Standard VAT 20%; hospitality has other rates in some cases — check.'},
  IN:{name:'India',nameAr:'الهند',cur:'INR',dec:2,vat:5,taxLabel:'GST',idLabel:'GSTIN',dial:'91',einv:'none',note:'Restaurant GST rates vary by case; enter the rate that applies to you.'},
  US:{name:'United States',nameAr:'الولايات المتحدة',cur:'USD',dec:2,vat:0,taxLabel:'Sales tax',idLabel:'Tax ID',dial:'1',einv:'none',note:'Sales tax varies by state and city — enter your local rate.'},
  XX:{name:'Other / custom',nameAr:'دولة أخرى / مخصص',cur:'USD',dec:2,vat:0,taxLabel:'Tax',idLabel:'Tax ID',dial:'',einv:'none',note:'Set currency, decimals, tax label and rate yourself.'}
};
const countryList=()=>Object.keys(COUNTRIES).map(k=>[k,COUNTRIES[k].name]);
function applyCountry(code,keepBiz){
  const c=COUNTRIES[code]||COUNTRIES.XX, s=DB.settings;
  s.country=code; s.currency=c.cur; s.decimals=null; s.vatPct=c.vat; s.taxLabel=c.taxLabel; s.countryCode=c.dial||s.countryCode||'';
  s.taxInclusive=true;
  s.einv=Object.assign({},s.einv||{},{region:c.einv});
  if(!keepBiz)s.setupDone=true;
}

/* ================= Languages ================= */
const AR={
  'Command Center':'مركز القيادة','Catalog':'الأصناف','Stock Room':'المخزون','Guests':'العملاء','Promotions':'العروض','Orders':'الطلبات','Outlets & Registers':'الفروع والصناديق','Insights':'التقارير',
  'Accounts':'الحسابات','E-Invoicing':'الفوترة الإلكترونية','Team':'الفريق','Control Panel':'لوحة التحكم','Online & Delivery':'الطلبات الإلكترونية والتوصيل',
  'Operate':'التشغيل','Grow':'النمو','Money':'المالية','Admin':'الإدارة',
  'Search':'بحث','Kitchen display':'شاشة المطبخ','Open POS':'فتح نقطة البيع','Sign out':'تسجيل الخروج',
  'Sign in':'تسجيل الدخول','Username':'اسم المستخدم','Password':'كلمة المرور','Wrong username or password.':'اسم المستخدم أو كلمة المرور غير صحيحة.',
  'Harbinger Register':'صندوق هاربنجر','Held':'معلّقة','Cash in/out':'إيداع / سحب نقدي','Close register':'إغلاق الصندوق','Console':'لوحة الإدارة','Online':'أونلاين',
  'Search item or scan barcode  (F2)':'ابحث عن صنف أو امسح الباركود (F2)','All':'الكل','Dine-in':'داخل المطعم','Takeaway':'سفري','Delivery':'توصيل','+ Guest':'+ عميل',
  'Subtotal':'المجموع الفرعي','Total':'الإجمالي','Promo code':'رمز ترويجي','Remove code':'إزالة الرمز','Discount':'خصم','Points':'النقاط','Hold':'تعليق','Clear':'مسح','Pay':'ادفع',
  'Tap an item or scan a barcode to start.':'اختر صنفاً أو امسح الباركود للبدء.','Out of stock':'غير متوفر','left':'متبقي','+ note':'+ ملاحظة','Table / seat':'الطاولة / المقعد','Ticket':'الطلب',
  'Due':'المستحق','Paid':'المدفوع','Remaining':'المتبقي','Change':'الباقي','Cash':'نقدي','Card':'بطاقة','Wallet / QR':'محفظة / QR','Add payment':'إضافة دفعة','Exact':'المبلغ بالضبط','Complete sale':'إتمام البيع',
  'Payment':'الدفع','Cancel':'إلغاء','Save':'حفظ','Close':'إغلاق','Print':'طباعة','New order':'طلب جديد',
  'TAX INVOICE':'فاتورة ضريبية','RECEIPT':'إيصال','VAT':'ضريبة القيمة المضافة','GST':'ضريبة السلع والخدمات','Cashier':'الكاشير','Guest':'العميل','Table':'طاولة','Points earned':'النقاط المكتسبة','redeemed':'المستبدلة',
  'Tax registration no.':'الرقم الضريبي','REFUNDED':'مسترجع','Thank you':'شكراً لزيارتكم',
  'New':'جديد','Preparing':'قيد التحضير','Ready':'جاهز','Served':'تم التقديم','Start':'ابدأ','Harbinger Kitchen':'مطبخ هاربنجر','open ticket(s)':'طلب مفتوح','Recall last served':'استرجاع آخر طلب',
  'Service charge':'رسوم الخدمة',
  'Customers':'العملاء','Patients':'المرضى','Clients':'العملاء','+ Customer':'+ عميل','+ Patient':'+ مريض','+ Client':'+ عميل','Customer':'العميل','Patient':'المريض','Client':'العميل',
  'In-store':'داخل المتجر','Home delivery':'توصيل منزلي','Products':'المنتجات','Inventory':'المخزون','Inpatient':'مريض داخلي','Outpatient':'مريض خارجي','Bills':'الفواتير','Collect':'تحصيل','Open billing':'فتح الفوترة',
  'Pharmacy stock':'مخزون الصيدلية','Pharmacy & supplies':'الصيدلية والمستلزمات','Appointment':'موعد','Walk-in':'بدون موعد','Services & items':'الخدمات والأصناف','Services & products':'الخدمات والمنتجات','Medicines & products':'الأدوية والمنتجات',
  'Over the counter':'بدون وصفة','Home visit':'زيارة منزلية','Harbinger Billing':'فوترة هاربنجر','Harbinger Salon POS':'نقطة بيع هاربنجر للصالون'
};
let LANG='en'; try{LANG=localStorage.getItem('hb_lang')==='ar'?'ar':'en'}catch(e){}
const tr=s=>{if(typeof bizTerm==='function'){const t=bizTerm(s);if(t)s=t}return LANG==='ar'&&AR[s]?AR[s]:s};
const dn=it=>LANG==='ar'&&it&&it.nameAr?it.nameAr:(it?it.name:'');
const rLang=()=>(DB&&DB.settings.receiptLang)||'en';
const rt=s=>{const m=rLang();return m==='ar'?(AR[s]||s):(m==='both'&&AR[s]?s+' / '+AR[s]:s)};
const taxWord=()=>DB.settings.taxLabel||'Tax';
function applyLang(){const h=document.documentElement;h.setAttribute('lang',LANG);h.setAttribute('dir',LANG==='ar'?'rtl':'ltr')}
A['lang-toggle']=()=>{LANG=LANG==='ar'?'en':'ar';try{localStorage.setItem('hb_lang',LANG)}catch(e){}applyLang();render()};

/* ================= First-run setup & country settings ================= */
function setupWizard(){
  const s=DB.settings;
  modal({title:'Welcome to Harbinger — set up your country',wide:true,sticky:true,
    body:'<p class="muted">Choose where you trade. This sets currency, decimals, tax rate and e-invoicing region. You can change everything later in Control Panel.</p><div class="form2">'+
      select('Country','country',countryList(),s.country||'AE')+field('Business name','business',s.business)+field('Tax registration no.','trn',s.trn)+field('Phone dialling code (WhatsApp)','dial',s.countryCode||'')+'</div><div id="cNote" class="sm muted"></div>',
    onOpen:el=>{const sel=$('[name=country]',el),note=$('#cNote',el),dial=$('[name=dial]',el);const upd=()=>{const c=COUNTRIES[sel.value];note.textContent=c.cur+' · '+c.dec+' decimals · '+(c.vat?c.taxLabel+' '+c.vat+'%':'no tax')+' — '+c.note;dial.value=c.dial||dial.value};sel.addEventListener('change',upd);upd()},
    actions:[{label:'Keep my current settings',fn:()=>{DB.settings.setupDone=true;save();render()}},{label:'Apply & continue',cls:'primary',fn:el=>{
      const f=formData(el);applyCountry(f.country);DB.settings.business=f.business.trim()||DB.settings.business;DB.settings.trn=f.trn.trim();if(f.dial.trim())DB.settings.countryCode=f.dial.replace(/\D/g,'');
      audit('setup','country '+f.country);save();toast('Country settings applied');render()}}]});
}
function maybeSetup(){if(ME&&ME.role==='admin'&&!DB.settings.setupDone&&!UIS.setupShown&&!$('.modal-back')){UIS.setupShown=true;setTimeout(setupWizard,200)}}
A['country-apply']=()=>{
  const code=($('#setForm [name=country]')||{}).value; if(!code)return;
  confirmBox('Apply '+COUNTRIES[code].name+' defaults? This changes currency, decimals, tax rate/label, WhatsApp code and the e-invoicing region. Your business name, items and data are kept.',()=>{applyCountry(code,true);audit('country.apply',code);save();toast(COUNTRIES[code].note.slice(0,120));render()},'Apply');
};

/* ================= Delivery apps by country (indicative; verify availability) ================= */
const CHANNELS=[['talabat','Talabat',['AE','KW','BH','OM','QA','EG','JO']],['deliveroo','Deliveroo',['AE','KW','QA','GB']],['careem','Careem',['AE','SA','QA','EG','JO']],['noon','Noon Food',['AE','SA']],
  ['hungerstation','HungerStation',['SA','KW','BH']],['jahez','Jahez',['SA','KW','BH','OM']],['keeta','Keeta',['SA','AE','QA','KW']],['mrsool','Mrsool',['SA']],['toyou','ToYou',['SA']],['thechefz','The Chefz',['SA']],
  ['snoonu','Snoonu',['QA']],['carriage','Carriage',['KW']],['other','Other app',[]]];
