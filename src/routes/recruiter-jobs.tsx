import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Briefcase, Users, ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useServerFn } from "@tanstack/react-start";
import { createInternalJob, listMyJobs } from "@/lib/api/recruiter-jobs.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/recruiter-jobs")({ component: RecruiterJobsPage });

type MyJob = { id: string; title: string; company: string; location: string | null; work_type: string | null; employment_type: string | null; is_active: boolean | null; applicant_count: number; created_at: string };

function RecruiterJobsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const list = useServerFn(listMyJobs);
  const create = useServerFn(createInternalJob);

  const [jobs, setJobs] = useState<MyJob[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [loc, setLoc] = useState("");
  const [country, setCountry] = useState("TN");
  const [desc, setDesc] = useState("");
  const [skills, setSkills] = useState("");
  const [nice, setNice] = useState("");
  const [workType, setWorkType] = useState<"onsite" | "remote" | "hybrid">("hybrid");
  const [empType, setEmpType] = useState<"full_time" | "part_time" | "contract" | "internship">("full_time");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [currency, setCurrency] = useState("EUR");

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [user, loading, navigate]);

  const reload = async () => {
    try { const r = await list({ data: undefined as unknown as never }) as { jobs: MyJob[] }; setJobs(r.jobs); }
    catch (e) { toast.error((e as Error).message); }
  };
  useEffect(() => { if (user) reload(); /* eslint-disable-next-line */ }, [user]);

  const submit = async () => {
    if (!title || !company || !desc) { toast.error("Titre, entreprise et description requis"); return; }
    setSaving(true);
    try {
      await create({ data: {
        title, company, location: loc || null, country_code: country, description: desc,
        required_skills: skills.split(",").map(s => s.trim()).filter(Boolean),
        nice_to_have_skills: nice.split(",").map(s => s.trim()).filter(Boolean),
        work_type: workType, employment_type: empType,
        salary_min: salaryMin ? Number(salaryMin) : null,
        salary_max: salaryMax ? Number(salaryMax) : null,
        salary_currency: currency,
      }});
      toast.success("Offre publiée");
      setOpen(false);
      setTitle(""); setCompany(""); setLoc(""); setDesc(""); setSkills(""); setNice(""); setSalaryMin(""); setSalaryMax("");
      reload();
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  };

  if (loading || !user) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="size-6 animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="pt-24 pb-16 max-w-6xl mx-auto px-4 sm:px-6">
        <header className="mb-8 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[color:var(--hyper-cyan)] mb-3"><Briefcase className="size-3.5" /> Mes offres</div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tighter">Publie et gère tes offres</h1>
            <p className="text-sm text-muted-foreground mt-2">Publie une offre interne et reçois des candidatures directement scorées par l'IA.</p>
          </div>
          <Button onClick={() => setOpen(true)} className="rounded-full font-bold"><Plus className="size-4 mr-1.5" /> Nouvelle offre</Button>
        </header>

        {jobs.length === 0 ? (
          <div className="glass-panel rounded-2xl p-12 text-center">
            <Briefcase className="size-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">Tu n'as encore publié aucune offre.</p>
            <Button onClick={() => setOpen(true)} className="rounded-full"><Plus className="size-4 mr-1.5" /> Publier ma première offre</Button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {jobs.map(j => (
              <Link key={j.id} to="/recruiter-jobs/$jobId" params={{ jobId: j.id }} className="glass-panel rounded-2xl p-5 hover:border-foreground/30 transition-all group">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <h3 className="font-bold truncate">{j.title}</h3>
                    <p className="text-xs text-muted-foreground truncate">{j.company} · {j.location ?? "—"}</p>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[color:var(--hyper-cyan)]/15 text-[color:var(--hyper-cyan)] shrink-0 inline-flex items-center gap-1"><Users className="size-3" />{j.applicant_count}</span>
                </div>
                <div className="flex flex-wrap gap-1 mb-3 text-[10px] font-mono">
                  {j.work_type && <span className="px-2 py-0.5 rounded border border-border">{j.work_type}</span>}
                  {j.employment_type && <span className="px-2 py-0.5 rounded border border-border">{j.employment_type}</span>}
                  {j.is_active ? <span className="px-2 py-0.5 rounded bg-[color:var(--hyper-lime)]/15 text-[color:var(--hyper-lime)]">Active</span> : <span className="px-2 py-0.5 rounded bg-muted">Fermée</span>}
                </div>
                <span className="text-xs font-bold inline-flex items-center gap-1 text-[color:var(--hyper-cyan)] group-hover:gap-2 transition-all">Voir le pipeline <ArrowRight className="size-3" /></span>
              </Link>
            ))}
          </div>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nouvelle offre</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Titre du poste *" value={title} setValue={setTitle} />
                <Field label="Entreprise *" value={company} setValue={setCompany} />
                <Field label="Lieu" value={loc} setValue={setLoc} />
                <div>
                  <Label className="mb-1.5 block text-xs font-bold uppercase">Pays</Label>
                  <Select value={country} onValueChange={setCountry}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["TN","FR","MA","DZ","CA","BE","CH","UK","US","DE","ANY"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs font-bold uppercase">Mode</Label>
                  <Select value={workType} onValueChange={(v) => setWorkType(v as typeof workType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="onsite">Sur site</SelectItem><SelectItem value="hybrid">Hybride</SelectItem><SelectItem value="remote">Remote</SelectItem></SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs font-bold uppercase">Contrat</Label>
                  <Select value={empType} onValueChange={(v) => setEmpType(v as typeof empType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="full_time">CDI</SelectItem><SelectItem value="part_time">Temps partiel</SelectItem><SelectItem value="contract">Freelance</SelectItem><SelectItem value="internship">Stage</SelectItem></SelectContent>
                  </Select>
                </div>
                <Field label="Salaire min" value={salaryMin} setValue={setSalaryMin} type="number" />
                <Field label="Salaire max" value={salaryMax} setValue={setSalaryMax} type="number" />
                <Field label="Devise" value={currency} setValue={setCurrency} />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs font-bold uppercase">Description *</Label>
                <Textarea rows={6} value={desc} onChange={e => setDesc(e.target.value)} placeholder="Missions, profil recherché, contexte…" />
              </div>
              <Field label="Skills requis (séparés par virgule)" value={skills} setValue={setSkills} />
              <Field label="Nice-to-have" value={nice} setValue={setNice} />
              <Button onClick={submit} disabled={saving} className="w-full rounded-xl font-bold">
                {saving ? <><Loader2 className="size-4 mr-2 animate-spin" /> Publication…</> : "Publier l'offre"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

function Field({ label, value, setValue, type }: { label: string; value: string; setValue: (v: string) => void; type?: string }) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs font-bold uppercase">{label}</Label>
      <Input type={type} value={value} onChange={(e) => setValue(e.target.value)} />
    </div>
  );
}