// Server-only: découverte d'offres pour la candidature automatique.
export type DiscoveredJob = {
  title: string; company: string; location?: string; url: string; source: string; snippet: string;
};

const FIRECRAWL_URL = "https://api.firecrawl.dev/v2";

const COUNTRY_TERMS: Record<string, string[]> = {
  TN: ["Tunisie", "Tunis"], FR: ["France"], MA: ["Maroc"], DZ: ["Algérie"],
  CA: ["Canada"], BE: ["Belgique"], CH: ["Suisse"], AE: ["Emirats", "Dubai"],
  SA: ["Arabie Saoudite", "Riyadh"], QA: ["Qatar", "Doha"], US: ["United States"],
  UK: ["United Kingdom", "London"], DE: ["Germany", "Berlin"], ANY: [],
};

function host(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "web"; }
}

async function firecrawl(query: string, countryCode: string, limit: number): Promise<DiscoveredJob[]> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch(`${FIRECRAWL_URL}/search`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query, limit,
        country: countryCode === "ANY" ? undefined : countryCode,
        tbs: "qdr:m",
        scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
      }),
    });
    if (!res.ok) return [];
    const json = await res.json() as any;
    const items: any[] = Array.isArray(json?.data?.web) ? json.data.web
      : Array.isArray(json?.data) ? json.data : [];
    return items.map((it) => {
      const url: string = it.url || it.link || "";
      const source = host(url);
      return {
        title: String(it.title || it.metadata?.title || "Offre").slice(0, 200),
        company: String(it.metadata?.ogSiteName || source.split(".")[0] || "—").slice(0, 120),
        location: it.metadata?.location,
        url, source,
        snippet: String(it.markdown || it.description || it.snippet || "").slice(0, 3000),
      };
    }).filter((j) => j.url);
  } catch { return []; }
}

async function remotive(role: string): Promise<DiscoveredJob[]> {
  try {
    const res = await fetch(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(role.slice(0, 80))}&limit=20`, { headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    const json = await res.json() as { jobs?: any[] };
    return (json.jobs ?? []).slice(0, 20).map((j: any) => ({
      title: String(j.title ?? "").slice(0, 200),
      company: String(j.company_name ?? "").slice(0, 120),
      location: j.candidate_required_location ?? "Remote",
      url: String(j.url ?? ""), source: "remotive.com",
      snippet: String(j.description ?? "").replace(/<[^>]+>/g, " ").slice(0, 3000),
    })).filter((j) => j.url && j.title);
  } catch { return []; }
}

/** Cherche des offres pour un rôle dans plusieurs pays, dédupliquées. */
export async function discoverJobs(role: string, countries: string[], perCountry = 12): Promise<DiscoveredJob[]> {
  const batches = await Promise.all(
    countries.slice(0, 10).flatMap((cc) => {
      const terms = COUNTRY_TERMS[cc] ?? [];
      const q = `"${role}" ${terms[0] ?? ""} offre emploi recrutement`.trim();
      return [firecrawl(q, cc, perCountry)];
    }).concat([remotive(role)]),
  );
  const seen = new Set<string>();
  const out: DiscoveredJob[] = [];
  for (const b of batches) {
    for (const j of b) {
      const key = `${j.title.toLowerCase().trim()}|${j.company.toLowerCase().trim()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(j);
    }
  }
  return out;
}

/* ================= Moteur partagé de candidature automatique ================= */

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export type AutoApplyRunResult = {
  applied: number;
  scanned: number;
  results: Array<{ title: string; company: string; ok: boolean; score?: number; message?: string }>;
};

/**
 * Exécute une session de candidature automatique pour un utilisateur donné.
 * Utilisé par le bouton « Lancer maintenant » et par la tâche quotidienne de 8h.
 * `supabase` peut être un client utilisateur (RLS) ou admin (cron).
 */
