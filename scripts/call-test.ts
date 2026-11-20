/**
 * One-off Call Saathi test call, no database needed.
 *   npx tsx scripts/call-test.ts <publicBaseUrl> <toNumber>
 * Starts a local server for the Vobiz webhooks (same script/XML code as the real routes), places ONE call, waits for hangup, exits.
 * <publicBaseUrl> must tunnel to port 3939 (e.g. ssh -R 80:localhost:3939 nokey@localhost.run).
 */
import "dotenv/config";
import { config } from "dotenv";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { answerXml, outcomeFor, replyXml } from "../src/lib/calls/script";
import { normalizeIndianPhone, placeCall, vobizConfig } from "../src/lib/calls/vobiz";

config({ path: ".env.local" });
const [base, toRaw] = process.argv.slice(2);
const cfg = vobizConfig();
const to = normalizeIndianPhone(toRaw ?? "");
if (!cfg || !base || !to) throw new Error("usage: call-test.ts <publicBaseUrl> <toNumber>; needs VOBIZ_* in .env.local");

const PORT = 3939;
const key = randomBytes(12).toString("hex");
const facts = { customerName: "Sharma ji", shopName: "Gupta Kirana", amountPaise: 120000, overdueDays: 45 };
const lang = process.env.VOBIZ_SPEAK_LANG;

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://x");
  let body = "";
  for await (const c of req) body += c;
  console.log(new Date().toISOString(), req.method, url.pathname, body.slice(0, 300));
  if (url.searchParams.get("k") !== key) { res.writeHead(401).end(); return; }
  const send = (xml: string) => res.writeHead(200, { "content-type": "text/xml; charset=utf-8" }).end(xml);
  if (url.pathname === "/answer") return send(answerXml(facts, `${base}/gather?k=${key}`, lang));
  if (url.pathname === "/gather") {
    const p = new URLSearchParams(body);
    let digits = p.get("Digits");
    if (!digits && body.startsWith("{")) try { digits = String(JSON.parse(body).Digits ?? ""); } catch { /* ignore */ }
    return send(replyXml(outcomeFor(digits), facts, lang));
  }
  if (url.pathname === "/hangup") { res.writeHead(200).end(); setTimeout(() => process.exit(0), 500); return; }
  res.writeHead(404).end();
});

server.listen(PORT, async () => {
  const r = await placeCall(cfg, { to, answerUrl: `${base}/answer?k=${key}`, hangupUrl: `${base}/hangup?k=${key}`, timeLimit: 60 });
  console.log("placeCall:", JSON.stringify(r));
  if (!r.ok) process.exit(1);
  setTimeout(() => { console.log("timeout, exiting"); process.exit(0); }, 120_000);
});
