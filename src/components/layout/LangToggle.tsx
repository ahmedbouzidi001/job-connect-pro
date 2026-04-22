import { useI18n } from "@/contexts/I18nContext";
import { locales, type Locale } from "@/lib/i18n";

export function LangToggle() {
  const { locale, setLocale } = useI18n();
  return (
    <div className="flex items-center bg-muted/60 rounded-full p-1 border border-border">
      {locales.map((l) => (
        <button
          key={l.code}
          onClick={() => setLocale(l.code as Locale)}
          aria-label={l.native}
          className={`px-2.5 py-1 text-[10px] font-bold rounded-full transition-colors ${
            locale === l.code ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
