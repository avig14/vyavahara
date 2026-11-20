"use client";

import { useL, type L } from "@/lib/ui/lang";
import { useEffect, useId, useRef, useState } from "react";
import type { BillLineReview, BillReview } from "@/lib/ingest/bill-plan";
import {
  Badge,
  Button,
  DataTable,
  Field,
  Select,
  useToast,
  type Column,
} from "@/components/ui";
import { rupeesExact } from "@/lib/format";
import { postForm, postJson, toApiError } from "@/lib/ui/api";
import { ImageReadError, shrinkImage } from "@/lib/ui/image";

interface ScanResponse {
  pendingId: string | null;
  expiresAt: string | null;
  review: BillReview;
}

type Stage = "pick" | "reading" | "review" | "saving";

const verdictCopy = (l: L) =>
  ({
    good: {
      title: l("Bill read clearly", "बिल साफ़ पढ़ा गया", "Bill saaf padha gaya"),
      body: l(
        "Check it once below, then add the stock.",
        "नीचे एक बार मिला लें, फिर स्टॉक जोड़ें।",
        "Neeche ek baar mila lo, phir stock add karo.",
      ),
      tone: "success",
    },
    check: {
      title: l(
        "Please look carefully",
        "ज़रा ध्यान से देखें",
        "Ek baar dhyaan se dekho",
      ),
      body: l(
        "Some things are not certain. If it is right, accept; otherwise take the photo again.",
        "कुछ चीज़ें पक्की नहीं हैं। सही हो तो मंज़ूर करें, वरना दोबारा फ़ोटो लें।",
        "Kuch cheezein pakki nahi hain. Sahi ho to accept karo, warna dobara photo lo.",
      ),
      tone: "warn",
    },
    retake: {
      title: l(
        "This bill cannot be saved",
        "यह बिल सेव नहीं हो सकता",
        "Yeh bill save nahi ho sakta",
      ),
      body: l(
        "Take the photo again. The whole bill, straight, in good light.",
        "दोबारा फ़ोटो लें। पूरा बिल, सीधा और रोशनी में।",
        "Dobara photo lo. Poora bill, seedha aur roshni mein.",
      ),
      tone: "danger",
    },
  }) as const;

