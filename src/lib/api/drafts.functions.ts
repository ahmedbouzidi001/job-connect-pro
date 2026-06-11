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
  if (res.status === 429) throw new Error("Limite IA atteinte.");
  if (res.status === 402) throw new Error("Crédits IA épuisés.");
  if (!res.ok) throw new Error(`AI ${res.status}`);
  return res.json();
}

const DraftInput = z.object({
  jobTitle: z.string().min(1).max(200),
  company: z.string().min(1).max(200),
  jobUrl: z.string().url().optional().nullable(),
  jobDescription: z.string().min(20).max(20000),
  matchScore: z.number().int().min(0).max(100).optional().nullable(),
  language: z.enum(["fr", "en", "ar"]).default("fr"),
});

export const generateApplicationDraft = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => DraftInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles")
      .select("cv_raw_text, full_name, target_role, skills, experience_years, headline, email_contact, phone")
      .eq("user_id", userId).single();

    if (!profile?.cv_raw_text || profile.cv_raw_text.length < 100) {
      throw new Error("Analyse d'abord ton CV pour activer la candidature automatique.");
    }

    const langName = data.language === "ar" ? "arabe" : data.language === "en" ? "anglais" : "français";
    const ai = await aiCall({
      model: MODEL,
      messages: [
        { role: "system", content: `Coach carrière expert. Réponds en ${langName}. Tu adaptes le CV et écris une lettre de motivation percutante (3 paragraphes max), sincère et orientée résultats.` },
        { role: "user", content: `OFFRE: ${data.jobTitle} chez ${data.company}\n"""\n${data.jobDescription.slice(0, 6000)}\n"""\n\nCV CANDIDAT:\n"""\n${profile.cv_raw_text.slice(0, 6000)}\n"""\n\nGénère: 1) un CV adapté en markdown (réorganisation/reformulation, pas d'invention) ; 2) une lettre de motivation FR personnalisée pour cette offre.` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "return_draft",
          parameters: {
            type: "object",
            properties: {
              tailored_cv: { type: "string" },
              cover_letter: { type: "string" },
            },
            required: ["tailored_cv", "cover_letter"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "return_draft" } },
    });

    const toolCall = ai.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("Génération échouée");
    const { tailored_cv, cover_letter } = JSON.parse(toolCall.function.arguments);

    const { data: row, error } = await supabase.from("application_drafts").insert({
      user_id: userId,
      job_title: data.jobTitle, company: data.company, job_url: data.jobUrl ?? null,
      match_score: data.matchScore ?? null,
      tailored_cv, cover_letter, status: "draft",
    }).select().single();
    if (error) throw new Error(error.message);
    return { id: row.id, tailored_cv, cover_letter };
  });

export const listDrafts = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase.from("application_drafts")
      .select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50);
    if (error) throw new Error(error.message);
    return { drafts: data };
  });

export const deleteDraft = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("application_drafts").delete().eq("id", data.id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });