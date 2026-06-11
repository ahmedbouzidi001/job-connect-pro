import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Upload, FileText, Sparkles, CheckCircle2, AlertCircle, Lightbulb, Target } from "lucide-react";
import { extractPdfText } from "@/lib/pdf-parse";
import { useServerFn } from "@tanstack/react-start";
import { analyzeCv } from "@/lib/api/cv.functions";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/cv")({
  component: CvPage,
});

type Analysis = {
  score: number;
  summary: string;
  strengths: string[];
  gaps: string[];
  recommendations: string[];
  market_positioning: string;
};

function CvPage() {
  const { user, loading } = useAuth();
  const { locale } = useI18n();
  const navigate = useNavigate();
  const analyze = useServerFn(analyzeCv);

  const [cvText, setCvText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [market, setMarket] = useState<"tunisia" | "international" | "both">("both");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  // Charger le dernier CV stocké
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("cv_raw_text").eq("user_id", user.id).single().then(({ data }) => {
      if (data?.cv_raw_text && !cvText) setCvText(data.cv_raw_text);
    });
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Format non supporté", { description: "Importez un PDF ou collez le texte manuellement." });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Fichier trop lourd", { description: "Maximum 10 Mo." });
      return;
    }
    setParsing(true);
    try {
      const text = await extractPdfText(file);
      if (text.length < 50) throw new Error("Texte introuvable. Le PDF est peut-être scanné.");
      setCvText(text);
      toast.success("CV importé", { description: `${text.length} caractères extraits.` });
    } catch (e) {
      toast.error("Échec d'extraction", { description: (e as Error).message });
    } finally {
      setParsing(false);
    }
  };

  const handleAnalyze = async () => {
    if (cvText.trim().length < 50) {
      toast.error("CV trop court", { description: "Importez ou collez au moins 50 caractères." });
      return;
    }
    setAnalyzing(true);
    setAnalysis(null);
    try {
      const res = await analyze({ data: { cvText, language: locale, market } });
      setAnalysis(res.analysis);
      toast.success("Analyse terminée", { description: `Score : ${res.analysis.score}/100` });
    } catch (e) {
      toast.error("Erreur d'analyse", { description: (e as Error).message });
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="pt-24 pb-16 max-w-6xl mx-auto px-4 sm:px-6">
        <header className="mb-8">
          <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tighter">Analyse de CV par IA</h1>
          <p className="text-muted-foreground mt-2">Importez votre CV, recevez un score d'employabilité et des recommandations actionnables en quelques secondes.</p>
        </header>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Input */}
          <div className="glass-panel rounded-3xl p-6 space-y-4">
            <div>
              <label className="text-sm font-bold mb-2 block">1. Votre CV</label>
              <label className="flex items-center justify-center gap-2 w-full h-28 rounded-2xl border-2 border-dashed border-border bg-card/50 cursor-pointer hover:border-hyper-cyan/50 transition-colors">
                {parsing ? (
                  <><Loader2 className="size-5 animate-spin" /> <span className="text-sm">Extraction en cours…</span></>
                ) : (
                  <><Upload className="size-5 text-muted-foreground" /> <span className="text-sm text-muted-foreground">Cliquez pour importer un PDF (max 10 Mo)</span></>
                )}
                <input type="file" accept=".pdf" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} disabled={parsing} />
              </label>
              <Textarea
                placeholder="… ou collez le texte de votre CV ici"
                value={cvText}
                onChange={(e) => setCvText(e.target.value)}
                rows={10}
                className="mt-3 font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground mt-1">{cvText.length} caractères</p>
            </div>

            <div>
              <label className="text-sm font-bold mb-2 block">2. Marché cible</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { v: "tunisia", l: "🇹🇳 Tunisie" },
                  { v: "international", l: "🌍 International" },
                  { v: "both", l: "Les deux" },
                ] as const).map((opt) => (
                  <button key={opt.v} onClick={() => setMarket(opt.v)}
                    className={`h-10 rounded-xl border text-xs font-bold transition-all ${market === opt.v ? "border-hyper-cyan bg-hyper-cyan/10 text-foreground" : "border-border text-muted-foreground hover:border-foreground/40"}`}>
                    {opt.l}
                  </button>
                ))}
              </div>
            </div>

            <Button onClick={handleAnalyze} disabled={analyzing || parsing || cvText.length < 50} size="lg" className="w-full rounded-xl font-bold pulse-glow h-12">
              {analyzing ? (<><Loader2 className="size-4 me-2 animate-spin" /> Analyse en cours…</>) : (<><Sparkles className="size-4 me-2" /> Lancer l'analyse IA</>)}
            </Button>
          </div>

          {/* Output */}
          <div className="space-y-4">
            {!analysis && !analyzing && (
              <div className="glass-panel rounded-3xl p-10 text-center">
                <FileText className="size-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Le rapport apparaîtra ici après analyse.</p>
              </div>
            )}
            {analyzing && (
              <div className="glass-panel rounded-3xl p-10 text-center">
                <Loader2 className="size-8 animate-spin mx-auto mb-3 text-hyper-cyan" />
                <p className="text-sm text-muted-foreground">L'IA décortique votre profil…</p>
              </div>
            )}
            {analysis && (
              <>
                <div className="glass-panel rounded-3xl p-6 text-center">
                  <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Score d'employabilité</div>
                  <div className="font-display text-7xl font-bold tabular-nums text-gradient-hyper">{analysis.score}</div>
                  <p className="text-sm text-muted-foreground mt-2">{analysis.summary}</p>
                </div>

                <Section icon={CheckCircle2} title="Forces" items={analysis.strengths} tone="lime" />
                <Section icon={AlertCircle} title="Lacunes" items={analysis.gaps} tone="warning" />
                <Section icon={Lightbulb} title="Recommandations" items={analysis.recommendations} tone="cyan" />

                <div className="glass-panel rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="size-4" style={{ color: "var(--hyper-cyan)" }} />
                    <h3 className="font-bold text-sm">Positionnement marché</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">{analysis.market_positioning}</p>
                </div>

                <Button asChild size="lg" className="w-full rounded-xl font-bold h-12">
                  <Link to="/generator">Générer un CV+LM pour une offre →</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function Section({ icon: Icon, title, items, tone }: { icon: typeof CheckCircle2; title: string; items: string[]; tone: "lime" | "warning" | "cyan" }) {
  const color = tone === "lime" ? "var(--hyper-lime)" : tone === "warning" ? "var(--warning)" : "var(--hyper-cyan)";
  return (
    <div className="glass-panel rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="size-4" style={{ color }} />
        <h3 className="font-bold text-sm">{title}</h3>
      </div>
      <ul className="space-y-1.5">
        {items.map((s, i) => (
          <li key={i} className="text-sm text-muted-foreground flex gap-2">
            <span className="shrink-0" style={{ color }}>•</span><span>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}