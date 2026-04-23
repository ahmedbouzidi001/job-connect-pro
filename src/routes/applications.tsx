import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Loader2, Briefcase, ExternalLink, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/applications")({
  component: ApplicationsPage,
});

type AppStatus = "saved" | "applied" | "interview" | "offer" | "rejected";
type Application = {
  id: string;
  job_title: string;
  company: string;
  job_url: string | null;
  status: AppStatus;
  match_score: number | null;
  created_at: string;
};

const COLUMNS: { key: AppStatus; label: string; tone: string }[] = [
  { key: "saved", label: "📌 Sauvegardé", tone: "var(--muted-foreground)" },
  { key: "applied", label: "📤 Postulé", tone: "var(--hyper-cyan)" },
  { key: "interview", label: "💬 Entretien", tone: "var(--warning)" },
  { key: "offer", label: "🎉 Offre", tone: "var(--hyper-lime)" },
  { key: "rejected", label: "❌ Refusé", tone: "var(--destructive)" },
];

function ApplicationsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [apps, setApps] = useState<Application[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from("applications").select("id, job_title, company, job_url, status, match_score, created_at")
      .eq("user_id", user.id).order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error("Erreur de chargement", { description: error.message });
        setApps((data ?? []) as Application[]);
        setFetching(false);
      });
  }, [user]);

  const updateStatus = async (id: string, status: AppStatus) => {
    const prev = apps;
    setApps((a) => a.map((x) => (x.id === id ? { ...x, status } : x)));
    const { error } = await supabase.from("applications").update({ status, applied_at: status === "applied" ? new Date().toISOString() : null }).eq("id", id);
    if (error) {
      setApps(prev);
      toast.error("Mise à jour échouée");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer cette candidature ?")) return;
    const prev = apps;
    setApps((a) => a.filter((x) => x.id !== id));
    const { error } = await supabase.from("applications").delete().eq("id", id);
    if (error) { setApps(prev); toast.error("Suppression échouée"); }
  };

  if (loading || !user || fetching) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="pt-24 pb-16 max-w-7xl mx-auto px-4 sm:px-6">
        <header className="mb-8 flex items-end justify-between flex-wrap gap-4">
          <div>
            <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tighter">Mes candidatures</h1>
            <p className="text-muted-foreground mt-2">{apps.length} candidature{apps.length > 1 ? "s" : ""} suivie{apps.length > 1 ? "s" : ""}.</p>
          </div>
          <Button asChild size="lg" className="rounded-xl font-bold"><Link to="/generator">+ Nouvelle candidature</Link></Button>
        </header>

        {apps.length === 0 ? (
          <div className="glass-panel rounded-3xl p-14 text-center">
            <Briefcase className="size-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">Aucune candidature pour le moment.</p>
            <Button asChild className="rounded-xl font-bold"><Link to="/generator">Générer ma première candidature</Link></Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
            {COLUMNS.map((col) => {
              const items = apps.filter((a) => a.status === col.key);
              return (
                <div key={col.key} className="glass-panel rounded-2xl p-3 min-h-[200px]">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <span className="text-xs font-bold tracking-wide" style={{ color: col.tone }}>{col.label}</span>
                    <span className="text-xs font-mono text-muted-foreground">{items.length}</span>
                  </div>
                  <div className="space-y-2">
                    {items.map((a) => (
                      <div key={a.id} className="bg-card rounded-xl border border-border p-3 group">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="font-bold text-sm leading-tight line-clamp-2">{a.job_title}</div>
                          {a.match_score != null && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0" style={{ backgroundColor: "color-mix(in oklab, var(--hyper-lime) 18%, transparent)", color: "var(--hyper-lime)" }}>{a.match_score}%</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mb-2">{a.company}</div>
                        <select value={a.status} onChange={(e) => updateStatus(a.id, e.target.value as AppStatus)} className="w-full text-xs h-7 rounded-md bg-background border border-border px-1 mb-1">
                          {COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                        </select>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {a.job_url && <a href={a.job_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground"><ExternalLink className="size-3.5" /></a>}
                          <button onClick={() => remove(a.id)} className="text-muted-foreground hover:text-destructive ms-auto"><Trash2 className="size-3.5" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}