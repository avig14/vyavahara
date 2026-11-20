/** Labels for what happened inside a Voice Saathi turn. Timings shown are measured, never estimated. */

/** Agent tool names → what the owner would call it. */
export const TOOL_LABEL: Record<string, string> = {
  get_report: "Report",
  get_sales_summary: "Sales",
  get_profit: "Munafa",
  get_top_products: "Top items",
  get_anomalies: "Kuch alag?",
  get_recommendations: "Suggestions",
  get_inventory_status: "Stock",
  get_stockout_forecast: "Forecast",
  get_reorder_list: "Order list",
  get_lost_sales: "Lost sales",
  get_dead_stock: "Dead stock",
  adjust_stock: "Stock badlo",
  get_payables: "Supplier dues",
  draft_purchase_order: "Purchase order",
  get_price_changes: "Rate badle",
  record_vendor_payment: "Supplier payment",
  get_khata_overview: "Khata",
  get_customer_khata: "Grahak khata",
  log_udhaar: "Udhaar likho",
  record_khata_payment: "Udhaar wapas",
  set_credit_block: "Udhaar band",
  draft_reminder: "Reminder",
  get_segments: "Grahak groups",
  log_expense: "Kharcha",
  record_cash_sale: "Cash sale",
  get_festival_plan: "Tyohaar plan",
  get_cashflow_forecast: "Cash flow",
  check_loan_eligibility: "Loan check",
  get_gst_summary: "GST",
};

export const ROUTE_LABEL: Record<string, string> = {
  greet: "Namaste + aaj ki zaroori baatein",
  confirm: "Haan suna, kaam kar diya",
  cancel: "Nahi suna, cancel kiya",
  no_pending: "Haan/nahi, par kuch pending nahi tha",
  readonly: "Demo: save nahi kiya",
  menu: "Seedha jawab, bina AI",
  report: "Aaj ka report, bina AI",
  stock: "Stock alert, bina AI",
  khata: "Udhaar list, bina AI",
  suppliers: "Supplier dues, bina AI",
  agent: "Claude ne tools se hisaab nikala",
  no_ai: "AI key nahi, seedha jawab",
};

/** Data the no-AI routes read, shown like tool calls. */
export const ROUTE_DATA: Record<string, string[]> = {
  greet: ["Khata risk", "Stock", "Payments"],
  menu: ["Aaj ki sale"],
  report: ["Sales", "Munafa", "Suggestions"],
  stock: ["Forecast", "Stock"],
  khata: ["Khata", "Risk score"],
  suppliers: ["Supplier dues"],
  confirm: ["Pending kaam"],
  cancel: ["Pending kaam"],
};

export function toolChips(route: string, tools: string[] | undefined): string[] {
  if (route === "agent") return [...new Set((tools ?? []).map((t) => TOOL_LABEL[t] ?? t))];
  return ROUTE_DATA[route] ?? [];
}
