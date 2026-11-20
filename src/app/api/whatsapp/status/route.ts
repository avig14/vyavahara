import { getCtx, handle, json } from "@/lib/server/http";
import { getWaState, listWaMessages } from "@/lib/db/queries";
import { maskPhone, waConfig } from "@/lib/wa/cloud";
import { activeProvider, statusCallbackUrl } from "@/lib/wa/channel";
import { twilioConfig } from "@/lib/wa/twilio";
import { windowOpenUntil } from "@/lib/wa/send";

export const runtime = "nodejs";

/** Everything the WhatsApp card and the connect step need: provider, is the owner connected, join link, 24h window, last sends. */
export const GET = () =>
  handle(async () => {
    const c = await getCtx();
    const [st, rows] = await Promise.all([getWaState(c.db, c.merchantId), listWaMessages(c.db, c.merchantId, 6)]);
    const provider = activeProvider();
    const t = twilioConfig();
    const digits = t ? t.from.replace(/\D/g, "") : null;
    return json({
      provider,
      configured: provider !== null,
      // delivery receipts only arrive if the provider can reach our public https URL
      webhookReady: provider === "twilio" ? statusCallbackUrl() !== null : Boolean(process.env.WHATSAPP_VERIFY_TOKEN),
      connected: Boolean(st.connectedAt),
      number: st.phone ? maskPhone(st.phone) : null,
      // Twilio sandbox: the owner must send this phrase once before the bot can talk to them
      join: t && digits ? { code: t.joinCode, number: `+${digits}`, url: `https://wa.me/${digits}?text=${encodeURIComponent(t.joinCode)}` } : null,
      metaConfigured: waConfig() !== null,
      windowOpenUntil: windowOpenUntil(st.lastInboundAt, c.now)?.toISOString() ?? null,
      messages: rows.map((m) => ({ id: m.id, kind: m.kind, preview: m.preview, status: m.status, errorText: m.errorText, at: m.createdAt.toISOString() })),
    });
  });
