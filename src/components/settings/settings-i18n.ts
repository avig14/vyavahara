import type { L } from "@/lib/ui/lang";
import type { FieldDef, GroupDef } from "./fields";

/** Hindi and Hinglish for every settings field: [label hi, label hing, description hi, description hing]. English comes from fields.ts. */
const F: Record<string, [string, string, string, string]> = {
  "inventory.serviceLevelZ": [
    "सुरक्षित स्टॉक का गद्दा",
    "Safety stock ka cushion",
    "भीड़ वाले दिन के लिए रखा अतिरिक्त स्टॉक। 1.28 करीब 90% दिन, 1.65 करीब 95%, 2.05 करीब 98% दिन संभालता है। ज़्यादा मान ज़्यादा अतिरिक्त स्टॉक रखता है।",
    "Bheed wale din ke liye rakha extra stock. 1.28 lagbhag 90% din, 1.65 lagbhag 95%, 2.05 lagbhag 98% din sambhalta hai. Zyada value zyada extra stock rakhti hai.",
  ],
  "inventory.reviewBufferDays": [
    "कितने अतिरिक्त दिन का ऑर्डर",
    "Kitne extra din ka order",
    "सुझाया ऑर्डर सप्लायर के डिलीवरी समय के ऊपर इतने दिन का स्टॉक ख़रीदता है।",
    "Suggested order supplier ke delivery time ke upar itne din ka stock kharidta hai.",
  ],
  "inventory.overstockCoverDays": [
    "इसके बाद ज़्यादा स्टॉक",
    "Itne din ke baad zyada stock",
    "किसी आइटम का स्टॉक इससे ज़्यादा दिन चले तो उसे ज़्यादा स्टॉक माना जाता है।",
    "Kisi item ka stock isse zyada din chale to use zyada stock mana jaata hai.",
  ],
  "inventory.deadStockDays": [
    "इसके बाद मरा हुआ स्टॉक",
    "Itne din ke baad dead stock",
    "इतने समय तक कुछ न बिके तो आइटम को मरा हुआ स्टॉक माना जाता है।",
    "Itne samay tak kuch na bike to item ko dead stock mana jaata hai.",
  ],
  "inventory.horizonDays": [
    "अनुमान कितने दिन आगे का",
    "Anumaan kitne din aage ka",
    "डैशबोर्ड का अनुमान कितने दिन आगे देखता है।",
    "Dashboard ka anumaan kitne din aage dekhta hai.",
  ],
  "khata.weights.oldest": [
    "सबसे पुराना बाक़ी",
    "Sabse purana baaki",
    "स्कोर में सबसे पुराने बाक़ी की उम्र का कितना असर है।",
    "Score mein sabse purane baaki ki umr ka kitna asar hai.",
  ],
  "khata.weights.repay": [
    "चुकाने का रिकॉर्ड",
    "Chukane ka record",
    "स्कोर में ग्राहक के चुकाने के रिकॉर्ड का कितना असर है।",
    "Score mein customer ke chukane ke record ka kitna asar hai.",
  ],
  "khata.weights.utilization": [
    "इस्तेमाल की गई सीमा",
    "Use ki gayi limit",
    "स्कोर में उधार की सीमा के पहले से इस्तेमाल हिस्से का कितना असर है।",
    "Score mein udhaar ki limit ke pehle se use hisse ka kitna asar hai.",
  ],
  "khata.weights.lastPayment": [
    "आख़िरी पेमेंट के बाद का समय",
    "Aakhri payment ke baad ka samay",
    "स्कोर में आख़िरी पेमेंट के बाद लंबे अंतर का कितना असर है।",
    "Score mein aakhri payment ke baad lambe antar ka kitna asar hai.",
  ],
  "khata.weights.growing": [
    "बढ़ता हुआ बाक़ी",
    "Badhta hua baaki",
    "स्कोर में लगातार बढ़ते बाक़ी का कितना असर है।",
    "Score mein lagaataar badhte baaki ka kitna asar hai.",
  ],
  "khata.oldestFullDays": [
    "सबसे पुराना बाक़ी पूरा गिना जाए",
    "Sabse purana baaki poora gina jaaye",
    "इतने दिन बाक़ी रहने पर स्कोर का सबसे-पुराने-बाक़ी वाला हिस्सा अधिकतम होता है।",
    "Itne din baaki rehne par score ka sabse-purane-baaki wala hissa maximum hota hai.",
  ],
  "khata.lastPaymentFullDays": [
    "आख़िरी पेमेंट पूरा गिना जाए",
    "Aakhri payment poora gina jaaye",
    "आख़िरी पेमेंट को इतने दिन होने पर स्कोर का वह हिस्सा अधिकतम होता है।",
    "Aakhri payment ko itne din hone par score ka woh hissa maximum hota hai.",
  ],
  "khata.greenMax": [
    "हरा इस स्कोर तक",
    "Green is score tak",
    "इस या इससे कम स्कोर हरा है। पीले की सीमा से कम होना चाहिए।",
    "Is ya isse kam score green hai. Amber ki limit se kam hona chahiye.",
  ],
  "khata.amberMax": [
    "पीला इस स्कोर तक",
    "Amber is score tak",
    "इस या इससे कम स्कोर पीला है; इससे ऊपर सब लाल।",
    "Is ya isse kam score amber hai; isse upar sab red.",
  ],
  "khata.recovery.green": [
    "हरे ग्राहकों से",
    "Green customers se",
    "हरे ग्राहक के बाक़ी का जितना हिस्सा वापस आने की उम्मीद है।",
    "Green customer ke baaki ka jitna hissa wapas aane ki ummeed hai.",
  ],
  "khata.recovery.amber": [
    "पीले ग्राहकों से",
    "Amber customers se",
    "पीले ग्राहक के बाक़ी का जितना हिस्सा वापस आने की उम्मीद है।",
    "Amber customer ke baaki ka jitna hissa wapas aane ki ummeed hai.",
  ],
  "khata.recovery.red": [
    "लाल ग्राहकों से",
    "Red customers se",
    "लाल ग्राहक के बाक़ी का जितना हिस्सा वापस आने की उम्मीद है।",
    "Red customer ke baaki ka jitna hissa wapas aane ki ummeed hai.",
  ],
  "khata.limitMultiplier": [
    "हरे ग्राहकों के लिए सुझाई सीमा",
    "Green customers ke liye suggested limit",
    "सुझाई सीमा ग्राहक की महीने की ख़रीद का इतना गुना होती है।",
    "Suggested limit customer ki mahine ki kharid ka itna guna hoti hai.",
  ],
  "khata.defaultLimitPaise": [
    "नए खाता ग्राहक की सीमा",
    "Naye khata customer ki limit",
    "बिल्कुल नए खाता ग्राहक को शुरू में मिलने वाली उधार सीमा।",
    "Bilkul naye khata customer ko shuru mein milne wali udhaar limit.",
  ],
  "cash.openingBalancePaise": [
    "हाथ में कैश और बैंक",
    "Haath mein cash aur bank",
    "अनुमान की शुरुआत में आपके पास जितना है। न पता हो तो 0 रहने दें।",
    "Anumaan ki shuruaat mein aapke paas jitna hai. Na pata ho to 0 rehne do.",
  ],
  "cash.minBufferPaise": [
    "कम से कम इतना रखें",
    "Kam se kam itna rakho",
    "सप्लायर को देने के बाद कम से कम जितना आप बचा हुआ चाहते हैं।",
    "Supplier ko dene ke baad kam se kam jitna aap bacha hua chahte ho.",
  ],
  "cash.collectionDays": [
    "खाता इतने दिन में वापस आता है",
    "Khata itne din mein wapas aata hai",
    "बाक़ी खाता इतने दिनों में वापस आने का अनुमान लगाया जाता है।",
    "Baaki khata itne dinon mein wapas aane ka anumaan lagaya jaata hai.",
  ],
  "cash.recurring": [
    "हर महीने के तय ख़र्चे",
    "Har mahine ke tay kharche",
    "किराया, तनख़्वाह, बिजली। बंद हो तो व्यवहार आपके ख़र्चे के रिकॉर्ड से सीखता है; चालू हो तो आपकी सूची उसकी जगह लेती है।",
    "Kiraya, tankhwah, bijli. Band ho to Vyavahāra aapke kharche ke record se seekhta hai; chalu ho to aapki list uski jagah leti hai.",
  ],
  "anomalies.zThreshold": [
    "दिन कितना असामान्य हो",
    "Din kitna asaamanya ho",
    "किसी दिन की बिक्री सामान्य से कितनी दूर हो तो उसे चिह्नित करें। कम मान ज़्यादा दिन चिह्नित करता है।",
    "Kisi din ki bikri saamanya se kitni door ho to use flag karo. Kam value zyada din flag karti hai.",
  ],
  "anomalies.salesDipPct": [
    "कितनी गिरावट चिह्नित हो",
    "Kitni giraavat flag ho",
    "सामान्य के मुक़ाबले इतनी बड़ी गिरावट भी चिह्नित होती है, क्योंकि दिन के बीच की बिक्री अस्थिर होती है।",
    "Saamanya ke muqable itni badi giraavat bhi flag hoti hai, kyunki din ke beech ki bikri asthir hoti hai.",
  ],
  "anomalies.refundMultiple": [
    "रिफंड में उछाल",
    "Refund mein uchhaal",
    "सामान्य से इतने गुना रिफंड चिह्नित होते हैं।",
    "Saamanya se itne guna refund flag hote hain.",
  ],
  "anomalies.itemDropShare": [
    "आइटम की मंदी",
    "Item ki mandi",
    "कोई आइटम 3 दिन तक अपने अनुमान के इस हिस्से से कम बिके तो चिह्नित होता है।",
    "Koi item 3 din tak apne anumaan ke is hisse se kam bike to flag hota hai.",
  ],
  "customers.regularVisits": [
    "नियमित ग्राहक के लिए ज़रूरी",
    "Regular customer ke liye zaroori",
    "नीचे की अवधि में कम से कम इतने दिन विज़िट हो।",
    "Neeche ki avadhi mein kam se kam itne din visit ho.",
  ],
  "customers.regularWindowDays": [
    "नियमित विज़िट की अवधि",
    "Regular visit ki avadhi",
    "जितने दिनों में वे विज़िट गिनी जाती हैं।",
    "Jitne dinon mein woh visits gini jaati hain.",
  ],
  "customers.newDays": [
    "नया ग्राहक कितने दिन तक",
    "Naya customer kitne din tak",
    "ग्राहक नया माना जाता है जब वह पहली बार इतने या उससे कम दिन पहले दिखा हो।",
    "Customer naya mana jaata hai jab woh pehli baar itne ya usse kam din pehle dikha ho.",
  ],
  "customers.lapsedDays": [
    "इतने दिन बाद आना बंद",
    "Itne din baad aana band",
    "कोई नियमित ग्राहक इतने या ज़्यादा दिन दूर रहे तो वह आना बंद माना जाता है।",
    "Koi regular customer itne ya zyada din door rahe to woh aana band mana jaata hai.",
  ],
  "gst.compositionRatePct": [
    "कंपोज़िशन स्कीम की दर",
    "Composition scheme ki rate",
    "कंपोज़िशन स्कीम में टर्नओवर पर लगने वाली दर। व्यापारियों के लिए आमतौर पर 1%।",
    "Composition scheme mein turnover par lagne wali rate. Vyapariyon ke liye aamtaur par 1%.",
  ],
  "loan.minMonthlyUpiPaise": [
    "न्यूनतम मासिक UPI आमद",
    "Minimum monthly UPI aamad",
    "लोन की सीमा के लिए ज़रूरी सबसे कम मासिक UPI आमद।",
    "Loan ki limit ke liye zaroori sabse kam monthly UPI aamad.",
  ],
  "loan.maxCv": [
    "महीने-दर-महीने सबसे ज़्यादा उतार-चढ़ाव",
    "Mahine-dar-mahine sabse zyada utaar-chadhaav",
    "मासिक UPI आमद इससे ज़्यादा (विचरण गुणांक) हिले तो भी पात्रता नहीं बनती।",
    "Monthly UPI aamad isse zyada (coefficient of variation) hile to bhi eligibility nahi banti.",
  ],
  "loan.rangeMultiple": [
    "संकेतात्मक अधिकतम",
    "Indicative maximum",
    "संकेतात्मक अधिकतम आपकी औसत मासिक UPI आमद का इतना गुना होता है।",
    "Indicative maximum aapki average monthly UPI aamad ka itna guna hota hai.",
  ],
  "loan.lenderName": [
    "लेंडर का नाम",
    "Lender ka naam",
    "लोन अनुमान में जिस लेंडर का नाम आता है।",
    "Loan anumaan mein jis lender ka naam aata hai.",
  ],
  "recommendations.pinDueDays": [
    "इतने दिन में देय सप्लायर बिल ऊपर रखें",
    "Itne din mein due supplier bills upar rakho",
    "इतने दिनों में देय सप्लायर बिल सबसे ऊपर रखे जाते हैं।",
    "Itne dinon mein due supplier bills sabse upar rakhe jaate hain.",
  ],
  "recommendations.priceHikePct": [
    "सप्लायर का रेट इतना बढ़े तो चिह्नित करें",
    "Supplier ka rate itna badhe to flag karo",
    "सप्लायर का इतना या ज़्यादा रेट बढ़ना चिह्नित होता है।",
    "Supplier ka itna ya zyada rate badhna flag hota hai.",
  ],
  "recommendations.vendorSwitchPct": [
    "इतने पर सप्लायर बदलने का सुझाव",
    "Itne par supplier badalne ka suggestion",
    "जब दूसरा सप्लायर कम से कम इतना सस्ता हो तब सुझाव आता है।",
    "Jab doosra supplier kam se kam itna sasta ho tab suggestion aata hai.",
  ],
  "recommendations.lowMarginPct": [
    "इससे कम मार्जिन",
    "Isse kam margin",
    "जिन आइटम का दाम पर मार्जिन इससे कम हो, वे चिह्नित होते हैं।",
    "Jin items ka daam par margin isse kam ho, woh flag hote hain.",
  ],
  "recommendations.cashShareMax": [
    "कैश का इतना हिस्सा होने पर ज़्यादा UPI का सुझाव",
    "Cash ka itna hissa hone par zyada UPI ka suggestion",
    "बिक्री में कैश इस हिस्से से ज़्यादा हो तो ज़्यादा UPI का सुझाव आता है।",
    "Bikri mein cash is hisse se zyada ho to zyada UPI ka suggestion aata hai.",
  ],
  "recommendations.deadStockRecovery": [
    "मरे हुए स्टॉक की वसूली",
    "Dead stock ki wasooli",
    "मरा हुआ स्टॉक निकालने पर अपनी लागत का जितना हिस्सा वापस मिलने की उम्मीद है।",
    "Dead stock nikalne par apni laagat ka jitna hissa wapas milne ki ummeed hai.",
  ],
  "recommendations.overstockCarry": [
    "ज़्यादा स्टॉक रखने की लागत",
    "Zyada stock rakhne ki laagat",
    "ज़्यादा स्टॉक की क़ीमत का जितना हिस्सा उसे रखने की लागत गिना जाता है।",
    "Zyada stock ki keemat ka jitna hissa use rakhne ki laagat gina jaata hai.",
  ],
  "recommendations.overstockTargetDays": [
    "ज़्यादा स्टॉक आँकने का लक्ष्य",
    "Zyada stock aankne ka target",
    "इतने दिन के स्टॉक से ऊपर का हिस्सा ज़्यादा गिना जाता है।",
    "Itne din ke stock se upar ka hissa zyada gina jaata hai.",
  ],
  "recommendations.maxItems": [
    "सूची में कितने आइटम",
    "List mein kitne items",
    "एक सूची में सामान्यतः कितने सुझाव आते हैं।",
    "Ek list mein saamanyatah kitne suggestions aate hain.",
  ],
  "ingest.billTolerancePct": [
    "सप्लायर बिल की छूट",
    "Supplier bill ki chhoot",
    "बिल की लाइनों का जोड़ छपे कुल से इतना ज़्यादा अलग हो तो बिल चिह्नित होता है।",
    "Bill ki lines ka jod chhape kul se itna zyada alag ho to bill flag hota hai.",
  ],
  "ingest.billMinMatchPct": [
    "बिल की कितनी लाइनें मेल खाएँ",
    "Bill ki kitni lines mel khaayein",
    "स्कैन बिल की इससे कम लाइनें आपके आइटम से मेल खाएँ तो उसे कमज़ोर पढ़ाई कहा जाता है। मंज़ूर करना फिर भी आप तय करते हैं।",
    "Scan bill ki isse kam lines aapke items se mel khaayein to use kamzor padhai kaha jaata hai. Manzoor karna phir bhi aap tay karte ho.",
  ],
  "ingest.matchMaxScore": [
    "आइटम के नाम का मिलान",
    "Item ke naam ka milaan",
    "बिल के नाम को आपके आइटम से मिलाते समय कम मान ज़्यादा सख़्त होता है।",
    "Bill ke naam ko aapke items se milate samay kam value zyada sakht hoti hai.",
  ],
  "ingest.basketTolerancePct": [
    "साउंडबॉक्स टोकरी की छूट",
    "Soundbox basket ki chhoot",
    "आइटम के दाम का जोड़ रक़म के इतने भीतर हो तो पेमेंट सुनी हुई टोकरी से मिलता है।",
    "Item ke daam ka jod raqam ke itne bheetar ho to payment suni hui basket se milta hai.",
  ],
  "ingest.basketHoldMinutes": [
    "टोकरी पेमेंट के लिए रुके",
    "Basket payment ke liye ruke",
    "सुनी हुई टोकरी अपने पेमेंट का कितनी देर इंतज़ार करती है।",
    "Suni hui basket apne payment ka kitni der intezaar karti hai.",
  ],
  "ingest.paymentMatchWindowMin": [
    "पेमेंट स्क्रीनशॉट का समय-दायरा",
    "Payment screenshot ka samay-daayra",
    "बताए समय से Paytm लेन-देन कितना दूर हो सकता है और फिर भी मिलान गिना जाए।",
    "Bataye samay se Paytm len-den kitna door ho sakta hai aur phir bhi milaan gina jaaye.",
  ],
  "alerts.khataRed": [
    "लाल खाता ग्राहक",
    "Red khata customers",
    "लाल श्रेणी के खाता ग्राहकों के बारे में अपने-आप संदेश।",
    "Red category ke khata customers ke baare mein apne-aap messages.",
  ],
  "alerts.sendFromHour": [
    "संदेश इस समय से भेजें",
    "Messages is samay se bhejo",
    "इस घंटे से पहले अपने-आप संदेश नहीं जाते, भारतीय समय। नीचे के घंटे से पहले का होना चाहिए।",
    "Is ghante se pehle apne-aap messages nahi jaate, Indian time. Neeche ke ghante se pehle ka hona chahiye.",
  ],
  "alerts.sendUntilHour": [
    "संदेश इस समय तक भेजें",
    "Messages is samay tak bhejo",
    "इस घंटे से आगे अपने-आप संदेश नहीं जाते, भारतीय समय।",
    "Is ghante se aage apne-aap messages nahi jaate, Indian time.",
  ],
  "alerts.cooldownDays": [
    "अलर्ट दोहराने से पहले रुकें",
    "Alert dohraane se pehle ruko",
    "एक ही तरह के दो अलर्ट के बीच कम से कम इतने दिन।",
    "Ek hi tarah ke do alerts ke beech kam se kam itne din.",
  ],
  "calls.enabled": [
    "रिमाइंडर कॉल",
    "Reminder calls",
    "कॉल साथी उन ग्राहकों को फ़ोन करता है जिनका उधार लेट है। इसे कॉल साथी पेज पर संभालें।",
    "Call Saathi un customers ko phone karta hai jinka udhaar late hai. Ise Call Saathi page par sambhalo.",
  ],
  "calls.minOverdueDays": [
    "इतने दिन लेट होने पर कॉल",
    "Itne din late hone par call",
    "सबसे पुराना बाक़ी उधार इतना पुराना हो जाए तब कॉल शुरू हो।",
    "Sabse purana baaki udhaar itna purana ho jaaye tab call shuru ho.",
  ],
  "calls.minOutstandingPaise": [
    "कॉल के लिए सबसे कम बाक़ी",
    "Call ke liye sabse kam baaki",
    "इससे कम बाक़ी वाले ग्राहकों को कॉल नहीं जाती।",
    "Isse kam baaki wale customers ko call nahi jaati.",
  ],
  "calls.maxAttempts": [
    "हर ग्राहक को ज़्यादा से ज़्यादा कॉल",
    "Har customer ko zyada se zyada call",
    "इतनी कॉल के बाद रुक जाएँ।",
    "Itni call ke baad ruk jaao.",
  ],
  "calls.retryGapDays": [
    "इतने दिन बाद फिर कॉल",
    "Itne din baad phir call",
    "1 = रोज़, 2 = एक दिन छोड़कर, 7 = हफ़्ते में एक बार।",
    "1 = roz, 2 = ek din chhodkar, 7 = hafte mein ek baar.",
  ],
  "calls.fromHour": [
    "कॉल इस समय से",
    "Call is samay se",
    "इस घंटे से पहले कोई कॉल नहीं, भारतीय समय।",
    "Is ghante se pehle koi call nahi, Indian time.",
  ],
  "calls.untilHour": [
    "कॉल इस समय तक",
    "Call is samay tak",
    "इस घंटे से आगे कोई कॉल नहीं, भारतीय समय।",
    "Is ghante se aage koi call nahi, Indian time.",
  ],
  "calls.maxCallsPerRun": [
    "हर बार में ज़्यादा से ज़्यादा कॉल",
    "Har baar mein zyada se zyada call",
    "कॉल साथी के हर बार चलने पर यह सीमा रहती है।",
    "Call Saathi ke har baar chalne par yeh limit rehti hai.",
  ],
  festivals: [
    "आपके त्योहार",
    "Aapke tyohaar",
    "बने-बनाए कैलेंडर में जुड़ते हैं। हर त्योहार आपकी बताई आइटम श्रेणियों को बढ़ाता है।",
    "Bane-banaye calendar mein jud te hain. Har tyohaar aapki batayi item categories ko badhata hai.",
  ],
  language: [
    "भाषा",
    "Bhasha",
    "व्यवहार जिस भाषा में संदेश और जवाब लिखता है।",
    "Vyavahāra jis bhasha mein message aur jawab likhta hai.",
  ],
};

