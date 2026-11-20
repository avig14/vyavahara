/**
 * What the bot does when the owner writes (PRD A6/B6/B7). One entry for every provider:
 *   handleInbound  = who is this, dedupe, connect, then route
 *   routeMessage   = the conversation itself (menu, awaiting steps, 1/2 confirms, voice, photos, PDF, agent)
 * Order for text: pending 1/2 → menu word → "9" → awaiting step → digits → free text to the agent.
 * Menus, reports, lists and confirmations are deterministic (no AI, no cost). Only free text, photos and voice call a model.
 */
import type { Db } from "../db/client";
import {
  claimInbound,
  createPendingAction,
  getMerchantByPhone,
  getOpenPending,
  getWaSession,
  loadSnapshot,
  resolvePending,
  setWaSession,
  touchInbound,
} from "../db/queries";
import { buildContext } from "../analytics/recommendations";
import { applyChoice, parseChoice } from "../agent/actions";
import { runAgent, type AgentResult } from "../agent/run";
import { dbStore } from "../agent/store";
import { billReader, extractBill, extractPaymentShot, classifyImage, type Bill, type ImageInput, type PaymentShotRaw } from "../ingest/vision";
import { scanBill } from "../ingest/bill-scan";
import { findPayment } from "../ingest/reconcile";
import { transcribe } from "../ingest/sarvam";
import { handleAwaiting, type FlowEnv } from "../menu/flows";
import { isBack, isMenuWord, isModuleKey, mainMenu, menuEnv, moduleMenu, NAV, pdfRequest, renderLeaf, type Awaiting, type Leaf } from "../menu/menus";
import { istDayStart, MS_DAY, type PeriodName } from "../time";
import { baseUrl, mintPayLink, mintReportLink } from "../server/artifacts";
import { checkKhataAlerts, takeQueuedAlerts } from "./alerts";
import { deliver, type Channel, type OutKind, type OutPart } from "./channel";
import { billReply, paymentReply } from "./media-text";

/* ---------------- models the router may call (injected in tests) ---------------- */

export interface Ports {
  transcribe(bytes: Uint8Array, mime: string): Promise<string>;
  classify(img: ImageInput): Promise<"supplier_bill" | "payment_screenshot" | "other">;
  extractBill(img: ImageInput): Promise<Bill | null>;
  extractShot(img: ImageInput): Promise<PaymentShotRaw | null>;
  agent(db: Db, merchantId: string, text: string, now: Date): Promise<AgentResult>;
  /** false → say "free sawal abhi nahi" instead of calling the agent */
  agentReady(): boolean;
  /** false → say "photo padhne ki suvidha abhi band hai" (no Sarvam or Claude key for reading photos) */
  visionReady(): boolean;
}

export const livePorts: Ports = {
  transcribe: async (bytes, mime) => (await transcribe(bytes, { mime, filename: mime.includes("ogg") ? "voice.ogg" : mime.includes("mp4") || mime.includes("m4a") ? "voice.m4a" : "voice.audio" })).text,
  classify: (i) => classifyImage(i),
  extractBill: (i) => extractBill(i),
  extractShot: (i) => extractPaymentShot(i),
  agent: (db, id, text, now) => runAgent(db, id, text, "wa", { now }),
  agentReady: () => Boolean(process.env.ANTHROPIC_API_KEY),
  visionReady: () => billReader() !== null,
};

/* ---------------- result of routing one message ---------------- */

interface Reply {
  parts: OutPart[];
  kind: OutKind;
}

const text = (t: string, kind: OutKind = "reply"): Reply => ({ parts: [{ text: t }], kind });

export interface Inbound {
  id: string;
  from: string;
  text: string | null;
  media: { url: string; type: string } | null;
  profileName?: string | null;
}

const SESSION_TTL_MS = 30 * 60_000;

const asAwaiting = (v: unknown): Awaiting | null => (v && typeof v === "object" && "kind" in v ? (v as Awaiting) : null);

