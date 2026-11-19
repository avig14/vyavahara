import { getCtx, handle, json } from "@/lib/server/http";
import { getWaState, listWaMessages } from "@/lib/db/queries";
import { maskPhone, waConfig } from "@/lib/wa/cloud";
import { windowOpenUntil } from "@/lib/wa/send";

export const runtime = "nodejs";

/** Everything the WhatsApp card needs: is it set up, which number, is the 24h window open, and the last sends with their status. */
export const GET = () =>
  handle(async () => {
    const c = await getCtx();
    const [st, rows] = await Promise.all([getWaState(c.db, c.merchantId), listWaMessages(c.db, c.merchantId, 6)]);
    return json({
      configured: waConfig() !== null,
      webhookReady: Boolean(process.env.WHATSAPP_VERIFY_TOKEN),
      number: st.phone ? maskPhone(st.phone) : null,
      windowOpenUntil: windowOpenUntil(st.lastInboundAt, c.now)?.toISOString() ?? null,
      messages: rows.map((m) => ({ id: m.id, kind: m.kind, preview: m.preview, status: m.status, errorText: m.errorText, at: m.createdAt.toISOString() })),
    });
  });
