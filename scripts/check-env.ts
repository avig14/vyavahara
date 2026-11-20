/**
 * Env doctor: shows which services are ready from the env file, which are half-set, and which are off.
 * Never prints a secret (only length / last 2 chars / host). Exit 1 if a REQUIRED service is not ready.
 *
 *   npm run env:check                      # checks .env.local (+ real process env)
 *   npm run env:check -- --file=.env.prod  # check another file, e.g. one made by `vercel env pull .env.prod --environment production`
 *   npm run env:check -- --prod            # also demand a public https APP_BASE_URL and a long SOUNDBOX_SECRET
 */
import { readFileSync, existsSync } from "node:fs";
import { normalizeIndianPhone } from "../src/lib/calls/vobiz";

const args = process.argv.slice(2);
const fileArg = args.find((a) => a.startsWith("--file="))?.slice(7) ?? ".env.local";
const prod = args.includes("--prod");

function parse(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

if (!existsSync(fileArg)) {
  console.error(`File not found: ${fileArg}`);
  process.exit(2);
}
const env: Record<string, string | undefined> = { ...process.env, ...parse(readFileSync(fileArg, "utf8")) };
const has = (k: string) => Boolean(env[k]?.trim());
const mask = (k: string) => {
  const v = env[k]?.trim() ?? "";
  if (k === "DATABASE_URL") return v.replace(/^[a-z]+:\/\/[^@]*@/, "").replace(/[/?].*$/, "").replace(/^[^.]*\./, "…");
  if (/^(APP_BASE_URL|MERCHANT_UPI_ID|CLAUDE_|SARVAM_(STT|TTS)|VOBIZ_(BASE_URL|SEND_MODE|SPEAK_LANG)|TWILIO_(SEND_MODE|DAILY_CAP|SANDBOX|WEBHOOK)|WHATSAPP_API_VERSION)/.test(k)) return v;
  return `set (${v.length} chars, …${v.slice(-2)})`;
};

type Level = "ready" | "partial" | "off";
interface Service {
  name: string;
  required: boolean;
  needs: string[];
  /** extra checks; return problems (strings) */
  check?: () => string[];
  /** vars that are nice to have; shown when unset */
  optional?: string[];
  note?: string;
}

const phoneList = () =>
  (env.CALLS_ALLOWED_NUMBERS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const SERVICES: Service[] = [
  {
    name: "Database (Neon Postgres)",
    required: true,
    needs: ["DATABASE_URL"],
    check: () => (/^postgres(ql)?:\/\//.test(env.DATABASE_URL ?? "") ? [] : ["DATABASE_URL must start with postgres:// or postgresql://"]),
  },
  {
    name: "App URL & merchant",
    required: true,
    needs: ["APP_BASE_URL"],
    optional: ["MERCHANT_UPI_ID"],
    check: () => {
      const u = env.APP_BASE_URL ?? "";
      const p: string[] = [];
      if (u && !/^https?:\/\//.test(u)) p.push("APP_BASE_URL must start with http:// or https://");
      if (prod && /localhost|127\.0\.0\.1/.test(u)) p.push("APP_BASE_URL is localhost, but Vobiz/Twilio/Meta webhooks need the public https URL");
      if (prod && u && !u.startsWith("https://")) p.push("APP_BASE_URL should be https in production");
      if (u.endsWith("/")) p.push("APP_BASE_URL should not end with /");
      return p;
    },
  },
  {
    name: "Claude (agent, free-text questions)",
    required: false,
    needs: ["ANTHROPIC_API_KEY"],
    optional: ["CLAUDE_MODEL", "CLAUDE_EFFORT"],
    check: () => (/^sk-ant-/.test(env.ANTHROPIC_API_KEY ?? "") || !has("ANTHROPIC_API_KEY") ? [] : ["ANTHROPIC_API_KEY does not look like an Anthropic key (sk-ant-…)"]),
    note: "Off = the bot still runs the menu; typed questions get the 'cannot answer' fallback.",
  },
  {
    name: "Sarvam (Voice Saathi speech)",
    required: false,
    needs: ["SARVAM_API_KEY"],
    optional: ["SARVAM_STT_MODEL", "SARVAM_TTS_MODEL", "SARVAM_TTS_SPEAKER"],
  },
  {
    name: "Voice signing (Soundbox)",
    required: false,
    needs: [],
    check: () => {
      const s = env.SOUNDBOX_SECRET ?? env.HASH_SALT;
      if (!s) return ["set SOUNDBOX_SECRET (or HASH_SALT): without it /api/soundbox/speak throws"];
      if (prod && !has("SOUNDBOX_SECRET")) return ["SOUNDBOX_SECRET is not set; it falls back to HASH_SALT. Set its own random value"];
      if (prod && s.length < 32) return ["SOUNDBOX_SECRET is short; use 32+ random chars"];
      return [];
    },
    optional: ["SOUNDBOX_SECRET"],
  },
  {
    name: "WhatsApp: Twilio",
    required: false,
    needs: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_WHATSAPP_FROM"],
    optional: ["TWILIO_SANDBOX_JOIN_CODE", "TWILIO_SEND_MODE", "TWILIO_DAILY_CAP", "TWILIO_WEBHOOK_BASE"],
    check: () => {
      const p: string[] = [];
      if (has("TWILIO_ACCOUNT_SID") && !/^AC[0-9a-f]{32}$/i.test(env.TWILIO_ACCOUNT_SID!)) p.push("TWILIO_ACCOUNT_SID should be AC + 32 hex chars");
      if (has("TWILIO_WHATSAPP_FROM") && !/^\+?\d{10,15}$/.test(env.TWILIO_WHATSAPP_FROM!.replace(/^whatsapp:/, ""))) p.push("TWILIO_WHATSAPP_FROM should be a phone number like +14155238886");
      if (env.TWILIO_SEND_MODE === "dry") p.push("TWILIO_SEND_MODE=dry: replies are only logged, nothing is sent");
      return p;
    },
    note: "Webhook to paste in Twilio: <APP_BASE_URL>/api/twilio/webhook. Twilio wins over Meta when both are set.",
  },
  {
    name: "WhatsApp: Meta Cloud API (fallback)",
    required: false,
    needs: ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_VERIFY_TOKEN", "WHATSAPP_APP_SECRET"],
    optional: ["WHATSAPP_API_VERSION", "OWNER_WA"],
    note: "Webhook: <APP_BASE_URL>/api/whatsapp/webhook. Used only when Twilio is off.",
  },
  {
    name: "Call Saathi (Vobiz reminder calls)",
    required: false,
    needs: ["VOBIZ_AUTH_ID", "VOBIZ_AUTH_TOKEN", "VOBIZ_FROM_NUMBER", "VOBIZ_WEBHOOK_SECRET", "CALLS_CRON_SECRET"],
    optional: ["CALLS_ALLOWED_NUMBERS", "VOBIZ_SEND_MODE", "VOBIZ_SPEAK_LANG", "VOBIZ_BASE_URL"],
    check: () => {
      const p: string[] = [];
      if (has("VOBIZ_FROM_NUMBER") && !normalizeIndianPhone(env.VOBIZ_FROM_NUMBER!)) p.push("VOBIZ_FROM_NUMBER is not a valid Indian number (e.g. +918065551234)");
      const bad = phoneList().filter((n) => !normalizeIndianPhone(n));
      if (bad.length) p.push(`CALLS_ALLOWED_NUMBERS has ${bad.length} entry(ies) that are not valid Indian mobile numbers`);
      if (has("VOBIZ_WEBHOOK_SECRET") && env.VOBIZ_WEBHOOK_SECRET!.length < 16) p.push("VOBIZ_WEBHOOK_SECRET is short; use 32+ random chars");
      if (has("CALLS_CRON_SECRET") && env.CALLS_CRON_SECRET!.length < 16) p.push("CALLS_CRON_SECRET is short; use 32+ random chars");
      if (phoneList().length) p.push(`demo guard ON: only ${phoneList().length} allowed number(s) can be dialled. Clear CALLS_ALLOWED_NUMBERS for real merchants`);
      if (env.VOBIZ_SEND_MODE === "dry") p.push("VOBIZ_SEND_MODE=dry: calls are only logged");
      return p;
    },
    note: "Vobiz webhooks: <APP_BASE_URL>/api/vobiz/{answer,gather,hangup}?k=<VOBIZ_WEBHOOK_SECRET>. Run endpoint: POST /api/calls/run with Bearer CALLS_CRON_SECRET.",
  },
  {
    name: "Neon tooling (db:usage, scripts)",
    required: false,
    needs: ["NEON_API_KEY", "NEON_PROJECT_ID"],
    note: "Not needed at runtime.",
  },
];

let failed = false;
console.log(`Env doctor: ${fileArg}${prod ? " (production rules)" : ""}\n`);
for (const s of SERVICES) {
  const missing = s.needs.filter((k) => !has(k));
  const problems = s.check?.() ?? [];
  const hardProblems = problems.filter((x) => !/demo guard|=dry/.test(x));
  const level: Level = s.needs.length === 0 ? (hardProblems.length ? "partial" : "ready") : missing.length === 0 ? "ready" : missing.length === s.needs.length ? "off" : "partial";
  const ok = level === "ready" && hardProblems.length === 0;
  if (s.required && !ok) failed = true;
  const tag = ok ? "✅ ready  " : level === "off" ? (s.required ? "❌ MISSING" : "⚪ off    ") : "⚠️  partial";
  console.log(`${tag}  ${s.name}${s.required ? "  [required]" : ""}`);
  for (const k of s.needs) console.log(`            ${has(k) ? "•" : "✗"} ${k}${has(k) ? "  " + mask(k) : "  (not set)"}`);
  for (const k of s.optional ?? []) if (has(k)) console.log(`            ○ ${k}  ${mask(k)}`);
  for (const m of level === "partial" ? missing : []) console.log(`            ! still needs ${m}`);
  for (const x of problems) console.log(`            ! ${x}`);
  if (level !== "ready" && s.note) console.log(`            i ${s.note}`);
  console.log();
}
console.log(failed ? "RESULT: a required service is not ready." : "RESULT: all required services are ready.");
process.exit(failed ? 1 : 0);
