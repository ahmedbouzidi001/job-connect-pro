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
    headers: {
      Authorization: `Bearer ${getAIKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (res.status === 429) throw new Error("Limite de requêtes atteinte. Réessayez dans une minute.");
  if (res.status === 402) throw new Error("Crédits IA épuisés. Ajoutez du crédit dans Lovable Cloud.");
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI gateway error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

/* ---------- Analyse CV ---------- */

const AnalyzeInput = z.object({
  cvText: z.string().min(50, "Le CV doit contenir au moins 50 caractères").max(50000),
  language: z.enum(["fr", "en", "ar"]).default("fr"),
  market: z.enum(["tunisia", "international", "both"]).default("both"),
});

export const analyzeCv = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => AnalyzeInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const langName = data.language === "ar" ? "arabe" : data.language === "en" ? "anglais" : "français";
    const marketName =
      data.market === "tunisia" ? "marché tunisien" :
      data.market === "international" ? "marché international (Europe, Canada, Golfe)" :
      "marché tunisien ET international";

    const systemPrompt = `Tu es un coach carrière senior avec 15 ans d'expérience dans le recrutement tech et corporate. Tu analyses des CV pour le ${marketName}. Réponds toujours en ${langName}. Sois direct, actionnable, sans flatterie inutile.`;

    const userPrompt = `Analyse ce CV en profondeur et retourne un JSON structuré.\n\nCV :\n"""\n${data.cvText}\n"""\n\nDonne :\n- score employabilité 0-100 réaliste\n- résumé 2 phrases\n- 3-5 forces concrètes\n- 3-5 lacunes/axes d'amélioration\n- 3-5 recommandations actionnables (formations, mots-clés ATS, projets à ajouter)\n- positionnement marché (quel poste viser, quel salaire estimé en TND/EUR)`;

    const result = await aiCall({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [{
        type: "function",
        function: {
          name: "return_cv_analysis",
          description: "Retourne l'analyse structurée du CV",
          parameters: {
            type: "object",
            properties: {
              score: { type: "number", minimum: 0, maximum: 100 },
              summary: { type: "string" },
              strengths: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 5 },
              gaps: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 5 },
              recommendations: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 5 },
              market_positioning: { type: "string" },
            },
            required: ["score", "summary", "strengths", "gaps", "recommendations", "market_positioning"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "return_cv_analysis" } },
    });

    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("Réponse IA invalide");
    const analysis = JSON.parse(toolCall.function.arguments);

    // Sauvegarder
    const { data: saved, error: insertErr } = await supabase
      .from("cv_analyses")
      .insert({
        user_id: userId,
        cv_text: data.cvText,
        score: analysis.score,
        summary: analysis.summary,
        strengths: analysis.strengths,
        gaps: analysis.gaps,
        recommendations: analysis.recommendations,
        market_positioning: analysis.market_positioning,
        language: data.language,
      })
      .select()
      .single();
    if (insertErr) console.error("insert cv_analyses error:", insertErr);

    // Mettre à jour le score profil + stocker le CV brut
    await supabase
      .from("profiles")
      .update({ cv_raw_text: data.cvText, employability_score: analysis.score })
      .eq("user_id", userId);

    return { analysis, id: saved?.id ?? null };
  });

