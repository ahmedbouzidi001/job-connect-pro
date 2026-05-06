import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { LangToggle } from "./LangToggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { LogOut, LayoutDashboard, Crown, Search, FileText, Wand2, GraduationCap, Linkedin, Briefcase, MessageSquare, User as UserIcon, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function Navbar() {
  const { user, signOut } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [detectedView, setDetectedView] = useState<"candidate" | "recruiter">("candidate");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const isRecruiter = (data ?? []).some(r => r.role === "recruiter");
      setDetectedView(isRecruiter ? "recruiter" : "candidate");
    })();
  }, [user]);

  const view = detectedView;

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  const candidateLinks = [
    { to: "/jobs", label: "Offres", icon: Search },
    { to: "/cv", label: "CV IA", icon: FileText },
    { to: "/generator", label: "Générateur", icon: Wand2 },
    { to: "/skills", label: "Skills", icon: GraduationCap },
    { to: "/linkedin", label: "LinkedIn", icon: Linkedin },
    { to: "/applications", label: "Candidatures", icon: Briefcase },
  ] as const;

  const recruiterLinks = [
    { to: "/recruiter-jobs", label: "Mes offres", icon: Briefcase },
    { to: "/recruiter", label: "Candidats", icon: Users },
    { to: "/jobs", label: "Veille marché", icon: Search },
  ] as const;

  const sharedLinks = [
    { to: "/messages", label: "Messages", icon: MessageSquare },
    { to: "/profile", label: "Profil", icon: UserIcon },
    { to: "/pricing", label: "Premium", icon: Crown },
  ] as const;

  const links = view === "recruiter" ? recruiterLinks : candidateLinks;

  return (
    <nav className="fixed top-0 inset-x-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <Logo />
        <div className="flex items-center gap-2">
          <LangToggle />
          <ThemeToggle />
          {user ? (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link to="/dashboard"><LayoutDashboard className="size-4 me-1.5" />{t("nav.dashboard")}</Link>
              </Button>
              <Button onClick={handleSignOut} variant="outline" size="sm">
                <LogOut className="size-4 me-1.5" />{t("nav.signout")}
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link to="/auth">{t("nav.signin")}</Link>
              </Button>
              <Button asChild size="sm" className="rounded-full font-bold">
                <Link to="/auth">{t("nav.signup")}</Link>
              </Button>
            </>
          )}
        </div>
      </div>
      {user && (
        <div className="border-t border-border/60 bg-gradient-to-r from-background/95 via-background/80 to-background/95 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            {links.map((l) => {
              const Icon = l.icon;
              return (
                <Link
                  key={l.to}
                  to={l.to}
                  className="group relative shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-muted-foreground border border-transparent hover:text-foreground hover:bg-foreground/5 hover:border-border/60 transition-all whitespace-nowrap"
                  activeProps={{ className: "text-black bg-[color:var(--hyper-cyan)] border-[color:var(--hyper-cyan)] shadow-[0_4px_18px_-6px_color-mix(in_oklab,var(--hyper-cyan)_70%,transparent)]" }}
                >
                  <Icon className="size-3.5" />{l.label}
                </Link>
              );
            })}
            <div className="mx-1.5 h-5 w-px bg-border/70 shrink-0" />
            {sharedLinks.map((l) => {
              const Icon = l.icon;
              return (
                <Link
                  key={l.to}
                  to={l.to}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-muted-foreground border border-transparent hover:text-foreground hover:bg-foreground/5 hover:border-border/60 transition-all whitespace-nowrap"
                  activeProps={{ className: "text-black bg-[color:var(--hyper-lime)] border-[color:var(--hyper-lime)] shadow-[0_4px_18px_-6px_color-mix(in_oklab,var(--hyper-lime)_70%,transparent)]" }}
                >
                  <Icon className="size-3.5" />{l.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
