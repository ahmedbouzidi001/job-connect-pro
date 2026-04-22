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
import { Loader2, Sparkles } from "lucide-react";

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
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && user) navigate({ to: "/dashboard" });
  }, [user, authLoading, navigate]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "signin") {
        const { error } = await signIn(email, password);
        if (error) {
          toast.error(error);
        } else {
          toast.success("Welcome back");
          navigate({ to: "/dashboard" });
        }
      } else {
        const { error } = await signUp(email, password, fullName);
        if (error) {
          toast.error(error);
        } else {
          toast.success("Account created — you're in!");
          navigate({ to: "/dashboard" });
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4 py-32">
        <div className="w-full max-w-md">
          <div className="glass-panel rounded-3xl p-8 sm:p-10 relative overflow-hidden">
            <div className="absolute -top-24 -end-16 size-56 rounded-full bg-hyper-cyan/10 blur-[80px] pointer-events-none" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-hyper-cyan/30 bg-hyper-cyan/5 mb-5">
                <Sparkles className="size-3" style={{ color: "var(--hyper-cyan)" }} />
                <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "var(--hyper-cyan)" }}>
                  HireMe AI
                </span>
              </div>
              <h1 className="font-display text-3xl font-bold tracking-tighter mb-2">
                {mode === "signin" ? t("auth.signin.title") : t("auth.signup.title")}
              </h1>
              <p className="text-sm text-muted-foreground mb-8">
                {mode === "signin" ? t("auth.signin.subtitle") : t("auth.signup.subtitle")}
              </p>

              <form onSubmit={onSubmit} className="space-y-4">
                {mode === "signup" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="fullName">{t("auth.fullName")}</Label>
                    <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required autoComplete="name" />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="email">{t("auth.email")}</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">{t("auth.password")}</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
                    autoComplete={mode === "signin" ? "current-password" : "new-password"} />
                </div>

                <Button type="submit" disabled={submitting} className="w-full rounded-xl font-bold h-11 mt-2">
                  {submitting ? (
                    <><Loader2 className="size-4 me-2 animate-spin" />{t("auth.loading")}</>
                  ) : mode === "signin" ? t("auth.submit.signin") : t("auth.submit.signup")}
                </Button>
              </form>

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
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
