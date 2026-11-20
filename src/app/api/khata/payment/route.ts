import { and, eq } from "drizzle-orm";
import { schema as s } from "@/lib/db/client";
import { addKhataEntry } from "@/lib/db/queries";
import { getCtx, handle, HttpError, json, readJson } from "@/lib/server/http";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * The owner records a payment a customer made against their khata:
 * `{ "customerId": "…", "amountPaise": 50000, "note": "optional" }`. Writes one `payment` entry and an audit line.
 */
export const POST = (req: Request) =>
  handle(async () => {
    const body = (await readJson(req)) as {
      customerId?: unknown;
      amountPaise?: unknown;
      note?: unknown;
    };
    const { customerId, amountPaise, note } = body;
    if (typeof customerId !== "string" || customerId.length === 0)
      throw new HttpError(400, "customerId is required");
    if (
      typeof amountPaise !== "number" ||
      !Number.isInteger(amountPaise) ||
      amountPaise <= 0 ||
      amountPaise > 10_000_000_00
    )
      throw new HttpError(
        400,
        "amountPaise must be a positive integer (paise)",
      );
    if (note !== undefined && (typeof note !== "string" || note.length > 200))
      throw new HttpError(400, "note must be text of at most 200 characters");

    const c = await getCtx();
    const [cust] = await c.db
      .select({ id: s.customers.id })
      .from(s.customers)
      .where(
        and(
          eq(s.customers.merchantId, c.merchantId),
          eq(s.customers.id, customerId),
        ),
      )
      .limit(1);
    if (!cust) throw new HttpError(404, "Customer not found");

    const entry = await addKhataEntry(c.db, {
      merchantId: c.merchantId,
      customerId,
      type: "payment",
      amountPaise,
      note: typeof note === "string" && note.trim() ? note.trim() : undefined,
      source: "owner",
    });
    return json({ entry }, 201);
  });
