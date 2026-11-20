import { getCtx, handle, HttpError, json, readJson } from "@/lib/server/http";
import { callCustomerNow } from "@/lib/calls/dial";

export const runtime = "nodejs";
export const maxDuration = 30;

/** "Abhi call karo": the owner chose this customer, so call now. Still needs phone, consent, calling hours and Vobiz. */
export const POST = (req: Request) =>
  handle(async () => {
    const c = await getCtx();
    const b = (await readJson(req)) as { customerId?: unknown };
    if (typeof b.customerId !== "string") throw new HttpError(400, "customerId is required");
    const r = await callCustomerNow(c.db, c.merchantId, b.customerId, c.now);
    return r.ok ? json({ ok: true, name: r.name }) : json({ error: r.message }, 400);
  });
