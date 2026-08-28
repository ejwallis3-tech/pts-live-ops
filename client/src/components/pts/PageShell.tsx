import { Link, useLocation } from "wouter";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/branch/a", label: "Branch A" },
  { href: "/branch/b", label: "Branch B" },
  { href: "/branch/c", label: "Branch C" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/control", label: "Facilitator" },
];

export function PageShell({
  children,
  title,
  subtitle,
  wide = false,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  wide?: boolean;
}) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 shrink-0" data-testid="link-home">
            <Logo className="h-7 w-7 text-sidebar-primary" />
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight">Passionate to Serve</div>
              <div className="text-[11px] text-sidebar-foreground/60">Live simulation</div>
            </div>
          </Link>
          <nav className="flex items-center gap-1 overflow-x-auto" aria-label="Main navigation">
            {NAV_ITEMS.map((item) => {
              const active = location === item.href || (item.href !== "/" && location.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-testid={`link-nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap hover-elevate active-elevate-2 border border-transparent",
                    active && "bg-sidebar-accent text-sidebar-accent-foreground"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <div className={cn("mx-auto px-4 sm:px-6 py-6 sm:py-8", wide ? "max-w-6xl" : "max-w-3xl")}>
          <div className="mb-6">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
