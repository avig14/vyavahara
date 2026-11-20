import { getDb } from "@/lib/db/client";
import { getAttempt, getCustomerName, getMerchantName } from "@/lib/calls/store";
import { answerXml } from "@/lib/calls/script";
import { hangup, speak, xml, xmlResponse } from "@/lib/calls/vobiz";
import { publicBase, webhookAuthorized } from "@/lib/calls/webhook";

export const runtime = "nodejs";
export const maxDuration = 10;

/** Vobiz fetches this when the customer picks up. Must answer with VobizXML within 10 s. */
async function handle(req: Request) {
  if (!webhookAuthorized(req)) return new Response("unauthorized", { status: 401 });
  const url = new URL(req.url);
  const id = url.searchParams.get("attempt") ?? "";
  const db = getDb();
  const a = id ? await getAttempt(db, id) : null;
  if (!a) return xmlResponse(xml(hangup()));
  const [customerName, shopName] = await Promise.all([getCustomerName(db, a.customerId), getMerchantName(db, a.merchantId)]);
  if (!customerName || !shopName) return xmlResponse(xml(speak("Maaf kijiye, galat number.") + hangup()));
  const gatherUrl = `${publicBase()}/api/vobiz/gather?${url.searchParams.toString()}`;
  return xmlResponse(answerXml({ customerName, shopName, amountPaise: a.amountPaise, overdueDays: a.overdueDays }, gatherUrl, process.env.VOBIZ_SPEAK_LANG));
}

export { handle as POST, handle as GET };
