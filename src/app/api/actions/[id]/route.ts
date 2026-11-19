import { getCtx, handle, HttpError, json, readJson } from "@/lib/server/http";
import { applyChoice, confirmationMessage, type PendingPayload } from "@/lib/agent/actions";
import { getPendingById } from "@/lib/db/queries";
import type { PendingKind } from "@/lib/db/queries";

export const runtime = "nodejs";
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string }> };

/** The question behind a pending action, for the dashboard's confirm card. */
export const GET = (_req: Request, { params }: Ctx) =>
  handle(async () => {
    const { id } = await params;
    const c = await getCtx();
    const row = await getPendingById(c.db, c.merchantId, id);
    if (!row) throw new HttpError(404, "Action not found");
    const p = { kind: row.kind as PendingKind, ...(row.payload as object) } as PendingPayload;
    return json({ id: row.id, kind: row.kind, status: row.status, expiresAt: row.expiresAt, message: confirmationMessage(p) });
  });

/** { "choice": "confirm" | "cancel" } */
export const POST = (req: Request, { params }: Ctx) =>
  handle(async () => {
    const { id } = await params;
    const body = (await readJson(req)) as { choice?: unknown };
    if (body.choice !== "confirm" && body.choice !== "cancel") throw new HttpError(400, 'choice must be "confirm" or "cancel"');
    const c = await getCtx();
    const row = await getPendingById(c.db, c.merchantId, id);
    if (!row) throw new HttpError(404, "Action not found");
    if (row.status !== "open") throw new HttpError(409, `Action already ${row.status}`);
    if (row.expiresAt < c.now) throw new HttpError(410, "Action expired. Ask again.");
    const reply = await applyChoice(c.db, c.merchantId, row, body.choice === "confirm" ? 1 : 2);
    if (reply === null) throw new HttpError(409, "Action already handled");
    return json({ reply });
  });
