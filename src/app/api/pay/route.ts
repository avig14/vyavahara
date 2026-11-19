import { getCtx, handle, HttpError, json, readJson } from "@/lib/server/http";
import { createArtifact, loadSnapshot } from "@/lib/db/queries";
import { khataOverview } from "@/lib/analytics/khata-risk";
import { baseUrl } from "@/lib/server/artifacts";
import type { PayLinkParams } from "@/lib/pay";

export const runtime = "nodejs";
export const maxDuration = 30;

/** `{ customerId, amountPaise? }` → a 7-day pay link. Amount defaults to what the customer owes. */
export const POST = (req: Request) =>
  handle(async () => {
    const b = (await readJson(req)) as { customerId?: unknown; amountPaise?: unknown };
    if (typeof b.customerId !== "string") throw new HttpError(400, "customerId is required");
    const c = await getCtx();
    const snap = await loadSnapshot(c.db, c.merchantId, { now: c.now });
    const cust = snap.customers.find((x) => x.id === b.customerId);
    if (!cust) throw new HttpError(404, "Customer not found");
    const owed = khataOverview(snap).accounts.find((a) => a.customerId === cust.id)?.outstandingPaise ?? 0;
    const amountPaise = b.amountPaise === undefined ? owed : b.amountPaise;
    if (typeof amountPaise !== "number" || !Number.isInteger(amountPaise) || amountPaise <= 0) throw new HttpError(400, "Nothing to pay: amountPaise must be a positive integer");
    const params: PayLinkParams = { customerId: cust.id, customerName: cust.name, amountPaise };
    const token = await createArtifact(c.db, c.merchantId, "pay_link", params);
    return json({ url: `${baseUrl()}/pay/${token}`, token, amountPaise });
  });
