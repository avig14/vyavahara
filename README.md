# Vyavahāra (व्यवहार)

AI business assistant for Indian shop owners (Paytm Merchant Growth AI hackathon). Next.js 16 · Neon Postgres · Claude · Sarvam.

Design rules: the AI never calculates numbers (code does, AI only explains) · money is integer paise · all times IST · every threshold is merchant-tunable (`GET/PUT /api/settings`).

## Run locally

```bash
npm install
cp .env.example .env.local     # fill DATABASE_URL, ANTHROPIC_API_KEY, SARVAM_API_KEY
npm run db:push                # create tables in Neon
npm run seed                   # deterministic demo data (Gupta Kirana)
npm run dev
```

Checks: `npm test` · `npm run typecheck` · `npm run lint` · `npm run build`.
Tests use fakes: no database, Claude or Sarvam call is made.

## Deploy to Vercel

1. Push the repo, import it in Vercel (framework: Next.js; region `bom1` is set in `vercel.json`).
2. Storage → add **Neon** (Vercel Marketplace). It sets `DATABASE_URL`.
3. Add env vars (Production + Preview):

   | Name | Purpose |
   | --- | --- |
   | `DATABASE_URL` | Neon (set by the integration) |
   | `ANTHROPIC_API_KEY` | chat, bill/photo reading, soundbox parsing |
   | `CLAUDE_MODEL` | optional, default `claude-opus-5-5` |
   | `CLAUDE_EFFORT` | optional: low / medium / high / xhigh / max (default low) |
   | `SARVAM_API_KEY` | speech-to-text and voice announcements |
   | `MERCHANT_UPI_ID` | fallback UPI id for pay links |
   | `APP_BASE_URL` | public URL, used in PDF and pay links |
   | `HASH_SALT` | salt for hashing payer VPAs |

4. Create tables and demo data once from your machine, with the production `DATABASE_URL` in `.env.local`:
   `npm run db:push && npm run seed`.
5. Deploy. PDF fonts ship with the PDF route via `outputFileTracingIncludes` in `next.config.ts`.

## API

| Route | Notes |
| --- | --- |
| `GET/PUT/DELETE /api/settings` | merchant thresholds: read (with defaults), partial update, reset |
| `GET /api/dashboard/{overview,inventory,vendors,khata,reports,growth,customers}` | `?period=today\|yesterday\|this_week\|last_week\|this_month\|last_month\|last_7_days\|last_30_days\|custom` (+`from`,`to`) |
| `GET/POST /api/chat` | `{text}`; `1`/`2` answers a waiting confirmation, else the agent |
| `GET/POST /api/actions/[id]` | `{choice:"confirm"\|"cancel"}` for a pending action |
| `POST /api/onboarding/connect-paytm` | demo connect |
| `POST /api/soundbox/audio` | multipart `file` (WAV, ≤5 MB) or `{text}` (no STT cost) |
| `POST /api/soundbox/payment` | `{amountPaise, speak?}`; matches the held basket |
| `POST /api/reports/pdf` · `GET /api/reports/pdf/[token]` | mint a 7-day link · download the PDF |
| `POST /api/pay` · `GET/POST /api/pay/[token]` | khata pay link · page data · demo "mark paid" |
| `POST /api/whatsapp/send-report` | send today's analysis to the saved owner number (Meta Cloud API) |
| `GET /api/whatsapp/status` | configured?, masked number, 24h window, last sends with status |
| `POST /api/onboarding/whatsapp` | `{phone}` save the owner number |
| `GET/POST /api/whatsapp/webhook` | Meta handshake · delivery statuses + inbound menu bot (signature checked) |

## WhatsApp

Official Meta Cloud API, free test number, no Twilio. Setup, env vars, live demo script and the 24-hour rule: [docs/WHATSAPP-SETUP.md](docs/WHATSAPP-SETUP.md).
Unit-tested with mocked Meta responses; not yet run against live Meta (needs your credentials).

## Credit discipline

Claude and Sarvam calls cost money. Tests never call them. Prefer `{text}` over audio on the soundbox route while developing; `speak` is off by default.
