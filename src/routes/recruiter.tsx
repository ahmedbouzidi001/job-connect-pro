import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Search, Sparkles, MessageSquare, MapPin, Briefcase, Star } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { searchCandidates, searchCandidatesNL, startConversation } from "@/lib/api/recruiter.functions";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/recruiter")({ component: RecruiterPage });

type Candidate = {
  user_id: string; full_name: string | null; headline: string | null; location: string | null;
  skills: string[] | null; languages: string[] | null; experience_years: number | null;
  employability_score: number | null; target_role: string | null; avatar_url: string | null;
  match_score?: number; match_reason?: string;
};

function RecruiterPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const search = useServerFn(searchCandidates);
  const searchNL = useServerFn(searchCandidatesNL);
  const startConv = useServerFn(startConversation);

  const [mode, setMode] = useState<"filters" | "ai">("ai");
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Candidate[]>([]);
  const [prompt, setPrompt] = useState("");
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [minYears, setMinYears] = useState("");
  const [skillsTxt, setSkillsTxt] = useState("");

  const [contact, setContact] = useState<Candidate | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [user, loading, navigate]);

  const runFilters = async () => {
    setRunning(true);
    try {
      const res = await search({ data: {
        query: query || null, location: location || null,
        minYears: minYears ? Number(minYears) : null,
        skills: skillsTxt ? skillsTxt.split(",").map(s => s.trim()).filter(Boolean) : null,
        limit: 30,
      }}) as { candidates: Candidate[] };
      setResults(res.candidates);
      toast.success(`${res.candidates.length} candidats trouvés`);
    } catch (e) { toast.error((e as Error).message); }
    finally { setRunning(false); }
  };

  const runAI = async () => {
    if (prompt.length < 5) { toast.error("Décris ton besoin"); return; }
    setRunning(true);
    try {
      const res = await searchNL({ data: { prompt, language: "fr" }}) as { candidates: Candidate[] };
      setResults(res.candidates);
      toast.success(`${res.candidates.length} profils classés par IA`);
    } catch (e) { toast.error((e as Error).message); }
    finally { setRunning(false); }
  };

  const send = async () => {
    if (!contact || !subject || !body) return;
    setSending(true);
    try {
      const res = await startConv({ data: { candidateId: contact.user_id, subject, firstMessage: body }}) as { conversationId: string };
      toast.success("Message envoyé");
      setContact(null); setSubject(""); setBody("");
      navigate({ to: "/messages" });
    } catch (e) { toast.error((e as Error).message); }
    finally { setSending(false); }
  };

  if (loading || !user) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="size-6 animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="pt-24 pb-16 max-w-6xl mx-auto px-4 sm:px-6">
        <header className="mb-8">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[color:var(--hyper-cyan)] mb-3"><Briefcase className="size-3.5" /> Espace Recruteur</div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tighter">Trouve les meilleurs profils</h1>
          <p className="text-sm text-muted-foreground mt-2">Recherche par filtres ou en langage naturel. Contacte directement via la messagerie interne.</p>
        </header>

        <div className="flex gap-2 mb-4">
          <button onClick={() => setMode("ai")} className={`px-4 py-2 rounded-full text-sm font-bold border ${mode==="ai" ? "border-hyper-cyan bg-hyper-cyan/10" : "border-border text-muted-foreground"}`}><Sparkles className="size-3.5 inline me-1.5" /> IA langage naturel</button>
          <button onClick={() => setMode("filters")} className={`px-4 py-2 rounded-full text-sm font-bold border ${mode==="filters" ? "border-hyper-cyan bg-hyper-cyan/10" : "border-border text-muted-foreground"}`}><Search className="size-3.5 inline me-1.5" /> Filtres</button>
        </div>

        {mode === "ai" ? (
          <div className="glass-panel rounded-2xl p-5 mb-6 space-y-3">
            <Textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={3}
              placeholder="ex: Trouve un Dev React Senior à Tunis qui parle anglais et connaît TypeScript + Next.js" />
            <Button onClick={runAI} disabled={running} size="lg" className="w-full rounded-xl font-bold h-12">
              {running ? <><Loader2 className="size-4 me-2 animate-spin" /> Recherche IA…</> : <><Sparkles className="size-4 me-2" /> Lancer la recherche IA</>}
            </Button>
          </div>
        ) : (
          <div className="glass-panel rounded-2xl p-5 mb-6 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Mot-clé (poste, nom…)" />
              <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Ville / pays" />
              <Input value={minYears} onChange={e => setMinYears(e.target.value)} type="number" placeholder="Années d'XP min" />
              <Input value={skillsTxt} onChange={e => setSkillsTxt(e.target.value)} placeholder="Skills (séparés par virgule)" />
            </div>
            <Button onClick={runFilters} disabled={running} size="lg" className="w-full rounded-xl font-bold h-12">
              {running ? <><Loader2 className="size-4 me-2 animate-spin" /> Recherche…</> : <><Search className="size-4 me-2" /> Chercher</>}
            </Button>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          {results.map((c) => (
            <article key={c.user_id} className="glass-panel rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-12 rounded-full bg-muted flex items-center justify-center text-sm font-bold shrink-0">
                    {c.full_name?.[0] ?? "?"}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold truncate">{c.full_name ?? "Profil"}</h3>
                    <p className="text-xs text-muted-foreground truncate">{c.headline ?? c.target_role ?? "—"}</p>
                  </div>
                </div>
                {typeof c.match_score === "number" && (
                  <span className="text-[11px] font-mono px-2 py-1 rounded shrink-0 bg-[color:var(--hyper-lime)]/15 text-[color:var(--hyper-lime)]"><Star className="size-3 inline me-1" />{c.match_score}</span>
                )}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mb-3">
                {c.location && <span><MapPin className="size-3 inline me-1" />{c.location}</span>}
                {typeof c.experience_years === "number" && <span>{c.experience_years} ans XP</span>}
                {typeof c.employability_score === "number" && <span>Score {c.employability_score}/100</span>}
              </div>
              {c.skills && c.skills.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {c.skills.slice(0, 8).map(s => <span key={s} className="text-[10px] font-mono px-2 py-0.5 rounded border border-border">{s}</span>)}
                </div>
              )}
              {c.match_reason && <p className="text-xs text-muted-foreground italic mb-3">"{c.match_reason}"</p>}
              <Button onClick={() => { setContact(c); setSubject(`Opportunité pour ${c.full_name ?? "vous"}`); }} size="sm" className="w-full rounded-full">
                <MessageSquare className="size-3.5 me-1.5" /> Contacter
              </Button>
            </article>
          ))}
        </div>

        {results.length === 0 && !running && (
          <div className="glass-panel rounded-2xl p-12 text-center">
            <Search className="size-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Lance une recherche pour voir les profils.</p>
            <p className="text-xs text-muted-foreground mt-2">Astuce : seuls les candidats ayant activé la visibilité recruteur apparaissent. <Link to="/cv" className="underline font-bold">Activer la mienne</Link></p>
          </div>
        )}

        <Dialog open={!!contact} onOpenChange={(o) => !o && setContact(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Contacter {contact?.full_name}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Objet" />
              <Textarea value={body} onChange={e => setBody(e.target.value)} rows={6} placeholder="Présente l'opportunité…" />
              <Button onClick={send} disabled={sending || !subject || !body} className="w-full rounded-xl font-bold">
                {sending ? <><Loader2 className="size-4 me-2 animate-spin" /> Envoi…</> : "Envoyer le message"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
