import { getCtx, handle, json, readJson } from "@/lib/server/http";
import { loadSettings, resetSettings, saveSettings } from "@/lib/db/queries";
import { DEFAULT_SETTINGS } from "@/lib/settings";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Current settings + factory defaults (so the form can offer "reset"). */
export const GET = () =>
  handle(async () => {
    const c = await getCtx();
    return json({ settings: await loadSettings(c.db, c.merchantId), defaults: DEFAULT_SETTINGS });
  });

/** Partial patch, deep-merged and validated. 400 with a readable message when a value is out of range. */
export const PUT = (req: Request) =>
  handle(async () => {
    const c = await getCtx();
    const r = await saveSettings(c.db, c.merchantId, await readJson(req));
    return r.ok ? json({ settings: r.settings }) : json({ error: r.error }, 400);
  });

/** Back to factory defaults. */
export const DELETE = () =>
  handle(async () => {
    const c = await getCtx();
    return json({ settings: await resetSettings(c.db, c.merchantId) });
  });
