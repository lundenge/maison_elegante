import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import { translations, LANGS } from "./translations";

const STORAGE_KEY = "maison_lang";
const I18nCtx = createContext(null);

function detectBrowserLang() {
  const stored = typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY);
  if (stored && translations[stored]) return stored;

  const nav = typeof navigator !== "undefined"
    ? (navigator.languages && navigator.languages[0]) || navigator.language || "en"
    : "en";
  const short = String(nav).toLowerCase().split("-")[0];
  if (short === "fr") return "fr";
  if (short === "sw") return "sw";
  return "en";
}

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(detectBrowserLang);

  const change = useCallback((code) => {
    setLang(code);
    localStorage.setItem(STORAGE_KEY, code);
  }, []);

  const t = useCallback((key, vars) => {
    const dict = translations[lang] || translations.en;
    let s = dict[key] ?? translations.en[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        s = s.replace(new RegExp(`\\{${k}\\}`, "g"), v);
      }
    }
    return s;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang: change, t, langs: LANGS }), [lang, change, t]);

  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export const useT = () => useContext(I18nCtx);