const CLUSTER: Record<string, [string, string]> = {
  "Risk score weights": ["जोखिम स्कोर के वज़न", "Risk score ke weights"],
  "When a part counts fully": [
    "कब कोई हिस्सा पूरा गिना जाए",
    "Kab koi hissa poora gina jaaye",
  ],
  "Score bands": ["स्कोर की श्रेणियाँ", "Score ki bands"],
  "Expected recovery": ["अपेक्षित वसूली", "Expected recovery"],
  "Credit limits": ["उधार की सीमाएँ", "Udhaar ki limits"],
};

const UNIT: Record<string, [string, string]> = {
  "z-score": ["z-स्कोर", "z-score"],
  calls: ["कॉल", "call"],
  days: ["दिन", "din"],
  weight: ["वज़न", "weight"],
  points: ["अंक", "points"],
  times: ["गुना", "guna"],
  "visit days": ["विज़िट के दिन", "visit ke din"],
  items: ["आइटम", "items"],
  score: ["स्कोर", "score"],
  minutes: ["मिनट", "minute"],
};

const G: Record<string, [string, string, string, string]> = {
  inventory: [
    "स्टॉक",
    "Stock",
    "कितना स्टॉक रखना है, और कब स्टॉक ज़्यादा या मरा हुआ माना जाए।",
    "Kitna stock rakhna hai, aur kab stock zyada ya dead mana jaaye.",
  ],
  khata: [
    "खाता",
    "Khata",
    "ग्राहक का जोखिम स्कोर कैसे बनता है, और उससे जुड़ी सीमाएँ।",
    "Customer ka risk score kaise banta hai, aur usse judi limits.",
  ],
  cash: ["नकद", "Cash", "कैश के अनुमान की शुरुआत।", "Cash ke anumaan ki shuruaat."],
  anomalies: [
    "असामान्य बिक्री",
    "Asaamanya bikri",
    "कब कोई दिन, रिफंड या आइटम असामान्य माना जाए।",
    "Kab koi din, refund ya item asaamanya mana jaaye.",
  ],
  customers: [
    "ग्राहक",
    "Customers",
    "कौन ग्राहक नियमित, नया या आना बंद माना जाए।",
    "Kaun customer regular, naya ya aana band mana jaaye.",
  ],
  gst: [
    "GST",
    "GST",
    "कंपोज़िशन स्कीम के लिए इस्तेमाल होने वाली दर।",
    "Composition scheme ke liye use hone wali rate.",
  ],
  loan: [
    "लोन",
    "Loan",
    "संकेतात्मक लोन सीमा के पीछे की जाँचें।",
    "Indicative loan limit ke peeche ki jaanchein.",
  ],
  recommendations: [
    "सुझाव",
    "Suggestions",
    "वे सीमाएँ जो तय करती हैं कि व्यवहार क्या सुझाए।",
    "Woh limits jo tay karti hain ki Vyavahāra kya suggest kare.",
  ],
  ingest: [
    "बिल और पेमेंट",
    "Bills aur payments",
    "बिल, साउंडबॉक्स की टोकरी और पेमेंट स्क्रीनशॉट कितनी सख़्ती से मिलाए जाएँ।",
    "Bills, soundbox ki basket aur payment screenshots kitni sakhti se milaye jaayein.",
  ],
  alerts: [
    "अलर्ट",
    "Alerts",
    "कौन से अपने-आप संदेश जाएँ, और कब।",
    "Kaun se apne-aap messages jaayein, aur kab.",
  ],
  calls: [
    "कॉल साथी",
    "Call Saathi",
    "बाक़ी रहने वाले उधार के लिए अपने-आप रिमाइंडर कॉल।",
    "Baaki rehne wale udhaar ke liye apne-aap reminder calls.",
  ],
  festivals: [
    "त्योहार",
    "Tyohaar",
    "वे त्योहार जो आपके लिए मायने रखते हैं, बने कैलेंडर में जुड़े।",
    "Woh tyohaar jo aapke liye maayne rakhte hain, bane calendar mein jude.",
  ],
  language: [
    "भाषा",
    "Bhasha",
    "व्यवहार जिस भाषा में लिखता है।",
    "Vyavahāra jis bhasha mein likhta hai.",
  ],
};

