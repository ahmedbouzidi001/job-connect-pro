import { Link, useNavigate } from "@tanstack/react-router";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { LangToggle } from "./LangToggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { LogOut, LayoutDashboard } from "lucide-react";

export function Navbar() {
  const { user, signOut } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  return (
    <nav className="fixed top-0 inset-x-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <Logo />
          {user && (
            <div className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
              <Link to="/jobs" className="hover:text-foreground transition-colors" activeProps={{ className: "text-foreground" }}>Recherche</Link>
              <Link to="/cv" className="hover:text-foreground transition-colors" activeProps={{ className: "text-foreground" }}>CV IA</Link>
              <Link to="/generator" className="hover:text-foreground transition-colors" activeProps={{ className: "text-foreground" }}>Générateur</Link>
              <Link to="/linkedin" className="hover:text-foreground transition-colors" activeProps={{ className: "text-foreground" }}>LinkedIn</Link>
              <Link to="/applications" className="hover:text-foreground transition-colors" activeProps={{ className: "text-foreground" }}>Candidatures</Link>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
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
    </nav>
  );
}
