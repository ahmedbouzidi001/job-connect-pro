import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { translate, type Locale, locales } from "@/lib/i18n";

type I18nCtx = { locale: Locale; setLocale: (l: Locale) => void; t: (key: string) => string; dir: "ltr" | "rtl" };

const Ctx = createContext<I18nCtx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("fr");

  useEffect(() => {
    const stored = (typeof localStorage !== "undefined" && localStorage.getItem("hireme-locale")) as Locale | null;
    if (stored && locales.find((l) => l.code === stored)) setLocale(stored);
  }, []);

  useEffect(() => {
    const meta = locales.find((l) => l.code === locale)!;
    document.documentElement.lang = locale;
    document.documentElement.dir = meta.dir;
    try { localStorage.setItem("hireme-locale", locale); } catch {}
  }, [locale]);

  const dir = locales.find((l) => l.code === locale)!.dir;

  return (
    <Ctx.Provider value={{ locale, setLocale, t: (k) => translate(locale, k), dir }}>
      {children}
    </Ctx.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
