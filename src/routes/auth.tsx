import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { toast } from "sonner";
import { CheckCircle2, Loader2, ShieldCheck, Sparkles, Zap, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const { t } = useI18n();
  const { user, signIn, signUp, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"candidate" | "recruiter">("candidate");
  const [submitting, setSubmitting] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSending, setForgotSending] = useState(false);
  const passwordChecks = [
    { label: "6+ caractères", valid: password.length >= 6 },
    { label: "1 chiffre", valid: /\d/.test(password) },
  ];

  useEffect(() => {
    if (!authLoading && user) navigate({ to: "/dashboard" });
  }, [user, authLoading, navigate]);

  const mapError = (msg: string): string => {
    const m = msg.toLowerCase();
    if (m.includes("invalid login")) return "Email ou mot de passe incorrect. Vérifiez vos identifiants ou réinitialisez votre mot de passe.";
    if (m.includes("already registered") || m.includes("user_already_exists")) return "Un compte existe déjà avec cet email — utilisez « Connexion » à la place.";
    if (m.includes("email not confirmed")) return "Email non confirmé. Cliquez sur « Mot de passe oublié » pour recevoir un nouveau lien.";
    if (m.includes("password") && m.includes("6")) return "Mot de passe trop court (minimum 6 caractères).";
    if (m.includes("rate limit")) return "Trop de tentatives. Patientez quelques secondes avant de réessayer.";
    return msg;
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "signin") {
        const { error } = await signIn(email, password);
        if (error) {
          toast.error(mapError(error));
        } else {
          toast.success("Welcome back");
          navigate({ to: "/dashboard" });
        }
      } else {
        const { error, needsEmailConfirmation } = await signUp(email, password, fullName, role);
        if (error) {
          const mapped = mapError(error);
          toast.error(mapped);
          if (error.toLowerCase().includes("already")) {
            setMode("signin");
          }
        } else {
          toast.success(needsEmailConfirmation ? "Compte créé — vérifiez votre email pour continuer" : "Compte créé — bienvenue !");
          if (!needsEmailConfirmation) navigate({ to: "/dashboard" });
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const onForgotPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotSending(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        toast.error(mapError(error.message));
      } else {
        toast.success("Email de réinitialisation envoyé. Vérifiez votre boîte de réception.");
        setForgotOpen(false);
        setForgotEmail("");
      }
    } finally {
      setForgotSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4 py-32">
        <div className="w-full max-w-6xl grid lg:grid-cols-[1.05fr_0.95fr] gap-6 items-stretch">
          <section className="glass-panel rounded-3xl p-8 sm:p-10 relative overflow-hidden hidden lg:flex flex-col justify-between min-h-[620px]">
            <div className="absolute -top-24 -start-16 size-56 rounded-full bg-hyper-cyan/10 blur-[80px] pointer-events-none" />
            <div className="absolute bottom-0 end-0 size-72 rounded-full bg-hyper-lime/10 blur-[120px] pointer-events-none" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-hyper-cyan/30 bg-hyper-cyan/5 mb-6">
                <Sparkles className="size-3.5 text-hyper-cyan" />
                <span className="text-[10px] font-bold tracking-[0.22em] uppercase text-hyper-cyan">HireMe AI</span>
              </div>
              <h1 className="font-display text-4xl xl:text-5xl font-bold tracking-tighter mb-4">Un accès plus simple à votre prochaine opportunité.</h1>
              <p className="text-base text-muted-foreground max-w-xl">Connexion rapide, espace sécurisé, et parcours optimisé pour candidats comme recruteurs.</p>
            </div>
            <div className="relative grid gap-3">
              {[
                { icon: Zap, title: "Entrée rapide", text: "Accès fluide au tableau de bord, au profil CV et aux offres ciblées." },
                { icon: ShieldCheck, title: "Compte protégé", text: "Vérification email et session sécurisée pour un usage professionnel." },
                { icon: CheckCircle2, title: "Parcours guidé", text: "Le système adapte automatiquement l’expérience selon votre activité." },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="rounded-2xl border border-border/70 bg-background/40 px-4 py-4 backdrop-blur-sm">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-xl border border-border/80 bg-background/70 p-2">
                        <Icon className="size-4 text-hyper-cyan" />
                      </div>
                      <div>
                        <p className="text-sm font-bold mb-1">{item.title}</p>
                        <p className="text-sm text-muted-foreground">{item.text}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="glass-panel rounded-3xl p-8 sm:p-10 relative overflow-hidden">
            <div className="absolute -top-24 -end-16 size-56 rounded-full bg-hyper-cyan/10 blur-[80px] pointer-events-none" />
            <div className="relative">
              <div className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-background/60 p-1 mb-6 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  className={`rounded-full px-4 py-2 transition-colors ${mode === "signin" ? "bg-[color:var(--hyper-cyan)] text-black" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Connexion
                </button>
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className={`rounded-full px-4 py-2 transition-colors ${mode === "signup" ? "bg-[color:var(--hyper-lime)] text-black" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Inscription
                </button>
              </div>

              <h2 className="font-display text-3xl font-bold tracking-tighter mb-2">
                {mode === "signin" ? t("auth.signin.title") : t("auth.signup.title")}
              </h2>
              <p className="text-sm text-muted-foreground mb-8">
                {mode === "signin" ? t("auth.signin.subtitle") : t("auth.signup.subtitle")}
              </p>

              <form onSubmit={onSubmit} className="space-y-4">
                {mode === "signup" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="fullName">{t("auth.fullName")}</Label>
                    <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required autoComplete="name" placeholder="Votre nom complet" />
                  </div>
                )}
                {mode === "signup" && (
                  <div className="space-y-1.5">
                    <Label>Je suis</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => setRole("candidate")} className={`rounded-xl border px-4 py-3 text-sm font-bold transition-colors ${role === "candidate" ? "border-[color:var(--hyper-cyan)] bg-[color:var(--hyper-cyan)]/10 text-foreground" : "border-border/70 text-muted-foreground hover:text-foreground"}`}>
                        🎯 Candidat
                        <p className="text-[10px] font-normal text-muted-foreground mt-0.5">Recherche d'emploi</p>
                      </button>
                      <button type="button" onClick={() => setRole("recruiter")} className={`rounded-xl border px-4 py-3 text-sm font-bold transition-colors ${role === "recruiter" ? "border-[color:var(--hyper-lime)] bg-[color:var(--hyper-lime)]/10 text-foreground" : "border-border/70 text-muted-foreground hover:text-foreground"}`}>
                        💼 Recruteur
                        <p className="text-[10px] font-normal text-muted-foreground mt-0.5">Publier des offres</p>
                      </button>
                    </div>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="email">{t("auth.email")}</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="nom@entreprise.com" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="password">{t("auth.password")}</Label>
                    {mode === "signin" && (
                      <button type="button" onClick={() => { setForgotOpen(true); setForgotEmail(email); }} className="text-[11px] text-hyper-cyan hover:underline font-bold">
                        Mot de passe oublié ?
                      </button>
                    )}
                  </div>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
                    autoComplete={mode === "signin" ? "current-password" : "new-password"} placeholder="••••••••" />
                </div>

                {mode === "signup" && (
                  <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground mb-3">Qualité du mot de passe</p>
                    <div className="grid gap-2">
                      {passwordChecks.map((item) => (
                        <div key={item.label} className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className={`size-4 ${item.valid ? "text-hyper-lime" : "text-muted-foreground/50"}`} />
                          <span className={item.valid ? "text-foreground" : "text-muted-foreground"}>{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Button type="submit" disabled={submitting} className="w-full rounded-xl font-bold h-11 mt-2">
                  {submitting ? (
                    <><Loader2 className="size-4 me-2 animate-spin" />{t("auth.loading")}</>
                  ) : mode === "signin" ? t("auth.submit.signin") : t("auth.submit.signup")}
                </Button>
              </form>

              <p className="mt-4 text-xs text-muted-foreground">{mode === "signin" ? "Votre espace s’ouvre automatiquement après connexion." : "Après inscription, un email de vérification peut être demandé selon votre configuration."}</p>

              <button
                type="button"
                onClick={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
                className="mt-6 w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {mode === "signin" ? t("auth.toggle.toSignup") : t("auth.toggle.toSignin")}
              </button>

              <div className="mt-6 text-center">
                <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">← Home</Link>
              </div>

              {forgotOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setForgotOpen(false)}>
                  <div className="glass-panel rounded-3xl p-6 sm:p-8 max-w-md w-full relative" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="rounded-xl border border-border/80 bg-background/70 p-2">
                        <KeyRound className="size-5 text-hyper-cyan" />
                      </div>
                      <div>
                        <h3 className="font-display text-xl font-bold tracking-tight">Réinitialiser le mot de passe</h3>
                        <p className="text-xs text-muted-foreground">Recevez un lien sécurisé par email</p>
                      </div>
                    </div>
                    <form onSubmit={onForgotPassword} className="space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="forgot-email">Email</Label>
                        <Input id="forgot-email" type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required placeholder="nom@entreprise.com" />
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button type="button" variant="outline" className="flex-1 rounded-xl" onClick={() => setForgotOpen(false)}>Annuler</Button>
                        <Button type="submit" disabled={forgotSending} className="flex-1 rounded-xl font-bold">
                          {forgotSending ? <><Loader2 className="size-4 me-2 animate-spin" />Envoi…</> : "Envoyer le lien"}
                        </Button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
