"use client";

import { useState } from "react";
import { Badge, Button, DataTable, EmptyState, ErrorState, Field, Input, NumberField, PageHeader, PaiseField, Select, Stat, Stats, Switch, TabList, useToast, type Column } from "@/components/ui";
import { postJson, putJson, toApiError, useApi } from "@/lib/ui/api";
import { rupees } from "@/lib/format";

interface CallsSettings {
  enabled: boolean;
  minOverdueDays: number;
  minOutstandingPaise: number;
  maxAttempts: number;
  retryGapDays: number;
  fromHour: number;
  untilHour: number;
  maxCallsPerRun: number;
}
interface CustomerRow {
  customerId: string;
  name: string;
  outstandingPaise: number;
  oldestUnpaidDays: number;
  phone: string | null;
  callConsent: boolean;
  willCall: boolean;
  reason: string | null;
  attempts: number;
  lastCallAt: string | null;
  lastOutcome: string | null;
}
interface HistoryRow {
  id: string;
  customerId: string;
  customer: string;
  amountPaise: number;
  overdueDays: number;
  status: string;
  outcome: string | null;
  durationSec: number | null;
  callNo: number;
  paidAfterPaise: number;
  at: string;
}
interface Summary {
  weekCalls: number;
  weekCustomers: number;
  willPay: number;
  callBack: number;
  noAnswer: number;
  paidAfterPaise: number;
}
interface CallsResponse {
  calls: CallsSettings;
  vobizReady: boolean;
  customers: CustomerRow[];
  history: HistoryRow[];
  summary: Summary;
}

type Filter = "all" | "will_pay" | "call_back" | "none";
const FILTERS = [
  { id: "all", label: "Sab" },
  { id: "will_pay", label: "Dene wale hain" },
  { id: "call_back", label: "Call chahiye" },
  { id: "none", label: "Koi jawab nahi" },
] as const;
const matches = (f: Filter, h: HistoryRow) => f === "all" || (f === "none" ? !h.outcome || ["no_answer", "no_response", "error"].includes(h.outcome) : h.outcome === f);

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const dur = (s: number | null) => (s === null ? "—" : s < 60 ? `${s} sec` : `${Math.floor(s / 60)} min ${s % 60} sec`);

const PRESETS: Record<number, string> = { 1: "Roz", 2: "Ek din chhod ke", 3: "Har 3 din", 7: "Hafte mein ek baar" };
const gapOptions = (days: number) => {
  const opts = Object.entries(PRESETS).map(([v, label]) => ({ value: v, label }));
  return PRESETS[days] ? opts : [...opts, { value: String(days), label: `Har ${days} din` }];
};
const hourOptions = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => ({ value: String(from + i), label: `${(from + i) % 12 || 12}:00 ${from + i < 12 || from + i === 24 ? "am" : "pm"}` }));

const OUTCOME: Record<string, { label: string; tone: "success" | "warn" | "neutral" | "danger" }> = {
  will_pay: { label: "Dene wale hain", tone: "success" },
  call_back: { label: "Dukaan se call chahiye", tone: "warn" },
  no_response: { label: "Koi jawab nahi", tone: "neutral" },
  no_answer: { label: "Phone nahi uthaya", tone: "neutral" },
  error: { label: "Call nahi lagi", tone: "danger" },
};

