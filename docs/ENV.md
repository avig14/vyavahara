# Environment variables

One file for local (`.env.local`), one set in Vercel (Production). `.env.example` lists every variable.

## Check it

```
npm run env:check                       # .env.local
npm run env:check -- --prod             # production rules (https URL, long secrets)
vercel env pull .env.prod --environment production
npm run env:check -- --file=.env.prod --prod
```

It prints each service as ready / partial / off. It never prints a secret. Exit code 1 only if a required service
(database, app URL) is not ready. Everything else is optional: a service that is off just disables its feature.

## Services

| Service | Variables | If missing |
|---|---|---|
| Database (required) | `DATABASE_URL` | app does not work |
| App URL (required) | `APP_BASE_URL` (public https URL, no trailing `/`), `MERCHANT_UPI_ID` | webhooks and pay links break |
| Claude | `ANTHROPIC_API_KEY`, `CLAUDE_MODEL`, `CLAUDE_EFFORT` | menu works, typed questions get a fallback |
| Voice + bill reading (Sarvam) | `SARVAM_API_KEY`, `SARVAM_STT_MODEL`, `SARVAM_TTS_MODEL`, `SARVAM_TTS_SPEAKER` | Voice Saathi off; bill scan falls back to Claude |
| Bill reader choice | `BILL_OCR` (`sarvam` or `claude`; unset = Sarvam Vision when `SARVAM_API_KEY` is set, else Claude) | |
| Voice signing | `SOUNDBOX_SECRET` (falls back to `HASH_SALT`) | `/api/soundbox/speak` errors |
| WhatsApp, Twilio | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` (+ optional `TWILIO_*`) | falls back to Meta, else off |
| WhatsApp, Meta | `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET` | used only when Twilio is off |
| Call Saathi | `VOBIZ_AUTH_ID`, `VOBIZ_AUTH_TOKEN`, `VOBIZ_FROM_NUMBER`, `VOBIZ_WEBHOOK_SECRET`, `CALLS_CRON_SECRET`, `CALLS_ALLOWED_NUMBERS` | calls off |
| Dashboard preview | `PREVIEW_TURNS_PER_10_MIN` (default 120) | default used |
| Neon tooling | `NEON_API_KEY`, `NEON_PROJECT_ID` | only `npm run db:usage` needs them |

Do not set `HASH_SALT` on a database that already has hashed data: changing it breaks the old hashes.
`CALLS_ALLOWED_NUMBERS` is a demo guard: while it is set, Call Saathi dials only those numbers. Clear it for real merchants.

## Put a variable on Vercel

```
printf '%s' "value" | vercel env add NAME production --yes      # add (use --force to overwrite)
vercel env pull .env.prod --environment production --yes        # read back to verify
vercel redeploy <latest-production-url>                         # env changes apply on the next deploy
```

After a schema change run `npm run db:push` against the same `DATABASE_URL` before deploying.
