/** PDF for a ReportData via @react-pdf/renderer (Node runtime). Same numbers as text + dashboard. */
import path from "node:path";
import { Document, Font, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { rupees, daysLabel, num } from "../format";
import { fmtShortDate } from "../time";
import type { ReportData } from "./build";

// Helvetica has no ₹ glyph → register Noto Sans (TTF; react-pdf needs an absolute path in Node).
const FONT_DIR = path.join(process.cwd(), "assets", "fonts");
// The logo as supplied (256px render of the original SVG); read from disk like the fonts.
const LOGO_PNG = path.join(process.cwd(), "public", "brand", "vyavahara-logo-256.png");
let fontsReady = false;
function ensureFonts() {
  if (fontsReady) return;
  Font.register({
    family: "NotoSans",
    fonts: [
      { src: path.join(FONT_DIR, "NotoSans-Regular.ttf"), fontWeight: 400 },
      { src: path.join(FONT_DIR, "NotoSans-Bold.ttf"), fontWeight: 700 },
    ],
  });
  Font.registerHyphenationCallback((w) => [w]); // never hyphenate names
  fontsReady = true;
}

const C = { ink: "#10233f", mute: "#5d6b82", line: "#dfe5ee", brand: "#0a5bd6", good: "#0f8a5f", bad: "#c43a3a", tile: "#f3f6fb" };

const st = StyleSheet.create({
  page: { fontFamily: "NotoSans", fontSize: 9, color: C.ink, padding: 32, paddingBottom: 48 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", borderBottomWidth: 2, borderBottomColor: C.brand, paddingBottom: 8, marginBottom: 12 },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: { width: 38, height: 38 },
  h1: { fontSize: 16, fontWeight: 700 },
  sub: { color: C.mute, fontSize: 9, marginTop: 2 },
  tiles: { flexDirection: "row", gap: 8, marginBottom: 10 },
  tile: { flex: 1, backgroundColor: C.tile, borderRadius: 4, padding: 8 },
  tileLabel: { color: C.mute, fontSize: 8 },
  tileVal: { fontSize: 14, fontWeight: 700, marginTop: 2 },
  h2: { fontSize: 11, fontWeight: 700, marginTop: 12, marginBottom: 4 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: C.line, paddingVertical: 3 },
  th: { color: C.mute, fontSize: 8, fontWeight: 700 },
  c1: { flex: 3 },
  c2: { flex: 1.2, textAlign: "right" },
  c3: { flex: 1.2, textAlign: "right" },
  barRow: { flexDirection: "row", alignItems: "center", marginVertical: 1.5 },
  barLabel: { width: 42, fontSize: 8, color: C.mute },
  barTrack: { flex: 1, height: 7, backgroundColor: C.tile, borderRadius: 2 },
  barFill: { height: 7, backgroundColor: C.brand, borderRadius: 2 },
  barVal: { width: 52, textAlign: "right", fontSize: 8 },
  rec: { flexDirection: "row", marginVertical: 2 },
  recN: { width: 14, fontWeight: 700, color: C.brand },
  note: { color: C.mute, fontSize: 8, marginTop: 2 },
  footer: { position: "absolute", bottom: 20, left: 32, right: 32, color: C.mute, fontSize: 7.5, borderTopWidth: 0.5, borderTopColor: C.line, paddingTop: 4 },
});

function Tile({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <View style={st.tile}>
      <Text style={st.tileLabel}>{label}</Text>
      <Text style={[st.tileVal, tone === "good" ? { color: C.good } : tone === "bad" ? { color: C.bad } : {}]}>{value}</Text>
    </View>
  );
}

function Table({ head, rows }: { head: [string, string, string?]; rows: [string, string, string?][] }) {
  return (
    <View>
      <View style={st.row}>
        <Text style={[st.th, st.c1]}>{head[0]}</Text>
        <Text style={[st.th, st.c2]}>{head[1]}</Text>
        {head[2] !== undefined && <Text style={[st.th, st.c3]}>{head[2]}</Text>}
      </View>
      {rows.map((r, i) => (
        <View key={i} style={st.row} wrap={false}>
          <Text style={st.c1}>{r[0]}</Text>
          <Text style={st.c2}>{r[1]}</Text>
          {r[2] !== undefined && <Text style={st.c3}>{r[2]}</Text>}
        </View>
      ))}
    </View>
  );
}

export function ReportPdf({ r }: { r: ReportData }) {
  const max = Math.max(1, ...r.daily.map((d) => d.totalPaise));
  const ch = r.sales.changePct;
  const days = r.daily.length > 31 ? r.daily.slice(-31) : r.daily;
  return (
    <Document title={`${r.merchantName} — ${r.period.label}`} author="Vyavahāra">
      <Page size="A4" style={st.page}>
        <View style={st.head}>
          <View style={st.brand}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image is not an <img> and has no alt prop */}
            <Image src={LOGO_PNG} style={st.logo} />
            <View>
              <Text style={st.h1}>{r.merchantName}</Text>
              <Text style={st.sub}>Business report · {r.period.label}</Text>
            </View>
          </View>
          <Text style={st.sub}>Generated {fmtShortDate(new Date(r.generatedAt))}</Text>
        </View>

        <View style={st.tiles}>
          <Tile label="Sales" value={rupees(r.sales.totalPaise)} />
          <Tile label="Net profit" value={rupees(r.profit.netPaise)} tone={r.profit.netPaise >= 0 ? "good" : "bad"} />
          <Tile label="Bills · avg bill" value={`${r.sales.bills} · ${rupees(r.sales.avgBillPaise)}`} />
          <Tile label="vs previous" value={ch === null ? "—" : `${ch > 0 ? "+" : ch < 0 ? "−" : ""}${Math.abs(ch)}%`} tone={ch === null ? undefined : ch >= 0 ? "good" : "bad"} />
        </View>
        <Text style={st.note}>
          UPI {rupees(r.sales.upiPaise)} · Cash {rupees(r.sales.cashPaise)} · Gross profit {rupees(r.profit.grossPaise)} · Expenses {rupees(r.profit.expensesPaise)}
        </Text>

        {days.length > 1 && (
          <View wrap={false}>
            <Text style={st.h2}>Daily sales</Text>
            {days.map((d) => (
              <View key={d.day} style={st.barRow}>
                <Text style={st.barLabel}>{fmtShortDate(new Date(`${d.day}T06:00:00Z`))}</Text>
                <View style={st.barTrack}>
                  <View style={[st.barFill, { width: `${Math.max(1, Math.round((Math.max(0, d.totalPaise) / max) * 100))}%` }]} />
                </View>
                <Text style={st.barVal}>{rupees(d.totalPaise)}</Text>
              </View>
            ))}
          </View>
        )}

        {r.topByRevenue.length > 0 && (
          <View>
            <Text style={st.h2}>Top items</Text>
            <Table
              head={["Item (by revenue)", "Qty", "Revenue"]}
              rows={r.topByRevenue.map((t) => [t.name, num(t.qty, t.qty % 1 ? 1 : 0), rupees(t.revenuePaise)])}
            />
            <View style={{ height: 6 }} />
            <Table head={["Item (by profit)", "Qty", "Profit"]} rows={r.topByProfit.map((t) => [t.name, num(t.qty, t.qty % 1 ? 1 : 0), rupees(t.profitPaise)])} />
          </View>
        )}

        {r.lostSales.requests > 0 && (
          <Text style={st.note}>
            Lost sales {rupees(r.lostSales.totalPaise)} ({r.lostSales.requests} requests)
            {r.lostSales.top ? ` — mostly ${r.lostSales.top.name}` : ""}
          </Text>
        )}

        {(r.stockAlerts.out.length > 0 || r.stockAlerts.runningOut.length > 0) && (
          <View wrap={false}>
            <Text style={st.h2}>Stock alerts</Text>
            <Table
              head={["Item", "In stock", "Days left"]}
              rows={[...r.stockAlerts.out, ...r.stockAlerts.runningOut].slice(0, 10).map((f) => [f.name, num(f.stock, 1), f.status === "stockout" ? "Out" : daysLabel(f.daysToStockout)])}
            />
          </View>
        )}

        {r.khata.totalDuePaise > 0 && (
          <View wrap={false}>
            <Text style={st.h2}>Udhaar (khata)</Text>
            <Text>
              Total due {rupees(r.khata.totalDuePaise)} · Collected this period {rupees(r.khata.collectedPaise)}
            </Text>
            {r.khata.red.length > 0 && (
              <Table head={["High-risk customers", "Oldest (days)", "Due"]} rows={r.khata.red.map((a) => [a.name, String(a.oldestUnpaidDays), rupees(a.outstandingPaise)])} />
            )}
          </View>
        )}

        {r.payablesDue.length > 0 && (
          <View wrap={false}>
            <Text style={st.h2}>Vendor payments due</Text>
            <Table
              head={["Vendor", "Due", "Amount"]}
              rows={r.payablesDue.map((p) => [p.vendorName, p.dueInDays < 0 ? `${-p.dueInDays}d late` : p.dueInDays === 0 ? "today" : `in ${p.dueInDays}d`, rupees(p.amountPaise)])}
            />
          </View>
        )}

        {r.anomalies.length > 0 && (
          <View wrap={false}>
            <Text style={st.h2}>Things to look at</Text>
            {r.anomalies.slice(0, 4).map((a, i) => (
              <Text key={i}>• {a.text}</Text>
            ))}
          </View>
        )}

        {r.recommendations.length > 0 && (
          <View wrap={false}>
            <Text style={st.h2}>Top suggestions (by ₹ impact)</Text>
            {r.recommendations.map((x, i) => (
              <View key={x.id} style={st.rec}>
                <Text style={st.recN}>{i + 1}.</Text>
                <Text style={{ flex: 1 }}>
                  {x.title} <Text style={{ color: C.mute }}>(≈ {rupees(x.impactPaise)})</Text>
                </Text>
              </View>
            ))}
          </View>
        )}

        <Text style={st.footer} fixed>
          Figures computed from your Paytm &amp; Saathi records. Estimates (profit, forecasts, GST) are indicative — verify with your CA before filing.
        </Text>
      </Page>
    </Document>
  );
}

export async function renderReportPdf(r: ReportData): Promise<Buffer> {
  ensureFonts();
  return renderToBuffer(<ReportPdf r={r} />);
}
