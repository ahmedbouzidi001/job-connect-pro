import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY missing");
  return new Stripe(key, { httpClient: Stripe.createFetchHttpClient() });
}

function planFromAmount(amount: number | null | undefined): "pro" | "business" | "free" {
  if (amount === 999) return "pro";
  if (amount === 2499) return "business";
  return "free";
}

async function syncSubscription(sub: Stripe.Subscription) {
  const userId = (sub.metadata?.user_id as string | undefined) ?? null;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const item = sub.items.data[0];
  const plan = (sub.metadata?.plan as "pro" | "business" | undefined) ??
    planFromAmount(item?.price.unit_amount ?? null);

  const active = ["active", "trialing"].includes(sub.status);
  const periodEnd = (sub as unknown as { current_period_end?: number }).current_period_end;
  const update = {
    plan_tier: active ? plan : "free",
    is_premium: active,
    premium_until: active && periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    stripe_subscription_id: sub.id,
    subscription_status: sub.status,
  };
  if (userId) {
    await supabaseAdmin.from("profiles").update(update).eq("user_id", userId);
  } else {
    await supabaseAdmin.from("profiles").update(update).eq("stripe_customer_id", customerId);
  }
}

export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!secret) return new Response("Webhook secret missing", { status: 500 });
        const sig = request.headers.get("stripe-signature");
        if (!sig) return new Response("Missing signature", { status: 400 });
        const raw = await request.text();
        const stripe = stripeClient();
        let evt: Stripe.Event;
        try {
          evt = await stripe.webhooks.constructEventAsync(raw, sig, secret);
        } catch (e) {
          return new Response(`Invalid signature: ${(e as Error).message}`, { status: 400 });
        }
        // idempotency
        const { error: dupErr } = await supabaseAdmin.from("billing_events")
          .insert([{ stripe_event_id: evt.id, type: evt.type, payload: evt as unknown as Record<string, unknown> }]);
        if (dupErr && dupErr.code === "23505") return new Response("ok", { status: 200 });

        try {
          switch (evt.type) {
            case "checkout.session.completed": {
              const session = evt.data.object as Stripe.Checkout.Session;
              if (session.subscription) {
                const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
                const sub = await stripe.subscriptions.retrieve(subId);
                if (!sub.metadata?.user_id && session.metadata?.user_id) {
                  sub.metadata = { ...sub.metadata, user_id: session.metadata.user_id, plan: session.metadata.plan ?? "" };
                }
                await syncSubscription(sub);
              }
              break;
            }
            case "customer.subscription.created":
            case "customer.subscription.updated":
            case "customer.subscription.deleted":
              await syncSubscription(evt.data.object as Stripe.Subscription);
              break;
          }
        } catch (e) {
          return new Response(`Handler error: ${(e as Error).message}`, { status: 500 });
        }
        return new Response("ok", { status: 200 });
      },
    },
  },
});