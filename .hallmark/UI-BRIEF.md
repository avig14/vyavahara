# Vyavahāra (व्यवहार) UI brief — every frontend agent reads this first

Product: AI business assistant for an Indian kirana shop owner (demo shop "Gupta General Store"). Built for the Paytm Merchant Growth AI hackathon. Owner is not a power user: Hinglish speaker, phone-first habits, wants answers, not charts for their own sake.

## Non-negotiables

1. **Hallmark skill is law.** Skill clone: `C:\Users\AVIGUP~1\AppData\Local\Temp\claude\aa574226b2a72174\0798b66e-0ee6-47b9-b0c7-f4eeaa74c11c\scratchpad\hm\repo\skills\hallmark` (call it `$H`). Read `$H/SKILL.md` "The Floor" (16 rules) and `$H/references/flow.md` § App screens before writing a line. Read `$H/references/craft.md` § 9 and `$H/references/interaction-and-states.md` for controls and forms. Read `$H/references/gates.md` § 4 for the gate list. Public pages (landing, privacy) are page scope; everything under `/dashboard`, `/soundbox` is app scope; `/pay/[token]` is a one-purpose phone page.
2. **Must not look like AI slop or machine-made.** Specific refusals: no icon-in-a-tinted-square feature tiles, no 4-stat-card greeting row, no gradient anywhere, no glassmorphism, no emoji as icons, no card-inside-card, no pill-everything, no decorative status dots, no centred-head-over-three-cards, no "Welcome back 👋", no lorem copy, no generic dashboard donut + line + bar trio for decoration. Tables before cards. Hairline rules, not shadows. Real words from the product (khata, udhaar, stock, mandi, supplier, rozmel), not SaaS filler.
3. **Paytm theme, used exactly** (tokens in `src/styles/tokens.css`, already written; read them; never add a literal colour or font-family outside that file):
   - Cyan `--color-accent` (Paytm #00BAF2) is a **fill and a mark**: primary button, current selection, focus-adjacent rails, chart series 2. Cyan text on paper fails contrast: never.
   - Navy `--color-navy` (Paytm #002970) is the **authority colour**: sidebar, headings emphasis, text on cyan (`--color-accent-ink`), series 1, focus ring.
   - Paper `--color-paper` cool white ground; `--color-paper-2` white panels; `--color-paper-3` cyan-tint wash for selected rows and quiet callouts.
   - Money states only: `--color-success` money in, `--color-error` money due/overdue/blocked, `--color-warn` caution. Never decorative.
   - No Paytm logo, no redrawn mark. Wordmark is text: "Vyavahāra" with "व्यवहार" beside it in the Devanagari fallback.
   - Tailwind v4: tokens are in an `@theme static` block, so use utilities like `bg-paper`, `text-ink`, `bg-accent`, `text-navy`, `border-rule`, `rounded-card`, `text-figure`. Where a utility does not exist for a token use `var(--color-…)` in a small CSS module or inline style, never a hex or `oklch()` literal.
4. **Type:** one family, Figtree (+ Noto Sans Devanagari fallback), already loaded in `src/app/layout.tsx` as `--font-figtree`/`--font-deva`. Labels, table heads, tags, nav links are body face, one step smaller, sentence case, untracked (Floor 9: **no uppercase, no tracking, no eyebrows, ever**). Figures: class `figure`/`num` (tabular lining numerals) and right-aligned in tables. Money is integer **paise** in the API; format with `src/lib/format.ts` (read it; do not write a second formatter). Times are IST.
5. **Bilingual by design.** Nav items and the few core nouns carry a Hindi/Devanagari sublabel (Khata · खाता, Stock · स्टॉक, Udhaar, Hisaab · हिसाब). Keep Hindi short and correct; use `class="deva"`. Do not machine-translate sentences; only nouns the owner already says.
6. **Facts rule (Floor 8, gate 46a):** every number on screen comes from an API response or is absent. No invented metric, trend arrow, testimonial, percentage, logo, customer count. If the API does not give it, do not show it. Static copy about the product is allowed only when it is true of the code in this repo (check README/PRD).
7. **Every data region has four states:** loading (skeleton in the shape of the content), empty (what belongs here + the one action), error (what broke + retry), full. Build all four.
8. **State in the URL** (period, tab, filters, selected row) via `useSearchParams` + `router.replace`. Destructive actions confirm or undo; a modal is the last resort.
9. **Accessibility:** `:focus-visible` on every interactive element (base.css handles the ring; do not remove it), 44px hit targets on coarse pointers, `<label>` on every field, `aria-live` for toasts/async results, table semantics (`<table>`, `<th scope>`), colour never the only signal (badge text says it), `prefers-reduced-motion` respected (base.css), content visible without JS where the page is static.
10. **Motion is state:** `transform` and `opacity` only, `--dur-micro`/`--dur-short`, never `transition: all`, never animate width/height/top/left, no scroll theatrics.
11. **Responsive:** works from 360px to 1920px. Sidebar collapses to a menu under 60rem. Tables restack to labelled blocks on phone (craft § 9). `overflow-x: clip` already on html/body; no `100vw`.
12. **Next.js 16 rules (this is NOT the Next you know).** Before writing route/page code read the relevant file in `node_modules/next/dist/docs/01-app/` (pages, layouts, `Link`, `useSearchParams` needs a Suspense boundary, `params`/`searchParams` are Promises in server components, `LayoutProps`/`PageProps` helpers). Client components get `"use client"`. No Cache Components.
13. **Credits and data safety.** Never call a Claude- or Sarvam-backed route (`POST /api/chat`, `POST /api/soundbox/audio`, `{speak:true}`) while testing. Never call write routes against the live Neon DB while testing (`POST /api/soundbox/payment`, `POST /api/pay/[token]` mark-paid, `POST /api/actions/[id]`, `POST /api/onboarding/connect-paytm` only if needed once). GET routes are free: use them. If you must test `PUT /api/settings`, undo with `DELETE /api/settings` immediately. The UI still must be built against those routes' documented shapes (read the route files in `src/app/api/**` and the libs they call; types live in `src/lib/**`).
14. **Do not edit** anything under `src/app/api/**`, `src/lib/**` (except adding new files under `src/lib/ui/`), `scripts/`, tests, `package.json`, the PRD, `.env*`. Do not `git commit` (not a repo). Do not install packages without a strong reason (no chart libs, no UI kits, no icon packs: draw charts as inline SVG from tokens; icons only where a symbol is genuinely clearer than a word, inline SVG, 1.5px stroke, `currentColor`).
15. **Copy:** the owner's own nouns, a fact in every heading, no line a competitor could use unchanged, about 80 words a screen on page-scope screens; app screens have no word budget but no filler. Hinglish microcopy where an owner would say it ("Kuch nahi mila", not "No results found") but keep errors unambiguous in plain English.

## Signature (the one object this tool is known by)

**The rozmel** (रोज़मेल, the shopkeeper's daily day-book): a running ruled tape of today's UPI receipts with a running total, newest line posting at the top, item lines where the soundbox matched a basket. It is the Overview's main object and the Soundbox page's main object. It is a table with ledger rules and a running-balance column, not a card list. No fake paper texture, no skeuomorphism.

## Shell and routes

Public: `/` (landing), `/onboarding`, `/privacy`, `/pay/[token]`, `/soundbox`.
App (`src/app/dashboard/layout.tsx`, shared shell): `/dashboard` (overview), `/dashboard/inventory`, `/dashboard/vendors`, `/dashboard/khata`, `/dashboard/customers`, `/dashboard/reports`, `/dashboard/growth`, `/dashboard/settings`. A floating "Saathi" chat panel (AI chat) is part of the shell (PRD: "overview + floating AI chat").
Shell = navy sidebar (earned: nine destinations) collapsing to a menu under 60rem + light top bar holding the shop name, the period picker (URL `?period=`), and the chat toggle.

## Shared code (built first by the foundation agent; others import it)

- `src/components/ui/*` primitives: Button, IconButton, Field/Input/Select/Switch/NumberField, Table (ledger style), Stat (figure + label), Badge (text + tone, no dot), Tabs, Disclosure, Toast, Skeleton, EmptyState, ErrorState, ConfirmDialog (native `<dialog>`), PageHeader.
- `src/components/charts/*`: inline-SVG Sparkline, BarSeries, LineBand (actual + forecast + confidence band), StackedBar, Heatmap. Token colours only, labelled directly (no legend hunting), `role="img"` + text summary.
- `src/lib/ui/api.ts`: `useApi<T>(url)` (loading/error/data/refetch, no-store), `postJson`, `ApiError`; `src/lib/ui/period.ts`; `src/lib/ui/url-state.ts`.
- `src/app/dashboard/layout.tsx` + `src/components/shell/*`.

## Verify (every agent, before reporting)

- Dev server already runs on http://localhost:3000 (hot reload; do **not** start another one: a second `next dev` in this folder fails). If it is down, tell the lead.
- `npx tsc --noEmit` clean for your files; `npx eslint <your files>` zero errors.
- `HALLMARK_PUPPETEER="C:\Users\AVIGUP~1\AppData\Local\Temp\claude\aa574226b2a72174\0798b66e-0ee6-47b9-b0c7-f4eeaa74c11c\scratchpad\hm\pup" CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe" node "$H/scripts/sloplint.mjs" <your files> --scope app --render --url http://localhost:3000/<route>` (drop `--scope app` for public pages). Fix every FAIL. Fix or waive-on-record every REFLEX. Read the screenshots it writes and look at them: fix what is ugly, cramped, misaligned or generic, at 1280 wide and 390 wide.
- Report: files you created/changed, the routes, what each state looks like, sloplint result verbatim summary, anything you could not verify and why. Be honest: a fabricated pass is itself slop.

## Stamp rule

New CSS files you create start with the stamp skeleton (see top of `src/app/globals.css`) and the critique line. Prefer Tailwind utilities with tokens over new CSS files.
