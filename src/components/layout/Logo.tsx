import { Link } from "@tanstack/react-router";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link to="/" className={`font-display font-bold text-2xl tracking-tighter text-foreground ${className}`}>
      HIRE<span className="text-hyper-cyan">ME</span>
    </Link>
  );
}
