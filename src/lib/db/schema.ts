import {
  pgTable,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  jsonb,
  date,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";

/**
 * Money is stored in INTEGER PAISE. Timestamps are timestamptz.
 * Every merchant-owned table has merchant_id (PRD B4).
 */

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const ts = (name: string) => timestamp(name, { withTimezone: true });
const createdAt = () => ts("created_at").notNull().defaultNow();
const num = (name: string) => numeric(name, { mode: "number" });

export const merchants = pgTable("merchants", {
  id: id(),
  name: text("name").notNull(),
  ownerName: text("owner_name").notNull(),
  ownerPhoneWa: text("owner_phone_wa"),
  waConnectedAt: ts("wa_connected_at"),
  waLastInboundAt: ts("wa_last_inbound_at"),
  upiId: text("upi_id"),
  gstScheme: text("gst_scheme", { enum: ["composition", "regular", "none"] })
    .notNull()
    .default("composition"),
  city: text("city"),
  /** merchant-tunable thresholds, validated by src/lib/settings.ts */
  settings: jsonb("settings").notNull().default({}),
  createdAt: createdAt(),
});

export const products = pgTable(
  "products",
  {
    id: id(),
    merchantId: text("merchant_id").notNull(),
    sku: text("sku").notNull(),
    name: text("name").notNull(),
    aliases: text("aliases").array().notNull().default([]),
    category: text("category").notNull(),
    unit: text("unit").notNull(),
    packSize: integer("pack_size").notNull().default(1),
    pricePaise: integer("price_paise").notNull(),
    costPaise: integer("cost_paise").notNull(),
    gstRate: num("gst_rate").notNull().default(0),
    stockQty: num("stock_qty").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [index("products_merchant_idx").on(t.merchantId)],
);

export const vendors = pgTable("vendors", {
  id: id(),
  merchantId: text("merchant_id").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  leadTimeDays: integer("lead_time_days").notNull().default(2),
  paymentTermsDays: integer("payment_terms_days").notNull().default(7),
});

export const vendorProducts = pgTable(
  "vendor_products",
  {
    vendorId: text("vendor_id").notNull(),
    productId: text("product_id").notNull(),
    lastCostPaise: integer("last_cost_paise").notNull(),
    prevCostPaise: integer("prev_cost_paise"),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.vendorId, t.productId] })],
);

export const purchases = pgTable("purchases", {
  id: id(),
  merchantId: text("merchant_id").notNull(),
  vendorId: text("vendor_id").notNull(),
  invoiceNo: text("invoice_no"),
  invoiceDate: date("invoice_date", { mode: "string" }).notNull(),
  totalPaise: integer("total_paise").notNull(),
  dueDate: date("due_date", { mode: "string" }).notNull(),
  status: text("status", { enum: ["unpaid", "partial", "paid"] })
    .notNull()
    .default("unpaid"),
  source: text("source", { enum: ["photo", "manual", "seed"] })
    .notNull()
    .default("manual"),
});

export const purchaseItems = pgTable("purchase_items", {
  id: id(),
  purchaseId: text("purchase_id").notNull(),
  productId: text("product_id").notNull(),
  qty: num("qty").notNull(),
  unitCostPaise: integer("unit_cost_paise").notNull(),
  gstRate: num("gst_rate").notNull().default(0),
});

export const vendorPayments = pgTable("vendor_payments", {
  id: id(),
  merchantId: text("merchant_id").notNull(),
  vendorId: text("vendor_id").notNull(),
  amountPaise: integer("amount_paise").notNull(),
  createdAt: createdAt(),
});

export const purchaseOrders = pgTable("purchase_orders", {
  id: id(),
  merchantId: text("merchant_id").notNull(),
  vendorId: text("vendor_id").notNull(),
  items: jsonb("items").notNull().$type<
    { productId: string; name: string; qty: number; unit: string }[]
  >(),
  status: text("status", { enum: ["drafted", "sent", "received"] })
    .notNull()
    .default("drafted"),
  createdAt: createdAt(),
});

export const customers = pgTable("customers", {
  id: id(),
  merchantId: text("merchant_id").notNull(),
  name: text("name").notNull(),
  vpaHash: text("vpa_hash"),
  creditLimitPaise: integer("credit_limit_paise").notNull().default(0),
  creditBlocked: boolean("credit_blocked").notNull().default(false),
  createdAt: createdAt(),
});