export const fieldLabel = (f: FieldDef, l: L) =>
  F[f.path] ? l(f.label, F[f.path][0], F[f.path][1]) : f.label;
export const fieldDesc = (f: FieldDef, l: L) =>
  F[f.path] ? l(f.description, F[f.path][2], F[f.path][3]) : f.description;
export const clusterText = (c: string, l: L) =>
  CLUSTER[c] ? l(c, CLUSTER[c][0], CLUSTER[c][1]) : c;
export const unitText = (u: string | undefined, l: L) =>
  u && UNIT[u] ? l(u, UNIT[u][0], UNIT[u][1]) : u;
export const groupTitle = (g: GroupDef, l: L) =>
  G[g.id] ? l(g.title, G[g.id][0], G[g.id][1]) : g.title;
export const groupDesc = (g: GroupDef, l: L) =>
  G[g.id] ? l(g.description, G[g.id][2], G[g.id][3]) : g.description;

type R = [RegExp, string, string];
/** English sentence → [Hindi, Hinglish]; `$1`… refer to captured numbers. Used for the screen's own chrome, hints and validation messages. */
const RULES: R[] = [
  [/^Changed$/, "बदला हुआ", "Badla hua"],
  [/^Not saved$/, "सेव नहीं हुआ", "Save nahi hua"],
  [/^Reset to default$/, "डिफ़ॉल्ट पर लौटाएँ", "Default par lautao"],
  [
    /^Fix the marked entries before saving\.$/,
    "सेव करने से पहले निशान वाली एंट्री ठीक करें।",
    "Save karne se pehle nishaan wali entries theek karo.",
  ],
  [/^Use my own list$/, "मेरी अपनी सूची इस्तेमाल करें", "Meri apni list use karo"],
  [
    /^Vyavahāra reads rent, salary and electricity from your expenses\.$/,
    "व्यवहार किराया, तनख़्वाह और बिजली आपके ख़र्चे के रिकॉर्ड से पढ़ता है।",
    "Vyavahāra kiraya, tankhwah aur bijli aapke kharche ke record se padhta hai.",
  ],
  [
    /^Only the costs below are used\.$/,
    "सिर्फ़ नीचे के ख़र्चे इस्तेमाल होते हैं।",
    "Sirf neeche ke kharche use hote hain.",
  ],
  [
    /^No costs yet\. Add rent, salary or electricity, with the day of the month it falls due\.$/,
    "अभी कोई ख़र्चा नहीं। किराया, तनख़्वाह या बिजली जोड़ें, साथ में महीने का वह दिन जब देना होता है।",
    "Abhi koi kharcha nahi. Kiraya, tankhwah ya bijli jodo, saath mein mahine ka woh din jab dena hota hai.",
  ],
  [/^Name$/, "नाम", "Naam"],
  [/^Amount each month$/, "हर महीने की रक़म", "Har mahine ki raqam"],
  [/^Day of month$/, "महीने का दिन", "Mahine ka din"],
  [/^Date$/, "तारीख़", "Tarikh"],
  [/^Item categories$/, "आइटम की श्रेणियाँ", "Item categories"],
  [/^Remove$/, "हटाएँ", "Hatao"],
  [/^Add a cost$/, "ख़र्चा जोड़ें", "Kharcha jodo"],
  [/^Add a festival$/, "त्योहार जोड़ें", "Tyohaar jodo"],
  [/^Remove cost (\d+)$/, "ख़र्चा $1 हटाएँ", "Kharcha $1 hatao"],
  [/^Remove festival (\d+)$/, "त्योहार $1 हटाएँ", "Tyohaar $1 hatao"],
  [/^Send alerts$/, "अलर्ट भेजें", "Alerts bhejo"],
  [
    /^Proactive messages about khata customers in the red band\.$/,
    "लाल श्रेणी के खाता ग्राहकों के बारे में अपने-आप संदेश।",
    "Red band ke khata customers ke baare mein apne-aap messages.",
  ],
  [/^Enter a number\.$/, "संख्या लिखें।", "Number likho."],
  [/^Use a whole number\.$/, "पूरी संख्या लिखें।", "Poora number likho."],
  [
    /^Lowest allowed is (.+)\.$/,
    "सबसे कम मान्य $1 है।",
    "Sabse kam allowed $1 hai.",
  ],
  [
    /^Highest allowed is (.+)\.$/,
    "सबसे ज़्यादा मान्य $1 है।",
    "Sabse zyada allowed $1 hai.",
  ],
  [/^Enter a name\.$/, "नाम लिखें।", "Naam likho."],
  [
    /^Keep it to (\d+) characters or fewer\.$/,
    "$1 अक्षर या उससे कम रखें।",
    "$1 characters ya usse kam rakho.",
  ],
  [
    /^Pick one of the options\.$/,
    "विकल्पों में से एक चुनें।",
    "Options mein se ek chuno.",
  ],
  [/^Name this cost\.$/, "इस ख़र्चे का नाम लिखें।", "Is kharche ka naam likho."],
  [/^Enter an amount\.$/, "रक़म लिखें।", "Raqam likho."],
  [
    /^Cannot be below ₹0\.$/,
    "₹0 से कम नहीं हो सकता।",
    "₹0 se kam nahi ho sakta.",
  ],
  [/^Enter a day\.$/, "दिन लिखें।", "Din likho."],
  [
    /^Pick a day from (\d+) to (\d+)\.$/,
    "$1 से $2 के बीच का दिन चुनें।",
    "$1 se $2 ke beech ka din chuno.",
  ],
  [
    /^Name this festival\.$/,
    "इस त्योहार का नाम लिखें।",
    "Is tyohaar ka naam likho.",
  ],
  [/^Pick a date\.$/, "तारीख़ चुनें।", "Tarikh chuno."],
  [
    /^List the item categories\.$/,
    "आइटम की श्रेणियाँ लिखें।",
    "Item categories likho.",
  ],
  [
    /^List at most (\d+) categories\.$/,
    "ज़्यादा से ज़्यादा $1 श्रेणियाँ लिखें।",
    "Zyada se zyada $1 categories likho.",
  ],
  [
    /^Must be above the green limit( \((.+)\))?\.$/,
    "हरे की सीमा से ऊपर होना चाहिए $1।",
    "Green ki limit se upar hona chahiye $1.",
  ],
  [
    /^Must be later than the start hour\.$/,
    "शुरू के घंटे से बाद का होना चाहिए।",
    "Shuru ke ghante se baad ka hona chahiye.",
  ],
  [/^Not accepted\.$/, "मंज़ूर नहीं हुआ।", "Manzoor nahi hua."],
  [/^Changes discarded\.$/, "बदलाव हटा दिए गए।", "Badlav hata diye gaye."],
  [
    /^Fix (\d+) fields? before saving\.$/,
    "सेव करने से पहले $1 फ़ील्ड ठीक करें।",
    "Save karne se pehle $1 field theek karo.",
  ],
  [/^Settings saved$/, "सेटिंग सेव हो गई", "Settings save ho gayi"],
  [/^(\d+) settings? saved\.$/, "$1 सेटिंग सेव हुई।", "$1 setting save hui."],
  [/^Back to defaults$/, "डिफ़ॉल्ट पर लौटा", "Default par laut aaya"],
  [
    /^Every setting is at its factory value\.$/,
    "हर सेटिंग अपनी मूल क़ीमत पर है।",
    "Har setting apni original value par hai.",
  ],
  [
    /^Every setting is back to its default\.$/,
    "हर सेटिंग डिफ़ॉल्ट पर लौट आई।",
    "Har setting default par laut aayi.",
  ],
  [/^Could not reset$/, "रीसेट नहीं हो पाया", "Reset nahi ho paya"],
  [
    /^All (\d+) settings are at their defaults\. Change any of them to fit your shop\.$/,
    "सभी $1 सेटिंग डिफ़ॉल्ट पर हैं। अपनी दुकान के हिसाब से कोई भी बदलें।",
    "Saari $1 settings default par hain. Apni dukaan ke hisaab se koi bhi badlo.",
  ],
  [
    /^(\d+) of (\d+) settings differ from the defaults\. Every threshold Vyavahāra uses is yours to change\.$/,
    "$2 में से $1 सेटिंग डिफ़ॉल्ट से अलग हैं। व्यवहार की हर सीमा आप बदल सकते हैं।",
    "$2 mein se $1 settings default se alag hain. Vyavahāra ki har limit aap badal sakte ho.",
  ],
  [/^Reset all to defaults$/, "सब डिफ़ॉल्ट पर लौटाएँ", "Sab default par lautao"],
  [
    /^Reset every setting to its default\?$/,
    "हर सेटिंग डिफ़ॉल्ट पर लौटाएँ?",
    "Har setting default par lautaayein?",
  ],
  [
    /^All saved settings go back to their factory values, and the edits you have not saved are dropped\. This cannot be undone\.$/,
    "सारी सेव सेटिंग अपनी मूल क़ीमत पर लौट जाएँगी और जो बदलाव सेव नहीं हैं वे हट जाएँगे। इसे वापस नहीं किया जा सकता।",
    "Saari saved settings apni original value par laut jaayengi aur jo badlav save nahi hain woh hat jaayenge. Ise wapas nahi kiya ja sakta.",
  ],
  [
    /^All saved settings go back to their factory values\. This cannot be undone\.$/,
    "सारी सेव सेटिंग अपनी मूल क़ीमत पर लौट जाएँगी। इसे वापस नहीं किया जा सकता।",
    "Saari saved settings apni original value par laut jaayengi. Ise wapas nahi kiya ja sakta.",
  ],
  [/^Reset all$/, "सब रीसेट करें", "Sab reset karo"],
  [/^Keep my settings$/, "मेरी सेटिंग रखें", "Meri settings rakho"],
  [/^Leave without saving\?$/, "बिना सेव किए छोड़ें?", "Bina save kiye chhodein?"],
  [
    /^You have (\d+) unsaved changes? on this page\. They are lost if you leave\.$/,
    "इस पेज पर $1 बिना सेव बदलाव हैं। छोड़ने पर वे खो जाएँगे।",
    "Is page par $1 bina save badlav hain. Chhodne par woh kho jaayenge.",
  ],
  [/^Keep editing$/, "बदलते रहें", "Badalte raho"],
  [/^Leave$/, "छोड़ें", "Chhodo"],
  [
    /^Advanced settings, for experts$/,
    "उन्नत सेटिंग, जानकारों के लिए",
    "Advanced settings, jaankaron ke liye",
  ],
  [/^(\d+) sections$/, "$1 भाग", "$1 sections"],
  [/^Advanced$/, "उन्नत", "Advanced"],
  [
    /^The defaults suit most shops\. Change these only if you know why\.$/,
    "डिफ़ॉल्ट ज़्यादातर दुकानों के लिए ठीक हैं। इन्हें तभी बदलें जब वजह पता हो।",
    "Defaults zyadatar dukaano ke liye theek hain. Inhe tabhi badlo jab wajah pata ho.",
  ],
  [/^Settings sections$/, "सेटिंग के भाग", "Settings ke hisse"],
  [/^Unsaved changes$/, "बिना सेव बदलाव", "Bina save badlav"],
  [/^Discard$/, "हटाएँ", "Hatao"],
  [/^Save changes$/, "बदलाव सेव करें", "Badlav save karo"],
  [
    /^The server rejected the change$/,
    "सर्वर ने बदलाव नहीं माना",
    "Server ne badlav nahi maana",
  ],
  [/^Unmapped settings?$/, "बिना जुड़ी सेटिंग", "Unmapped settings"],
  [/^Unmapped$/, "बिना जुड़ी", "Unmapped"],
  [
    /^Loading your thresholds\.$/,
    "आपकी सीमाएँ लोड हो रही हैं।",
    "Aapki limits load ho rahi hain.",
  ],
  [
    /^Could not load your settings$/,
    "आपकी सेटिंग नहीं खुल पाई",
    "Aapki settings nahi khul payi",
  ],
  [
    /^Weights add up to (\S+)\. Only their proportions matter\.$/,
    "वज़न का जोड़ $1 है। सिर्फ़ उनका अनुपात मायने रखता है।",
    "Weights ka jod $1 hai. Sirf unka anupaat maayne rakhta hai.",
  ],

  [/^12:00 am \(midnight\)$/, "रात 12:00 (आधी रात)", "Raat 12:00 (aadhi raat)"],
  [
    /^None added\. The built-in festival calendar still applies\.$/,
    "कुछ जोड़ा नहीं। बना-बनाया त्योहार कैलेंडर फिर भी लागू रहता है।",
    "Kuch joda nahi. Bana-banaya tyohaar calendar phir bhi lagu rehta hai.",
  ],
  [/^No costs listed$/, "कोई ख़र्चा नहीं", "Koi kharcha nahi"],
  [
    /^Learned from expense history$/,
    "ख़र्चे के रिकॉर्ड से सीखा",
    "Kharche ke record se seekha",
  ],
  [/^None added$/, "कुछ जोड़ा नहीं", "Kuch joda nahi"],
  [/^(\d+) costs?$/, "$1 ख़र्चे", "$1 kharche"],
  [/^(\d+) festivals?$/, "$1 त्योहार", "$1 tyohaar"],
  [
    /^The server did not accept (\d+) values?\. See the marked fields\.$/,
    "सर्वर ने $1 मान नहीं माने। निशान वाले फ़ील्ड देखें।",
    "Server ne $1 value nahi maani. Nishaan wale fields dekho.",
  ],
  [/^Not saved\. (.*)$/, "सेव नहीं हुआ। $1", "Save nahi hua. $1"],
];

