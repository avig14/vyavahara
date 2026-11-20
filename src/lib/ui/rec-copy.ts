import type { Recommendation } from "@/lib/analytics/recommendations";
import type { L } from "./lang";

/** One recommendation, written for the shopkeeper in the chosen language. Numbers come from `rec.facts` (computed in code); this only phrases them. */
export interface RecCopy {
  title: string;
  /** why it is being shown, in plain words */
  why: string;
  /** a realistic, labelled estimate; absent when there is nothing honest to say */
  result?: string;
  cta: { label: string; href: string };
  /** an editable message the owner can send on WhatsApp (never sent automatically) */
  whatsapp?: string;
}

const s = (v: unknown) => String(v ?? "");

export function confidenceWord(c: number, l: L): string {
  if (c >= 0.8) return l("High confidence", "भरोसा ज़्यादा", "Bharosa zyada");
  if (c >= 0.55) return l("Medium confidence", "भरोसा मध्यम", "Bharosa madhyam");
  return l("Low confidence, limited data", "भरोसा कम, डेटा कम है", "Bharosa kam, data kam hai");
}

export function describeRec(rec: Recommendation, l: L, money: (paise: number) => string): RecCopy {
  const f = rec.facts;
  const impact = rec.impactPaise > 0 ? money(rec.impactPaise) : null;
  const est = (en: string, hi: string, hing: string) => (impact ? l(en, hi, hing) : undefined);

  switch (rec.type) {
    case "REORDER": {
      const out = Number(f.stock) <= 0;
      const pid = rec.id.split(":")[1] ?? "";
      return {
        title: out
          ? l(`${s(f.item)} is finished. Prepare an order.`, `${s(f.item)} ख़त्म है। ऑर्डर तैयार करें।`, `${s(f.item)} khatam hai. Order taiyaar karo.`)
          : l(`${s(f.item)} may run out in about ${s(f.daysLeft)} days`, `${s(f.item)} करीब ${s(f.daysLeft)} दिन में ख़त्म हो सकता है`, `${s(f.item)} lagbhag ${s(f.daysLeft)} din mein khatam ho sakta hai`),
        why: l(
          `You sell about ${s(f.dailySales)} a day and the supplier takes ${s(f.leadTimeDays)} days to deliver. Suggested order: ${s(f.orderQty)}. This is an estimate from your past sales.`,
          `आप रोज़ करीब ${s(f.dailySales)} बेचते हैं और सप्लायर को पहुँचाने में ${s(f.leadTimeDays)} दिन लगते हैं। सुझाया ऑर्डर: ${s(f.orderQty)}। यह आपकी पिछली बिक्री से अनुमान है।`,
          `Aap roz lagbhag ${s(f.dailySales)} bechte hain aur supplier ko pahunchane mein ${s(f.leadTimeDays)} din lagte hain. Suggested order: ${s(f.orderQty)}. Yeh aapki pichhli bikri se anumaan hai.`,
        ),
        result: est(`Could avoid about ${impact} of lost profit (estimate, not a promise)`, `करीब ${impact} का नुक़सान बच सकता है (अनुमान, गारंटी नहीं)`, `Lagbhag ${impact} ka nuksaan bach sakta hai (anumaan, guarantee nahi)`),
        cta: { label: l("Open in Stock", "स्टॉक में खोलें", "Stock mein kholo"), href: `/dashboard/inventory?product=${pid}` },
        whatsapp: l(
          `Hello, I need ${s(f.orderQty)} of ${s(f.item)}. When can you deliver?`,
          `नमस्ते, मुझे ${s(f.item)} ${s(f.orderQty)} चाहिए। कब तक भेज सकते हैं?`,
          `Namaste, mujhe ${s(f.item)} ${s(f.orderQty)} chahiye. Kab tak bhej sakte hain?`,
        ),
      };
    }
    case "PAYABLE_DUE": {
      const d = Number(f.dueInDays);
      const when = d < 0 ? l(`${-d} days late`, `${-d} दिन लेट`, `${-d} din late`) : d === 0 ? l("today", "आज", "aaj") : l(`in ${d} ${d === 1 ? "day" : "days"}`, `${d} दिन में`, `${d} din mein`);
      return {
        title: l(`Pay ${s(f.vendor)} ${s(f.amount)}, due ${when}`, `${s(f.vendor)} को ${s(f.amount)} देने हैं, ${when}`, `${s(f.vendor)} ko ${s(f.amount)} dene hain, ${when}`),
        why: l(`The bill is due ${when}. Paying on time keeps your credit with this supplier good.`, `बिल ${when} देय है। समय पर देने से इस सप्लायर के साथ आपका भरोसा बना रहता है।`, `Bill ${when} due hai. Time par dene se supplier ke saath aapka bharosa bana rehta hai.`),
        cta: { label: l("Open Suppliers", "सप्लायर खोलें", "Supplier kholo"), href: "/dashboard/vendors" },
      };
    }
    case "COLLECT_DUES":
      return {
        title: l(`${s(f.customer)} has ${s(f.outstanding)} pending`, `${s(f.customer)} का ${s(f.outstanding)} बाक़ी है`, `${s(f.customer)} ka ${s(f.outstanding)} baaki hai`),
        why: l(`The oldest amount is ${s(f.oldestDays)} days old. A polite reminder usually helps.`, `सबसे पुराना हिसाब ${s(f.oldestDays)} दिन का है। एक विनम्र याद दिलाना अक्सर काम करता है।`, `Sabse purana hisaab ${s(f.oldestDays)} din ka hai. Ek vinamra yaad dilana aksar kaam karta hai.`),
        cta: { label: l("Open Khata", "खाता खोलें", "Khata kholo"), href: "/dashboard/khata" },
        whatsapp: l(
          `Hello ${s(f.customer)}, a gentle reminder: ${s(f.outstanding)} is pending at our shop. Please pay when convenient. Thank you.`,
          `नमस्ते ${s(f.customer)}, एक छोटी याद: हमारी दुकान पर ${s(f.outstanding)} बाक़ी है। सुविधा से दे दीजिए। धन्यवाद।`,
          `Namaste ${s(f.customer)}, ek chhoti yaad: hamari dukaan par ${s(f.outstanding)} baaki hai. Suvidha se de dijiye. Dhanyavaad.`,
        ),
      };
    case "STOP_CREDIT":
      return {
        title: l(`Look at ${s(f.customer)}'s udhaar before giving more`, `${s(f.customer)} को और उधार देने से पहले हिसाब देखें`, `${s(f.customer)} ko aur udhaar dene se pehle hisaab dekho`),
        why: l(`${s(f.outstanding)} is pending, the oldest ${s(f.oldestDays)} days. You decide whether to give more credit.`, `${s(f.outstanding)} बाक़ी है, सबसे पुराना ${s(f.oldestDays)} दिन का। और उधार देना है या नहीं, आप तय करें।`, `${s(f.outstanding)} baaki hai, sabse purana ${s(f.oldestDays)} din ka. Aur udhaar dena hai ya nahi, aap tay karo.`),
        cta: { label: l("Open Khata", "खाता खोलें", "Khata kholo"), href: "/dashboard/khata" },
      };
    case "RAISE_LIMIT":
      return {
        title: l(`${s(f.customer)} pays reliably`, `${s(f.customer)} समय पर देते हैं`, `${s(f.customer)} time par dete hain`),
        why: l(`You could raise the credit limit from ${s(f.currentLimit)} to ${s(f.suggestedLimit)}. Only if you are comfortable.`, `उधार की सीमा ${s(f.currentLimit)} से ${s(f.suggestedLimit)} कर सकते हैं। अगर आप ठीक समझें।`, `Udhaar limit ${s(f.currentLimit)} se ${s(f.suggestedLimit)} kar sakte ho. Agar aap theek samjho.`),
        cta: { label: l("Open Khata", "खाता खोलें", "Khata kholo"), href: "/dashboard/khata" },
      };
    case "FESTIVAL_STOCKUP":
      return {
        title: l(`${s(f.festival)} is ${s(f.daysAway)} days away`, `${s(f.festival)} में ${s(f.daysAway)} दिन बाक़ी`, `${s(f.festival)} mein ${s(f.daysAway)} din baaki`),
        why: l(`Demand for these usually rises: ${s(f.topItems)}. Order by ${s(f.orderBy)}. This is an estimate from past festivals.`, `इनकी माँग अक्सर बढ़ती है: ${s(f.topItems)}। ${s(f.orderBy)} तक ऑर्डर करें। यह पिछले त्योहारों से अनुमान है।`, `Inki maang aksar badhti hai: ${s(f.topItems)}. ${s(f.orderBy)} tak order karo. Yeh pichhle tyohaaron se anumaan hai.`),
        result: est(`Possible extra profit about ${impact} (estimate)`, `संभावित अतिरिक्त मुनाफ़ा करीब ${impact} (अनुमान)`, `Sambhavit extra munafa lagbhag ${impact} (anumaan)`),
        cta: { label: l("See the festival plan", "त्योहार की योजना देखें", "Tyohaar ka plan dekho"), href: "/dashboard/growth" },
      };
    case "CASH_SHORTFALL":
      return {
        title: l(`Cash may fall short by ${s(f.shortfall)} on ${s(f.date)}`, `${s(f.date)} को ${s(f.shortfall)} की कमी हो सकती है`, `${s(f.date)} ko ${s(f.shortfall)} ki kami ho sakti hai`),
        why: l(`${s(f.vendor)}'s payment of ${s(f.payable)} is due then. This is a projection, not a certainty.`, `तब ${s(f.vendor)} का ${s(f.payable)} देना है। यह अनुमान है, पक्की बात नहीं।`, `Tab ${s(f.vendor)} ka ${s(f.payable)} dena hai. Yeh anumaan hai, pakki baat nahi.`),
        cta: { label: l("See cash plan", "कैश योजना देखें", "Cash plan dekho"), href: "/dashboard/growth" },
      };
    case "PRICE_HIKE":
      return {
        title: l(`${s(f.vendor)} raised the rate of ${s(f.item)}`, `${s(f.vendor)} ने ${s(f.item)} का रेट बढ़ाया`, `${s(f.vendor)} ne ${s(f.item)} ka rate badhaya`),
        why: l(`${s(f.oldCost)} to ${s(f.newCost)} (${s(f.hikePct)}% more), from your bills.`, `${s(f.oldCost)} से ${s(f.newCost)} (${s(f.hikePct)}% ज़्यादा), आपके बिलों से।`, `${s(f.oldCost)} se ${s(f.newCost)} (${s(f.hikePct)}% zyada), aapke bills se.`),
        cta: { label: l("Open Suppliers", "सप्लायर खोलें", "Supplier kholo"), href: "/dashboard/vendors" },
      };
    case "VENDOR_SWITCH":
      return {
        title: l(`${s(f.item)} costs less at ${s(f.to)}`, `${s(f.item)} ${s(f.to)} के पास सस्ता है`, `${s(f.item)} ${s(f.to)} ke paas sasta hai`),
        why: l(`${s(f.cheaperCost)} instead of ${s(f.currentCost)} (${s(f.savingPct)}% less), per your own bills. Check quality and delivery before switching.`, `${s(f.currentCost)} की जगह ${s(f.cheaperCost)} (${s(f.savingPct)}% कम), आपके बिलों के हिसाब से। बदलने से पहले क्वालिटी और डिलीवरी देख लें।`, `${s(f.currentCost)} ki jagah ${s(f.cheaperCost)} (${s(f.savingPct)}% kam), aapke bills ke hisaab se. Badalne se pehle quality aur delivery dekh lo.`),
        result: est(`Could save about ${impact} a month (estimate)`, `महीने में करीब ${impact} बच सकते हैं (अनुमान)`, `Mahine mein lagbhag ${impact} bach sakte hain (anumaan)`),
        cta: { label: l("Open Suppliers", "सप्लायर खोलें", "Supplier kholo"), href: "/dashboard/vendors" },
      };
    case "DEAD_STOCK_CLEAR":
      return {
        title: l(`${s(f.item)} has not sold in ${s(f.deadStockDays)}+ days`, `${s(f.item)} ${s(f.deadStockDays)}+ दिन से नहीं बिका`, `${s(f.item)} ${s(f.deadStockDays)}+ din se nahi bika`),
        why: l(`${s(f.valueAtCost)} is lying in stock. A small discount may clear it.`, `${s(f.valueAtCost)} का माल पड़ा है। थोड़ी छूट से निकल सकता है।`, `${s(f.valueAtCost)} ka maal pada hai. Thodi chhoot se nikal sakta hai.`),
        cta: { label: l("Open Stock", "स्टॉक खोलें", "Stock kholo"), href: "/dashboard/inventory" },
      };
    case "OVERSTOCK":
      return {
        title: l(`${s(f.item)} is well stocked. Do not reorder yet.`, `${s(f.item)} का स्टॉक काफ़ी है। अभी ऑर्डर न दें।`, `${s(f.item)} ka stock kaafi hai. Abhi order mat do.`),
        why: l(`About ${s(f.coverDays)} days of cover, around ${s(f.excessValue)} more than needed.`, `करीब ${s(f.coverDays)} दिन का माल है, ज़रूरत से लगभग ${s(f.excessValue)} ज़्यादा।`, `Lagbhag ${s(f.coverDays)} din ka maal hai, zaroorat se lagbhag ${s(f.excessValue)} zyada.`),
        cta: { label: l("Open Stock", "स्टॉक खोलें", "Stock kholo"), href: "/dashboard/inventory" },
      };
    case "ADD_LOST_DEMAND_ITEM":
      return {
        title: l(`Customers are asking for ${s(f.item)}`, `ग्राहक ${s(f.item)} माँग रहे हैं`, `Customers ${s(f.item)} maang rahe hain`),
        why: l(`${s(f.requestsThisWeek)} asked this week and it was not in stock.`, `इस हफ़्ते ${s(f.requestsThisWeek)} ने माँगा और स्टॉक में नहीं था।`, `Is hafte ${s(f.requestsThisWeek)} ne maanga aur stock mein nahi tha.`),
        cta: { label: l("Open Stock", "स्टॉक खोलें", "Stock kholo"), href: "/dashboard/inventory" },
      };
    case "LOW_MARGIN":
      return {
        title: l(`${s(f.item)} earns only ${s(f.marginPct)}%`, `${s(f.item)} पर सिर्फ़ ${s(f.marginPct)}% मुनाफ़ा`, `${s(f.item)} par sirf ${s(f.marginPct)}% munafa`),
        why: l(`Your target is ${s(f.targetPct)}%. Check its price or supplier rate.`, `आपका लक्ष्य ${s(f.targetPct)}% है। उसका दाम या सप्लायर का रेट देखें।`, `Aapka target ${s(f.targetPct)}% hai. Uska daam ya supplier ka rate dekho.`),
        cta: { label: l("Open Growth", "ग्रोथ खोलें", "Growth kholo"), href: "/dashboard/growth" },
      };
    case "INCREASE_UPI_SHARE":
      return {
        title: l("Take more payments by UPI", "ज़्यादा पेमेंट UPI से लें", "Zyada payment UPI se lo"),
        why: l(`${s(f.cashSharePct)}% of sales are cash. UPI makes your hisaab and loan eligibility better.`, `${s(f.cashSharePct)}% बिक्री कैश है। UPI से हिसाब और लोन पात्रता बेहतर होती है।`, `${s(f.cashSharePct)}% bikri cash hai. UPI se hisaab aur loan eligibility behtar hoti hai.`),
        cta: { label: l("Open Growth", "ग्रोथ खोलें", "Growth kholo"), href: "/dashboard/growth" },
      };
    case "LOAN_FOR_FESTIVAL":
      return {
        title: l(`A short loan could fund ${s(f.festival)} stock`, `${s(f.festival)} के स्टॉक के लिए छोटा लोन एक विकल्प है`, `${s(f.festival)} ke stock ke liye chhota loan ek option hai`),
        why: l(`Stock would cost about ${s(f.stockCost)}. Indicative limit ${s(f.indicativeMax)} (${s(f.lender)}). Indicative only, not an offer.`, `स्टॉक पर करीब ${s(f.stockCost)} लगेंगे। संकेतात्मक सीमा ${s(f.indicativeMax)} (${s(f.lender)})। यह सिर्फ़ संकेत है, ऑफ़र नहीं।`, `Stock par lagbhag ${s(f.stockCost)} lagenge. Indicative limit ${s(f.indicativeMax)} (${s(f.lender)}). Sirf sanket hai, offer nahi.`),
        cta: { label: l("Open Growth", "ग्रोथ खोलें", "Growth kholo"), href: "/dashboard/growth" },
      };
    default:
      return { title: rec.title, why: "", cta: { label: l("Open", "खोलें", "Kholo"), href: "/dashboard" } };
  }
}
