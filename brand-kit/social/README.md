# Vyavahāra social, favicon and WhatsApp-bot assets

WhatsApp and social platforms need **raster images (PNG)**, not SVG. Cards that carry text (amounts, names) are therefore **HTML templates rendered to PNG**, using the site's fonts (Figtree + Noto Sans Devanagari, in `fonts/`, both OFL licensed). Artwork is reused from `../source/` and the logo from `../brand/`.

All amounts, names and shops in `samples.json` and `png/` are **sample data** (cards show a "Sample data" tag). Real messages leave `note` empty.

## WhatsApp bot message cards (`templates/wa-*.html` → `png/wa-*.png`)
| Template | Size | Send when | Placeholders |
|---|---|---|---|
| `wa-payment-received` | 1080×720 | A UPI soundbox payment arrives (new rozmel line) | `amount items time total note` |
| `wa-daily-hisaab` | 1080×1080 | User asks "aaj ka hisaab" (or end of day) | `date total upi cash udhaar low note`, rows `r1..r5` × (`_time _items _by _cls _amt`); `_cls` is `cash` for cash rows, empty for UPI |
| `wa-udhaar-reminder` | 1080×900 | Khata flags a late udhaar; Saathi's drafted reminder to approve | `customer amount days shop note` |
| `wa-stock-alert` | 1080×900 | Stock is low; Saathi's drafted supplier order to approve | `item left meter supplier qty note` (`meter` = % of stock left, 0-100) |
| `wa-welcome` | 1080×1000 | First message / "hi" to the bot | `note` |
| `profile-whatsapp` | 640×640 | WhatsApp Business profile picture: full logo on white (circle-cropped by WhatsApp) | none |

Send as an image message with a short text caption; keep the actionable question ("Bhejun?", "haan likhein") in the caption/text too so users can reply.

### Rendering from the bot
- Local/dev: `py -3.11 render.py <template> data.json out.png` (needs Edge or Chrome). Without arguments it renders everything with `samples.json` into `png/`.
- In a server bot: do the same with Puppeteer/Playwright (or satori). Replace `{{name}}` with HTML-escaped values and screenshot a viewport of the size in the template's `<meta name="size">`. Wait for fonts to load; fonts are loaded from `fonts/` via relative URLs.
- Hinglish copy lives in the templates; edit the HTML to change wording.

## Social posts (1080×1080 PNG, `templates/post-*.html`)
| File | Use |
|---|---|
| `png/post-hero.png` | Launch/intro post: headline + hero art |
| `png/post-after-payment.png` | Explainer: what Vyavahāra does after each payment |
| `png/post-ask-saathi.png` | Feature post: Saathi chat example (sample amounts, labelled) |

For the link-preview (OG) image use `../png/vyavahara-og-soundbox-ledger-v1.png`, and add the title in Canva.

## Favicon set (`favicon/`, v2, from the real logo)
Built from `../brand/vyavahara-logo-mark-v1.svg` (the ring + "व्य" glyph, no wordmark so it stays legible at 16px).
- `vyavahara-favicon-v2.svg` is the master for the browser tab (modern browsers).
- Raster: `favicon.ico` (16/32/48), `vyavahara-favicon-16/32/48-v2.png`, `vyavahara-apple-touch-icon-v2.png` (180, opaque white background), `vyavahara-icon-192-v2.png`, `vyavahara-icon-512-v2.png`.
- `png/profile-whatsapp.png` (640×640) is the full logo lockup (ring + glyph + wordmark) on white for the WhatsApp Business profile picture (WhatsApp crops it to a circle).
- `favicon/v0-ledger-mark/` and `png/v0/` hold the earlier invented ledger-bars mark, kept for reference only. Do not use it.

```html
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/vyavahara-favicon-v2.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/vyavahara-apple-touch-icon-v2.png">
```
(The existing Next.js `app/icon.png`, `app/apple-icon.png` and `app/favicon.ico` can be replaced with the matching v2 files.)

## Notes
- No Paytm marks or claims are used anywhere: the artwork is Vyavahāra-branded only.
- Colours come from the site's CSS tokens (see `templates/base.css` and `../BRIEF.md`).