const UNITS: [RegExp, string, string][] = [
  [/ days\b/g, " दिन", " din"],
  [/ weight\b/g, " वज़न", " weight"],
  [/ points\b/g, " अंक", " points"],
  [/ times\b/g, " गुना", " guna"],
  [/ visit days\b/g, " विज़िट के दिन", " visit ke din"],
  [/ items\b/g, " आइटम", " items"],
  [/ minutes\b/g, " मिनट", " minute"],
];

/** Translate one of the Settings screen's own English strings. Anything not recognised is returned unchanged. */
export function tt(text: string, l: L): string {
  if (!text) return text;
  const hi = l("A", "B", "C") === "B";
  const hing = l("A", "B", "C") === "C";
  if (!hi && !hing) return text;
  for (const [re, h, g] of RULES)
    if (re.test(text)) return text.replace(re, hi ? h : g);
  // "Default 7 days. Allowed 1 to 14."  /  "Up to 40 characters."
  let out = text;
  out = out
    .replace(/^Default (?!:)/, hi ? "डिफ़ॉल्ट " : "Default ")
    .replace(
      /Allowed (\S+) to (\S+)\./,
      hi ? "$1 से $2 तक मान्य।" : "$1 se $2 tak allowed.",
    )
    .replace(
      /Up to (\d+) characters\./,
      hi ? "अधिकतम $1 अक्षर।" : "Max $1 characters.",
    );
  for (const [re, h, g] of UNITS) out = out.replace(re, hi ? h : g);
  return out;
}