export async function runAutoApplyForUser(
  supabase: any,
  userId: string,
): Promise<AutoApplyRunResult> {
  const [{ data: settings }, { data: profile }] = await Promise.all([
    supabase.from("auto_apply_settings").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("profiles").select("cv_raw_text, target_role, full_name, skills, preferred_language").eq("user_id", userId).maybeSingle(),
  ]);
  if (!settings || !settings.is_active) throw new Error("Active d'abord la candidature automatique dans ton profil.");

  const role = (settings.role_override || profile?.target_role || "").trim();
  if (!role) throw new Error("Renseigne un poste ciblé dans ton profil.");
  const cv = (profile?.cv_raw_text || "").slice(0, 8000);
  if (cv.length < 100) throw new Error("Importe ou analyse ton CV avant la candidature automatique.");
  const language = profile?.preferred_language === "en" ? "en" : "fr";

  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Service IA indisponible.");

  const found = await discoverJobs(role, settings.countries ?? ["TN"], 12);
  if (found.length === 0) {
    await supabase.from("auto_apply_settings").update({ last_run_at: new Date().toISOString() }).eq("user_id", userId);
    return { applied: 0, scanned: 0, results: [] };
  }

  const { data: existing } = await supabase.from("applications").select("job_url, job_title, company").eq("user_id", userId).limit(500);
  const seen = new Set<string>(((existing ?? []) as Array<{ job_url: string | null; job_title: string | null; company: string | null }>)
    .flatMap((a) => [a.job_url ?? "", `${(a.job_title ?? "").toLowerCase()}|${(a.company ?? "").toLowerCase()}`]));
  const candidates = found.filter((j) => !seen.has(j.url) && !seen.has(`${j.title.toLowerCase()}|${j.company.toLowerCase()}`));

  const pool = candidates.slice(0, 40);
  const listing = pool.map((j, i) => `${i}. ${j.title} — ${j.company} (${j.location ?? ""})\n${j.snippet.slice(0, 600)}`).join("\n\n");
  let scores: number[] = [];
  try {
    const res = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: 'Tu notes la compatibilité entre un profil et des offres. Réponds UNIQUEMENT un JSON {"scores":[{"i":0,"score":75}]} (score 0-100).' },
          { role: "user", content: `Profil:\n${cv.slice(0, 4000)}\n\nOffres:\n${listing}` },
        ],
      }),
    });
    const j = await res.json();
    const raw: string = j?.choices?.[0]?.message?.content ?? "";
    const m = raw.match(/\{[\s\S]*\}/);
    const parsed = m ? JSON.parse(m[0]) as { scores?: Array<{ i: number; score: number }> } : {};
    scores = pool.map((_, i) => parsed.scores?.find((s) => s.i === i)?.score ?? 55);
  } catch {
    scores = pool.map(() => 55);
  }

  const targets = pool
    .map((j, i) => ({ ...j, matchScore: Math.max(0, Math.min(100, Math.round(scores[i] ?? 55))) }))
    .filter((j) => j.matchScore >= (settings.min_score ?? 25))
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, settings.max_per_run ?? 5);

  const results: AutoApplyRunResult["results"] = [];
  let applied = 0;

  for (const job of targets) {
    try {
      const sys = `Tu écris des candidatures spontanées très courtes (150 mots max) en ${language === "fr" ? "français" : "anglais"}, percutantes et personnalisées.`;
      const user = `Offre : ${job.title} chez ${job.company}\n${job.snippet.slice(0, 1500)}\n\nProfil :\n${cv.slice(0, 3000)}\n\nGénère uniquement la lettre.`;
      const aiRes = await fetch(LOVABLE_AI_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "google/gemini-2.5-flash-lite", messages: [{ role: "system", content: sys }, { role: "user", content: user }] }),
      });
      if (!aiRes.ok) throw new Error(`IA ${aiRes.status}`);
      const jj = await aiRes.json();
      const letter = jj?.choices?.[0]?.message?.content?.trim() || "";

      const { error } = await supabase.from("applications").insert([{
        user_id: userId,
        job_title: job.title,
        company: job.company,
        job_url: job.url,
        status: "applied" as const,
        match_score: job.matchScore,
        cover_letter: letter,
        applied_at: new Date().toISOString(),
        notes: `Candidature spontanée automatique (${job.matchScore}% match, ${job.source})`,
      }]);
      if (error) throw error;
      applied++;
      results.push({ title: job.title, company: job.company, ok: true, score: job.matchScore });
    } catch (e) {
      results.push({ title: job.title, company: job.company, ok: false, message: (e as Error).message });
    }
  }

  await supabase.from("auto_apply_settings").update({
    last_run_at: new Date().toISOString(),
    total_applied: (settings.total_applied ?? 0) + applied,
  }).eq("user_id", userId);

  return { applied, scanned: candidates.length, results };
}
