import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, Linkedin, Copy, AlertCircle, CheckCircle2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { optimizeLinkedIn } from "@/lib/api/cv.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/linkedin")({
  component: LinkedInPage,
});

type Audit = {
  score: number;
  issues: string[];
  quick_wins: string[];
  optimized_headline: string;
  optimized_about: string;
  experience_bullets: string[];
  skills_to_add: string[];
};

function LinkedInPage() {
  const { user, loading } = useAuth();
  const { locale } = useI18n();
  const navigate = useNavigate();
  const optimize = useServerFn(optimizeLinkedIn);

  const [profileText, setProfileText] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [running, setRunning] = useState(false);
  const [audit, setAudit] = useState<Audit | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  const copy = (label: string, txt: string) => {
    navigator.clipboard.writeText(txt);
    toast.success(`${label} copié`);
  };

  const handleRun = async () => {
    if (profileText.length < 50 || !targetRole) { toast.error("Profil ou poste cible manquant"); return; }
    setRunning(true);
    setAudit(null);
    try {
      const res = await optimize({ data: { profileText, targetRole, language: locale } });
      setAudit(res);
      toast.success("Audit terminé", { description: `Score : ${res.score}/100` });
    } catch (e) {
      toast.error("Audit échoué", { description: (e as Error).message });
    } finally {
      setRunning(false);
    }
  };

  if (loading || !user) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="pt-24 pb-16 max-w-6xl mx-auto px-4 sm:px-6">
        <header className="mb-8">
          <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tighter flex items-center gap-3">
            <Linkedin className="size-10" style={{ color: "var(--hyper-cyan)" }} /> LinkedIn Optimizer
          </h1>
          <p className="text-muted-foreground mt-2">Audit complet + réécriture IA de votre headline, about et expériences pour 10x plus de vues recruteurs.</p>
        </header>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="glass-panel rounded-3xl p-6 space-y-4">
            <div>
              <label className="text-sm font-bold mb-2 block">Poste cible</label>
              <Input value={targetRole} onChange={(e) => setTargetRole(e.target.value)} placeholder="ex: Senior Frontend Engineer Remote" />
            </div>
            <div>
              <label className="text-sm font-bold mb-2 block">Texte de votre profil LinkedIn</label>
              <p className="text-xs text-muted-foreground mb-2">Allez sur linkedin.com/in/votre-profil → CTRL+A puis CTRL+C → collez tout ici (headline, about, expériences, compétences).</p>
              <Textarea value={profileText} onChange={(e) => setProfileText(e.target.value)} rows={14} className="font-mono text-xs" placeholder="Collez votre profil ici…" />
              <p className="text-xs text-muted-foreground mt-1">{profileText.length} caractères</p>
            </div>
            <Button onClick={handleRun} disabled={running} size="lg" className="w-full rounded-xl font-bold pulse-glow h-12">
              {running ? <><Loader2 className="size-4 me-2 animate-spin" /> Audit en cours…</> : <><Sparkles className="size-4 me-2" /> Lancer l'audit + réécriture</>}
            </Button>
          </div>

          <div className="space-y-4">
            {!audit && !running && (
              <div className="glass-panel rounded-3xl p-10 text-center">
                <Linkedin className="size-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Le rapport apparaîtra ici.</p>
              </div>
            )}
            {running && (
              <div className="glass-panel rounded-3xl p-10 text-center">
                <Loader2 className="size-8 animate-spin mx-auto mb-3 text-hyper-cyan" />
                <p className="text-sm text-muted-foreground">L'IA audite et réécrit votre profil…</p>
              </div>
            )}
            {audit && (
              <>
                <div className="glass-panel rounded-3xl p-6 text-center">
                  <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Score LinkedIn</div>
                  <div className="font-display text-7xl font-bold tabular-nums text-gradient-hyper">{audit.score}</div>
                </div>

                <Block icon={AlertCircle} tone="warning" title="Problèmes majeurs" items={audit.issues} />
                <Block icon={CheckCircle2} tone="lime" title="Quick wins" items={audit.quick_wins} />

                <Rewrite title="🪝 Headline optimisé" content={audit.optimized_headline} onCopy={() => copy("Headline", audit.optimized_headline)} />
                <Rewrite title="📝 About réécrit" content={audit.optimized_about} onCopy={() => copy("About", audit.optimized_about)} />

                <div className="glass-panel rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-sm">💼 Bullets d'expérience type</h3>
                    <Button onClick={() => copy("Bullets", audit.experience_bullets.map((b) => `• ${b}`).join("\n"))} size="sm" variant="outline" className="rounded-lg"><Copy className="size-3.5" /></Button>
                  </div>
                  <ul className="space-y-2">
                    {audit.experience_bullets.map((b, i) => <li key={i} className="text-sm text-muted-foreground">• {b}</li>)}
                  </ul>
                </div>

                <div className="glass-panel rounded-2xl p-5">
                  <h3 className="font-bold text-sm mb-3">🎯 Compétences à ajouter</h3>
                  <div className="flex flex-wrap gap-2">
                    {audit.skills_to_add.map((s) => <span key={s} className="text-xs px-3 py-1 rounded-full border border-hyper-cyan/40 bg-hyper-cyan/10 font-medium">{s}</span>)}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function Block({ icon: Icon, tone, title, items }: { icon: typeof AlertCircle; tone: "warning" | "lime"; title: string; items: string[] }) {
  const color = tone === "warning" ? "var(--warning)" : "var(--hyper-lime)";
  return (
    <div className="glass-panel rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3"><Icon className="size-4" style={{ color }} /><h3 className="font-bold text-sm">{title}</h3></div>
      <ul className="space-y-1.5">{items.map((s, i) => <li key={i} className="text-sm text-muted-foreground flex gap-2"><span className="shrink-0" style={{ color }}>•</span><span>{s}</span></li>)}</ul>
    </div>
  );
}

function Rewrite({ title, content, onCopy }: { title: string; content: string; onCopy: () => void }) {
  return (
    <div className="glass-panel rounded-2xl p-5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-sm">{title}</h3>
        <Button onClick={onCopy} size="sm" variant="outline" className="rounded-lg"><Copy className="size-3.5 me-1.5" /> Copier</Button>
      </div>
      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{content}</p>
    </div>
  );
}