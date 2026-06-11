import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-client-middleware";
import { z } from "zod";

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

function getAIKey() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY non configuré");
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
  if (!res.ok) throw new Error(`AI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

/* ---------- CRUD offres internes ---------- */
const PostJobInput = z.object({
  title: z.string().min(2).max(200),
  company: z.string().min(1).max(200),
  location: z.string().max(200).optional().nullable(),
  country_code: z.string().max(8).optional().nullable(),
  description: z.string().min(20).max(8000),
  required_skills: z.array(z.string().min(1).max(60)).max(30).default([]),
  nice_to_have_skills: z.array(z.string().min(1).max(60)).max(30).default([]),
  work_type: z.enum(["onsite", "remote", "hybrid"]).default("onsite"),
  employment_type: z.enum(["full_time", "part_time", "contract", "internship"]).default("full_time"),
  salary_min: z.number().min(0).max(10_000_000).optional().nullable(),
  salary_max: z.number().min(0).max(10_000_000).optional().nullable(),
  salary_currency: z.string().max(8).default("EUR"),
});

export const createInternalJob = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => PostJobInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase.from("jobs").insert({
      posted_by: userId,
      title: data.title,
      company: data.company,
      location: data.location,
      country_code: data.country_code,
      description: data.description,
      required_skills: data.required_skills,
      nice_to_have_skills: data.nice_to_have_skills,
      work_type: data.work_type,
      employment_type: data.employment_type,
      salary_min: data.salary_min ?? null,
      salary_max: data.salary_max ?? null,
      salary_currency: data.salary_currency,
      is_internal: true,
      is_active: true,
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { jobId: row.id };
  });

export const listMyJobs = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: jobs, error } = await supabase
      .from("jobs")
      .select("id, title, company, location, work_type, employment_type, is_active, created_at")
      .eq("posted_by", userId)
      .eq("is_internal", true)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = (jobs ?? []).map(j => j.id);
    let counts: Record<string, number> = {};
    if (ids.length) {
      const { data: apps } = await supabase
        .from("job_applications")
        .select("job_id")
        .in("job_id", ids);
      for (const a of apps ?? []) counts[a.job_id] = (counts[a.job_id] ?? 0) + 1;
    }
    return { jobs: (jobs ?? []).map(j => ({ ...j, applicant_count: counts[j.id] ?? 0 })) };
  });

const ListInternalInput = z.object({ countryCode: z.string().max(8).optional().nullable() });
export const listPublicInternalJobs = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => ListInternalInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("jobs")
      .select("id, title, company, location, country_code, work_type, employment_type, description, required_skills, salary_min, salary_max, salary_currency, created_at")
      .eq("is_internal", true)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(50);
    if (data.countryCode && data.countryCode !== "ANY") q = q.eq("country_code", data.countryCode);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { jobs: rows ?? [] };
  });

/* ---------- Postuler à une offre interne ---------- */
const ApplyInput = z.object({
  jobId: z.string().uuid(),
  coverMessage: z.string().min(10).max(3000),
});

export const applyToJob = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => ApplyInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: job, error: jErr } = await supabase
      .from("jobs")
      .select("posted_by, required_skills, title")
      .eq("id", data.jobId)
      .eq("is_internal", true)
      .single();
    if (jErr || !job) throw new Error("Offre introuvable");
    if (!job.posted_by) throw new Error("Offre invalide");

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, headline, skills, languages, experience_years, location, target_role, cv_structured")
      .eq("user_id", userId)
      .single();

    const { error } = await supabase.from("job_applications").insert({
      job_id: data.jobId,
      candidate_id: userId,
      recruiter_id: job.posted_by,
      cover_message: data.coverMessage,
      cv_snapshot: profile ?? {},
      status: "new",
    });
    if (error) {
      if (error.code === "23505") throw new Error("Tu as déjà postulé à cette offre.");
      throw new Error(error.message);
    }
    return { ok: true };
  });

export const myApplicationsToInternal = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("job_applications")
      .select("id, status, created_at, job:jobs(id, title, company, location)")
      .eq("candidate_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { applications: data ?? [] };
  });

/* ---------- Pipeline recruteur ---------- */
const ListAppsInput = z.object({ jobId: z.string().uuid() });
export const listJobApplications = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => ListAppsInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: job } = await supabase.from("jobs").select("posted_by, title, description, required_skills, nice_to_have_skills").eq("id", data.jobId).single();
    if (!job || job.posted_by !== userId) throw new Error("Non autorisé");
    const { data: apps, error } = await supabase
      .from("job_applications")
      .select("id, status, match_score, match_reason, cover_message, recruiter_notes, created_at, candidate_id, cv_snapshot")
      .eq("job_id", data.jobId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const cids = Array.from(new Set((apps ?? []).map(a => a.candidate_id)));
    let profiles: Record<string, { full_name: string | null; avatar_url: string | null; headline: string | null; location: string | null; experience_years: number | null; skills: string[] | null }> = {};
    if (cids.length) {
      const { data: ps } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url, headline, location, experience_years, skills")
        .in("user_id", cids);
      for (const p of ps ?? []) profiles[p.user_id] = p;
    }
    const enriched = (apps ?? []).map(a => ({ ...a, candidate: profiles[a.candidate_id] ?? null }));
    return { job, applications: enriched };
  });

const UpdateAppInput = z.object({
  applicationId: z.string().uuid(),
  status: z.enum(["new", "contacted", "interview", "offer", "rejected", "withdrawn"]).optional(),
  notes: z.string().max(4000).optional(),
});
export const updateApplication = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateAppInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const patch: { status?: "new" | "contacted" | "interview" | "offer" | "rejected" | "withdrawn"; recruiter_notes?: string } = {};
    if (data.status) patch.status = data.status;
    if (typeof data.notes === "string") patch.recruiter_notes = data.notes;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabase.from("job_applications").update(patch).eq("id", data.applicationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------- Matching IA inversé : suggérer candidats à contacter ---------- */
const ScoreAppsInput = z.object({ jobId: z.string().uuid() });
export const scoreApplicationsAI = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => ScoreAppsInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: job } = await supabase.from("jobs").select("posted_by, title, description, required_skills, nice_to_have_skills").eq("id", data.jobId).single();
    if (!job || job.posted_by !== userId) throw new Error("Non autorisé");
    const { data: apps } = await supabase
      .from("job_applications")
      .select("id, candidate_id, cover_message, cv_snapshot")
      .eq("job_id", data.jobId);
    if (!apps || apps.length === 0) return { scored: 0 };

    const compact = apps.map((a, i) => ({
      i,
      cover: (a.cover_message ?? "").slice(0, 800),
      cv: a.cv_snapshot,
    }));
    const res = await aiCall({
      model: MODEL,
      messages: [
        { role: "system", content: "Tu scores des candidatures vs une offre, en français. Sois strict et précis." },
        { role: "user", content: `Offre:\nTitre: ${job.title}\nDescription: ${(job.description ?? "").slice(0, 2000)}\nSkills requis: ${(job.required_skills ?? []).join(", ")}\nNice-to-have: ${(job.nice_to_have_skills ?? []).join(", ")}\n\nCandidatures:\n${JSON.stringify(compact)}` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "score_apps",
          parameters: {
            type: "object",
            properties: {
              results: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    i: { type: "number" },
                    score: { type: "number", minimum: 0, maximum: 100 },
                    reason: { type: "string" },
                  },
                  required: ["i", "score", "reason"],
                  additionalProperties: false,
                },
              },
            },
            required: ["results"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "score_apps" } },
    });
    const tc = res.choices?.[0]?.message?.tool_calls?.[0];
    const scored = tc ? (JSON.parse(tc.function.arguments).results as { i: number; score: number; reason: string }[]) : [];
    for (const s of scored) {
      const target = apps[s.i];
      if (!target) continue;
      await supabase.from("job_applications").update({ match_score: s.score, match_reason: s.reason }).eq("id", target.id);
    }
    return { scored: scored.length };
  });

/* ---------- Matching IA inversé : suggérer profils visibles à contacter ---------- */
const SuggestInput = z.object({ jobId: z.string().uuid() });
export const suggestCandidatesForJob = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => SuggestInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: job } = await supabase.from("jobs").select("posted_by, title, description, required_skills, nice_to_have_skills, location").eq("id", data.jobId).single();
    if (!job || job.posted_by !== userId) throw new Error("Non autorisé");
    let q = supabase
      .from("profiles")
      .select("user_id, full_name, headline, location, skills, languages, experience_years, employability_score, target_role, avatar_url")
      .eq("recruiter_visible", true)
      .limit(60);
    if (job.required_skills?.length) q = q.overlaps("skills", job.required_skills);
    const { data: pool, error } = await q;
    if (error) throw new Error(error.message);
    if (!pool || pool.length === 0) return { candidates: [] };

    const compact = pool.map((c, i) => ({
      i,
      name: c.full_name,
      headline: c.headline,
      location: c.location,
      years: c.experience_years,
      skills: (c.skills ?? []).slice(0, 20),
      target: c.target_role,
    }));
    const res = await aiCall({
      model: MODEL,
      messages: [
        { role: "system", content: "Tu identifies les meilleurs candidats pour une offre, en français. Sois strict." },
        { role: "user", content: `Offre:\nTitre: ${job.title}\nDescription: ${(job.description ?? "").slice(0, 1500)}\nSkills requis: ${(job.required_skills ?? []).join(", ")}\nLieu: ${job.location ?? ""}\n\nCandidats:\n${JSON.stringify(compact)}` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "score_candidates",
          parameters: {
            type: "object",
            properties: {
              results: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    i: { type: "number" },
                    score: { type: "number", minimum: 0, maximum: 100 },
                    reason: { type: "string" },
                  },
                  required: ["i", "score", "reason"],
                  additionalProperties: false,
                },
              },
            },
            required: ["results"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "score_candidates" } },
    });
    const tc = res.choices?.[0]?.message?.tool_calls?.[0];
    const scored = tc ? (JSON.parse(tc.function.arguments).results as { i: number; score: number; reason: string }[]) : [];
    const merged = scored
      .map(s => ({ ...pool[s.i], match_score: s.score, match_reason: s.reason }))
      .filter(c => c && c.user_id)
      .sort((a, b) => (b.match_score ?? 0) - (a.match_score ?? 0))
      .slice(0, 10);
    return { candidates: merged };
  });