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

    const { discoverJobs } = await import("./auto-apply.server");
    const found = await discoverJobs(role, settings.countries ?? ["TN"], 12);
    if (found.length === 0) {
      await supabase.from("auto_apply_settings").update({ last_run_at: new Date().toISOString() }).eq("user_id", userId);
      return { applied: 0, scanned: 0, results: [] as Array<{ title: string; company: string; ok: boolean; message?: string }> };
    }

    // Évite les doublons avec les candidatures existantes
    const { data: existing } = await supabase.from("applications").select("job_url, job_title, company").eq("user_id", userId).limit(500);
    const seen = new Set((existing ?? []).flatMap((a) => [a.job_url ?? "", `${(a.job_title ?? "").toLowerCase()}|${(a.company ?? "").toLowerCase()}`]));
    const candidates = found.filter((j) => !seen.has(j.url) && !seen.has(`${j.title.toLowerCase()}|${j.company.toLowerCase()}`));

    // Scoring IA groupé
    const listing = candidates.slice(0, 40).map((j, i) => `${i}. ${j.title} — ${j.company} (${j.location ?? ""})\n${j.snippet.slice(0, 600)}`).join("\n\n");
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
      scores = candidates.slice(0, 40).map((_, i) => parsed.scores?.find((s) => s.i === i)?.score ?? 55);
    } catch {
      scores = candidates.slice(0, 40).map(() => 55);
    }

    const targets = candidates.slice(0, 40)
      .map((j, i) => ({ ...j, matchScore: Math.max(0, Math.min(100, Math.round(scores[i] ?? 55))) }))
      .filter((j) => j.matchScore >= (settings.min_score ?? 25))
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, settings.max_per_run ?? 5);

    const results: Array<{ title: string; company: string; ok: boolean; score?: number; message?: string }> = [];
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
        await logError({ userId, source: "auto_apply_run", message: (e as Error).message, context: { job: job.title } });
        results.push({ title: job.title, company: job.company, ok: false, message: (e as Error).message });
      }
    }

    await supabase.from("auto_apply_settings").update({
      last_run_at: new Date().toISOString(),
      total_applied: (settings.total_applied ?? 0) + applied,
    }).eq("user_id", userId);
    await audit({ userId, action: "auto_apply_run", metadata: { applied, scanned: candidates.length, countries: settings.countries } });

    return { applied, scanned: candidates.length, results };
  });