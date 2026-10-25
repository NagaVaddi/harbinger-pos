'use strict';
/* Harbinger Business Types — one product, six industry profiles.
   A profile sets: terminology, which modules/screens exist, register behaviour, sample catalogue and the dashboard layout.
   Healthcare note: the clinic/hospital profile is for BILLING only (services, payers, providers). It stores no clinical data. */

const MOD0={kitchen:0,tables:0,online:1,delivery:1,scanFirst:0,weighed:0,expiry:0,rx:0,insurance:0,provider:0,variants:0};
const BIZ={
  restaurant:{name:'Restaurant / Café',desc:'Tables, kitchen display, dine-in, takeaway and delivery',icon:'🍽️',modules:{kitchen:1,tables:1,expiry:1},types:['dine-in','takeaway','delivery'],defType:'takeaway',minMargin:15,blockExpired:true,
    terms:{},dash:[['brief'],['trend','heat'],['mixCh','mixPay','mixCat'],['top','leaders'],['ops','money'],['recent']]},
  supermarket:{name:'Supermarket / Grocery',desc:'Barcode-first checkout, weighed items, expiry control, home delivery',icon:'🛒',modules:{scanFirst:1,weighed:1,expiry:1},types:['takeaway','delivery'],defType:'takeaway',minMargin:8,blockExpired:true,
    terms:{'Guests':'Customers','+ Guest':'+ Customer','Takeaway':'In-store','Delivery':'Home delivery','Catalog':'Products','Stock Room':'Inventory','Guest':'Customer'},
    dash:[['brief'],['trend','basket'],['fastslow','expiry'],['stockout','mixCat'],['mixPay','leaders'],['ops','money'],['recent']]},
  retail:{name:'Retail store',desc:'Fashion, electronics, gifts — sizes/colours, scanning, returns',icon:'🛍️',modules:{scanFirst:1,variants:1},types:['takeaway','delivery'],defType:'takeaway',minMargin:25,blockExpired:false,
    terms:{'Guests':'Customers','+ Guest':'+ Customer','Takeaway':'In-store','Delivery':'Home delivery','Catalog':'Products','Stock Room':'Inventory','Guest':'Customer'},
    dash:[['brief'],['trend','catmargin'],['sellthru','fastslow'],['top','leaders'],['stockout','mixPay'],['ops','money'],['recent']]},
  pharmacy:{name:'Pharmacy',desc:'Prescription register, controlled drugs, batch & expiry, insurance',icon:'💊',modules:{scanFirst:1,expiry:1,rx:1,insurance:1},types:['takeaway','delivery'],defType:'takeaway',minMargin:10,blockExpired:true,
    terms:{'Guests':'Customers','+ Guest':'+ Customer','Takeaway':'Over the counter','Delivery':'Home delivery','Catalog':'Medicines & products','Stock Room':'Pharmacy stock','Guest':'Customer'},
    dash:[['brief'],['trend','rxsplit'],['expiry','stockout'],['top','payer'],['mixPay','leaders'],['ops','money'],['recent']]},
  clinic:{name:'Clinic / Hospital billing',desc:'Services by department, doctors, insurance co-pay and claims (billing only — no medical records)',icon:'🏥',modules:{provider:1,insurance:1,expiry:1,rx:1,online:0,delivery:0},types:['takeaway','dine-in'],defType:'takeaway',minMargin:0,blockExpired:true,
    terms:{'Guests':'Patients','+ Guest':'+ Patient','Guest':'Patient','Dine-in':'Inpatient','Takeaway':'Outpatient','Orders':'Bills','Catalog':'Services & items','Stock Room':'Pharmacy & supplies','Harbinger Register':'Harbinger Billing','Pay':'Collect','Open POS':'Open billing'},
    dash:[['brief'],['trend','dept'],['providers','payer'],['top','mixPay'],['ops','money'],['recent']]},
  salon:{name:'Salon / Spa / Services',desc:'Services by stylist or therapist, commissions, repeat clients',icon:'💇',modules:{provider:1,online:0,delivery:0},types:['takeaway','dine-in'],defType:'takeaway',minMargin:0,blockExpired:false,
    terms:{'Guests':'Clients','+ Guest':'+ Client','Guest':'Client','Takeaway':'Walk-in','Dine-in':'Appointment','Catalog':'Services & products','Harbinger Register':'Harbinger Salon POS'},
    dash:[['brief'],['trend','heat'],['svcmix','providers'],['mixPay','leaders'],['money'],['recent']]}
};
const bizType=()=>(typeof DB!=='undefined'&&DB&&DB.settings&&BIZ[DB.settings.businessType])?DB.settings.businessType:'restaurant';
const biz=()=>BIZ[bizType()];
const bm=k=>{const m=biz().modules;return m[k]!=null?m[k]:MOD0[k]};
const bizTerm=s=>biz().terms[s]||null;
const typeLabel=t=>tr(({'dine-in':'Dine-in','takeaway':'Takeaway','delivery':'Delivery'})[t]||t);

