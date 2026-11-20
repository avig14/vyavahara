import type { Lang } from "./i18n";
import type { L } from "./lang";
import { PERIOD_OPTIONS, periodLabelFor } from "./period";

/**
 * The khata risk engine writes its reasons as short Hinglish sentences. The numbers in them are computed in code;
 * this only re-phrases the known patterns in the chosen language and leaves anything else untouched.
 */
export function reasonText(text: string, l: L): string {
  let m = text.match(/^Sabse purana baaki (\d+) din se$/);
  if (m) return l(`Oldest unpaid amount is ${m[1]} days old`, `सबसे पुराना बाक़ी ${m[1]} दिन से है`, text);
  m = text.match(/^90 din mein sirf (\d+)% wapas aaya$/);
  if (m) return l(`Only ${m[1]}% came back in 90 days`, `90 दिन में सिर्फ़ ${m[1]}% वापस आया`, text);
  m = text.match(/^Limit ka (\d+)% use ho chuka$/);
  if (m) return l(`${m[1]}% of the limit is used`, `सीमा का ${m[1]}% इस्तेमाल हो चुका है`, text);
  m = text.match(/^Aakhri payment (\d+) din pehle$/);
  if (m) return l(`Last payment was ${m[1]} days ago`, `आख़िरी पेमेंट ${m[1]} दिन पहले हुआ`, text);
  if (text === "Abhi tak koi payment nahi") return l("No payment so far", "अब तक कोई पेमेंट नहीं", text);
  if (text === "Udhaar badhta ja raha hai") return l("The balance keeps growing", "उधार बढ़ता जा रहा है", text);
  return text;
}

/** The API labels a period in Hinglish ("Aaj (20 Nov)", "Pichhle 7 din (14 Nov to 20 Nov)"). Swap the leading name for the chosen language. */
export function periodText(label: string, lang: Lang): string {
  const i = label.indexOf(" (");
  const head = i === -1 ? label : label.slice(0, i);
  const rest = i === -1 ? "" : label.slice(i);
  const opt = PERIOD_OPTIONS.find((p) => p.label === head);
  return opt ? periodLabelFor(opt.name, lang) + rest : label;
}

type Rule = [RegExp, (m: RegExpMatchArray, l: L) => string];

