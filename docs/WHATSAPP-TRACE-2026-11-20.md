# WhatsApp "Hi" trace — 20 Nov 2026 (03:36 IST)

**Symptom:** owner sends `Hi` to the Twilio number and gets *"Standard auto-reply. You can send outbound messages via the Tryout UI or API, or customize the reply by configuring a custom webhook in the Tryout UI"*. The Vyavahāra menu never appears.

## Verdict

Two separate problems stacked on top of each other. Fixing the first reveals the second.

| # | Problem | Whose side | Fixable in code? |
|---|---|---|---|
| 1 | Twilio never called our webhook. The inbound webhook ("Auto-Reply: Custom") is not set in the Twilio Console, so Twilio's own default reply answers. | Twilio Console setting | No. Docs describe no API for it. One manual save. |
| 2 | Even with the webhook set, **a Twilio trial account cannot send free text over the API.** Twilio answers `21654 ContentSid Required`. Trial allows only Twilio's fixed templates. | Twilio trial limit | No. Needs an upgraded Twilio account (or Meta, once verified). |

## Evidence

**Twilio message log** (read-only API, UTC; IST = +5:30)

| Time (UTC) | Direction | Status | Detail |
|---|---|---|---|
| 21:32:59 | inbound `join twilio-trial` | received | error 12300 |
| 21:33:01 | outbound "Standard auto-reply…" | read | sent by Twilio's own default, not by us |
| 22:06:58 | inbound `Hi` (= 03:36:58 IST) | received | error 12300 |
| 22:07:00 | outbound "Standard auto-reply…" | read | sent by Twilio's own default, not by us |

**Vercel production logs** for the same minutes: no `POST /api/twilio/webhook` at 03:36:58 IST. The only webhook hits in the window are our own unsigned smoke tests (401) at 03:36:02. So the app was never reached.

- Error 12300 ("Invalid Content-Type") is attached to both inbound messages, including the `join` message sent before our endpoint existed. It comes from Twilio's default handler, not from our code. ([Twilio error 12300](https://www.twilio.com/docs/api/errors/12300))
- The auto-reply is Twilio's placeholder. The docs say to choose **Custom** under Auto-Reply settings and add a webhook. ([Try out WhatsApp](https://www.twilio.com/docs/usage/trials/try-out-whatsapp))

**Proof our side works** (03:39 IST): one Twilio-signed `Hi` posted to `https://vyavahara.vercel.app/api/twilio/webhook`.
- Signature accepted, empty 200 returned, message reached the router. Failing signatures return 401.
- The reply then failed at Twilio: `21654 "ContentSid Required"`. Replaying the same request with no `StatusCallback` fails the same way, so it is not our parameters.

**Why 21654** — Twilio trial docs: *"During your trial, you can only use or change the following parameters: `to`, `from`, `ContentSid`, `statusCallback`"*, *"You won't be able to write your own message"*, and *"Direct TwiML XML is not supported during response."* So a trial account has no way to send arbitrary text, by REST or by TwiML. ([Try out WhatsApp](https://www.twilio.com/docs/usage/trials/try-out-whatsapp), [Trial account](https://www.twilio.com/docs/usage/tutorials/how-to-use-your-free-trial-account))

The older sandbox page says free text is allowed inside the 24 h window. That does not apply to this account: the live API refused it with the owner's `Hi` only minutes old. ([Sandbox](https://www.twilio.com/docs/whatsapp/sandbox))

## What this means for the earlier plan

The earlier assumption "Twilio sandbox works today as the live channel" was wrong. Everything we built is tested, but on a **trial** account the bot can receive, and cannot answer.

## Fix paths

1. **Do now (needed on every path):** set the inbound webhook. Console → *Try out WhatsApp* → **Inbound** → Auto-Reply **Custom** → URL `https://vyavahara.vercel.app/api/twilio/webhook`, method POST. Status callback `https://vyavahara.vercel.app/api/twilio/status`.
2. **To get replies on a real phone, one of:**
   - **Upgrade the Twilio account.** Docs: after upgrade *"you can create your own custom WhatsApp message content"*; upgrade needs a profile, address, starting balance and payment details. Not yet verified: whether the sandbox sender keeps working after upgrade, or whether a registered WhatsApp sender (Meta business verification again) is required. Check before paying.
   - **Meta Cloud API** once business verification clears (error 131031 today). Code path is already built.
3. **Demo without any of that:** an in-dashboard WhatsApp-style simulator running the same router. Not built yet.

## Code changes made

- `src/lib/wa/twilio.ts`: error `21654` now maps to a plain Hinglish message ("Twilio trial account custom message nahi bhej sakta… upgrade karo") instead of a generic failure. Test added.

## Still true and verified

Signature check (matches Twilio's SDK), webhook route 401/200 behaviour, menu, flows, alerts, dedupe, daily cap: 304 mocked tests pass, and the live endpoint accepted a signed message.

## Security

The Twilio Auth Token was pasted in chat earlier. Rotate it after the demo, then update `.env.local` and Vercel.
