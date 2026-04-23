import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { Loader2, Upload, Briefcase, Sparkles, TrendingUp, FileText, Wand2, Linkedin, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ score: null as number | null, applications: 0, analyses: 0 });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("profiles").select("employability_score").eq("user_id", user.id).single(),
      supabase.from("applications").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("cv_analyses").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    ]).then(([p, a, c]) => {
      setStats({
        score: p.data?.employability_score ?? null,
        applications: a.count ?? 0,
        analyses: c.count ?? 0,
      });
    });
  }, [user]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const displayName = (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="pt-24 pb-16 max-w-7xl mx-auto px-4 sm:px-6">
        <header className="mb-10">
          <p className="text-sm text-muted-foreground mb-1">{t("dash.welcome")}</p>
          <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tighter">{displayName}</h1>
        </header>

        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          <StatCard icon={TrendingUp} label={t("dash.score")} value={stats.score != null ? `${stats.score}/100` : "—"} tone="cyan" />
          <StatCard icon={Briefcase} label={t("dash.applications")} value={String(stats.applications)} tone="lime" />
          <StatCard icon={Sparkles} label="Analyses CV" value={String(stats.analyses)} tone="cyan" />
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <ModuleCard to="/cv" icon={FileText} title="Analyser mon CV" desc="Score d'employabilité + recommandations IA" tone="cyan" />
          <ModuleCard to="/generator" icon={Wand2} title="Générer CV+LM" desc="Adapté à chaque offre, optimisé ATS" tone="lime" />
          <ModuleCard to="/linkedin" icon={Linkedin} title="LinkedIn Optimizer" desc="Audit + réécriture profil par IA" tone="cyan" />
          <ModuleCard to="/applications" icon={Briefcase} title="Mes candidatures" desc="Pipeline Kanban : sauvegardé → offre" tone="lime" />
        </div>
      </main>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }: { icon: typeof Upload; label: string; value: string; tone: "cyan" | "lime" }) {
  const accent = tone === "cyan" ? "var(--hyper-cyan)" : "var(--hyper-lime)";
  return (
    <div className="glass-panel rounded-2xl p-6 flex items-center gap-4">
      <div className="size-12 rounded-xl flex items-center justify-center"
        style={{ backgroundColor: `color-mix(in oklab, ${accent} 18%, transparent)`, color: accent }}>
        <Icon className="size-5" />
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-display text-2xl font-bold tabular-nums">{value}</div>
      </div>
    </div>
  );
}

function ModuleCard({ to, icon: Icon, title, desc, tone }: { to: string; icon: typeof Upload; title: string; desc: string; tone: "cyan" | "lime" }) {
  const accent = tone === "cyan" ? "var(--hyper-cyan)" : "var(--hyper-lime)";
  return (
    <Link to={to} className="glass-panel rounded-2xl p-6 hover:border-foreground/30 transition-all group block">
      <div className="size-12 rounded-xl mb-4 flex items-center justify-center" style={{ backgroundColor: `color-mix(in oklab, ${accent} 18%, transparent)`, color: accent }}>
        <Icon className="size-5" />
      </div>
      <h3 className="font-bold mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground mb-3">{desc}</p>
      <div className="text-xs font-bold inline-flex items-center gap-1 group-hover:gap-2 transition-all" style={{ color: accent }}>
        Ouvrir <ArrowRight className="size-3" />
      </div>
    </Link>
  );
}