/* ================= sample catalogues ================= */
/* item row: [name, arabic, categoryIndex, price, cost, options]   options: weighed, plu, rx, controlled, kind, group, variant, track, qty, exp (days, null = none), tax, unit */
const CATALOGS={
  supermarket:{code:'1',prefix:'SM',exp:180,business:'Harbinger Demo Supermarket',
    cats:[['Fresh produce','خضار وفواكه'],['Dairy & eggs','ألبان وبيض'],['Bakery','مخبوزات'],['Meat & poultry','لحوم ودواجن'],['Beverages','مشروبات'],['Pantry','المؤن'],['Household','مستلزمات المنزل'],['Snacks','تسالي']],
    items:[
      ['Tomatoes','طماطم',0,6.5,4.2,{weighed:1,plu:'10001',exp:5}],['Bananas','موز',0,5.9,3.8,{weighed:1,plu:'10002',exp:6}],['Red onions','بصل أحمر',0,3.5,2.2,{weighed:1,plu:'10003',exp:30}],['Potatoes','بطاطس',0,3.2,2.0,{weighed:1,plu:'10004',exp:30}],['Red apples','تفاح أحمر',0,9.5,6.5,{weighed:1,plu:'10005',exp:14}],['Cucumber','خيار',0,4.0,2.5,{weighed:1,plu:'10006',exp:7}],
      ['Fresh milk 1L','حليب طازج ١ لتر',1,6.5,5.0,{exp:14}],['Laban 1L','لبن ١ لتر',1,5.5,4.0,{exp:14}],['Eggs tray (30)','بيض ٣٠ حبة',1,17,13.5,{exp:21}],['Cheese slices 200g','شرائح جبن ٢٠٠ جم',1,9,6.5,{exp:90}],['Yogurt 1kg','زبادي ١ كجم',1,8.5,6,{exp:21}],
      ['Arabic bread','خبز عربي',2,3,1.8,{exp:2,qty:60}],['Toast bread','خبز توست',2,5.5,3.5,{exp:5}],
      ['Whole chicken (per kg)','دجاج كامل (للكيلو)',3,14,10.5,{weighed:1,plu:'20001',exp:4}],['Beef mince (per kg)','لحم بقري مفروم (للكيلو)',3,38,29,{weighed:1,plu:'20002',exp:3}],
      ['Water 1.5L','مياه ١.٥ لتر',4,2,1.1,{exp:365,qty:200}],['Cola 330ml','كولا ٣٣٠ مل',4,2.5,1.6,{exp:270,qty:150}],['Orange juice 1L','عصير برتقال ١ لتر',4,7.5,5.2,{exp:60}],['Tea bags (100)','شاي ١٠٠ كيس',4,12,8.5,{exp:540}],
      ['Basmati rice 5kg','أرز بسمتي ٥ كجم',5,32,25,{exp:720}],['Sugar 2kg','سكر ٢ كجم',5,8.5,6.5,{exp:720}],['Cooking oil 1.8L','زيت طبخ ١.٨ لتر',5,19,15,{exp:540}],['Pasta 500g','معكرونة ٥٠٠ جم',5,4.5,3,{exp:540}],['Tuna can','تونة معلبة',5,7.5,5.2,{exp:900}],['Wheat flour 2kg','دقيق قمح ٢ كجم',5,7,5,{exp:360}],
      ['Dishwashing liquid 750ml','سائل جلي ٧٥٠ مل',6,9.5,6.5,{exp:null}],['Tissue box','علبة مناديل',6,4.5,2.8,{exp:null,qty:120}],['Garbage bags (30)','أكياس قمامة ٣٠',6,7,4.2,{exp:null}],
      ['Potato chips','شيبس',7,3.5,2.2,{exp:180,qty:100}],['Chocolate bar','لوح شوكولاتة',7,4,2.4,{exp:365,qty:100}]],
    customers:[['Aisha Khan','0501100001',{}],['Omar Saleh','0501100002',{}],['Priya Nair','0501100003',{}]],providers:[],
    offers:[{id:'o1',name:'Spend 200, save 5%',type:'order_pct',value:5,min:200,active:true,startTime:'',endTime:'',startDate:'',endDate:''}]},
  retail:{code:'2',prefix:'RT',exp:null,business:'Harbinger Demo Store',
    cats:[['Men','رجال'],['Women','نساء'],['Kids','أطفال'],['Shoes','أحذية'],['Accessories','إكسسوارات'],['Electronics','إلكترونيات']],
    items:[
      ['Basic T-Shirt — S','تيشيرت — S',0,45,18,{group:'Basic T-Shirt',variant:'S',qty:12}],['Basic T-Shirt — M','تيشيرت — M',0,45,18,{group:'Basic T-Shirt',variant:'M',qty:20}],['Basic T-Shirt — L','تيشيرت — L',0,45,18,{group:'Basic T-Shirt',variant:'L',qty:18}],['Basic T-Shirt — XL','تيشيرت — XL',0,45,18,{group:'Basic T-Shirt',variant:'XL',qty:6}],
      ['Slim Jeans — 32','جينز — 32',0,129,55,{group:'Slim Jeans',variant:'32',qty:9}],['Slim Jeans — 34','جينز — 34',0,129,55,{group:'Slim Jeans',variant:'34',qty:11}],['Slim Jeans — 36','جينز — 36',0,129,55,{group:'Slim Jeans',variant:'36',qty:4}],
      ['Summer Dress — S','فستان صيفي — S',1,159,70,{group:'Summer Dress',variant:'S',qty:7}],['Summer Dress — M','فستان صيفي — M',1,159,70,{group:'Summer Dress',variant:'M',qty:9}],['Summer Dress — L','فستان صيفي — L',1,159,70,{group:'Summer Dress',variant:'L',qty:5}],
      ['Kids Hoodie — 4-6y','هودي أطفال — 4-6',2,79,32,{group:'Kids Hoodie',variant:'4-6y',qty:8}],['Kids Hoodie — 7-9y','هودي أطفال — 7-9',2,79,32,{group:'Kids Hoodie',variant:'7-9y',qty:8}],
      ['Sneakers — 40','حذاء رياضي — 40',3,249,115,{group:'Sneakers',variant:'40',qty:5}],['Sneakers — 42','حذاء رياضي — 42',3,249,115,{group:'Sneakers',variant:'42',qty:8}],['Sneakers — 44','حذاء رياضي — 44',3,249,115,{group:'Sneakers',variant:'44',qty:3}],
      ['Leather wallet','محفظة جلد',4,89,35,{}],['Cap','قبعة',4,39,14,{}],['Sunglasses','نظارة شمسية',4,99,38,{}],['Perfume 50ml','عطر ٥٠ مل',4,179,80,{}],
      ['Phone case','غطاء هاتف',5,35,9,{qty:60}],['Wireless earphones','سماعات لاسلكية',5,129,58,{}],['Power bank 10000mAh','شاحن متنقل',5,99,45,{}]],
    customers:[['Fatima Al Mansoori','0501100001',{}],['Hassan Al Zaabi','0501100002',{}]],providers:[],
    offers:[{id:'o1',name:'Weekend 10% off orders over 250',type:'order_pct',value:10,min:250,active:false,startTime:'',endTime:'',startDate:'',endDate:''}]},
  pharmacy:{code:'3',prefix:'PH',exp:540,business:'Harbinger Demo Pharmacy',
    cats:[['Prescription (Rx)','أدوية بوصفة'],['Over the counter','أدوية بدون وصفة'],['Vitamins & supplements','فيتامينات ومكملات'],['Baby & mother','الأم والطفل'],['Personal care','عناية شخصية'],['Medical devices','أجهزة طبية']],
    items:[
      ['Amoxicillin 500mg caps','أموكسيسيلين ٥٠٠ ملغ',0,18,9,{rx:1,exp:600}],['Atorvastatin 20mg','أتورفاستاتين ٢٠ ملغ',0,42,24,{rx:1,exp:700}],['Metformin 500mg','ميتفورمين ٥٠٠ ملغ',0,15,7.5,{rx:1,exp:720}],['Omeprazole 20mg','أوميبرازول ٢٠ ملغ',0,22,11,{rx:1,exp:650}],['Tramadol 50mg','ترامادول ٥٠ ملغ',0,28,15,{rx:1,controlled:1,exp:500,qty:30}],
      ['Paracetamol 500mg x24','باراسيتامول ٥٠٠ ملغ',1,7.5,3.5,{exp:800,qty:120}],['Ibuprofen 400mg x20','إيبوبروفين ٤٠٠ ملغ',1,12,6,{exp:700}],['Cough syrup 120ml','شراب كحة ١٢٠ مل',1,16,8,{exp:400}],['Antacid tablets','أقراص مضاد حموضة',1,9,4.5,{exp:500}],['Allergy tablets x10','أقراص حساسية',1,14,7,{exp:600}],
      ['Vitamin C 1000mg x30','فيتامين سي ١٠٠٠',2,38,20,{exp:700}],['Vitamin D3 5000IU','فيتامين د٣',2,45,25,{exp:720}],['Omega-3 1000mg','أوميغا ٣',2,65,35,{exp:640}],['Multivitamin x60','مالتي فيتامين',2,55,30,{exp:660}],
      ['Baby diapers size 3','حفاضات أطفال مقاس ٣',3,59,42,{exp:900}],['Baby wipes','مناديل مبللة',3,12,7,{exp:700}],
      ['Hand sanitizer 250ml','معقم يدين ٢٥٠ مل',4,11,5,{exp:540,qty:80}],['Sunscreen SPF50','واقي شمس',4,68,38,{exp:600}],['Toothpaste','معجون أسنان',4,14,7,{exp:800}],
      ['Digital thermometer','ميزان حرارة رقمي',5,29,14,{exp:null}],['Blood pressure monitor','جهاز ضغط',5,149,80,{exp:null,qty:8}],['Face masks x50','كمامات ٥٠',5,19,8,{exp:900,qty:100}],['Glucose test strips x50','شرائط فحص السكر',5,79,48,{exp:300}]],
    customers:[['Mariam Al Hashimi','0501100001',{insurer:'Gulf Health Insurance',policy:'GH-77120',copay:20}],['Yusuf Khan','0501100002',{}],['Layla Haddad','0501100003',{insurer:'National Care Insurance',policy:'NC-31877',copay:10}]],providers:[],
    offers:[], extraLots:[['Cough syrup 120ml',9,20,'NEAR'],['Antacid tablets',6,-10,'EXPD']]},
  clinic:{code:'4',prefix:'CL',exp:540,business:'Harbinger Demo Clinic',
    cats:[['Consultation','الاستشارات'],['Laboratory','المختبر'],['Radiology','الأشعة'],['Procedures','الإجراءات'],['Dental','الأسنان'],['Pharmacy','الصيدلية'],['Inpatient','التنويم']],
    items:[
      ['GP consultation','استشارة طبيب عام',0,150,0,{kind:'service',track:false,tax:false}],['Specialist consultation','استشارة أخصائي',0,300,0,{kind:'service',track:false,tax:false}],['Follow-up visit','زيارة متابعة',0,100,0,{kind:'service',track:false,tax:false}],
      ['CBC blood test','تحليل صورة دم كاملة',1,60,15,{kind:'service',track:false,tax:false}],['Lipid profile','فحص الدهون',1,95,25,{kind:'service',track:false,tax:false}],['HbA1c','السكر التراكمي',1,85,22,{kind:'service',track:false,tax:false}],['Vitamin D test','فحص فيتامين د',1,120,35,{kind:'service',track:false,tax:false}],
      ['Chest X-ray','أشعة صدر',2,140,30,{kind:'service',track:false,tax:false}],['Abdominal ultrasound','سونار بطن',2,220,45,{kind:'service',track:false,tax:false}],['MRI knee','رنين مغناطيسي للركبة',2,1100,300,{kind:'service',track:false,tax:false}],
      ['ECG','رسم قلب',3,90,15,{kind:'service',track:false,tax:false}],['Wound dressing','تضميد جرح',3,50,12,{kind:'service',track:false,tax:false}],['Injection administration','إعطاء حقنة',3,35,5,{kind:'service',track:false,tax:false}],['Physiotherapy session','جلسة علاج طبيعي',3,180,40,{kind:'service',track:false,tax:false}],
      ['Dental cleaning','تنظيف أسنان',4,250,50,{kind:'service',track:false,tax:false}],['Dental filling','حشو أسنان',4,350,80,{kind:'service',track:false,tax:false}],
      ['Paracetamol 500mg x24','باراسيتامول ٥٠٠ ملغ',5,7.5,3.5,{exp:800,qty:100,tax:false}],['Amoxicillin 500mg caps','أموكسيسيلين ٥٠٠ ملغ',5,18,9,{rx:1,exp:600,tax:false}],['Saline infusion 500ml','محلول وريدي ٥٠٠ مل',5,22,10,{exp:700,tax:false}],['Surgical gloves (box)','قفازات جراحية',5,38,20,{exp:900,tax:true}],
      ['Inpatient room (per day)','غرفة تنويم (لليوم)',6,900,250,{kind:'service',track:false,tax:false}]],
    customers:[['Ahmed Rashid','0501100001',{mrn:'P-100245',insurer:'Gulf Health Insurance',policy:'GH-12044',copay:20}],['Noura Al Qahtani','0501100002',{mrn:'P-100311',insurer:'National Care Insurance',policy:'NC-90321',copay:10}],['Rahul Sharma','0501100003',{mrn:'P-100402'}],['Hanan Saeed','0501100004',{mrn:'P-100518',insurer:'Gulf Health Insurance',policy:'GH-55781',copay:0}]],
    providers:[['Dr. Ahmed Al Mansoori','General practice',30],['Dr. Sara Khan','Cardiology',35],['Dr. Omar Hassan','Dental',35],['Laboratory team','Laboratory',0],['Radiology team','Radiology',0]],offers:[]},
  salon:{code:'5',prefix:'SP',exp:540,business:'Harbinger Demo Salon & Spa',
    cats:[['Hair','الشعر'],['Nails','الأظافر'],['Facial & skin','العناية بالبشرة'],['Massage & spa','المساج والسبا'],['Products','المنتجات']],
    items:[
      ['Women\'s haircut','قص شعر نسائي',0,120,0,{kind:'service',track:false}],['Men\'s haircut','حلاقة رجالي',0,60,0,{kind:'service',track:false}],['Hair colour','صبغة شعر',0,280,60,{kind:'service',track:false}],['Blow dry','سشوار',0,80,0,{kind:'service',track:false}],['Keratin treatment','علاج كيراتين',0,650,200,{kind:'service',track:false}],
      ['Manicure','مانيكير',1,70,8,{kind:'service',track:false}],['Pedicure','باديكير',1,90,10,{kind:'service',track:false}],['Gel polish','طلاء جل',1,60,12,{kind:'service',track:false}],
      ['Classic facial','تنظيف بشرة',2,180,30,{kind:'service',track:false}],['Hydrating facial','ترطيب البشرة',2,240,45,{kind:'service',track:false}],
      ['Swedish massage 60 min','مساج سويدي ٦٠ دقيقة',3,280,25,{kind:'service',track:false}],['Deep tissue massage 60 min','مساج عميق ٦٠ دقيقة',3,320,25,{kind:'service',track:false}],['Hot stone massage','مساج بالحجارة الساخنة',3,360,35,{kind:'service',track:false}],
      ['Shampoo 250ml','شامبو ٢٥٠ مل',4,55,28,{exp:720}],['Hair mask','ماسك شعر',4,75,38,{exp:720}],['Nail polish','طلاء أظافر',4,35,14,{exp:720}],['Face cream','كريم وجه',4,120,60,{exp:720}]],
    customers:[['Reem Al Suwaidi','0501100001',{}],['Mona Farid','0501100002',{}],['Sana Iqbal','0501100003',{}]],
    providers:[['Maya (Hair)','Hair',35],['Lina (Nails)','Nails',30],['Noor (Spa)','Massage & spa',30],['Rami (Barber)','Hair',30]],offers:[]}
};