/** Slot for the PDF: text first, then the file as its own message (WhatsApp drops a caption on documents). */
async function pdfParts(db: Db, ch: Channel, merchantId: string, period: PeriodName, custom?: { from: string; to: string }): Promise<OutPart[]> {
  if (!baseUrl()) return [{ text: "PDF link abhi nahi ban sakta (APP_BASE_URL set nahi hai)." }];
  const url = await mintReportLink(db, merchantId, { period, custom: custom ? { from: istDayStart(custom.from), to: new Date(istDayStart(custom.to).getTime() + MS_DAY) } : undefined });
  if (!ch.supportsMedia) return [{ text: `📄 PDF report (7 din tak chalega):\n${url}` }];
  return [{ mediaUrl: url, label: "📄 PDF report" }];
}

/* ---------------- the conversation ---------------- */

export async function routeMessage(db: Db, ch: Channel, merchantId: string, to: string, msg: Pick<Inbound, "text" | "media">, ports: Ports = livePorts, now = new Date()): Promise<void> {
  let reply: Reply;
  try {
    reply = await compose(db, ch, merchantId, msg, ports, now);
  } catch (e) {
    console.error("[wa] route failed", e instanceof Error ? e.message : "unknown");
    reply = text("Kuch gadbad ho gayi. Thodi der baad dobara try karo. Menu ke liye *Hi* likho.");
  }
  await deliver(db, ch, merchantId, to, reply.parts, reply.kind, now);
}

async function compose(db: Db, ch: Channel, merchantId: string, msg: Pick<Inbound, "text" | "media">, ports: Ports, now: Date): Promise<Reply> {
  let body = msg.text?.trim() || null;
  let heard: string | null = null;

  /* voice → text, then it is a normal message */
  if (msg.media && msg.media.type.startsWith("audio/")) {
    try {
      const a = await ch.fetchMedia(msg.media.url);
      const t = (await ports.transcribe(a.bytes, a.mime || msg.media.type)).trim();
      if (!t) return text("🎙️ Awaaz samajh nahi aayi. Dobara bolo, ya likh ke bhejo.");
      heard = t;
      body = t;
    } catch {
      return text("🎙️ Voice note abhi nahi sun paya. Likh ke bhejo, ya *Hi* likho menu ke liye.");
    }
  }
  /* photos */
  if (msg.media && msg.media.type.startsWith("image/")) return image(db, ch, merchantId, msg.media, ports, now);
  if (msg.media && !body) return text("Abhi sirf text, voice note aur photo samajhta hoon. *Hi* likho menu ke liye.");

  const r = await converse(db, ch, merchantId, body ?? "", ports, now);
  if (heard) r.parts = [{ text: `🎙️ Suna: _“${heard}”_` }, ...r.parts];
  return r;
}

async function image(db: Db, ch: Channel, merchantId: string, media: { url: string; type: string }, ports: Ports, now: Date): Promise<Reply> {
  if (!ports.visionReady()) return text("Photo padhne ki suvidha abhi band hai. Menu ke liye *Hi* likho.");
  try {
    const f = await ch.fetchMedia(media.url);
    const mime = (f.mime || media.type).toLowerCase();
    if (!/^image\/(jpeg|png|gif|webp)$/.test(mime)) return text("Yeh photo format nahi padh sakta. JPG ya PNG bhejo.");
    const img: ImageInput = { base64: Buffer.from(f.bytes).toString("base64"), mime: mime as ImageInput["mime"] };
    const sess = await getWaSession(db, merchantId);
    const waitingShot = asAwaiting(sess.context)?.kind === "screenshot";
    const kind = waitingShot ? "payment_screenshot" : await ports.classify(img);

    if (kind === "supplier_bill") {
      const scan = await scanBill(db, merchantId, img, { now }, ports.extractBill);
      await setWaSession(db, merchantId, { menuPath: sess.menuPath, context: null }, now);
      return text(billReply(scan.review, scan.pendingId !== null));
    }
    if (kind === "payment_screenshot") {
      const shot = await ports.extractShot(img);
      await setWaSession(db, merchantId, { menuPath: sess.menuPath, context: null }, now);
      if (!shot) return text(paymentReply({ found: false, reason: "unreadable" }, null));
      const snap = await loadSnapshot(db, merchantId, { now });
      const at = shot.datetime ? new Date(shot.datetime) : null;
      const check = findPayment(snap, { amountPaise: shot.amount === null ? null : Math.round(shot.amount * 100), utr: shot.utr, at: at && !Number.isNaN(at.getTime()) ? at : null }, snap.settings.ingest.paymentMatchWindowMin);
      return text(paymentReply(check, shot.amount === null ? null : Math.round(shot.amount * 100)));
    }
    return text("Yeh bill ya payment screenshot nahi lag raha. Supplier bill ya customer ka payment screenshot bhejo.");
  } catch (e) {
    console.error("[wa] image failed", e instanceof Error ? e.message : "unknown");
    return text("Photo padh nahi paya. Thodi der baad dobara bhejo.");
  }
}

