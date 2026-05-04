import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-client-middleware";
import { z } from "zod";

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";
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
  TN: ["site:linkedin.com/jobs", "site:tanitjobs.com", "site:keejob.com", "site:emploitunisie.com", "site:bayt.com"],
  FR: ["site:linkedin.com/jobs", "site:indeed.fr", "site:welcometothejungle.com", "site:apec.fr", "site:hellowork.com", "site:pole-emploi.fr"],
  MA: ["site:linkedin.com/jobs", "site:rekrute.com", "site:emploi.ma", "site:bayt.com", "site:mjob.ma"],
  DZ: ["site:linkedin.com/jobs", "site:emploitic.com", "site:emploipartner.com", "site:bayt.com"],
  CA: ["site:linkedin.com/jobs", "site:indeed.ca", "site:jobboom.com", "site:jobillico.com"],
  BE: ["site:linkedin.com/jobs", "site:stepstone.be", "site:references.be", "site:vdab.be"],
  CH: ["site:linkedin.com/jobs", "site:jobup.ch", "site:jobs.ch", "site:indeed.ch"],
  AE: ["site:linkedin.com/jobs", "site:bayt.com", "site:gulftalent.com", "site:naukrigulf.com"],
  SA: ["site:linkedin.com/jobs", "site:bayt.com", "site:gulftalent.com"],
  QA: ["site:linkedin.com/jobs", "site:bayt.com", "site:qatarliving.com"],
  US: ["site:linkedin.com/jobs", "site:indeed.com", "site:glassdoor.com", "site:dice.com"],
  UK: ["site:linkedin.com/jobs", "site:indeed.co.uk", "site:reed.co.uk", "site:totaljobs.com"],
  DE: ["site:linkedin.com/jobs", "site:indeed.de", "site:stepstone.de", "site:xing.com"],
  ANY: ["site:linkedin.com/jobs", "site:indeed.com", "site:welcometothejungle.com", "site:glassdoor.com"],
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
  // 1 requête par groupe de sources (max 4 sources/requête) pour multiplier la couverture
  const groups: string[][] = [];
  for (let i = 0; i < sources.length; i += 3) groups.push(sources.slice(i, i + 3));
  return groups.map(g => `${base.join(" ")} (${g.join(" OR ")})`);
}

async function firecrawlSearch(query: string, limit: number): Promise<RawJob[]> {
  const res = await fetch(`${FIRECRAWL_URL}/search`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getFirecrawlKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, limit, scrapeOptions: { formats: ["markdown"], onlyMainContent: true } }),
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

export const searchJobs = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => SearchInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("cv_raw_text, target_role, skills, experience_years, headline")
      .eq("user_id", userId).single();

    const candidateContext = profile?.cv_raw_text
      ? profile.cv_raw_text.slice(0, 8000)
      : `Poste cible: ${profile?.target_role ?? data.role}. Compétences: ${(profile?.skills ?? []).join(", ")}.`;

    const queries = buildQueries(data);
    // Limite par requête : on demande un peu plus pour compenser les doublons
    const perQuery = Math.min(30, Math.ceil(data.limit / Math.max(1, queries.length)) + 5);
    const results = await Promise.allSettled(queries.map(q => firecrawlSearch(q, perQuery)));
    const seen = new Set<string>();
    const rawJobs: RawJob[] = [];
    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      for (const j of r.value) {
        const key = j.url.split("?")[0].toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        rawJobs.push(j);
        if (rawJobs.length >= data.limit) break;
      }
      if (rawJobs.length >= data.limit) break;
    }
    const query = queries.join(" | ");
    if (rawJobs.length === 0) {
      return { query, jobs: [], message: "Aucune offre trouvée. Essayez avec des critères plus larges ou un autre pays." };
    }

    const langName = data.language === "ar" ? "arabe" : data.language === "en" ? "anglais" : "français";
    const jobsForScoring = rawJobs.map((j, i) => ({ idx: i, title: j.title, company: j.company, source: j.source, excerpt: j.snippet.slice(0, 1500) }));

    const ai = await aiCall({
      model: MODEL,
      messages: [
        { role: "system", content: `Expert recrutement. Réponds en ${langName}. Sois honnête : score < 50 si l'offre ne matche pas vraiment.` },
        { role: "user", content: `PROFIL:\n"""\n${candidateContext}\n"""\n\nOFFRES (${jobsForScoring.length}):\n${jobsForScoring.map((j) => `[${j.idx}] ${j.title} @ ${j.company} (${j.source})\n${j.excerpt}\n---`).join("\n")}\n\nScore chaque offre 0-100, titre nettoyé, entreprise, localisation, résumé, raisons de match, mots-clés.` },
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

    const toolCall = ai.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("Réponse IA invalide");
    const { scored } = JSON.parse(toolCall.function.arguments);

    const enriched = scored.map((s: any) => {
      const raw = rawJobs[s.idx];
      if (!raw) return null;
      return { ...s, url: raw.url, source: raw.source, description: raw.snippet };
    }).filter(Boolean).sort((a: any, b: any) => b.score - a.score);

    return { query, jobs: enriched, message: null };
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
