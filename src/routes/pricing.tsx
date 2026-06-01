import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Loader2, Check, Crown, Sparkles, Building2, Settings2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { createCheckoutSession, createBillingPortalSession, getBillingStatus } from "@/server/billing.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/pricing")({ component: PricingPage });

type Billing = { plan_tier: string | null; is_premium: boolean | null; premium_until: string | null; subscription_status: string | null; stripe_subscription_id: string | null };

function PricingPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const checkout = useServerFn(createCheckoutSession);
  const portal = useServerFn(createBillingPortalSession);
  const fetchStatus = useServerFn(getBillingStatus);

  const [billing, setBilling] = useState<Billing | null>(null);
  const [working, setWorking] = useState<string | null>(null);

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [user, loading, navigate]);
  useEffect(() => {
    if (!user) return;
    fetchStatus().then(r => setBilling((r as { billing: Billing }).billing)).catch(() => {});
    const url = new URL(window.location.href);
    const status = url.searchParams.get("status");
    if (status === "success") toast.success("Paiement validé — ton abonnement s'active dans quelques secondes.");
    if (status === "cancelled") toast.info("Paiement annulé.");
  }, [user, fetchStatus]);

  const subscribe = async (plan: "pro" | "business") => {
    setWorking(plan);
    try {
      const r = await checkout({ data: { plan }}) as { url: string | null };
      if (!r.url) throw new Error("URL Stripe manquante");
      window.location.href = r.url;
    } catch (e) { toast.error((e as Error).message); setWorking(null); }
  };
  const manage = async () => {
    setWorking("portal");
    try {
      const r = await portal() as { url: string };
      window.location.href = r.url;
    } catch (e) { toast.error((e as Error).message); setWorking(null); }
  };

  if (loading || !user) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="size-6 animate-spin" /></div>;

  const tier = (billing?.plan_tier ?? "free") as "free" | "pro" | "business";
  const isFree = tier === "free";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="pt-24 pb-16 max-w-6xl mx-auto px-4 sm:px-6">
        <header className="text-center mb-10">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[color:var(--hyper-cyan)] mb-3"><Crown className="size-3.5" /> Plans HireMe</div>
          <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tighter">Choisis ton plan</h1>
          <p className="text-sm text-muted-foreground mt-3 max-w-xl mx-auto">Démarre gratuit. Passe Pro pour l'auto-candidature, ou Business pour publier des offres illimitées.</p>
          {!isFree && (
            <div className="mt-4 inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-[color:var(--hyper-lime)]/10 text-[color:var(--hyper-lime)] border border-[color:var(--hyper-lime)]/30">
              <Check className="size-3.5" /> Plan actif : <strong className="uppercase">{tier}</strong>
              {billing?.premium_until && <span className="text-muted-foreground">· renouvellement {new Date(billing.premium_until).toLocaleDateString()}</span>}
            </div>
          )}
        </header>

        <div className="grid md:grid-cols-3 gap-6">
          <PlanCard
            title="Free" price="0€" period="Pour toujours" tone="muted"
            active={tier === "free"}
            bullets={["Analyse CV illimitée", "5 générations CV+LM / mois", "Recherche d'offres multi-pays", "Skills Hub", "Visibilité recruteur basique"]}
            cta={isFree ? <Button disabled variant="outline" className="w-full rounded-xl">Plan actuel</Button>
              : <Button onClick={manage} disabled={!!working} variant="outline" className="w-full rounded-xl"><Settings2 className="size-4 mr-2" /> Gérer / rétrograder</Button>}
          />

          <PlanCard
            title="Pro" price="9,99€" period="/ mois" tone="cyan" highlight
            active={tier === "pro"}
            bullets={[
              "Tout du plan Free",
              "Auto-candidature pour offres ≥ 80%",
              "Générations CV+LM illimitées",
              "Tous les templates CV (Modern, Latex, Sidebar...)",
              "Alertes illimitées + brouillons auto",
              "Visibilité recruteur prioritaire",
              "Support prioritaire",
            ]}
            cta={tier === "pro"
              ? <Button onClick={manage} disabled={!!working} variant="outline" className="w-full rounded-xl font-bold">{working === "portal" ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Settings2 className="size-4 mr-2" />} Gérer mon abonnement</Button>
              : <Button onClick={() => subscribe("pro")} disabled={!!working} className="w-full rounded-xl font-bold h-12 bg-[color:var(--hyper-cyan)] text-black hover:bg-[color:var(--hyper-cyan)]/90">
                  {working === "pro" ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Sparkles className="size-4 mr-2" />} {tier === "business" ? "Passer à Pro" : "Souscrire Pro"}
                </Button>}
          />

          <PlanCard
            title="Business" price="24,99€" period="/ mois" tone="lime" icon={Building2}
            active={tier === "business"}
            bullets={[
              "Tout du plan Pro",
              "Publier offres illimitées (recruteur)",
              "Dashboard candidats avec scoring IA",
              "Multi-utilisateurs (équipe)",
              "Branding personnalisé sur offres",
              "API & exports avancés",
            ]}
            cta={tier === "business"
              ? <Button onClick={manage} disabled={!!working} variant="outline" className="w-full rounded-xl font-bold">{working === "portal" ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Settings2 className="size-4 mr-2" />} Gérer mon abonnement</Button>
              : <Button onClick={() => subscribe("business")} disabled={!!working} className="w-full rounded-xl font-bold h-12 bg-[color:var(--hyper-lime)] text-black hover:bg-[color:var(--hyper-lime)]/90">
                  {working === "business" ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Building2 className="size-4 mr-2" />} Souscrire Business
                </Button>}
          />
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8">Paiement sécurisé via Stripe · Annulation à tout moment · TVA incluse selon ton pays</p>
      </main>
    </div>
  );
}

