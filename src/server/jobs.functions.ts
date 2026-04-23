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
  if (!key) throw new Error("FIRECRAWL_API_KEY non configuré. Connectez Firecrawl dans Connectors.");
  return key;
}

async function aiCall(payload: unknown) {
  const res = await fetch(LOVABLE_AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${getAIKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (res.status === 429) throw new Error("Limite IA atteinte. Réessayez dans 1 minute.");
  if (res.status === 402) throw new Error("Crédits IA épuisés.");
  if (!res.ok) throw new Error(`AI error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

/* ---------- Recherche d'emploi (Firecrawl Search + scoring IA) ---------- */

const SearchInput = z.object({
  role: z.string().min(2).max(120),
  location: z.string().min(2).max(120),
  workType: z.enum(["any", "remote", "hybrid", "onsite"]).default("any"),
  contract: z.enum(["any", "full_time", "part_time", "contract", "internship"]).default("any"),
  seniority: z.enum(["any", "junior", "mid", "senior", "lead"]).default("any"),
  salaryMin: z.number().int().min(0).max(1000000).optional().nullable(),
  salaryCurrency: z.enum(["TND", "EUR", "USD"]).default("EUR"),
  language: z.enum(["fr", "en", "ar"]).default("fr"),
  keywords: z.string().max(500).optional().nullable(),
  limit: z.number().int().min(3).max(15).default(10),
});

type RawJob = {
  title: string;
  company: string;
  location?: string;
  url: string;
  source: string;
  snippet: string;
};

function buildSearchQuery(p: z.infer<typeof SearchInput>): string {
  const parts: string[] = [`"${p.role}"`];
  if (p.location) parts.push(p.location);
  if (p.workType === "remote") parts.push("remote OR télétravail");
  if (p.workType === "hybrid") parts.push("hybrid OR hybride");
  if (p.contract === "internship") parts.push("stage OR internship");
  if (p.contract === "contract") parts.push("freelance OR contract");
  if (p.seniority !== "any") parts.push(p.seniority);
  if (p.keywords) parts.push(p.keywords);
  parts.push("(site:linkedin.com/jobs OR site:indeed.com OR site:welcometothejungle.com OR site:tanitjobs.com OR site:keejob.com OR site:emploitunisie.com)");
  return parts.join(" ");
}

async function firecrawlSearch(query: string, limit: number): Promise<RawJob[]> {
  const res = await fetch(`${FIRECRAWL_URL}/search`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getFirecrawlKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, limit, scrapeOptions: { formats: ["markdown"], onlyMainContent: true } }),
  });
  if (res.status === 402) throw new Error("Crédits Firecrawl épuisés. Rechargez votre compte Firecrawl.");
  if (!res.ok) throw new Error(`Firecrawl ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  // v2 returns { success, data: { web: [...] } } or { data: [...] }
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

    // Récupère le profil + dernier CV pour scorer
    const { data: profile } = await supabase
      .from("profiles")
      .select("cv_raw_text, target_role, skills, experience_years, headline")
      .eq("user_id", userId)
      .single();

    const candidateContext = profile?.cv_raw_text
      ? profile.cv_raw_text.slice(0, 8000)
      : `Poste cible: ${profile?.target_role ?? data.role}. Compétences: ${(profile?.skills ?? []).join(", ")}. Expérience: ${profile?.experience_years ?? 0} ans.`;

    // 1. Recherche Firecrawl
    const query = buildSearchQuery(data);
    const rawJobs = await firecrawlSearch(query, data.limit);
    if (rawJobs.length === 0) {
      return { query, jobs: [], message: "Aucune offre trouvée. Essayez avec des critères plus larges." };
    }

    // 2. Scoring IA en batch (1 seul appel pour économiser)
    const langName = data.language === "ar" ? "arabe" : data.language === "en" ? "anglais" : "français";
    const jobsForScoring = rawJobs.map((j, i) => ({
      idx: i,
      title: j.title,
      company: j.company,
      source: j.source,
      excerpt: j.snippet.slice(0, 1500),
    }));

    const ai = await aiCall({
      model: MODEL,
      messages: [
        { role: "system", content: `Tu es un expert recrutement qui score la compatibilité candidat/offre. Réponds en ${langName}. Sois honnête : un score < 50 est OK si l'offre ne correspond pas vraiment.` },
        { role: "user", content: `PROFIL CANDIDAT :\n"""\n${candidateContext}\n"""\n\nOFFRES À SCORER (${jobsForScoring.length}) :\n${jobsForScoring.map((j) => `[${j.idx}] ${j.title} @ ${j.company} (${j.source})\n${j.excerpt}\n---`).join("\n")}\n\nPour chaque offre, donne un score 0-100, un titre nettoyé, l'entreprise, la localisation devinée, un résumé 1 phrase, 2-3 raisons pour lesquelles ça matche (ou pas), 2-3 mots-clés clés.` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "return_scored_jobs",
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
      tool_choice: { type: "function", function: { name: "return_scored_jobs" } },
    });

    const toolCall = ai.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("Réponse IA invalide");
    const { scored } = JSON.parse(toolCall.function.arguments) as {
      scored: Array<{ idx: number; score: number; title: string; company: string; location: string; summary: string; match_reasons: string[]; keywords: string[] }>;
    };

    const enriched = scored
      .map((s) => {
        const raw = rawJobs[s.idx];
        if (!raw) return null;
        return {
          ...s,
          url: raw.url,
          source: raw.source,
          description: raw.snippet,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (b!.score - a!.score));

    return { query, jobs: enriched, message: null };
  });

/* ---------- Sauvegarder une offre comme candidature ---------- */

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
    const { data: saved, error } = await supabase
      .from("applications")
      .insert({
        user_id: userId,
        job_title: data.title,
        company: data.company,
        job_url: data.url,
        status: "saved",
        match_score: data.matchScore ?? null,
        notes: data.description?.slice(0, 2000) ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { id: saved.id };
  });

