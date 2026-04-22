import { useI18n } from "@/contexts/I18nContext";
import { FileSearch, FileText, Workflow } from "lucide-react";

export function Features() {
  const { t } = useI18n();
  const cards = [
    { n: "01", icon: FileSearch, title: t("feature1.title"), desc: t("feature1.desc"), tone: "cyan" as const },
    { n: "02", icon: FileText, title: t("feature2.title"), desc: t("feature2.desc"), tone: "lime" as const },
    { n: "03", icon: Workflow, title: t("feature3.title"), desc: t("feature3.desc"), tone: "cyan" as const },
  ];
  return (
    <section className="py-20 sm:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="max-w-2xl mb-14">
          <h2 className="font-display text-4xl sm:text-5xl font-bold tracking-tighter mb-4">{t("features.title")}</h2>
          <p className="text-muted-foreground text-lg">{t("features.subtitle")}</p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {cards.map((c) => {
            const Icon = c.icon;
            const accent = c.tone === "cyan" ? "var(--hyper-cyan)" : "var(--hyper-lime)";
            return (
              <div key={c.n} className="glass-panel rounded-2xl p-8 relative overflow-hidden group hover:border-foreground/20 transition-colors">
                <div className="absolute top-0 end-0 p-4 text-[64px] font-display font-bold text-foreground/[0.04] leading-none">{c.n}</div>
                <div className="size-12 rounded-xl mb-5 flex items-center justify-center"
                  style={{ backgroundColor: `color-mix(in oklab, ${accent} 18%, transparent)`, color: accent }}>
                  <Icon className="size-6" />
                </div>
                <h3 className="font-display text-2xl font-bold mb-3">{c.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{c.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
