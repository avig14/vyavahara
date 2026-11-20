# WhatsApp setup (Twilio sandbox first, Meta Cloud API as fallback)

> **No chat account yet? Use the preview.** `/dashboard/whatsapp` is a WhatsApp-style chat that runs the same router as the bot (the 5-module menu, the sales / customer / supplier / suggestion reports, the agent) against live data. Nothing is sent to any provider, so it needs no credentials. `POST /api/whatsapp/simulate {text}` is the route behind it. The preview is read-only by design: it never answers a waiting 1/2 confirmation, never writes to the shop data and the agent cannot write. Browser check: `npm run dev`, then `node scripts/e2e-whatsapp-preview.mjs` (needs Edge or Chrome).

Vyavahāra's WhatsApp agent runs on **Twilio** (the channel the PRD names). The Twilio sandbox needs no business verification, but a trial account cannot send free text (see the note below).
The Meta Cloud API path is still in the code and takes over only if the Twilio env vars are empty.

> **READ FIRST (20 Nov 2026):** a Twilio **trial** account can receive messages but cannot send free text (error 21654, only Twilio's fixed templates). The bot can answer only after the Twilio account is upgraded, or on Meta once verified. Full trace and fix paths: `docs/WHATSAPP-TRACE-2026-11-20.md`. Also: the inbound webhook must be set in the Console (step 3) or Twilio sends its own "Standard auto-reply".
>
> **Status:** every branch is unit- and flow-tested with fake Twilio/Sarvam/Claude (signature check against Twilio's own SDK, send request shape, error mapping, the whole menu, voice, photo, PDF, alerts, dedupe).
> It has **not** been run against live Twilio yet. Do the 5-minute live check below first.

## What the owner gets on WhatsApp

| Send | Bot does |
|---|---|
| `Hi` / `Menu` / `0` | Main menu: 1 Stock · 2 Sales and profit · 3 Khata · 4 Suppliers and orders · 5 Reports |
| `1`…`5`, then a number | The PRD A6 tree (27 options). Lists and numbers come from code, not AI. No cost. |
| `9` | Back to the main menu |
| `PDF bhejo`, `week ka pdf` | Short text, then the PDF as its own message |
| `Suresh 300` / `Ramesh 500 mila` (after 3.2) | Writes udhaar or payment. Risky udhaar asks `1` = haan, `2` = nahi first |
| A voice note | Sarvam turns it into text, then it is handled like typing. Bot first says what it heard |
| A supplier bill photo | Reads it, shows what it found, asks `1`/`2` before stock changes |
| A payment screenshot | Checks it against Paytm records. Not found says "record mein nahi mila", never "fraud" |
| Any other sentence | The same AI agent as the dashboard chat (needs `ANTHROPIC_API_KEY`) |
| Proactive | A customer turns red → one alert with `1` block udhaar, `2` reminder, `3` ignore. Rules (on/off, hours, cool-down) are merchant settings |

## The rules Twilio sets (the code already follows them)

- **Sandbox join.** The owner sends the join phrase once (`join twilio-trial` for this account). It expires after 3 days of silence: send it again.
- **24-hour window.** Free text and PDFs only inside 24 h of the owner's last message. Outside it Twilio errors 63016 and the bot says so. A proactive alert then waits and is shown on the owner's next message.
- **Trial cap: 50 messages per rolling 24 h** (error 63038). The bot stops at `TWILIO_DAILY_CAP` (default 40) so a demo never dies mid-sentence.
- **Message size:** 1,600 characters max. Long answers are split at 1,500.
- **A PDF goes alone** (WhatsApp drops text sent with a document), so the text comes first.

## Setup (about 10 minutes)

1. **Join the sandbox.** Twilio Console → *Messaging → Try it out → Send a WhatsApp message*. From the owner's phone send the join phrase to the sandbox number.
2. **Env vars** (`.env.local` and Vercel → Settings → Environment Variables):
   ```
   TWILIO_ACCOUNT_SID=AC...
   TWILIO_AUTH_TOKEN=...
   TWILIO_WHATSAPP_FROM=+17372508034      # the sandbox number
   APP_BASE_URL=https://vyavahara.vercel.app
   ```
   Restart `npm run dev` or redeploy after editing. Never paste the token into chat or commit it.
3. **Inbound webhook.** Console → *Messaging → Try it out → Send a WhatsApp message → Sandbox settings*.
   - *When a message comes in:* `https://vyavahara.vercel.app/api/twilio/webhook` (method **POST**)
   - *Status callback URL:* `https://vyavahara.vercel.app/api/twilio/status` (method **POST**)
   - Save. (This is the sandbox page, not the "Senders" page.)
4. **Save the owner's number** in the dashboard (Reports page or onboarding, step 3).
5. **Connect.** Scan the QR in onboarding or on the Reports page. WhatsApp opens with the join phrase pre-filled. Press Send, then write `Hi`. The page flips to "✅ WhatsApp connected".

If the webhook URL is wrong or the signature check fails, the route answers 401 and nothing reaches the bot. The check uses `APP_BASE_URL`. If you test through a tunnel, set `TWILIO_WEBHOOK_BASE` to the tunnel URL.

## Live check (use about 10 of the free messages)

1. `Hi` → main menu.
2. `1` → stock module, then `3` → items to order.
3. `9`, then `5`, then `4` → PDF arrives as its own message.
4. Send a short voice note ("aaj ki sale kitni hui") → "🎙️ Suna: …" then the answer.
5. Send a photo of a supplier bill → review with 1/2.
6. Dashboard → Reports → **Send Report on WhatsApp**.

Things only a live run can confirm: Twilio's real PDF size limit, media download auth, and whether Content Templates (list pickers) work on the trial. Numbered text is the fallback and already works.

## Rehearse without sending anything

`TWILIO_SEND_MODE=dry` makes the bot log replies instead of calling Twilio. Tests always use a fake channel.

## Errors you may see

| Message on card | Cause | Fix |
|---|---|---|
| WhatsApp abhi set up nahi hai | Twilio vars missing | step 2 |
| Yeh number sandbox se jud nahi hai (63015) | not joined, or 3-day join expired | send the join phrase again |
| 24 ghante se zyada ho gaye (63016) | window closed | owner sends `Hi`, then Send again |
| Roz ki message limit poori (63038) | trial cap | wait for the rolling 24 h |
| Twilio Auth Token galat hai | wrong or rotated token | update env and redeploy |
| Twilio trial account custom message nahi bhej sakta (21654) | trial accounts allow only Twilio templates | upgrade the Twilio account |

## Env vars

| Var | Needed for |
|---|---|
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` | everything (all three) |
| `APP_BASE_URL` | signature check, PDF and pay links, delivery status callback (must be public https) |
| `TWILIO_SANDBOX_JOIN_CODE` | optional, default `join twilio-trial` |
| `TWILIO_SEND_MODE=dry` | optional rehearsal |
| `TWILIO_DAILY_CAP` | optional, default 40 |
| `TWILIO_WEBHOOK_BASE` | optional, when Twilio calls a different host than `APP_BASE_URL` |
| `SARVAM_API_KEY` | voice notes |
| `ANTHROPIC_API_KEY` | photos and free-text questions |

Secrets are read only on the server and never logged.

## Meta Cloud API (fallback)

Used only when the Twilio vars are empty. Needs `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID`, and for the inbound bot also `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET` and the webhook `<APP_BASE_URL>/api/whatsapp/webhook` (subscribe to `messages`).
The Meta path supports text only (no PDF files). On this project Meta outbound is currently blocked (error 131031, business verification in review), which is why Twilio is the live channel.

## Beyond the sandbox

For real customers or an always-on number you need a Twilio WhatsApp sender with a registered business profile and approved templates. Code stays the same; only the sender number changes, and a template send would replace the "owner must write first" rule for proactive alerts.
