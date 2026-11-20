"use client";

import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { LANGS, LANG_COOKIE, translate, type Lang } from "./i18n";
import { setDateLang } from "./dlang";

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
}
const LangContext = createContext<Ctx>({ lang: "hing", setLang: () => {} });

export function LangProvider({
  initial,
  children,
}: {
  initial: Lang;
  children: ReactNode;
}) {
  const [lang, setLangState] = useState<Lang>(initial);
  setDateLang(lang);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
  }, []);
  useEffect(() => {
    document.documentElement.lang =
      LANGS.find((x) => x.id === lang)?.htmlLang ?? "en";
  }, [lang]);
  return (
    <LangContext.Provider value={{ lang, setLang }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}

/** Plain-string translator, for attributes and props. */
export function useT() {
  const { lang } = useLang();
  return useCallback(
    (key: string) => translate(lang, key).replace(/[*_]/g, ""),
    [lang],
  );
}

/** Inline three-way picker: l("English", "हिन्दी", "Hinglish"). */
export type L = (en: string, hi: string, hing: string) => string;
export function useL(): L {
  const { lang } = useLang();
  return useCallback<L>((en, hi, hing) => (lang === "en" ? en : lang === "hi" ? hi : hing), [lang]);
}

/** Translated text; `*word*` becomes a blue key word, `_word_` bold navy. */
export function T({ k }: { k: string }) {
  const { lang } = useLang();
  const parts = translate(lang, k).split(/(\*[^*]+\*|_[^_]+_)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("*") ? (
          <em key={i}>{p.slice(1, -1)}</em>
        ) : p.startsWith("_") ? (
          <span key={i} className="hl-b">
            {p.slice(1, -1)}
          </span>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

/** English | हिन्दी | Hinglish switch. */
export function LangToggle({ onDark = false }: { onDark?: boolean }) {
  const { lang, setLang } = useLang();
  const t = useT();
  return (
    <div
      className="lang-tg"
      role="group"
      aria-label={t("lang.label")}
      data-on-dark={onDark || undefined}
    >
      {LANGS.map((l) => (
        <button
          key={l.id}
          type="button"
          className="lang-tg-btn"
          aria-pressed={lang === l.id}
          lang={l.htmlLang}
          onClick={() => setLang(l.id)}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