function Rules({ initial, onSaved }: { initial: CallsSettings; onSaved: () => void }) {
  const toast = useToast();
  const [saved, setSaved] = useState(initial);
  const [d, setD] = useState(initial);
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(d) !== JSON.stringify(saved);
  const set = <K extends keyof CallsSettings>(k: K, v: CallsSettings[K]) => setD((x) => ({ ...x, [k]: v }));
  const hoursOk = d.fromHour < d.untilHour;

  async function save() {
    setBusy(true);
    try {
      const r = await putJson<{ settings: { calls: CallsSettings } }>("/api/settings", { calls: d });
      setSaved(r.settings.calls);
      setD(r.settings.calls);
      toast.push({ tone: "success", title: "Save ho gaya" });
      onSaved();
    } catch (e) {
      toast.push({ tone: "error", title: "Save nahi hua", detail: toApiError(e).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="cs-rules" aria-labelledby="cs-rules-h">
      <div className="cs-head">
        <h2 id="cs-rules-h">Kab call karein</h2>
        <Switch checked={d.enabled} onChange={(v) => set("enabled", v)} label="Call Saathi chalu" showState />
      </div>
      <div className="cs-grid">
        <Field label="Pehli call kab" hint="Udhaar itne din purana ho jaye to call jayegi.">
          <NumberField value={d.minOverdueDays} onChange={(v) => v !== null && set("minOverdueDays", v)} min={7} max={365} suffix="din" />
        </Field>
        <Field label="Paisa na aaye to dobara kab" hint="Pehli call ke baad kitne din mein phir call karein.">
          <Select options={gapOptions(d.retryGapDays)} value={String(d.retryGapDays)} onChange={(e) => set("retryGapDays", Number(e.target.value))} />
        </Field>
        <Field label="Zyada se zyada kitni calls" hint="Ek customer ko itni calls ke baad ruk jayenge.">
          <NumberField value={d.maxAttempts} onChange={(v) => v !== null && set("maxAttempts", v)} min={1} max={10} suffix="calls" />
        </Field>
        <Field label="Kam se kam kitna baaki" hint="Isse kam udhaar par call nahi jayegi.">
          <PaiseField valuePaise={d.minOutstandingPaise} onChangePaise={(v) => v !== null && set("minOutstandingPaise", v)} minPaise={0} />
        </Field>
        <Field label="Call kab se (samay)" hint="Isse pehle call nahi jayegi.">
          <Select options={hourOptions(0, 23)} value={String(d.fromHour)} onChange={(e) => set("fromHour", Number(e.target.value))} />
        </Field>
        <Field label="Call kab tak (samay)" hint="Iske baad call nahi jayegi." error={hoursOk ? undefined : "Shuru ka samay baad ke samay se pehle hona chahiye"}>
          <Select options={hourOptions(1, 24)} value={String(d.untilHour)} onChange={(e) => set("untilHour", Number(e.target.value))} aria-invalid={!hoursOk || undefined} />
        </Field>
      </div>
      {dirty ? (
        <div className="cs-actions">
          <Button variant="primary" onClick={save} disabled={busy || !hoursOk}>
            {busy ? "Save ho raha hai…" : "Save karein"}
          </Button>
          <Button variant="secondary" onClick={() => setD(saved)}>
            Wapas karein
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function CallNow({ row, onDone }: { row: CustomerRow; onDone: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const ready = Boolean(row.phone) && row.callConsent;
  async function go() {
    setBusy(true);
    try {
      await postJson("/api/dashboard/calls/now", { customerId: row.customerId });
      toast.push({ tone: "success", title: `${row.name} ko call lag rahi hai` });
      onDone();
      setTimeout(onDone, 20_000);
      setTimeout(onDone, 60_000);
    } catch (e) {
      toast.push({ tone: "error", title: "Call nahi lagi", detail: toApiError(e).message });
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button variant="secondary" onClick={go} disabled={!ready || busy} title={ready ? undefined : "Pehle phone number aur ijazat chahiye"}>
      {busy ? "Lag rahi hai…" : "Abhi call karo"}
    </Button>
  );
}

function ContactCell({ row, onSaved }: { row: CustomerRow; onSaved: () => void }) {
  const toast = useToast();
  const initial = row.phone ? row.phone.replace(/^91/, "") : "";
  const [v, setV] = useState(initial);
  async function save(patch: { phone?: string; callConsent?: boolean }) {
    try {
      await putJson("/api/dashboard/calls", { customerId: row.customerId, ...patch });
      onSaved();
    } catch (e) {
      toast.push({ tone: "error", title: "Save nahi hua", detail: toApiError(e).message });
    }
  }
  return (
    <div className="cs-contact">
      <Input inputMode="tel" aria-label={`${row.name} ka phone number`} placeholder="10 digit mobile" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v.replace(/\D/g, "") !== initial && save({ phone: v })} />
      <Switch checked={row.callConsent} onChange={(c) => save({ callConsent: c })} label="Call ki ijazat" />
    </div>
  );
}

export function CallsView() {
  const { data, error, loading, refetch } = useApi<CallsResponse>("/api/dashboard/calls");
  const [filter, setFilter] = useState<Filter>("all");

  if (!data && error) {
    return (
      <>
        <PageHeader title="Call Saathi" hindi="कॉल साथी" />
        <ErrorState title="Call Saathi load nahi hua" error={error} onRetry={refetch} retrying={loading} />
      </>
    );
  }
  if (!data) return <PageHeader title="Call Saathi" hindi="कॉल साथी" description="Load ho raha hai…" />;

  const cols: readonly Column<CustomerRow>[] = [
    { key: "name", header: "Customer", primary: true, cell: (c) => c.name },
    { key: "due", header: "Baaki", num: true, cell: (c) => `${rupees(c.outstandingPaise)} · ${c.oldestUnpaidDays} din` },
    { key: "contact", header: "Phone", cell: (c) => <ContactCell key={c.phone ?? "none"} row={c} onSaved={refetch} /> },
    { key: "state", header: "Aage", cell: (c) => (c.willCall ? <Badge tone="success">Call hogi</Badge> : <span className="cs-quiet">{c.reason ?? ""}</span>) },
    { key: "now", header: "", nolabel: true, cell: (c) => <CallNow row={c} onDone={refetch} /> },
    { key: "last", header: "Aakhri call", cell: (c) => (c.lastCallAt ? <>{when(c.lastCallAt)}<span className="cs-quiet"> · {c.attempts} call{c.attempts > 1 ? "s" : ""}{c.lastOutcome && OUTCOME[c.lastOutcome] ? `, ${OUTCOME[c.lastOutcome].label}` : ""}</span></> : <span className="cs-quiet">Abhi tak nahi</span>) },
  ];
  const histCols: readonly Column<HistoryRow>[] = [
    { key: "at", header: "Kab", cell: (h) => when(h.at) },
    { key: "c", header: "Customer", primary: true, cell: (h) => (<>{h.customer}<span className="cs-quiet"> · call {h.callNo}</span></>) },
    { key: "a", header: "Baaki", num: true, cell: (h) => `${rupees(h.amountPaise)} · ${h.overdueDays} din` },
    {
      key: "o",
      header: "Nateeja",
      cell: (h) => {
        const o = h.outcome ? OUTCOME[h.outcome] : null;
        return o ? <Badge tone={o.tone}>{o.label}</Badge> : <span className="cs-quiet">{h.status === "failed" ? "Call nahi lagi" : "Call chal rahi hai"}</span>;
      },
    },
    { key: "d", header: "Baat", num: true, cell: (h) => dur(h.durationSec) },
    { key: "p", header: "Call ke baad", cell: (h) => (h.paidAfterPaise > 0 ? <Badge tone="success">{rupees(h.paidAfterPaise)} wapas aaya</Badge> : <span className="cs-quiet">—</span>) },
  ];
  const shown = data.history.filter((h) => matches(filter, h));

  return (
    <>
      <PageHeader
        title="Call Saathi"
        hindi="कॉल साथी"
        description={
          <>
            Purana udhaar baaki ho to Saathi customer ko phone karke yaad dilata hai. Ya Voice Saathi se boliye: <b>&ldquo;Sharma ji ko reminder call karo&rdquo;</b>.
          </>
        }
      />
      {!data.vobizReady ? <p className="cs-warn" role="status">Phone service (Vobiz) abhi jodi nahi gayi, isliye calls nahi jayengi.</p> : null}
      <Stats>
        <Stat label="Is hafte calls" figure={String(data.summary.weekCalls)} note={`${data.summary.weekCustomers} customer`} />
        <Stat label="Dene wale hain" figure={String(data.summary.willPay)} tone="success" />
        <Stat label="Call chahiye" figure={String(data.summary.callBack)} />
        <Stat label="Call ke baad wapas aaya" figure={rupees(data.summary.paidAfterPaise)} tone="success" />
      </Stats>
      <section className="cs-list" aria-labelledby="cs-hist-h">
        <h2 id="cs-hist-h">Call history</h2>
        <TabList label="Nateeja" idBase="cs-hist" items={FILTERS} value={filter} onChange={setFilter} />
        <DataTable
          caption="Reminder calls, newest first"
          columns={histCols}
          rows={shown}
          rowKey={(h) => h.id}
          empty={<EmptyState title={data.history.length ? "Is nateeje ki koi call nahi" : "Abhi tak koi call nahi gayi"} description={data.history.length ? undefined : "Call Saathi chalu karein, ya Voice Saathi se boliye: Sharma ji ko reminder call karo."} />}
        />
      </section>
      <Rules initial={data.calls} onSaved={refetch} />
      <section className="cs-list" aria-labelledby="cs-list-h">
        <h2 id="cs-list-h">Customers</h2>
        <p className="cs-quiet">Phone number aur ijazat ke bina kisi ko call nahi hoti.</p>
        <DataTable caption="Customers with udhaar" columns={cols} rows={data.customers} rowKey={(c) => c.customerId} empty={<EmptyState title="Abhi kisi ka udhaar baaki nahi" />} />
      </section>
    </>
  );
}
