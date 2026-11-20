"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { useL } from "@/lib/ui/lang";
import {
  Button,
  EmptyState,
  ErrorState,
  Skeleton,
  Textarea,
} from "@/components/ui";
import { SendIcon } from "@/components/ui/icons";
import { postJson, toApiError, useApi } from "@/lib/ui/api";
import {
  asksConfirmation,
  MessageText,
  stripConfirmPrompt,
} from "./message-text";

interface HistoryResponse {
  messages: { role: string; content: string }[];
}
interface ChatReply {
  reply: string;
  attachments: { kind: string; url: string }[];
}
interface Turn {
  id: string;
  role: "user" | "assistant";
  text: string;
  attachments?: { kind: string; url: string }[];
  /** reply that ends with the 1/2 prompt, received live in this session */
  asksConfirm?: boolean;
  at: number;
}

/** A waiting confirmation expires on the server after 30 minutes. */
const CONFIRM_WINDOW_MS = 30 * 60 * 1000;

const EXAMPLES: [string, string, string][] = [
  [
    "How much did I sell today?",
    "आज की बिक्री कितनी हुई?",
    "Aaj ki bikri kitni hui?",
  ],
  [
    "Which customer owes the most?",
    "किस ग्राहक का उधार सबसे ज़्यादा है?",
    "Kis customer ka udhaar sabse zyada hai?",
  ],
  [
    "Which items are running low?",
    "कौन सा सामान कम बचा है?",
    "Kaunsa saaman kam bacha hai?",
  ],
];

/** The panel is always mounted; this is true only while the surrounding dialog is open. */
function useDialogOpen(ref: RefObject<HTMLElement | null>): boolean {
  return useSyncExternalStore(
    (notify) => {
      const d = ref.current?.closest("dialog");
      if (!d) return () => {};
      const mo = new MutationObserver(notify);
      mo.observe(d, { attributes: true, attributeFilter: ["open"] });
      return () => mo.disconnect();
    },
    () => {
      const el = ref.current;
      if (!el) return false;
      const d = el.closest("dialog");
      return d ? d.open : true;
    },
    () => false,
  );
}

const clock = () => Date.now();
let seq = 0;
const nextId = () => `t${++seq}`;

export function ChatView() {
  const l = useL();
  const root = useRef<HTMLDivElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const open = useDialogOpen(root);
  const [wasOpen, setWasOpen] = useState(false);
  if (open && !wasOpen) setWasOpen(true);

  const history = useApi<HistoryResponse>(wasOpen ? "/api/chat" : null);
  const [live, setLive] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState<{
    text: string;
    message: string;
  } | null>(null);
  const [now, setNow] = useState(clock);

  const past: Turn[] = (history.data?.messages ?? [])
    .filter(
      (m) =>
        (m.role === "user" || m.role === "assistant") &&
        m.content.trim() !== "",
    )
    .map((m, i) => ({
      id: `h${i}`,
      role: m.role as "user" | "assistant",
      text: m.content,
      at: 0,
    }));
  const turns = [...past, ...live];
  const last = turns[turns.length - 1];
  const showConfirm =
    !sending &&
    !failed &&
    last?.role === "assistant" &&
    last.asksConfirm === true &&
    now - last.at < CONFIRM_WINDOW_MS;
  const ready = Boolean(history.data) || Boolean(history.error);

  useEffect(() => {
    const el = log.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns.length, sending, failed, showConfirm, history.data]);

  async function send(text: string, shown: string = text, retry = false) {
    const t = text.trim();
    if (!t || sending) return;
    setFailed(null);
    setSending(true);
    const stamp = clock();
    setNow(stamp);
    if (!retry)
      setLive((l) => [
        ...l,
        { id: nextId(), role: "user", text: shown, at: stamp },
      ]);
    try {
      const out = await postJson<ChatReply>("/api/chat", { text: t });
      const at = clock();
      setNow(at);
      setLive((l) => [
        ...l,
        {
          id: nextId(),
          role: "assistant",
          text: stripConfirmPrompt(out.reply),
          attachments: out.attachments,
          asksConfirm: asksConfirmation(out.reply),
          at,
        },
      ]);
    } catch (e) {
      setFailed({ text: t, message: toApiError(e).message });
    } finally {
      setSending(false);
      box.current?.focus();
    }
  }

  function submit(e?: FormEvent) {
    e?.preventDefault();
    const t = draft;
    if (!t.trim() || sending) return;
    setDraft("");
    void send(t);
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  const empty = ready && !history.error && turns.length === 0 && !sending;

  return (
    <div className="sc" ref={root}>
      <div
        className="sc-log"
        ref={log}
        role="log"
        aria-live="polite"
        aria-label={l(
          "Conversation with Saathi",
          "साथी से बातचीत",
          "Saathi se baatcheet",
        )}
      >
        {wasOpen && !ready ? (
          <div className="sc-wait">
            <Skeleton
              shape="rows"
              count={3}
              cols={1}
              label={l(
                "Loading earlier messages",
                "पिछले संदेश लोड हो रहे हैं",
                "Pichhle messages load ho rahe hain",
              )}
            />
          </div>
        ) : null}
        {history.error ? (
          <div className="sc-err">
            <ErrorState
              title={l(
                "Could not load earlier messages",
                "पिछले संदेश नहीं खुल पाए",
                "Pichhle messages nahi khul paye",
              )}
              error={history.error}
              onRetry={history.refetch}
              retrying={history.loading}
            />
          </div>
        ) : null}
        {empty ? (
          <div className="sc-empty">
            <EmptyState
              title={l(
                "Ask about your shop",
                "अपनी दुकान के बारे में पूछें",
                "Apni dukaan ke baare mein poochho",
              )}
              description={l(
                "Stock, khata, sales and bills. Ask in Hindi, English or Hinglish.",
                "स्टॉक, खाता, बिक्री और बिल। हिंदी, अंग्रेज़ी या हिंग्लिश में पूछें।",
                "Stock, khata, sales aur bills. Hindi, English ya Hinglish mein poochho.",
              )}
            />
            <ul
              className="sc-ask"
              aria-label={l(
                "Example questions",
                "उदाहरण के सवाल",
                "Example sawaal",
              )}
            >
              {EXAMPLES.map((e) => (
                <li key={e[2]}>
                  <button
                    type="button"
                    className="sc-ask-btn"
                    onClick={() => void send(l(...e))}
                  >
                    {l(...e)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {turns.map((t) => (
          <article key={t.id} className="sc-turn" data-role={t.role}>
            <h3 className="sc-who">
              {t.role === "user"
                ? l("You", "आप", "Aap")
                : l("Saathi", "साथी", "Saathi")}
            </h3>
            <MessageText
              text={
                t.role === "assistant" ? stripConfirmPrompt(t.text) : t.text
              }
            />
            {t.attachments && t.attachments.length > 0 ? (
              <p className="sc-files">
                {t.attachments.map((a) => (
                  <a key={a.url} href={a.url} target="_blank" rel="noreferrer">
                    {a.kind === "report_pdf"
                      ? l(
                          "Open report (PDF)",
                          "रिपोर्ट खोलें (PDF)",
                          "Report kholo (PDF)",
                        )
                      : l("Open file", "फ़ाइल खोलें", "File kholo")}
                  </a>
                ))}
              </p>
            ) : null}
          </article>
        ))}
        {showConfirm ? (
          <div
            className="sc-confirm"
            role="group"
            aria-label={l(
              "Confirm this action",
              "इस काम की पुष्टि करें",
              "Is kaam ki pushti karo",
            )}
          >
            <p className="sc-confirm-q">
              {l(
                "Saathi is waiting for your answer.",
                "साथी आपके जवाब का इंतज़ार कर रहा है।",
                "Saathi aapke jawab ka intezaar kar raha hai.",
              )}
            </p>
            <div className="sc-confirm-act">
              <Button
                variant="primary"
                onClick={() =>
                  void send("1", l("Yes, do it", "हाँ, कर दो", "Haan, kar do"))
                }
              >
                {l("Yes, do it", "हाँ, कर दो", "Haan, kar do")}
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  void send(
                    "2",
                    l("No, leave it", "नहीं, रहने दो", "Nahi, rehne do"),
                  )
                }
              >
                {l("No, leave it", "नहीं, रहने दो", "Nahi, rehne do")}
              </Button>
            </div>
            <p className="sc-note">
              {l(
                "Ask something else to leave it pending. It expires after 30 minutes.",
                "कुछ और पूछें तो यह बाक़ी रहेगा। 30 मिनट बाद ख़त्म हो जाएगा।",
                "Kuch aur poochho to yeh pending rahega. 30 minute baad expire ho jayega.",
              )}
            </p>
          </div>
        ) : null}
        {sending ? (
          <div className="sc-wait">
            <Skeleton
              shape="rows"
              count={2}
              cols={1}
              label={l(
                "Saathi is working on it",
                "साथी जवाब तैयार कर रहा है",
                "Saathi jawab taiyaar kar raha hai",
              )}
            />
          </div>
        ) : null}
        {failed ? (
          <div className="sc-err">
            <ErrorState
              title={l(
                "Saathi could not answer",
                "साथी जवाब नहीं दे पाया",
                "Saathi jawab nahi de paya",
              )}
              error={failed.message}
              onRetry={() => void send(failed.text, failed.text, true)}
              retrying={sending}
            />
          </div>
        ) : null}
      </div>
      <form className="sc-compose" onSubmit={submit}>
        <Textarea
          ref={box}
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          maxLength={2000}
          placeholder={l("Ask Saathi", "साथी से पूछें", "Saathi se poochho")}
          aria-label={l(
            "Message to Saathi",
            "साथी को संदेश",
            "Saathi ko message",
          )}
          disabled={!ready && wasOpen}
        />
        <Button
          type="submit"
          variant="primary"
          icon={<SendIcon size={16} />}
          loading={sending}
          disabled={!draft.trim() || (!ready && wasOpen)}
        >
          {l("Send", "भेजें", "Bhejo")}
        </Button>
      </form>
    </div>
  );
}
