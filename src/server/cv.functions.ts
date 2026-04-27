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

/* ---------- Analyse CV ---------- */
const AnalyzeInput = z.object({
  cvText: z.string().min(50).max(50000),
  language: z.enum(["fr", "en", "ar"]).default("fr"),
  market: z.enum(["tunisia", "international", "both"]).default("both"),
});

export const analyzeCv = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => AnalyzeInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const langName = data.language === "ar" ? "arabe" : data.language === "en" ? "anglais" : "français";
    const marketName = data.market === "tunisia" ? "marché tunisien" : data.market === "international" ? "marché international" : "marché tunisien et international";

    const result = await aiCall({
      model: MODEL,
      messages: [
        { role: "system", content: `Tu es un coach carrière senior. Analyse en ${langName} pour le ${marketName}.` },
        { role: "user", content: `Analyse ce CV puis extrais sa structure (nom, contact, expériences, formations, compétences, langues, certifs).\n\nCV:\n"""\n${data.cvText}\n"""` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "return_analysis",
          parameters: {
            type: "object",
            properties: {
              score: { type: "number", minimum: 0, maximum: 100 },
              summary: { type: "string" },
              strengths: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 6 },
              gaps: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 6 },
              recommendations: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 6 },
              market_positioning: { type: "string" },
              structured: {
                type: "object",
                properties: {
                  full_name: { type: "string" },
                  headline: { type: "string" },
                  email: { type: "string" },
                  phone: { type: "string" },
                  location: { type: "string" },
                  linkedin: { type: "string" },
                  website: { type: "string" },
                  summary: { type: "string" },
                  skills: { type: "array", items: { type: "string" } },
                  languages: { type: "array", items: { type: "string" } },
                },
                required: ["full_name", "headline", "email", "phone", "location", "linkedin", "website", "summary", "skills", "languages"],
                additionalProperties: false,
              },
            },
            required: ["score", "summary", "strengths", "gaps", "recommendations", "market_positioning", "structured"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "return_analysis" } },
    });

    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("Réponse IA invalide");
    const analysis = JSON.parse(toolCall.function.arguments);

    const { data: saved } = await supabase.from("cv_analyses").insert({
      user_id: userId, cv_text: data.cvText, score: analysis.score,
      summary: analysis.summary, strengths: analysis.strengths, gaps: analysis.gaps,
      recommendations: analysis.recommendations, market_positioning: analysis.market_positioning,
      language: data.language,
    }).select().single();

    const s = analysis.structured;
    await supabase.from("profiles").update({
      cv_raw_text: data.cvText,
      cv_structured: s,
      employability_score: analysis.score,
      full_name: s.full_name || undefined,
      headline: s.headline || undefined,
      phone: s.phone || undefined,
      email_contact: s.email || undefined,
      website: s.website || undefined,
      location: s.location || undefined,
      skills: s.skills || [],
      languages: s.languages || [],
    }).eq("user_id", userId);

    return { analysis, id: saved?.id ?? null };
  });

/* ---------- Génération CV+LM structuré ---------- */
const GenerateInput = z.object({
  cvText: z.string().min(50).max(50000),
  jobUrl: z.string().url().optional().nullable(),
  jobDescription: z.string().min(20).max(20000),
  jobTitle: z.string().min(1).max(200),
  company: z.string().min(1).max(200),
  language: z.enum(["fr", "en", "ar"]).default("fr"),
  tone: z.enum(["professional", "enthusiastic", "concise"]).default("professional"),
});

export const generateApplication = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => GenerateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const langName = data.language === "ar" ? "arabe" : data.language === "en" ? "anglais" : "français";
    const toneName = data.tone === "enthusiastic" ? "enthousiaste" : data.tone === "concise" ? "concis" : "professionnel";

    const result = await aiCall({
      model: MODEL,
      messages: [
        { role: "system", content: `Tu es expert CV ATS. Réponds en ${langName}, ton ${toneName}. Garde fidèlement les infos du CV source mais reformule pour matcher l'offre. NE METS JAMAIS de titre type "CV — POSTE" : on garde toujours le NOM du candidat en tête. Ne fabrique pas d'expériences.` },
        { role: "user", content: `OFFRE:\nTitre: ${data.jobTitle}\nEntreprise: ${data.company}\nDescription:\n"""\n${data.jobDescription}\n"""\n\nCV SOURCE:\n"""\n${data.cvText}\n"""\n\nGénère un CV STRUCTURÉ adapté + une lettre de motivation personnalisée.` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "return_application",
          parameters: {
            type: "object",
            properties: {
              match_score: { type: "number", minimum: 0, maximum: 100 },
              cv: {
                type: "object",
                properties: {
                  full_name: { type: "string" },
                  headline: { type: "string", description: "Titre pro court adapté à l'offre, ex: 'Ingénieur ERP - Spécialiste Odoo'. JAMAIS 'CV — POSTE'." },
                  email: { type: "string" },
                  phone: { type: "string" },
                  location: { type: "string" },
                  linkedin: { type: "string" },
                  website: { type: "string" },
                  summary: { type: "string" },
                  experiences: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        company: { type: "string" },
                        location: { type: "string" },
                        start: { type: "string" },
                        end: { type: "string" },
                        bullets: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 5 },
                      },
                      required: ["title", "company", "location", "start", "end", "bullets"],
                      additionalProperties: false,
                    },
                  },
                  educations: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        degree: { type: "string" },
                        school: { type: "string" },
                        location: { type: "string" },
                        start: { type: "string" },
                        end: { type: "string" },
                        details: { type: "string" },
                      },
                      required: ["degree", "school", "location", "start", "end", "details"],
                      additionalProperties: false,
                    },
                  },
                  skills_grouped: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        category: { type: "string" },
                        items: { type: "array", items: { type: "string" } },
                      },
                      required: ["category", "items"],
                      additionalProperties: false,
                    },
                  },
                  languages: { type: "array", items: { type: "string" } },
                  certifications: { type: "array", items: { type: "string" } },
                },
                required: ["full_name", "headline", "email", "phone", "location", "linkedin", "website", "summary", "experiences", "educations", "skills_grouped", "languages", "certifications"],
                additionalProperties: false,
              },
              cover_letter: {
                type: "object",
                properties: {
                  date: { type: "string" },
                  recipient: { type: "string" },
                  subject: { type: "string" },
                  greeting: { type: "string" },
                  paragraphs: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 5 },
                  closing: { type: "string" },
                  signature: { type: "string" },
                },
                required: ["date", "recipient", "subject", "greeting", "paragraphs", "closing", "signature"],
                additionalProperties: false,
              },
              keywords: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 8 },
              advice: { type: "string" },
            },
            required: ["match_score", "cv", "cover_letter", "keywords", "advice"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "return_application" } },
    });

    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("Réponse IA invalide");
    const out = JSON.parse(toolCall.function.arguments);

    const { data: saved } = await supabase.from("applications").insert({
      user_id: userId,
      job_title: data.jobTitle,
      company: data.company,
      job_url: data.jobUrl ?? null,
      status: "saved",
      match_score: out.match_score,
      tailored_cv: JSON.stringify(out.cv),
      cover_letter: JSON.stringify(out.cover_letter),
      keywords: out.keywords,
      notes: out.advice,
    }).select().single();

    return { ...out, applicationId: saved?.id ?? null };
  });

