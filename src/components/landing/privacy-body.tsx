"use client";

import { Table } from "@/components/ui";
import { useL } from "@/lib/ui/lang";

/** Every row is something the code does: see src/lib/db/schema.ts, src/lib/hash.ts, src/lib/ingest, src/lib/agent. */
export function PrivacyBody() {
  const l = useL();
  const rows = [
    [
      l("Shop profile", "दुकान की जानकारी", "Dukaan ki jaankari"),
      l("Neon database", "Neon डेटाबेस", "Neon database"),
      l(
        "Shows your shop",
        "आपकी दुकान दिखाने के लिए",
        "Aapki dukaan dikhane ke liye",
      ),
    ],
    [
      l(
        "Payments, customers, credit",
        "पेमेंट, ग्राहक, उधार",
        "Payments, customers, udhaar",
      ),
      l("Neon database", "Neon डेटाबेस", "Neon database"),
      l(
        "Rozmel, khata, reports",
        "रोज़मेल, खाता, रिपोर्ट",
        "Rozmel, khata, reports",
      ),
    ],
    [
      l("Payer UPI ids", "भुगतान करने वालों की UPI id", "Payer UPI ids"),
      l(
        "Neon, as a one-way hash",
        "Neon में, एक तरफ़ा हैश बनाकर",
        "Neon mein, one-way hash banakar",
      ),
      l(
        "Spot repeat payers",
        "बार-बार आने वालों को पहचानने के लिए",
        "Baar-baar aane walon ko pehchanne ke liye",
      ),
    ],
    [
      l(
        "Stock, suppliers, bills",
        "स्टॉक, सप्लायर, बिल",
        "Stock, suppliers, bills",
      ),
      l("Neon database", "Neon डेटाबेस", "Neon database"),
      l("Alerts and orders", "अलर्ट और ऑर्डर के लिए", "Alerts aur orders ke liye"),
    ],
    [
      l("Soundbox text", "साउंडबॉक्स का टेक्स्ट", "Soundbox ka text"),
      l("Neon and Anthropic", "Neon और Anthropic", "Neon aur Anthropic"),
      l(
        "Match a basket",
        "टोकरी का सामान मिलाने के लिए",
        "Basket ka saaman milane ke liye",
      ),
    ],
    [
      l(
        "Voice clips, announcements",
        "आवाज़ की क्लिप, घोषणाएँ",
        "Voice clips, announcements",
      ),
      l(
        "Sarvam; clips not kept by us",
        "Sarvam; क्लिप हम नहीं रखते",
        "Sarvam; clips hum nahi rakhte",
      ),
      l("Speech and text", "बोली और टेक्स्ट के लिए", "Speech aur text ke liye"),
    ],
    [
      l("Saathi chat", "साथी की बातचीत", "Saathi chat"),
      l("Neon and Anthropic", "Neon और Anthropic", "Neon aur Anthropic"),
      l(
        "Answer questions",
        "सवालों के जवाब देने के लिए",
        "Sawaalon ke jawab dene ke liye",
      ),
    ],
    [
      l(
        "Pay links, audit log",
        "पेमेंट लिंक, बदलाव का रिकॉर्ड",
        "Pay links, audit log",
      ),
      l("Neon database", "Neon डेटाबेस", "Neon database"),
      l(
        "Sharing, change record",
        "लिंक भेजने और बदलाव याद रखने के लिए",
        "Sharing, change record",
      ),
    ],
  ];
  return (
    <>
      <section className="pv-first" aria-labelledby="pv-title">
        <h1 id="pv-title" className="pv-h1">
          {l(
            "What we store and who sees it",
            "हम क्या रखते हैं और कौन देखता है",
            "Hum kya rakhte hain aur kaun dekhta hai",
          )}
        </h1>
        <p className="lead">
          {l(
            "Written from what this build's code does.",
            "इस वर्शन का कोड जो करता है, उसी से लिखा गया।",
            "Is build ka code jo karta hai, usi se likha gaya.",
          )}
        </p>
        <Table
          caption={l(
            "Kinds of data, where each goes, and why",
            "किस तरह का डेटा, कहाँ जाता है और क्यों",
            "Kis tarah ka data, kahaan jaata hai aur kyun",
          )}
        >
          <thead>
            <tr>
              <th scope="col">{l("Data", "डेटा", "Data")}</th>
              <th scope="col">
                {l("Where it goes", "कहाँ जाता है", "Kahaan jaata hai")}
              </th>
              <th scope="col">{l("Why", "क्यों", "Kyun")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r[0]}>
                <td data-label={l("Data", "डेटा", "Data")} data-primary="">
                  {r[0]}
                </td>
                <td
                  data-label={l(
                    "Where it goes",
                    "कहाँ जाता है",
                    "Kahaan jaata hai",
                  )}
                >
                  {r[1]}
                </td>
                <td data-label={l("Why", "क्यों", "Kyun")}>{r[2]}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </section>

      <section className="pv-sec" aria-labelledby="pv-svc">
        <h2 id="pv-svc">
          {l(
            "Two outside services see part of this data.",
            "दो बाहरी सेवाएँ इस डेटा का कुछ हिस्सा देखती हैं।",
            "Do bahari services is data ka kuch hissa dekhti hain.",
          )}
        </h2>
        <div className="pv-body">
          <p>
            {l(
              "Sarvam handles speech. Claude from Anthropic reads soundbox text and answers Saathi. Each service sets its own retention.",
              "Sarvam आवाज़ संभालता है। Anthropic का Claude साउंडबॉक्स का टेक्स्ट पढ़ता है और साथी के जवाब देता है। डेटा कितने समय रखना है, यह हर सेवा ख़ुद तय करती है।",
              "Sarvam awaaz sambhalta hai. Anthropic ka Claude soundbox ka text padhta hai aur Saathi ke jawab deta hai. Data kitne samay rakhna hai, yeh har service khud tay karti hai.",
            )}
          </p>
        </div>
      </section>

      <section className="pv-sec" aria-labelledby="pv-long">
        <h2 id="pv-long">
          {l(
            "Nothing here deletes data on a schedule.",
            "यहाँ कुछ भी समय के हिसाब से अपने आप नहीं मिटता।",
            "Yahan kuch bhi samay ke hisaab se apne aap nahi mitta.",
          )}
        </h2>
        <div className="pv-body">
          <p>
            {l(
              "Rows stay in Neon until removed. Pay and report links stop working after 7 days.",
              "रिकॉर्ड हटाए जाने तक Neon में रहते हैं। पेमेंट और रिपोर्ट के लिंक 7 दिन बाद काम करना बंद कर देते हैं।",
              "Records hataye jaane tak Neon mein rehte hain. Pay aur report links 7 din baad kaam karna band kar dete hain.",
            )}
          </p>
        </div>
      </section>

      <section className="pv-sec" aria-labelledby="pv-not">
        <h2 id="pv-not">
          {l(
            "We do not collect plain UPI ids or audio.",
            "हम साफ़ UPI id या आवाज़ इकट्ठा नहीं करते।",
            "Hum saaf UPI id ya awaaz ikattha nahi karte.",
          )}
        </h2>
        <div className="pv-body">
          <p>
            {l(
              "A supplier bill photo is read once to fill in your stock, then dropped. We keep only the items and amounts you accept, never the photo. Also not collected: passwords and ad trackers. Your browser keeps only the shop and owner name until the tab closes.",
              "सप्लायर के बिल की फ़ोटो एक बार पढ़कर आपका स्टॉक भरने के लिए इस्तेमाल होती है, फिर हटा दी जाती है। हम सिर्फ़ वही आइटम और रक़म रखते हैं जो आप मंज़ूर करते हैं, फ़ोटो कभी नहीं। पासवर्ड और विज्ञापन ट्रैकर भी इकट्ठा नहीं किए जाते। आपका ब्राउज़र सिर्फ़ दुकान और मालिक का नाम टैब बंद होने तक रखता है।",
              "Supplier ke bill ki photo ek baar padhkar aapka stock bharne ke liye use hoti hai, phir hata di jaati hai. Hum sirf wahi items aur raqam rakhte hain jo aap manzoor karte hain, photo kabhi nahi. Password aur ad trackers bhi ikattha nahi kiye jaate. Aapka browser sirf dukaan aur malik ka naam tab band hone tak rakhta hai.",
            )}
          </p>
        </div>
      </section>

      <section className="pv-sec" aria-labelledby="pv-demo">
        <h2 id="pv-demo">
          {l(
            "This demo has no sign-in, so the sample shop is open.",
            "इस डेमो में साइन-इन नहीं है, इसलिए नमूना दुकान सबके लिए खुली है।",
            "Is demo mein sign-in nahi hai, isliye sample dukaan sabke liye khuli hai.",
          )}
        </h2>
        <div className="pv-body">
          <p>
            {l(
              "Anyone who opens this app sees it. The soundbox keeps text only for clips about shop business. Personal talk is dropped at once and never saved.",
              "जो भी यह ऐप खोलता है, उसे यह दिखती है। साउंडबॉक्स सिर्फ़ दुकान के काम की क्लिप का टेक्स्ट रखता है। निजी बातें तुरंत हटा दी जाती हैं और कभी सेव नहीं होतीं।",
              "Jo bhi yeh app kholta hai, use yeh dikhti hai. Soundbox sirf dukaan ke kaam ki clips ka text rakhta hai. Niji baatein turant hata di jaati hain aur kabhi save nahi hoti.",
            )}
          </p>
        </div>
      </section>
    </>
  );
}
