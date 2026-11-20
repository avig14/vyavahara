import { getDb } from "@/lib/db/client";
import { getAttempt, getCustomerName, getMerchantName, updateAttempt } from "@/lib/calls/store";
import { outcomeFor, replyXml } from "@/lib/calls/script";
import { hangup, xml, xmlResponse } from "@/lib/calls/vobiz";
import { readParams, webhookAuthorized } from "@/lib/calls/webhook";

export const runtime = "nodejs";
export const maxDuration = 10;

/** The customer pressed a key (1 = will pay, 2 = shop should call back, anything else = no response). */
export async function POST(req: Request) {
  if (!webhookAuthorized(req)) return new Response("unauthorized", { status: 401 });
  const id = new URL(req.url).searchParams.get("attempt") ?? "";
  const params = await readParams(req);
  const db = getDb();
  const a = id ? await getAttempt(db, id) : null;
  if (!a) return xmlResponse(xml(hangup()));
  const outcome = outcomeFor(params.Digits ?? params.digits);
  await updateAttempt(db, id, { outcome });
  const [customerName, shopName] = await Promise.all([getCustomerName(db, a.customerId), getMerchantName(db, a.merchantId)]);
  return xmlResponse(replyXml(outcome, { customerName: customerName ?? "", shopName: shopName ?? "dukaan", amountPaise: a.amountPaise, overdueDays: a.overdueDays }, process.env.VOBIZ_SPEAK_LANG));
}
