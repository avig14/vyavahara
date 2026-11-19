import { getCtx, handle, HttpError } from "@/lib/server/http";
import { getArtifact, loadSnapshot } from "@/lib/db/queries";
import { buildReport } from "@/lib/reports/build";
import { renderReportPdf } from "@/lib/reports/pdf";
import { isPeriodName } from "@/lib/time";
import type { PdfParams } from "@/lib/server/artifacts";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Public (token is the secret, 7-day expiry): Twilio and the browser fetch this without a session. Data is fresh at download time. */
export const GET = (_req: Request, { params }: { params: Promise<{ token: string }> }) =>
  handle(async () => {
    const { token } = await params;
    const c = await getCtx();
    const art = await getArtifact(c.db, token, "report_pdf", c.now);
    if (!art) throw new HttpError(404, "Link not found or expired");
    const p = art.params as PdfParams;
    const period = isPeriodName(p.period) ? p.period : "today";
    const custom = p.custom ? { from: new Date(p.custom.from), to: new Date(p.custom.to) } : undefined;
    const snap = await loadSnapshot(c.db, art.merchantId, { now: c.now });
    const pdf = await renderReportPdf(buildReport(snap, { period, custom }));
    return new Response(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="vyavahara-${period}.pdf"`,
        "cache-control": "private, max-age=60",
      },
    });
  });
