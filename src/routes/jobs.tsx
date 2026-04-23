import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, ExternalLink, Sparkles, Bookmark, Wand2, ArrowLeft, ArrowRight, Briefcase, MapPin, AlertCircle } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { searchJobs, saveJobAsApplication } from "@/server/jobs.functions";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/jobs")({
  component: JobsPage,
});

type ScoredJob = {
  idx: number;
  score: number;
  title: string;
  company: string;
  location: string;
  summary: string;
  match_reasons: string[];
  keywords: string[];
  url: string;
  source: string;
  description: string;
};

function JobsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const search = useServerFn(searchJobs);
  const saveJob = useServerFn(saveJobAsApplication);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [hasCv, setHasCv] = useState<boolean | null>(null);

  // Form
  const [role, setRole] = useState("");
  const [location, setLocation] = useState("");
  const [workType, setWorkType] = useState<"any" | "remote" | "hybrid" | "onsite">("any");
  const [contract, setContract] = useState<"any" | "full_time" | "part_time" | "contract" | "internship">("any");
  const [seniority, setSeniority] = useState<"any" | "junior" | "mid" | "senior" | "lead">("any");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryCurrency, setSalaryCurrency] = useState<"TND" | "EUR" | "USD">("EUR");
  const [keywords, setKeywords] = useState("");

  const [searching, setSearching] = useState(false);
  const [jobs, setJobs] = useState<ScoredJob[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("cv_raw_text, target_role, location").eq("user_id", user.id).single().then(({ data }) => {
      setHasCv(!!data?.cv_raw_text && data.cv_raw_text.length > 100);
      if (data?.target_role && !role) setRole(data.target_role);
      if (data?.location && !location) setLocation(data.location);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const goNext = () => setStep((s) => (s === 1 ? 2 : 3));
  const goPrev = () => setStep((s) => (s === 3 ? 2 : 1));

  const handleSearch = async () => {
    if (!role.trim() || !location.trim()) {
      toast.error("Indique au moins le poste et le lieu");
      return;
    }
    setSearching(true);
    setJobs([]);
    try {
      const res = await search({
        data: {
          role: role.trim(),
          location: location.trim(),
          workType,
          contract,
          seniority,
          salaryMin: salaryMin ? Number(salaryMin) : null,
          salaryCurrency,
          language: "fr",
          keywords: keywords.trim() || null,
          limit: 10,
        },
      }) as { jobs: ScoredJob[]; message: string | null };
      setJobs(res.jobs);
      setStep(3);
      if (res.message) toast.info(res.message);
      else toast.success(`${res.jobs.length} offres trouvées et scorées`);
    } catch (e) {
      toast.error((e as Error).message || "Erreur de recherche");
    } finally {
      setSearching(false);
    }
  };

  const handleSave = async (job: ScoredJob) => {
    setSavingId(job.url);
    try {
      await saveJob({
        data: {
          title: job.title,
          company: job.company,
          location: job.location || null,
          url: job.url,
          description: job.description?.slice(0, 5000) || null,
          matchScore: job.score,
        },
      });
      toast.success("Sauvegardé dans tes candidatures");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingId(null);
    }
  };

  const handleGenerate = (job: ScoredJob) => {
    // Pass job data via sessionStorage to generator
    sessionStorage.setItem("hireme:prefilled-job", JSON.stringify({
      jobTitle: job.title,
      company: job.company,
      jobUrl: job.url,
      jobDescription: job.description?.slice(0, 8000) || job.summary,
    }));
    navigate({ to: "/generator" });
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="pt-24 pb-16 max-w-5xl mx-auto px-4 sm:px-6">
        <header className="mb-8">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[color:var(--hyper-cyan)] mb-3">
            <Search className="size-3.5" /> Recherche d'emploi IA
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tighter mb-2">Trouve les offres qui te correspondent</h1>
          <p className="text-sm text-muted-foreground">L'IA cherche en temps réel sur LinkedIn, Indeed et Welcome to the Jungle, puis score chaque offre selon ton profil.</p>
        </header>

        {hasCv === false && (
          <div className="glass-panel rounded-2xl p-4 mb-6 flex items-start gap-3 border-amber-500/30">
            <AlertCircle className="size-5 text-amber-500 mt-0.5 shrink-0" />
            <div className="flex-1 text-sm">
              <p className="font-bold mb-1">Aucun CV analysé</p>
              <p className="text-muted-foreground">Le scoring sera moins précis. <button onClick={() => navigate({ to: "/cv" })} className="text-[color:var(--hyper-cyan)] underline">Analyse ton CV d'abord</button> pour un meilleur matching.</p>
            </div>
          </div>
        )}

        {/* Stepper */}
        <div className="flex items-center gap-2 mb-8 text-xs font-bold">
          {[1, 2, 3].map((n) => (
            <div key={n} className="flex items-center gap-2 flex-1">
              <div className={`size-7 rounded-full flex items-center justify-center transition-colors ${step >= n ? "bg-[color:var(--hyper-cyan)] text-black" : "bg-muted text-muted-foreground"}`}>{n}</div>
              <div className={`flex-1 h-0.5 ${step > n ? "bg-[color:var(--hyper-cyan)]" : "bg-muted"}`} />
            </div>
          ))}
          <div className={`size-7 rounded-full flex items-center justify-center ${step >= 3 ? "bg-[color:var(--hyper-cyan)] text-black" : "bg-muted text-muted-foreground"}`}>
            <Sparkles className="size-3.5" />
          </div>
        </div>

        {step === 1 && (
          <div className="glass-panel rounded-2xl p-6 sm:p-8 space-y-5">
            <h2 className="font-display text-xl font-bold mb-2">Quel poste cherches-tu ?</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="role" className="mb-2 block text-xs font-bold uppercase tracking-wider">Poste / Métier *</Label>
                <Input id="role" placeholder="Ex: Développeur Full-Stack React" value={role} onChange={(e) => setRole(e.target.value)} maxLength={120} />
              </div>
              <div>
                <Label htmlFor="location" className="mb-2 block text-xs font-bold uppercase tracking-wider">Lieu *</Label>
                <Input id="location" placeholder="Ex: Tunis, Paris, Remote" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={120} />
              </div>
              <div>
                <Label className="mb-2 block text-xs font-bold uppercase tracking-wider">Mode de travail</Label>
                <Select value={workType} onValueChange={(v) => setWorkType(v as typeof workType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Tous</SelectItem>
                    <SelectItem value="remote">100% Remote</SelectItem>
                    <SelectItem value="hybrid">Hybride</SelectItem>
                    <SelectItem value="onsite">Sur site</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-2 block text-xs font-bold uppercase tracking-wider">Type de contrat</Label>
                <Select value={contract} onValueChange={(v) => setContract(v as typeof contract)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Tous</SelectItem>
                    <SelectItem value="full_time">CDI / Temps plein</SelectItem>
                    <SelectItem value="part_time">Temps partiel</SelectItem>
                    <SelectItem value="contract">Freelance / Contrat</SelectItem>
                    <SelectItem value="internship">Stage / Alternance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={goNext} disabled={!role.trim() || !location.trim()} className="rounded-full font-bold">
                Suivant <ArrowRight className="size-4 ml-1.5" />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="glass-panel rounded-2xl p-6 sm:p-8 space-y-5">
            <h2 className="font-display text-xl font-bold mb-2">Affine tes critères</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label className="mb-2 block text-xs font-bold uppercase tracking-wider">Niveau d'expérience</Label>
                <Select value={seniority} onValueChange={(v) => setSeniority(v as typeof seniority)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Tous niveaux</SelectItem>
                    <SelectItem value="junior">Junior (0-2 ans)</SelectItem>
                    <SelectItem value="mid">Confirmé (3-5 ans)</SelectItem>
                    <SelectItem value="senior">Senior (6+ ans)</SelectItem>
                    <SelectItem value="lead">Lead / Manager</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-2 block text-xs font-bold uppercase tracking-wider">Salaire min annuel (optionnel)</Label>
                <div className="flex gap-2">
                  <Input type="number" placeholder="40000" value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} className="flex-1" />
                  <Select value={salaryCurrency} onValueChange={(v) => setSalaryCurrency(v as typeof salaryCurrency)}>
                    <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="TND">TND</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="kw" className="mb-2 block text-xs font-bold uppercase tracking-wider">Mots-clés / Stack (optionnel)</Label>
                <Input id="kw" placeholder="Ex: TypeScript, AWS, Kubernetes, fintech" value={keywords} onChange={(e) => setKeywords(e.target.value)} maxLength={500} />
                <p className="text-xs text-muted-foreground mt-1.5">Sépare par des virgules. Plus de mots-clés = recherche plus ciblée.</p>
              </div>
            </div>
            <div className="flex justify-between pt-2">
              <Button onClick={goPrev} variant="ghost" className="rounded-full">
                <ArrowLeft className="size-4 mr-1.5" /> Retour
              </Button>
              <Button onClick={handleSearch} disabled={searching} className="rounded-full font-bold bg-[color:var(--hyper-cyan)] text-black hover:bg-[color:var(--hyper-cyan)]/90">
                {searching ? (<><Loader2 className="size-4 mr-1.5 animate-spin" />Recherche...</>) : (<><Sparkles className="size-4 mr-1.5" />Lancer la recherche IA</>)}
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold">{jobs.length} offres scorées</h2>
              <Button onClick={() => setStep(1)} variant="outline" size="sm" className="rounded-full">
                <Search className="size-3.5 mr-1.5" /> Nouvelle recherche
              </Button>
            </div>

            {searching && (
              <div className="glass-panel rounded-2xl p-12 flex flex-col items-center gap-3">
                <Loader2 className="size-6 animate-spin text-[color:var(--hyper-cyan)]" />
                <p className="text-sm text-muted-foreground">L'IA cherche et score les offres... (~30s)</p>
              </div>
            )}

            {!searching && jobs.length === 0 && (
              <div className="glass-panel rounded-2xl p-12 text-center">
                <Briefcase className="size-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-4">Aucune offre. Élargis tes critères.</p>
                <Button onClick={() => setStep(1)} variant="outline" size="sm">Modifier la recherche</Button>
              </div>
            )}

            {jobs.map((job) => (
              <article key={job.url} className="glass-panel rounded-2xl p-5 sm:p-6 hover:border-foreground/30 transition-colors">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-base sm:text-lg leading-tight mb-1 truncate">{job.title}</h3>
                    <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-medium text-foreground">{job.company}</span>
                      {job.location && (<><span>•</span><span className="inline-flex items-center gap-1"><MapPin className="size-3" />{job.location}</span></>)}
                      <span>•</span><span className="text-xs">{job.source}</span>
                    </div>
                  </div>
                  <ScoreBadge score={job.score} />
                </div>

                <p className="text-sm text-muted-foreground mb-3">{job.summary}</p>

                <div className="mb-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Pourquoi ça matche</p>
                  <ul className="text-sm space-y-1">
                    {job.match_reasons.map((r, i) => (
                      <li key={i} className="flex gap-2"><span className="text-[color:var(--hyper-lime)]">→</span><span>{r}</span></li>
                    ))}
                  </ul>
                </div>

                {job.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {job.keywords.map((k) => (
                      <span key={k} className="text-xs px-2 py-0.5 rounded-full bg-foreground/5 border border-foreground/10">{k}</span>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-3 border-t border-border/60">
                  <Button onClick={() => handleGenerate(job)} size="sm" className="rounded-full font-bold bg-[color:var(--hyper-cyan)] text-black hover:bg-[color:var(--hyper-cyan)]/90">
                    <Wand2 className="size-3.5 mr-1.5" /> Générer CV + LM
                  </Button>
                  <Button onClick={() => handleSave(job)} disabled={savingId === job.url} variant="outline" size="sm" className="rounded-full">
                    {savingId === job.url ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Bookmark className="size-3.5 mr-1.5" />}
                    Sauvegarder
                  </Button>
                  <Button asChild variant="ghost" size="sm" className="rounded-full">
                    <a href={job.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="size-3.5 mr-1.5" /> Voir l'offre
                    </a>
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const tone = score >= 75 ? "var(--hyper-lime)" : score >= 50 ? "var(--hyper-cyan)" : "oklch(0.65 0.15 30)";
  return (
    <div
      className="shrink-0 size-14 rounded-full flex flex-col items-center justify-center font-display font-bold border-2"
      style={{ borderColor: tone, color: tone, backgroundColor: `color-mix(in oklab, ${tone} 12%, transparent)` }}
    >
      <span className="text-lg leading-none tabular-nums">{score}</span>
      <span className="text-[9px] uppercase tracking-wider opacity-70">match</span>
    </div>
  );
}