async function converse(db: Db, ch: Channel, merchantId: string, raw: string, ports: Ports, now: Date): Promise<Reply> {
  const snap = await loadSnapshot(db, merchantId, { now });
  const ctx = buildContext(snap);
  const env = menuEnv(snap, ctx);
  const sess = await getWaSession(db, merchantId);
  const fresh = sess.updatedAt && now.getTime() - sess.updatedAt.getTime() < SESSION_TTL_MS;
  const aw = fresh ? asAwaiting(sess.context) : null;
  const path = sess.menuPath;
  const save = (menuPath: string, context: Awaiting | null) => setWaSession(db, merchantId, { menuPath, context }, now);

  const finish = async (r: Reply, menuPath: string, next: Awaiting | null, allowAlert = true): Promise<Reply> => {
    // alerts that waited for the owner to write: show once, after the answer, unless this answer is itself waiting for something
    if (allowAlert && !next) {
      const q = await takeQueuedAlerts(db, merchantId, now);
      if (q) {
        await save(menuPath, q.awaiting);
        return { kind: r.kind, parts: [...r.parts, { text: q.text }] };
      }
    }
    await save(menuPath, next);
    return r;
  };

  const t = raw.trim();
  const menuWord = isMenuWord(t);

  /* an alert waiting for 1/2/3 beats everything else for those three digits */
  if (aw?.kind === "alert" && /^[123]$/.test(t)) {
    const r = await runFlow(db, merchantId, aw, t, snap, ctx);
    return finish(text(r?.text ?? mainMenu(env)), path, r?.next ?? null, false);
  }

  /* a waiting 1/2 confirmation */
  const choice = parseChoice(t);
  if (choice && !menuWord) {
    const row = await getOpenPending(db, merchantId, now);
    if (row) {
      const out = await applyChoice(db, merchantId, row, choice);
      if (out !== null) return finish(text(`${out}\n\n${NAV}`), path, null);
    }
  }

  /* hi / menu / 0 */
  if (menuWord || !t) {
    const open = await getOpenPending(db, merchantId, now);
    if (open) await resolvePending(db, merchantId, open.id, "cancelled");
    const q = await takeQueuedAlerts(db, merchantId, now);
    if (q) {
      await save("", q.awaiting);
      return text(`${q.text}\n\nMenu ke liye *0* likho.`, "alert");
    }
    await save("", null);
    return text(mainMenu(env), "menu");
  }

  /* 9 = back */
  if (isBack(t)) {
    await save("", null);
    return text(mainMenu(env), "menu");
  }

  /* "PDF bhejo" */
  const pdf = pdfRequest(t);
  if (pdf) {
    const parts = await pdfParts(db, ch, merchantId, pdf.period);
    await save(path, null);
    return { kind: "pdf", parts: [{ text: "📄 PDF report bhej raha hoon…" }, ...parts] };
  }

  /* an answer to the step the bot is waiting on */
  if (aw) {
    const r = await runFlow(db, merchantId, aw, t, snap, ctx);
    if (r) return finish(text(r.text), path, r.next ?? null);
  }

  /* menu digits */
  if (/^\d$/.test(t)) {
    if (path === "" || !isModuleKey(path)) {
      if (isModuleKey(t)) return finish(text(moduleMenu(t, env), "menu"), t, null, false);
      return finish(text(`Yeh option nahi hai.\n\n${mainMenu(env)}`, "menu"), "", null, false);
    }
    const leaf = renderLeaf(path, Number(t), env);
    if (!leaf) return finish(text(`Yeh option nahi hai.\n\n${moduleMenu(path, env)}`, "menu"), path, null, false);
    return leafReply(db, ch, merchantId, leaf, path, finish);
  }

  /* anything else: the agent (free Hinglish questions, writes with confirmation) */
  if (!ports.agentReady()) return finish(text("Is sawal ka jawab abhi nahi de sakta. Menu ke liye *Hi* likho."), path, null);
  const out = await ports.agent(db, merchantId, t, now);
  const parts: OutPart[] = [{ text: out.text }];
  for (const a of out.attachments) parts.push(...(await pdfParts(db, ch, merchantId, a.period, a.custom)));
  return finish({ kind: out.attachments.length ? "pdf" : "reply", parts }, path, null);
}

