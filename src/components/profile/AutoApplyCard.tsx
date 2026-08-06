import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getAutoApplySettings, saveAutoApplySettings, runAutoApplyNow } from "@/lib/api/auto-apply.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Clock, Loader2, Rocket, Save, Zap } from "lucide-react";
import { toast } from "sonner";

const COUNTRIES: Array<{ code: string; label: string }> = [
  { code: "TN", label: "Tunisie" }, { code: "FR", label: "France" }, { code: "MA", label: "Maroc" },
  { code: "DZ", label: "Algérie" }, { code: "CA", label: "Canada" }, { code: "BE", label: "Belgique" },
  { code: "CH", label: "Suisse" }, { code: "AE", label: "Émirats" }, { code: "SA", label: "Arabie S." },
  { code: "QA", label: "Qatar" }, { code: "US", label: "USA" }, { code: "UK", label: "UK" },
  { code: "DE", label: "Allemagne" }, { code: "ANY", label: "Monde" },
];

export function AutoApplyCard() {
  const fetchSettings = useServerFn(getAutoApplySettings);
  const saveSettings = useServerFn(saveAutoApplySettings);
  const runNow = useServerFn(runAutoApplyNow);

  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [active, setActive] = useState(false);
  const [countries, setCountries] = useState<string[]>(["TN"]);
  const [maxPerRun, setMaxPerRun] = useState(5);
  const [minScore, setMinScore] = useState(25);
  const [roleOverride, setRoleOverride] = useState("");
  const [daily, setDaily] = useState(false);
  const [stats, setStats] = useState<{ total: number; last: string | null }>({ total: 0, last: null });

  useEffect(() => {
    fetchSettings({ data: undefined as unknown as never }).then((res) => {
      const s = (res as { settings: Record<string, unknown> | null }).settings;
      if (s) {
        setActive(Boolean(s.is_active));
        setCountries(((s.countries as string[]) ?? ["TN"]));
        setMaxPerRun((s.max_per_run as number) ?? 5);
        setMinScore((s.min_score as number) ?? 25);
        setRoleOverride((s.role_override as string) ?? "");
        setDaily(Boolean(s.daily_enabled));
        setStats({ total: (s.total_applied as number) ?? 0, last: (s.last_run_at as string) ?? null });
      }
      setLoaded(true);
    }).catch(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleCountry = (code: string) => {
    setCountries((prev) => prev.includes(code)
      ? (prev.length > 1 ? prev.filter((c) => c !== code) : prev)
      : (prev.length >= 10 ? (toast.info("10 pays maximum"), prev) : [...prev, code]));
  };

  const persist = async (nextActive = active, nextDaily = daily) => {
    setSaving(true);
    try {
      await saveSettings({ data: { is_active: nextActive, countries, max_per_run: maxPerRun, min_score: minScore, role_override: roleOverride || null, daily_enabled: nextDaily } });
      toast.success(nextActive ? "Candidature automatique activée" : "Réglages enregistrés");
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setSaving(false); }
  };

  const launch = async () => {
    setRunning(true);
    try {
      const res = await runNow({ data: undefined as unknown as never }) as { applied: number; scanned: number };
      if (res.applied === 0) toast.info(`Aucune offre retenue (${res.scanned} analysées). Élargis les pays ou baisse le score minimum.`);
      else toast.success(`${res.applied} candidature(s) spontanée(s) envoyée(s) sur ${res.scanned} offres analysées.`);
      setStats((s) => ({ total: s.total + res.applied, last: new Date().toISOString() }));
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setRunning(false); }
  };

  return (
    <section className="glass-panel rounded-2xl p-6 border border-[color:var(--hyper-lime)]/30">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="flex items-start gap-3">
          <div className="size-9 rounded-xl bg-[color:var(--hyper-lime)]/15 flex items-center justify-center shrink-0">
            <Rocket className="size-4 text-[color:var(--hyper-lime)]" />
          </div>
          <div>
            <h2 className="font-bold">Candidature automatique</h2>
            <p className="text-sm text-muted-foreground">
              Active, choisis tes pays et le nombre de candidatures — on cherche les offres, on note le match et on envoie des candidatures spontanées avec lettre personnalisée.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Switch checked={active} disabled={!loaded || saving} onCheckedChange={(v) => { setActive(v); void persist(v); }} />
        </div>
      </div>

      <div className={active ? "" : "opacity-50 pointer-events-none"}>
        <Label className="mb-2 block text-xs font-bold uppercase">Pays ciblés (max 10)</Label>
        <div className="flex flex-wrap gap-2 mb-5">
          {COUNTRIES.map((c) => (
            <button key={c.code} type="button" onClick={() => toggleCountry(c.code)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-colors ${countries.includes(c.code)
                ? "border-[color:var(--hyper-lime)] bg-[color:var(--hyper-lime)]/10"
                : "border-border text-muted-foreground hover:border-foreground/30"}`}>
              {c.label}
            </button>
          ))}
        </div>

        <div className="flex items-start justify-between gap-4 mb-5 rounded-xl border-2 border-[color:var(--hyper-lime)]/25 p-4">
          <div className="flex items-start gap-3">
            <Clock className="size-4 mt-0.5 text-[color:var(--hyper-lime)] shrink-0" />
            <div>
              <p className="font-bold text-sm">Chaque jour à 8h du matin</p>
              <p className="text-xs text-muted-foreground">
                On lance automatiquement la recherche et on postule au maximum d'offres possibles (jusqu'à ta limite par lancement), sans que tu fasses quoi que ce soit.
              </p>
            </div>
          </div>
          <Switch checked={daily} disabled={!loaded || saving} onCheckedChange={(v) => { setDaily(v); void persist(active, v); }} />
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <Label className="mb-1.5 block text-xs font-bold uppercase">Candidatures / lancement</Label>
            <Input type="number" min={1} max={20} value={maxPerRun} onChange={(e) => setMaxPerRun(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-bold uppercase">Score minimum (%)</Label>
            <Input type="number" min={25} max={95} value={minScore} onChange={(e) => setMinScore(Math.max(25, Math.min(95, Number(e.target.value) || 25)))} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-bold uppercase">Poste ciblé (optionnel)</Label>
            <Input value={roleOverride} onChange={(e) => setRoleOverride(e.target.value)} placeholder="sinon: poste recherché du profil" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-5">
          <Button variant="outline" className="rounded-full font-bold" disabled={saving} onClick={() => persist()}>
            {saving ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Save className="size-3.5 mr-1.5" />} Enregistrer les réglages
          </Button>
          <Button className="rounded-full font-bold" disabled={running || saving} onClick={launch}>
            {running ? <><Loader2 className="size-4 mr-2 animate-spin" /> Candidatures en cours…</> : <><Zap className="size-4 mr-2" /> Lancer maintenant</>}
          </Button>
          <p className="text-xs text-muted-foreground">
            {stats.total} candidature(s) auto envoyée(s){stats.last ? ` · dernier lancement ${new Date(stats.last).toLocaleDateString("fr-FR")}` : ""}
          </p>
        </div>
      </div>
    </section>
  );
}
