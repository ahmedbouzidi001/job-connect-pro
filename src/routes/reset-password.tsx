import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Supabase parses the recovery hash into a session automatically
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { toast.error("Le mot de passe doit contenir au moins 6 caractères."); return; }
    if (password !== confirm) { toast.error("Les mots de passe ne correspondent pas."); return; }
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Mot de passe mis à jour. Vous êtes connecté.");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4 py-32">
        <div className="glass-panel rounded-3xl p-8 sm:p-10 max-w-md w-full">
          <div className="flex items-center gap-3 mb-6">
            <div className="rounded-xl border border-border/80 bg-background/70 p-2">
              <KeyRound className="size-5 text-hyper-cyan" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight">Nouveau mot de passe</h1>
              <p className="text-xs text-muted-foreground">Choisissez un mot de passe sécurisé</p>
            </div>
          </div>
          {!ready ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
              <Loader2 className="size-4 animate-spin" />
              Validation du lien de réinitialisation…
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="new-password">Nouveau mot de passe</Label>
                <Input id="new-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="••••••••" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Confirmer</Label>
                <Input id="confirm-password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} placeholder="••••••••" />
              </div>
              <div className="rounded-xl border border-border/70 bg-background/40 p-3 flex items-start gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="size-4 text-hyper-lime flex-shrink-0 mt-0.5" />
                Votre nouveau mot de passe sera immédiatement actif et vous serez redirigé vers votre espace.
              </div>
              <Button type="submit" disabled={submitting} className="w-full rounded-xl font-bold h-11">
                {submitting ? <><Loader2 className="size-4 me-2 animate-spin" />Mise à jour…</> : "Mettre à jour le mot de passe"}
              </Button>
            </form>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}