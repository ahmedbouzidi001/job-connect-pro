import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, Wand2, Download, FileText, Mail } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { generateApplication } from "@/server/cv.functions";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { exportCvPdf, exportCoverLetterPdf, type StructuredCV, type CoverLetter, type CvTemplate } from "@/lib/pdf-export";

export const Route = createFileRoute("/generator")({ component: GeneratorPage });

type Output = { match_score: number; cv: StructuredCV; cover_letter: CoverLetter; keywords: string[]; advice: string };

function GeneratorPage() {
  const { user, loading } = useAuth();
  const { locale } = useI18n();
  const navigate = useNavigate();
  const generate = useServerFn(generateApplication);

  const [cvText, setCvText] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [tone, setTone] = useState<"professional" | "enthusiastic" | "concise">("professional");
  const [template, setTemplate] = useState<CvTemplate>("modern");
  const [generating, setGenerating] = useState(false);
  const [output, setOutput] = useState<Output | null>(null);

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("cv_raw_text, preferred_template").eq("user_id", user.id).single().then(({ data }) => {
      if (data?.cv_raw_text) setCvText(data.cv_raw_text);
      if (data?.preferred_template) setTemplate(data.preferred_template as CvTemplate);
    });
  }, [user]);

  useEffect(() => {
    const stored = sessionStorage.getItem("hireme:prefilled-job");
    if (!stored) return;
    try {
      const j = JSON.parse(stored);
      if (j.jobTitle) setJobTitle(j.jobTitle);
      if (j.company) setCompany(j.company);
      if (j.jobUrl) setJobUrl(j.jobUrl);
      if (j.jobDescription) setJobDescription(j.jobDescription);
      sessionStorage.removeItem("hireme:prefilled-job");
      toast.success("Offre pré-remplie", { description: `${j.jobTitle} · ${j.company}` });
    } catch {}
  }, []);

  const handleGenerate = async () => {
    if (cvText.length < 50) { toast.error("CV manquant", { description: "Allez sur l'onglet CV pour l'importer." }); return; }
    if (jobDescription.length < 20 || !jobTitle || !company) { toast.error("Offre incomplète"); return; }
    setGenerating(true); setOutput(null);
    try {
      const res = await generate({ data: { cvText, jobUrl: jobUrl || null, jobDescription, jobTitle, company, language: locale, tone } });
      setOutput(res as Output);
      // Save preferred template
      if (user) await supabase.from("profiles").update({ preferred_template: template }).eq("user_id", user.id);
      toast.success("Documents générés", { description: `Match ${res.match_score}/100` });
    } catch (e) {
      toast.error("Génération échouée", { description: (e as Error).message });
    } finally { setGenerating(false); }
  };

  const downloadCv = () => {
    if (!output) return;
    exportCvPdf(output.cv, template, `CV-${output.cv.full_name.replace(/\s+/g, "_")}-${company}.pdf`);
  };
  const downloadLm = () => {
    if (!output) return;
    exportCoverLetterPdf(output.cv, output.cover_letter, template, `LM-${output.cv.full_name.replace(/\s+/g, "_")}-${company}.pdf`);
  };

  if (loading || !user) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="size-6 animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="pt-24 pb-16 max-w-7xl mx-auto px-4 sm:px-6">
        <header className="mb-8">
          <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tighter">Générateur CV + Lettre</h1>
          <p className="text-muted-foreground mt-2">Format pro avec votre nom en en-tête. 3 templates au choix.</p>
        </header>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="glass-panel rounded-2xl p-4 flex items-center gap-3">
              <FileText className="size-5 text-muted-foreground" />
              <div className="flex-1 text-sm">
                {cvText.length > 50 ? <><span className="font-bold">CV chargé</span> · {cvText.length} caractères</> : <span className="text-muted-foreground">Aucun CV. <Link to="/cv" className="font-bold underline">Importez-le →</Link></span>}
              </div>
            </div>

            <div className="glass-panel rounded-3xl p-5 space-y-3">
              <label className="text-sm font-bold block">Choisis ton template</label>
              <div className="grid grid-cols-3 gap-2">
                {([{v:"modern",l:"Modern",d:"Teal"},{v:"classic",l:"Classique",d:"Slate"},{v:"executive",l:"Executive",d:"Brown"}] as const).map(o => (
                  <button key={o.v} onClick={() => setTemplate(o.v)}
                    className={`h-16 rounded-xl border-2 text-xs font-bold transition-all flex flex-col items-center justify-center ${template===o.v ? "border-hyper-cyan bg-hyper-cyan/10" : "border-border text-muted-foreground hover:border-foreground/40"}`}>
                    <span>{o.l}</span><span className="text-[10px] opacity-60">{o.d}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="glass-panel rounded-3xl p-5 space-y-3">
              <Input placeholder="URL offre (optionnel)" value={jobUrl} onChange={(e) => setJobUrl(e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Intitulé du poste" />
                <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Entreprise" />
              </div>
              <Textarea value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} rows={8} placeholder="Description de l'offre…" />
              <div className="grid grid-cols-3 gap-2">
                {([{v:"professional",l:"Pro"},{v:"enthusiastic",l:"Enthousiaste"},{v:"concise",l:"Concis"}] as const).map(o => (
                  <button key={o.v} onClick={() => setTone(o.v)} className={`h-9 rounded-lg border text-xs font-bold ${tone===o.v ? "border-hyper-cyan bg-hyper-cyan/10" : "border-border text-muted-foreground"}`}>{o.l}</button>
                ))}
              </div>
              <Button onClick={handleGenerate} disabled={generating} size="lg" className="w-full rounded-xl font-bold h-12">
                {generating ? <><Loader2 className="size-4 me-2 animate-spin" /> Génération…</> : <><Sparkles className="size-4 me-2" /> Générer CV + Lettre</>}
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            {!output && !generating && (
              <div className="glass-panel rounded-3xl p-10 text-center">
                <Wand2 className="size-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Vos documents apparaîtront ici.</p>
              </div>
            )}
            {generating && <div className="glass-panel rounded-3xl p-10 text-center"><Loader2 className="size-8 animate-spin mx-auto mb-3 text-hyper-cyan" /><p className="text-sm text-muted-foreground">Création en cours…</p></div>}
            {output && (
              <>
                <div className="glass-panel rounded-2xl p-5 flex items-center justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-widest text-muted-foreground">Match score</div>
                    <div className="font-display text-4xl font-bold tabular-nums" style={{ color: "var(--hyper-lime)" }}>{output.match_score}<span className="text-lg text-muted-foreground">/100</span></div>
                  </div>
                  <div className="text-end max-w-[60%]">
                    <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Mots-clés</div>
                    <div className="flex flex-wrap gap-1 justify-end">
                      {output.keywords.map((k) => <span key={k} className="text-[10px] font-mono px-2 py-0.5 rounded border border-hyper-cyan/40 bg-hyper-cyan/10">{k}</span>)}
                    </div>
                  </div>
                </div>

                <div className="glass-panel rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2"><FileText className="size-4 text-hyper-cyan" /><h3 className="font-bold text-sm">CV adapté · {output.cv.full_name}</h3></div>
                    <Button onClick={downloadCv} size="sm" variant="outline" className="rounded-lg"><Download className="size-3.5 me-1.5" /> PDF</Button>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1 max-h-80 overflow-y-auto">
                    <div className="font-bold text-foreground text-base">{output.cv.full_name}</div>
                    <div className="italic">{output.cv.headline}</div>
                    <div>{output.cv.email} · {output.cv.phone} · {output.cv.location}</div>
                    <p className="mt-2">{output.cv.summary}</p>
                    <div className="font-bold text-foreground mt-3">Expériences ({output.cv.experiences?.length})</div>
                    {output.cv.experiences?.slice(0, 2).map((e, i) => <div key={i}>• {e.title} @ {e.company}</div>)}
                  </div>
                </div>

                <div className="glass-panel rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2"><Mail className="size-4 text-hyper-cyan" /><h3 className="font-bold text-sm">Lettre de motivation</h3></div>
                    <Button onClick={downloadLm} size="sm" variant="outline" className="rounded-lg"><Download className="size-3.5 me-1.5" /> PDF</Button>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-2 max-h-80 overflow-y-auto">
                    <div className="font-bold">{output.cover_letter.subject}</div>
                    <div>{output.cover_letter.greeting}</div>
                    {output.cover_letter.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
                    <div>{output.cover_letter.closing}</div>
                    <div className="font-bold text-foreground">{output.cover_letter.signature}</div>
                  </div>
                </div>

                <div className="glass-panel rounded-2xl p-4 text-sm text-muted-foreground">💡 <span className="font-bold text-foreground">Conseil :</span> {output.advice}</div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
