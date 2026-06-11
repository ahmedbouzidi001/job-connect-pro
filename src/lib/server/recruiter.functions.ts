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

/* ---------- Recherche candidats par filtres ---------- */
const FilterInput = z.object({
  query: z.string().max(200).optional().nullable(),
  location: z.string().max(120).optional().nullable(),
  minYears: z.number().min(0).max(40).optional().nullable(),
  skills: z.array(z.string().min(1).max(60)).max(15).optional().nullable(),
  limit: z.number().min(1).max(50).default(20),
});

export const searchCandidates = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => FilterInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("profiles")
      .select("user_id, full_name, headline, location, skills, languages, experience_years, employability_score, target_role, avatar_url")
      .eq("recruiter_visible", true)
      .limit(data.limit);

    if (data.location) q = q.ilike("location", `%${data.location}%`);
    if (typeof data.minYears === "number") q = q.gte("experience_years", data.minYears);
    if (data.skills && data.skills.length > 0) q = q.overlaps("skills", data.skills);
    if (data.query) {
      const term = `%${data.query}%`;
      q = q.or(`full_name.ilike.${term},headline.ilike.${term},target_role.ilike.${term}`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { candidates: rows ?? [] };
  });

/* ---------- Recherche en langage naturel ---------- */
const NLInput = z.object({
  prompt: z.string().min(5).max(500),
  language: z.enum(["fr", "en", "ar"]).default("fr"),
});

export const searchCandidatesNL = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => NLInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const langName = data.language === "ar" ? "arabe" : data.language === "en" ? "anglais" : "français";

    // 1) Extraire critères structurés
    const parse = await aiCall({
      model: MODEL,
      messages: [
        { role: "system", content: `Extrais des critères de recherche candidat depuis le prompt en ${langName}.` },
        { role: "user", content: data.prompt },
      ],
      tools: [{
        type: "function",
        function: {
          name: "extract_filters",
          parameters: {
            type: "object",
            properties: {
              role_keywords: { type: "array", items: { type: "string" }, description: "ex: React, Senior, Frontend" },
              skills: { type: "array", items: { type: "string" } },
              location: { type: "string" },
              min_years: { type: "number" },
              languages: { type: "array", items: { type: "string" } },
            },
            required: ["role_keywords", "skills", "location", "min_years", "languages"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "extract_filters" } },
    });
    const tc = parse.choices?.[0]?.message?.tool_calls?.[0];
    if (!tc) throw new Error("Réponse IA invalide");
    const filters = JSON.parse(tc.function.arguments) as {
      role_keywords: string[]; skills: string[]; location: string; min_years: number; languages: string[];
    };

    // 2) Récupérer un large pool
    let q = supabase
      .from("profiles")
      .select("user_id, full_name, headline, location, skills, languages, experience_years, employability_score, target_role, avatar_url")
      .eq("recruiter_visible", true)
      .limit(80);
    if (filters.location) q = q.ilike("location", `%${filters.location}%`);
    if (filters.min_years > 0) q = q.gte("experience_years", filters.min_years);
    if (filters.skills?.length) q = q.overlaps("skills", filters.skills);
    const { data: pool, error } = await q;
    if (error) throw new Error(error.message);
    if (!pool || pool.length === 0) return { filters, candidates: [] };

    // 3) Scorer le pool en batch
    const compact = pool.map((c, i) => ({
      i,
      name: c.full_name,
      headline: c.headline,
      location: c.location,
      years: c.experience_years,
      skills: (c.skills ?? []).slice(0, 20),
      langs: c.languages ?? [],
      target: c.target_role,
    }));

    const score = await aiCall({
      model: MODEL,
      messages: [
        { role: "system", content: `Tu scores des candidats vs un brief en ${langName}. Sois strict et précis.` },
        { role: "user", content: `Brief: ${data.prompt}\n\nCandidats:\n${JSON.stringify(compact)}` },
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
    const stc = score.choices?.[0]?.message?.tool_calls?.[0];
    const scored = stc ? (JSON.parse(stc.function.arguments).results as { i: number; score: number; reason: string }[]) : [];
    const merged = scored
      .map(s => ({ ...pool[s.i], match_score: s.score, match_reason: s.reason }))
      .filter(c => c.user_id)
      .sort((a, b) => (b.match_score ?? 0) - (a.match_score ?? 0))
      .slice(0, 15);

    return { filters, candidates: merged };
  });

/* ---------- Toggle visibilité recruteur ---------- */
const VisInput = z.object({ visible: z.boolean() });
export const setRecruiterVisible = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => VisInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("profiles").update({ recruiter_visible: data.visible }).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------- Messagerie ---------- */
const StartConvInput = z.object({
  candidateId: z.string().uuid(),
  subject: z.string().min(1).max(200),
  firstMessage: z.string().min(1).max(4000),
});

export const startConversation = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => StartConvInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Cherche conv existante
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("recruiter_id", userId)
      .eq("candidate_id", data.candidateId)
      .maybeSingle();

    let convId = existing?.id as string | undefined;
    if (!convId) {
      const { data: created, error } = await supabase
        .from("conversations")
        .insert({ recruiter_id: userId, candidate_id: data.candidateId, subject: data.subject })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      convId = created.id;
    }
    const { error: mErr } = await supabase
      .from("messages")
      .insert({ conversation_id: convId, sender_id: userId, body: data.firstMessage });
    if (mErr) throw new Error(mErr.message);
    return { conversationId: convId };
  });

const SendInput = z.object({
  conversationId: z.string().uuid(),
  body: z.string().min(1).max(4000),
});
export const sendMessage = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => SendInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("messages").insert({
      conversation_id: data.conversationId, sender_id: userId, body: data.body,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listConversations = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("conversations")
      .select("id, subject, recruiter_id, candidate_id, updated_at, created_at")
      .or(`recruiter_id.eq.${userId},candidate_id.eq.${userId}`)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    const otherIds = Array.from(new Set((data ?? []).map(c => c.recruiter_id === userId ? c.candidate_id : c.recruiter_id)));
    let profiles: Record<string, { full_name: string | null; avatar_url: string | null }> = {};
    if (otherIds.length) {
      const { data: ps } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url")
        .in("user_id", otherIds);
      for (const p of ps ?? []) profiles[p.user_id] = { full_name: p.full_name, avatar_url: p.avatar_url };
    }
    const enriched = (data ?? []).map(c => ({
      ...c,
      otherUserId: c.recruiter_id === userId ? c.candidate_id : c.recruiter_id,
      other: profiles[c.recruiter_id === userId ? c.candidate_id : c.recruiter_id] ?? { full_name: "Utilisateur", avatar_url: null },
      meIsRecruiter: c.recruiter_id === userId,
    }));
    return { conversations: enriched };
  });

const ListMsgInput = z.object({ conversationId: z.string().uuid() });
export const listMessages = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => ListMsgInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: msgs, error } = await supabase
      .from("messages")
      .select("id, sender_id, body, created_at, read_at")
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { messages: msgs ?? [] };
  });
