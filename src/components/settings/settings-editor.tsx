"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, ConfirmDialog, PageHeader, useToast } from "@/components/ui";
import { deleteJson, putJson, toApiError } from "@/lib/ui/api";
import { FIELDS, GROUPS, findStale, findUnmapped, getAt, sameValue, setAt, type Tree } from "./fields";
import { SettingRow } from "./setting-row";
import { useLeaveGuard } from "./use-leave-guard";
import { parseServerError, underPath, validate, type Errors } from "./validate";

export interface SettingsPayload {
  settings: Tree;
  defaults: Tree;
}

const UNMAPPED_ID = "unmapped";

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

function omitUnder(errs: Errors, path: string): Errors {
  return Object.fromEntries(Object.entries(errs).filter(([k]) => !underPath(k, path)));
}

function weightsTotal(draft: Tree): number {
  return ["oldest", "repay", "utilization", "lastPayment", "growing"].reduce((n, k) => {
    const v = getAt(draft, `khata.weights.${k}`);
    return n + (typeof v === "number" ? v : 0);
  }, 0);
}

export function SettingsEditor({ initial }: { initial: SettingsPayload }) {
  const toast = useToast();
  const { defaults } = initial;
  const [saved, setSaved] = useState<Tree>(initial.settings);
  const [draft, setDraft] = useState<Tree>(initial.settings);
  const [touched, setTouched] = useState<Record<string, true>>({});
  const [attempted, setAttempted] = useState(false);
  const [serverErrors, setServerErrors] = useState<Errors>({});
  const [banner, setBanner] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [status, setStatus] = useState("");
  const [active, setActive] = useState<string>(GROUPS[0].id);

  const unmapped = useMemo(() => findUnmapped(defaults), [defaults]);

  // dev-time guard: say so in the console too when the defaults and the field map drift apart
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const stale = findStale(defaults);
    if (unmapped.length) console.warn("Settings screen: no field for", unmapped);
    if (stale.length) console.warn("Settings screen: field map has keys the API no longer defines", stale);
  }, [defaults, unmapped]);

  const changedPaths = useMemo(() => FIELDS.filter((f) => !sameValue(getAt(draft, f.path), getAt(saved, f.path))).map((f) => f.path), [draft, saved]);
  const dirty = changedPaths.length > 0;
  const clientErrors = useMemo(() => validate(draft), [draft]);
  const differing = useMemo(() => FIELDS.filter((f) => !sameValue(getAt(saved, f.path), getAt(defaults, f.path))).length, [saved, defaults]);

  const shown: Errors = useMemo(() => {
    const out: Errors = { ...serverErrors };
    for (const [k, msg] of Object.entries(clientErrors)) if (attempted || touched[k]) out[k] = msg;
    return out;
  }, [clientErrors, serverErrors, touched, attempted]);

  const guard = useLeaveGuard(dirty);

  // which section the reader is in, for the index
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-sec]"));
    if (els.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit) setActive((hit.target as HTMLElement).dataset.sec ?? "");
      },
      { rootMargin: "-15% 0px -75% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  function clearFeedback() {
    setTouched({});
    setAttempted(false);
    setServerErrors({});
    setBanner([]);
  }

  function setValue(path: string, value: unknown) {
    setDraft((d) => setAt(d, path, value));
    setTouched((t) => ({ ...t, [path]: true }));
    setServerErrors((s) => omitUnder(s, path));
    setBanner([]);
  }

  function touch(key: string) {
    setTouched((t) => (t[key] ? t : { ...t, [key]: true }));
  }

  function resetOne(path: string) {
    setValue(path, getAt(defaults, path));
    setNonce((n) => n + 1);
    window.requestAnimationFrame(() => document.getElementById(`f-${path}`)?.focus());
  }

  function discard() {
    setDraft(saved);
    clearFeedback();
    setNonce((n) => n + 1);
    setStatus("Changes discarded.");
  }

  function focusFirst(errs: Errors) {
    for (const f of FIELDS) {
      const key = Object.keys(errs).find((k) => underPath(k, f.path));
      if (!key) continue;
      const el = document.getElementById(`f-${key}`);
      el?.scrollIntoView({ block: "center" });
      el?.focus({ preventScroll: true });
      return;
    }
  }

  async function save() {
    setAttempted(true);
    const errs = { ...serverErrors, ...clientErrors };
    const count = Object.keys(clientErrors).length;
    if (count > 0) {
      const msg = `Fix ${plural(count, "field", "fields")} before saving.`;
      setStatus(msg);
      toast.push({ title: "Not saved", detail: msg, tone: "error" });
      focusFirst(errs);
      return;
    }
    let patch: Tree = {};
    for (const p of changedPaths) patch = setAt(patch, p, getAt(draft, p));
    setSaving(true);
    try {
      const r = await putJson<{ settings: Tree }>("/api/settings", patch);
      setSaved(r.settings);
      setDraft(r.settings);
      clearFeedback();
      setNonce((n) => n + 1);
      const msg = `${plural(changedPaths.length, "setting", "settings")} saved.`;
      setStatus(msg);
      toast.push({ title: "Settings saved", detail: msg, tone: "success" });
    } catch (e) {
      const err = toApiError(e);
      if (err.status === 400) {
        const parsed = parseServerError(err.message);
        setServerErrors(parsed.fields);
        setBanner(parsed.other);
        const n = Object.keys(parsed.fields).length;
        const msg = n > 0 ? `The server did not accept ${plural(n, "value", "values")}. See the marked fields.` : err.message;
        setStatus(`Not saved. ${msg}`);
        toast.push({ title: "Not saved", detail: msg, tone: "error" });
        focusFirst(parsed.fields);
      } else {
        setStatus(`Not saved. ${err.message}`);
        toast.push({ title: "Not saved", detail: err.message, tone: "error" });
      }
    } finally {
      setSaving(false);
    }
  }

  async function resetAll() {
    setResetting(true);
    try {
      const r = await deleteJson<{ settings: Tree }>("/api/settings");
      setSaved(r.settings);
      setDraft(r.settings);
      clearFeedback();
      setNonce((n) => n + 1);
      setResetOpen(false);
      setStatus("Every setting is back to its default.");
      toast.push({ title: "Back to defaults", detail: "Every setting is at its factory value.", tone: "success" });
    } catch (e) {
      const err = toApiError(e);
      setResetOpen(false);
      setStatus(`Reset failed. ${err.message}`);
      toast.push({ title: "Could not reset", detail: err.message, tone: "error" });
    } finally {
      setResetting(false);
    }
  }

  const sections = GROUPS.map((g) => ({ g, fields: FIELDS.filter((f) => f.group === g.id) })).filter((s) => s.fields.length > 0);
  const total = FIELDS.length;

  return (
    <>
      <PageHeader
        title="Settings"
        hindi="सेटिंग"
        description={differing === 0 ? `All ${total} settings are at their defaults. Change any of them to fit your shop.` : `${differing} of ${total} settings differ from the defaults. Every threshold Vyavahāra uses is yours to change.`}
        actions={
          <Button variant="danger" onClick={() => setResetOpen(true)} disabled={differing === 0 && !dirty}>
            Reset all to defaults
          </Button>
        }
      />
      <p className="visually-hidden" role="status" aria-live="polite">
        {status}
      </p>

      <div className="st">
        <nav className="st-index" aria-label="Settings sections">
          <ul>
            {sections.map(({ g }) => (
              <li key={g.id}>
                <a href={`#sec-${g.id}`} aria-current={active === g.id ? "location" : undefined}>
                  {g.title}
                </a>
              </li>
            ))}
            {unmapped.length > 0 ? (
              <li>
                <a href={`#sec-${UNMAPPED_ID}`} aria-current={active === UNMAPPED_ID ? "location" : undefined}>
                  Unmapped
                </a>
              </li>
            ) : null}
          </ul>
        </nav>

        <form
          className="st-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (dirty && !saving) void save();
          }}
        >
          {banner.length > 0 ? (
            <div className="st-banner" role="alert">
              <p className="st-banner-title">The server rejected the change</p>
              {banner.map((m) => (
                <p key={m}>{m}</p>
              ))}
            </div>
          ) : null}

          {sections.map(({ g, fields }) => {
            let lastCluster: string | undefined;
            return (
              <section key={g.id} id={`sec-${g.id}`} data-sec={g.id} className="st-sec" aria-labelledby={`sec-${g.id}-h`}>
                <div className="st-sec-head">
                  <h2 id={`sec-${g.id}-h`}>{g.title}</h2>
                  {g.hindi ? (
                    <span className="st-hi deva" lang="hi">
                      {g.hindi}
                    </span>
                  ) : null}
                </div>
                <p className="st-sec-desc">{g.description}</p>
                <div className="st-rows">
                  {fields.map((f) => {
                    const head =
                      f.cluster && f.cluster !== lastCluster ? (
                        <div className="st-cluster" key={`c-${f.cluster}`}>
                          <h3>{f.cluster}</h3>
                          {f.path === "khata.weights.oldest" ? <p>Weights add up to {weightsTotal(draft)}. Only their proportions matter.</p> : null}
                        </div>
                      ) : null;
                    lastCluster = f.cluster;
                    return (
                      <div key={f.path} className="st-item">
                        {head}
                        <SettingRow def={f} value={getAt(draft, f.path)} saved={getAt(saved, f.path)} defaultValue={getAt(defaults, f.path)} errors={shown} nonce={nonce} onChange={setValue} onTouch={touch} onReset={resetOne} />
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}

          {unmapped.length > 0 ? (
            <section id={`sec-${UNMAPPED_ID}`} data-sec={UNMAPPED_ID} className="st-sec" aria-labelledby={`sec-${UNMAPPED_ID}-h`}>
              <div className="st-sec-head">
                <h2 id={`sec-${UNMAPPED_ID}-h`}>Unmapped settings</h2>
              </div>
              <p className="st-sec-desc">The API defines these, but this screen has no field for them yet. They keep their current values.</p>
              <div className="st-rows">
                {unmapped.map((p) => (
                  <div key={p} className="st-row" data-wide="">
                    <div className="st-main">
                      <div className="st-name">
                        <span>
                          Unmapped setting <code>{p}</code>
                        </span>
                      </div>
                      <p className="st-desc">Current value: {JSON.stringify(getAt(saved, p))}. Add it to src/components/settings/fields.ts.</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {dirty ? (
            <div className="st-bar" role="group" aria-label="Unsaved changes">
              <p className="st-bar-text">
                <strong>{plural(changedPaths.length, "unsaved change", "unsaved changes")}</strong>
                {Object.keys(clientErrors).length > 0 && attempted ? ` ${plural(Object.keys(clientErrors).length, "field needs", "fields need")} fixing.` : ""}
              </p>
              <div className="st-bar-act">
                <Button variant="quiet" onClick={discard} disabled={saving}>
                  Discard
                </Button>
                <Button variant="primary" type="submit" loading={saving}>
                  Save changes
                </Button>
              </div>
            </div>
          ) : null}
        </form>
      </div>

      {resetOpen ? (
      <ConfirmDialog
        open
        tone="danger"
        title="Reset every setting to its default?"
        description={dirty ? "All saved settings go back to their factory values, and the edits you have not saved are dropped. This cannot be undone." : "All saved settings go back to their factory values. This cannot be undone."}
        confirmLabel="Reset all"
        cancelLabel="Keep my settings"
        loading={resetting}
        onConfirm={() => void resetAll()}
        onCancel={() => setResetOpen(false)}
      />
      ) : null}
      {guard.leaveOpen ? (
      <ConfirmDialog open title="Leave without saving?" description={`You have ${plural(changedPaths.length, "unsaved change", "unsaved changes")} on this page. They are lost if you leave.`} confirmLabel="Leave" cancelLabel="Keep editing" tone="danger" onConfirm={guard.leave} onCancel={guard.stay} />
      ) : null}
    </>
  );
}
