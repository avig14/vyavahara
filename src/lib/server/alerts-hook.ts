/**
 * Proactive red-khata check that rides on a dashboard load (PRD A9). Cheap and safe to call on every load:
 * it runs after the response, at most once every few minutes per server instance, and the 7-day cool-down
 * in checkKhataAlerts stops repeats. Failures are logged and never reach the dashboard.
 */
import { after } from "next/server";
import type { Snapshot } from "../domain";
import { flushWrites } from "../db/client";
import type { Ctx } from "./http";
import { checkKhataAlerts } from "../wa/alerts";
import { pickChannel } from "../wa/channel";

const EVERY_MS = 5 * 60_000;
let lastRun = 0;

export function scheduleKhataAlerts(c: Ctx, snap: Snapshot): void {
  if (Date.now() - lastRun < EVERY_MS) return;
  lastRun = Date.now();
  try {
    after(async () => {
      try {
        await checkKhataAlerts(c.db, c.merchantId, snap, pickChannel(), c.now);
      } catch (e) {
        console.error("[alerts] check failed", e instanceof Error ? e.message : "unknown");
      } finally {
        await flushWrites();
      }
    });
  } catch {
    // called outside a request (tests, scripts): nothing to schedule
  }
}
