import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, Briefcase, Sparkles, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

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
          <StatCard icon={TrendingUp} label={t("dash.score")} value="—" tone="cyan" />
          <StatCard icon={Briefcase} label={t("dash.applications")} value="0" tone="lime" />
          <StatCard icon={Sparkles} label={t("dash.matches")} value="0" tone="cyan" />
        </div>

        <div className="glass-panel rounded-3xl p-10 sm:p-14 text-center">
          <div className="size-14 rounded-2xl mx-auto mb-5 flex items-center justify-center"
            style={{ backgroundColor: "color-mix(in oklab, var(--hyper-cyan) 18%, transparent)", color: "var(--hyper-cyan)" }}>
            <Upload className="size-6" />
          </div>
          <p className="text-muted-foreground mb-6">{t("dash.empty.cv")}</p>
          <Button size="lg" className="rounded-xl font-bold pulse-glow h-12 px-8" disabled>
            <Upload className="size-4 me-2" />{t("dash.upload")}
          </Button>
          <p className="text-xs text-muted-foreground mt-4">Coming next: AI CV analysis powered by Lovable AI.</p>
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
