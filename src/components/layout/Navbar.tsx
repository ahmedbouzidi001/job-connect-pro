import { Link, useNavigate } from "@tanstack/react-router";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { LangToggle } from "./LangToggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { LogOut, LayoutDashboard, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
            <div className="hidden md:flex items-center gap-5 text-sm font-medium text-muted-foreground">
              <Link to="/jobs" className="hover:text-foreground transition-colors" activeProps={{ className: "text-foreground" }}>Offres</Link>
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex items-center gap-1 hover:text-foreground transition-colors outline-none">Candidat <ChevronDown className="size-3" /></DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem asChild><Link to="/cv">CV IA</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/generator">Générateur CV+LM</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/skills">Skills Hub</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/linkedin">LinkedIn</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/applications">Mes candidatures</Link></DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Link to="/recruiter" className="hover:text-foreground transition-colors" activeProps={{ className: "text-foreground" }}>Recruteur</Link>
              <Link to="/messages" className="hover:text-foreground transition-colors" activeProps={{ className: "text-foreground" }}>Messages</Link>
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