const dayLabel = (key: string) =>
  new Date(`${key}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
const qtyLabel = (x: BillLineReview) =>
  `${Number.isInteger(x.qty) ? x.qty : x.qty.toFixed(2)}${x.unit ? ` ${x.unit}` : ""}`;

const columns = (l: L): Column<BillLineReview>[] => [
  {
    key: "printed",
    header: l("Printed on the bill", "बिल पर लिखा", "Bill par likha"),
    primary: true,
    cell: (r) => r.printedName,
  },
  {
    key: "item",
    header: l("Your item", "आपका आइटम", "Aapka item"),
    cell: (r) =>
      r.product ? (
        r.product.name
      ) : (
        <Badge tone="warn">
          {l("Not in catalogue", "कैटलॉग में नहीं मिला", "Catalog mein nahi mila")}
        </Badge>
      ),
  },
  { key: "qty", header: l("Qty", "मात्रा", "Qty"), num: true, cell: qtyLabel },
  {
    key: "rate",
    header: l("Rate", "रेट", "Rate"),
    num: true,
    cell: (r) =>
      r.unitCostPaise === null ? "-" : rupeesExact(r.unitCostPaise),
  },
  {
    key: "amt",
    header: l("Amount", "रक़म", "Amount"),
    num: true,
    cell: (r) =>
      r.lineTotalPaise === null ? "-" : rupeesExact(r.lineTotalPaise),
  },
];

/**
 * Photo of a supplier bill → what we read → the owner accepts or rejects. Nothing touches stock or payables until Accept.
 * Closing the dialog without deciding counts as a reject, so a stale question can never be answered by accident later.
 */
export function BillScan({
  vendors,
  onDone,
}: {
  vendors: { id: string; name: string }[] | undefined;
  onDone: () => void;
}) {
  const { push } = useToast();
  const l = useL();
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
    if (id)
      postJson(`/api/actions/${id}`, { choice: "cancel" }).catch(
        () => undefined,
      ); // already gone or expired is fine
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
    setNotice(
      l(
        "Previous bill removed. Take a new photo.",
        "पिछला बिल हटा दिया। नई फ़ोटो लें।",
        "Pichla bill hata diya. Naya photo lo.",
      ),
    );
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
      setNotice(
        e instanceof ImageReadError ? e.message : toApiError(e).message,
      );
    }
  };

  const accept = async () => {
    if (!result?.pendingId) return;
    setStage("saving");
    try {
      const r = await postJson<{ reply: string }>(
        `/api/actions/${result.pendingId}`,
        { choice: "confirm" },
      );
      push({
        title: l("Stock updated", "स्टॉक अपडेट हो गया", "Stock update ho gaya"),
        detail: r.reply,
        tone: "success",
      });
      setOpen(false);
      setResult(null);
      onDone();
    } catch (e) {
      const err = toApiError(e);
      setStage("review");
      push({
        title:
          err.status === 410 || err.status === 409
            ? l(
                "This bill can no longer be saved",
                "यह बिल अब सेव नहीं हो सकता",
                "Yeh bill ab save nahi ho sakta",
              )
            : l("Not saved", "सेव नहीं हुआ", "Save nahi hua"),
        detail:
          err.status === 410
            ? l(
                "Time ran out. Take the photo again.",
                "समय निकल गया। दोबारा फ़ोटो लें।",
                "Time nikal gaya. Dobara photo lo.",
              )
            : err.message,
        tone: "error",
      });
      if (err.status === 410 || err.status === 409) {
        setResult(null);
        setStage("pick");
        setNotice(
          l(
            "This bill can no longer be saved. Take the photo again.",
            "यह बिल अब सेव नहीं हो सकता। दोबारा फ़ोटो लें।",
            "Yeh bill ab save nahi ho sakta. Dobara photo lo.",
          ),
        );
      }
    }
  };

  const review = result?.review;
  const verdict = review ? verdictCopy(l)[review.verdict] : null;
  const busy = stage === "reading" || stage === "saving";

  return (
    <>
      <Button variant="primary" onClick={start}>
        {l("Scan a bill", "बिल स्कैन करें", "Bill scan karo")}
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
          {l(
            "Scan a supplier bill",
            "सप्लायर का बिल स्कैन करें",
            "Supplier bill scan karo",
          )}
        </h2>

        {stage === "pick" || stage === "reading" ? (
          <div className="bs-pick">
            <p className="dlg-text">
              {l(
                "Take a clear photo of the bill. We will read it and you accept or reject after looking. Nothing is saved until then.",
                "बिल की साफ़ फ़ोटो लें। हम पढ़ेंगे, आप देखकर मंज़ूर या नामंज़ूर करेंगे। तब तक कुछ सेव नहीं होता।",
                "Bill ki saaf photo lo. Hum padhenge, aap dekh ke accept ya reject karoge. Tab tak kuch save nahi hota.",
              )}
            </p>
            <Field
              label={l("Supplier", "सप्लायर", "Supplier")}
              hint={l(
                "Leave empty to identify from the bill.",
                "ख़ाली छोड़ें तो बिल से पहचानेंगे।",
                "Khali chhodo to bill se pehchanenge.",
              )}
            >
              <Select
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                disabled={busy}
                options={[
                  {
                    value: "",
                    label: l(
                      "Identify from the bill",
                      "बिल से पहचानें",
                      "Bill se pehchano",
                    ),
                  },
                  ...(vendors ?? []).map((v) => ({
                    value: v.id,
                    label: v.name,
                  })),
                ]}
              />
            </Field>
            <div className="bs-pickbtns">
              <Button
                variant="primary"
                onClick={() => cam.current?.click()}
                disabled={busy}
                loading={stage === "reading"}
              >
                {l(
                  "Take a photo with the camera",
                  "कैमरे से फ़ोटो लें",
                  "Camera se photo lo",
                )}
              </Button>
              <Button onClick={() => gallery.current?.click()} disabled={busy}>
                {l("Choose from gallery", "गैलरी से चुनें", "Gallery se chuno")}
              </Button>
            </div>
            <input
              ref={cam}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(e) => (
                onFile(e.target.files?.[0]),
                (e.target.value = "")
              )}
            />
            <input
              ref={gallery}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => (
                onFile(e.target.files?.[0]),
                (e.target.value = "")
              )}
            />
            <p className="bs-status" role="status" aria-live="polite">
              {stage === "reading"
                ? l(
                    "Reading the bill. This takes a little time...",
                    "बिल पढ़ रहे हैं। थोड़ा समय लगता है...",
                    "Bill padh rahe hain. Thoda time lagta hai...",
                  )
                : (notice ?? "")}
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
                <dt>{l("Supplier", "सप्लायर", "Supplier")}</dt>
                <dd>
                  {review.vendor.name ??
                    l("Not identified", "पहचाना नहीं", "Pehchana nahi")}
                </dd>
              </div>
              <div>
                <dt>{l("Bill number", "बिल नंबर", "Bill number")}</dt>
                <dd>
                  {review.invoiceNo
                    ? `#${review.invoiceNo}`
                    : l("Not found", "नहीं मिला", "Nahi mila")}
                </dd>
              </div>
              <div>
                <dt>{l("Bill date", "बिल की तारीख़", "Bill ki date")}</dt>
                <dd>{dayLabel(review.invoiceDate)}</dd>
              </div>
              <div>
                <dt>{l("Pay by", "भुगतान कब तक", "Payment kab tak")}</dt>
                <dd>{review.dueDate ? dayLabel(review.dueDate) : "-"}</dd>
              </div>
            </dl>

            <DataTable
              caption={l("Bill lines", "बिल की लाइनें", "Bill ki lines")}
              columns={columns(l)}
              rows={review.lines}
              rowKey={(r) =>
                `${r.printedName}-${r.qty}-${r.lineTotalPaise}-${r.unitCostPaise}`
              }
              dense
            />

            <p className="bs-sum">
              <span>
                {l("Items total", "आइटम का जोड़", "Items ka jod")}{" "}
                {rupeesExact(review.lineSumPaise)}
              </span>
              <strong>
                {l("Bill total", "बिल का कुल", "Bill total")}{" "}
                {review.totalPaise === null
                  ? "-"
                  : rupeesExact(review.totalPaise)}
              </strong>
            </p>
          </div>
        ) : null}

        <div className="dlg-actions">
          {stage === "review" || stage === "saving" ? (
            review?.verdict === "retake" ? (
              <>
                <Button variant="quiet" onClick={close} disabled={busy}>
                  {l("Close", "बंद करें", "Band karo")}
                </Button>
                <Button variant="primary" onClick={retake}>
                  {l("Take photo again", "दोबारा फ़ोटो लें", "Dobara photo lo")}
                </Button>
              </>
            ) : (
              <>
                <Button onClick={retake} disabled={busy}>
                  {l(
                    "Wrong, take photo again",
                    "ग़लत है, दोबारा फ़ोटो लें",
                    "Galat hai, dobara photo lo",
                  )}
                </Button>
                <Button
                  variant="primary"
                  onClick={accept}
                  loading={stage === "saving"}
                >
                  {l(
                    "Correct, add the stock",
                    "सही है, स्टॉक जोड़ें",
                    "Sahi hai, stock add karo",
                  )}
                </Button>
              </>
            )
          ) : (
            <Button variant="quiet" onClick={close} disabled={busy}>
              {l("Close", "बंद करें", "Band karo")}
            </Button>
          )}
        </div>
      </dialog>
    </>
  );
}
