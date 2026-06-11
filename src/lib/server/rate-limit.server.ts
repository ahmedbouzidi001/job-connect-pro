// Server-only rate limit + audit helpers. Use inside createServerFn handlers.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Throws if the user exceeds maxPerMinute calls in the current minute window
 * for the given bucket. Atomic via DB function (no race condition).
 */
export async function enforceRateLimit(
  userId: string,
  bucket: string,
  maxPerMinute: number,
): Promise<void> {
  const { data, error } = await supabaseAdmin.rpc("check_rate_limit", {
    _user_id: userId,
    _bucket: bucket,
    _max_per_minute: maxPerMinute,
  });
  if (error) {
    // Fail open on RPC error but log it — don't take down the app
    console.error("[rate-limit] rpc error", error);
    return;
  }
  if (data === false) {
    throw new Error(
      `Trop de requêtes. Réessayez dans une minute (limite: ${maxPerMinute}/min).`,
    );
  }
}

export async function audit(params: {
  userId: string | null;
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
}) {
  try {
    await supabaseAdmin.from("audit_log").insert({
      user_id: params.userId,
      action: params.action,
      resource_type: params.resourceType ?? null,
      resource_id: params.resourceId ?? null,
      metadata: params.metadata ?? {},
      ip_address: params.ip ?? null,
      user_agent: params.userAgent ?? null,
    });
  } catch (e) {
    console.error("[audit] insert failed", e);
  }
}

export async function logError(params: {
  userId?: string | null;
  source: string;
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
  level?: "error" | "warn" | "info";
}) {
  try {
    await supabaseAdmin.from("error_log").insert({
      user_id: params.userId ?? null,
      level: params.level ?? "error",
      source: params.source,
      message: params.message.slice(0, 2000),
      stack: params.stack?.slice(0, 8000) ?? null,
      context: params.context ?? {},
    });
  } catch (e) {
    console.error("[error-log] insert failed", e);
  }
}

/** Helper: require premium tier in a server fn. */
export async function requirePremium(
  userId: string,
  minTier: "pro" | "business" = "pro",
): Promise<void> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("plan_tier, is_premium, premium_until")
    .eq("user_id", userId)
    .single();
  if (!data) throw new Error("Profil introuvable");
  const active =
    data.is_premium &&
    (!data.premium_until || new Date(data.premium_until) > new Date());
  if (!active) {
    throw new Error("Abonnement requis. Passez à l'offre Pro ou Business.");
  }
  if (minTier === "business" && data.plan_tier !== "business") {
    throw new Error("Abonnement Business requis pour cette fonctionnalité.");
  }
}