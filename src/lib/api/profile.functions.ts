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