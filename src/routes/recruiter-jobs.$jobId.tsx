import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Sparkles, Star, MessageSquare, MapPin, User as UserIcon, Wand2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { listJobApplications, updateApplication, scoreApplicationsAI, suggestCandidatesForJob } from "@/lib/api/recruiter-jobs.functions";
import { startConversation } from "@/lib/api/recruiter.functions";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/recruiter-jobs/$jobId")({ component: JobDetailPage });

type AppStatus = "new" | "contacted" | "interview" | "offer" | "rejected" | "withdrawn";
type Candidate = { full_name: string | null; avatar_url: string | null; headline: string | null; location: string | null; experience_years: number | null; skills: string[] | null } | null;
type Application = { id: string; status: AppStatus; match_score: number | null; match_reason: string | null; cover_message: string | null; recruiter_notes: string | null; created_at: string; candidate_id: string; candidate: Candidate };
type Suggestion = { user_id: string; full_name: string | null; headline: string | null; location: string | null; skills: string[] | null; experience_years: number | null; match_score?: number; match_reason?: string };

const COLS: { key: AppStatus; label: string; tone: string }[] = [
  { key: "new", label: "Nouveau", tone: "var(--hyper-cyan)" },
  { key: "contacted", label: "Contacté", tone: "var(--hyper-lime)" },
  { key: "interview", label: "Entretien", tone: "oklch(0.78 0.16 75)" },
  { key: "offer", label: "Offre", tone: "oklch(0.78 0.18 145)" },
  { key: "rejected", label: "Refusé", tone: "oklch(0.65 0.15 30)" },
];

function JobDetailPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { jobId } = Route.useParams();
  const list = useServerFn(listJobApplications);
  const updateApp = useServerFn(updateApplication);
  const scoreAll = useServerFn(scoreApplicationsAI);
  const suggest = useServerFn(suggestCandidatesForJob);
  const startConv = useServerFn(startConversation);

  const [job, setJob] = useState<{ title: string; description: string | null } | null>(null);
  const [apps, setApps] = useState<Application[]>([]);
  const [scoring, setScoring] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [user, loading, navigate]);

  const reload = async () => {
    try {
      const r = await list({ data: { jobId } }) as { job: { title: string; description: string | null }; applications: Application[] };
      setJob(r.job); setApps(r.applications);
    } catch (e) { toast.error((e as Error).message); }
  };
  useEffect(() => { if (user) reload(); /* eslint-disable-next-line */ }, [user, jobId]);

  const move = async (id: string, status: AppStatus) => {
    setApps(apps.map(a => a.id === id ? { ...a, status } : a));
    try { await updateApp({ data: { applicationId: id, status }}); }
    catch (e) { toast.error((e as Error).message); reload(); }
  };

  const runScoring = async () => {
    setScoring(true);
    try { const r = await scoreAll({ data: { jobId }}) as { scored: number }; toast.success(`${r.scored} candidatures scorées`); reload(); }
    catch (e) { toast.error((e as Error).message); }
    finally { setScoring(false); }
  };

  const runSuggest = async () => {
    setSuggesting(true);
    try { const r = await suggest({ data: { jobId }}) as { candidates: Suggestion[] }; setSuggestions(r.candidates); }
    catch (e) { toast.error((e as Error).message); }
    finally { setSuggesting(false); }
  };

  const contact = async (s: Suggestion) => {
    try {
      await startConv({ data: { candidateId: s.user_id, subject: `Opportunité: ${job?.title ?? ""}`, firstMessage: `Bonjour ${s.full_name ?? ""}, ton profil correspond à une offre que j'ai publiée. Tu veux en discuter ?` }});
      toast.success("Message envoyé");
      navigate({ to: "/messages" });
    } catch (e) { toast.error((e as Error).message); }
  };

  if (loading || !user) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="size-6 animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="pt-24 pb-16 max-w-7xl mx-auto px-4 sm:px-6">
        <Link to="/recruiter-jobs" className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground mb-4"><ArrowLeft className="size-3.5" /> Mes offres</Link>

        <header className="mb-6 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tighter">{job?.title ?? "—"}</h1>
            <p className="text-sm text-muted-foreground mt-1">{apps.length} candidature{apps.length > 1 ? "s" : ""}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={runScoring} disabled={scoring || apps.length === 0} variant="outline" className="rounded-full">
              {scoring ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Sparkles className="size-4 mr-1.5" />}
              Scorer toutes les candidatures
            </Button>
            <Button onClick={runSuggest} disabled={suggesting} className="rounded-full font-bold bg-[color:var(--hyper-cyan)] text-black hover:bg-[color:var(--hyper-cyan)]/90">
              {suggesting ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Wand2 className="size-4 mr-1.5" />}
              Suggérer des candidats
            </Button>
          </div>
        </header>

        {suggestions.length > 0 && (
          <section className="glass-panel rounded-2xl p-5 mb-6">
            <h2 className="font-bold text-sm mb-3 inline-flex items-center gap-2"><Wand2 className="size-4 text-[color:var(--hyper-cyan)]" /> Profils suggérés à contacter</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {suggestions.map(s => (
                <div key={s.user_id} className="p-4 rounded-xl border border-border">
                  <div className="flex items-start justify-between mb-1.5">
                    <div className="font-bold text-sm truncate">{s.full_name ?? "Profil"}</div>
                    {typeof s.match_score === "number" && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[color:var(--hyper-lime)]/15 text-[color:var(--hyper-lime)]"><Star className="size-2.5 inline mr-0.5" />{s.match_score}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{s.headline ?? "—"}</p>
                  {s.match_reason && <p className="text-[11px] italic mt-1.5 text-muted-foreground">"{s.match_reason}"</p>}
                  <Button size="sm" className="w-full rounded-full mt-3" onClick={() => contact(s)}><MessageSquare className="size-3.5 mr-1.5" /> Contacter</Button>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {COLS.map(col => {
            const items = apps.filter(a => a.status === col.key);
            return (
              <div key={col.key} className="rounded-2xl bg-muted/30 p-3">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-bold uppercase tracking-wider" style={{ color: col.tone }}>{col.label}</div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-background">{items.length}</span>
                </div>
                <div className="space-y-2 min-h-[100px]">
                  {items.map(a => (
                    <div key={a.id} className="bg-background rounded-xl p-3 border border-border">
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="size-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold overflow-hidden">
                          {a.candidate?.avatar_url ? <img src={a.candidate.avatar_url} alt="" className="size-full object-cover" /> : <UserIcon className="size-3.5 text-muted-foreground" />}
                        </div>
                        <div className="font-bold text-xs truncate flex-1">{a.candidate?.full_name ?? "Candidat"}</div>
                        {typeof a.match_score === "number" && <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-[color:var(--hyper-lime)]/15 text-[color:var(--hyper-lime)]">{a.match_score}</span>}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate inline-flex items-center gap-1"><MapPin className="size-2.5" />{a.candidate?.location ?? "—"} · {a.candidate?.experience_years ?? 0} ans</p>
                      {a.match_reason && <p className="text-[10px] mt-1 italic line-clamp-2 text-muted-foreground">"{a.match_reason}"</p>}
                      {a.cover_message && <p className="text-[11px] mt-1.5 line-clamp-3">{a.cover_message}</p>}
                      <Select value={a.status} onValueChange={(v) => move(a.id, v as AppStatus)}>
                        <SelectTrigger className="h-7 mt-2 text-[11px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {COLS.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                  {items.length === 0 && <p className="text-[11px] text-muted-foreground text-center py-4">—</p>}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}