export type Lang = "en" | "hi" | "hing";
export const LANGS: readonly { id: Lang; label: string; htmlLang: string }[] = [
  { id: "en", label: "English", htmlLang: "en" },
  { id: "hi", label: "हिन्दी", htmlLang: "hi" },
  { id: "hing", label: "Hinglish", htmlLang: "en-IN" },
];
export const LANG_COOKIE = "vy-lang";
export function parseLang(v: string | undefined | null): Lang {
  return v === "hi" || v === "hing" || v === "en" ? v : "hing";
}

type Entry = Record<Lang, string>;
const e = (en: string, hi: string, hing: string): Entry => ({ en, hi, hing });

/** `*word*` renders as a blue key word, `_word_` as bold navy. */
export const DICT: Record<string, Entry> = {
  // chrome
  "lang.label": e("Language", "भाषा", "Bhasha"),
  brand: e("Vyavahāra", "व्यवहार", "Vyavahāra"),
  "nav.privacy": e("Privacy", "गोपनीयता", "Privacy"),
  "foot.demo": e(
    "Demo build: one sample shop, no sign-in.",
    "डेमो: एक नमूना दुकान, साइन-इन नहीं।",
    "Demo build: ek sample dukaan, sign-in nahi.",
  ),
  // landing hero
  "hero.h1": e(
    "Every *soundbox payment* lands in your *rozmel*.",
    "हर *साउंडबॉक्स पेमेंट* आपके *रोज़मेल* में दर्ज होता है।",
    "Har *soundbox payment* aapke *rozmel* mein aata hai.",
  ),
  "hero.lead": e(
    "_Khata_, _credit_, _stock_ and _suppliers_ follow from it.",
    "इसी से _खाता_, _उधार_, _स्टॉक_ और _सप्लायर_ बनते हैं।",
    "_Khata_, _udhaar_, _stock_ aur _suppliers_ isi se bante hain.",
  ),
  "hero.cta1": e("Set up your shop", "दुकान शुरू करें", "Dukaan shuru karein"),
  "hero.cta2": e(
    "See the demo dashboard",
    "डेमो डैशबोर्ड देखें",
    "Demo dashboard dekhein",
  ),
  "after.h2": e(
    "What happens *after a payment*",
    "पेमेंट के *बाद क्या होता है*",
    "Payment ke *baad kya hota hai*",
  ),
  "after.caption": e(
    "What Vyavahāra does for each thing that happens in the shop",
    "दुकान में हर बात पर व्यवहार क्या करता है",
    "Dukaan mein har baat par Vyavahāra kya karta hai",
  ),
  "after.when": e("When this happens", "जब ऐसा होता है", "Jab yeh hota hai"),
  "after.does": e(
    "Vyavahāra does this",
    "व्यवहार यह करता है",
    "Vyavahāra yeh karta hai",
  ),
  "after.where": e("Where", "कहाँ", "Kahaan"),
  "after.r1.when": e(
    "A UPI payment arrives",
    "UPI पेमेंट आता है",
    "UPI payment aata hai",
  ),
  "after.r1.then": e(
    "A new line in the rozmel, with the running total.",
    "रोज़मेल में नई लाइन, जोड़ के साथ।",
    "Rozmel mein nayi line, jod ke saath.",
  ),
  "after.r2.when": e(
    "Credit runs late",
    "उधार लेट हो जाता है",
    "Udhaar late ho jaata hai",
  ),
  "after.r2.then": e(
    "Khata flags it and Saathi drafts the reminder.",
    "खाता उसे लाल करता है और साथी याद दिलाने का संदेश लिखता है।",
    "Khata ise flag karta hai aur Saathi reminder likh deta hai.",
  ),
  "after.r3.when": e("Atta runs low", "आटा कम पड़ता है", "Atta kam padta hai"),
  "after.r3.then": e(
    "Stock warns you and drafts the supplier order.",
    "स्टॉक चेताता है और सप्लायर का ऑर्डर लिख देता है।",
    "Stock warn karta hai aur supplier order likh deta hai.",
  ),
  "after.r4.when": e(
    "You have a question",
    "आपको कुछ पूछना है",
    "Aapko kuch poochna hai",
  ),
  "after.r4.then": e(
    'Ask Saathi: "how much did I sell today?"',
    'साथी से पूछिए: "आज की बिक्री कितनी हुई?"',
    'Saathi se poochiye: "aaj ki bikri kitni hui?"',
  ),
  "where.rozmel": e("Rozmel", "रोज़मेल", "Rozmel"),
  "where.khata": e("Khata", "खाता", "Khata"),
  "where.stock": e("Stock", "स्टॉक", "Stock"),
  "where.saathi": e("Saathi", "साथी", "Saathi"),
  // rozmel example
  "ex.badge": e("Example", "उदाहरण", "Example"),
  "ex.note": e(
    "Sample items and amounts, not real sales.",
    "नमूना सामान और रक़म, असली बिक्री नहीं।",
    "Sample items aur amounts, asli bikri nahi.",
  ),
  "ex.caption": e(
    "Example rozmel: sample payments with a running total, newest first",
    "उदाहरण रोज़मेल: जोड़ के साथ नमूना पेमेंट, नया ऊपर",
    "Example rozmel: jod ke saath sample payments, naya upar",
  ),
  "ex.time": e("Time", "समय", "Time"),
  "ex.items": e("Items", "सामान", "Items"),
  "ex.by": e("Paid by", "भुगतान", "Paid by"),
  "ex.amount": e("Amount", "रक़म", "Amount"),
  "ex.total": e("Total so far", "अब तक का जोड़", "Ab tak ka jod"),
  // shell
  "nav.overview": e("Overview", "हिसाब", "Hisaab"),
  "nav.stock": e("Stock", "स्टॉक", "Stock"),
  "nav.suppliers": e("Suppliers", "सप्लायर", "Supplier"),
  "nav.khata": e("Khata", "खाता", "Khata"),
  "nav.customers": e("Customers", "ग्राहक", "Grahak"),
  "nav.reports": e("Reports", "रिपोर्ट", "Report"),
  "nav.growth": e("Growth", "ग्रोथ", "Growth"),
  "nav.settings": e("Settings", "सेटिंग", "Setting"),
  "nav.soundbox": e("Soundbox", "साउंडबॉक्स", "Soundbox"),
  "top.saathi": e("Saathi", "साथी", "Saathi"),
  // overview
  "ov.title": e("Overview", "हिसाब", "Hisaab"),
  "ov.sales": e("Sales", "बिक्री", "Bikri"),
  "ov.profit": e("Profit", "मुनाफ़ा", "Munafa"),
  "ov.grossProfit": e("Gross profit", "कुल मुनाफ़ा", "Gross munafa"),
  "ov.expenses": e("Expenses", "ख़र्चा", "Kharcha"),
  "ov.bills": e("Bills", "बिल", "Bills"),
  "ov.avgBill": e("Average bill", "औसत बिल", "Average bill"),
  "ov.profitNote": e(
    "Gross profit minus expenses",
    "कुल मुनाफ़ा घटा ख़र्चा",
    "Gross munafa minus kharcha",
  ),
  "ov.rozmel": e("Today's rozmel", "आज का रोज़मेल", "Aaj ka rozmel"),
  "ov.refresh": e("Refresh", "ताज़ा करें", "Naya dekho"),
  "ov.todo": e("What to do now", "अब क्या करना है", "Ab kya karna hai"),
  "ov.alerts": e("Needs attention", "ध्यान दें", "Dhyaan do"),
  "ov.top": e("Best sellers", "सबसे ज़्यादा बिकने वाले", "Sabse zyada bikne wale"),
  "ov.daily": e("Daily sales", "रोज़ की बिक्री", "Roz ki sales"),
  "ov.busy": e("When it is busy", "कब भीड़ रहती है", "Kab bheed rehti hai"),
};

export function translate(lang: Lang, key: string): string {
  const entry = DICT[key];
  return entry ? entry[lang] : key;
}