export const transactions = pgTable(
  "transactions",
  {
    id: id(),
    merchantId: text("merchant_id").notNull(),
    customerId: text("customer_id"),
    amountPaise: integer("amount_paise").notNull(),
    method: text("method", { enum: ["upi", "cash", "card"] }).notNull(),
    kind: text("kind", { enum: ["sale", "refund"] })
      .notNull()
      .default("sale"),
    utr: text("utr"),
    payerVpaHash: text("payer_vpa_hash"),
    source: text("source", {
      enum: ["paytm", "soundbox", "manual", "seed"],
    }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("txn_merchant_created_idx").on(t.merchantId, t.createdAt)],
);

export const saleItems = pgTable(
  "sale_items",
  {
    id: id(),
    merchantId: text("merchant_id").notNull(),
    transactionId: text("transaction_id").notNull(),
    productId: text("product_id").notNull(),
    qty: num("qty").notNull(),
    unitPricePaise: integer("unit_price_paise").notNull(),
    unitCostPaise: integer("unit_cost_paise").notNull(),
    confidence: text("confidence", { enum: ["confirmed", "probable"] })
      .notNull()
      .default("confirmed"),
    createdAt: createdAt(),
  },
  (t) => [index("sale_items_merchant_created_idx").on(t.merchantId, t.createdAt)],
);

export const stockMovements = pgTable("stock_movements", {
  id: id(),
  merchantId: text("merchant_id").notNull(),
  productId: text("product_id").notNull(),
  delta: num("delta").notNull(),
  reason: text("reason", { enum: ["sale", "purchase", "adjust"] }).notNull(),
  refId: text("ref_id"),
  createdAt: createdAt(),
});

export const khataEntries = pgTable(
  "khata_entries",
  {
    id: id(),
    merchantId: text("merchant_id").notNull(),
    customerId: text("customer_id").notNull(),
    type: text("type", { enum: ["credit", "payment"] }).notNull(),
    amountPaise: integer("amount_paise").notNull(),
    note: text("note"),
    source: text("source"),
    createdAt: createdAt(),
  },
  (t) => [index("khata_merchant_customer_idx").on(t.merchantId, t.customerId)],
);

export const expenses = pgTable("expenses", {
  id: id(),
  merchantId: text("merchant_id").notNull(),
  category: text("category", {
    enum: ["rent", "electricity", "salary", "transport", "other"],
  }).notNull(),
  amountPaise: integer("amount_paise").notNull(),
  note: text("note"),
  createdAt: createdAt(),
});

export const lostDemand = pgTable("lost_demand", {
  id: id(),
  merchantId: text("merchant_id").notNull(),
  productId: text("product_id").notNull(),
  rawText: text("raw_text"),
  qty: num("qty").notNull().default(1),
  estValuePaise: integer("est_value_paise").notNull(),
  createdAt: createdAt(),
});

export const soundboxEvents = pgTable("soundbox_events", {
  id: id(),
  merchantId: text("merchant_id").notNull(),
  transcript: text("transcript"),
  parsed: jsonb("parsed"),
  intent: text("intent"),
  reconciledTxnId: text("reconciled_txn_id"),
  createdAt: createdAt(),
});

export const festivals = pgTable("festivals", {
  id: id(),
  name: text("name").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  categories: text("categories").array().notNull().default([]),
});

export const alerts = pgTable("alerts", {
  id: id(),
  merchantId: text("merchant_id").notNull(),
  kind: text("kind", { enum: ["khata_red"] }).notNull(),
  subjectId: text("subject_id").notNull(),
  payload: jsonb("payload").notNull(),
  status: text("status", {
    enum: ["queued", "sent", "delivered_on_next", "dismissed"],
  })
    .notNull()
    .default("queued"),
  createdAt: createdAt(),
  sentAt: ts("sent_at"),
});

export const recommendationsLog = pgTable("recommendations_log", {
  id: id(),
  merchantId: text("merchant_id").notNull(),
  type: text("type").notNull(),
  impactPaise: integer("impact_paise").notNull().default(0),
  acted: boolean("acted").notNull().default(false),
  createdAt: createdAt(),
});

export const artifacts = pgTable("artifacts", {
  id: id(),
  merchantId: text("merchant_id").notNull(),
  kind: text("kind", { enum: ["report_pdf", "pay_link"] }).notNull(),
  token: text("token").notNull().unique(),
  params: jsonb("params").notNull(),
  expiresAt: ts("expires_at").notNull(),
  createdAt: createdAt(),
});

export const waSessions = pgTable("wa_sessions", {
  merchantId: text("merchant_id").primaryKey(),
  menuPath: text("menu_path"),
  context: jsonb("context"),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

/** Every WhatsApp message in or out: powers the dashboard's delivery status and de-duplicates Meta's webhook retries. */
export const waMessages = pgTable(
  "wa_messages",
  {
    id: id(),
    merchantId: text("merchant_id").notNull(),
    /** Meta's message id (wamid). Null only while an outbound message is still being sent. */
    wamid: text("wamid").unique(),
    direction: text("direction", { enum: ["out", "in"] }).notNull(),
    kind: text("kind", { enum: ["report", "template", "reply", "menu", "inbound"] }).notNull(),
    /** first line only, never the whole report */
    preview: text("preview").notNull().default(""),
    status: text("status", { enum: ["sending", "sent", "delivered", "read", "failed", "received"] }).notNull(),
    errorCode: integer("error_code"),
    errorText: text("error_text"),
    createdAt: createdAt(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("wa_msg_merchant_created_idx").on(t.merchantId, t.createdAt)],
);

export const pendingActions = pgTable("pending_actions", {
  id: id(),
  merchantId: text("merchant_id").notNull(),
  kind: text("kind").notNull(),
  payload: jsonb("payload").notNull(),
  status: text("status", { enum: ["open", "confirmed", "cancelled", "expired"] })
    .notNull()
    .default("open"),
  expiresAt: ts("expires_at").notNull(),
  createdAt: createdAt(),
});

export const conversations = pgTable(
  "conversations",
  {
    id: id(),
    merchantId: text("merchant_id").notNull(),
    channel: text("channel", { enum: ["wa", "web"] }).notNull(),
    role: text("role", { enum: ["user", "assistant"] }).notNull(),
    content: text("content").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("conv_merchant_created_idx").on(t.merchantId, t.createdAt)],
);

export const auditLog = pgTable("audit_log", {
  id: id(),
  merchantId: text("merchant_id").notNull(),
  actor: text("actor", { enum: ["ai", "owner", "system"] }).notNull(),
  action: text("action").notNull(),
  payload: jsonb("payload"),
  createdAt: createdAt(),
});
