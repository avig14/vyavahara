# Call Saathi (reminder calls via Vobiz)

When a customer's udhaar is older than the merchant's threshold, Call Saathi phones them with a short Hinglish reminder. Branch: `call-saathi`.

## How it works

1. `POST /api/calls/run` (Bearer `CALLS_CRON_SECRET`; trigger by hand or Vercel Cron) loads the snapshot and picks customers with `selectCallCandidates` (`src/lib/calls/select.ts`).
2. A customer is called only if all hold: `settings.calls.enabled`, inside calling hours (IST), oldest unpaid credit ≥ `minOverdueDays`, balance ≥ `minOutstandingPaise`, has `phone` **and** `call_consent`, fewer than `maxAttempts` calls, and `retryGapDays` since the last one (7 days after a "will pay").
3. For each, a `call_attempts` row is created and Vobiz is asked to dial (`POST /api/v1/Account/{id}/Call/`) with `answer_url` / `hangup_url` pointing at this app.
4. On pickup Vobiz fetches `/api/vobiz/answer` and gets VobizXML: a spoken reminder plus `<Gather>`. **1** = will pay, **2** = shop should call back, anything else = no response. `/api/vobiz/gather` records it, `/api/vobiz/hangup` closes the attempt.
5. Amounts and days in the script come from code, never from the AI.

Settings (tunable via `PUT /api/settings`, key `calls`): `enabled` (default **off**), `minOverdueDays` 30, `minOutstandingPaise` 50000, `maxAttempts` 3, `retryGapDays` 3, `fromHour` 10, `untilHour` 19, `maxCallsPerRun` 10.

## Dashboard: Call Saathi screen

Nav item "Call Saathi" (`/dashboard/calls`, built on the `sudhir` frontend). The merchant sets:

- **Kitne din baad pehli call**: `calls.minOverdueDays` (call once udhaar is this many days old).
- **Dobara kab call karein**: `calls.retryGapDays`, as presets Daily (1) / Alternate days (2) / Weekly (7) / Custom (1-30).
- Max calls per customer, smallest balance, calling hours (any window the merchant picks, IST), master on/off switch.

Below the rules: every customer with udhaar, with an editable phone, a consent switch and why they will / will not be called now, then the recent call log (outcomes: will pay, wants a call back, no response, did not pick up). Same keys also appear under Settings → Call Saathi. API: `GET/PUT /api/dashboard/calls`, thresholds via `PUT /api/settings {calls:{…}}`.

## Set up Vobiz (one time)

1. Console → complete **KYC** (https://console.vobiz.ai/app/kyc). Indian numbers need it.
2. Buy a DID. For reminders of money owed use a **160-series** (service) number, never 140 (promotional).
3. Copy **Auth ID** (`MA_...`) and **Auth Token** from the dashboard into `.env.local` / Vercel (see `.env.example`).
4. Generate two long random strings for `VOBIZ_WEBHOOK_SECRET` and `CALLS_CRON_SECRET`.
5. `npm run db:push` (adds `customers.phone`, `customers.call_consent`, `call_attempts`).
6. Give one test customer your own number and consent:
   `update customers set phone='91XXXXXXXXXX', call_consent=true where name='...';`
7. Turn it on: `PUT /api/settings {"calls":{"enabled":true,"minOverdueDays":1}}` for the demo.

## Try it

```bash
# 1. who WOULD be called (no calls, no DB writes)
curl -X POST "$APP_BASE_URL/api/calls/run?dry=1" -H "Authorization: Bearer $CALLS_CRON_SECRET"
# 2. rehearse the whole flow without dialing: VOBIZ_SEND_MODE=dry
# 3. real call
curl -X POST "$APP_BASE_URL/api/calls/run" -H "Authorization: Bearer $CALLS_CRON_SECRET"
```

Vobiz must reach the webhooks, so use the deployed URL or a tunnel (set `APP_BASE_URL` to it).

## Demo checklist (call your own phone)

1. **Public URL.** Vobiz must reach the webhooks. Without deploying, tunnel the dev server:
   `ssh -R 80:localhost:3000 nokey@localhost.run` and copy the `https://….lhr.life` address it prints (it changes every start).
2. Put it in `.env.local` as `APP_BASE_URL=https://….lhr.life` (the dev server reloads it). Needs `VOBIZ_*` and `VOBIZ_WEBHOOK_SECRET` too.
3. On `/dashboard/calls`, type **your** number (the one verified on the Vobiz account) on one customer and switch on "Call ki ijazat". Trial accounts only reach the verified number.
4. Calling hours are enforced: set them under "Aur options" (earliest 9 am, latest 9 pm IST). Outside them the call is refused on purpose.
5. Press **Abhi call karo** on that row, or say to Voice Saathi: "<customer> ko reminder call karo", then "haan".
6. Answer, press 1 / 2 / 3. The row appears under **Call history** with the outcome and talk time (refreshes by itself).

Each call costs about ₹0.38 (60 s minimum). Keep a rehearsal to one or two calls.

## Compliance (India), do not skip

- Reminder calls need the customer's consent (`call_consent`), a DLT/TRAI-compliant number series, and calling hours chosen by the merchant (Vyavahara does not cap them; check TRAI rules for your call type).
- Both legs must be in India or Vobiz rejects the call (`violates_media_anchoring`).
- The script says it is an automated call. Keep it polite; no threats, no calls to third parties.

## Verified on a live call (2026-11-20, trial account)

- Outbound call, `answer_url` XML with `<Speak>` + `<Gather>`, keypress and hangup all work end to end. Webhooks arrive **form-encoded**; the keypress field is `Digits`; hangup carries `CallStatus`, `BillDuration`, `BillRate`.
- Billing: the 60 s minimum block, about ₹0.38 per call.
- **Do not enable `machine_detection`**: it hung up on a human within 5 s ("Machine Detected"). It is now opt-in (`machineDetection: true`).
- Trial account caller ID is the shared number +918065354620; trial calls go to the account's verified number.
- `scripts/call-test.ts <publicUrl> <number>` places one test call without a database.

## Not verified yet

- Whether the `hi-IN` voice sounds good in Hinglish (judge by ear; if poor, go to Phase 2).
- Behaviour for unverified customer numbers on a trial account, and the DID/KYC route for production.

## Phase 2 (planned): live conversation

Replace the keypad menu with a talking agent: answer XML returns `<Stream bidirectional="true" contentType="audio/x-l16;rate=16000">wss://…</Stream>`; a small Node WebSocket server (Vercel cannot hold sockets, so Fly/Railway) pipes caller audio → Sarvam STT → Claude (khata tools) → Sarvam TTS → `playAudio`, with `clearAudio` for barge-in. The `sudhir` branch already has the Sarvam speech-to-speech turn logic in `src/lib/soundbox/voice.ts` to reuse.

## Two homes, same code

- **This app** (branch `Vinamra`): the full dashboard plus Voice Saathi ("<customer> ko reminder call karo"). When it is deployed it needs the `VOBIZ_*`, `VOBIZ_WEBHOOK_SECRET`, `CALLS_CRON_SECRET` and `CALLS_ALLOWED_NUMBERS` variables and `APP_BASE_URL` set to its own public https address, which Vobiz uses for the answer/hangup webhooks. Preview deployments behind Vercel login block Vobiz, so use production or disable protection.
- **Standalone** (private repo `vyavahara-calling-agent`, live on Vercel): only the Call Saathi page and webhooks, with a dashboard password. It shares this app's Neon database and the `src/lib/calls/*` code.
- Calls are placed with the webhook address of whichever app triggers them, so each app works on its own once it is public.
