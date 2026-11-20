/** Owner-facing wording for what the bot read from a photo. Pure: numbers come from code, never from the model. */
import type { BillReview } from "../ingest/bill-plan";
import type { PaymentCheck } from "../ingest/reconcile";
import { num, rupees } from "../format";

const time = (d: Date) => d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });

export function billReply(r: BillReview, saved: boolean): string {
  if (!saved || r.verdict === "retake") {
    return ["📷 Bill saaf padh nahi paya.", ...r.problems.slice(0, 3).map((p) => `• ${p}`), "", "Roshni mein, seedhi photo dobara bhejo."].join("\n");
  }
  const L = [`📦 *Bill padha* — ${r.vendor.name ?? "supplier?"}${r.invoiceNo ? ` #${r.invoiceNo}` : ""}`];
  if (r.totalPaise !== null) L.push(`Total: ${rupees(r.totalPaise)}`);
  const matched = r.lines.filter((l) => l.product);
  L.push(...matched.slice(0, 8).map((l) => `• ${l.product!.name} × ${num(l.qty, 1)}${l.unitCostPaise !== null ? ` @ ${rupees(l.unitCostPaise)}` : ""}`));
  if (matched.length > 8) L.push(`• …aur ${matched.length - 8} items`);
  if (r.unmatchedCount) L.push(`⚠️ ${r.unmatchedCount} item aapki list mein nahi mile — inka stock add nahi hoga`);
  if (r.duplicate) L.push("⚠️ Yeh bill pehle bhi aaya lagta hai");
  for (const p of r.problems.slice(0, 3)) L.push(`• ${p}`);
  L.push("", "Stock aur supplier ka baaki update karun?", "*1* = Haan, kar do", "*2* = Nahi, rehne do");
  return L.join("\n");
}

export function paymentReply(c: PaymentCheck, amountPaise: number | null): string {
  if (c.found) {
    return `✅ ${rupees(c.txn.amountPaise)} aapke record mein hai — ${time(c.txn.createdAt)} par aaya${c.txn.utr ? ` (UTR ${c.txn.utr})` : ""}. Samaan de sakte hain.`;
  }
  if (c.reason === "unreadable") return "📷 Screenshot saaf nahi padh paya. Dobara, poora screen dikhate hue bhejo.";
  return [`⚠️ ${amountPaise !== null ? `${rupees(amountPaise)} ka ` : ""}payment abhi aapke record mein nahi mila.`, "Kabhi kabhi 1-2 minute lagte hain — thodi der baad dobara dikhao. Pakka hone tak samaan mat do."].join("\n");
}