function PlanCard({ title, price, period, tone, bullets, cta, highlight, active, icon: Icon }:
  { title: string; price: string; period: string; tone: "muted" | "cyan" | "lime"; bullets: string[]; cta: React.ReactNode; highlight?: boolean; active?: boolean; icon?: typeof Crown }) {
  const color = tone === "cyan" ? "var(--hyper-cyan)" : tone === "lime" ? "var(--hyper-lime)" : "var(--muted-foreground)";
  return (
    <div className={`glass-panel rounded-3xl p-7 relative overflow-hidden ${active ? "ring-2 ring-[color:var(--hyper-lime)]/60" : ""}`}
      style={highlight ? { background: "linear-gradient(135deg, color-mix(in oklab, var(--hyper-cyan) 10%, transparent), color-mix(in oklab, var(--hyper-lime) 6%, transparent))", borderColor: "color-mix(in oklab, var(--hyper-cyan) 40%, transparent)" } : {}}>
      {highlight && <div className="absolute top-3 right-3 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[color:var(--hyper-cyan)] text-black">Recommandé</div>}
      {active && <div className="absolute top-3 left-3 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[color:var(--hyper-lime)] text-black">Actif</div>}
      <div className="text-xs font-bold uppercase tracking-wider mb-2 inline-flex items-center gap-1" style={{ color }}>
        {Icon ? <Icon className="size-3" /> : <Crown className="size-3" />} {title}
      </div>
      <div className="font-display text-4xl font-bold mb-1">{price}<span className="text-base text-muted-foreground font-normal">{period}</span></div>
      <p className="text-xs text-muted-foreground mb-6">&nbsp;</p>
      <ul className="space-y-2 text-sm mb-8">
        {bullets.map((b, i) => <li key={i} className="flex items-start gap-2"><Check className="size-4 text-[color:var(--hyper-lime)] shrink-0 mt-0.5" /><span>{b}</span></li>)}
      </ul>
      {cta}
    </div>
  );
}