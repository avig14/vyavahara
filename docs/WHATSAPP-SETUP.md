# WhatsApp setup (Meta Cloud API, free test number)

Vyavahāra talks to WhatsApp through Meta's official Cloud API. No Twilio, no paid number, no WhatsApp Web automation.
Cost for the demo: zero. The test number can message up to 5 recipient numbers.

> **Status:** the code is unit-tested against mocked Meta responses (request shape, error mapping, signature check, webhook parsing, status ordering).
> It has **not** been run against live Meta, because that needs your Meta credentials. Do the live test below before the demo.

## What it does

| Where | What |
|---|---|
| Reports page, **Send Report on WhatsApp** | Sends today's analysis: sales, trend, profit, stock to order, overstock, slow movers, udhaar, supplier dues, suggestions. Same numbers as the dashboard and PDF. |
| Same card | Number entry, 24-hour chat indicator, last messages with status: Bhej rahe hain → Bhej diya → Pahunch gaya → Padh liya, or Nahi gaya with the reason. |
| Phone, after webhook is set | Owner writes **Hi** and gets a menu: 1 report, 2 stock, 3 udhaar, 4 suppliers, 5 PDF link. Any other question goes to the same AI agent as the dashboard chat. A waiting 1/2 confirmation still works. |

Menu answers cost nothing (no AI call). Expiry alerts are not included: this app does not track expiry dates, and nothing is invented.

## The 24-hour rule (important for the demo)

WhatsApp only allows free-form messages within 24 hours of the owner's last message to you. Outside that window Meta rejects them (error 131047).

- The dashboard tries the report first. If Meta says the window is closed it sends Meta's pre-approved `hello_world` template instead and tells you to reply **Hi** on your phone, then press Send again.
- So before the demo: **send "Hi" from your phone to the test number.** Then the report goes through directly.
- The card shows "Chat khula hai ... tak" only after the webhook is set (it learns about your Hi from the webhook).

## Manual steps (about 15 minutes)

1. **Meta developer account and app.** Go to developers.facebook.com, log in, *Create app*, use case *Connect with customers through WhatsApp* (Business type). Add the **WhatsApp** product.
2. **Test number.** Open *WhatsApp → API Setup*. Meta gives you a free test number. Copy its **Phone number ID** (not the number itself) → `WHATSAPP_PHONE_NUMBER_ID`.
3. **Add and verify your recipient.** On the same page, under *To*, add your own WhatsApp number. Meta sends a code to your WhatsApp. Enter it. Only verified numbers can receive (error 131030 otherwise).
4. **Token.**
   - Quick: copy the *Temporary access token* from API Setup → `WHATSAPP_ACCESS_TOKEN`. It **expires in about 24 hours**.
   - Demo-safe: Business Settings → Users → *System users* → add one → assign your app (full control) → *Generate token* with `whatsapp_business_messaging` and `whatsapp_business_management`, never expires. Use this one.
5. **Put them in `.env.local`** (and in Vercel → Project → Settings → Environment Variables for the deployed site):
   ```
   WHATSAPP_ACCESS_TOKEN=...
   WHATSAPP_PHONE_NUMBER_ID=...
   ```
   Optional `WHATSAPP_API_VERSION` (default `v27.0`). Restart `npm run dev` after editing.
6. **Save your number in the dashboard.** Reports page → WhatsApp card → type your number (10 digits is fine) → *Number save karo*.
7. **Send Hi** from your phone to the test number (opens the 24-hour window).
8. Press **Send Report on WhatsApp**.

### Optional: webhook (delivered/read ticks and the inbound menu)

Needs a public HTTPS address. Use the Vercel deployment, or locally `npx cloudflared tunnel --url http://localhost:3000` (or ngrok).

1. Set `WHATSAPP_VERIFY_TOKEN` to any random string you choose and `WHATSAPP_APP_SECRET` to your app's secret (App Dashboard → *App settings → Basic → App secret*). Add both to env, redeploy/restart.
2. Also set `APP_BASE_URL` to the public address (used for PDF links).
3. App Dashboard → *WhatsApp → Configuration → Webhook → Edit*: Callback URL `<public address>/api/whatsapp/webhook`, Verify token = your `WHATSAPP_VERIFY_TOKEN`. *Verify and save*.
4. Under *Webhook fields*, **subscribe to `messages`**.
5. Production refuses webhook posts if `WHATSAPP_APP_SECRET` is missing. Posts with a wrong signature get 401.

Without the webhook, sending still works. Status stops at "Bhej diya" and the inbound menu is off.

## Live demo script (3 minutes)

1. Phone: send **Hi** to the test number. (Webhook on: you get the menu.)
2. Dashboard → Reports → WhatsApp card. Number shows as `91••••••1234`.
3. Press **Send Report on WhatsApp**. Badge goes Bhej rahe hain → Bhej diya, then Pahunch gaya → Padh liya once you open it.
4. On the phone read the report. Reply **2** for stock, **3** for udhaar, **5** for the PDF link, or ask "aaj kitni sale hui?".
5. Failure demo (optional): remove the token from env and press Send. The card shows the plain reason.

## Errors you may see

| Card says | Cause | Fix |
|---|---|---|
| WhatsApp set up nahi hai | token or phone number ID missing | step 5 |
| Yeh number test list mein nahi hai (131030) | recipient not verified | step 3 |
| Access token expire ho gaya (190) | temporary token ran out | System User token, step 4 |
| 24 ghante se zyada ho gaye (131047) | window closed | send Hi from phone, press Send again |
| Number sahi nahi lag raha | bad number typed | 10-digit mobile or full number with country code |
| Bahut zyada messages gaye (rate) | Meta rate limit | wait a few minutes |

## Env vars

| Var | Needed for |
|---|---|
| `WHATSAPP_ACCESS_TOKEN` | sending |
| `WHATSAPP_PHONE_NUMBER_ID` | sending |
| `WHATSAPP_VERIFY_TOKEN` | webhook handshake |
| `WHATSAPP_APP_SECRET` | webhook signature check |
| `WHATSAPP_API_VERSION` | optional, default `v27.0` |
| `APP_BASE_URL` | PDF links in the bot |

Tokens are read only on the server. The browser never sees them, and they are never logged.

## Beyond the free test number

Messaging real customers or anyone outside the 5-number list needs a real WhatsApp Business number, business verification and approved templates (for example a daily-report template so it can message outside the 24-hour window). The code path is the same: only the Phone Number ID and token change, and a template send would replace the `hello_world` fallback in `src/lib/wa/send.ts`.
