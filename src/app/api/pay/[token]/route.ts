import QRCode from "qrcode";
import { getCtx, handle, HttpError, json } from "@/lib/server/http";
import { addKhataEntry, getArtifact, loadSettings, setArtifactParams } from "@/lib/db/queries";
import { schema } from "@/lib/db/client";
import { eq } from "drizzle-orm";
import { upiUri, type PayLinkParams } from "@/lib/pay";

export const runtime = "nodejs";
export const maxDuration = 30;

type Ctx = { params: Promise<{ token: string }> };

/** Public pay page data: shop, amount, UPI deep link and a QR (SVG data URL). Token is the secret. */
export const GET = (_req: Request, { params }: Ctx) =>
  handle(async () => {
    const { token } = await params;
    const c = await getCtx();
    const art = await getArtifact(c.db, token, "pay_link", c.now);
    if (!art) throw new HttpError(404, "Link not found or expired");
    const p = art.params as PayLinkParams;
    const [m] = await c.db.select().from(schema.merchants).where(eq(schema.merchants.id, art.merchantId));
    const vpa = m?.upiId ?? process.env.MERCHANT_UPI_ID;
    if (!m || !vpa) throw new HttpError(503, "Shop UPI id is not set");
    const uri = upiUri({ vpa, name: m.name, amountPaise: p.amountPaise, note: "Khata payment" });
    const qr = await QRCode.toDataURL(uri, { margin: 1, width: 320 });
    return json({ shop: m.name, customer: p.customerName, amountPaise: p.amountPaise, paid: Boolean(p.paidAt), upiUri: uri, qr });
  });

/** Demo "Mark paid": records a khata payment once. A real flow would wait for the UPI callback instead. */
export const POST = (_req: Request, { params }: Ctx) =>
  handle(async () => {
    const { token } = await params;
    const c = await getCtx();
    const art = await getArtifact(c.db, token, "pay_link", c.now);
    if (!art) throw new HttpError(404, "Link not found or expired");
    const p = art.params as PayLinkParams;
    if (p.paidAt) throw new HttpError(409, "Already marked paid");
    await loadSettings(c.db, art.merchantId); // 404-style guard: merchant must still exist
    await setArtifactParams(c.db, art.id, { ...p, paidAt: c.now.toISOString() });
    await addKhataEntry(c.db, { merchantId: art.merchantId, customerId: p.customerId, type: "payment", amountPaise: p.amountPaise, note: "Pay link (demo)", source: "pay_link", actor: "system" });
    return json({ ok: true });
  });
