import { useI18n } from "@/contexts/I18nContext";

export function Stats() {
  const { t } = useI18n();
  const items = [
    { value: "10k+", label: t("stats.users") },
    { value: "50k+", label: t("stats.jobs") },
    { value: "94%", label: t("stats.rate") },
  ];
  return (
    <section className="py-12 border-y border-border/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-3 gap-6">
        {items.map((s) => (
          <div key={s.label} className="text-center">
            <div className="font-display text-4xl sm:text-5xl font-bold tabular-nums">{s.value}</div>
            <div className="text-xs sm:text-sm text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
