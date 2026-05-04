import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { LangToggle } from "./LangToggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { LogOut, LayoutDashboard, Crown, Search, FileText, Wand2, GraduationCap, Linkedin, Briefcase, MessageSquare, User as UserIcon, Users, UserCircle2, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function Navbar() {
  const { user, signOut } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [view, setView] = useState<"candidate" | "recruiter">("candidate");

  useEffect(() => {
    if (!user) return;
    // Restaure préférence locale, sinon auto-détecte selon activité
    const saved = typeof window !== "undefined" ? localStorage.getItem("hireme:view") : null;
    if (saved === "candidate" || saved === "recruiter") { setView(saved); return; }
    (async () => {
      const [roles, jobs] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("jobs").select("id", { count: "exact", head: true }).eq("posted_by", user.id),
      ]);
      const isRecruiter = (roles.data ?? []).some(r => r.role === "recruiter") || (jobs.count ?? 0) > 0;
      setView(isRecruiter ? "recruiter" : "candidate");
    })();
  }, [user]);

  const switchView = (v: "candidate" | "recruiter") => {
    setView(v);
    if (typeof window !== "undefined") localStorage.setItem("hireme:view", v);
  };

  const handleSignOut = async () => {
    await signOut();
    if (typeof window !== "undefined") localStorage.removeItem("hireme:view");
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

  const links = view === "recruiter" ? recruiterLinks : candidateLinks;

  return (
    <nav className="fixed top-0 inset-x-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <div className="flex items-center gap-5 min-w-0">
          <Logo />
          {user && (
            <div className="hidden lg:flex items-center gap-1 text-xs font-semibold text-muted-foreground overflow-x-auto">
              {links.map(l => {
                const Icon = l.icon;
                return (
                  <Link key={l.to} to={l.to} className="px-2.5 py-1.5 rounded-full hover:bg-foreground/5 hover:text-foreground transition-colors inline-flex items-center gap-1.5 whitespace-nowrap" activeProps={{ className: "bg-foreground/10 text-foreground" }}>
                    <Icon className="size-3.5" />{l.label}
                  </Link>
                );
              })}
              <Link to="/messages" className="px-2.5 py-1.5 rounded-full hover:bg-foreground/5 hover:text-foreground transition-colors inline-flex items-center gap-1.5" activeProps={{ className: "bg-foreground/10 text-foreground" }}><MessageSquare className="size-3.5" />Messages</Link>
              <Link to="/profile" className="px-2.5 py-1.5 rounded-full hover:bg-foreground/5 hover:text-foreground transition-colors inline-flex items-center gap-1.5" activeProps={{ className: "bg-foreground/10 text-foreground" }}><UserIcon className="size-3.5" />Profil</Link>
              <Link to="/pricing" className="px-2.5 py-1.5 rounded-full hover:bg-foreground/5 hover:text-foreground transition-colors inline-flex items-center gap-1.5" activeProps={{ className: "bg-foreground/10 text-foreground" }}><Crown className="size-3.5" />Premium</Link>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {user && (
            <div className="hidden md:inline-flex items-center rounded-full border border-border bg-background/60 p-0.5 text-[11px] font-bold">
              <button onClick={() => switchView("candidate")} className={`px-2.5 py-1 rounded-full inline-flex items-center gap-1 transition-colors ${view === "candidate" ? "bg-[color:var(--hyper-cyan)] text-black" : "text-muted-foreground hover:text-foreground"}`}>
                <UserCircle2 className="size-3.5" /> Candidat
              </button>
              <button onClick={() => switchView("recruiter")} className={`px-2.5 py-1 rounded-full inline-flex items-center gap-1 transition-colors ${view === "recruiter" ? "bg-[color:var(--hyper-lime)] text-black" : "text-muted-foreground hover:text-foreground"}`}>
                <Building2 className="size-3.5" /> Recruteur
              </button>
            </div>
          )}
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
        <div className="lg:hidden border-t border-border/60 bg-background/80 overflow-x-auto">
          <div className="max-w-7xl mx-auto px-4 py-1.5 flex items-center gap-1 text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
            {links.map(l => {
              const Icon = l.icon;
              return (
                <Link key={l.to} to={l.to} className="px-2 py-1 rounded-full inline-flex items-center gap-1" activeProps={{ className: "bg-foreground/10 text-foreground" }}>
                  <Icon className="size-3" />{l.label}
                </Link>
              );
            })}
            <Link to="/messages" className="px-2 py-1 rounded-full inline-flex items-center gap-1" activeProps={{ className: "bg-foreground/10 text-foreground" }}><MessageSquare className="size-3" />Messages</Link>
            <Link to="/profile" className="px-2 py-1 rounded-full inline-flex items-center gap-1" activeProps={{ className: "bg-foreground/10 text-foreground" }}><UserIcon className="size-3" />Profil</Link>
          </div>
        </div>
      )}
    </nav>
  );
}
