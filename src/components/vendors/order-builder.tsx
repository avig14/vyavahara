"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { num, rupees } from "@/lib/format";
import { useApi } from "@/lib/ui/api";
import { useActionState } from "@/lib/ui/action-state";
import { useL } from "@/lib/ui/lang";
import type { InventoryPayload } from "@/components/inventory/types";
import type { VendorsPayload } from "./types";

interface Line {
  productId: string;
  name: string;
  qty: number;
  costPaise: number | null;
}
interface Group {
  vendorId: string | null;
  name: string;
  phone: string | null;
  lines: Line[];
}

const waLink = (phone: string | null, text: string) => {
  const d = (phone ?? "").replace(/\D/g, "");
  const n = d.length === 10 ? `91${d}` : d;
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
};

function GroupCard({
  g,
  onOrdered,
}: {
  g: Group;
  onOrdered: (ids: string[]) => void;
}) {
  const l = useL();
  const [qty, setQty] = useState<Record<string, number>>({});
  const [off, setOff] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const chosen = g.lines
    .filter((x) => !off.has(x.productId))
    .map((x) => ({ ...x, qty: qty[x.productId] ?? x.qty }));
  const cost = chosen.reduce((s, x) => s + (x.costPaise ?? 0) * x.qty, 0);
  const text = l(
    `Hello ${g.name}, I need these:\n${chosen.map((x) => `- ${x.name}: ${num(x.qty, 1)}`).join("\n")}\nWhen can you deliver? Thank you.`,
    `नमस्ते ${g.name}, मुझे ये चाहिए:\n${chosen.map((x) => `- ${x.name}: ${num(x.qty, 1)}`).join("\n")}\nकब तक भेज सकते हैं? धन्यवाद।`,
    `Namaste ${g.name}, mujhe yeh chahiye:\n${chosen.map((x) => `- ${x.name}: ${num(x.qty, 1)}`).join("\n")}\nKab tak bhej sakte hain? Dhanyavaad.`,
  );
  return (
    <section className="ob-card" aria-label={g.name}>
      <div className="ob-head">
        <h3 className="ob-name">{g.name}</h3>
        {cost > 0 ? (
          <p className="ob-cost">
            <span className="act-tag">{l("Estimate", "अनुमान", "Anumaan")}</span>{" "}
            {rupees(cost)}{" "}
            <span className="ob-sub">
              {l(
                "at your last bill rates",
                "आपके पिछले बिल के रेट से",
                "aapke pichhle bill ke rate se",
              )}
            </span>
          </p>
        ) : null}
      </div>
      <ul className="ob-lines">
        {g.lines.map((x) => (
          <li
            key={x.productId}
            className="ob-line"
            data-off={off.has(x.productId) ? "" : undefined}
          >
            <label className="ob-pick">
              <input
                type="checkbox"
                checked={!off.has(x.productId)}
                onChange={(e) =>
                  setOff((prev) => {
                    const n = new Set(prev);
                    if (e.target.checked) n.delete(x.productId);
                    else n.add(x.productId);
                    return n;
                  })
                }
              />
              <span>{x.name}</span>
            </label>
            <input
              className="ctl ob-qty num"
              type="number"
              min={1}
              inputMode="decimal"
              aria-label={l(
                `Quantity of ${x.name}`,
                `${x.name} की मात्रा`,
                `${x.name} ki matra`,
              )}
              value={qty[x.productId] ?? x.qty}
              onChange={(e) =>
                setQty((p) => ({
                  ...p,
                  [x.productId]: Math.max(0, Number(e.target.value)),
                }))
              }
            />
          </li>
        ))}
      </ul>
      <div className="ob-acts">
        <a
          className="btn btn-primary"
          aria-disabled={chosen.length === 0}
          href={chosen.length ? waLink(g.phone, text) : undefined}
          target="_blank"
          rel="noreferrer"
        >
          {l("Review on WhatsApp", "WhatsApp पर देखें", "WhatsApp par dekho")}
        </a>
        <Button
          variant="secondary"
          disabled={chosen.length === 0}
          onClick={() => {
            void navigator.clipboard?.writeText(text).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            });
          }}
        >
          {copied
            ? l("Copied", "कॉपी हो गया", "Copy ho gaya")
            : l("Copy message", "संदेश कॉपी करें", "Message copy karo")}
        </Button>
        <Button
          variant="quiet"
          disabled={chosen.length === 0}
          onClick={() => onOrdered(chosen.map((x) => x.productId))}
        >
          {l("Order placed", "ऑर्डर दे दिया", "Order de diya")}
        </Button>
      </div>
      {!g.phone && g.vendorId ? (
        <p className="ob-sub">
          {l(
            "No phone number saved for this supplier, so WhatsApp will ask whom to send to.",
            "इस सप्लायर का नंबर सेव नहीं है, WhatsApp पूछेगा किसे भेजना है।",
            "Is supplier ka number save nahi hai, WhatsApp poochega kisko bhejna hai.",
          )}
        </p>
      ) : null}
    </section>
  );
}

