import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/contexts/I18nContext";
import { ArrowRight } from "lucide-react";

export function CTA() {
  const { t } = useI18n();
  return (
    <section className="py-20 sm:py-28">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="glass-panel rounded-3xl p-10 sm:p-14 text-center relative overflow-hidden">
          <div className="absolute -top-20 start-1/2 -translate-x-1/2 size-72 rounded-full bg-hyper-cyan/15 blur-[100px] pointer-events-none" />
          <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-tighter mb-4">{t("cta.title")}</h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-8">{t("cta.subtitle")}</p>
          <Button asChild size="lg" className="rounded-xl font-bold pulse-glow h-12 px-8 text-base">
            <Link to="/auth">{t("cta.button")}<ArrowRight className="size-4 ms-2" /></Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
