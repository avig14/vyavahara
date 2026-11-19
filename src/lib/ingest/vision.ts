/**
 * Claude vision + structured extraction (PRD B9). The model only READS (bill, screenshot, spoken text).
 * All checks/arithmetic happen in code. `refusal` or unparsable output → null, callers ask the owner to resend.
 */
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, MODEL } from "../anthropic";

export const BillSchema = z.object({
  vendor_name: z.string().nullable(),
  invoice_no: z.string().nullable(),
  /** YYYY-MM-DD if readable */
  invoice_date: z.string().nullable(),
  items: z.array(
    z.object({
      name: z.string(),
      qty: z.number(),
      unit: z.string().nullable(),
      unit_price: z.number().nullable(),
      line_total: z.number().nullable(),
    }),
  ),
  total: z.number().nullable(),
});
export type Bill = z.infer<typeof BillSchema>;

export const ImageKind = z.object({ kind: z.enum(["supplier_bill", "payment_screenshot", "other"]) });

export const PaymentShotSchema = z.object({
  amount: z.number().nullable(),
  utr: z.string().nullable(),
  /** ISO 8601 with +05:30 if the screenshot shows date and time */
  datetime: z.string().nullable(),
  payee_name: z.string().nullable(),
  app: z.string().nullable(),
});
export type PaymentShotRaw = z.infer<typeof PaymentShotSchema>;

export const SoundboxParse = z.object({
  intent: z.enum(["purchase", "enquiry", "complaint", "refund", "other"]),
  items: z.array(z.object({ name: z.string(), qty: z.number() })),
  asked_availability: z.boolean(),
});
export type SoundboxParseT = z.infer<typeof SoundboxParse>;

type Mime = "image/jpeg" | "image/png" | "image/gif" | "image/webp";
export interface ImageInput {
  base64: string;
  mime: Mime;
}

type ClientLike = Pick<Anthropic, "messages">;

async function parseWith<T extends z.ZodType>(
  client: ClientLike,
  schema: T,
  content: Anthropic.Messages.ContentBlockParam[],
  maxTokens: number,
): Promise<z.infer<T> | null> {
  const res = await client.messages.parse({
    model: MODEL,
    max_tokens: maxTokens,
    messages: [{ role: "user", content }],
    output_config: { format: zodOutputFormat(schema) },
  });
  if (res.stop_reason === "refusal") return null;
  return (res.parsed_output as z.infer<T> | null) ?? null;
}

const img = (i: ImageInput): Anthropic.Messages.ContentBlockParam => ({
  type: "image",
  source: { type: "base64", media_type: i.mime, data: i.base64 },
});

export async function classifyImage(i: ImageInput, client: ClientLike = getAnthropic()) {
  const r = await parseWith(client, ImageKind, [img(i), { type: "text", text: "What is this image? supplier_bill = a vendor/supplier invoice or bill; payment_screenshot = a UPI/app payment success screen; otherwise other." }], 100);
  return r?.kind ?? "other";
}

export function extractBill(i: ImageInput, client: ClientLike = getAnthropic()) {
  return parseWith(client, BillSchema, [img(i), { type: "text", text: "Extract this Indian supplier bill. Copy numbers exactly as printed; null if unreadable. Amounts in rupees as printed." }], 4000);
}

export function extractPaymentShot(i: ImageInput, client: ClientLike = getAnthropic()) {
  return parseWith(client, PaymentShotSchema, [img(i), { type: "text", text: "Read this UPI payment screenshot. Copy the amount in rupees, the UTR / transaction reference and the date-time exactly as shown; null if not visible. Do not guess." }], 600);
}

/** Text from STT (or typed) → structured shop-counter intent. Personal talk → intent "other". */
export function parseSoundbox(text: string, client: ClientLike = getAnthropic()) {
  return parseWith(
    client,
    SoundboxParse,
    [{ type: "text", text: `This is a short clip heard at a kirana shop counter (Hindi/English/Hinglish): "${text}"\nExtract the customer's intent and the items with quantities (default qty 1). Use intent "other" for anything that is not shop business.` }],
    500,
  );
}

/* ---------------- code-side validation (the model never does arithmetic) ---------------- */

export interface BillCheck {
  ok: boolean;
  /** Σ line_total (rupees) computed in code */
  lineSumRupees: number;
  printedTotalRupees: number | null;
  diffPct: number | null;
  problems: string[];
}

/** Σ line_total ≈ total within tolerancePct (settings.ingest.billTolerancePct). Lines missing a total fall back to qty × unit_price. */
export function validateBill(b: Bill, tolerancePct: number): BillCheck {
  const problems: string[] = [];
  if (!b.items.length) problems.push("Koi item nahi padha gaya");
  let sum = 0;
  for (const it of b.items) {
    const t = it.line_total ?? (it.unit_price !== null ? it.qty * it.unit_price : null);
    if (t === null) problems.push(`${it.name}: rate/amount padh nahi paya`);
    else sum += t;
    if (!(it.qty > 0)) problems.push(`${it.name}: quantity galat lagti hai`);
  }
  sum = Math.round(sum * 100) / 100;
  let diffPct: number | null = null;
  if (b.total === null) problems.push("Bill ka total padh nahi paya");
  else if (b.total > 0) {
    diffPct = (Math.abs(sum - b.total) / b.total) * 100;
    if (diffPct > tolerancePct) problems.push(`Items ka jod ₹${sum} hai par bill total ₹${b.total} — ${diffPct.toFixed(1)}% fark`);
  }
  return { ok: problems.length === 0, lineSumRupees: sum, printedTotalRupees: b.total, diffPct, problems };
}
