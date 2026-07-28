import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { Loader2, Upload, Briefcase, Sparkles, TrendingUp, FileText, Wand2, Linkedin, ArrowRight, Search, GraduationCap, Users, MessageSquare, Eye, EyeOff, User as UserIcon, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { deleteMyAccount } from "@/lib/api/profile.functions";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ score: null as number | null, applications: 0, analyses: 0 });
  const [visible, setVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const deleteAccount = useServerFn(deleteMyAccount);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("profiles").select("employability_score, recruiter_visible").eq("user_id", user.id).single(),
      supabase.from("applications").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("cv_analyses").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    ]).then(([p, a, c]) => {
      setStats({
        score: p.data?.employability_score ?? null,
        applications: a.count ?? 0,
        analyses: c.count ?? 0,
      });
      setVisible(Boolean(p.data?.recruiter_visible));
    });
  }, [user]);

  const toggleVisible = async (v: boolean) => {
    setVisible(v);
    const { error } = await supabase.from("profiles").update({ recruiter_visible: v }).eq("user_id", user!.id);
    if (error) { toast.error(error.message); setVisible(!v); }
    else toast.success(v ? "Tu es visible par les recruteurs" : "Tu es masqué des recruteurs");
  };

  const handleDelete = async () => {
    const first = window.confirm("Supprimer définitivement ton compte ? Cette action est irréversible.");
    if (!first) return;
    const second = window.prompt("Tape SUPPRIMER pour confirmer.");
    if (second !== "SUPPRIMER") return;
    setDeleting(true);
    try {
      await deleteAccount();
      await supabase.auth.signOut();
      toast.success("Compte supprimé.");
      navigate({ to: "/" });
    } catch (e) {
      toast.error((e as Error).message);
      setDeleting(false);
    }
  };

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

        {/* Action principale */}
        <Link
          to="/jobs"
          className="block glass-panel rounded-2xl p-6 sm:p-8 mb-6 hover:border-foreground/30 transition-all group relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, color-mix(in oklab, var(--hyper-cyan) 12%, transparent), color-mix(in oklab, var(--hyper-lime) 8%, transparent))" }}
        >
          <div className="flex items-start gap-5">
            <div className="size-14 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--hyper-cyan)", color: "black" }}>
              <Search className="size-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold uppercase tracking-wider text-[color:var(--hyper-cyan)] mb-1">Commence ici</div>
              <h3 className="font-display text-2xl font-bold mb-1">Trouver des offres adaptées à mon profil</h3>
              <p className="text-sm text-muted-foreground">L'IA cherche en temps réel sur LinkedIn, Indeed, Welcome to the Jungle + sites locaux. Jusqu'à 50 offres scorées + génération CV+LM en 1 clic.</p>
            </div>
            <ArrowRight className="size-6 text-[color:var(--hyper-cyan)] group-hover:translate-x-1 transition-transform shrink-0 mt-2" />
          </div>
        </Link>

        <div className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Candidat</div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <ModuleCard to="/profile" icon={UserIcon} title="Mon profil" desc="Identité, photo, expériences, skills" tone="cyan" />
          <ModuleCard to="/cv" icon={FileText} title="Analyser mon CV" desc="Score d'employabilité + recommandations IA" tone="cyan" />
          <ModuleCard to="/generator" icon={Wand2} title="CV+LM manuel" desc="3 templates pro avec ton nom en en-tête" tone="lime" />
          <ModuleCard to="/skills" icon={GraduationCap} title="Skills Hub" desc="Certifs gratuites adaptées à ton profil" tone="cyan" />
          <ModuleCard to="/linkedin" icon={Linkedin} title="LinkedIn" desc="Audit + réécriture profil par IA" tone="lime" />
          <ModuleCard to="/applications" icon={Briefcase} title="Mes candidatures" desc="Pipeline Kanban : sauvegardé → offre" tone="cyan" />
          <ModuleCard to="/messages" icon={MessageSquare} title="Messages" desc="Discute avec les recruteurs" tone="lime" />
          <ModuleCard to="/pricing" icon={Crown} title="Premium" desc="Auto-apply, exports illimités, priorité" tone="cyan" />
        </div>

        <div className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Recruteur</div>
        <div className="grid md:grid-cols-3 gap-4">
          <ModuleCard to="/recruiter-jobs" icon={Briefcase} title="Mes offres" desc="Publier & gérer le pipeline candidats" tone="cyan" />
          <ModuleCard to="/recruiter" icon={Users} title="Trouver des candidats" desc="Filtres + recherche IA en langage naturel" tone="cyan" />
          <ModuleCard to="/messages" icon={MessageSquare} title="Messagerie" desc="Contact direct avec les profils" tone="lime" />
        </div>

        <div className="glass-panel rounded-2xl p-5 mt-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {visible ? <Eye className="size-5 text-[color:var(--hyper-cyan)]" /> : <EyeOff className="size-5 text-muted-foreground" />}
            <div>
              <div className="font-bold text-sm">Visibilité recruteur</div>
              <p className="text-xs text-muted-foreground">Autorise les recruteurs à voir ton profil dans leurs recherches.</p>
            </div>
          </div>
          <Switch checked={visible} onCheckedChange={toggleVisible} />
        </div>

        <div className="glass-panel rounded-2xl p-5 mt-6 flex items-center justify-between gap-4 border-destructive/40">
          <div className="flex items-center gap-3">
            <Trash2 className="size-5 text-destructive" />
            <div>
              <div className="font-bold text-sm">Supprimer mon compte</div>
              <p className="text-xs text-muted-foreground">Efface définitivement ton profil, CV, candidatures et messages. Irréversible.</p>
            </div>
          </div>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs font-bold px-4 py-2 rounded-lg border border-destructive/60 text-destructive hover:bg-destructive/10 disabled:opacity-50"
          >
            {deleting ? "Suppression…" : "Supprimer"}
          </button>
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
