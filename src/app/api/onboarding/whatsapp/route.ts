import { getCtx, handle, HttpError, json, readJson } from "@/lib/server/http";
import { setOwnerPhone } from "@/lib/db/queries";
import { maskPhone, normalizePhone } from "@/lib/wa/cloud";

export const runtime = "nodejs";

/** Body: { phone }. Saves the number reports go to. Accepts "98765 43210", "+91 98765-43210" and so on. */
export const POST = (req: Request) =>
  handle(async () => {
    const body = (await readJson(req)) as { phone?: unknown };
    const digits = typeof body.phone === "string" ? normalizePhone(body.phone) : null;
    if (!digits) throw new HttpError(400, "Number sahi nahi lag raha. 10 digit mobile number daalo.");
    const c = await getCtx();
    await setOwnerPhone(c.db, c.merchantId, digits);
    return json({ number: maskPhone(digits) });
  });
