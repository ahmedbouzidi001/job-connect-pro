import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Search, Sparkles, Bookmark, Wand2, ArrowLeft, ArrowRight, Briefcase, MapPin, AlertCircle, Eye, Send, Star, Mail, ExternalLink } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { searchJobs, saveJobAsApplication, scrapeJobContent } from "@/server/jobs.functions";
import { listPublicInternalJobs, applyToJob } from "@/server/recruiter-jobs.functions";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/jobs")({ component: JobsPage });

const COUNTRIES = [
  { code: "TN", label: "🇹🇳 Tunisie" }, { code: "FR", label: "🇫🇷 France" },
  { code: "MA", label: "🇲🇦 Maroc" }, { code: "DZ", label: "🇩🇿 Algérie" },
  { code: "CA", label: "🇨🇦 Canada" }, { code: "BE", label: "🇧🇪 Belgique" },
  { code: "CH", label: "🇨🇭 Suisse" }, { code: "AE", label: "🇦🇪 Émirats" },
  { code: "SA", label: "🇸🇦 Arabie S." }, { code: "QA", label: "🇶🇦 Qatar" },
  { code: "DE", label: "🇩🇪 Allemagne" }, { code: "UK", label: "🇬🇧 UK" },
  { code: "US", label: "🇺🇸 USA" }, { code: "ANY", label: "🌍 Mondial" },
];

type ScoredJob = { score: number; title: string; company: string; location: string; summary: string; match_reasons: string[]; keywords: string[]; url: string; source: string; description: string };
type FullOffer = { title: string; company: string; location: string; contract_type: string; salary: string; missions: string[]; profile: string[]; skills: string[]; benefits: string[]; full_description: string; apply_email?: string; apply_url?: string; recruiter_name?: string };
type InternalJob = { id: string; title: string; company: string; location: string | null; country_code: string | null; work_type: string | null; employment_type: string | null; description: string | null; required_skills: string[] | null; salary_min: number | null; salary_max: number | null; salary_currency: string | null };

function JobsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const search = useServerFn(searchJobs);
  const saveJob = useServerFn(saveJobAsApplication);
  const scrape = useServerFn(scrapeJobContent);
  const listInternal = useServerFn(listPublicInternalJobs);
  const apply = useServerFn(applyToJob);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [hasCv, setHasCv] = useState<boolean | null>(null);
  const [role, setRole] = useState("");
  const [location, setLocation] = useState("");
  const [countryCode, setCountryCode] = useState("TN");
  const [workType, setWorkType] = useState<"any"|"remote"|"hybrid"|"onsite">("any");
  const [contract, setContract] = useState<"any"|"full_time"|"part_time"|"contract"|"internship">("any");
  const [seniority, setSeniority] = useState<"any"|"junior"|"mid"|"senior"|"lead">("any");
  const [keywords, setKeywords] = useState("");
  const [searching, setSearching] = useState(false);
  const [jobs, setJobs] = useState<ScoredJob[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<ScoredJob | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [fullOffer, setFullOffer] = useState<FullOffer | null>(null);
  const [internal, setInternal] = useState<InternalJob[]>([]);
  const [applyTo, setApplyTo] = useState<InternalJob | null>(null);
  const [coverMsg, setCoverMsg] = useState("");
  const [applying, setApplying] = useState(false);

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [user, loading, navigate]);
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("cv_raw_text, target_role, location, preferred_country").eq("user_id", user.id).single().then(({ data }) => {
      setHasCv(!!data?.cv_raw_text && data.cv_raw_text.length > 100);
      if (data?.target_role && !role) setRole(data.target_role);
      if (data?.location && !location) setLocation(data.location);
      if (data?.preferred_country) setCountryCode(data.preferred_country);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!user) return;
    listInternal({ data: { countryCode: countryCode || null }}).then(r => setInternal((r as { jobs: InternalJob[] }).jobs)).catch(() => {});
  }, [user, countryCode, listInternal]);

  const submitApply = async () => {
    if (!applyTo || coverMsg.length < 10) { toast.error("Message trop court"); return; }
    setApplying(true);
    try { await apply({ data: { jobId: applyTo.id, coverMessage: coverMsg }}); toast.success("Candidature envoyée"); setApplyTo(null); setCoverMsg(""); }
    catch (e) { toast.error((e as Error).message); }
    finally { setApplying(false); }
  };

  const handleSearch = async () => {
    if (!role.trim() || !location.trim()) { toast.error("Indique le poste et le lieu"); return; }
    setSearching(true); setJobs([]);
    try {
      const res = await search({ data: { role: role.trim(), location: location.trim(), countryCode, workType, contract, seniority, salaryMin: null, salaryCurrency: "EUR" as const, language: "fr" as const, keywords: keywords.trim() || null, limit: 100 }}) as { jobs: ScoredJob[]; message: string | null };
      setJobs(res.jobs); setStep(3);
      if (user) await supabase.from("profiles").update({ preferred_country: countryCode }).eq("user_id", user.id);
      if (res.message) toast.info(res.message); else toast.success(`${res.jobs.length} offres scorées`);
    } catch (e) { toast.error((e as Error).message); }
    finally { setSearching(false); }
  };

  const handleSave = async (job: ScoredJob) => {
    setSavingId(job.url);
    try {
      await saveJob({ data: { title: job.title, company: job.company, location: job.location || null, url: job.url, description: job.description?.slice(0, 5000) || null, matchScore: job.score }});
      toast.success("Sauvegardé");
    } catch (e) { toast.error((e as Error).message); }
    finally { setSavingId(null); }
  };

  const handleGenerate = (job: ScoredJob, full?: FullOffer) => {
    sessionStorage.setItem("hireme:prefilled-job", JSON.stringify({
      jobTitle: full?.title || job.title, company: full?.company || job.company, jobUrl: job.url,
      jobDescription: full?.full_description || job.description?.slice(0, 8000) || job.summary,
    }));
    navigate({ to: "/generator" });
  };

  const BLOCKED_DOMAINS = ["linkedin.com", "indeed.com", "indeed.fr", "indeed.co.uk", "indeed.de", "glassdoor.com", "ziprecruiter.com"];
  const isBlockedDomain = (url: string) => {
    try { const h = new URL(url).hostname.replace(/^www\./, ""); return BLOCKED_DOMAINS.some(d => h.includes(d)); } catch { return false; }
  };
  const handleView = async (job: ScoredJob) => {
    // Sites known to block scraping → open directly to avoid wasted time.
    if (isBlockedDomain(job.url)) {
      navigator.clipboard?.writeText(job.url).catch(() => {});
      window.open(job.url, "_blank", "noopener,noreferrer");
      toast.info("Lien copié — ouverture sur le site source");
      return;
    }
    setViewing(job); setFullOffer(null); setViewLoading(true);
    try { setFullOffer(await scrape({ data: { url: job.url }}) as FullOffer); }
    catch (e) { toast.error((e as Error).message); setFullOffer(null); }
    finally { setViewLoading(false); }
  };

  if (loading || !user) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="size-6 animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="pt-24 pb-16 max-w-5xl mx-auto px-4 sm:px-6">
        <header className="mb-8">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[color:var(--hyper-cyan)] mb-3"><Search className="size-3.5" /> Recherche d'emploi multi-pays</div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tighter mb-2">Trouve les offres adaptées</h1>
          <p className="text-sm text-muted-foreground">Recherche intensive multi-sources : LinkedIn, Indeed, Welcome to the Jungle, Apec, Hellowork, job boards locaux et ATS publics selon le pays choisi.</p>
        </header>

        {hasCv === false && (
          <div className="glass-panel rounded-2xl p-4 mb-6 flex items-start gap-3 border-amber-500/30">
            <AlertCircle className="size-5 text-amber-500 mt-0.5 shrink-0" />
            <div className="flex-1 text-sm"><p className="font-bold mb-1">Aucun CV analysé</p><p className="text-muted-foreground"><button onClick={() => navigate({ to: "/cv" })} className="text-[color:var(--hyper-cyan)] underline">Analyse ton CV</button> pour un meilleur matching.</p></div>
          </div>
        )}

        {internal.length > 0 && (
          <section className="mb-8">
            <h2 className="font-bold text-sm mb-3 inline-flex items-center gap-2"><Star className="size-4 text-[color:var(--hyper-lime)]" /> Offres publiées sur HireMe ({internal.length})</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {internal.slice(0, 6).map(j => (
                <div key={j.id} className="glass-panel rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h3 className="font-bold text-sm truncate">{j.title}</h3>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[color:var(--hyper-lime)]/15 text-[color:var(--hyper-lime)] shrink-0">HireMe</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{j.company} · {j.location ?? "—"}</p>
                  {j.required_skills && j.required_skills.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {j.required_skills.slice(0, 5).map(s => <span key={s} className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border">{s}</span>)}
                    </div>
                  )}
                  <Button onClick={() => { setApplyTo(j); setCoverMsg(""); }} size="sm" className="w-full rounded-full font-bold"><Send className="size-3.5 mr-1.5" /> Postuler</Button>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="flex items-center gap-2 mb-8 text-xs font-bold">
          {[1,2,3].map(n => <div key={n} className="flex items-center gap-2 flex-1"><div className={`size-7 rounded-full flex items-center justify-center ${step>=n?"bg-[color:var(--hyper-cyan)] text-black":"bg-muted text-muted-foreground"}`}>{n}</div><div className={`flex-1 h-0.5 ${step>n?"bg-[color:var(--hyper-cyan)]":"bg-muted"}`} /></div>)}
          <div className={`size-7 rounded-full flex items-center justify-center ${step>=3?"bg-[color:var(--hyper-cyan)] text-black":"bg-muted text-muted-foreground"}`}><Sparkles className="size-3.5" /></div>
        </div>

        {step === 1 && (
          <div className="glass-panel rounded-2xl p-6 sm:p-8 space-y-5">
            <h2 className="font-display text-xl font-bold mb-2">Poste & lieu</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div><Label className="mb-2 block text-xs font-bold uppercase">Pays</Label>
                <Select value={countryCode} onValueChange={setCountryCode}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{COUNTRIES.map(c => <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="mb-2 block text-xs font-bold uppercase">Ville / Région *</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ex: Tunis, Paris, Casablanca" /></div>
              <div className="sm:col-span-2"><Label className="mb-2 block text-xs font-bold uppercase">Poste *</Label><Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Ex: Développeur Full-Stack" /></div>
              <div><Label className="mb-2 block text-xs font-bold uppercase">Mode</Label>
                <Select value={workType} onValueChange={(v) => setWorkType(v as typeof workType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="any">Tous</SelectItem><SelectItem value="remote">Remote</SelectItem><SelectItem value="hybrid">Hybride</SelectItem><SelectItem value="onsite">Sur site</SelectItem></SelectContent></Select>
              </div>
              <div><Label className="mb-2 block text-xs font-bold uppercase">Contrat</Label>
                <Select value={contract} onValueChange={(v) => setContract(v as typeof contract)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="any">Tous</SelectItem><SelectItem value="full_time">CDI</SelectItem><SelectItem value="contract">Freelance</SelectItem><SelectItem value="internship">Stage</SelectItem></SelectContent></Select>
              </div>
            </div>
            <div className="flex justify-end"><Button onClick={() => setStep(2)} disabled={!role.trim() || !location.trim()} className="rounded-full font-bold">Suivant <ArrowRight className="size-4 ml-1.5" /></Button></div>
          </div>
        )}

        {step === 2 && (
          <div className="glass-panel rounded-2xl p-6 sm:p-8 space-y-5">
            <h2 className="font-display text-xl font-bold mb-2">Affine</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div><Label className="mb-2 block text-xs font-bold uppercase">Niveau</Label>
                <Select value={seniority} onValueChange={(v) => setSeniority(v as typeof seniority)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="any">Tous</SelectItem><SelectItem value="junior">Junior</SelectItem><SelectItem value="mid">Confirmé</SelectItem><SelectItem value="senior">Senior</SelectItem><SelectItem value="lead">Lead</SelectItem></SelectContent></Select>
              </div>
              <div className="sm:col-span-2"><Label className="mb-2 block text-xs font-bold uppercase">Mots-clés / Stack</Label><Input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="TypeScript, AWS, fintech…" /></div>
            </div>
            <div className="flex justify-between pt-2">
              <Button onClick={() => setStep(1)} variant="ghost" className="rounded-full"><ArrowLeft className="size-4 mr-1.5" /> Retour</Button>
              <Button onClick={handleSearch} disabled={searching} className="rounded-full font-bold bg-[color:var(--hyper-cyan)] text-black hover:bg-[color:var(--hyper-cyan)]/90">
                {searching ? <><Loader2 className="size-4 mr-1.5 animate-spin" />Recherche...</> : <><Sparkles className="size-4 mr-1.5" />Lancer la recherche</>}
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold">{jobs.length} offres scorées</h2>
              <Button onClick={() => setStep(1)} variant="outline" size="sm" className="rounded-full"><Search className="size-3.5 mr-1.5" /> Nouvelle recherche</Button>
            </div>
            {jobs.length === 0 && !searching && (
              <div className="glass-panel rounded-2xl p-12 text-center"><Briefcase className="size-10 text-muted-foreground mx-auto mb-3" /><p className="text-sm text-muted-foreground mb-4">Aucune offre. Élargis tes critères.</p><Button onClick={() => setStep(1)} variant="outline" size="sm">Modifier</Button></div>
            )}
            {jobs.map((job) => (
              <article key={job.url} className="glass-panel rounded-2xl p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-base sm:text-lg leading-tight mb-1 truncate">{job.title}</h3>
                    <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-medium text-foreground">{job.company}</span>
                      {job.location && <><span>•</span><span className="inline-flex items-center gap-1"><MapPin className="size-3" />{job.location}</span></>}
                      <span>•</span><span className="text-xs">{job.source}</span>
                    </div>
                  </div>
                  <ScoreBadge score={job.score} />
                </div>
                <p className="text-sm text-muted-foreground mb-3">{job.summary}</p>
                <div className="mb-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Pourquoi ça matche</p>
                  <ul className="text-sm space-y-1">{job.match_reasons.map((r, i) => <li key={i} className="flex gap-2"><span className="text-[color:var(--hyper-lime)]">→</span><span>{r}</span></li>)}</ul>
                </div>
                {job.keywords.length > 0 && <div className="flex flex-wrap gap-1.5 mb-4">{job.keywords.map(k => <span key={k} className="text-xs px-2 py-0.5 rounded-full bg-foreground/5 border border-foreground/10">{k}</span>)}</div>}
                <div className="flex flex-wrap gap-2 pt-3 border-t border-border/60">
                  <Button onClick={() => handleGenerate(job)} size="sm" className="rounded-full font-bold bg-[color:var(--hyper-cyan)] text-black hover:bg-[color:var(--hyper-cyan)]/90"><Wand2 className="size-3.5 mr-1.5" /> Générer CV + LM</Button>
                  <Button onClick={() => handleView(job)} variant="outline" size="sm" className="rounded-full"><Eye className="size-3.5 mr-1.5" /> Voir l'offre</Button>
                  <Button onClick={() => handleSave(job)} disabled={savingId === job.url} variant="ghost" size="sm" className="rounded-full">
                    {savingId === job.url ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Bookmark className="size-3.5 mr-1.5" />}
                    Sauvegarder
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}

        <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{fullOffer?.title || viewing?.title}</DialogTitle></DialogHeader>
            {viewLoading && <div className="py-12 text-center"><Loader2 className="size-6 animate-spin mx-auto mb-2 text-hyper-cyan" /><p className="text-sm text-muted-foreground">Récupération de l'offre…</p></div>}
            {fullOffer && (
              <div className="space-y-4 text-sm">
                <div className="flex flex-wrap gap-2 text-xs">
                  {fullOffer.company && <span className="px-2 py-1 rounded bg-muted">🏢 {fullOffer.company}</span>}
                  {fullOffer.location && <span className="px-2 py-1 rounded bg-muted">📍 {fullOffer.location}</span>}
                  {fullOffer.contract_type && <span className="px-2 py-1 rounded bg-muted">📋 {fullOffer.contract_type}</span>}
                  {fullOffer.salary && <span className="px-2 py-1 rounded bg-muted">💰 {fullOffer.salary}</span>}
                  {fullOffer.recruiter_name && <span className="px-2 py-1 rounded bg-muted">👤 {fullOffer.recruiter_name}</span>}
                </div>
                {fullOffer.missions?.length > 0 && <div><h4 className="font-bold mb-1">Missions</h4><ul className="list-disc ml-5 space-y-0.5">{fullOffer.missions.map((m,i)=><li key={i}>{m}</li>)}</ul></div>}
                {fullOffer.profile?.length > 0 && <div><h4 className="font-bold mb-1">Profil recherché</h4><ul className="list-disc ml-5 space-y-0.5">{fullOffer.profile.map((m,i)=><li key={i}>{m}</li>)}</ul></div>}
                {fullOffer.skills?.length > 0 && <div className="flex flex-wrap gap-1">{fullOffer.skills.map(s=><span key={s} className="text-xs px-2 py-0.5 rounded border">{s}</span>)}</div>}
                {fullOffer.benefits?.length > 0 && <div><h4 className="font-bold mb-1">Avantages</h4><ul className="list-disc ml-5 space-y-0.5">{fullOffer.benefits.map((m,i)=><li key={i}>{m}</li>)}</ul></div>}
                <div className="grid sm:grid-cols-2 gap-2 pt-2 border-t border-border/60">
                  <Button onClick={() => { handleGenerate(viewing!, fullOffer); setViewing(null); }} className="rounded-xl font-bold bg-[color:var(--hyper-cyan)] text-black hover:bg-[color:var(--hyper-cyan)]/90"><Wand2 className="size-4 mr-2" /> Générer CV + LM</Button>
                  {fullOffer.apply_email ? (
                    <Button asChild variant="outline" className="rounded-xl font-bold">
                      <a href={`mailto:${fullOffer.apply_email}?subject=${encodeURIComponent("Candidature : " + (fullOffer.title || ""))}&body=${encodeURIComponent("Bonjour" + (fullOffer.recruiter_name ? " " + fullOffer.recruiter_name : "") + ",\n\nJe vous écris suite à votre annonce pour le poste de " + (fullOffer.title || "") + ".\n\nVous trouverez en pièce jointe mon CV et ma lettre de motivation.\n\nCordialement,")}`}>
                        <Mail className="size-4 mr-2" /> Postuler par email
                      </a>
                    </Button>
                  ) : fullOffer.apply_url ? (
                    <Button asChild variant="outline" className="rounded-xl font-bold">
                      <a href={fullOffer.apply_url} target="_blank" rel="noopener noreferrer"><Send className="size-4 mr-2" /> Postuler en ligne</a>
                    </Button>
                  ) : (
                    <Button asChild variant="outline" className="rounded-xl font-bold">
                      <a href={viewing!.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-4 mr-2" /> Ouvrir l'offre</a>
                    </Button>
                  )}
                </div>
                <a href={viewing!.url} target="_blank" rel="noopener noreferrer" onClick={() => navigator.clipboard?.writeText(viewing!.url).catch(()=>{})} className="block text-center text-xs text-muted-foreground hover:text-foreground underline">
                  Ouvrir la source originale ({viewing!.source}) — lien copié
                </a>
              </div>
            )}
            {!viewLoading && !fullOffer && viewing && (
              <div className="py-8 text-center space-y-3">
                <p className="text-sm text-muted-foreground">Ce site bloque l'extraction interne directe, surtout sur tn.linkedin.com et certains ATS privés.</p>
                <Button asChild className="rounded-xl font-bold">
                  <a href={viewing.url} target="_blank" rel="noopener noreferrer" onClick={() => navigator.clipboard?.writeText(viewing.url).catch(()=>{})}>
                    <ExternalLink className="size-4 mr-2" /> Ouvrir dans un nouvel onglet
                  </a>
                </Button>
                <p className="text-xs text-muted-foreground">Le lien a été copié dans le presse-papier pour éviter de perdre la page actuelle.</p>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={!!applyTo} onOpenChange={(o) => !o && setApplyTo(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Postuler : {applyTo?.title}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">{applyTo?.company} · {applyTo?.location ?? "—"}</p>
              <textarea value={coverMsg} onChange={e => setCoverMsg(e.target.value)} rows={6} placeholder="Présente-toi en quelques lignes : pourquoi cette offre, ce que tu apportes…" className="w-full rounded-xl border border-border bg-background p-3 text-sm" />
              <Button onClick={submitApply} disabled={applying || coverMsg.length < 10} className="w-full rounded-xl font-bold">
                {applying ? <><Loader2 className="size-4 mr-2 animate-spin" /> Envoi…</> : <><Send className="size-4 mr-2" /> Envoyer ma candidature</>}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const tone = score >= 75 ? "var(--hyper-lime)" : score >= 50 ? "var(--hyper-cyan)" : "oklch(0.65 0.15 30)";
  return <div className="shrink-0 size-14 rounded-full flex flex-col items-center justify-center font-display font-bold border-2" style={{ borderColor: tone, color: tone, backgroundColor: `color-mix(in oklab, ${tone} 12%, transparent)` }}><span className="text-lg leading-none tabular-nums">{score}</span><span className="text-[9px] uppercase opacity-70">match</span></div>;
}
