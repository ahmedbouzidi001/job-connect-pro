import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-client-middleware";
import { z } from "zod";
import { enforceRateLimit, audit, logError } from "./rate-limit";

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

/**
 * Auto-candidature (premium uniquement) : pour chaque offre matchée ≥ 80%,
 * génère un CV adapté + lettre de motivation et sauvegarde une candidature
 * en statut "applied". Retourne le résumé.
 */
export const autoApplyToMatches = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    jobs: z.array(z.object({
      title: z.string(), company: z.string(), url: z.string(),
      description: z.string().optional().default(""),
      matchScore: z.number(),
    })).min(1).max(20),
    language: z.enum(["fr", "en"]).default("fr"),
    minScore: z.number().min(50).max(100).default(80),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Rate limit: max 3 batches per minute (each batch can apply to 20 jobs)
    await enforceRateLimit(userId, "auto_apply", 3);
    const { data: profile } = await supabase.from("profiles")
      .select("cv_raw_text, full_name").eq("user_id", userId).single();
    const cv = (profile?.cv_raw_text || "").slice(0, 8000);
    if (cv.length < 100) throw new Error("Analyse d'abord ton CV avant l'auto-candidature.");

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY manquant");

    const targets = data.jobs.filter(j => j.matchScore >= data.minScore);
    if (targets.length === 0) return { applied: 0, skipped: data.jobs.length, results: [] as Array<{title: string; company: string; ok: boolean; message?: string}> };

    const results: Array<{ title: string; company: string; ok: boolean; message?: string }> = [];
    let applied = 0;

    for (const job of targets) {
      try {
        // Génère lettre courte adaptée
        const sys = `Tu écris des lettres de motivation très courtes (150 mots max), en ${data.language === "fr" ? "français" : "anglais"}, percutantes, adaptées à l'offre.`;
        const user = `Offre : ${job.title} chez ${job.company}\n${job.description.slice(0, 2000)}\n\nProfil candidat :\n${cv.slice(0, 3000)}\n\nGénère uniquement la lettre.`;
        const aiRes = await fetch(LOVABLE_AI_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [{ role: "system", content: sys }, { role: "user", content: user }],
          }),
        });
        if (!aiRes.ok) throw new Error(`AI ${aiRes.status}`);
        const j = await aiRes.json();
        const letter = j?.choices?.[0]?.message?.content?.trim() || "";

        const { error } = await supabase.from("applications").insert([{
          user_id: userId,
          job_title: job.title,
          company: job.company,
          job_url: job.url,
          status: "applied" as const,
          match_score: job.matchScore,
          cover_letter: letter,
          applied_at: new Date().toISOString(),
          notes: "Auto-candidature générée (>= " + data.minScore + "% match)",
        }]);
        if (error) throw error;
        applied++;
        results.push({ title: job.title, company: job.company, ok: true });
      } catch (e) {
        await logError({ userId, source: "auto_apply", message: (e as Error).message, context: { job: job.title } });
        results.push({ title: job.title, company: job.company, ok: false, message: (e as Error).message });
      }
    }

    await audit({ userId, action: "auto_apply_batch", metadata: { applied, total: data.jobs.length, minScore: data.minScore } });
    return { applied, skipped: data.jobs.length - targets.length, results };
  });

/* ---------- Réglages de candidature automatique ---------- */

const COUNTRIES = ["TN","FR","MA","DZ","CA","BE","CH","AE","SA","QA","US","UK","DE","ANY"] as const;

const SettingsInput = z.object({
  is_active: z.boolean(),
  countries: z.array(z.enum(COUNTRIES)).min(1).max(10),
  max_per_run: z.number().int().min(1).max(20),
  min_score: z.number().int().min(25).max(95).default(25),
  role_override: z.string().max(160).optional().nullable(),
  daily_enabled: z.boolean().default(false),
});

export const getAutoApplySettings = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase.from("auto_apply_settings")
      .select("*").eq("user_id", userId).maybeSingle();
    if (error) throw new Error(error.message);
    return { settings: data };
  });

export const saveAutoApplySettings = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => SettingsInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("auto_apply_settings").upsert([{
      user_id: userId,
      is_active: data.is_active,
      countries: data.countries as unknown as string[],
      max_per_run: data.max_per_run,
      min_score: data.min_score,
      role_override: data.role_override || null,
      daily_enabled: data.daily_enabled,
    }], { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    await audit({ userId, action: "auto_apply_settings_saved", metadata: { active: data.is_active, countries: data.countries, max: data.max_per_run } });
    return { ok: true };
  });

/**
 * Lance la candidature automatique : recherche des offres dans les pays choisis,
 * score chaque offre via l'IA, puis envoie des candidatures spontanées
 * (CV du profil + lettre générée) pour les offres au-dessus du score minimum.
 */
export const runAutoApplyNow = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await enforceRateLimit(userId, "auto_apply_run", 2);
    const { runAutoApplyForUser } = await import("./auto-apply.server");
    const res = await runAutoApplyForUser(supabase, userId);
    await audit({ userId, action: "auto_apply_run", metadata: { applied: res.applied, scanned: res.scanned } });
    return res;
  });
