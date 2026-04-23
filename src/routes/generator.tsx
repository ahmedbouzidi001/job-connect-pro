import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, Wand2, Download, FileText, Mail, Link2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { generateApplication, scrapeJobUrl } from "@/server/cv.functions";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { downloadAsPdf } from "@/lib/pdf-export";

export const Route = createFileRoute("/generator")({
  component: GeneratorPage,
});

type Output = { match_score: number; tailored_cv: string; cover_letter: string; keywords: string[]; advice: string };

function GeneratorPage() {
  const { user, loading } = useAuth();
  const { locale } = useI18n();
  const navigate = useNavigate();
  const generate = useServerFn(generateApplication);
  const scrape = useServerFn(scrapeJobUrl);

  const [cvText, setCvText] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [tone, setTone] = useState<"professional" | "enthusiastic" | "concise">("professional");
  const [scraping, setScraping] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [output, setOutput] = useState<Output | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("cv_raw_text").eq("user_id", user.id).single().then(({ data }) => {
      if (data?.cv_raw_text) setCvText(data.cv_raw_text);
    });
  }, [user]);

  // Pré-remplir depuis la recherche d'emploi (/jobs)
  useEffect(() => {
    const stored = sessionStorage.getItem("hireme:prefilled-job");
    if (!stored) return;
    try {
      const j = JSON.parse(stored) as { jobTitle?: string; company?: string; jobUrl?: string; jobDescription?: string };
      if (j.jobTitle) setJobTitle(j.jobTitle);
      if (j.company) setCompany(j.company);
      if (j.jobUrl) setJobUrl(j.jobUrl);
      if (j.jobDescription) setJobDescription(j.jobDescription);
      sessionStorage.removeItem("hireme:prefilled-job");
      toast.success("Offre pré-remplie", { description: `${j.jobTitle} · ${j.company}` });
    } catch { /* ignore */ }
  }, []);

  const handleScrape = async () => {
    if (!jobUrl) return;
    setScraping(true);
    try {
      const res = await scrape({ data: { url: jobUrl } });
      setJobTitle(res.title);
      setCompany(res.company);
      setJobDescription(res.description);
      toast.success("Offre extraite", { description: `${res.title} · ${res.company}` });
    } catch (e) {
      toast.error("Extraction impossible", { description: (e as Error).message });
    } finally {
      setScraping(false);
    }
  };

  const handleGenerate = async () => {
    if (cvText.length < 50) { toast.error("CV manquant", { description: "Allez sur l'onglet CV pour importer le vôtre." }); return; }
    if (jobDescription.length < 20 || !jobTitle || !company) { toast.error("Offre incomplète"); return; }
    setGenerating(true);
    setOutput(null);
    try {
      const res = await generate({ data: { cvText, jobUrl: jobUrl || null, jobDescription, jobTitle, company, language: locale, tone } });
      setOutput(res);
      toast.success("Documents générés", { description: `Match ${res.match_score}/100 · Sauvegardé dans vos candidatures.` });
    } catch (e) {
      toast.error("Génération échouée", { description: (e as Error).message });
    } finally {
      setGenerating(false);
    }
  };

  if (loading || !user) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="pt-24 pb-16 max-w-7xl mx-auto px-4 sm:px-6">
        <header className="mb-8">
          <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tighter">Générateur CV + Lettre de motivation</h1>
          <p className="text-muted-foreground mt-2">Collez l'URL d'une offre (ou la description). L'IA adapte votre CV et rédige une LM personnalisée optimisée ATS.</p>
        </header>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            {/* CV status */}
            <div className="glass-panel rounded-2xl p-4 flex items-center gap-3">
              <FileText className="size-5 text-muted-foreground" />
              <div className="flex-1 text-sm">
                {cvText.length > 50 ? (
                  <><span className="font-bold text-foreground">CV chargé</span> · <span className="text-muted-foreground">{cvText.length} caractères</span></>
                ) : (
                  <span className="text-muted-foreground">Aucun CV. <Link to="/cv" className="font-bold underline">Importez-le ici →</Link></span>
                )}
              </div>
            </div>

            {/* URL scrape */}
            <div className="glass-panel rounded-3xl p-5 space-y-3">
              <label className="text-sm font-bold flex items-center gap-2"><Link2 className="size-4" /> URL de l'offre (optionnel)</label>
              <div className="flex gap-2">
                <Input placeholder="https://linkedin.com/jobs/... ou n'importe quel site" value={jobUrl} onChange={(e) => setJobUrl(e.target.value)} />
                <Button onClick={handleScrape} disabled={scraping || !jobUrl} variant="outline">
                  {scraping ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">⚠️ LinkedIn bloque souvent. Si l'extraction échoue, copiez-collez la description manuellement ci-dessous.</p>
            </div>

            {/* Manual fields */}
            <div className="glass-panel rounded-3xl p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-muted-foreground mb-1 block">Intitulé du poste</label>
                  <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="ex: Senior Frontend Engineer" />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground mb-1 block">Entreprise</label>
                  <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="ex: Vercel" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground mb-1 block">Description de l'offre</label>
                <Textarea value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} rows={8} placeholder="Collez missions, profil recherché, compétences requises…" />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground mb-2 block">Ton de la lettre</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { v: "professional", l: "Professionnel" },
                    { v: "enthusiastic", l: "Enthousiaste" },
                    { v: "concise", l: "Concis" },
                  ] as const).map((opt) => (
                    <button key={opt.v} onClick={() => setTone(opt.v)}
                      className={`h-9 rounded-lg border text-xs font-bold transition-all ${tone === opt.v ? "border-hyper-cyan bg-hyper-cyan/10" : "border-border text-muted-foreground hover:border-foreground/40"}`}>
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>
              <Button onClick={handleGenerate} disabled={generating} size="lg" className="w-full rounded-xl font-bold pulse-glow h-12">
                {generating ? <><Loader2 className="size-4 me-2 animate-spin" /> Génération…</> : <><Sparkles className="size-4 me-2" /> Générer CV + Lettre</>}
              </Button>
            </div>
          </div>

          {/* Output */}
          <div className="space-y-4">
            {!output && !generating && (
              <div className="glass-panel rounded-3xl p-10 text-center">
                <Wand2 className="size-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Vos documents apparaîtront ici.</p>
              </div>
            )}
            {generating && (
              <div className="glass-panel rounded-3xl p-10 text-center">
                <Loader2 className="size-8 animate-spin mx-auto mb-3 text-hyper-cyan" />
                <p className="text-sm text-muted-foreground">Création du CV adapté + lettre de motivation…</p>
              </div>
            )}
            {output && (
              <>
                <div className="glass-panel rounded-2xl p-5 flex items-center justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-widest text-muted-foreground">Match score</div>
                    <div className="font-display text-4xl font-bold tabular-nums" style={{ color: "var(--hyper-lime)" }}>{output.match_score}<span className="text-lg text-muted-foreground">/100</span></div>
                  </div>
                  <div className="text-end max-w-[60%]">
                    <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Mots-clés à mettre en avant</div>
                    <div className="flex flex-wrap gap-1 justify-end">
                      {output.keywords.map((k) => (
                        <span key={k} className="text-[10px] font-mono px-2 py-0.5 rounded border border-hyper-cyan/40 bg-hyper-cyan/10">{k}</span>
                      ))}
                    </div>
                  </div>
                </div>

                <DocPanel
                  icon={FileText}
                  title="CV adapté à l'offre"
                  content={output.tailored_cv}
                  onDownload={() => downloadAsPdf(`CV-${company}-${jobTitle}.pdf`, `CV — ${jobTitle}`, output.tailored_cv)}
                />
                <DocPanel
                  icon={Mail}
                  title="Lettre de motivation"
                  content={output.cover_letter}
                  onDownload={() => downloadAsPdf(`LM-${company}-${jobTitle}.pdf`, `Lettre de motivation — ${company}`, output.cover_letter)}
                />

                <div className="glass-panel rounded-2xl p-4 text-sm text-muted-foreground">
                  💡 <span className="font-bold text-foreground">Conseil IA :</span> {output.advice}
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function DocPanel({ icon: Icon, title, content, onDownload }: { icon: typeof FileText; title: string; content: string; onDownload: () => void }) {
  return (
    <div className="glass-panel rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="size-4" style={{ color: "var(--hyper-cyan)" }} />
          <h3 className="font-bold text-sm">{title}</h3>
        </div>
        <Button onClick={onDownload} size="sm" variant="outline" className="rounded-lg"><Download className="size-3.5 me-1.5" /> PDF</Button>
      </div>
      <pre className="whitespace-pre-wrap text-xs leading-relaxed font-sans text-muted-foreground max-h-96 overflow-y-auto">{content}</pre>
    </div>
  );
}