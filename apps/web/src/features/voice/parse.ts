/**
 * Understanding what a shop owner says, without any AI service (no key needed).
 *
 * Works on Hindi, Marathi, Hinglish and English as the browser's speech recognition writes
 * them: Devanagari or Latin letters, digits or number words ("pandrah sau", "पंद्रह सौ",
 * "पंधराशे", "dedh hazaar"). Nothing here is trusted blindly: every value it finds is shown
 * on the "Check your ad" screen and read back for the owner to confirm before it is used.
 */

export type AdGoal = 'sale' | 'new_product' | 'festival' | 'event' | 'booking' | 'visit';
export type AdCta = 'whatsapp' | 'call' | 'visit' | 'book' | 'order';
export type AdLanguage = 'en' | 'hi' | 'mr' | 'hinglish';

export type VoiceBrief = {
  product?: string;
  /** Matched product id from the owner's library, when the name was recognised. */
  productId?: string;
  price?: number;
  discount?: number;
  from?: string; // YYYY-MM-DD
  to?: string;
  time?: string; // "5–9 PM"
  goal?: AdGoal;
  occasion?: string; // "Diwali"
  /** What the ad is for (Studio "What is this ad for?"). */
  purpose?: AdPurpose;
  cta?: AdCta;
  language?: AdLanguage;
  businessType?: 'food' | 'retail' | 'beauty';
};

// ------------------------------------------------------------------------------------------
// Normalising
// ------------------------------------------------------------------------------------------
const DEVANAGARI_DIGITS = '०१२३४५६७८९';

