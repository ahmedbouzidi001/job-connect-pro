import { Logo } from "./Logo";
import { useI18n } from "@/contexts/I18nContext";

export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="border-t border-border/70 py-12 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex flex-col items-center md:items-start gap-2">
          <Logo />
          <p className="text-xs text-muted-foreground max-w-xs text-center md:text-start">{t("footer.tagline")}</p>
        </div>
        <div className="flex gap-6 text-xs font-mono text-muted-foreground">
          <a href="#" className="hover:text-foreground">PRIVACY</a>
          <a href="#" className="hover:text-foreground">TERMS</a>
          <a href="#" className="hover:text-foreground">CONTACT</a>
        </div>
        <p className="text-[10px] text-muted-foreground font-mono">© 2024 HIREME</p>
      </div>
    </footer>
  );
}