/** Known sentences written by the loan, GST and cash-flow engines. Numbers stay as computed; unknown text passes through. */
const ENGINE_RULES: Rule[] = [
  [/^Average monthly UPI (.+) \(zaroori (.+)\)$/, (m, l) => l(`Average monthly UPI ${m[1]} (needed ${m[2]})`, `औसत मासिक UPI ${m[1]} (ज़रूरी ${m[2]})`, m[0])],
  [/^Average monthly UPI (.+) kam hai \(zaroori (.+)\)$/, (m, l) => l(`Average monthly UPI ${m[1]} is low (needed ${m[2]})`, `औसत मासिक UPI ${m[1]} कम है (ज़रूरी ${m[2]})`, m[0])],
  [/^UPI inflow steady hai \(CV (.+)\)$/, (m, l) => l(`UPI inflow is steady (CV ${m[1]})`, `UPI की आमद स्थिर है (CV ${m[1]})`, m[0])],
  [/^UPI inflow utar-chadhav wala hai \(CV (.+)\)$/, (m, l) => l(`UPI inflow swings up and down (CV ${m[1]})`, `UPI की आमद ऊपर-नीचे होती है (CV ${m[1]})`, m[0])],
  [/^Cash sales UPI mein lo .*$/, (m, l) => l("Take cash sales by UPI: UPI history improves loan eligibility.", "कैश बिक्री UPI में लें: UPI के रिकॉर्ड से लोन की पात्रता बढ़ती है।", m[0])],
  [/^Yeh sirf indicative hai, loan lender ki approval par depend karta hai\./, (m, l) => l("This is only indicative; the loan depends on the lender's approval. A Key Fact Statement (KFS) will be shown before you accept.", "यह सिर्फ़ संकेत है, लोन लेंडर की मंज़ूरी पर निर्भर है। मंज़ूर करने से पहले Key Fact Statement (KFS) दिखाया जाएगा।", m[0])],
  [/^Yeh sirf andaaza hai\. Filing se pehle apne CA se verify karein\.$/, (m, l) => l("This is only an estimate. Verify with your CA before filing.", "यह सिर्फ़ अंदाज़ा है। फ़ाइल करने से पहले अपने CA से जाँच लें।", m[0])],
  [/^GST registration nahi hai, isliye tax nahi banta\.$/, (m, l) => l("There is no GST registration, so no tax applies.", "GST पंजीकरण नहीं है, इसलिए टैक्स नहीं बनता।", m[0])],
  [/^Composition: (.+)% × quarter ki turnover \(CMP-08 ke liye\)\.$/, (m, l) => l(`Composition: ${m[1]}% × the quarter's turnover (for CMP-08).`, `कंपोज़िशन: ${m[1]}% × तिमाही का टर्नओवर (CMP-08 के लिए)।`, m[0])],
  [/^Regular dealer: slab-wise output tax .*$/, (m, l) => l("Regular dealer: slab-wise output tax (tax-inclusive prices) minus input tax on purchase bills.", "रेगुलर डीलर: स्लैब के हिसाब से आउटपुट टैक्स (टैक्स समेत दाम) घटा ख़रीद बिलों का इनपुट टैक्स।", m[0])],
  [/^Udhaar wasool karo: (.+) se (.+) aa sakta hai$/, (m, l) => l(`Collect udhaar: ${m[2]} could come from ${m[1]}`, `उधार वसूलें: ${m[1]} से ${m[2]} आ सकता है`, m[0])],
  [/^(.+) se (.+) ka payment 2-3 din aage karne ko bolo$/, (m, l) => l(`Ask ${m[1]} to move the ${m[2]} payment 2-3 days later`, `${m[1]} से ${m[2]} का पेमेंट 2-3 दिन आगे करने को कहें`, m[0])],
  [/^(.+) abhi do, baaki (.+) baad mein$/, (m, l) => l(`Pay ${m[1]} now, the remaining ${m[2]} later`, `${m[1]} अभी दें, बाक़ी ${m[2]} बाद में`, m[0])],
];

export function engineText(text: string, l: L): string {
  for (const [re, fn] of ENGINE_RULES) {
    const m = text.match(re);
    if (m) return fn(m, l);
  }
  return text;
}

import type { Anomaly } from "@/lib/analytics/anomalies";
import { rupees } from "@/lib/format";

/** The unusual-sales sentences, rebuilt from the structured numbers the engine already returns. */
export function anomalyText(a: Anomaly, l: L): string {
  if (a.kind === "item_drop") {
    return l(
      `${a.name}: sold ${a.actualUnits} in the last 3 days, expected ~${Math.round(a.expectedUnits)} (${Math.round(a.share * 100)}%)`,
      `${a.name}: पिछले 3 दिन में ${a.actualUnits} बिका, अपेक्षित ~${Math.round(a.expectedUnits)} (${Math.round(a.share * 100)}%)`,
      a.text,
    );
  }
  if (a.kind === "refund_spike") {
    return l(
      `${a.count} refunds today, ${rupees(a.todayPaise)}: ${a.multiple.toFixed(1)}× the daily average of ${rupees(Math.round(a.avgDailyPaise))}`,
      `आज ${a.count} रिफंड, ${rupees(a.todayPaise)}: रोज़ के औसत ${rupees(Math.round(a.avgDailyPaise))} से ${a.multiple.toFixed(1)}× ज़्यादा`,
      a.text,
    );
  }
  const pct = Math.abs(Math.round(a.deltaPct * 100));
  const dip = a.kind === "sales_dip";
  return l(
    `Sales so far today ${rupees(a.todayPaise)}, ${pct}% ${dip ? "lower" : "higher"} than the usual ${rupees(Math.round(a.expectedPaise))}`,
    `आज अब तक की बिक्री ${rupees(a.todayPaise)}, सामान्य ${rupees(Math.round(a.expectedPaise))} से ${pct}% ${dip ? "कम" : "ज़्यादा"}`,
    a.text,
  );
}