/* ---------- LinkedIn ---------- */
const LinkedInInput = z.object({
  profileText: z.string().min(50).max(30000),
  targetRole: z.string().min(1).max(200),
  language: z.enum(["fr", "en", "ar"]).default("fr"),
});

export const optimizeLinkedIn = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => LinkedInInput.parse(input))
  .handler(async ({ data }) => {
    const langName = data.language === "ar" ? "arabe" : data.language === "en" ? "anglais" : "français";
    const result = await aiCall({
      model: MODEL,
      messages: [
        { role: "system", content: `Expert LinkedIn. Réponds en ${langName}.` },
        { role: "user", content: `Profil:\n"""\n${data.profileText}\n"""\nPoste cible: ${data.targetRole}` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "return_linkedin_audit",
          parameters: {
            type: "object",
            properties: {
              score: { type: "number", minimum: 0, maximum: 100 },
              issues: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 7 },
              quick_wins: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 7 },
              optimized_headline: { type: "string" },
              optimized_about: { type: "string" },
              experience_bullets: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 5 },
              skills_to_add: { type: "array", items: { type: "string" }, minItems: 5, maxItems: 12 },
            },
            required: ["score", "issues", "quick_wins", "optimized_headline", "optimized_about", "experience_bullets", "skills_to_add"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "return_linkedin_audit" } },
    });
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("Réponse IA invalide");
    return JSON.parse(toolCall.function.arguments);
  });

/* ---------- Upload CV ---------- */
const UploadCvInput = z.object({ fileName: z.string().min(1).max(255) });

export const getCvUploadUrl = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => UploadCvInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const path = `${userId}/${Date.now()}-${data.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { data: signed, error } = await supabase.storage.from("cvs").createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { path, token: signed.token, signedUrl: signed.signedUrl };
  });

/* ---------- Skills Hub : certifs gratuits ---------- */
const SkillsInput = z.object({
  cvText: z.string().min(50).max(50000),
  targetRole: z.string().min(1).max(200),
  language: z.enum(["fr", "en", "ar"]).default("fr"),
});

export const recommendCertifications = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => SkillsInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const langName = data.language === "ar" ? "arabe" : data.language === "en" ? "anglais" : "français";

    const result = await aiCall({
      model: MODEL,
      messages: [
        { role: "system", content: `Tu es coach formation. Réponds en ${langName}. Ne recommande QUE des formations 100% gratuites: Google Skillshop, freeCodeCamp, OpenClassrooms (parcours libres), Coursera (audit gratuit), Microsoft Learn, IBM SkillsBuild, HubSpot Academy, edX (audit), Cisco NetAcad free, Kaggle Learn, MDN, Khan Academy, Codecademy free, Salesforce Trailhead, AWS Skill Builder free, Meta Blueprint, Atlassian University. URLs réelles uniquement.` },
        { role: "user", content: `CV:\n"""\n${data.cvText}\n"""\nPoste cible: ${data.targetRole}\n\nIdentifie 5-8 compétences à renforcer pour ce poste, puis recommande pour CHACUNE une formation gratuite avec URL réelle, durée, niveau, et pourquoi.` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "return_recommendations",
          parameters: {
            type: "object",
            properties: {
              gaps: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 8 },
              recommendations: {
                type: "array",
                minItems: 5,
                maxItems: 10,
                items: {
                  type: "object",
                  properties: {
                    skill: { type: "string" },
                    title: { type: "string" },
                    provider: { type: "string" },
                    url: { type: "string" },
                    duration: { type: "string" },
                    level: { type: "string" },
                    why: { type: "string" },
                    priority: { type: "number", minimum: 1, maximum: 5 },
                  },
                  required: ["skill", "title", "provider", "url", "duration", "level", "why", "priority"],
                  additionalProperties: false,
                },
              },
            },
            required: ["gaps", "recommendations"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "return_recommendations" } },
    });

    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("Réponse IA invalide");
    const out = JSON.parse(toolCall.function.arguments);

    await supabase.from("learning_paths").insert({
      user_id: userId, target_role: data.targetRole,
      gaps: out.gaps, recommendations: out.recommendations, language: data.language,
    });
    return out;
  });
