import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-client-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";
import Stripe from "stripe";
import { enforceRateLimit, audit } from "./rate-limit.server";

const PLANS = {
  pro: { name: "HireMe Pro", amount: 999, currency: "eur", interval: "month" as const },
  business: { name: "HireMe Business", amount: 2499, currency: "eur", interval: "month" as const },
};
export type PlanTier = keyof typeof PLANS;

function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY non configuré");
  return new Stripe(key, { httpClient: Stripe.createFetchHttpClient() });
}

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ plan: z.enum(["pro", "business"]) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    await enforceRateLimit(userId, "checkout", 5);
    const stripe = stripeClient();
    const plan = PLANS[data.plan];

    const { data: profile } = await supabase.from("profiles")
      .select("stripe_customer_id, full_name, email_contact").eq("user_id", userId).single();
    const email = profile?.email_contact || claims.email || undefined;

    let customerId = profile?.stripe_customer_id ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email, name: profile?.full_name ?? undefined, metadata: { user_id: userId },
      });
      customerId = customer.id;
      await supabaseAdmin.from("profiles").update({ stripe_customer_id: customerId }).eq("user_id", userId);
    }

    const origin = process.env.PUBLIC_APP_ORIGIN ||
      (process.env.VITE_PUBLIC_APP_ORIGIN) ||
      "https://id-preview--e9f4b3fd-034d-4917-9ee8-af2ddc09ba2c.lovable.app";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{
        price_data: {
          currency: plan.currency,
          recurring: { interval: plan.interval },
          unit_amount: plan.amount,
          product_data: { name: plan.name },
        },
        quantity: 1,
      }],
      success_url: `${origin}/pricing?status=success`,
      cancel_url: `${origin}/pricing?status=cancelled`,
      metadata: { user_id: userId, plan: data.plan },
      subscription_data: { metadata: { user_id: userId, plan: data.plan } },
      allow_promotion_codes: true,
    }, { idempotencyKey: `checkout_${userId}_${data.plan}_${Date.now() / 60000 | 0}` });
    await audit({ userId, action: "checkout_session_created", metadata: { plan: data.plan } });

    return { url: session.url };
  });

export const createBillingPortalSession = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const stripe = stripeClient();
    const { data: profile } = await supabase.from("profiles")
      .select("stripe_customer_id").eq("user_id", userId).single();
    if (!profile?.stripe_customer_id) throw new Error("Aucun abonnement actif");
    const origin = process.env.PUBLIC_APP_ORIGIN ||
      "https://id-preview--e9f4b3fd-034d-4917-9ee8-af2ddc09ba2c.lovable.app";
    const portal = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${origin}/pricing`,
    });
    return { url: portal.url };
  });

export const getBillingStatus = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase.from("profiles")
      .select("plan_tier, is_premium, premium_until, subscription_status, stripe_subscription_id")
      .eq("user_id", userId).single();
    return { billing: data };
  });