// End-to-end checks for the WhatsApp preview (/dashboard/whatsapp), driven over the DevTools protocol with Node's built-in WebSocket.
// Needs `npm run dev` running and Edge or Chrome installed. Usage: node scripts/e2e-whatsapp-preview.mjs
// Env: BROWSER=<path to msedge/chrome>, BASE_URL=http://localhost:3000. Screenshots go to the OS temp folder.
import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EDGE = process.env.BROWSER || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const URL_ = (process.env.BASE_URL || "http://localhost:3000") + "/dashboard/whatsapp";
const TMP = mkdtempSync(join(tmpdir(), "wa-e2e-"));
const OUT = TMP + "/";
const port = 9334;
const edge = spawn(EDGE, [`--remote-debugging-port=${port}`, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--user-data-dir=" + OUT + "profile", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function wsUrl() {
  for (let i = 0; i < 40; i++) {
    try {
      const t = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      const p = t.find((x) => x.type === "page");
      if (p) return p.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error("edge did not start");
}

const ws = new WebSocket(await wsUrl());
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
const consoleErrors = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) return pending.get(m.id)(m);
  if (m.method === "Runtime.exceptionThrown") consoleErrors.push("exception: " + (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text));
  if (m.method === "Log.entryAdded" && m.params.entry.level === "error") consoleErrors.push("log: " + m.params.entry.text + " " + (m.params.entry.url ?? ""));
};
const cmd = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => (await cmd("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;
const shot = async (name) => writeFileSync(OUT + name, Buffer.from((await cmd("Page.captureScreenshot", { format: "png" })).result.data, "base64"));

const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok: Boolean(ok), detail }); console.log((ok ? "PASS " : "FAIL ") + name + (detail ? "  -> " + detail : "")); };

const idleOld = () => ev(`(async()=>{ for(let i=0;i<200;i++){ if(!document.querySelector('.wsim-typing') && document.querySelector('.wsim-bubble')) { await new Promise(r=>setTimeout(r,500)); if(!document.querySelector('.wsim-typing')) return true; } await new Promise(r=>setTimeout(r,100)); } return false; })()`);
const idle = (minBots = null) => ev(`(async()=>{ const target=${minBots===null?'null':minBots}; for(let i=0;i<300;i++){ const n=document.querySelectorAll('.wsim-bot .wsim-bubble:not(.wsim-typing)').length; const typing=!!document.querySelector('.wsim-typing'); if((target===null? n>=1 : n>=target) && !typing){ await new Promise(r=>setTimeout(r,700)); const n2=document.querySelectorAll('.wsim-bot .wsim-bubble:not(.wsim-typing)').length; if(!document.querySelector('.wsim-typing') && n2===n) return true; } await new Promise(r=>setTimeout(r,100)); } return false; })()`);
const photoCount = () => ev(`document.querySelectorAll('.wsim-photo img').length`);
const photoOk = (min) => ev(`(async()=>{ for(let i=0;i<80;i++){ const im=[...document.querySelectorAll('.wsim-photo img')]; if(im.length>=${min} && im.every(x=>x.complete && x.naturalWidth>0)) return true; await new Promise(r=>setTimeout(r,150)); } return false; })()`);
const botCount = () => ev(`document.querySelectorAll('.wsim-bot .wsim-bubble:not(.wsim-typing)').length`);
const meCount = () => ev(`document.querySelectorAll('.wsim-me').length`);
const lastBotText = () => ev(`(()=>{const b=[...document.querySelectorAll('.wsim-bot .wsim-bubble:not(.wsim-typing)')]; return b.length? b[b.length-1].innerText : ''; })()`);
const clickText = (t, scope = ".wsim") => ev(`(()=>{const b=[...document.querySelectorAll('${scope} button')].find(x=>!x.disabled && x.textContent.includes(${JSON.stringify(t)})); if(!b) return false; b.click(); return true;})()`);