function buildCatalog(type,t){
  const D=CATALOGS[type]; if(!D)return null;
  const cats=D.cats.map((c,i)=>({id:'c'+(i+1),name:c[0],nameAr:c[1]||''})), items=[], lots=[], movements=[];
  D.items.forEach((r,i)=>{
    const o=r[5]||{}, it={id:'i'+(i+1),name:r[0],nameAr:r[1]||'',sku:D.prefix+String(i+1).padStart(3,'0'),barcode:'6290'+D.code+String(i+1).padStart(5,'0'),categoryId:'c'+(r[2]+1),price:r[3],cost:r[4],
      tax:o.tax!==false,track:o.track!==false,reorder:o.reorder!=null?o.reorder:(o.weighed?5:10),active:true,unit:o.unit||(o.weighed?'kg':'pcs'),weighed:!!o.weighed,plu:o.plu||'',rx:!!o.rx,controlled:!!o.controlled,kind:o.kind||'product',group:o.group||'',variant:o.variant||''};
    items.push(it);
    if(it.track){
      const qty=o.qty!=null?o.qty:(o.weighed?60:30+((i*7)%70)), days=o.exp===null?null:(o.exp!=null?o.exp:D.exp), lot={id:'l'+(i+1),itemId:it.id,lotNo:D.prefix+'-'+(1000+i),expiry:days==null?null:t+days*864e5,qty:qty,cost:it.cost,receivedAt:t};
      lots.push(lot);movements.push({id:uid('m'),ts:t,itemId:it.id,lotId:lot.id,type:'receive',qty:qty,ref:'Opening stock',user:'u1',note:''});
    }
  });
  (D.extraLots||[]).forEach((x,k)=>{const it=items.find(i=>i.name===x[0]);if(!it)return;const lot={id:'lx'+k,itemId:it.id,lotNo:D.prefix+'-'+x[3],expiry:t+x[2]*864e5,qty:x[1],cost:it.cost,receivedAt:t};lots.push(lot);movements.push({id:uid('m'),ts:t,itemId:it.id,lotId:lot.id,type:'receive',qty:x[1],ref:'Opening stock',user:'u1',note:''})});
  const customers=D.customers.map((c,i)=>Object.assign({id:'g'+(i+1),name:c[0],phone:c[1],email:'',points:0,visits:0,spend:0,notes:'',created:t},c[2]||{}));
  const providers=(D.providers||[]).map((p,i)=>({id:'pv'+(i+1),name:p[0],dept:p[1],commissionPct:p[2],active:true}));
  return {cats:cats,items:items,lots:lots,movements:movements,customers:customers,providers:providers,offers:D.offers||[],business:D.business};
}
/* called at the end of seed(): swap the default restaurant catalogue for the chosen type */
function finishSeed(db,type,t){
  const prof=BIZ[type]||BIZ.restaurant; db.settings.businessType=BIZ[type]?type:'restaurant';
  db.settings.minMarginPct=prof.minMargin; db.settings.blockExpired=prof.blockExpired; db.providers=db.providers||[];
  const c=buildCatalog(type,t); if(!c)return db;
  db.categories=c.cats;db.items=c.items;db.lots=c.lots;db.movements=c.movements;db.customers=c.customers;db.providers=c.providers;db.offers=c.offers;
  db.codes=[{id:'p1',code:'WELCOME10',type:'pct',value:10,min:30,limit:0,used:0,expiry:'',active:true}];
  db.settings.business=c.business; db.suppliers=[{id:'s1',name:'Main Supplier Trading',phone:'',email:'',terms:'Net 30'}];
  return db;
}
/* wipe transactional data and load another industry's sample set; keeps your logins and business/country/tax settings */
function switchBusinessType(type){
  const old=DB, keep=['business','trn','address','phone','currency','decimals','vatPct','taxInclusive','country','taxLabel','receiptLang','charges','countryCode','einv','online','gateway','theme','mode','caps','setupDone'];
  const fresh=seed(type); fresh.users=old.users;
  keep.forEach(k=>{if(old.settings[k]!==undefined&&!(k==='business'&&!old.settings.setupDone))fresh.settings[k]=old.settings[k]});
  fresh.settings.businessType=type; DB=fresh; migrate(); audit('business.type',type); save();
}
A['biz-switch']=d=>{
  const t=d.id; if(!BIZ[t])return;
  confirmBox('Switch to "'+BIZ[t].name+'" and load its sample catalogue? This REPLACES items, stock, customers, orders and accounting with fresh sample data (your logins and country/tax settings are kept). Download a backup first if you need the current data.',()=>{switchBusinessType(t);UIS.dr='today';toast(BIZ[t].name+' sample loaded');location.hash='#/dashboard';render()},'Switch & replace');
};
