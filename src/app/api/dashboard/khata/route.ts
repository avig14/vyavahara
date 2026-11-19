import { getCtx, handle, HttpError, json } from "@/lib/server/http";
import { loadDash } from "@/lib/server/dash";
import { listKhataLedger } from "@/lib/db/queries";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Overview, or `?customerId=` for one customer's ledger. */
export const GET = (req: Request) =>
  handle(async () => {
    const c = await getCtx();
    const d = await loadDash(c);
    const cid = new URL(req.url).searchParams.get("customerId");
    if (cid) {
      const cust = d.snap.customers.find((x) => x.id === cid);
      if (!cust) throw new HttpError(404, "Customer not found");
      return json({ customer: cust, account: d.cx.khata.accounts.find((a) => a.customerId === cid) ?? null, ledger: await listKhataLedger(c.db, c.merchantId, cid) });
    }
    return json({ khata: d.cx.khata, recommendations: d.recs.filter((r) => r.module === "khata") });
  });