/**
 * "Kya mangwana hai": every item that is out or due for reorder, grouped by the supplier with the lowest bill rate for it.
 * Quantities and items are editable; the owner reviews and sends the WhatsApp message themselves. Nothing is sent or saved by this screen.
 */
export function OrderBuilder({
  vendors,
}: {
  vendors: VendorsPayload | undefined;
}) {
  const l = useL();
  const inv = useApi<InventoryPayload>("/api/dashboard/inventory");
  const acts = useActionState();
  const [undo, setUndo] = useState<string[] | null>(null);

  const groups = useMemo<Group[] | undefined>(() => {
    if (!inv.data || !vendors) return undefined;
    const vmap = new Map(vendors.vendors.map((v) => [v.id, v]));
    const by = new Map<string, Group>();
    for (const f of inv.data.forecasts) {
      if (
        !(f.status === "stockout" || f.status === "reorder") ||
        !(f.suggestedOrderQty > 0)
      )
        continue;
      if (acts.hidden(`REORDER:${f.productId}`)) continue;
      const offers = vendors.vendorProducts
        .filter((o) => o.productId === f.productId)
        .sort((a, b) => a.lastCostPaise - b.lastCostPaise);
      const best = offers[0];
      const key = best?.vendorId ?? "none";
      const v = best ? vmap.get(best.vendorId) : undefined;
      if (!by.has(key))
        by.set(key, {
          vendorId: best?.vendorId ?? null,
          name:
            v?.name ??
            l("Supplier not decided", "सप्लायर तय नहीं", "Supplier tay nahi"),
          phone: v?.phone ?? null,
          lines: [],
        });
      by.get(key)!.lines.push({
        productId: f.productId,
        name: f.name,
        qty: f.suggestedOrderQty,
        costPaise: best?.lastCostPaise ?? null,
      });
    }
    return [...by.values()].sort((a, b) => b.lines.length - a.lines.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inv.data, vendors, acts.hidden]);

  return (
    <section className="sup-sec ob" aria-labelledby="ob-h">
      <div className="ov-head">
        <h2 id="ob-h" className="stk-h">
          {l("What to order", "क्या मँगवाना है", "Kya mangwana hai")}
        </h2>
        <p className="ov-headmeta">
          {l(
            "Grouped by supplier. Check, change, then send yourself.",
            "सप्लायर के हिसाब से। देखें, बदलें, फिर ख़ुद भेजें।",
            "Supplier ke hisaab se. Dekho, badlo, phir khud bhejo.",
          )}
        </p>
      </div>
      {undo ? (
        <p className="act-undo" role="status" aria-live="polite">
          {l(
            "Marked as ordered.",
            "ऑर्डर हो गया मान लिया।",
            "Order ho gaya maan liya.",
          )}{" "}
          <button
            type="button"
            className="act-undo-btn"
            onClick={() => {
              undo.forEach((id) => acts.undo(`REORDER:${id}`));
              setUndo(null);
            }}
          >
            {l("Undo", "वापस लाएँ", "Wapas lao")}
          </button>
        </p>
      ) : null}
      {inv.error && !inv.data ? (
        <EmptyState
          title={l(
            "Could not load stock",
            "स्टॉक नहीं खुल पाया",
            "Stock nahi khul paya",
          )}
          action={
            <Button onClick={inv.refetch}>
              {l("Try again", "फिर कोशिश करें", "Phir koshish karo")}
            </Button>
          }
        />
      ) : !groups ? (
        <Skeleton
          shape="rows"
          count={3}
          cols={2}
          label={l(
            "Loading orders",
            "ऑर्डर लोड हो रहे हैं",
            "Orders load ho rahe hain",
          )}
        />
      ) : groups.length === 0 ? (
        <EmptyState
          icon="stock"
          title={l(
            "Nothing to order right now",
            "अभी कुछ मँगवाना नहीं है",
            "Abhi kuch mangwana nahi hai",
          )}
          description={l(
            "When an item runs out or gets low, it will appear here under its supplier.",
            "जब कोई आइटम ख़त्म या कम होगा, वह यहाँ उसके सप्लायर के नीचे दिखेगा।",
            "Jab koi item khatam ya kam hoga, woh yahan uske supplier ke neeche dikhega.",
          )}
        />
      ) : (
        <div className="ob-grid">
          {groups.map((g) => (
            <GroupCard
              key={g.vendorId ?? "none"}
              g={g}
              onOrdered={(ids) => {
                ids.forEach((id) => acts.markDone(`REORDER:${id}`));
                setUndo(ids);
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}