export function normalise(text: string): string {
  return text
    .normalize('NFC')
    .replace(/[०-९]/g, (d) => String(DEVANAGARI_DIGITS.indexOf(d)))
    .toLowerCase()
    .replace(/(\d),(?=\d{2,3}\b)/g, '$1') // 1,500 -> 1500 (also Indian 1,50,000)
    .replace(/₹\s*/g, ' rs ')
    .replace(/(\d)\s*%/g, '$1 percent')
    .replace(/[.,!?;:“”"'()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const tokens = (text: string) => normalise(text).split(' ').filter(Boolean);
/** The word at a position, or '' past either end. */
const at = (w: string[], i: number): string => w[i] ?? '';

// ------------------------------------------------------------------------------------------
// Numbers
// ------------------------------------------------------------------------------------------
const UNITS: Record<string, number> = {};
const add = (n: number, ...words: string[]) => words.forEach((w) => (UNITS[w] = n));
add(1, 'ek', 'एक', 'one');
add(2, 'do', 'दो', 'don', 'दोन', 'two');
add(3, 'teen', 'tin', 'तीन', 'three');
add(4, 'char', 'chaar', 'चार', 'four');
add(5, 'paanch', 'panch', 'पांच', 'पाँच', 'पाच', 'five');
add(6, 'chhe', 'che', 'chah', 'छह', 'छः', 'सहा', 'six');
add(7, 'saat', 'सात', 'seven');
add(8, 'aath', 'आठ', 'eight');
add(9, 'nau', 'नौ', 'नऊ', 'nine');
add(10, 'das', 'दस', 'दहा', 'ten');
add(11, 'gyarah', 'ग्यारह', 'अकरा', 'eleven');
add(12, 'barah', 'बारह', 'बारा', 'twelve');
add(13, 'terah', 'तेरह', 'तेरा', 'thirteen');
add(14, 'chaudah', 'चौदह', 'चौदा', 'fourteen');
add(15, 'pandrah', 'pandra', 'पंद्रह', 'पंधरा', 'fifteen');
add(16, 'solah', 'सोलह', 'सोळा', 'sixteen');
add(17, 'satrah', 'सत्रह', 'सतरा', 'seventeen');
add(18, 'atharah', 'अठारह', 'अठरा', 'eighteen');
add(19, 'unnis', 'उन्नीस', 'एकोणीस', 'nineteen');
add(20, 'bees', 'bis', 'बीस', 'वीस', 'twenty');
add(25, 'pachees', 'pachis', 'पच्चीस', 'पंचवीस', 'twenty-five');
add(30, 'tees', 'tis', 'तीस', 'thirty');
add(35, 'paintees', 'पैंतीस', 'पस्तीस');
add(40, 'chalis', 'chaalis', 'चालीस', 'चाळीस', 'forty');
add(45, 'paintalis', 'पैंतालीस', 'पंचेचाळीस');
add(50, 'pachas', 'pachaas', 'पचास', 'पन्नास', 'fifty');
add(60, 'saath', 'साठ', 'sixty');
add(70, 'sattar', 'सत्तर', 'seventy');
add(75, 'pachattar', 'पचहत्तर', 'पंचाहत्तर');
add(80, 'assi', 'अस्सी', 'ऐंशी', 'eighty');
add(90, 'nabbe', 'नब्बे', 'नव्वद', 'ninety');
add(100, 'shambhar', 'शंभर');

const HUNDRED = new Set(['sau', 'सौ', 'shau', 'hundred', 'शे', 'she']);
const THOUSAND = new Set(['hazaar', 'hazar', 'hajar', 'hajaar', 'हज़ार', 'हजार', 'thousand', 'k']);
const LAKH = new Set(['lakh', 'lac', 'लाख']);
const FRACTION: Record<string, number> = {
  dedh: 1.5,
  डेढ़: 1.5,
  डेढ: 1.5,
  dhai: 2.5,
  ढाई: 2.5,
  अडीच: 2.5,
};
const PLUS_HALF = new Set(['sadhe', 'saadhe', 'साढ़े', 'साडे']);
const PLUS_QUARTER = new Set(['sava', 'savva', 'सवा']);

/** A single number word or digits ("1500", "पंद्रह", "पंधराशे" = 1500). */
function wordValue(w: string): number | null {
  if (/^\d+(\.\d+)?$/.test(w)) return Number(w);
  if (w in UNITS) return UNITS[w] ?? null;
  if (w in FRACTION) return FRACTION[w] ?? null;
  // Marathi joins hundreds: पंधराशे (15 × 100), दोनशे (2 × 100)
  const stem = UNITS[w.slice(0, -2)];
  if (w.endsWith('शे') && stem !== undefined) return stem * 100;
  return null;
}

export type FoundNumber = { value: number; start: number; end: number };

/** Every number phrase in the words, with the word positions it covers. */
export function findNumbers(words: string[]): FoundNumber[] {
  const out: FoundNumber[] = [];
  let i = 0;
  while (i < words.length) {
    let w = at(words, i);
    let bonus = 0;
    const start = i;
    if (PLUS_HALF.has(w) || PLUS_QUARTER.has(w)) {
      bonus = PLUS_HALF.has(w) ? 0.5 : 0.25;
      i += 1;
      w = at(words, i) ?? '';
    }
    let v = wordValue(w);
    if (v === null) {
      i = start + 1;
      continue;
    }
    v += bonus;
    let total = 0;
    let current = v;
    let j = i + 1;
    // Combine "pandrah sau", "do hazaar paanch sau", "dedh hazaar", "2 lakh".
    while (j < words.length) {
      const next = at(words, j);
      if (HUNDRED.has(next)) {
        current *= 100;
        j += 1;
      } else if (THOUSAND.has(next)) {
        total += current * 1000;
        current = 0;
        j += 1;
      } else if (LAKH.has(next)) {
        total += current * 100000;
        current = 0;
        j += 1;
      } else {
        const nv = wordValue(next);
        // "do hazaar paanch sau": a smaller number after a thousand/lakh continues the phrase.
        if (nv !== null && current === 0 && total > 0) {
          current = nv;
          j += 1;
        } else break;
      }
    }
    out.push({ value: Math.round(total + current), start, end: j - 1 });
    i = j;
  }
  return out;
}

/** The first number in a short answer ("pandrah sau", "₹1,299", "bees percent"). */
export function parseNumber(text: string): number | null {
  const found = findNumbers(tokens(text));
  return found[0]?.value ?? null;
}

// ------------------------------------------------------------------------------------------
// Dates and times
// ------------------------------------------------------------------------------------------
const MONTHS: Record<string, number> = {};
const month = (m: number, ...names: string[]) => names.forEach((n) => (MONTHS[n] = m));
month(1, 'january', 'jan', 'जनवरी', 'जानेवारी');
month(2, 'february', 'feb', 'फ़रवरी', 'फरवरी', 'फेब्रुवारी');
month(3, 'march', 'mar', 'मार्च');
month(4, 'april', 'apr', 'अप्रैल', 'एप्रिल');
month(5, 'may', 'मई', 'मे');
month(6, 'june', 'jun', 'जून');
month(7, 'july', 'jul', 'जुलाई', 'जुलै');
month(8, 'august', 'aug', 'अगस्त', 'ऑगस्ट');
month(9, 'september', 'sep', 'sept', 'सितंबर', 'सितम्बर', 'सप्टेंबर');
month(10, 'october', 'oct', 'अक्टूबर', 'अक्तूबर', 'ऑक्टोबर');
month(11, 'november', 'nov', 'नवंबर', 'नवम्बर', 'नोव्हेंबर');
month(12, 'december', 'dec', 'दिसंबर', 'दिसम्बर', 'डिसेंबर');

const RANGE_WORDS = new Set(['se', 'से', 'to', 'till', 'until', '-', '–', 'te', 'ते', 'पासून']);

function isoDate(day: number, monthNo: number, today: Date): string | null {
  if (day < 1 || day > 31) return null;
  let year = today.getFullYear();
  const candidate = new Date(year, monthNo - 1, day);
  // A date more than a month in the past means next year ("5 January" said in November).
  if (candidate.getTime() < today.getTime() - 31 * 86400000) year += 1;
  const d = new Date(year, monthNo - 1, day);
  if (d.getMonth() !== monthNo - 1) return null;
  return `${year}-${String(monthNo).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** "15 se 20 November", "15 to 20 nov", "15 नवंबर से 20 नवंबर", "20 November tak". */
export function parseDates(text: string, today = new Date()): { from?: string; to?: string } {
  const w = tokens(text);
  const hits: { day: number; month: number; at: number }[] = [];
  for (let i = 0; i < w.length; i++) {
    const m = MONTHS[at(w, i)];
    if (!m) continue;
    const day = Number(at(w, i - 1));
    if (Number.isInteger(day) && day >= 1 && day <= 31) {
      hits.push({ day, month: m, at: i - 1 });
      // "15 se 20 November": the first day shares the month.
      if (RANGE_WORDS.has(at(w, i - 2)) && /^\d{1,2}$/.test(at(w, i - 3) ?? '')) {
        hits.unshift({ day: Number(at(w, i - 3)), month: m, at: i - 3 });
      }
    }
  }
  const [first, second] = hits;
  if (first && second) {
    const from = isoDate(first.day, first.month, today) ?? undefined;
    const to = isoDate(second.day, second.month, today) ?? undefined;
    return from && to && to < from
      ? {
          from,
          to: isoDate(second.day, second.month, new Date(today.getFullYear() + 1, 0, 1)) ?? to,
        }
      : { from, to };
  }
  if (first) {
    const iso = isoDate(first.day, first.month, today) ?? undefined;
    const after = w.slice(first.at + 2, first.at + 4);
    const isEnd = after.some((x) => ['tak', 'तक', 'paryant', 'पर्यंत', 'till', 'until'].includes(x));
    return isEnd ? { to: iso } : { from: iso, to: iso };
  }
  return {};
}

const EVENING = new Set([
  'shaam',
  'sham',
  'शाम',
  'संध्याकाळी',
  'evening',
  'raat',
  'रात',
  'रात्री',
  'night',
  'dopahar',
  'दोपहर',
  'दुपारी',
  'pm',
]);
const MORNING = new Set(['subah', 'सुबह', 'सकाळी', 'morning', 'am']);
const TIME_WORDS = new Set([
  'baje',
  'बजे',
  'वाजता',
  'वाजेपर्यंत',
  'pm',
  'am',
  "o'clock",
  'oclock',
  'vajta',
]);

/** "shaam 5 se 9 baje" → "5–9 PM"; "10 am to 1 pm" → "10 AM – 1 PM". */
export function parseTime(text: string): string | undefined {
  const w = tokens(text);
  for (let i = 0; i < w.length; i++) {
    const a = wordValue(at(w, i));
    if (a === null || a < 1 || a > 12 || !Number.isInteger(a)) continue;
    let j = i + 1;
    if (at(w, j) === 'am' || at(w, j) === 'pm') j += 1;
    if (!RANGE_WORDS.has(at(w, j) ?? '')) continue;
    const b = wordValue(at(w, j + 1) ?? '');
    if (b === null || b < 1 || b > 12 || !Number.isInteger(b)) continue;
    const window = w.slice(Math.max(0, i - 3), j + 4);
    if (!window.some((x) => TIME_WORDS.has(x) || EVENING.has(x) || MORNING.has(x))) continue;
    const startAm = at(w, i + 1) === 'am' || window.slice(0, 4).some((x) => MORNING.has(x));
    const endPm = window.some((x) => EVENING.has(x)) || at(w, j + 2) === 'pm';
    if (startAm && endPm) return `${a} AM – ${b} PM`;
    if (startAm) return `${a}–${b} AM`;
    return `${a}–${b} PM`;
  }
  return undefined;
}

// ------------------------------------------------------------------------------------------
// Product, ad type, button, language
// ------------------------------------------------------------------------------------------
const PRODUCT_WORDS: Record<string, string> = {
  saree: 'Saree',
  sari: 'Saree',
  saari: 'Saree',
  साड़ी: 'Saree',
  साडी: 'Saree',
  kurta: 'Kurta',
  kurti: 'Kurti',
  कुर्ता: 'Kurta',
  कुर्ती: 'Kurti',
  lehenga: 'Lehenga',
  लहंगा: 'Lehenga',
  shirt: 'Shirt',
  शर्ट: 'Shirt',
  jeans: 'Jeans',
  जीन्स: 'Jeans',
  shoes: 'Shoes',
  जूते: 'Shoes',
  chappal: 'Chappal',
  dress: 'Dress',
  suit: 'Suit',
  सूट: 'Suit',
  chai: 'Chai',
  chaha: 'Chai',
  चाय: 'Chai',
  चहा: 'Chai',
  coffee: 'Coffee',
  कॉफी: 'Coffee',
  thali: 'Thali',
  थाली: 'Thali',
  biryani: 'Biryani',
  बिरयानी: 'Biryani',
  pizza: 'Pizza',
  पिज़्ज़ा: 'Pizza',
  burger: 'Burger',
  samosa: 'Samosa',
  समोसा: 'Samosa',
  cake: 'Cake',
  केक: 'Cake',
  mithai: 'Mithai',
  मिठाई: 'Mithai',
  ladoo: 'Ladoo',
  laddu: 'Ladoo',
  लड्डू: 'Ladoo',
  vada: 'Vada pav',
  'vada-pav': 'Vada pav',
  dosa: 'Dosa',
  डोसा: 'Dosa',
  haircut: 'Haircut',
  facial: 'Facial',
  फेशियल: 'Facial',
  spa: 'Spa',
  massage: 'Massage',
  mehndi: 'Mehndi',
  मेहंदी: 'Mehndi',
  mobile: 'Mobile',
  मोबाइल: 'Mobile',
  phone: 'Phone',
};

const OCCASIONS: Record<string, string> = {
  diwali: 'Diwali',
  deepawali: 'Diwali',
  दिवाली: 'Diwali',
  दिवाळी: 'Diwali',
  दीपावली: 'Diwali',
  holi: 'Holi',
  होली: 'Holi',
  navratri: 'Navratri',
  नवरात्रि: 'Navratri',
  नवरात्री: 'Navratri',
  dussehra: 'Dussehra',
  dasara: 'Dussehra',
  दशहरा: 'Dussehra',
  दसरा: 'Dussehra',
  eid: 'Eid',
  ईद: 'Eid',
  christmas: 'Christmas',
  क्रिसमस: 'Christmas',
  ganesh: 'Ganesh Chaturthi',
  गणेश: 'Ganesh Chaturthi',
  rakhi: 'Raksha Bandhan',
  राखी: 'Raksha Bandhan',
  sankranti: 'Makar Sankranti',
  संक्रांति: 'Makar Sankranti',
  संक्रांत: 'Makar Sankranti',
  pongal: 'Pongal',
  onam: 'Onam',
  gudi: 'Gudi Padwa',
  गुढी: 'Gudi Padwa',
  'new-year': 'New Year',
};

const has = (w: string[], ...words: string[]) => words.some((x) => w.includes(x));

export function detectGoal(w: string[]): AdGoal {
  if (
    Object.keys(OCCASIONS).some((o) => w.includes(o)) ||
    has(w, 'festival', 'tyohar', 'त्योहार', 'सण')
  )
    return 'festival';
  if (has(w, 'new', 'naya', 'nayi', 'नया', 'नई', 'नवीन', 'launch', 'arrival', 'arrivals'))
    return 'new_product';
  if (has(w, 'opening', 'udghatan', 'उद्घाटन', 'grand')) return 'visit';
  if (has(w, 'event', 'program', 'कार्यक्रम', 'workshop')) return 'event';
  if (has(w, 'booking', 'book', 'appointment', 'बुकिंग')) return 'booking';
  return 'sale';
}

export type AdPurpose = 'promote' | 'menu' | 'new_arrivals' | 'festival' | 'opening' | 'offer';

/** What the ad is for: promote the business (default), menu, new arrivals, festival, opening, offer. */
export function detectPurpose(w: string[], hasDiscount: boolean): AdPurpose {
  if (has(w, 'opening', 'inauguration', 'udghatan', 'उद्घाटन', 'शुभारंभ', 'shubharambh', 'grand'))
    return 'opening';
  if (has(w, 'menu', 'मेन्यू', 'मेनू', 'specials', 'special')) return 'menu';
  if (has(w, 'greeting', 'greetings', 'wishes', 'shubhkamna', 'shubhkamnayein', 'शुभकामनाएँ', 'शुभकामना', 'शुभेच्छा', 'badhai', 'बधाई'))
    return 'festival';
  if (hasDiscount || has(w, 'sale', 'offer', 'discount', 'सेल', 'ऑफर', 'छूट', 'सवलत')) return 'offer';
  if (has(w, 'arrival', 'arrivals', 'collection', 'launch', 'कलेक्शन')) return 'new_arrivals';
  if (Object.keys(OCCASIONS).some((o) => w.includes(o))) return 'festival';
  return 'promote';
}

export function detectCta(w: string[]): AdCta | undefined {
  if (has(w, 'whatsapp', 'व्हाट्सएप', 'व्हॉट्सअॅप', 'whats')) return 'whatsapp';
  if (has(w, 'call', 'कॉल', 'phone')) return 'call';
  if (has(w, 'visit', 'aaiye', 'aao', 'आइए', 'या', 'shop')) return 'visit';
  if (has(w, 'book', 'booking')) return 'book';
  if (has(w, 'order', 'ऑर्डर')) return 'order';
  return undefined;
}

const MARATHI_MARKERS = [
  'आहे',
  'साठी',
  'करा',
  'बनवा',
  'च्या',
  'ची',
  'चा',
  'वर',
  'टक्के',
  'नको',
  'हवी',
  'हवे',
];
const HINGLISH_MARKERS = [
  'hai',
  'ka',
  'ki',
  'ke',
  'banao',
  'mein',
  'par',
  'chahiye',
  'karo',
  'wala',
  'wali',
  'aur',
  'se',
  'tak',
];

export function detectLanguage(text: string): AdLanguage {
  if (/[ऀ-ॿ]/.test(text)) {
    return MARATHI_MARKERS.some((m) => text.includes(m)) ? 'mr' : 'hi';
  }
  const w = tokens(text);
  return w.filter((x) => HINGLISH_MARKERS.includes(x)).length >= 2 ? 'hinglish' : 'en';
}

function detectBusinessType(w: string[]): VoiceBrief['businessType'] {
  if (
    has(
      w,
      'clothing',
      'clothes',
      'kapde',
      'kapda',
      'कपड़े',
      'कपडे',
      'boutique',
      'बुटीक',
      'garment',
      'saree',
      'kurta',
      'shoes',
      'mobile',
    )
  )
    return 'retail';
  if (
    has(
      w,
      'cafe',
      'café',
      'restaurant',
      'hotel',
      'dhaba',
      'कैफ़े',
      'कॅफे',
      'होटल',
      'chai',
      'chaha',
      'bakery',
      'sweets',
      'mithai',
      'thali',
    )
  )
    return 'food';
  if (has(w, 'salon', 'parlour', 'parlor', 'spa', 'सैलून', 'पार्लर', 'beauty')) return 'beauty';
  return undefined;
}

const titleCase = (s: string) => s.replace(/\b\p{L}/gu, (c) => c.toUpperCase());

/** The product: one from the owner's library if its name was said, else a known product word. */
export function detectProduct(
  text: string,
  library: { id: string; name: string }[] = [],
): { product?: string; productId?: string } {
  const w = tokens(text);
  const said = new Set(w.map((x) => PRODUCT_WORDS[x]?.toLowerCase() ?? x));
  let best: { id: string; name: string; score: number } | null = null;
  for (const p of library) {
    const parts = normalise(p.name)
      .split(' ')
      .filter((x) => x.length >= 3);
    const score = parts.filter(
      (x) => said.has(x) || said.has(PRODUCT_WORDS[x]?.toLowerCase() ?? ''),
    ).length;
    if (score > 0 && (!best || score > best.score)) best = { ...p, score };
  }
  if (best) return { product: best.name, productId: best.id };
  for (const x of w) if (PRODUCT_WORDS[x]) return { product: PRODUCT_WORDS[x] };
  return {};
}

const PERCENT = new Set([
  'percent',
  'percentage',
  'pratishat',
  'प्रतिशत',
  'परसेंट',
  'टक्के',
  'टक्का',
  'takke',
  'off',
]);
const PRICE_BEFORE = new Set([
  'rs',
  'rupees',
  'price',
  'keemat',
  'kimat',
  'qeemat',
  'कीमत',
  'किंमत',
  'daam',
  'दाम',
  'mrp',
  'sirf',
  'only',
  'फक्त',
]);
const PRICE_AFTER = new Set([
  'rs',
  'rupaye',
  'rupaya',
  'rupees',
  'rupee',
  'रुपये',
  'रुपए',
  'रुपया',
  'रुपयांना',
  'रुपयाला',
  'ki',
  'ka',
  'ke',
  'la',
  'ला',
  'mein',
  'में',
]);

/** Everything the owner said, in one pass. Unknown parts are simply left out. */
export function parseBrief(
  text: string,
  library: { id: string; name: string }[] = [],
  today = new Date(),
): VoiceBrief {
  const w = tokens(text);
  const brief: VoiceBrief = {};
  const nums = findNumbers(w);
  const used = new Set<number>();

  // Dates first, so day numbers are not taken as prices.
  const dates = parseDates(text, today);
  Object.assign(brief, dates);
  w.forEach((x, i) => {
    if (MONTHS[x]) {
      nums.forEach((n, k) => {
        if (n.end === i - 1 || (n.end === i - 3 && RANGE_WORDS.has(at(w, i - 2)))) used.add(k);
      });
    }
  });
  const time = parseTime(text);
  if (time) {
    brief.time = time;
    nums.forEach((n, k) => {
      const near = w.slice(n.end + 1, n.end + 4);
      const before = w.slice(Math.max(0, n.start - 2), n.start);
      if (near.some((x) => TIME_WORDS.has(x) || RANGE_WORDS.has(x)) && n.value <= 12) used.add(k);
      if (before.some((x) => EVENING.has(x) || MORNING.has(x))) used.add(k);
    });
  }

  nums.forEach((n, k) => {
    if (used.has(k)) return;
    const after = w.slice(n.end + 1, n.end + 3);
    if (after.some((x) => PERCENT.has(x)) && n.value > 0 && n.value < 100) {
      brief.discount ??= n.value;
      used.add(k);
    }
  });
  nums.forEach((n, k) => {
    if (used.has(k) || brief.price !== undefined) return;
    const before = w.slice(Math.max(0, n.start - 2), n.start);
    const after = w.slice(n.end + 1, n.end + 2);
    if (before.some((x) => PRICE_BEFORE.has(x)) || after.some((x) => PRICE_AFTER.has(x))) {
      brief.price = n.value;
      used.add(k);
    }
  });
  // A lone, larger number left over is most likely the price (the owner confirms it).
  if (brief.price === undefined) {
    const rest = nums.filter((n, k) => !used.has(k) && n.value >= 20);
    if (rest.length === 1 && rest[0]) brief.price = rest[0].value;
  }

  Object.assign(brief, detectProduct(text, library));
  brief.goal = detectGoal(w);
  brief.purpose = detectPurpose(w, brief.discount !== undefined);
  const occ = w.find((x) => OCCASIONS[x]);
  if (occ) brief.occasion = OCCASIONS[occ];
  brief.cta = detectCta(w);
  brief.language = detectLanguage(text);
  brief.businessType = detectBusinessType(w);
  for (const k of Object.keys(brief) as (keyof VoiceBrief)[])
    if (brief[k] === undefined) delete brief[k];
  return brief;
}

// ------------------------------------------------------------------------------------------
// Short answers and Studio commands
// ------------------------------------------------------------------------------------------
const YES = [
  'haan',
  'han',
  'haa',
  'ha',
  'hā',
  'हाँ',
  'हां',
  'हा',
  'हो',
  'ho',
  'yes',
  'yeah',
  'yep',
  'sahi',
  'सही',
  'barobar',
  'बरोबर',
  'ok',
  'okay',
  'theek',
  'ठीक',
  'bilkul',
  'बिल्कुल',
  'correct',
  'confirm',
];
const NO = [
  'nahi',
  'nahin',
  'nai',
  'नहीं',
  'नही',
  'no',
  'nope',
  'नको',
  'nako',
  'galat',
  'गलत',
  'chuk',
  'चूक',
  'wrong',
  'badlo',
  'बदलो',
  'change',
];

export function yesOrNo(text: string): 'yes' | 'no' | null {
  const w = tokens(text);
  if (w.some((x) => NO.includes(x))) return 'no';
  if (w.some((x) => YES.includes(x))) return 'yes';
  return null;
}

export type BriefField = 'product' | 'price' | 'discount' | 'dates' | 'time';

/** The answer to one question ("Saree ki keemat kitni hai?" → "pandrah sau"). */
export function parseAnswer(
  field: BriefField,
  text: string,
  today = new Date(),
): Partial<VoiceBrief> {
  if (field === 'price') {
    const v = parseNumber(text);
    return v ? { price: v } : {};
  }
  if (field === 'discount') {
    const v = parseNumber(text);
    return v && v < 100 ? { discount: v } : {};
  }
  if (field === 'dates') return parseDates(text, today);
  if (field === 'time') {
    const t = parseTime(text) ?? parseTime(text + ' baje');
    return t ? { time: t } : {};
  }
  const p = detectProduct(text);
  const clean = text.trim().replace(/[.!?]+$/, '');
  return { product: p.product ?? (clean ? titleCase(clean).slice(0, 80) : undefined) };
}

export type StudioCommand =
  | { kind: 'discount'; value: number }
  | { kind: 'price'; value: number }
  | { kind: 'cta'; value: AdCta }
  | { kind: 'language'; value: AdLanguage }
  | { kind: 'unknown' };

/** A change said in the Studio: "discount 30 percent karo", "button call now", "English mein". */
export function parseCommand(text: string): StudioCommand {
  const w = tokens(text);
  const n = parseNumber(text);
  if (
    n !== null &&
    (has(w, 'discount', 'chhoot', 'chhut', 'छूट', 'सूट', 'सवलत', 'off') ||
      w.some((x) => PERCENT.has(x))) &&
    n < 100
  ) {
    return { kind: 'discount', value: n };
  }
  if (
    n !== null &&
    has(w, 'price', 'keemat', 'kimat', 'कीमत', 'किंमत', 'daam', 'दाम', 'rs', 'rupaye', 'रुपये')
  ) {
    return { kind: 'price', value: n };
  }
  if (has(w, 'english', 'इंग्लिश', 'इंग्रजी', 'angrezi')) return { kind: 'language', value: 'en' };
  if (has(w, 'marathi', 'मराठी')) return { kind: 'language', value: 'mr' };
  if (has(w, 'hindi', 'हिंदी', 'हिन्दी')) return { kind: 'language', value: 'hi' };
  if (has(w, 'hinglish')) return { kind: 'language', value: 'hinglish' };
  const cta = detectCta(w);
  if (
    cta &&
    has(
      w,
      'button',
      'बटन',
      'cta',
      'karo',
      'करो',
      'करा',
      'call',
      'whatsapp',
      'order',
      'book',
      'visit',
    )
  )
    return { kind: 'cta', value: cta };
  return { kind: 'unknown' };
}

// ------------------------------------------------------------------------------------------
// Wording shared by the screens
// ------------------------------------------------------------------------------------------
export const salePrice = (price: number, discount: number) =>
  Math.round(price * (1 - discount / 100));

export const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

/** The offer drawn on the ad (≤ 40 characters, the campaign's limit): "20% OFF · now ₹1,200". */
export function offerText(price: number | undefined, discount: number | undefined, time?: string) {
  let base: string | null = null;
  if (discount && price) base = `${discount}% OFF · now ${inr(salePrice(price, discount))}`;
  else if (discount) base = `${discount}% OFF`;
  if (!base) return time ? time.slice(0, 40) : null;
  const withTime = time ? `${base} · ${time}` : base;
  return withTime.length <= 40 ? withTime : base;
}

/** "Diwali sale", "New arrival: Saree", "Saree offer". */
export function campaignName(b: VoiceBrief): string {
  if (b.occasion) return `${b.occasion} ${b.goal === 'new_product' ? 'launch' : 'sale'}`;
  if (b.goal === 'new_product' && b.product) return `New arrival: ${b.product}`;
  return b.product ? `${b.product} offer` : 'New ad';
}
