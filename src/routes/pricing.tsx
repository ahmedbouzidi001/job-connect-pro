import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Loader2, Check, Crown, Sparkles } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { setPremium, getMyProfile } from "@/server/profile.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/pricing")({ component: PricingPage });

function PricingPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const fetchProfile = useServerFn(getMyProfile);
  const togglePremium = useServerFn(setPremium);

  const [isPremium, setIsPremium] = useState<boolean | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [user, loading, navigate]);
  useEffect(() => {
    if (!user) return;
    fetchProfile({ data: undefined as unknown as never }).then(r => {
      const p = (r as { profile: { is_premium?: boolean } | null }).profile;
      setIsPremium(Boolean(p?.is_premium));
    });
  }, [user, fetchProfile]);

  const activate = async (enable: boolean) => {
    setWorking(true);
    try {
      await togglePremium({ data: { enable }});
      setIsPremium(enable);
      toast.success(enable ? "Premium activé (essai gratuit)" : "Premium désactivé");
    } catch (e) { toast.error((e as Error).message); }
    finally { setWorking(false); }
  };

  if (loading || !user) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="size-6 animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="pt-24 pb-16 max-w-5xl mx-auto px-4 sm:px-6">
        <header className="text-center mb-10">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[color:var(--hyper-cyan)] mb-3"><Crown className="size-3.5" /> Plans HireMe</div>
          <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tighter">Choisis ton plan</h1>
          <p className="text-sm text-muted-foreground mt-3 max-w-xl mx-auto">Démarre gratuit. Passe Premium pour débloquer l'auto-apply, les exports illimités et la priorité recruteur.</p>
        </header>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="glass-panel rounded-3xl p-8">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Free</div>
            <div className="font-display text-4xl font-bold mb-1">0€</div>
            <p className="text-xs text-muted-foreground mb-6">Pour toujours</p>
            <ul className="space-y-2 text-sm mb-8">
              <Bullet>Analyse CV illimitée</Bullet>
              <Bullet>5 générations CV+LM / mois</Bullet>
              <Bullet>Recherche d'offres multi-pays</Bullet>
              <Bullet>Skills Hub (certifs gratuites)</Bullet>
              <Bullet>Visibilité recruteur basique</Bullet>
            </ul>
            <Button disabled variant="outline" className="w-full rounded-xl">Plan actuel</Button>
          </div>

          <div className="glass-panel rounded-3xl p-8 border-[color:var(--hyper-cyan)]/40 relative overflow-hidden" style={{ background: "linear-gradient(135deg, color-mix(in oklab, var(--hyper-cyan) 10%, transparent), color-mix(in oklab, var(--hyper-lime) 6%, transparent))" }}>
            <div className="absolute top-3 right-3 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[color:var(--hyper-cyan)] text-black">Recommandé</div>
            <div className="text-xs font-bold uppercase tracking-wider text-[color:var(--hyper-cyan)] mb-2 inline-flex items-center gap-1"><Crown className="size-3" /> Premium</div>
            <div className="font-display text-4xl font-bold mb-1">9,99€<span className="text-base text-muted-foreground">/mois</span></div>
            <p className="text-xs text-muted-foreground mb-6">Annulation à tout moment</p>
            <ul className="space-y-2 text-sm mb-8">
              <Bullet>Tout du plan Free</Bullet>
              <Bullet><strong>Auto-apply</strong> : postule automatiquement aux offres matchées</Bullet>
              <Bullet>Générations CV+LM <strong>illimitées</strong></Bullet>
              <Bullet>Visibilité recruteur prioritaire</Bullet>
              <Bullet>Modèles CV exclusifs</Bullet>
              <Bullet>Coaching IA personnalisé</Bullet>
              <Bullet>Support prioritaire</Bullet>
            </ul>
            {isPremium ? (
              <Button onClick={() => activate(false)} disabled={working} variant="outline" className="w-full rounded-xl font-bold">
                {working ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
                Désactiver Premium
              </Button>
            ) : (
              <Button onClick={() => activate(true)} disabled={working} className="w-full rounded-xl font-bold h-12 bg-[color:var(--hyper-cyan)] text-black hover:bg-[color:var(--hyper-cyan)]/90">
                {working ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Sparkles className="size-4 mr-2" />}
                Démarrer l'essai gratuit (30 jours)
              </Button>
            )}
            <p className="text-[10px] text-muted-foreground text-center mt-3">Paiement à brancher prochainement (Stripe)</p>
          </div>
        </div>
      </main>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return <li className="flex items-start gap-2"><Check className="size-4 text-[color:var(--hyper-lime)] shrink-0 mt-0.5" /><span>{children}</span></li>;
}