import { DEFAULT_SETTINGS } from "../settings";
/**
 * Pure, deterministic demo-data generator (PRD B5). No DB, no network.
 * `generateSnapshot()` returns a full `Snapshot`; `scripts/seed.ts` writes it to Neon,
 * tests and analytics use it directly. Dates are relative to `now`.
 */
import seedrandom from "seedrandom";
import type {
  Customer,
  Expense,
  Festival,
  KhataEntry,
  LostDemand,
  Merchant,
  Product,
  Purchase,
  PurchaseItem,
  SaleItem,
  Snapshot,
  Txn,
  Vendor,
  VendorPayment,
  VendorProduct,
} from "../domain";
import { hashVpa } from "../hash";
import { addDays, istDayKey, istDayStart, istDaysBetween, istDom, istWeekday, startOfIstDay } from "../time";
import { DIWALI_UPLIFT, FESTIVALS, PRODUCTS, VENDORS, type ProductDef, type VendorKey } from "./catalog";

export interface SeedOptions {
  now?: Date;
  days?: number;
  ownerPhoneWa?: string | null;
  upiId?: string;
  /** scales the Gupta Agency bulk invoice; tunes the cash-shortfall story */
  bulkScale?: number;
}

const MIN = 60_000;
const HOUR_WEIGHTS: Record<number, number> = {
  7: 2, 8: 6, 9: 7, 10: 5, 11: 3.5, 12: 3, 13: 3, 14: 2.5, 15: 2.5, 16: 3, 17: 4.5, 18: 7, 19: 8, 20: 6, 21: 2.5,
};
const HOURS = Object.keys(HOUR_WEIGHTS).map(Number);
const HOUR_TOTAL = HOURS.reduce((s, h) => s + HOUR_WEIGHTS[h], 0);
/** 0 = Sunday … 6 = Saturday (PRD: Sun 1.3, Sat 1.2, Mon 0.9) */
const WEEKDAY_MULT = [1.3, 0.9, 1, 1, 1, 1, 1.2];
const AVG_WEEKDAY = WEEKDAY_MULT.reduce((a, b) => a + b, 0) / 7;
/** Target mean daily sales (paise) before festival effects ≈ ₹3.4 lakh/month UPI at 70% share */
const TARGET_DAILY_PAISE = 1_580_000;
export const PARLEG_HIKE_DAYS_AGO = 12;
const PARLEG_OLD_COST = 2300;
const PARLEG_NEW_COST = 2484; // 2300 × 1.08
const TODAY_DIP = 0.6;
const TAAZA_STOCKOUT_DAYS = 4;
const DIWALI = FESTIVALS[0].date;

type CustGroup = "regular" | "lapsed" | "occasional" | "new";
interface CustDef {
  key: string;
  name: string;
  group: CustGroup;
  limit: number;
  fromOff: number;
  toOff: number;
  gap: number;
}

const REGULARS: [string, string, number][] = [
  ["ramesh", "Ramesh Yadav", 300000],
  ["pooja", "Pooja Sharma", 200000],
  ["suresh", "Suresh Patel", 250000],
  ["anita", "Anita Joshi", 150000],
  ["vikas", "Vikas Patil", 150000],
  ["mohan", "Mohan Lal", 300000],
  ["rajesh", "Rajesh Kumar", 150000],
  ["kamla", "Kamla Devi", 150000],
  ["sunita", "Sunita Deshmukh", 150000],
  ["amit", "Amit Kulkarni", 150000],
  ["neha", "Neha Shah", 150000],
  ["prakash", "Prakash Jadhav", 150000],
  ["sanjay", "Sanjay More", 150000],
  ["lata", "Lata Pawar", 150000],
  ["dinesh", "Dinesh Shinde", 150000],
];
const LAPSED = [
  "Geeta Nair", "Harish Iyer", "Meera Kapoor", "Arjun Singh", "Kavita Rao", "Vijay Chavan",
  "Sneha Gokhale", "Rohit Bhosale", "Asha Menon", "Manoj Tiwari", "Divya Reddy", "Sachin Gaikwad",
];
const OCCASIONAL = [
  "Farhan Sheikh", "Joseph D'Souza", "Priya Nambiar", "Gurpreet Kaur", "Ashok Mehta", "Swati Phadke",
  "Nitin Salunkhe", "Rekha Bapat",
];
const NEWBIES = ["Tanvi Kale", "Omkar Dhumal", "Shruti Naik", "Yash Thakur"];


