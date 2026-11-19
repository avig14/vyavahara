/** UPI pay-link helpers. Amounts are integer paise; the UPI URI wants rupees with 2 decimals. */

export interface UpiParams {
  vpa: string;
  name: string;
  amountPaise: number;
  note?: string;
}

/** upi://pay?pa=&pn=&am=&cu=INR&tn= (NPCI deep-link spec). Values are percent-encoded. */
export function upiUri(p: UpiParams): string {
  if (!Number.isInteger(p.amountPaise) || p.amountPaise <= 0) throw new Error("amount must be positive integer paise");
  const q = new URLSearchParams({ pa: p.vpa, pn: p.name, am: (p.amountPaise / 100).toFixed(2), cu: "INR" });
  if (p.note) q.set("tn", p.note.slice(0, 50));
  // URLSearchParams encodes spaces as "+", UPI apps want %20
  return `upi://pay?${q.toString().replace(/\+/g, "%20")}`;
}

/** Shape stored in artifacts.params for kind "pay_link". */
export interface PayLinkParams {
  customerId: string;
  customerName: string;
  amountPaise: number;
  paidAt?: string;
}
