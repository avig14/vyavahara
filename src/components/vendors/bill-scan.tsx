"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { BillLineReview, BillReview } from "@/lib/ingest/bill-plan";
import { Badge, Button, DataTable, Field, Select, useToast, type Column } from "@/components/ui";
import { rupeesExact } from "@/lib/format";
import { postForm, postJson, toApiError } from "@/lib/ui/api";
import { ImageReadError, shrinkImage } from "@/lib/ui/image";

interface ScanResponse {
  pendingId: string | null;
  expiresAt: string | null;
  review: BillReview;
}

type Stage = "pick" | "reading" | "review" | "saving";

const VERDICT_COPY = {
  good: { title: "Bill saaf padha gaya", body: "Neeche ek baar mila lo, phir stock add karo.", tone: "success" },
  check: { title: "Ek baar dhyaan se dekho", body: "Kuch cheezein pakki nahi hain. Sahi ho to accept karo, warna dobara photo lo.", tone: "warn" },
  retake: { title: "Yeh bill save nahi ho sakta", body: "Dobara photo lo. Poora bill, seedha aur roshni mein.", tone: "danger" },
} as const;

const dayLabel = (key: string) => new Date(`${key}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const qtyLabel = (l: BillLineReview) => `${Number.isInteger(l.qty) ? l.qty : l.qty.toFixed(2)}${l.unit ? ` ${l.unit}` : ""}`;

const COLUMNS: Column<BillLineReview>[] = [
  { key: "printed", header: "Bill par likha", primary: true, cell: (l) => l.printedName },
  {
    key: "item",
    header: "Aapka item",
    cell: (l) => (l.product ? l.product.name : <Badge tone="warn">Catalog mein nahi mila</Badge>),
  },
  { key: "qty", header: "Qty", num: true, cell: qtyLabel },
  { key: "rate", header: "Rate", num: true, cell: (l) => (l.unitCostPaise === null ? "-" : rupeesExact(l.unitCostPaise)) },
  { key: "amt", header: "Amount", num: true, cell: (l) => (l.lineTotalPaise === null ? "-" : rupeesExact(l.lineTotalPaise)) },
];

/**
 * Photo of a supplier bill → what we read → the owner accepts or rejects. Nothing touches stock or payables until Accept.
 * Closing the dialog without deciding counts as a reject, so a stale question can never be answered by accident later.
 */
export function BillScan({ vendors, onDone }: { vendors: { id: string; name: string }[] | undefined; onDone: () => void }) {
  const { push } = useToast();
  const dlg = useRef<HTMLDialogElement>(null);
  const cam = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("pick");
  const [vendorId, setVendorId] = useState("");
  const [result, setResult] = useState<ScanResponse | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const cancelPending = (id: string | null) => {
    if (id) postJson(`/api/actions/${id}`, { choice: "cancel" }).catch(() => undefined); // already gone or expired is fine
  };

  const start = () => {
    setStage("pick");
    setResult(null);
    setNotice(null);
    setOpen(true);
  };

  const close = () => {
    if (stage === "reading" || stage === "saving") return;
    cancelPending(result?.pendingId ?? null);
    setOpen(false);
    setResult(null);
  };

  const retake = () => {
    cancelPending(result?.pendingId ?? null);
    setResult(null);
    setStage("pick");
    setNotice("Pichla bill hata diya. Naya photo lo.");
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setNotice(null);
    setStage("reading");
    try {
      const small = await shrinkImage(file);
      const form = new FormData();
      form.set("image", small, "bill.jpg");
      if (vendorId) form.set("vendorId", vendorId);
      setResult(await postForm<ScanResponse>("/api/bills/scan", form));
      setStage("review");
    } catch (e) {
      setStage("pick");
      setNotice(e instanceof ImageReadError ? e.message : toApiError(e).message);
    }
  };

  const accept = async () => {
    if (!result?.pendingId) return;
    setStage("saving");
    try {
      const r = await postJson<{ reply: string }>(`/api/actions/${result.pendingId}`, { choice: "confirm" });
      push({ title: "Stock update ho gaya", detail: r.reply, tone: "success" });
      setOpen(false);
      setResult(null);
      onDone();
    } catch (e) {
      const err = toApiError(e);
      setStage("review");
      push({
        title: err.status === 410 || err.status === 409 ? "Yeh bill ab save nahi ho sakta" : "Save nahi hua",
        detail: err.status === 410 ? "Time nikal gaya. Dobara photo lo." : err.message,
        tone: "error",
      });
      if (err.status === 410 || err.status === 409) {
        setResult(null);
        setStage("pick");
        setNotice("Yeh bill ab save nahi ho sakta. Dobara photo lo.");
      }
    }
  };

  const review = result?.review;
  const verdict = review ? VERDICT_COPY[review.verdict] : null;
  const busy = stage === "reading" || stage === "saving";

  return (
    <>
      <Button variant="primary" onClick={start}>
        Bill scan karo
      </Button>
      <dialog
        ref={dlg}
        className="dlg bs"
        aria-labelledby={titleId}
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        onClick={(e) => {
          if (e.target === dlg.current) close();
        }}
      >
        <h2 id={titleId} className="dlg-title">
          Supplier bill scan
        </h2>

        {stage === "pick" || stage === "reading" ? (
          <div className="bs-pick">
            <p className="dlg-text">Bill ki saaf photo lo. Hum padhenge, aap dekh ke accept ya reject karoge. Tab tak kuch save nahi hota.</p>
            <Field label="Supplier" hint="Khali chhodo to bill se pehchanenge.">
              <Select
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                disabled={busy}
                options={[{ value: "", label: "Bill se pehchano" }, ...(vendors ?? []).map((v) => ({ value: v.id, label: v.name }))]}
              />
            </Field>
            <div className="bs-pickbtns">
              <Button variant="primary" onClick={() => cam.current?.click()} disabled={busy} loading={stage === "reading"}>
                Camera se photo lo
              </Button>
              <Button onClick={() => gallery.current?.click()} disabled={busy}>
                Gallery se chuno
              </Button>
            </div>
            <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={(e) => (onFile(e.target.files?.[0]), (e.target.value = ""))} />
            <input ref={gallery} type="file" accept="image/*" hidden onChange={(e) => (onFile(e.target.files?.[0]), (e.target.value = ""))} />
            <p className="bs-status" role="status" aria-live="polite">
              {stage === "reading" ? "Bill padh rahe hain. Thoda time lagta hai..." : (notice ?? "")}
            </p>
          </div>
        ) : null}

        {review && verdict && (stage === "review" || stage === "saving") ? (
          <div className="bs-review">
            <div className="bs-verdict" data-tone={verdict.tone} role="status">
              <strong>{verdict.title}</strong>
              <span>{verdict.body}</span>
              {review.problems.length ? (
                <ul>
                  {review.problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              ) : null}
            </div>

            <dl className="bs-facts">
              <div>
                <dt>Supplier</dt>
                <dd>{review.vendor.name ?? "Pehchana nahi"}</dd>
              </div>
              <div>
                <dt>Bill number</dt>
                <dd>{review.invoiceNo ? `#${review.invoiceNo}` : "Nahi mila"}</dd>
              </div>
              <div>
                <dt>Bill ki date</dt>
                <dd>{dayLabel(review.invoiceDate)}</dd>
              </div>
              <div>
                <dt>Payment kab tak</dt>
                <dd>{review.dueDate ? dayLabel(review.dueDate) : "-"}</dd>
              </div>
            </dl>

            <DataTable caption="Bill ki lines" columns={COLUMNS} rows={review.lines} rowKey={(l) => `${l.printedName}-${l.qty}-${l.lineTotalPaise}-${l.unitCostPaise}`} dense />

            <p className="bs-sum">
              <span>Items ka jod {rupeesExact(review.lineSumPaise)}</span>
              <strong>Bill total {review.totalPaise === null ? "-" : rupeesExact(review.totalPaise)}</strong>
            </p>
          </div>
        ) : null}

        <div className="dlg-actions">
          {stage === "review" || stage === "saving" ? (
            review?.verdict === "retake" ? (
              <>
                <Button variant="quiet" onClick={close} disabled={busy}>
                  Band karo
                </Button>
                <Button variant="primary" onClick={retake}>
                  Dobara photo lo
                </Button>
              </>
            ) : (
              <>
                <Button onClick={retake} disabled={busy}>
                  Galat hai, dobara photo lo
                </Button>
                <Button variant="primary" onClick={accept} loading={stage === "saving"}>
                  Sahi hai, stock add karo
                </Button>
              </>
            )
          ) : (
            <Button variant="quiet" onClick={close} disabled={busy}>
              Band karo
            </Button>
          )}
        </div>
      </dialog>
    </>
  );
}