type KhataEntrySpec = { off: number; type: "credit" | "payment"; paise: number };

function rameshEntries(): KhataEntrySpec[] {
  const credits: [number, number, number][] = [
    [85, 20000, 3], [75, 35000, 2], [64, 25000, 5], [55, 40000, 4], [43, 30000, 6], [33, 25000, 3], [22, 35000, 2],
    [12, 22000, 4],
  ];
  const out: KhataEntrySpec[] = [];
  for (const [off, paise, gap] of credits) {
    out.push({ off, type: "credit", paise });
    out.push({ off: off - gap, type: "payment", paise });
  }
  out.push({ off: 3, type: "credit", paise: 25000 });
  return out;
}

interface KhataScript {
  cust: string;
  entries: KhataEntrySpec[];
}

/** Engineered khata stories (PRD B5). Amounts in paise. */
const KHATA_SCRIPTS: KhataScript[] = [
  {
    // 🟢 small credits, repaid in < 7 days
    cust: "ramesh",
    entries: rameshEntries(),
  },
  {
    // 🟡 ₹900 due, 20 days
    cust: "pooja",
    entries: [
      { off: 80, type: "credit", paise: 60000 },
      { off: 62, type: "payment", paise: 60000 },
      { off: 45, type: "credit", paise: 50000 },
      { off: 30, type: "payment", paise: 50000 },
      { off: 20, type: "credit", paise: 90000 },
    ],
  },
  {
    // 🔴 ₹2,400 due, oldest unpaid 52 days, ₹500 repaid in 90 days, still borrowing
    cust: "suresh",
    entries: [
      { off: 88, type: "credit", paise: 50000 },
      { off: 70, type: "payment", paise: 50000 },
      { off: 52, type: "credit", paise: 70000 },
      { off: 35, type: "credit", paise: 60000 },
      { off: 18, type: "credit", paise: 50000 },
      { off: 5, type: "credit", paise: 60000 },
    ],
  },
  {
    cust: "mohan",
    entries: [
      { off: 40, type: "credit", paise: 120000 },
      { off: 20, type: "payment", paise: 100000 },
    ],
  },
  { cust: "anita", entries: [{ off: 3, type: "credit", paise: 35000 }] },
  { cust: "vikas", entries: [{ off: 8, type: "credit", paise: 45000 }] },
  {
    cust: "rajesh",
    entries: [
      { off: 14, type: "credit", paise: 60000 },
      { off: 9, type: "payment", paise: 60000 },
      { off: 2, type: "credit", paise: 25000 },
    ],
  },
  {
    cust: "kamla",
    entries: [
      { off: 12, type: "credit", paise: 30000 },
      { off: 6, type: "payment", paise: 30000 },
    ],
  },
];

