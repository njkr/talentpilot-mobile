import { createFileRoute, Link, Navigate, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, BriefcaseBusiness, FileText, Home, LineChart, UserRound, Zap } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { Logo, Splash } from "@/components/ui/tp";
import { cn } from "@/lib/utils";
import type { CreditBalance, UnreadCount } from "@/types/api";
import { NewAnalysisSheet, UpgradeSheet } from "@/components/GlobalSheets";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

const TABS = [
  { to: "/", label: "Home", icon: Home, exact: true },
  { to: "/resumes", label: "Resumes", icon: FileText },
  { to: "/jobs", label: "Jobs", icon: BriefcaseBusiness },
  { to: "/analyses", label: "Analyses", icon: LineChart },
  { to: "/me", label: "Me", icon: UserRound },
] as const;

const TITLES: Record<string, string> = {
  "/resumes": "Resumes",
  "/jobs": "Jobs",
  "/analyses": "Analyses",
  "/me": "Me",
};

/** RequireAuth + app shell. */
function AppLayout() {
  const { status } = useAuth();
  if (status === "loading") return <Splash />;
  if (status === "guest") return <Navigate to="/login" replace />;
  return <Shell />;
}

function Shell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const credits = useQuery({ queryKey: ["credits"], queryFn: () => api.get<CreditBalance>("/credits") });
  const unread = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => api.get<UnreadCount>("/notifications/unread-count"),
    refetchInterval: 10 * 60_000,
  });
  const count = unread.data?.count ?? 0;
  const title = TITLES[pathname];

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-background">
      <header className="pt-safe sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="flex h-14 items-center justify-between px-4">
          {title ? <h1 className="h2">{title}</h1> : <Logo size={28} />}
          <div className="flex items-center gap-1">
            <Link
              to="/billing"
              className="inline-flex h-9 items-center gap-1 rounded-full bg-accent px-3 text-sm font-semibold text-accent-foreground"
              aria-label="Credits"
            >
              <Zap className="h-4 w-4 fill-current" />
              {credits.data ? credits.data.balance.toLocaleString() : "—"}
            </Link>
            <Link
              to="/notifications"
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-full text-foreground hover:bg-accent"
              aria-label={count ? `${count} unread notifications` : "Notifications"}
            >
              <Bell className="h-5 w-5" />
              {count > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 pb-28 pt-4">
        <Outlet />
      </main>
      <UpgradeSheet />
      <NewAnalysisSheet />

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 mx-auto max-w-lg border-t border-border bg-card">
        <ul className="grid grid-cols-5">
          {TABS.map((t) => {
            const active = "exact" in t ? pathname === t.to : pathname.startsWith(t.to);
            const Icon = t.icon;
            return (
              <li key={t.to}>
                <Link
                  to={t.to}
                  className={cn(
                    "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <Icon className={cn("h-5 w-5", active && "stroke-[2.4]")} />
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