async function run(width, height, label) {
  await cmd("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 500 });
  await cmd("Page.navigate", { url: URL_ });
  await sleep(1500);
  check(`[${label}] opens and the bot greets by itself`, await idle() && (await botCount()) >= 1);
  check(`[${label}] greeting comes with the welcome photo`, await photoOk(1), "images " + (await photoCount()));
  check(`[${label}] greeting has the Menu button`, await ev(`!![...document.querySelectorAll('.wsim-actions button')].find(b=>b.textContent.includes('Menu dekhein'))`));
  const overflow = await ev(`document.scrollingElement.scrollWidth - window.innerWidth`);
  check(`[${label}] no horizontal scroll`, overflow <= 0, "overflow " + overflow + "px");
  const phoneW = await ev(`Math.round(document.querySelector('.wsim-phone').getBoundingClientRect().width)`);
  check(`[${label}] phone fits the screen`, phoneW <= width, phoneW + "px");
  return phoneW;
}

// ---- desktop ----
await cmd("Page.enable"); await cmd("Runtime.enable"); await cmd("Log.enable");
await run(1000, 1000, "desktop");
await clickText("Menu dekhein");
await sleep(400);
const rows = await ev(`document.querySelectorAll('.wsim-sheet-body button').length`);
check("list menu opens with 9 options", rows === 9, "rows " + rows);
await shot("e2e-list.png");
await clickText("✕", ".wsim-sheet");
await sleep(300);
check("list menu closes", (await ev(`!document.querySelector('.wsim-sheet')`)));

const rowTitles = ["Aaj ka poora report", "Sales report", "Customer report", "Supplier report", "Suggestions", "Stock", "Udhaar (khata)", "Supplier payments", "PDF report"];
for (const title of rowTitles) {
  if (!(await ev(`!![...document.querySelectorAll('.wsim-actions button')].find(b=>b.textContent.includes('Menu dekhein') && !b.disabled)`))) {
    await clickText("Menu", ".wsim-actions");
    await idle((await botCount()) + 1);
  }
  const bots = await botCount();
  const photosBefore = await photoCount();
  await clickText("Menu dekhein");
  await sleep(250);
  const clicked = await clickText(title, ".wsim-sheet-body");
  const done = await idle(bots + 1);
  const text = await lastBotText();
  const nb = (await botCount()) - bots;
  const bad = /undefined|\[object|NaN|null/.test(text) || /\*/.test(text);
  check(`menu row "${title}" answers`, clicked && done && nb >= 1 && text.length > 15 && !bad, `${nb} bubble(s), ${text.length} chars${bad ? " BAD TEXT: " + text.slice(0, 80) : ""}`);
  const wantsPhoto = ["Aaj ka poora report", "Udhaar (khata)", "Stock"].includes(title);
  const photosAfter = await photoCount();
  if (wantsPhoto) {
    check(`  "${title}" comes with exactly one new photo card that loads`, photosAfter - photosBefore === 1 && (await ev(`(async()=>{ for(let i=0;i<80;i++){ const im=[...document.querySelectorAll('.wsim-photo img')].pop(); if(im && im.complete && im.naturalWidth>=1000) return true; await new Promise(r=>setTimeout(r,150)); } return false; })()`)), `photos +${photosAfter - photosBefore}`);
  } else {
    check(`  "${title}" sends no photo`, photosAfter === photosBefore, `photos +${photosAfter - photosBefore}`);
  }
  const btns = await ev(`document.querySelectorAll('.wsim-actions button:not(:disabled)').length`);
  check(`  buttons under "${title}" reply`, btns >= 1 && btns <= 3, btns + " buttons");
}

// double tap while busy must not double-send
const meBefore = await meCount();
const bb = await botCount();
const had = await ev(`(()=>{const b=[...document.querySelectorAll('.wsim-actions button:not(:disabled)')].find(x=>x.textContent.includes('Suggestions')||x.textContent.includes('Sales')); if(!b) return false; b.click(); b.click(); b.click(); return true;})()`);
check("a button was available to double-tap", had);
await idle(bb + 1);
const meAfter = await meCount();
check("rapid taps while the bot is answering are ignored", meAfter - meBefore === 1, "sent " + (meAfter - meBefore));

// typed messages
async function type(text) {
  await ev(`(()=>{const i=document.querySelector('.wsim-form input'); const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; s.call(i, ${JSON.stringify(text)}); i.dispatchEvent(new Event('input',{bubbles:true})); return 1;})()`);
  await sleep(150);
  const before = await botCount();
  await ev(`document.querySelector('.wsim-form button').click()`);
  await idle(before + 1);
  return lastBotText();
}
check("send button is disabled when the box is empty", await ev(`document.querySelector('.wsim-form button').disabled`));
const t1 = await type("aaj kitni sale hui");
check('typed "aaj kitni sale hui" gets the daily report', /report/i.test(t1), t1.slice(0, 60).replace(/\n/g, " "));
const t2 = await type("kya khatam hone wala hai");
check('typed "kya khatam hone wala hai" gets the stock list', /Stock|khatam|nahi hai/i.test(t2), t2.slice(0, 60).replace(/\n/g, " "));
const t3 = await type("mausam kaisa hai");
check("unknown text gets a polite fallback", /samajh nahi paya|menu/i.test(t3), t3.slice(0, 80));
const t4 = await type("sales week");
check('typed "sales week" gets the weekly sales report', /Sales report/.test(t4) && /Is hafte/.test(t4), t4.slice(0, 50).replace(/\n/g, " "));
check("sales buttons offer the other periods", await ev(`[...document.querySelectorAll('.wsim-actions button:not(:disabled)')].map(b=>b.textContent).join('|').includes('Is mahine ki')`));
await shot("e2e-chat.png");

// reset
await clickText("Naya chat");
await sleep(300);
await idle();
check("Naya chat clears and restarts", (await meCount()) === 1 && (await botCount()) >= 1, "me " + (await meCount()));

// ---- mobile ----
await run(390, 800, "mobile");
await clickText("Menu dekhein");
await sleep(300);
await shot("e2e-mobile-list.png");
{ const b0 = await botCount(); await clickText("Customer report", ".wsim-sheet-body"); await idle(b0 + 1); }
const tap = await ev(`Math.min(...[...document.querySelectorAll('.wsim-actions button')].map(b=>b.getBoundingClientRect().height))`);
check("tap targets are at least 44px tall", tap >= 44, Math.round(tap) + "px");
await shot("e2e-mobile-chat.png");

check("no console errors or exceptions", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
console.log("screenshots in", TMP);
ws.close();
edge.kill();
process.exit(failed.length ? 1 : 0);
