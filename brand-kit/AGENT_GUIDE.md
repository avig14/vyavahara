# Vyavahāra SVG assets: guide for agents

This folder holds the SVG artwork for the Vyavahāra website (https://vyavahara.vercel.app), a shop-ledger companion for small Indian merchants. Every UPI soundbox payment lands as a line in the **rozmel** (daily cash book), and **Khata** (credit/udhaar), **Stock** (supplier orders) and **Saathi** (Hinglish assistant) follow from it.

Read this file first. Use `preview.html` to see everything rendered, and `BRIEF.md` for palette and style rules.

## Which folder to use

| Folder | Use it for | Do not |
|---|---|---|
| `web/` | **The website.** Optimised, has aria/`<title>`, no fixed size, icons use `currentColor`. | Do not upload to Canva. |
| `canva/` | **Canva uploads / decks / social graphics.** Strokes are outlined, solid fills only. | Do not ship on the website (larger files). |
| `source/` | Master copies to edit or regenerate from. | Do not ship directly. |
| `png/` | Raster fallbacks and social images (OG). | |
| `brand/` | **The Vyavahāra logo** (full lockup, mark-only, flat mark) plus the owner's original file in `brand/original/`. | Do not redraw the logo. |
| `svg/` | **Legacy v0 set. Ignore it.** Superseded by v1, kept for reference only. | Do not use. |
| `_build/` | Script (`build.py`) that regenerates source/canva/web/png from design tokens. Edit tokens or shapes there, then rerun; never hand-edit generated files. | |

Rebuild: `cd _build && npm i && py -3.11 build.py ..` (needs Python 3 with `shapely`, Node, and Edge or Chrome for PNGs). The build validates every file and prints `ALL PASS` when clean.

## Where to use each asset (website, `web/` files)

The current page structure is: header (logo + "Privacy") → hero (headline, subhead, two CTAs) → "Example rozmel" table → "What happens after a payment" table → footer.

| File | Size | Intended use |
|---|---|---|
| `vyavahara-hero-soundbox-ledger-v1.svg` | 1200×760 | **Hero illustration, desktop.** Place beside or below the headline "Every soundbox payment lands in your rozmel." Shows a soundbox sending a payment into the rozmel ledger, which feeds Khata, Stock and Saathi. |
| `vyavahara-hero-mobile-soundbox-ledger-v1.svg` | 750×900 | **Hero illustration, phones.** Same scene, stacked vertically. Swap with the desktop one below ~768px using `<picture>` with a media query. |
| `vyavahara-diagram-payment-flow-v1.svg` | 1200×320 | **"What happens after a payment" section.** Place above or beside the table as a visual summary: soundbox → rozmel → Khata / Stock / Saathi. On narrow screens let it scale down or scroll horizontally; do not crop. |
| `vyavahara-icon-rozmel-v1.svg` | 96×96 | Icon for the **Rozmel / रोज़मेल** row ("A UPI payment arrives"). Also usable in feature cards. |
| `vyavahara-icon-khata-v1.svg` | 96×96 | Icon for the **Khata / खाता** row ("Udhaar runs late"). |
| `vyavahara-icon-stock-v1.svg` | 96×96 | Icon for the **Stock / स्टॉक** row ("Atta runs low"). |
| `vyavahara-icon-saathi-v1.svg` | 96×96 | Icon for the **Saathi** row ("You have a question"). |
| `vyavahara-icon-soundbox-v1.svg` | 96×96 | Generic "payment/soundbox" icon: bullets, the "Example rozmel" label, empty states, small hero accents. |
| `vyavahara-divider-ledger-rule-v1.svg` | 1440×24 | **Section divider** between hero, the rozmel table and the next section. Decorative. Stretch to container width. |
| `vyavahara-accent-hero-underline-v1.svg` | 600×24 | **Underline under the hero headline** (or a key phrase such as "your rozmel"). Position absolutely under the text and size to the text width. Decorative. |
| `vyavahara-bg-ledger-lines-v1.svg` | 1440×800 | **Faint ruled-paper background** for the hero or a section. Use as CSS `background-image` with `background-size: cover`. Decorative. Keep body text high-contrast over it. |
| `vyavahara-og-soundbox-ledger-v1.svg` | 1200×630 | **Source art for the social share image.** Social platforms need raster, so use `png/vyavahara-og-soundbox-ledger-v1.png` in `<meta property="og:image">` and `twitter:image`. The left half is intentionally empty for a title. |

`png/` files: `…@2x.png` are 2× raster fallbacks for the hero, mobile hero and diagram. Use them only if an SVG fails to render or in places that don't accept SVG (email, some CMSs).

## Implementation rules

1. **Never put text inside the SVGs.** Headlines, CTAs and Devanagari labels stay as HTML text (fonts: Figtree and Noto Sans Devanagari). The artwork uses abstract bars where text would be.
2. **Sizing:** web SVGs have a `viewBox` and no fixed width/height. Set size with CSS (`width: 100%; height: auto` or an explicit `width`).
3. **Icons and colour:** icon navy parts use `currentColor`. Set `color` on the element to recolour (for example `.icon { color: var(--color-navy) }`). Loaded through `<img>` they fall back to navy `#012970`.
4. **Accessibility:** decorative files (divider, underline, bg) are already `aria-hidden="true"`: keep them as `alt=""` or CSS backgrounds. Meaningful files carry a `<title>` and `role="img"`. If using `<img>`, give a short `alt`, or `alt=""` when the surrounding text already says it (for example an icon next to its row label).
5. **Inlining several SVGs on one page is safe:** all ids are prefixed per asset (`hero-…`, `icn-…`). Icons share the ids `icn-bg` etc., so inline each icon only once per page or use `<img>` for repeats.
6. **Performance:** the hero SVGs are about 6 KB. Use `loading="eager"` / `fetchpriority="high"` for the hero above the fold, and put `width`/`height` attributes on `<img>` to avoid layout shift.
7. **Do not recolour with new colours.** The palette is the site's own tokens (navy `#012970`, cyan `#02BAF2`, soft `#E0F5FD`, paper `#F7F9FC`). Changing them means editing `_build/build.py` and rebuilding.

## Where to use each asset (Canva, `canva/` files)

Upload the matching file from `canva/` (not `web/`) and recolour or regroup it in Canva as needed.

| File | Suggested Canva use |
|---|---|
| `vyavahara-og-soundbox-ledger-v1.svg` | 1200×630 social/link-preview graphic. Type the title and tagline on the empty left half in Canva, then export PNG. |
| `vyavahara-hero-soundbox-ledger-v1.svg` | Pitch-deck cover or product slide (hackathon deck). |
| `vyavahara-diagram-payment-flow-v1.svg` | "How it works" slide. |
| `vyavahara-icon-*-v1.svg` | Feature slides, one-pagers, stickers. |
| `vyavahara-divider-…`, `…-accent-…`, `…-bg-…` | Slide dividers, title underlines, backgrounds. |

Canva files are fully flat: solid fills only, no strokes, text, filters, masks, gradients or CSS. Layers are grouped by component with readable ids, for example `hero-soundbox`, `hero-ledger`, `hero-modules`. Shapes are not grouped by colour.

## Naming and versions

`vyavahara-<type>-<descriptor>-v<N>.svg`. Types: `hero`, `diagram`, `icon`, `divider`, `accent`, `bg`, `og`. When changing an asset, bump the version number in `_build/build.py` and add a line to `CHANGELOG.md` rather than overwriting.

## Notes and limits

- **Logo:** see `brand/`. The owner's original logo file (a Canva export with raster glyph and wordmark) is in `brand/original/` as the reference. `brand/vyavahara-logo-full-v1.svg` (ring + glyph + wordmark) and `brand/vyavahara-logo-mark-v1.svg` (ring + glyph) are clean vector rebuilds of it, traced from the original (drop shadow omitted). Always use the logo from `brand/`; never invent a different mark.
- These assets were drawn from the site's published copy and CSS tokens. If the page layout changes (new sections, different hero composition), check `preview.html` and adjust sizes in CSS first; regenerate artwork only if the shapes themselves need to change.
- Canva compatibility rules were applied from Canva's upload guidance but not yet verified by uploading a test file. If an import looks wrong, report which element failed so the build rules can be tightened.

## Social, favicon and WhatsApp-bot assets

These live in `social/` and are documented in `social/README.md`: WhatsApp message cards (payment received, daily hisaab, udhaar reminder, stock alert, welcome), a WhatsApp profile picture, three 1080×1080 social posts, and the favicon set. They are PNG outputs rendered from HTML templates with `{{placeholders}}` (see `social/render.py` and `social/samples.json`) because WhatsApp and social platforms do not accept SVG. Use `social/png/` for finished sample images and `social/templates/` for the bot to fill with real data.

## Logo (`brand/`)

| File | Use |
|---|---|
| `vyavahara-logo-full-v1.svg` | Full lockup with the "Vyavahara" wordmark: header, footer, decks, WhatsApp profile. Needs space (about 120px+ wide to keep the wordmark readable). |
| `vyavahara-logo-mark-v1.svg` | Ring + "व्य" glyph only: favicons, small avatars, social profile icons (works down to 16px). Glyph is re-centred and enlarged slightly vs the original for small sizes. |
| `vyavahara-logo-mark-flat-v1.svg` | Same mark with a solid glyph colour instead of the gradient, for tools that dislike gradients (Canva-safe). |
| `original/vyavahara-logo-original-canva-export.svg` | The owner's original file, 3 MB, with embedded rasters. Reference only; do not ship on the web. |

Logo colours: ring `#00B8F4` (top) and `#012A72` (bottom), glyph gradient `#012E76` → `#00B8F4`. The favicon set is generated from the mark (`social/favicon/`, v2). Regenerate with `_build/build_logo.py` (needs a 4× render of the original; see the script header).
