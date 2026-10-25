'use strict';
/* Five more industries: tailor / stitching shop, butcher, grocery, garage, tyre shop.
   New building blocks used by them: job orders with advances (tailor, garage), customer credit accounts (grocery, butcher, garage, tyre, tailor),
   vehicle capture, carcass breakdown (butcher), tyre DOT codes & warranty. */

Object.assign(MOD0,{jobs:0,credit:0,vehicle:0,measure:0,breakdown:0,serial:0});
Object.assign(BIZ,{
  tailor:{name:'Tailor / stitching shop',desc:'Job orders with measurements, advance and balance, due dates, tailor commissions',icon:'🧵',modules:{jobs:1,measure:1,provider:1,credit:1,online:0,delivery:0},types:['takeaway'],defType:'takeaway',minMargin:0,blockExpired:false,
    terms:{'Guests':'Customers','+ Guest':'+ Customer','Guest':'Customer','Takeaway':'Walk-in','Products':'Garments & fabric','Stock Room':'Fabric & supplies','Harbinger Register':'Harbinger Tailor POS','Job orders':'Job orders'},
    jobKind:'tailor',dash:[['brief'],['trend','jobsBoard'],['overdue','mixCat'],['providers','top'],['credit','mixPay'],['ops','money'],['recent']]},
  butcher:{name:'Butcher shop',desc:'Weighed cuts, cutting notes, carcass breakdown and yield, fresh-stock expiry, customer credit',icon:'🥩',modules:{weighed:1,expiry:1,credit:1,breakdown:1},types:['takeaway','delivery'],defType:'takeaway',minMargin:12,blockExpired:true,
    notePresets:['Minced','Cubed','Curry cut','Bone-in','Boneless','Sliced thin','Whole'],
    terms:{'Guests':'Customers','+ Guest':'+ Customer','Guest':'Customer','Takeaway':'Counter','Delivery':'Home delivery','Products':'Meat & products','Stock Room':'Cold room'},
    dash:[['brief'],['trend','heat'],['fastslow','expiry'],['yield','mixCat'],['top','leaders'],['credit','mixPay'],['ops','money'],['recent']]},
  grocery:{name:'Grocery shop',desc:'Quick sales, weighed items, customer credit (khata) with aging, expiry control',icon:'🧺',modules:{scanFirst:1,weighed:1,expiry:1,credit:1},types:['takeaway','delivery'],defType:'takeaway',minMargin:6,blockExpired:true,
    terms:{'Guests':'Customers','+ Guest':'+ Customer','Guest':'Customer','Takeaway':'In-store','Delivery':'Home delivery','Products':'Products','Stock Room':'Inventory'},
    dash:[['brief'],['trend','basket'],['credit','fastslow'],['expiry','stockout'],['mixPay','leaders'],['ops','money'],['recent']]},
  garage:{name:'Garage / auto workshop',desc:'Job cards with vehicle details, estimates, parts and labour, mechanics, service reminders, fleet credit',icon:'🔧',modules:{jobs:1,vehicle:1,provider:1,credit:1,online:0,delivery:0},types:['takeaway'],defType:'takeaway',minMargin:10,blockExpired:false,
    terms:{'Guests':'Customers','+ Guest':'+ Customer','Guest':'Customer','Takeaway':'Walk-in','Orders':'Invoices','Products':'Parts & services','Stock Room':'Parts store','Harbinger Register':'Harbinger Garage POS','Job orders':'Job cards'},
    jobKind:'garage',dash:[['brief'],['trend','jobsBoard'],['overdue','serviceDue'],['labourParts','providers'],['credit','mixPay'],['stockout','top'],['ops','money'],['recent']]},
  tyre:{name:'Tyre shop',desc:'Tyres by size and brand, fitting services, DOT code and warranty register, vehicle plate, fleet credit',icon:'🛞',modules:{vehicle:1,serial:1,provider:1,credit:1,scanFirst:1,online:0,delivery:0},types:['takeaway'],defType:'takeaway',minMargin:12,blockExpired:false,
    terms:{'Guests':'Customers','+ Guest':'+ Customer','Guest':'Customer','Takeaway':'Walk-in','Products':'Tyres & services','Stock Room':'Tyre store','Harbinger Register':'Harbinger Tyre POS'},
    dash:[['brief'],['trend','tyreSizes'],['brandmix','labourParts'],['providers','top'],['stockout','credit'],['mixPay','leaders'],['ops','money'],['recent']]}
});
Object.assign(CATALOGS,{
  tailor:{code:'6',prefix:'TL',exp:null,business:'Harbinger Demo Tailors',
    cats:[['Gents garments','ملابس رجالية'],['Ladies garments','ملابس نسائية'],['Alterations','تعديلات'],['Fabric (per metre)','أقمشة'],['Accessories','لوازم الخياطة']],
    items:[
      ['Kandura / thobe stitching','خياطة ثوب / كندورة',0,120,0,{kind:'service',track:false}],['Suit (2-piece) stitching','خياطة بدلة',0,350,0,{kind:'service',track:false}],['Trousers stitching','خياطة بنطلون',0,90,0,{kind:'service',track:false}],['Shirt stitching','خياطة قميص',0,80,0,{kind:'service',track:false}],['Waistcoat stitching','خياطة صدرية',0,110,0,{kind:'service',track:false}],
      ['Abaya stitching','خياطة عباية',1,150,0,{kind:'service',track:false}],['Dress stitching','خياطة فستان',1,180,0,{kind:'service',track:false}],['Jalabiya stitching','خياطة جلابية',1,130,0,{kind:'service',track:false}],
      ['Alteration — shorten hem','تقصير',2,25,0,{kind:'service',track:false}],['Alteration — take in / let out','تضييق / توسيع',2,40,0,{kind:'service',track:false}],['Zip replacement','تبديل سحاب',2,20,0,{kind:'service',track:false}],
      ['Cotton fabric (per m)','قماش قطني (للمتر)',3,28,16,{weighed:1,unit:'m',qty:300,exp:null}],['Wool blend fabric (per m)','قماش صوف (للمتر)',3,85,55,{weighed:1,unit:'m',qty:120,exp:null}],['Silk fabric (per m)','قماش حرير (للمتر)',3,120,80,{weighed:1,unit:'m',qty:80,exp:null}],['Lining (per m)','بطانة (للمتر)',3,12,6,{weighed:1,unit:'m',qty:200,exp:null}],
      ['Button set','طقم أزرار',4,8,3,{qty:150,exp:null}],['Zipper','سحاب',4,5,2,{qty:200,exp:null}],['Thread reel','بكرة خيط',4,4,1.5,{qty:200,exp:null}]],
    customers:[['Khalid Al Suwaidi','0501100001',{creditLimit:500,measurements:{Kandura:{length:'58',shoulder:'19',chest:'44',sleeve:'24',neck:'16'}}}],['Rashid Mohammed','0501100002',{creditLimit:0}],['Mariam Saleh','0501100003',{creditLimit:300}]],
    providers:[['Master tailor Ali (Gents)','Gents garments',25],['Tailor Rashid','Gents garments',22],['Seamstress Noor (Ladies)','Ladies garments',25],['Alterations — Farid','Alterations',20]],offers:[]},
  butcher:{code:'7',prefix:'BT',exp:4,business:'Harbinger Demo Butchery',
    cats:[['Lamb & mutton','لحم ضأن'],['Beef & camel','لحم بقر وجمل'],['Chicken','دجاج'],['Marinated & ready','متبل وجاهز'],['Carcass (for cutting)','ذبائح للتقطيع'],['Packaging','تغليف']],
    items:[
      ['Lamb leg (per kg)','فخذ ضأن (للكيلو)',0,62,48,{weighed:1,plu:'30001'}],['Lamb shoulder (per kg)','كتف ضأن (للكيلو)',0,55,42,{weighed:1,plu:'30002'}],['Lamb chops (per kg)','ريش ضأن (للكيلو)',0,78,60,{weighed:1,plu:'30003'}],['Lamb mince (per kg)','مفروم ضأن (للكيلو)',0,58,45,{weighed:1,plu:'30004'}],['Mutton cubes (per kg)','مكعبات ضأن (للكيلو)',0,52,40,{weighed:1,plu:'30005'}],
      ['Beef steak ribeye (per kg)','ستيك ريب آي (للكيلو)',1,85,65,{weighed:1,plu:'30011'}],['Beef cubes (per kg)','مكعبات بقر (للكيلو)',1,48,36,{weighed:1,plu:'30012'}],['Beef mince (per kg)','مفروم بقر (للكيلو)',1,38,29,{weighed:1,plu:'30013'}],['Beef ribs (per kg)','ريش بقر (للكيلو)',1,55,42,{weighed:1,plu:'30014'}],['Camel meat (per kg)','لحم جمل (للكيلو)',1,55,42,{weighed:1,plu:'30015'}],
      ['Chicken whole (per kg)','دجاج كامل (للكيلو)',2,14,10,{weighed:1,plu:'30021'}],['Chicken breast (per kg)','صدر دجاج (للكيلو)',2,28,21,{weighed:1,plu:'30022'}],['Chicken legs (per kg)','أفخاذ دجاج (للكيلو)',2,18,13,{weighed:1,plu:'30023'}],['Chicken wings (per kg)','أجنحة دجاج (للكيلو)',2,19,14,{weighed:1,plu:'30024'}],
      ['BBQ marinated chicken (per kg)','دجاج مشوي متبل (للكيلو)',3,32,22,{weighed:1,plu:'30031',exp:2}],['Kofta mix (per kg)','كفتة (للكيلو)',3,45,32,{weighed:1,plu:'30032',exp:2}],['Burger patties pack','برجر لحم (عبوة)',3,24,15,{exp:5}],['Liver (per kg)','كبدة (للكيلو)',3,28,20,{weighed:1,plu:'30033',exp:2}],
      ['Whole lamb carcass (per kg)','ذبيحة ضأن كاملة (للكيلو)',4,40,36,{weighed:1,plu:'30041',qty:120,exp:3}],['Beef quarter (per kg)','ربع بقر (للكيلو)',4,28,25,{weighed:1,plu:'30042',qty:150,exp:4}],
      ['Ice pack','عبوة ثلج',5,2,0.5,{qty:200,exp:null}],['Vacuum bag','كيس تفريغ',5,0.5,0.2,{qty:500,exp:null}]],
    customers:[['Al Noor Restaurant','0501100001',{creditLimit:3000}],['Hassan Al Zaabi','0501100002',{creditLimit:500}],['Priya Nair','0501100003',{creditLimit:0}]],providers:[],
    offers:[{id:'o1',name:'Weekend family pack 5%',type:'order_pct',value:5,min:150,active:false,startTime:'',endTime:'',startDate:'',endDate:''}]},
  grocery:{code:'8',prefix:'GR',exp:200,business:'Harbinger Demo Grocery',
    cats:[['Staples','المواد الأساسية'],['Fresh','طازج'],['Dairy & bread','ألبان وخبز'],['Drinks & snacks','مشروبات وتسالي'],['Household','منزلية']],
    items:[
      ['Basmati rice 5kg','أرز بسمتي ٥ كجم',0,32,25,{exp:720}],['Sugar 2kg','سكر ٢ كجم',0,8.5,6.5,{exp:720}],['Cooking oil 1.8L','زيت طبخ',0,19,15,{exp:540}],['Wheat flour 2kg','دقيق قمح',0,7,5,{exp:360}],['Tea bags (100)','شاي ١٠٠ كيس',0,12,8.5,{exp:540}],['Instant noodles pack','نودلز',0,2,1.3,{exp:300,qty:200}],
      ['Tomatoes (per kg)','طماطم',1,6.5,4.2,{weighed:1,plu:'40001',exp:5}],['Onions (per kg)','بصل',1,3.5,2.2,{weighed:1,plu:'40002',exp:30}],['Potatoes (per kg)','بطاطس',1,3.2,2,{weighed:1,plu:'40003',exp:30}],['Bananas (per kg)','موز',1,5.9,3.8,{weighed:1,plu:'40004',exp:6}],
      ['Fresh milk 1L','حليب طازج',2,6.5,5,{exp:14}],['Eggs tray (30)','بيض ٣٠',2,17,13.5,{exp:21}],['Arabic bread','خبز عربي',2,3,1.8,{exp:2,qty:80}],['Yogurt 1kg','زبادي',2,8.5,6,{exp:21}],
      ['Water 1.5L','مياه ١.٥ لتر',3,2,1.1,{exp:365,qty:250}],['Cola 330ml','كولا',3,2.5,1.6,{exp:270,qty:150}],['Biscuits pack','بسكويت',3,3.5,2.2,{exp:240,qty:120}],['Potato chips','شيبس',3,3.5,2.2,{exp:180,qty:100}],
      ['Dishwashing liquid','سائل جلي',4,9.5,6.5,{exp:null}],['Laundry detergent 3kg','مسحوق غسيل',4,29,21,{exp:null}],['Tissue box','مناديل',4,4.5,2.8,{exp:null,qty:120}]],
    customers:[['Abu Saleh (neighbour)','0501100001',{creditLimit:300}],['Um Khalid','0501100002',{creditLimit:200}],['Ravi Kumar','0501100003',{creditLimit:150}],['Walk-in regular','0501100004',{creditLimit:0}]],providers:[],
    offers:[{id:'o1',name:'Spend 100, save 3%',type:'order_pct',value:3,min:100,active:true,startTime:'',endTime:'',startDate:'',endDate:''}]},
  garage:{code:'9',prefix:'GA',exp:null,business:'Harbinger Demo Garage',
    cats:[['Labour & services','أعمال وخدمات'],['Oils & fluids','زيوت وسوائل'],['Brakes & suspension','فرامل وتعليق'],['Electrical & battery','كهرباء وبطاريات'],['Filters & engine','فلاتر ومحرك']],
    items:[
      ['Diagnostic scan','فحص كمبيوتر',0,80,0,{kind:'service',track:false}],['Oil change (labour)','أجرة تغيير زيت',0,60,0,{kind:'service',track:false}],['Brake pads replacement (labour)','أجرة تغيير فحمات',0,120,0,{kind:'service',track:false}],['A/C service','صيانة مكيف',0,180,0,{kind:'service',track:false}],['Wheel alignment','ضبط زوايا',0,100,0,{kind:'service',track:false}],['Battery replacement (labour)','أجرة تغيير بطارية',0,40,0,{kind:'service',track:false}],['General inspection','فحص عام',0,150,0,{kind:'service',track:false}],['Engine tune-up (labour)','أجرة صيانة محرك',0,300,0,{kind:'service',track:false}],['Transmission service (labour)','أجرة صيانة ناقل',0,350,0,{kind:'service',track:false}],
      ['Engine oil 5W-30 (per litre)','زيت محرك ٥W-٣٠ (لتر)',1,35,22,{weighed:1,unit:'l',qty:400,exp:null}],['Brake fluid 1L','زيت فرامل',1,30,14,{exp:null}],['Coolant 4L','مياه رديتر',1,48,28,{exp:null}],['A/C gas R134a','غاز مكيف',1,90,45,{exp:null}],
      ['Brake pads (front set)','فحمات أمامية',2,210,120,{exp:null,qty:14}],['Brake discs (pair)','طارات فرامل',2,380,240,{exp:null,qty:8}],
      ['Car battery 70Ah','بطارية ٧٠ أمبير',3,420,300,{exp:null,qty:10}],['Headlight bulbs (pair)','لمبات أمامية',3,65,30,{exp:null}],['Wiper blades (pair)','مساحات',3,55,25,{exp:null}],
      ['Oil filter','فلتر زيت',4,28,14,{exp:null,qty:60}],['Air filter','فلتر هواء',4,45,22,{exp:null,qty:40}],['Spark plugs (set)','بواجي',4,120,65,{exp:null,qty:25}]],
    customers:[['Khalid Al Mazrouei','0501100001',{creditLimit:0,vehicles:[{plate:'A 12345',make:'Toyota',model:'Camry',year:'2019'}]}],['Desert Logistics LLC (fleet)','0501100002',{creditLimit:8000,vehicles:[{plate:'B 55120',make:'Nissan',model:'Urvan',year:'2021'},{plate:'B 55121',make:'Nissan',model:'Urvan',year:'2021'}]}],['Sana Iqbal','0501100003',{creditLimit:0,vehicles:[{plate:'C 7788',make:'Honda',model:'Civic',year:'2020'}]}]],
    providers:[['Mechanic Imran','Labour & services',12],['Mechanic Saleem','Labour & services',12],['Auto-electrician Faisal','Electrical & battery',15],['A/C technician Rafiq','Labour & services',15]],offers:[]},
  tyre:{code:'0',prefix:'TY',exp:null,business:'Harbinger Demo Tyres',
    cats:[['Passenger tyres','إطارات سيارات'],['SUV & 4x4 tyres','إطارات دفع رباعي'],['Light truck','شاحنات خفيفة'],['Wheels & accessories','جنوط وإكسسوارات'],['Fitting services','خدمات التركيب']],
    items:[
      ['Michelin Primacy 4 205/55R16','ميشلان ٢٠٥/٥٥R١٦',0,520,390,{size:'205/55R16',brand:'Michelin',warranty:60,serial:1,exp:null,qty:24}],['Bridgestone Turanza 205/55R16','بريجستون ٢٠٥/٥٥R١٦',0,480,360,{size:'205/55R16',brand:'Bridgestone',warranty:48,serial:1,exp:null,qty:20}],
      ['Continental ComfortContact 225/45R17','كونتيننتال ٢٢٥/٤٥R١٧',0,560,420,{size:'225/45R17',brand:'Continental',warranty:48,serial:1,exp:null,qty:16}],['Pirelli P7 225/45R17','بيريلي ٢٢٥/٤٥R١٧',0,590,440,{size:'225/45R17',brand:'Pirelli',warranty:36,serial:1,exp:null,qty:12}],
      ['Goodyear Assurance 195/65R15','غوديير ١٩٥/٦٥R١٥',0,340,250,{size:'195/65R15',brand:'Goodyear',warranty:36,serial:1,exp:null,qty:28}],['Hankook Kinergy 195/65R15','هانكوك ١٩٥/٦٥R١٥',0,310,225,{size:'195/65R15',brand:'Hankook',warranty:36,serial:1,exp:null,qty:30}],
      ['Yokohama BluEarth 215/60R16','يوكوهاما ٢١٥/٦٠R١٦',0,430,320,{size:'215/60R16',brand:'Yokohama',warranty:36,serial:1,exp:null,qty:14}],['Michelin Pilot Sport 4 245/40R18','ميشلان ٢٤٥/٤٠R١٨',0,780,590,{size:'245/40R18',brand:'Michelin',warranty:48,serial:1,exp:null,qty:8}],
      ['Bridgestone Dueler 265/65R17','بريجستون دولر ٢٦٥/٦٥R١٧',1,690,510,{size:'265/65R17',brand:'Bridgestone',warranty:48,serial:1,exp:null,qty:16}],['Toyo Open Country 265/70R16','تويو ٢٦٥/٧٠R١٦',1,640,480,{size:'265/70R16',brand:'Toyo',warranty:36,serial:1,exp:null,qty:12}],
      ['Pirelli Scorpion 235/55R19','بيريلي سكوربيون ٢٣٥/٥٥R١٩',1,740,560,{size:'235/55R19',brand:'Pirelli',warranty:36,serial:1,exp:null,qty:8}],['Goodyear Wrangler 275/65R18','غوديير رانغلر ٢٧٥/٦٥R١٨',1,810,610,{size:'275/65R18',brand:'Goodyear',warranty:36,serial:1,exp:null,qty:8}],['Michelin LTX 265/60R18','ميشلان LTX ٢٦٥/٦٠R١٨',1,880,660,{size:'265/60R18',brand:'Michelin',warranty:60,serial:1,exp:null,qty:6}],
      ['Bridgestone R623 195R15C','بريجستون ١٩٥R١٥C',2,330,245,{size:'195R15C',brand:'Bridgestone',warranty:24,serial:1,exp:null,qty:20}],
      ['Valve stem set','طقم بلف',3,12,4,{exp:null,qty:200}],['Wheel weights kit','أوزان جنط',3,25,10,{exp:null,qty:80}],['Alloy wheel 16" (each)','جنط ألمنيوم ١٦',3,380,260,{exp:null,qty:12}],
      ['Tyre fitting (per tyre)','تركيب إطار',4,25,0,{kind:'service',track:false}],['Wheel balancing (per wheel)','ترصيص',4,20,0,{kind:'service',track:false}],['Wheel alignment','ضبط زوايا',4,100,0,{kind:'service',track:false}],['Puncture repair','تصليح بنشر',4,30,0,{kind:'service',track:false}],['Tyre rotation','تبديل أماكن الإطارات',4,60,0,{kind:'service',track:false}],['TPMS sensor reset','إعادة ضبط حساس الضغط',4,40,0,{kind:'service',track:false}],['Nitrogen inflation (per tyre)','تعبئة نيتروجين',4,10,0,{kind:'service',track:false}]],
    customers:[['Hamad Al Ketbi','0501100001',{creditLimit:0,vehicles:[{plate:'D 9021',make:'Toyota',model:'Land Cruiser',year:'2018'}]}],['Gulf Taxi Co. (fleet)','0501100002',{creditLimit:10000,vehicles:[{plate:'T 1001',make:'Toyota',model:'Camry',year:'2022'}]}],['Reem Al Ali','0501100003',{creditLimit:0,vehicles:[{plate:'E 3344',make:'Hyundai',model:'Tucson',year:'2021'}]}]],
    providers:[['Fitter Hamza','Fitting services',10],['Fitter Bilal','Fitting services',10],['Alignment tech Sami','Fitting services',12]],offers:[]}
});
Object.assign(typeof ROLE_SETS!=='undefined'?ROLE_SETS:{},{tailor:['admin','manager','cashier','technician','accountant'],butcher:['admin','manager','cashier','stock_keeper','accountant'],grocery:['admin','manager','cashier','stock_keeper','accountant'],garage:['admin','manager','cashier','technician','stock_keeper','accountant'],tyre:['admin','manager','cashier','technician','stock_keeper','accountant']});
