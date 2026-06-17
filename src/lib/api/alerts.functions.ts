import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-client-middleware";
import { z } from "zod";

const AlertInput = z.object({
  role: z.string().min(2).max(120),
  location: z.preprocess((v) => typeof v === "string" ? v.trim() : "", z.string().max(120)).default(""),
  countryCode: z.string().length(2).default("TN"),
  keywords: z.string().max(500).optional().nullable(),
  workType: z.enum(["any", "remote", "hybrid", "onsite"]).default("any"),
  contract: z.enum(["any", "full_time", "part_time", "contract", "internship"]).default("any"),
  seniority: z.enum(["any", "junior", "mid", "senior", "lead"]).default("any"),
  minScore: z.number().int().min(50).max(100).default(70),
});

export const createAlert = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => AlertInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const location = data.location || data.countryCode;
    const { data: row, error } = await supabase.from("job_alerts").insert({
      user_id: userId,
      role: data.role, location, country_code: data.countryCode,
      keywords: data.keywords ?? null,
      work_type: data.workType, contract: data.contract, seniority: data.seniority,
      min_score: data.minScore,
    }).select().single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const listAlerts = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase.from("job_alerts").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { alerts: data };
  });

export const deleteAlert = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("job_alerts").delete().eq("id", data.id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAlertMatches = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase.from("job_alert_matches")
      .select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50);
    if (error) throw new Error(error.message);
    return { matches: data };
  });