/* ---------- Génération CV + LM adaptés à une offre ---------- */

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
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => GenerateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const langName = data.language === "ar" ? "arabe" : data.language === "en" ? "anglais" : "français";
    const toneName = data.tone === "enthusiastic" ? "enthousiaste et motivé" : data.tone === "concise" ? "concis et direct" : "professionnel et confiant";

    const systemPrompt = `Tu es un expert en rédaction de CV et lettres de motivation, spécialisé en ATS (Applicant Tracking Systems). Tu écris en ${langName} avec un ton ${toneName}. Tu adaptes parfaitement le CV et la LM à chaque offre en utilisant les mots-clés de l'annonce. Pas d'inventions : reste fidèle au CV source.`;

    const userPrompt = `OFFRE D'EMPLOI :\nTitre: ${data.jobTitle}\nEntreprise: ${data.company}\n${data.jobUrl ? `URL: ${data.jobUrl}\n` : ""}\nDescription:\n"""\n${data.jobDescription}\n"""\n\nCV SOURCE DU CANDIDAT :\n"""\n${data.cvText}\n"""\n\nGénère :\n1. Un CV optimisé ATS pour cette offre (sections : résumé pro 3 lignes, expériences avec bullets impactants utilisant les mots-clés de l'offre, compétences hiérarchisées, formations, langues)\n2. Une lettre de motivation personnalisée (intro accroche, corps 2 paragraphes : pourquoi moi pour ce poste + pourquoi cette entreprise, conclusion call-to-action)\n3. Score de compatibilité 0-100\n4. 5 mots-clés clés de l'offre que le candidat doit absolument mettre en avant`;

    const result = await aiCall({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [{
        type: "function",
        function: {
          name: "return_application",
          description: "Retourne le CV adapté et la LM",
          parameters: {
            type: "object",
            properties: {
              match_score: { type: "number", minimum: 0, maximum: 100 },
              tailored_cv: { type: "string", description: "CV complet en markdown structuré" },
              cover_letter: { type: "string", description: "Lettre de motivation complète" },
              keywords: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 8 },
              advice: { type: "string", description: "Conseil court pour maximiser ses chances" },
            },
            required: ["match_score", "tailored_cv", "cover_letter", "keywords", "advice"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "return_application" } },
    });

    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("Réponse IA invalide");
    const out = JSON.parse(toolCall.function.arguments);

    // Sauvegarder dans applications
    const { data: saved } = await supabase
      .from("applications")
      .insert({
        user_id: userId,
        job_title: data.jobTitle,
        company: data.company,
        job_url: data.jobUrl ?? null,
        status: "saved",
        match_score: out.match_score,
        cover_letter: out.cover_letter,
        notes: `Mots-clés: ${out.keywords.join(", ")}\n\n${out.advice}`,
      })
      .select()
      .single();

    return { ...out, applicationId: saved?.id ?? null };
  });

/* ---------- Scrape URL d'offre ---------- */

const ScrapeInput = z.object({
  url: z.string().url(),
});

export const scrapeJobUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ScrapeInput.parse(input))
  .handler(async ({ data }) => {
    let html = "";
    try {
      const res = await fetch(data.url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml",
        },
        redirect: "follow",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      html = await res.text();
    } catch (e) {
      throw new Error(`Impossible de récupérer cette URL. Collez plutôt la description manuellement. (${(e as Error).message})`);
    }

    // Strip HTML
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 15000);

    if (text.length < 200) {
      throw new Error("Page vide ou bloquée (LinkedIn bloque souvent). Collez la description manuellement.");
    }

    // Extraire titre/entreprise/desc via IA
    const result = await aiCall({
      model: MODEL,
      messages: [
        { role: "system", content: "Tu extrais les informations d'une offre d'emploi depuis du texte brut HTML." },
        { role: "user", content: `Extrais l'offre depuis ce texte. Si une info manque, devine raisonnablement.\n\n"""\n${text}\n"""` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "return_job",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string" },
              company: { type: "string" },
              location: { type: "string" },
              description: { type: "string", description: "Description complète : missions, profil recherché, compétences, avantages" },
            },
            required: ["title", "company", "description"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "return_job" } },
    });

    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("Extraction IA échouée");
    return JSON.parse(toolCall.function.arguments);
  });

/* ---------- LinkedIn Optimizer ---------- */

const LinkedInInput = z.object({
  profileText: z.string().min(50).max(30000),
  targetRole: z.string().min(1).max(200),
  language: z.enum(["fr", "en", "ar"]).default("fr"),
});

export const optimizeLinkedIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => LinkedInInput.parse(input))
  .handler(async ({ data }) => {
    const langName = data.language === "ar" ? "arabe" : data.language === "en" ? "anglais" : "français";
    const systemPrompt = `Tu es expert LinkedIn avec un track record de profils générant 10x plus de vues recruteurs. Tu réponds en ${langName}. Tu optimises pour les algorithmes LinkedIn ET pour les recruteurs humains.`;
    const userPrompt = `Profil LinkedIn actuel :\n"""\n${data.profileText}\n"""\n\nPoste cible : ${data.targetRole}\n\n1. Audite le profil (score 0-100, 5 problèmes majeurs, 5 quick wins)\n2. Réécris : headline (max 220 caractères, accrocheur), section About (3-5 paragraphes, hook + valeur + CTA), 3 bullets d'expérience type optimisés\n3. Suggère 10 compétences à ajouter (priorisées pour le poste cible)`;

    const result = await aiCall({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
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

/* ---------- Upload signed URL pour CV ---------- */

const UploadCvInput = z.object({
  fileName: z.string().min(1).max(255),
});

export const getCvUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UploadCvInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const path = `${userId}/${Date.now()}-${data.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { data: signed, error } = await supabase.storage
      .from("cvs")
      .createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { path, token: signed.token, signedUrl: signed.signedUrl };
  });