async function leafReply(
  db: Db,
  ch: Channel,
  merchantId: string,
  leaf: Leaf,
  path: string,
  finish: (r: Reply, menuPath: string, next: Awaiting | null, allowAlert?: boolean) => Promise<Reply>,
): Promise<Reply> {
  const parts: OutPart[] = [{ text: leaf.text }];
  if (leaf.pdf) parts.push(...(await pdfParts(db, ch, merchantId, leaf.pdf.period, leaf.pdf.custom)));
  return finish({ kind: leaf.pdf ? "pdf" : "reply", parts }, path, leaf.next ?? null, !leaf.next);
}

async function runFlow(db: Db, merchantId: string, aw: Awaiting, t: string, snap: Awaited<ReturnType<typeof loadSnapshot>>, ctx: ReturnType<typeof buildContext>) {
  const base = dbStore(db, merchantId, "owner");
  const fx: FlowEnv = {
    snap,
    ctx,
    store: { ...base, createPending: async (kind, payload) => (await createPendingAction(db, merchantId, kind, payload)).id },
    payLink: (customerId, customerName, amountPaise) => mintPayLink(db, merchantId, { customerId, customerName, amountPaise }),
  };
  return handleAwaiting(aw, t, fx);
}

/* ---------------- the front door ---------------- */

export const CONNECT_FIRST = () => `Namaste 🙏 Pehle dashboard se WhatsApp connect karein: ${baseUrl() || "(app ka link)"}/onboarding`;

/**
 * One owner message from a provider. Never throws: it runs after the webhook already answered 200.
 * Unknown sender → how to connect. Known → mark connected + open the 24h window, drop provider retries, answer.
 */
export async function handleInbound(db: Db, ch: Channel, m: Inbound, ports: Ports = livePorts, now = new Date()): Promise<void> {
  try {
    const merchant = await getMerchantByPhone(db, m.from);
    if (!merchant) {
      await ch.sendText(m.from, CONNECT_FIRST()).catch(() => undefined);
      return;
    }
    const firstTime = !merchant.waConnectedAt;
    await touchInbound(db, merchant.id, now);
    if (!(await claimInbound(db, merchant.id, m.id, m.text ?? (m.media ? `(${m.media.type})` : "(empty)")))) return; // provider retry
    if (firstTime) {
      const snap = await loadSnapshot(db, merchant.id, { now });
      await deliver(db, ch, merchant.id, m.from, [{ text: "✅ *WhatsApp connect ho gaya!* Ab main yahin se aapki dukaan ka hisaab bataunga." }], "menu", now);
      await checkKhataAlerts(db, merchant.id, { ...snap, merchant: { ...snap.merchant, waConnectedAt: now, waLastInboundAt: now } }, null, now);
    }
    await routeMessage(db, ch, merchant.id, m.from, m, ports, now);
  } catch (e) {
    console.error("[wa] inbound failed", e instanceof Error ? e.message : "unknown");
  }
}
