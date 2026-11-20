/**
 * Shows how much of the Neon free plan this month's usage has eaten, before it becomes an outage.
 *   npm run db:usage
 * Needs NEON_API_KEY and NEON_PROJECT_ID in .env.local. Exit code 1 at 80% or more, so it also works in a cron or CI check.
 * Docs: https://neon.com/docs/reference/api-reference  (GET /projects/{project_id})
 */
import { config } from "dotenv";
config({ path: ".env.local" });

const TRANSFER_LIMIT = 5 * 1024 ** 3; // free plan: 5 GB public network transfer per project per month
const WARN_AT = 0.8;

interface NeonProject {
  data_transfer_bytes?: number;
  consumption_period_start?: string;
  consumption_period_end?: string;
  name?: string;
}

const gb = (n: number) => `${(n / 1024 ** 3).toFixed(2)} GB`;

async function main() {
  const key = process.env.NEON_API_KEY;
  const id = process.env.NEON_PROJECT_ID;
  if (!key || !id) {
    console.error("Set NEON_API_KEY and NEON_PROJECT_ID in .env.local");
    process.exit(2);
  }
  const res = await fetch(`https://console.neon.tech/api/v2/projects/${encodeURIComponent(id)}`, { headers: { authorization: `Bearer ${key}`, accept: "application/json" } });
  if (!res.ok) {
    console.error(`Neon API said ${res.status}. Check the key and project id.`);
    process.exit(2);
  }
  const p = ((await res.json()) as { project: NeonProject }).project;
  const used = p.data_transfer_bytes ?? 0;
  const pct = used / TRANSFER_LIMIT;
  const end = p.consumption_period_end ? new Date(p.consumption_period_end).toISOString().slice(0, 10) : "?";
  const bar = "█".repeat(Math.round(Math.min(pct, 1) * 30)).padEnd(30, "░");

  console.log(`Project   ${p.name ?? id}`);
  console.log(`Transfer  ${bar} ${gb(used)} of ${gb(TRANSFER_LIMIT)} (${(pct * 100).toFixed(1)}%)`);
  console.log(`Resets    ${end}`);
  if (pct >= WARN_AT) {
    console.log(`\nWARNING: ${(pct * 100).toFixed(0)}% used. At 100% Neon suspends the database until the reset. Check for loops or new full-table reads.`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(2);
});
