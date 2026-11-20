# Vyavahāra SVG brief

Tokens come from the live site CSS (vyavahara.vercel.app). Define colours once in `_build/build.py`; every version is generated from them.

| Token | Hex | Use |
|---|---|---|
| navy | #012970 | outlines, ink, header bars |
| cyan | #02BAF2 | accent, newest row, highlights |
| soft | #E0F5FD | tiles, blobs, highlighted row |
| line | #97DCF9 | connectors, secondary accent |
| paper | #F7F9FC | backgrounds |
| rule / muted | #DAE0E7 / #7A8798 | dividers / placeholder text bars |
| warn | #935B00 on #FFF2D8 | Khata (late udhaar) |

- **Style:** flat shapes, no gradients or filters. Mood: calm, ledger-like, trustworthy.
- **Stroke / radius:** icons 96px grid, stroke 4, tile radius 16. Cards stroke 3, radius 14-16. Fonts: Figtree + Noto Sans Devanagari (HTML only).
- **No text in any SVG.** Headlines, CTAs and Devanagari labels stay as HTML. Type the OG title in Canva.

## Outputs per asset
`source/` master, `canva/` strokes outlined and solid fills only, `web/` no fixed size, aria, SVGO, icons use `currentColor`, `png/` renders.
Naming: `vyavahara-<type>-<descriptor>-v1.svg`.

## Banner sizes
| Asset | Size | Used for |
|---|---|---|
| hero-soundbox-ledger | 1200×760 | desktop hero illustration beside the headline |
| hero-mobile-soundbox-ledger | 750×900 | hero on phones (swap with `<picture>` / media query) |
| og-soundbox-ledger | 1200×630 PNG | social share image, title added in Canva |
| diagram-payment-flow | 1200×320 | "What happens after a payment" |

## Using the web SVGs
- Inline or `<img>`. Size with CSS (`width`), the `viewBox` is kept.
- Icons: set `color` on the element to recolour, e.g. `.icon{color:var(--color-navy)}`. Used via `<img>` they fall back to navy.
- Decorative files (divider, underline, bg) are `aria-hidden`; the rest have `<title>` + `role="img"`.
- Layer ids are prefixed per asset (e.g. `hero-soundbox`) so inlining several on one page does not clash.

## Logo
Source of truth is the owner's `व्य` logo (`brand/original/`): a ring (cyan top half, navy bottom half) around a gradient "व्य" glyph, with a "Vyavahara" wordmark. Clean vector rebuilds are in `brand/` (full lockup, mark, flat mark). Logo colours are `#00B8F4` / `#012A72`, within a shade of the site tokens (`#02BAF2` / `#012970`).
