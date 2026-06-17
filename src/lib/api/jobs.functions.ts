import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-client-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";
import { enforceRateLimit, audit, logError } from "@/lib/api/rate-limit";

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";
const FAST_MODEL = "google/gemini-2.5-flash-lite";
const FIRECRAWL_URL = "https://api.firecrawl.dev/v2";

function getAIKey() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY non configuré");
  return key;
}
function getFirecrawlKey() {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error("FIRECRAWL_API_KEY non configuré.");
  return key;
}

async function aiCall(payload: unknown) {
  const res = await fetch(LOVABLE_AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${getAIKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (res.status === 429) throw new Error("Limite IA atteinte.");
  if (res.status === 402) throw new Error("Crédits IA épuisés.");
  if (!res.ok) throw new Error(`AI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

/* ---------- Sources locales par pays ---------- */
const COUNTRY_SOURCES: Record<string, string[]> = {
  TN: ["site:tanitjobs.com", "site:keejob.com", "site:optioncarriere.tn", "site:emploitunisie.com", "site:bayt.com", "site:tn.indeed.com", "site:linkedin.com/jobs"],
  FR: ["site:indeed.fr", "site:welcometothejungle.com", "site:apec.fr", "site:hellowork.com", "site:pole-emploi.fr", "site:chooseyourboss.com", "site:jobteaser.com", "site:linkedin.com/jobs"],
  MA: ["site:rekrute.com", "site:emploi.ma", "site:optioncarriere.ma", "site:bayt.com", "site:mjob.ma", "site:marocannonces.com", "site:linkedin.com/jobs"],
  DZ: ["site:emploitic.com", "site:emploipartner.com", "site:optioncarriere.dz", "site:bayt.com", "site:ouedkniss.com", "site:linkedin.com/jobs"],
  CA: ["site:indeed.ca", "site:jobboom.com", "site:jobillico.com", "site:workopolis.com", "site:monster.ca", "site:linkedin.com/jobs"],
  BE: ["site:stepstone.be", "site:references.be", "site:vdab.be", "site:leforem.be", "site:jobat.be", "site:linkedin.com/jobs"],
  CH: ["site:jobup.ch", "site:jobs.ch", "site:indeed.ch", "site:jobscout24.ch", "site:linkedin.com/jobs"],
  AE: ["site:bayt.com", "site:gulftalent.com", "site:naukrigulf.com", "site:founditgulf.com", "site:dubizzle.com", "site:linkedin.com/jobs"],
  SA: ["site:bayt.com", "site:gulftalent.com", "site:founditgulf.com", "site:naukrigulf.com", "site:linkedin.com/jobs"],
  QA: ["site:bayt.com", "site:qatarliving.com", "site:gulftalent.com", "site:naukrigulf.com", "site:linkedin.com/jobs"],
  US: ["site:indeed.com", "site:glassdoor.com", "site:dice.com", "site:ziprecruiter.com", "site:builtin.com", "site:wellfound.com", "site:lever.co", "site:boards.greenhouse.io", "site:linkedin.com/jobs"],
  UK: ["site:indeed.co.uk", "site:reed.co.uk", "site:totaljobs.com", "site:cwjobs.co.uk", "site:cv-library.co.uk", "site:linkedin.com/jobs"],
  DE: ["site:indeed.de", "site:stepstone.de", "site:xing.com/jobs", "site:stellenanzeigen.de", "site:meinestadt.de", "site:linkedin.com/jobs"],
  ANY: ["site:indeed.com", "site:welcometothejungle.com", "site:glassdoor.com", "site:jobs.smartrecruiters.com", "site:boards.greenhouse.io", "site:lever.co", "site:wellfound.com", "site:linkedin.com/jobs"],
};

const SearchInput = z.object({
  role: z.string().min(2).max(120),
  location: z.string().min(2).max(120),
  countryCode: z.string().length(2).default("TN"),
  workType: z.enum(["any", "remote", "hybrid", "onsite"]).default("any"),
  contract: z.enum(["any", "full_time", "part_time", "contract", "internship"]).default("any"),
  seniority: z.enum(["any", "junior", "mid", "senior", "lead"]).default("any"),
  salaryMin: z.number().int().min(0).max(1000000).optional().nullable(),
  salaryCurrency: z.enum(["TND", "EUR", "USD"]).default("EUR"),
  language: z.enum(["fr", "en", "ar"]).default("fr"),
  keywords: z.string().max(500).optional().nullable(),
  limit: z.number().int().min(3).max(100).default(50),
});

type RawJob = { title: string; company: string; location?: string; url: string; source: string; snippet: string };

function buildQueries(p: z.infer<typeof SearchInput>): string[] {
  const base: string[] = [`"${p.role}"`, p.location];
  if (p.workType === "remote") base.push("remote OR télétravail");
  if (p.workType === "hybrid") base.push("hybride");
  if (p.contract === "internship") base.push("stage OR internship OR alternance");
  if (p.contract === "contract") base.push("freelance OR contract");
  if (p.seniority !== "any") base.push(p.seniority);
  if (p.keywords) base.push(p.keywords);
  const sources = COUNTRY_SOURCES[p.countryCode] ?? COUNTRY_SOURCES.ANY;
  const intent = '(job OR emploi OR hiring OR recrutement)';
  const baseQuery = `${base.join(" ")} ${intent}`;
  return [
    ...sources.map((source) => `${baseQuery} ${source}`),
    `${base.join(" ")} ${p.role} ${intent}`,
  ];
}

function normalizeJobUrl(url: string) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "trk", "refId"].forEach((key) => parsed.searchParams.delete(key));
    return parsed.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function diversifyJobs(items: RawJob[], limit: number) {
  // Round-robin across distinct sources to mix providers; no hard cap on any single source.
  const buckets = new Map<string, RawJob[]>();
  for (const item of items) {
    const b = buckets.get(item.source) ?? [];
    b.push(item);
    buckets.set(item.source, b);
  }
  const keys = [...buckets.keys()];
  const mixed: RawJob[] = [];
  let progress = true;
  while (mixed.length < limit && progress) {
    progress = false;
    for (const k of keys) {
      const b = buckets.get(k);
      if (b?.length) { mixed.push(b.shift()!); progress = true; if (mixed.length >= limit) break; }
    }
  }
  return mixed;
}

async function firecrawlSearch(query: string, limit: number, countryCode: string, language: "fr" | "en" | "ar"): Promise<RawJob[]> {
  const res = await fetch(`${FIRECRAWL_URL}/search`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getFirecrawlKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      limit,
      country: countryCode === "ANY" ? undefined : countryCode,
      lang: language,
      tbs: "qdr:y",
      scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
    }),
  });
  if (res.status === 402) throw new Error("Crédits Firecrawl épuisés.");
  if (!res.ok) throw new Error(`Firecrawl ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  const items: any[] = Array.isArray(json?.data?.web) ? json.data.web
    : Array.isArray(json?.data) ? json.data
    : Array.isArray(json?.web) ? json.web : [];
  return items.slice(0, limit).map((it) => {
    const url: string = it.url || it.link || "";
    let source = "web";
    try { source = new URL(url).hostname.replace(/^www\./, ""); } catch {}
    return {
      title: String(it.title || it.metadata?.title || "Offre").slice(0, 200),
      company: String(it.metadata?.ogSiteName || it.metadata?.author || source.split(".")[0] || "—").slice(0, 120),
      location: it.metadata?.location,
      url,
      source,
      snippet: String(it.markdown || it.description || it.snippet || it.metadata?.description || "").slice(0, 4000),
    };
  }).filter((j) => j.url);
}

/* ---------- Free job APIs (no key required) ---------- */
function matchesText(haystack: string, needles: string[]) {
  const h = haystack.toLowerCase();
  return needles.every(n => h.includes(n.toLowerCase()));
}

async function remotiveSearch(role: string, keywords: string | null): Promise<RawJob[]> {
  try {
    const q = encodeURIComponent([role, keywords].filter(Boolean).join(" ").slice(0, 80));
    const res = await fetch(`https://remotive.com/api/remote-jobs?search=${q}&limit=30`, { headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    const json = await res.json() as { jobs?: any[] };
    return (json.jobs ?? []).slice(0, 30).map((j: any) => ({
      title: String(j.title ?? "").slice(0, 200),
      company: String(j.company_name ?? "").slice(0, 120),
      location: j.candidate_required_location ?? "Remote",
      url: String(j.url ?? ""),
      source: "remotive.com",
      snippet: String(j.description ?? "").replace(/<[^>]+>/g, " ").slice(0, 3500),
    })).filter(j => j.url && j.title);
  } catch { return []; }
}

async function remoteokSearch(role: string): Promise<RawJob[]> {
  try {
    const res = await fetch(`https://remoteok.com/api`, { headers: { "User-Agent": "HireMe/1.0", Accept: "application/json" } });
    if (!res.ok) return [];
    const json = await res.json() as any[];
    const tokens = role.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    return (json ?? []).filter((j: any) => j && j.position && j.url).filter((j: any) => {
      const t = `${j.position} ${j.tags?.join(" ") ?? ""}`.toLowerCase();
      return tokens.some(tok => t.includes(tok));
    }).slice(0, 25).map((j: any) => ({
      title: String(j.position).slice(0, 200),
      company: String(j.company ?? "").slice(0, 120),
      location: j.location ?? "Remote",
      url: String(j.url),
      source: "remoteok.com",
      snippet: String(j.description ?? "").replace(/<[^>]+>/g, " ").slice(0, 3500),
    }));
  } catch { return []; }
}

async function arbeitnowSearch(role: string, location: string): Promise<RawJob[]> {
  try {
    const res = await fetch(`https://www.arbeitnow.com/api/job-board-api`, { headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    const json = await res.json() as { data?: any[] };
    const tokens = [role.toLowerCase()];
    if (location) tokens.push(location.toLowerCase());
    return (json.data ?? []).filter((j: any) => {
      const t = `${j.title ?? ""} ${j.location ?? ""} ${(j.tags ?? []).join(" ")}`.toLowerCase();
      return matchesText(t, [role.toLowerCase()]) || tokens.some(tok => t.includes(tok));
    }).slice(0, 25).map((j: any) => ({
      title: String(j.title ?? "").slice(0, 200),
      company: String(j.company_name ?? "").slice(0, 120),
      location: j.location ?? null,
      url: String(j.url ?? ""),
      source: "arbeitnow.com",
      snippet: String(j.description ?? "").replace(/<[^>]+>/g, " ").slice(0, 3500),
    })).filter((j: RawJob) => j.url);
  } catch { return []; }
}

async function museSearch(role: string, location: string): Promise<RawJob[]> {
  try {
    const params = new URLSearchParams({ page: "0" });
    if (location) params.append("location", location);
    const res = await fetch(`https://www.themuse.com/api/public/jobs?${params}`, { headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    const json = await res.json() as { results?: any[] };
    const tokens = role.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    return (json.results ?? []).filter((j: any) => {
      const t = `${j.name ?? ""} ${j.categories?.map((c: any) => c.name).join(" ") ?? ""}`.toLowerCase();
      return tokens.some(tok => t.includes(tok));
    }).slice(0, 20).map((j: any) => ({
      title: String(j.name ?? "").slice(0, 200),
      company: String(j.company?.name ?? "").slice(0, 120),
      location: j.locations?.map((l: any) => l.name).join(", ") ?? null,
      url: String(j.refs?.landing_page ?? ""),
      source: "themuse.com",
      snippet: String(j.contents ?? "").replace(/<[^>]+>/g, " ").slice(0, 3500),
    })).filter((j: RawJob) => j.url);
  } catch { return []; }
}

async function jobicySearch(role: string, location: string): Promise<RawJob[]> {
  try {
    const params = new URLSearchParams({ count: "50" });
    if (role) params.append("tag", role.slice(0, 40));
    if (location) params.append("geo", location.slice(0, 40));
    const res = await fetch(`https://jobicy.com/api/v2/remote-jobs?${params}`, { headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    const json = await res.json() as { jobs?: any[] };
    const tokens = role.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    return (json.jobs ?? []).filter((j: any) => {
      if (!j?.url || !j?.jobTitle) return false;
      const t = `${j.jobTitle} ${(j.jobIndustry ?? []).join(" ")} ${(j.jobType ?? []).join(" ")}`.toLowerCase();
      return tokens.length === 0 || tokens.some(tok => t.includes(tok));
    }).slice(0, 25).map((j: any) => ({
      title: String(j.jobTitle).slice(0, 200),
      company: String(j.companyName ?? "").slice(0, 120),
      location: j.jobGeo ?? "Remote",
      url: String(j.url),
      source: "jobicy.com",
      snippet: String(j.jobDescription ?? j.jobExcerpt ?? "").replace(/<[^>]+>/g, " ").slice(0, 3500),
    }));
  } catch { return []; }
}

async function fetchFreeApis(p: { role: string; location: string; keywords: string | null; workType: string }): Promise<RawJob[]> {
  const includeRemote = p.workType === "remote" || p.workType === "any";
  const tasks: Promise<RawJob[]>[] = [
    arbeitnowSearch(p.role, p.location),
    museSearch(p.role, p.location),
  ];
  if (includeRemote) {
    tasks.push(remotiveSearch(p.role, p.keywords));
    tasks.push(remoteokSearch(p.role));
    tasks.push(jobicySearch(p.role, p.location));
  }
  const out = await Promise.allSettled(tasks);
  return out.flatMap(r => r.status === "fulfilled" ? r.value : []);
}

export const searchJobs = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => SearchInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await enforceRateLimit(userId, "search_jobs", 10);

    const { data: profile } = await supabase
      .from("profiles")
      .select("cv_raw_text, target_role, skills, experience_years, headline")
      .eq("user_id", userId).single();

    const candidateContext = profile?.cv_raw_text
      ? profile.cv_raw_text.slice(0, 8000)
      : `Poste cible: ${profile?.target_role ?? data.role}. Compétences: ${(profile?.skills ?? []).join(", ")}.`;

    // Cache key: search criteria only (not user-specific)
    const cacheKey = JSON.stringify({
      r: data.role.toLowerCase().trim(), l: data.location.toLowerCase().trim(),
      c: data.countryCode, w: data.workType, ct: data.contract, s: data.seniority,
      k: (data.keywords ?? "").toLowerCase().trim(), lim: data.limit,
    });

    let rawJobs: RawJob[] = [];
    let fromCache = false;
    const { data: cached } = await supabaseAdmin
      .from("job_search_cache")
      .select("raw_jobs, expires_at")
      .eq("cache_key", cacheKey)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (cached?.raw_jobs && Array.isArray(cached.raw_jobs) && (cached.raw_jobs as unknown[]).length > 0) {
      rawJobs = cached.raw_jobs as unknown as RawJob[];
      fromCache = true;
    }

    const queries = buildQueries(data);
    const query = queries.join(" | ");

    if (!fromCache) {
      const perQuery = Math.min(25, Math.max(15, Math.ceil(data.limit / 4)));
      const [fcResults, apiJobs] = await Promise.all([
        Promise.allSettled(queries.map(q => firecrawlSearch(q, perQuery, data.countryCode, data.language))),
        fetchFreeApis({ role: data.role, location: data.location, keywords: data.keywords ?? null, workType: data.workType }),
      ]);
      const seen = new Set<string>();
      const rawJobsPool: RawJob[] = [];
      // Free APIs first (high quality, structured data)
      for (const j of apiJobs) {
        const key = normalizeJobUrl(j.url);
        if (seen.has(key)) continue;
        seen.add(key);
        rawJobsPool.push(j);
      }
      for (const r of fcResults) {
        if (r.status !== "fulfilled") continue;
        for (const j of r.value) {
          const key = normalizeJobUrl(j.url);
          if (seen.has(key)) continue;
          seen.add(key);
          rawJobsPool.push(j);
        }
      }
      rawJobs = diversifyJobs(rawJobsPool, data.limit);
      // Store in cache (fire and forget)
      if (rawJobs.length > 0) {
        supabaseAdmin.from("job_search_cache").upsert([{
          cache_key: cacheKey,
          raw_jobs: rawJobs as never,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        }], { onConflict: "cache_key" }).then(() => {});
      }
    }

    if (rawJobs.length === 0) {
      await audit({ userId, action: "search_jobs", metadata: { role: data.role, location: data.location, country: data.countryCode, results: 0, cached: fromCache } });
      return { query, jobs: [], message: "Aucune offre trouvée. Essayez avec des critères plus larges ou un autre pays." };
    }

    const langName = data.language === "ar" ? "arabe" : data.language === "en" ? "anglais" : "français";
    const jobsForScoring = rawJobs.map((j, i) => ({ idx: i, title: j.title, company: j.company, source: j.source, excerpt: j.snippet.slice(0, 1500) }));

    // Fast model for batch scoring (much faster, cheaper). Falls back to MODEL if fails.
    let ai;
    try {
      ai = await aiCall({
      model: FAST_MODEL,
      messages: [
        { role: "system", content: `Expert recrutement bienveillant. Réponds en ${langName}. Score chaque offre 0-100 selon adéquation skills/séniorité/localisation/secteur. Sois généreux : 40-60 = match partiel intéressant à explorer, 60-80 = bon match, 80+ = excellent match. Ne descends sous 30 que si totalement hors sujet.` },
        { role: "user", content: `PROFIL:\n"""\n${candidateContext}\n"""\n\nOFFRES (${jobsForScoring.length}):\n${jobsForScoring.map((j) => `[${j.idx}] ${j.title} @ ${j.company} (${j.source})\n${j.excerpt}\n---`).join("\n")}\n\nPour chaque offre: score 0-100, titre nettoyé, entreprise, localisation, résumé court, 2-4 raisons précises (skills/séniorité/contexte), mots-clés.` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "return_scored",
          parameters: {
            type: "object",
            properties: {
              scored: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    idx: { type: "number" },
                    score: { type: "number", minimum: 0, maximum: 100 },
                    title: { type: "string" },
                    company: { type: "string" },
                    location: { type: "string" },
                    summary: { type: "string" },
                    match_reasons: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 4 },
                    keywords: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 6 },
                  },
                  required: ["idx", "score", "title", "company", "location", "summary", "match_reasons", "keywords"],
                  additionalProperties: false,
                },
              },
            },
            required: ["scored"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "return_scored" } },
      });
    } catch (e) {
      await logError({ userId, source: "search_jobs.ai", message: (e as Error).message });
      throw e;
    }

    const toolCall = ai.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("Réponse IA invalide");
    const { scored } = JSON.parse(toolCall.function.arguments);

    const enriched = scored.map((s: any) => {
      const raw = rawJobs[s.idx];
      if (!raw) return null;
      return { ...s, url: raw.url, source: raw.source, description: raw.snippet };
    }).filter(Boolean).sort((a: any, b: any) => b.score - a.score);

    await audit({ userId, action: "search_jobs", metadata: { role: data.role, location: data.location, country: data.countryCode, results: enriched.length, cached: fromCache } });

    return { query, jobs: enriched, message: fromCache ? "Résultats instantanés (cache 24h)" : null, cached: fromCache };
  });

/* ---------- Sauvegarder offre ---------- */
const SaveJobInput = z.object({
  title: z.string().min(1).max(200),
  company: z.string().min(1).max(200),
  location: z.string().max(200).optional().nullable(),
  url: z.string().url(),
  description: z.string().max(20000).optional().nullable(),
  matchScore: z.number().int().min(0).max(100).optional().nullable(),
});

export const saveJobAsApplication = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveJobInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: saved, error } = await supabase.from("applications").insert({
      user_id: userId,
      job_title: data.title, company: data.company, job_url: data.url,
      status: "saved", match_score: data.matchScore ?? null,
      notes: data.description?.slice(0, 2000) ?? null,
    }).select().single();
    if (error) throw new Error(error.message);
    return { id: saved.id };
  });

/* ---------- Scrape contenu d'une offre (pour modale interne) ---------- */
const ScrapeFullInput = z.object({ url: z.string().url() });

export const scrapeJobContent = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => ScrapeFullInput.parse(input))
  .handler(async ({ data }) => {
    const res = await fetch(`${FIRECRAWL_URL}/scrape`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getFirecrawlKey()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: data.url, formats: ["markdown"], onlyMainContent: true, waitFor: 1500 }),
    });
    if (res.status === 402) throw new Error("Crédits Firecrawl épuisés.");
    if (!res.ok) throw new Error(`Site bloqué ou inaccessible (${res.status}). Essayez un autre lien ou copiez la description manuellement.`);
    const json = await res.json();
    const md = String(json?.data?.markdown || json?.markdown || "");
    if (md.length < 200) throw new Error("Contenu trop court ou bloqué.");

    const meta = json?.data?.metadata || json?.metadata || {};
    const ai = await aiCall({
      model: MODEL,
      messages: [
        { role: "system", content: "Tu extrais une offre d'emploi proprement depuis du markdown brut. Reformule de façon claire et structurée." },
        { role: "user", content: `Source: ${data.url}\nTitre page: ${meta.title || ""}\n\n"""\n${md.slice(0, 12000)}\n"""` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "return_offer",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string" },
              company: { type: "string" },
              location: { type: "string" },
              contract_type: { type: "string" },
              salary: { type: "string" },
              missions: { type: "array", items: { type: "string" } },
              profile: { type: "array", items: { type: "string" } },
              skills: { type: "array", items: { type: "string" } },
              benefits: { type: "array", items: { type: "string" } },
              full_description: { type: "string", description: "Texte complet propre, sans navigation/cookies" },
              apply_email: { type: "string", description: "Email de candidature si présent dans l'offre, sinon vide" },
              apply_url: { type: "string", description: "URL de formulaire de candidature si présent, sinon vide" },
              recruiter_name: { type: "string", description: "Nom du recruteur/contact si mentionné, sinon vide" },
            },
            required: ["title", "company", "location", "contract_type", "salary", "missions", "profile", "skills", "benefits", "full_description", "apply_email", "apply_url", "recruiter_name"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "return_offer" } },
    });
    const toolCall = ai.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("Extraction IA échouée");
    const parsed = JSON.parse(toolCall.function.arguments);
    // Fallback regex si l'IA n'a rien trouvé
    if (!parsed.apply_email) {
      const m = md.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
      if (m) parsed.apply_email = m[0];
    }
    return parsed;
  });
