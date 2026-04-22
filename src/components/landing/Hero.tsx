import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/contexts/I18nContext";
import { Sparkles } from "lucide-react";

export function Hero() {
  const { t } = useI18n();
  return (
    <section className="relative pt-32 pb-20 overflow-hidden">
      <div className="absolute -top-32 -start-32 size-[28rem] rounded-full bg-hyper-cyan/15 blur-[120px] pointer-events-none" />
      <div className="absolute top-32 end-0 size-[24rem] rounded-full bg-hyper-lime/10 blur-[120px] pointer-events-none" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center relative">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-hyper-cyan/30 bg-hyper-cyan/5 mb-6">
            <span className="relative flex size-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-hyper-cyan opacity-75"></span>
              <span className="relative inline-flex rounded-full size-2 bg-hyper-cyan"></span>
            </span>
            <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "var(--hyper-cyan)" }}>
              {t("hero.badge")}
            </span>
          </div>
          <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-bold tracking-tighter leading-[0.95] mb-6">
            {t("hero.title.1")} <br />
            <span className="text-gradient-hyper">{t("hero.title.2")}</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-[50ch] mb-10 leading-relaxed">{t("hero.subtitle")}</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button asChild size="lg" className="rounded-xl font-bold pulse-glow text-base h-12 px-8">
              <Link to="/auth"><Sparkles className="size-4 me-2" />{t("hero.cta.primary")}</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-xl font-bold text-base h-12 px-8">
              <Link to="/auth">{t("hero.cta.secondary")}</Link>
            </Button>
          </div>
        </div>

        <div className="relative">
          <div className="glass-panel rounded-3xl p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="text-xs font-mono" style={{ color: "var(--hyper-cyan)" }}>AI_ANALYSIS_V.1.0</div>
              <div className="text-xs font-mono text-muted-foreground">TUNIS · GLOBAL</div>
            </div>
            <div className="space-y-3">
              <MatchRow logo="JS" company="Senior Frontend Engineer" location="Paris, FR · Remote" score={98} tone="lime" />
              <MatchRow logo="PY" company="Data Scientist" location="Tunis, TN · Hybrid" score={84} tone="cyan" dim />
              <MatchRow logo="GO" company="DevOps Specialist" location="Berlin, DE · Onsite" score={72} tone="muted" dim />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function MatchRow({ logo, company, location, score, tone, dim }: {
  logo: string; company: string; location: string; score: number; tone: "cyan" | "lime" | "muted"; dim?: boolean;
}) {
  const toneColor =
    tone === "lime" ? "var(--hyper-lime)" : tone === "cyan" ? "var(--hyper-cyan)" : "var(--muted-foreground)";
  const bgTone =
    tone === "lime" ? "color-mix(in oklab, var(--hyper-lime) 20%, transparent)"
      : tone === "cyan" ? "color-mix(in oklab, var(--hyper-cyan) 20%, transparent)"
      : "var(--muted)";
  return (
    <div
      className={`h-20 rounded-2xl border border-border bg-card/50 px-4 flex items-center justify-between ${dim ? "opacity-70" : ""}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="size-11 rounded-xl flex items-center justify-center font-bold text-sm shrink-0"
          style={{ backgroundColor: bgTone, color: toneColor }}>
          {logo}
        </div>
        <div className="min-w-0">
          <div className="font-bold truncate">{company}</div>
          <div className="text-xs text-muted-foreground truncate">{location}</div>
        </div>
      </div>
      <div className="text-end shrink-0 ms-3">
        <div className="text-2xl font-display font-bold tabular-nums" style={{ color: toneColor }}>{score}%</div>
        <div className="text-[10px] font-mono text-muted-foreground">MATCH</div>
      </div>
    </div>
  );
}
