/** Layouts for the WhatsApp photo cards, after assets/social/templates (same colours, copy and structure). Satori subset: flexbox only. */
import type { ReactElement } from "react";
import { rupees } from "../format";
import type { DailyCardData, StockCardData, UdhaarCardData } from "./cards-data";

export const NAVY = "#012970";
const CYAN = "#02BAF2";
const SOFT = "#E0F5FD";
const LINE = "#97DCF9";
const PAPER = "#F7F9FC";
const INK = "#0d1a32";
const MUTED = "#4d5969";
const RULE = "#DAE0E7";
const WARN = "#935B00";
const WARN_SOFT = "#FFF2D8";
const OK = "#197037";
const OK_SOFT = "#E4F8E7";

const col = { display: "flex", flexDirection: "column" } as const;
const row = { display: "flex", flexDirection: "row", alignItems: "center" } as const;

function Header({ logo }: { logo: string }) {
  return (
    <div style={{ ...row, height: 104, background: NAVY, padding: "0 56px", gap: 18 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logo} width={64} height={64} alt="" style={{ borderRadius: 32, border: "3px solid #fff" }} />
      <div style={{ display: "flex", fontSize: 38, fontWeight: 700, color: "#F8FAFD" }}>Vyavahāra</div>
    </div>
  );
}

function Footer({ left, right }: { left: string; right?: string }) {
  return (
    <div style={{ ...row, justifyContent: "space-between", height: 80, padding: "0 56px", borderTop: `2px solid ${RULE}`, background: "#fff" }}>
      <div style={{ display: "flex", fontSize: 26, color: MUTED }}>{left}</div>
      {right ? <div style={{ display: "flex", fontSize: 22, color: MUTED, background: SOFT, padding: "6px 14px", borderRadius: 999 }}>{right}</div> : null}
    </div>
  );
}

const Pill = ({ text, bg, color }: { text: string; bg: string; color: string }) => (
  <div style={{ display: "flex", fontSize: 26, fontWeight: 700, padding: "10px 24px", borderRadius: 999, background: bg, color }}>{text}</div>
);

function Frame({ logo, h, children, footer }: { logo: string; h: number; children: React.ReactNode; footer: ReactElement }) {
  return (
    <div style={{ ...col, width: 1080, height: h, background: PAPER, fontFamily: "Noto Sans" }}>
      <Header logo={logo} />
      <div style={{ ...col, flex: 1, padding: "44px 56px" }}>{children}</div>
      {footer}
    </div>
  );
}

export const SIZES = { daily: { width: 1080, height: 1080 }, udhaar: { width: 1080, height: 900 }, stock: { width: 1080, height: 900 } } as const;

export function DailyCard({ d, logo }: { d: DailyCardData; logo: string }) {
  const tile = (label: string, value: string, hl = false) => (
    <div style={{ ...col, flex: 1, padding: "22px 26px", borderRadius: 16, background: hl ? NAVY : "#fff", border: `2px solid ${hl ? NAVY : RULE}` }}>
      <div style={{ display: "flex", fontSize: 24, fontWeight: 700, color: hl ? "#ABC0D7" : MUTED }}>{label}</div>
      <div style={{ display: "flex", fontSize: 54, fontWeight: 700, color: hl ? CYAN : NAVY, marginTop: 6 }}>{value}</div>
    </div>
  );
  return (
    <Frame logo={logo} h={1080} footer={<Footer left={`${d.bills} bills · Aur poochhiye: “udhaar”, “stock”`} />}>
      <div style={{ display: "flex", fontSize: 24, fontWeight: 700, color: MUTED }}>{d.dayLabel.toUpperCase()}</div>
      <div style={{ display: "flex", fontSize: 58, fontWeight: 700, color: NAVY, marginBottom: 22 }}>{d.title}</div>
      <div style={{ ...row, gap: 18 }}>
        {tile("TOTAL", rupees(d.totalPaise), true)}
        {tile("UPI", rupees(d.upiPaise))}
        {tile("CASH", rupees(d.cashPaise))}
      </div>
      <div style={{ ...col, marginTop: 20, flex: 1 }}>
        {d.rows.length === 0 ? (
          <div style={{ display: "flex", fontSize: 32, color: MUTED, padding: "30px 0" }}>Abhi koi sale nahi hui.</div>
        ) : (
          d.rows.map((r, i) => (
            <div key={i} style={{ ...row, justifyContent: "space-between", padding: "16px 0", borderBottom: `2px solid ${RULE}` }}>
              <div style={{ ...row, gap: 24 }}>
                <div style={{ display: "flex", width: 100, fontSize: 30, color: MUTED }}>{r.time}</div>
                <div style={{ display: "flex", fontSize: 30, color: INK }}>{r.items.length > 24 ? r.items.slice(0, 23) + "…" : r.items}</div>
              </div>
              <div style={{ ...row, gap: 22 }}>
                <div style={{ display: "flex", fontSize: 22, fontWeight: 700, padding: "4px 18px", borderRadius: 999, background: r.by === "Cash" ? RULE : SOFT, color: r.by === "Cash" ? MUTED : NAVY }}>{r.by}</div>
                <div style={{ display: "flex", width: 130, justifyContent: "flex-end", fontSize: 30, fontWeight: 700, color: INK }}>{rupees(r.amountPaise)}</div>
              </div>
            </div>
          ))
        )}
      </div>
      <div style={{ ...row, gap: 14 }}>
        <Pill text={`Udhaar baaki ${rupees(d.udhaarPaise)}`} bg={WARN_SOFT} color={WARN} />
        <Pill text={`Stock kam: ${d.lowStock} item`} bg={SOFT} color={NAVY} />
      </div>
    </Frame>
  );
}

const Bubble = ({ text }: { text: string }) => (
  <div style={{ display: "flex", background: SOFT, border: `2px solid ${LINE}`, borderRadius: "24px 8px 24px 24px", padding: "28px 32px", fontSize: 32, lineHeight: 1.45, color: INK }}>{text}</div>
);

export function UdhaarCard({ d, logo }: { d: UdhaarCardData; logo: string }) {
  if (d.none)
    return (
      <Frame logo={logo} h={900} footer={<Footer left="Khata · Saathi" />}>
        <Pill text="Sab theek hai" bg={OK_SOFT} color={OK} />
        <div style={{ display: "flex", fontSize: 56, fontWeight: 700, color: NAVY, marginTop: 30 }}>Koi udhaar baaki nahi</div>
      </Frame>
    );
  return (
    <Frame logo={logo} h={900} footer={<Footer left="Khata · Saathi" />}>
      <div style={{ ...row }}>
        <Pill text={`${d.days} din late`} bg={WARN_SOFT} color={WARN} />
      </div>
      <div style={{ ...col, marginTop: 26 }}>
        <div style={{ display: "flex", fontSize: 24, fontWeight: 700, color: MUTED }}>KHATA</div>
        <div style={{ display: "flex", fontSize: 56, fontWeight: 700, color: NAVY }}>{`${d.customer} · ${rupees(d.amountPaise)}`}</div>
      </div>
      <div style={{ display: "flex", fontSize: 34, color: MUTED, margin: "26px 0 18px" }}>Saathi ne yeh reminder draft kiya hai:</div>
      <Bubble text={d.draft} />
    </Frame>
  );
}

export function StockCard({ d, logo }: { d: StockCardData; logo: string }) {
  if (d.none)
    return (
      <Frame logo={logo} h={900} footer={<Footer left="Stock · Saathi" />}>
        <Pill text="Sab theek hai" bg={OK_SOFT} color={OK} />
        <div style={{ display: "flex", fontSize: 56, fontWeight: 700, color: NAVY, marginTop: 30 }}>Koi item kam nahi hai</div>
      </Frame>
    );
  return (
    <Frame logo={logo} h={900} footer={<Footer left="Stock · Saathi" />}>
      <div style={{ ...row }}>
        <Pill text={d.out ? "Stock khatam" : "Stock kam hai"} bg={WARN_SOFT} color={WARN} />
      </div>
      <div style={{ ...col, marginTop: 26 }}>
        <div style={{ display: "flex", fontSize: 24, fontWeight: 700, color: MUTED }}>STOCK</div>
        <div style={{ display: "flex", fontSize: 54, fontWeight: 700, color: NAVY }}>{d.out ? `${d.item}: khatam ho gaya` : `${d.item}: sirf ${d.left} bacha`}</div>
      </div>
      <div style={{ display: "flex", height: 28, borderRadius: 14, background: RULE, overflow: "hidden", margin: "28px 0" }}>
        <div style={{ display: "flex", height: 28, width: `${d.meter}%`, background: WARN }} />
      </div>
      <div style={{ display: "flex", fontSize: 34, color: MUTED, marginBottom: 18 }}>Saathi ne supplier ka order draft kiya hai:</div>
      <Bubble text={d.draft} />
    </Frame>
  );
}
