// Arabic word dictionary and auto-transliteration for UAE market

export const AR_WORDS: Record<string, string> = {
  // Food – proteins
  burger: 'برجر', chicken: 'دجاج', beef: 'لحم بقر', mutton: 'لحم غنم',
  lamb: 'خروف', fish: 'سمك', shrimp: 'روبيان', prawn: 'جمبري',
  tuna: 'تونا', salmon: 'سلمون', crab: 'سرطان', lobster: 'لوبستر',
  // Food – staples
  rice: 'أرز', bread: 'خبز', pita: 'خبز عربي', roti: 'روتي',
  pasta: 'مكرونة', noodles: 'نودلز', flour: 'طحين', oats: 'شوفان',
  // Food – dishes
  pizza: 'بيتزا', sandwich: 'ساندويش', wrap: 'لفة', shawarma: 'شاورما',
  falafel: 'فلافل', hummus: 'حمص', kebab: 'كباب', kofta: 'كفتة',
  mandi: 'مندي', biryani: 'برياني', machboos: 'مجبوس', harees: 'هريس',
  soup: 'شوربة', salad: 'سلطة', steak: 'ستيك',
  tacos: 'تاكو', sushi: 'سوشي', curry: 'كاري', masala: 'مسالا',
  // Food – snacks & sweets
  chips: 'شيبس', popcorn: 'فشار', nuts: 'مكسرات', dates: 'تمر',
  kunafa: 'كنافة', baklava: 'بقلاوة', luqaimat: 'لقيمات',
  cake: 'كيك', cookie: 'كوكيز', brownie: 'براوني', donut: 'دونت',
  croissant: 'كرواسون', waffle: 'وافل', pancake: 'بانكيك',
  chocolate: 'شوكولاتة', candy: 'حلوى', ice: 'ثلج', gelato: 'جيلاتو',
  // Food – dairy
  milk: 'حليب', cheese: 'جبن', yogurt: 'زبادي', butter: 'زبدة',
  labneh: 'لبنة', kefir: 'كفير',
  // Beverages
  water: 'ماء', juice: 'عصير', coffee: 'قهوة', tea: 'شاي',
  karak: 'كرك', latte: 'لاتيه', cappuccino: 'كابتشينو', espresso: 'إسبريسو',
  cola: 'كولا', pepsi: 'بيبسي', soda: 'صودا', lemonade: 'ليمونادة',
  smoothie: 'سموذي', shake: 'شيك', cocktail: 'كوكتيل', mocktail: 'موكتيل',
  // Vegetables & fruit
  tomato: 'طماطم', onion: 'بصل', garlic: 'ثوم', potato: 'بطاطس',
  fries: 'بطاطس مقلية', carrot: 'جزر', lettuce: 'خس', cucumber: 'خيار',
  mushroom: 'فطر', corn: 'ذرة', avocado: 'أفوكادو', spinach: 'سبانخ',
  apple: 'تفاح', banana: 'موز', mango: 'مانجو', strawberry: 'فراولة',
  grape: 'عنب', orange: 'برتقال', lemon: 'ليمون', watermelon: 'بطيخ',
  // Cooking method modifiers
  grilled: 'مشوي', fried: 'مقلي', baked: 'مخبوز', roasted: 'محمص',
  steamed: 'مطبوخ بالبخار', smoked: 'مدخن', fresh: 'طازج', crispy: 'مقرمش',
  // Taste / texture
  spicy: 'حار', mild: 'خفيف', sweet: 'حلو', sour: 'حامض', salty: 'مالح',
  hot: 'ساخن', cold: 'بارد', frozen: 'مجمد', creamy: 'كريمي',
  // Size / quantity
  small: 'صغير', medium: 'وسط', large: 'كبير', extra: 'إضافي',
  double: 'مزدوج', single: 'فردي', half: 'نصف', full: 'كامل',
  // Meal types
  combo: 'كومبو', meal: 'وجبة', set: 'طقم', platter: 'صحن',
  portion: 'حصة', family: 'عائلي', sharing: 'مشترك',
  // Quality tiers
  special: 'خاص', deluxe: 'ديلوكس', premium: 'بريميوم',
  classic: 'كلاسيك', original: 'أصلي', new: 'جديد',
  organic: 'عضوي', natural: 'طبيعي', diet: 'دايت', light: 'خفيف',
  // Condiments & extras
  sauce: 'صوص', ketchup: 'كاتشب', mayo: 'مايونيز', mustard: 'مسطردة',
  oil: 'زيت', salt: 'ملح', pepper: 'فلفل', cumin: 'كمون',
  cardamom: 'هيل', saffron: 'زعفران', cinnamon: 'قرفة', sugar: 'سكر',
  honey: 'عسل', vinegar: 'خل', lime: 'ليم',
  egg: 'بيض', eggs: 'بيض',
  // Pharmacy / medical
  tablet: 'قرص', capsule: 'كبسولة', syrup: 'شراب', injection: 'حقنة',
  ointment: 'مرهم', drops: 'قطرات', spray: 'رذاذ',
  vitamin: 'فيتامين', supplement: 'مكمل', antibiotic: 'مضاد حيوي',
  painkiller: 'مسكن', antacid: 'مضاد للحموضة',
  // Automotive / garage
  filter: 'فلتر', tyre: 'إطار', tire: 'إطار', brake: 'فرامل',
  battery: 'بطارية', engine: 'محرك', service: 'صيانة',
  wash: 'غسيل', polish: 'تلميع', wiper: 'مسحة', spark: 'شمعة',
  motor: 'موتور', gear: 'ترس', axle: 'محور',
  // Clothing / fashion
  shirt: 'قميص', pant: 'بنطلون', pants: 'بنطلون', dress: 'فستان',
  abaya: 'عباءة', thobe: 'ثوب', kandura: 'كندورة', hijab: 'حجاب',
  jacket: 'جاكيت', coat: 'معطف', underwear: 'ملابس داخلية',
  shoe: 'حذاء', shoes: 'أحذية', sandal: 'صندل', socks: 'جوارب',
  bag: 'حقيبة', wallet: 'محفظة', belt: 'حزام', watch: 'ساعة',
  perfume: 'عطر', sunglasses: 'نظارات شمسية',
  // Salon & beauty
  haircut: 'قص شعر', shave: 'حلاقة', color: 'صبغة', treatment: 'علاج',
  massage: 'مساج', facial: 'فيشل', manicure: 'مانيكير', pedicure: 'باديكير',
  waxing: 'إزالة شعر', threading: 'خيط', eyelash: 'رموش', eyebrow: 'حاجب',
  nail: 'أظافر', hair: 'شعر', skin: 'بشرة', moisturizer: 'مرطب',
  // Electronics / retail
  phone: 'هاتف', mobile: 'موبايل', laptop: 'لابتوب',
  charger: 'شاحن', cable: 'كابل', case: 'غطاء', screen: 'شاشة',
  headphones: 'سماعات', speaker: 'مكبر صوت', camera: 'كاميرا',
  // General retail
  daily: 'يومي', weekly: 'أسبوعي', monthly: 'شهري',
  free: 'مجاني', discount: 'خصم', offer: 'عرض', sale: 'تخفيض',
  delivery: 'توصيل', takeaway: 'تيك أواي', dine: 'داخل المطعم',
};

// Letter-by-letter transliteration fallback
const TRANS: Record<string, string> = {
  a: 'ا', b: 'ب', c: 'ك', d: 'د', e: 'إ', f: 'ف', g: 'ج',
  h: 'ه', i: 'ي', j: 'ج', k: 'ك', l: 'ل', m: 'م', n: 'ن',
  o: 'و', p: 'ب', q: 'ق', r: 'ر', s: 'س', t: 'ت', u: 'ا',
  v: 'ف', w: 'و', x: 'كس', y: 'ي', z: 'ز',
};

function transliterate(word: string): string {
  return word.toLowerCase().split('').map(c => TRANS[c] ?? c).join('');
}

/** Convert an English product name to Arabic using the dictionary with transliteration fallback. */
export function autoArabic(name: string): string {
  if (!name.trim()) return '';
  return name.trim().split(/\s+/).map(word => {
    const lower = word.toLowerCase();
    return AR_WORDS[lower] ?? transliterate(lower);
  }).join(' ');
}
