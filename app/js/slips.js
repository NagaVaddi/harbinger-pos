'use strict';
/* Automatic Arabic item names (built-in dictionary + transliteration; always editable and optional) and transaction slips
   (receipts for payments received, advances, cash in/out and refunds that are not sales). */

const AR_WORDS={
  burger:'برجر',cheese:'جبن',chicken:'دجاج',beef:'لحم بقر',lamb:'ضأن',mutton:'لحم ضأن',meat:'لحم',fish:'سمك',shrimp:'جمبري',prawns:'جمبري',egg:'بيض',eggs:'بيض',milk:'حليب',yogurt:'زبادي',butter:'زبدة',cream:'قشطة',bread:'خبز',toast:'توست',
  rice:'أرز',basmati:'بسمتي',sugar:'سكر',salt:'ملح',flour:'دقيق',oil:'زيت',tea:'شاي',coffee:'قهوة',juice:'عصير',water:'مياه',cola:'كولا',soda:'صودا',lemonade:'ليمونادة',mint:'نعناع',orange:'برتقال',apple:'تفاح',banana:'موز',mango:'مانجو',lemon:'ليمون',
  tomato:'طماطم',tomatoes:'طماطم',onion:'بصل',onions:'بصل',potato:'بطاطس',potatoes:'بطاطس',carrot:'جزر',cucumber:'خيار',lettuce:'خس',garlic:'ثوم',pepper:'فلفل',spinach:'سبانخ',
  fries:'بطاطس مقلية',french:'فرنسي',rings:'حلقات',sauce:'صلصة',ketchup:'كاتشب',mayonnaise:'مايونيز',salad:'سلطة',coleslaw:'كولسلو',soup:'شوربة',pizza:'بيتزا',pasta:'معكرونة',noodles:'نودلز',sandwich:'ساندويتش',wrap:'راب',club:'كلوب',falafel:'فلافل',shawarma:'شاورما',
  chocolate:'شوكولاتة',brownie:'براوني',cake:'كيك',ice:'آيس',cup:'كوب',biscuits:'بسكويت',biscuit:'بسكويت',chips:'شيبس',snack:'سناك',candy:'حلوى',dessert:'حلويات',
  small:'صغير',medium:'وسط',large:'كبير',big:'كبير',mini:'ميني',family:'عائلي',pack:'عبوة',box:'علبة',bag:'كيس',bottle:'زجاجة',can:'علبة',tray:'صينية',set:'طقم',pair:'زوج',each:'للقطعة',per:'لكل',kg:'كجم',
  fresh:'طازج',frozen:'مجمد',hot:'حار',cold:'بارد',spicy:'حار',grilled:'مشوي',fried:'مقلي',marinated:'متبل',whole:'كامل',mince:'مفروم',minced:'مفروم',breast:'صدر',legs:'أفخاذ',leg:'فخذ',wings:'أجنحة',ribs:'ريش',chops:'ريش',steak:'ستيك',liver:'كبدة',cubes:'مكعبات',shoulder:'كتف',carcass:'ذبيحة',
  and:'و',with:'مع',of:'من',the:'',a:'',
  soap:'صابون',shampoo:'شامبو',detergent:'منظف',dishwashing:'جلي',liquid:'سائل',laundry:'غسيل',tissue:'مناديل',paper:'ورق',towel:'منشفة',toothpaste:'معجون أسنان',
  tablet:'أقراص',tablets:'أقراص',capsule:'كبسولات',capsules:'كبسولات',syrup:'شراب',cream_:'كريم',ointment:'مرهم',drops:'قطرة',vitamin:'فيتامين',paracetamol:'باراسيتامول',ibuprofen:'إيبوبروفين',bandage:'ضمادة',mask:'كمامة',gloves:'قفازات',
  shirt:'قميص',tshirt:'تيشيرت',trousers:'بنطلون',pants:'بنطلون',jeans:'جينز',dress:'فستان',abaya:'عباية',kandura:'كندورة',thobe:'ثوب',jalabiya:'جلابية',suit:'بدلة',jacket:'جاكيت',shoes:'حذاء',socks:'جوارب',cap:'قبعة',belt:'حزام',
  haircut:'قص شعر',hair:'شعر',colour:'صبغة',color:'صبغة',facial:'تنظيف بشرة',massage:'مساج',manicure:'مانيكير',pedicure:'باديكير',waxing:'إزالة شعر',styling:'تصفيف',treatment:'علاج',consultation:'استشارة',checkup:'فحص',test:'فحص',
  stitching:'خياطة',alteration:'تعديل',fabric:'قماش',cotton:'قطن',silk:'حرير',wool:'صوف',button:'زر',zip:'سحاب',zipper:'سحاب',thread:'خيط',lining:'بطانة',
  brake:'فرامل',brakes:'فرامل',pads:'فحمات',disc:'طارة',discs:'طارات',battery:'بطارية',filter:'فلتر',engine:'محرك',coolant:'مياه رديتر',spark:'شمعة',plugs:'بواجي',bulb:'لمبة',bulbs:'لمبات',wiper:'مساحة',blades:'مساحات',service:'خدمة',labour:'أجرة',repair:'تصليح',diagnostic:'فحص',scan:'فحص كمبيوتر',change:'تغيير',replacement:'تبديل',
  tyre:'إطار',tire:'إطار',tyres:'إطارات',wheel:'جنط',alignment:'ضبط زوايا',balancing:'ترصيص',fitting:'تركيب',puncture:'بنشر',valve:'بلف',alloy:'ألمنيوم',
  front:'أمامي',rear:'خلفي',black:'أسود',white:'أبيض',red:'أحمر',blue:'أزرق',green:'أخضر',yellow:'أصفر',
  delivery:'توصيل',charge:'رسوم',fee:'رسوم',gift:'هدية',card:'بطاقة',bag_:'كيس',packaging:'تغليف',ice_pack:'عبوة ثلج',vacuum:'تفريغ'
};
const AR_UNITS={kg:'كجم',g:'جم',gm:'جم',ml:'مل',l:'لتر',ltr:'لتر',lt:'لتر',pcs:'قطعة',pc:'قطعة',cm:'سم',m:'متر',mm:'مم'};
const AR_LET=[['sh','ش'],['kh','خ'],['th','ث'],['ch','تش'],['ph','ف'],['gh','غ'],['oo','و'],['ee','ي'],['aa','ا'],['ou','و'],['ck','ك'],['qu','كو'],
  ['a','ا'],['b','ب'],['c','ك'],['d','د'],['e','ي'],['f','ف'],['g','ج'],['h','ه'],['i','ي'],['j','ج'],['k','ك'],['l','ل'],['m','م'],['n','ن'],['o','و'],['p','ب'],['q','ق'],['r','ر'],['s','س'],['t','ت'],['u','و'],['v','ف'],['w','و'],['x','كس'],['y','ي'],['z','ز']];
