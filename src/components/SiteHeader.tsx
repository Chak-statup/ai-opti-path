import { Link } from "@tanstack/react-router";
import { Activity, LineChart } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Activity className="h-4 w-4" />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">
            AI Strategy Tool
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          <NavLink to="/causal" icon={<Network className="h-4 w-4" />}>
            Causal model
          </NavLink>
          <NavLink to="/abm" icon={<Activity className="h-4 w-4" />}>
            Agent model
          </NavLink>
          <div className="ml-2">
            <ThemeToggle />
          </div>
        </nav>
      </div>
    </header>
  );
}

function NavLink({
  to,
  icon,
  children,
}: {
  to: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      activeProps={{ className: "bg-secondary text-foreground" }}
      inactiveProps={{ className: "text-muted-foreground hover:text-foreground" }}
      className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
    >
      {icon}
      <span className="hidden sm:inline">{children}</span>
    </Link>
  );
}
