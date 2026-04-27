import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Sparkles, GraduationCap, ExternalLink, Target } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { recommendCertifications } from "@/server/cv.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/skills")({ component: SkillsPage });

type Reco = { skill: string; title: string; provider: string; url: string; duration: string; level: string; why: string; priority: number };

function SkillsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const recommend = useServerFn(recommendCertifications);
  const [cvText, setCvText] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [running, setRunning] = useState(false);
  const [gaps, setGaps] = useState<string[]>([]);
  const [recos, setRecos] = useState<Reco[]>([]);

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [user, loading, navigate]);
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("cv_raw_text, target_role").eq("user_id", user.id).single().then(({ data }) => {
      if (data?.cv_raw_text) setCvText(data.cv_raw_text);
      if (data?.target_role) setTargetRole(data.target_role);
    });
  }, [user]);

  const run = async () => {
    if (cvText.length < 50) { toast.error("Importe ton CV d'abord"); return; }
    if (!targetRole) { toast.error("Indique ton poste cible"); return; }
    setRunning(true);
    try {
      const res = await recommend({ data: { cvText, targetRole, language: "fr" }}) as { gaps: string[]; recommendations: Reco[] };
      setGaps(res.gaps); setRecos(res.recommendations.sort((a,b) => a.priority - b.priority));
      toast.success(`${res.recommendations.length} formations trouvées`);
    } catch (e) { toast.error((e as Error).message); }
    finally { setRunning(false); }
  };

  if (loading || !user) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="size-6 animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="pt-24 pb-16 max-w-5xl mx-auto px-4 sm:px-6">
        <header className="mb-8">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[color:var(--hyper-cyan)] mb-3"><GraduationCap className="size-3.5" /> Skills Hub</div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tighter">Améliore tes compétences gratuitement</h1>
          <p className="text-sm text-muted-foreground mt-2">L'IA analyse ton CV vs ton poste cible et te recommande des certifications 100% gratuites.</p>
        </header>

        <div className="glass-panel rounded-2xl p-6 mb-6 space-y-3">
          <Input value={targetRole} onChange={(e) => setTargetRole(e.target.value)} placeholder="Poste cible (ex: Data Scientist, Product Manager…)" />
          <Button onClick={run} disabled={running || cvText.length < 50} size="lg" className="w-full rounded-xl font-bold h-12">
            {running ? <><Loader2 className="size-4 me-2 animate-spin" /> Analyse en cours…</> : <><Sparkles className="size-4 me-2" /> Trouver mes formations</>}
          </Button>
          {cvText.length < 50 && <p className="text-xs text-muted-foreground text-center">Importe d'abord ton CV depuis l'onglet CV.</p>}
        </div>

        {gaps.length > 0 && (
          <div className="glass-panel rounded-2xl p-5 mb-6">
            <div className="flex items-center gap-2 mb-3"><Target className="size-4 text-[color:var(--hyper-cyan)]" /><h3 className="font-bold">Compétences à développer</h3></div>
            <div className="flex flex-wrap gap-2">{gaps.map(g => <span key={g} className="text-sm px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300">{g}</span>)}</div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          {recos.map((r, i) => (
            <article key={i} className="glass-panel rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1">
                  <div className="text-xs font-bold uppercase tracking-wider text-[color:var(--hyper-cyan)] mb-1">{r.skill}</div>
                  <h3 className="font-bold text-base leading-tight">{r.title}</h3>
                  <div className="text-xs text-muted-foreground mt-1">{r.provider} · {r.duration} · {r.level}</div>
                </div>
                <span className="text-[10px] font-mono px-2 py-1 rounded shrink-0" style={{ backgroundColor: r.priority <= 2 ? "color-mix(in oklab, var(--destructive) 18%, transparent)" : "color-mix(in oklab, var(--hyper-lime) 18%, transparent)", color: r.priority <= 2 ? "var(--destructive)" : "var(--hyper-lime)" }}>P{r.priority}</span>
              </div>
              <p className="text-sm text-muted-foreground mb-3">{r.why}</p>
              <Button asChild size="sm" variant="outline" className="rounded-full w-full"><a href={r.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-3.5 mr-1.5" /> Accéder à la formation gratuite</a></Button>
            </article>
          ))}
        </div>

        {recos.length === 0 && !running && (
          <div className="glass-panel rounded-2xl p-12 text-center">
            <GraduationCap className="size-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Lance l'analyse pour découvrir tes formations gratuites.</p>
          </div>
        )}
      </main>
    </div>
  );
}