function arTranslit(w){
  let s=w.toLowerCase(),out='';
  for(let i=0;i<s.length;){
    let hit=null;for(const m of AR_LET){if(s.startsWith(m[0],i)){hit=m;break}}
    if(!hit){out+=s[i];i++;continue}
    const first=i===0, v=hit[1];
    /* inside a word, short vowels (a, e, i, o, u) are usually not written in Arabic */
    if(!first&&hit[0].length===1&&'aeiou'.indexOf(hit[0])>=0&&i<s.length-1){i++;continue}
    out+=v;i+=hit[0].length;
  }
  return out;
}
function autoArabic(name){
  const t=String(name||'').trim(); if(!t)return '';
  return t.split(/\s+/).map(tok=>{
    const m=tok.match(/^(\d+(?:[.,]\d+)?)([A-Za-z]+)$/); if(m){const u=AR_UNITS[m[2].toLowerCase()];return m[1]+' '+(u||arWord(m[2]))}
    if(/^[\d.,/%x×*+()-]+$/i.test(tok))return tok;
    if(/\d/.test(tok)&&/[A-Za-z]/.test(tok))return tok; /* sizes and model codes such as 205/55R16 stay as typed */
    const clean=tok.replace(/[^A-Za-z']/g,''), tail=tok.slice(clean.length);
    return clean?arWord(clean)+tail:tok;
  }).filter(x=>x!=='').join(' ');
}
function arWord(w){
  const k=w.toLowerCase().replace(/'s$/,'');
  if(Object.prototype.hasOwnProperty.call(AR_WORDS,k))return AR_WORDS[k];
  if(k.length>3&&k.endsWith('s')&&Object.prototype.hasOwnProperty.call(AR_WORDS,k.slice(0,-1)))return AR_WORDS[k.slice(0,-1)];
  if(AR_UNITS[k])return AR_UNITS[k];
  return arTranslit(k);
}
/* wire the item form: the Arabic name follows the English name until the user edits it */
function bindArabicAuto(el){
  const en=$('[name=name]',el), ar=$('[name=nameAr]',el); if(!en||!ar)return;
  ar.setAttribute('dir','rtl');ar.placeholder='يُملأ تلقائياً — يمكنك تعديله';
  let dirty=!!ar.value&&ar.value!==autoArabic(en.value);
  en.addEventListener('input',()=>{if(!dirty)ar.value=autoArabic(en.value)});
  ar.addEventListener('input',()=>{dirty=ar.value.trim()!==''&&ar.value!==autoArabic(en.value)});
}

/* ---------- transaction slips ---------- */
function txSlipHtml(t){
  const rows=(t.rows||[]).map(r=>'<tr><td>'+esc(r[0])+'</td><td class="r">'+esc(r[1])+'</td></tr>').join('');
  return '<div class="rcpt"><div class="c"><strong>'+esc(DB.settings.business)+'</strong><br>'+esc(DB.settings.address||'')+(DB.settings.trn?'<br>TRN '+esc(DB.settings.trn):'')+'</div><div class="c"><strong>'+esc(t.title.toUpperCase())+'</strong></div>'+
    '<div class="meta">No: '+esc(t.no)+'<br>'+fmtDT(t.ts||now())+(t.party?'<br>'+esc(t.party):'')+'<br>By: '+esc(userName(t.by||(ME&&ME.id)))+'</div><hr>'+(rows?'<table>'+rows+'</table><hr>':'')+
    '<table><tr class="tot"><td>'+esc(t.amountLabel||'AMOUNT')+'</td><td class="r">'+esc(DB.settings.currency)+' '+fmt(t.amount)+'</td></tr></table>'+(t.note?'<div class="small">'+esc(t.note)+'</div>':'')+
    '<div class="sig">Signature</div><div class="c small">This is a transaction slip, not a tax invoice.</div></div>';
}
function showTxSlip(t,extra){
  modal({title:t.title,body:txSlipHtml(t),actions:[{label:'Print slip',cls:'primary',keep:true,fn:()=>{printHtml(txSlipHtml(t));return false}}].concat(extra||[],[{label:tr('Close')}])});
}
const PAYLABEL={cash:'Cash',card:'Card',wallet:'Wallet / QR',bank:'Bank transfer'};
function voucherSlip(v){
  const kind=v.type==='in'?'Cash received':v.type==='out'?'Cash paid out':'Refund paid';
  return {title:kind,no:'CV-'+String(v.id).replace(/[^A-Za-z0-9]/g,'').slice(-6).toUpperCase(),ts:v.ts,by:v.userId,rows:[['Reason',v.reason||'—']],amount:v.amount};
}
A['tx-slip']=d=>{const v=DB.vouchers.find(x=>x.id===d.id);if(v)showTxSlip(voucherSlip(v))};
