/** Turn agent attachments into public, expiring links (Twilio and browsers fetch these without a session). */
import type { Db } from "../db/client";
import { createArtifact } from "../db/queries";
import type { Attachment } from "../agent/tools";

export function baseUrl(): string {
  return (process.env.APP_BASE_URL ?? "").replace(/\/$/, "");
}

export interface PdfParams {
  period: string;
  custom?: { from: string; to: string };
}

export async function mintReportLink(db: Db, merchantId: string, a: { period: string; custom?: { from: Date | string; to: Date | string } }): Promise<string> {
  const params: PdfParams = { period: a.period, custom: a.custom ? { from: new Date(a.custom.from).toISOString(), to: new Date(a.custom.to).toISOString() } : undefined };
  const token = await createArtifact(db, merchantId, "report_pdf", params);
  return `${baseUrl()}/api/reports/pdf/${token}`;
}

export async function attachmentLinks(db: Db, merchantId: string, atts: Attachment[]): Promise<{ kind: Attachment["kind"]; url: string }[]> {
  const out: { kind: Attachment["kind"]; url: string }[] = [];
  for (const a of atts) out.push({ kind: a.kind, url: await mintReportLink(db, merchantId, a) });
  return out;
}