export function generateSnapshot(opts: SeedOptions = {}): Snapshot {
  const now = opts.now ?? new Date();
  const days = opts.days ?? 120;
  const bulkScale = opts.bulkScale ?? 1;
  const rng = seedrandom("vyapaar");

  // ---------- random helpers ----------
  const rand = () => rng();
  const randInt = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
  const gauss = () => {
    let u = 0;
    while (u === 0) u = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
  };
  const poisson = (lam: number) => {
    if (lam <= 0) return 0;
    if (lam > 30) return Math.max(0, Math.round(lam + Math.sqrt(lam) * gauss()));
    const L = Math.exp(-lam);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= rand();
    } while (p > L);
    return k - 1;
  };
  const shuffle = <T>(xs: T[]) => {
    for (let i = xs.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [xs[i], xs[j]] = [xs[j], xs[i]];
    }
    return xs;
  };

  // ---------- time helpers ----------
  const todayStart = startOfIstDay(now);
  const nowMin = (now.getTime() - todayStart.getTime()) / MIN;
  const dayStartOff = (off: number) => addDays(todayStart, -off);
  const at = (off: number, minuteOfDay: number) => new Date(dayStartOff(off).getTime() + minuteOfDay * MIN);
  const todayKey = istDayKey(now);

  /** share of the day's expected sales that has happened by `maxMin` */
  const profileFraction = (maxMin: number) => {
    let s = 0;
    for (const h of HOURS) s += HOUR_WEIGHTS[h] * Math.min(1, Math.max(0, (maxMin - h * 60) / 60));
    return s / HOUR_TOTAL;
  };
  const sampleMinute = (maxMin: number) => {
    const w = HOURS.map((h) => HOUR_WEIGHTS[h] * Math.min(1, Math.max(0, (maxMin - h * 60) / 60)));
    const tot = w.reduce((a, b) => a + b, 0);
    if (tot <= 0) return 8 * 60;
    let r = rand() * tot;
    for (let i = 0; i < HOURS.length; i++) {
      r -= w[i];
      if (r <= 0) {
        const avail = Math.min(1, Math.max(0, (maxMin - HOURS[i] * 60) / 60));
        return HOURS[i] * 60 + rand() * 60 * avail;
      }
    }
    return 9 * 60;
  };

  // ---------- merchant ----------
  const MID = "m_demo";
  const merchant: Merchant = {
    id: MID,
    name: "Gupta General Store",
    ownerName: "Anil Gupta",
    ownerPhoneWa: opts.ownerPhoneWa ?? null,
    waConnectedAt: null,
    waLastInboundAt: null,
    upiId: opts.upiId ?? "guptastore@paytm",
    gstScheme: "composition",
    city: "Pune",
  };

  // ---------- vendors ----------
  const vendors: Vendor[] = VENDORS.map((v) => ({
    id: `v_${v.key}`,
    name: v.name,
    phone: v.phone,
    leadTimeDays: v.leadTimeDays,
    paymentTermsDays: v.paymentTermsDays,
  }));
  const vendorDef = new Map(VENDORS.map((v) => [v.key, v]));

  // ---------- demand scale ----------
  const baselinePaise = PRODUCTS.reduce((s, p) => s + p.lambda * p.price, 0) * AVG_WEEKDAY;
  const scale = TARGET_DAILY_PAISE / baselinePaise;

  const festMult = (cat: string, off: number) => {
    const toD = istDaysBetween(dayStartOff(off), istDayStart(DIWALI));
    return toD >= 0 && toD <= 7 ? (DIWALI_UPLIFT[cat] ?? 1) : 1;
  };
  const wdOf = (off: number) => WEEKDAY_MULT[istWeekday(dayStartOff(off))];
  const costAt = (p: ProductDef, off: number) =>
    p.key === "parleg" ? (off <= PARLEG_HIKE_DAYS_AGO ? PARLEG_NEW_COST : PARLEG_OLD_COST) : p.cost;
  const canSell = (p: ProductDef, off: number) => {
    if (p.lastSaleDaysAgo !== undefined && off < p.lastSaleDaysAgo) return false;
    if (p.key === "taaza" && off < TAAZA_STOCKOUT_DAYS) return false;
    return true;
  };

  // ---------- customers ----------
  const custDefs: CustDef[] = [];
  for (const [key, name, limit] of REGULARS)
    custDefs.push({ key, name, group: "regular", limit, fromOff: days - 1, toOff: 0, gap: 2 + Math.floor(rand() * 3) });
  LAPSED.forEach((name, i) =>
    custDefs.push({
      key: `lapsed${i}`,
      name,
      group: "lapsed",
      limit: 150000,
      fromOff: 100 - Math.floor(rand() * 8),
      toOff: 16 + Math.floor(rand() * 15),
      gap: 4 + Math.floor(rand() * 2),
    }),
  );
  OCCASIONAL.forEach((name, i) =>
    custDefs.push({ key: `occ${i}`, name, group: "occasional", limit: 0, fromOff: days - 1, toOff: 0, gap: 35 }),
  );
  NEWBIES.forEach((name, i) =>
    custDefs.push({ key: `new${i}`, name, group: "new", limit: 0, fromOff: 9 - i, toOff: 0, gap: 3 }),
  );
  const custId = (key: string) => `c_${key}`;
  const vpaHashOf = new Map(custDefs.map((c) => [c.key, hashVpa(`${c.key}@paytm`)]));

  // ---------- sales ----------
  const transactions: Txn[] = [];
  const saleItems: SaleItem[] = [];
  const firstSeen = new Map<string, number>();
  const lastVisitOff = new Map<string, number>();
  let tn = 0;
  let sn = 0;
  const anonPool = Array.from({ length: 400 }, (_, i) => hashVpa(`anon${i}@upi`));
  const utr = () => String(randInt(100000000000, 999999999999));

  for (let off = days - 1; off >= 0; off--) {
    const isToday = off === 0;
    const maxMin = isToday ? nowMin : Infinity;
    const frac = isToday ? profileFraction(nowMin) : 1;
    if (frac <= 0) continue;
    const dayNoise = Math.min(1.12, Math.max(0.88, 1 + 0.05 * gauss()));
    const dip = isToday ? TODAY_DIP : 1;
    const wd = wdOf(off);

    type Line = { p: ProductDef; qty: number };
    const lines: Line[] = [];
    for (const p of PRODUCTS) {
      if (!canSell(p, off)) continue;
      const lam = p.lambda * scale * wd * festMult(p.category, off) * dayNoise * dip * frac;
      let u = poisson(lam);
      while (u > 0) {
        const q = u > 1 && rand() < 0.22 ? Math.min(u, 2 + Math.floor(rand() * 2)) : 1;
        lines.push({ p, qty: q });
        u -= q;
      }
    }
    if (lines.length === 0) continue;
    const nBaskets = Math.max(1, Math.round(lines.length / (2.3 + 0.3 * gauss())));
    const baskets: Line[][] = Array.from({ length: nBaskets }, () => []);
    for (const ln of shuffle(lines)) baskets[Math.floor(rand() * nBaskets)].push(ln);
    const used = baskets.filter((b) => b.length > 0);

    // customer visits for this day pick baskets
    const free = shuffle(used.map((_, i) => i));
    const owner = new Map<number, string>();
    for (const c of custDefs) {
      if (off > c.fromOff || off < c.toOff) continue;
      const since = off === c.fromOff ? 0 : (lastVisitOff.get(c.key) ?? c.fromOff + 1) - off;
      // regulars never go quiet for more than a week; occasional shoppers never cluster
      const forced = (c.group === "regular" || c.group === "lapsed") && since >= 7;
      const cooling = c.group === "occasional" && since < 10;
      if (cooling || (!forced && rand() >= 1 / c.gap)) continue;
      const bi = free.pop();
      if (bi === undefined) break;
      owner.set(bi, c.key);
      lastVisitOff.set(c.key, off);
    }

    used.forEach((basket, bi) => {
      const when = new Date(dayStartOff(off).getTime() + sampleMinute(maxMin) * MIN);
      const ckey = owner.get(bi);
      const isUpi = ckey !== undefined || rand() < 0.7;
      const id = `t_${String(++tn).padStart(6, "0")}`;
      let amount = 0;
      for (const ln of basket) {
        amount += ln.qty * ln.p.price;
        saleItems.push({
          id: `si_${String(++sn).padStart(6, "0")}`,
          transactionId: id,
          productId: `p_${ln.p.key}`,
          qty: ln.qty,
          unitPricePaise: ln.p.price,
          unitCostPaise: costAt(ln.p, off),
          confidence: "confirmed",
          createdAt: when,
        });
      }
      if (ckey && !firstSeen.has(ckey)) firstSeen.set(ckey, when.getTime());
      transactions.push({
        id,
        customerId: ckey ? custId(ckey) : null,
        amountPaise: amount,
        method: isUpi ? "upi" : "cash",
        kind: "sale",
        utr: isUpi ? utr() : null,
        payerVpaHash: isUpi ? (ckey ? (vpaHashOf.get(ckey) ?? null) : anonPool[randInt(0, anonPool.length - 1)]) : null,
        source: isUpi ? "paytm" : "manual",
        createdAt: when,
      });
    });

    // occasional small refund
    if (!isToday && rand() < 0.1) {
      transactions.push({
        id: `t_${String(++tn).padStart(6, "0")}`,
        customerId: null,
        amountPaise: randInt(30, 150) * 100,
        method: "upi",
        kind: "refund",
        utr: utr(),
        payerVpaHash: anonPool[randInt(0, anonPool.length - 1)],
        source: "paytm",
        createdAt: at(off, sampleMinute(Infinity)),
      });
    }
  }
  transactions.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  // ---------- khata ----------
  const khata: KhataEntry[] = [];
  let kn = 0;
  const khataFirst = new Map<string, number>();
  for (const s of KHATA_SCRIPTS) {
    for (const e of s.entries) {
      const when = at(e.off, 12 * 60 + randInt(0, 300));
      if (when.getTime() > now.getTime()) continue;
      const t = when.getTime();
      khataFirst.set(s.cust, Math.min(khataFirst.get(s.cust) ?? t, t));
      khata.push({
        id: `k_${String(++kn).padStart(4, "0")}`,
        customerId: custId(s.cust),
        type: e.type,
        amountPaise: e.paise,
        note: e.type === "credit" ? "Saaman udhaar" : rand() < 0.6 ? "UPI se payment" : "Cash diya",
        source: "seed",
        createdAt: when,
      });
    }
  }
  khata.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const customers: Customer[] = custDefs.map((c) => {
    const t = Math.min(firstSeen.get(c.key) ?? Infinity, khataFirst.get(c.key) ?? Infinity);
    return {
      id: custId(c.key),
      name: c.name,
      vpaHash: vpaHashOf.get(c.key) ?? null,
      creditLimitPaise: c.limit,
      creditBlocked: false,
      createdAt: isFinite(t) ? new Date(t) : at(c.fromOff, 10 * 60),
    };
  });

  // ---------- products & stock ----------
  const expectedDaily = (p: ProductDef) => {
    let s = 0;
    for (let i = 1; i <= 7; i++) s += WEEKDAY_MULT[istWeekday(addDays(now, i))];
    return p.lambda * scale * (s / 7);
  };
  const products: Product[] = PRODUCTS.map((p) => {
    let stock: number;
    if (p.fixedStock !== undefined) stock = p.fixedStock;
    else if (p.key === "maggi") stock = Math.round(2.2 * expectedDaily(p));
    else {
      const cover = p.cover ?? 6 + rand() * 8;
      stock = cover === 0 ? 0 : Math.max(p.pack > 1 ? 2 : 1, Math.round(expectedDaily(p) * cover));
    }
    return {
      id: `p_${p.key}`,
      sku: `SKU-${p.key.toUpperCase()}`,
      name: p.name,
      aliases: p.aliases,
      category: p.category,
      unit: p.unit,
      packSize: p.pack,
      pricePaise: p.price,
      costPaise: costAt(p, 0),
      gstRate: p.gst,
      stockQty: stock,
      isActive: true,
    };
  });

  // ---------- vendors, purchases, payments ----------
  const vendorProducts: VendorProduct[] = [];
  for (const p of PRODUCTS) {
    const isParle = p.key === "parleg";
    vendorProducts.push({
      vendorId: `v_${p.vendor}`,
      productId: `p_${p.key}`,
      lastCostPaise: costAt(p, 0),
      prevCostPaise: isParle ? PARLEG_OLD_COST : null,
      updatedAt: addDays(now, isParle ? -PARLEG_HIKE_DAYS_AGO : -30),
    });
  }
  // Gupta Agency also supplies Parle-G, 5% cheaper than Sharma's new rate
  vendorProducts.push({
    vendorId: "v_gupta",
    productId: "p_parleg",
    lastCostPaise: Math.round(PARLEG_NEW_COST * 0.95),
    prevCostPaise: null,
    updatedAt: addDays(now, -20),
  });

  const purchases: Purchase[] = [];
  const purchaseItems: PurchaseItem[] = [];
  const vendorPayments: VendorPayment[] = [];
  let pn = 0;
  let pin = 0;
  let pyn = 0;
  const invNo = new Map<VendorKey, number>();

  const addPurchase = (vk: VendorKey, off: number, items: { p: ProductDef; qty: number; cost: number }[]) => {
    const v = vendorDef.get(vk)!;
    const total = items.reduce((s, i) => s + i.qty * i.cost, 0);
    const date = dayStartOff(off);
    const due = addDays(date, v.paymentTermsDays);
    const dueKey = istDayKey(due);
    const paid = dueKey < todayKey;
    const n = (invNo.get(vk) ?? 1000) + 1;
    invNo.set(vk, n);
    const id = `pu_${String(++pn).padStart(4, "0")}`;
    purchases.push({
      id,
      vendorId: `v_${vk}`,
      invoiceNo: `${vk.slice(0, 3).toUpperCase()}-${n}`,
      invoiceDate: istDayKey(date),
      totalPaise: total,
      dueDate: dueKey,
      status: paid ? "paid" : "unpaid",
      source: "seed",
    });
    for (const i of items)
      purchaseItems.push({
        id: `pi_${String(++pin).padStart(5, "0")}`,
        purchaseId: id,
        productId: `p_${i.p.key}`,
        qty: i.qty,
        unitCostPaise: i.cost,
        gstRate: i.p.gst,
      });
    if (paid)
      vendorPayments.push({
        id: `vp_${String(++pyn).padStart(4, "0")}`,
        vendorId: `v_${vk}`,
        amountPaise: total,
        createdAt: new Date(istDayStart(dueKey).getTime() + 11 * 60 * MIN),
      });
  };

  const byKey = new Map(PRODUCTS.map((p) => [p.key, p]));
  const line = (key: string, qty: number, cost: number) => ({ p: byKey.get(key)!, qty, cost });

  for (const v of VENDORS) {
    const minOff = v.key === "sharma" ? 13 : v.key === "gupta" ? 12 : 0;
    for (let off = days - 4 - v.firstOffset; off >= minOff; off -= v.cycleDays) {
      const items: { p: ProductDef; qty: number; cost: number }[] = [];
      for (const p of PRODUCTS.filter((x) => x.vendor === v.key)) {
        if (p.lastSaleDaysAgo !== undefined && off < p.lastSaleDaysAgo + 7) continue;
        const need = p.lambda * scale * AVG_WEEKDAY * v.cycleDays * 1.15 * festMult(p.category, Math.max(0, off - 3));
        if (need < 0.5 && rand() < 0.5) continue;
        const qty = Math.max(p.pack, Math.ceil(need / p.pack) * p.pack);
        items.push({ p, qty, cost: costAt(p, off) });
      }
      if (items.length) addPurchase(v.key, off, items);
    }
  }
  // Story: Sharma Traders ₹12,400 due in 2 days (5 days ago + 7-day terms). Sums to exactly 1,240,000.
  addPurchase("sharma", 5, [
    line("parleg", 200, PARLEG_NEW_COST),
    line("goodday", 139, 2800),
    line("marie", 120, 2950),
  ]);
  // Story: Gupta Agency bulk snack stock (cash-shortfall tuning knob = bulkScale)
  const bq = (n: number) => Math.max(1, Math.round(n * bulkScale));
  addPurchase("gupta", 7, [
    line("lays", bq(400), 1650),
    line("kurkure", bq(300), 1700),
    line("bingo", bq(200), 1700),
    line("bhujia", bq(60), 4800),
    line("dairymilk", bq(100), 4300),
  ]);
  purchases.sort((a, b) => a.invoiceDate.localeCompare(b.invoiceDate));

  // ---------- expenses ----------
  const expenses: Expense[] = [];
  let en = 0;
  for (let off = days - 1; off >= 0; off--) {
    const d = dayStartOff(off);
    const dom = istDom(d);
    const push = (category: Expense["category"], paise: number, note: string, hour = 10) => {
      const when = at(off, hour * 60);
      if (when.getTime() > now.getTime()) return;
      expenses.push({ id: `e_${String(++en).padStart(4, "0")}`, category, amountPaise: paise, note, createdAt: when });
    };
    if (dom === 1) push("salary", 800000, "Helper salary");
    if (dom === 5) push("rent", 1500000, "Dukaan ka kiraya");
    if (dom === 10) push("electricity", randInt(2200, 2800) * 100, "Bijli bill");
    if (rand() < 0.1) push("transport", randInt(3, 8) * 10000, "Maal dhulai / transport", 15);
  }

  // ---------- lost demand ----------
  const lostDemand: LostDemand[] = [];
  let ln = 0;
  const taaza = byKey.get("taaza")!;
  const rawTexts = ["Amul Taaza hai?", "doodh chahiye", "taaza milk nahi hai kya", "milk packet do", "Amul doodh"];
  const perDay = [3, 4, 4, 3]; // offsets 0..3 → 14 rows this week
  perDay.forEach((count, off) => {
    for (let i = 0; i < count; i++) {
      const maxM = off === 0 ? Math.max(7 * 60, nowMin) : 21 * 60;
      const when = at(off, Math.min(maxM, 7 * 60 + rand() * (maxM - 7 * 60)));
      if (when.getTime() > now.getTime()) continue;
      const qty = rand() < 0.35 ? 2 : 1;
      lostDemand.push({
        id: `ld_${String(++ln).padStart(3, "0")}`,
        productId: `p_${taaza.key}`,
        rawText: rawTexts[randInt(0, rawTexts.length - 1)],
        qty,
        estValuePaise: qty * taaza.price,
        createdAt: when,
      });
    }
  });
  for (const off of [9, 10, 12, 13]) {
    lostDemand.push({
      id: `ld_${String(++ln).padStart(3, "0")}`,
      productId: "p_curd",
      rawText: "dahi khatam?",
      qty: 1,
      estValuePaise: byKey.get("curd")!.price,
      createdAt: at(off, 9 * 60 + randInt(0, 600)),
    });
  }
  lostDemand.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  // ---------- festivals ----------
  const festivals: Festival[] = FESTIVALS.map((f, i) => ({
    id: `f_${i + 1}`,
    name: f.name,
    date: f.date,
    categories: f.categories,
  }));

  return {
    now,
    merchant,
    // demo shop keeps a small cash float; the owner can change this in Settings
    settings: { ...DEFAULT_SETTINGS, cash: { ...DEFAULT_SETTINGS.cash, openingBalancePaise: 800_000 } },
    products,
    vendors,
    vendorProducts,
    purchases,
    purchaseItems,
    vendorPayments,
    customers,
    transactions,
    saleItems,
    khata,
    expenses,
    lostDemand,
    festivals,
  };
}
