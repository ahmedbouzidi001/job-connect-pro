import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-client-middleware";
import { z } from "zod";

const ExperienceSchema = z.object({
  title: z.string().max(200),
  company: z.string().max(200),
  location: z.string().max(200).optional().default(""),
  start: z.string().max(40).optional().default(""),
  end: z.string().max(40).optional().default(""),
  description: z.string().max(2000).optional().default(""),
  bullets: z.array(z.string().max(500)).max(15).optional().default([]),
});

const EducationSchema = z.object({
  degree: z.string().max(200),
  school: z.string().max(200),
  location: z.string().max(200).optional().default(""),
  start: z.string().max(40).optional().default(""),
  end: z.string().max(40).optional().default(""),
  description: z.string().max(1000).optional().default(""),
});

const CvStructuredSchema = z.object({
  experiences: z.array(ExperienceSchema).max(20).default([]),
  educations: z.array(EducationSchema).max(15).default([]),
  projects: z.array(z.object({
    name: z.string().max(200),
    description: z.string().max(1000).optional().default(""),
    url: z.string().max(300).optional().default(""),
  })).max(20).default([]),
  certifications: z.array(z.object({
    name: z.string().max(200),
    issuer: z.string().max(200).optional().default(""),
    year: z.string().max(20).optional().default(""),
  })).max(20).default([]),
}).default({ experiences: [], educations: [], projects: [], certifications: [] });

const ProfileInput = z.object({
  full_name: z.string().min(1).max(120),
  headline: z.string().max(200).optional().nullable(),
  bio: z.string().max(2000).optional().nullable(),
  target_role: z.string().max(200).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  country_code: z.string().max(8).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  email_contact: z.string().max(200).optional().nullable(),
  website: z.string().max(300).optional().nullable(),
  experience_years: z.number().min(0).max(60).optional().nullable(),
  skills: z.array(z.string().min(1).max(60)).max(40).optional().default([]),
  languages: z.array(z.string().min(1).max(60)).max(15).optional().default([]),
  links: z.record(z.string(), z.string().max(400)).optional().default({}),
  cv_structured: CvStructuredSchema,
  preferred_template: z.enum(["modern", "classic", "executive", "sidebar", "latex"]).optional().default("modern"),
  avatar_url: z.string().max(500).optional().nullable(),
});

export const getMyProfile = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle();
    if (error) throw new Error(error.message);
    return { profile: data };
  });

export const upsertMyProfile = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => ProfileInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("profiles").update({
      full_name: data.full_name,
      headline: data.headline ?? null,
      bio: data.bio ?? null,
      target_role: data.target_role ?? null,
      location: data.location ?? null,
      country_code: data.country_code ?? null,
      phone: data.phone ?? null,
      email_contact: data.email_contact ?? null,
      website: data.website ?? null,
      experience_years: data.experience_years ?? 0,
      skills: data.skills ?? [],
      languages: data.languages ?? [],
      links: data.links ?? {},
      cv_structured: data.cv_structured,
      preferred_template: data.preferred_template ?? "modern",
      avatar_url: data.avatar_url ?? null,
    }).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------- Premium toggle (UI-only until Stripe wired) ---------- */
const PremiumInput = z.object({ enable: z.boolean() });
export const setPremium = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => PremiumInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const until = data.enable ? new Date(Date.now() + 30 * 86400_000).toISOString() : null;
    const { error } = await supabase.from("profiles").update({
      is_premium: data.enable,
      premium_until: until,
    }).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true, premium_until: until };
  });

/* ---------- Account deletion (RGPD) ---------- */

/* ---------- Remplissage automatique du profil depuis le CV ---------- */
export const buildProfileFromCv = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      cvText: z.string().min(100).max(30000),
      language: z.enum(["fr", "en"]).default("fr"),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY manquant");

    const sys = `Tu es un parseur de CV. Extrait les informations et réponds UNIQUEMENT avec un JSON valide (aucun texte autour), en ${data.language === "fr" ? "français" : "anglais"}, schéma exact :
{"full_name":"","headline":"","bio":"","target_role":"","location":"","phone":"","email_contact":"","website":"","links":{"linkedin":"","github":""},"experience_years":0,"skills":[],"languages":[],"cv_structured":{"experiences":[{"title":"","company":"","location":"","start":"","end":"","description":"","bullets":[]}],"educations":[{"degree":"","school":"","location":"","start":"","end":"","description":""}],"projects":[{"name":"","description":"","url":""}],"certifications":[{"name":"","issuer":"","year":""}]}}
Règles : ne jamais inventer une info absente (utiliser "" ou []), dates au format "MM/AAAA" ou "AAAA", 3 à 5 bullets d'impact par expérience, experience_years = estimation entière.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: data.cvText.slice(0, 24000) },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Extraction IA indisponible (${res.status})`);
    const j = await res.json();
    const raw: string = j?.choices?.[0]?.message?.content ?? "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Impossible de lire la réponse de l'IA. Réessaie.");

    const Parsed = z.object({
      full_name: z.string().max(120).optional().default(""),
      headline: z.string().max(200).optional().default(""),
      bio: z.string().max(2000).optional().default(""),
      target_role: z.string().max(200).optional().default(""),
      location: z.string().max(200).optional().default(""),
      phone: z.string().max(40).optional().default(""),
      email_contact: z.string().max(200).optional().default(""),
      website: z.string().max(300).optional().default(""),
      links: z.record(z.string(), z.string().max(400)).optional().default({}),
      experience_years: z.coerce.number().min(0).max(60).optional().default(0),
      skills: z.array(z.string().max(60)).max(40).optional().default([]),
      languages: z.array(z.string().max(60)).max(15).optional().default([]),
      cv_structured: CvStructuredSchema,
    });
    const p = Parsed.parse(JSON.parse(match[0]));

    const { error } = await supabase.from("profiles").update({
      full_name: p.full_name || undefined,
      headline: p.headline || null,
      bio: p.bio || null,
      target_role: p.target_role || null,
      location: p.location || null,
      phone: p.phone || null,
      email_contact: p.email_contact || null,
      website: p.website || null,
      experience_years: p.experience_years,
      skills: p.skills,
      languages: p.languages,
      links: p.links,
      cv_structured: p.cv_structured,
      cv_raw_text: data.cvText.slice(0, 30000),
    }).eq("user_id", userId);
    if (error) throw new Error(error.message);

    return { profile: p };
  });

export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // auth.users cascade removes profile/apps/etc via FKs where configured.
    // Best-effort cleanup for tables without ON DELETE CASCADE on user_id.
    await Promise.all([
      supabaseAdmin.from("applications").delete().eq("user_id", userId),
      supabaseAdmin.from("application_drafts").delete().eq("user_id", userId),
      supabaseAdmin.from("cv_analyses").delete().eq("user_id", userId),
      supabaseAdmin.from("learning_paths").delete().eq("user_id", userId),
      supabaseAdmin.from("job_alerts").delete().eq("user_id", userId),
      supabaseAdmin.from("job_alert_matches").delete().eq("user_id", userId),
      supabaseAdmin.from("user_roles").delete().eq("user_id", userId),
      supabaseAdmin.from("profiles").delete().eq("user_id", userId),
    ]);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });