# Vyavahāra (व्यवहार) — Build To-Do (PRD v2, no marketing)

Source of truth: `../PRD_v2_no-marketing.md`. Status: [x] done · [ ] todo · [!] waiting on user.

## C0 Foundation
- [x] Next.js 16 app (TS, Tailwind v4, App Router, src/), Cache Components OFF
- [x] Deps: anthropic sdk, zod, drizzle + neon, twilio, react-pdf, qrcode, fuse, seedrandom, vitest
- [x] `vercel.json` (region bom1), `drizzle.config.ts`, `.env.example`
- [x] `vitest.config.ts`, npm scripts (seed, db:push, test, typecheck)

## C1 Database
- [x] `lib/db/schema.ts` (all B4 tables, money in paise)
- [x] `lib/db/client.ts` (neon-http, lazy)

## C2 Core helpers
- [x] `lib/format.ts` (₹ en-IN), `lib/time.ts` (IST periods), `lib/domain.ts` (Snapshot types), `lib/hash.ts`

## C3 Demo data (B5)
- [x] `lib/seed/catalog.ts` + `generate.ts` pure deterministic generator (120 days, 12 stories)
- [x] `scripts/seed.ts` + `lib/seed/write.ts` (needs DATABASE_URL to run for real)
- [x] test: every story is true after generation (15 tests green)
- [x] cash story: demo shop has ₹8,000 cash float (a merchant setting) → shortfall ≈ ₹2.5k on 22 Nov

## C4 Data access
- [x] `lib/db/queries.ts` load snapshot + merchant writes (udhaar, payment, expense, stock, PO, settings) — untested vs live DB (no DATABASE_URL)

## C5 Analytics (pure, tested)
- [x] `lib/settings.ts` merchant-tunable thresholds (jsonb on merchants; all analytics read `snap.settings`)
- [x] forecast (4 models + backtest) · cashflow · khata-risk · festival (52 tests green)
- [x] anomalies · recommendations · segments · gst · loan (each reads merchant settings; 74 tests green)

## C6 Reports
- [x] `reports/build.ts` · `text.ts` · `pdf.tsx` (+ salesHeatmap; Noto Sans TTF in assets/fonts for ₹; 85 tests green). NOTE C10: add outputFileTracingIncludes for assets/fonts on the PDF route

## C7 Ingest
- [x] `ingest/sarvam.ts` (saaras:v4 STT, bulbul:v3 TTS, cached; PRD names were stale) · `vision.ts` · `match.ts` · `reconcile.ts` (all tolerances in settings.ingest)

## C8 Agent
- [x] `agent/` tools (29, P0+P1) · prompt · `runAgent` (toolRunner) · `actions.ts` (1/2 confirm, udhaar guard) · `store.ts` port · queries: pending, receiveBill, addCashSale (121 tests green)

## C9 API routes
- [x] `GET/PUT/DELETE /api/settings` (merchant customizes thresholds; UI form waits for UI approval)
- [x] dashboard/* (7) · chat · actions/[id] (atomic claim) · onboarding/connect-paytm · soundbox/audio+payment (held basket → item-level sale) · reports/pdf + [token] · pay + [token]. 132 tests, tsc/lint/build clean. NOT built: onboarding/whatsapp + webhook (WhatsApp, ask first). Live Neon DB verified (project vyavahara, schema pushed, seeded; routes smoke-tested). Claude calls untested (no ANTHROPIC_API_KEY).

## C10 Deploy readiness
- [x] `npm run build` clean · lint clean · outputFileTracingIncludes for assets/fonts
- [x] README with Vercel + Neon steps · `.env.example` checked

## BLOCKED — needs user answer
- [x] **UI** built with Hallmark (app + page scope) + Paytm tokens: foundation kit, Overview(rozmel)/Reports, Stock/Suppliers, Khata/Customers/Pay, Growth/Saathi chat/Soundbox, Landing/Onboarding/Privacy, Settings (all thresholds). 13 routes 200, sloplint --render clean at 1280/390, tsc/eslint/vitest(132)/build clean.
- [x] **Bill photo accept/reject** (Suppliers → "Bill scan karo"): `POST /api/bills/scan` reads the photo (Claude vision) and parks a 30-min pending `stock_in`; owner sees the review (supplier, bill no, dates, lines vs catalog, sum vs printed total, problems) and taps Accept (`POST /api/actions/{id}` confirm) or Reject and retake (cancel). Nothing saved before Accept. Blocked (retake only): unknown supplier, duplicate invoice, no matching items, no total. Tunable: `ingest.billMinMatchPct`. Photo shrunk in browser (~1600px) for Vercel's 4.5 MB body cap. Tested with mocks only (146 tests); not yet run against live Claude. Bill qty/rate are in bill units, no pack conversion yet.
- [ ] UI states still unverified live: PDF button, custom date range, connect-Paytm, pay token states, chat send/confirm, settings PUT/DELETE, per-field server errors.
- [x] Soundbox privacy fix: `other` (personal talk) discarded, never stored (PRD).
- [x] **WhatsApp (Meta Cloud API direct, replaces Twilio in the PRD)**: `src/lib/wa/` (cloud client, digest, send service with 24h-window template fallback, inbound router), `wa_messages` table, routes `/api/whatsapp/{send-report,status,webhook}` + `/api/onboarding/whatsapp`, Reports-page card (number entry, Send button, delivery status). Setup: `docs/WHATSAPP-SETUP.md`. 32 mocked tests; routes curl-checked (handshake, signature 401, 503, 400); UI screenshot-checked. **NOT live-tested against Meta** (no credentials). No expiry alerts: expiry is not tracked. Still to do: daily scheduled send, approved report template for outside the 24h window.
- [x] **WhatsApp agent on Twilio (live channel; Meta outbound blocked by 131031, business verification in review)**: `src/lib/wa/{twilio,channel,router,alerts,media-text}.ts`, `src/lib/menu/{menus,flows}.ts`, routes `/api/twilio/{webhook,status}`, `WaJoin` QR/number connect card (onboarding + Reports). Covers PRD A6 menu tree (27 leaves), udhaar/stock/PO/pay flows with 1/2 confirm, voice notes (Sarvam), bill photo + payment screenshot, PDF as own media message, free-text agent, proactive red-khata alert (merchant settings: on/off, hours, cool-down; queued outside 24h window), MessageSid dedupe, 50/day trial cap guard. Alert check runs after dashboard loads. ~300 mocked tests, zero API credits. Setup: `docs/WHATSAPP-SETUP.md`. **Not yet run live against Twilio** (do the 6-step live check). Still open: UNDO handler (P1), Content Template list pickers (P1, numbered text is the fallback), real PDF size limit + media-download auth unverified, rotate Twilio Auth Token after the demo.
