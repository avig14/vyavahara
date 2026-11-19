# UI kit API (built by the foundation agent; read the source for details)

Corrections to UI-BRIEF.md: API routes return a **bare payload on success** and `{error:string}` + HTTP status on failure (not `{ok,data}`). Nav has **eight** destinations. `ToastProvider` is already mounted in `src/app/dashboard/layout.tsx`. Public pages (`/`, `/onboarding`, `/privacy`, `/pay/[token]`, `/soundbox`) are outside the dashboard layout: wrap in `ToastProvider` yourself if you use toasts. If styles look missing after you add CSS, nudge `src/app/globals.css` (dev server caches @imports). Existing CSS: `src/styles/ui.css`, `src/styles/shell.css`. The shell's merchant name comes from `useMerchant()` (`@/lib/ui/merchant`).

Imports: primitives `@/components/ui` (barrel), charts `@/components/charts`, hooks `@/lib/ui/*`, shell `@/components/shell/*`.

**Primitives**
- `Button({variant?: "primary"|"secondary"|"quiet"|"danger", loading?, icon?, block?})`; `buttonClass({variant,block})` for `Link` styled as button. `IconButton({label, variant?})`.
- `Field({label, hint?, error?, required?, aside?})` wrapping `Input`, `Textarea`, `Select({options:{value,label,disabled?}[]})`. `Switch({checked,onChange,label,hint?,showState?})`. `NumberField({value:number|null,onChange,min?,max?,decimals?,prefix?,suffix?,invalid?})`. `PaiseField({valuePaise,onChangePaise,minPaise?,maxPaise?})`.
- `DataTable<Row>({caption, columns, rows|undefined, rowKey, loading?, error?, onRetry?, empty?, sticky?, dense?, selectedKey?, onSelect?, skeletonRows?})`, column `{key, header, cell, num?, primary?, label?, nolabel?, footer?, width?}`. `Table({caption,sticky?,dense?,restack?})` bare.
- `Stat({label, figure, unit?, note?, tone?: "neutral"|"success"|"danger"|"warn", size?})` inside `Stats`.
- `Badge({tone?: "neutral"|"info"|"success"|"warn"|"danger"})`.
- `Tabs({items:{id,label,hindi?}[], param?, defaultId, label, children:(active)=>node})` (URL-kept); `TabList` controlled.
- `Disclosure({summary, meta?, defaultOpen?, onToggle?})`.
- `useToast().push({title, detail?, tone?: "neutral"|"success"|"error", action?:{label,onAction}, duration?})`.
- `Skeleton({shape:"line"|"block"|"rows"|"stat", count?, cols?, height?, label?})` + `SkeletonLine/Block/Rows/Stat`.
- `EmptyState({title, description?, action?})`, `ErrorState({title?, error, onRetry?, retrying?})`.
- `ConfirmDialog({open,title,description?,confirmLabel,cancelLabel?,tone?,loading?,onConfirm,onCancel})`, `useConfirm()` → `{confirm(opts): Promise<boolean>, dialog}` (render `{dialog}` once).
- `PageHeader({title, hindi?, description?, actions?})`.

**Charts** (all take `summary` for screen readers, optional `format`/`axisFormat`): `Sparkline({values,tone?,width?,height?})`, `BarSeries({data:{label,value,highlight?}[], orientation?, height?})`, `LineBand({points:{label,actual?,forecast?,low?,high?}[], actualLabel?, forecastLabel?, bandLabel?, height?})`, `StackedBar({segments:{label,value,tone?}[], format})`, `Heatmap({cells:number[7][24], startDay?, hours?, cellHeight?})`, helpers `compactRupees(paise)`, `compact(n)`.

**Hooks**: `useApi<T>(url|null)` → `{data,error,loading,refetch}`; `postJson/putJson/deleteJson/getJson`; `ApiError(status,message)`. `useQueryState<T>(key,{defaultValue,allowed})` → `[value,set]`; `useQueryParams()`. `usePeriod()` → `{name,from,to,label,apiQuery,setPeriod,setCustom}` (`apiQuery` is ready to append to an API URL; check how it is shaped before concatenating). `PERIOD_OPTIONS`, `periodLabel`, `todayKey` from `@/lib/ui/period`.

**Shell**: `Shell` frame; `ChatPanel({open,onClose})` renders `chat-body.tsx` (currently "not connected yet": the Chat agent replaces its body); `NAV_ITEMS`, `isCurrent` in `nav.ts`. Footer link in the sidebar goes to `/soundbox`.

**New route (lead added, read-only, free to call):** `GET /api/dashboard/rozmel?day=YYYY-MM-DD` (default today IST) → `{day, count, totalPaise, rows:[{id, at(ISO), amountPaise(signed), kind:"sale"|"refund", method:"upi"|"cash"|"card", source:"paytm"|"soundbox"|"manual"|"seed", utr|null, payer|null, items:[{name,qty,unitPricePaise,confidence:"confirmed"|"probable"}], runningTotalPaise}]}` in time order oldest first (reverse for newest-on-top). Includes cash/card rows too: show the method, do not call cash a UPI receipt.
