import { createFileRoute, Link, Navigate, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, BriefcaseBusiness, FileText, Home, LineChart, Plus, Upload, UserRound, Zap } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { motion } from "framer-motion";
import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { BottomSheet } from "@/components/ui/tp";
import { openNewAnalysis } from "@/lib/stores";
import { haptic } from "@/lib/native";
import { LaunchScreen, MotionLogo, useLaunchGate } from "@/components/motion";
import { cn } from "@/lib/utils";
import type { CreditBalance, UnreadCount } from "@/types/api";
import { NewAnalysisSheet, UpgradeSheet } from "@/components/GlobalSheets";
import { Unreachable } from "@/components/Unreachable";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

const TABS = [
  { to: "/", label: "Home", icon: Home, exact: true },
  { to: "/resumes", label: "Resumes", icon: FileText },
  { to: "/jobs", label: "Jobs", icon: BriefcaseBusiness },
  { to: "/analyses", label: "Analyses", icon: LineChart },
] as const;

const TITLES: Record<string, string> = {
  "/resumes": "Resumes",
  "/jobs": "Jobs",
  "/analyses": "Analyses",
  "/me": "Me",
};

const TAB_ROOTS = new Set(["/", "/resumes", "/jobs", "/analyses", "/me"]);

/** Compacts large balances for the top bar pill, e.g. 12.3k. */
const fmtBalance = (n: number) =>
  n >= 10_000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : n.toLocaleString();

/** RequireAuth + app shell. */
function AppLayout() {
  const { status } = useAuth();
  const phase = useLaunchGate(status === "loading");
  if (phase !== "done") return <LaunchScreen phase={phase} />;
  if (status === "guest") return <Navigate to="/login" replace />;
  if (status === "unreachable") return <Unreachable />;
  return <Shell />;
}

function Shell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const credits = useQuery({
    queryKey: ["credits"],
    queryFn: () => api.get<CreditBalance>("/credits"),
  });
  const unread = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => api.get<UnreadCount>("/notifications/unread-count"),
    refetchInterval: 10 * 60_000,
  });
  const count = unread.data?.count ?? 0;
  const { user } = useAuth();
  const [quick, setQuick] = useState(false);
  const nav = useNavigate();
  const title = TITLES[pathname];
  const showTopBar = TAB_ROOTS.has(pathname);
  const tabRoot = showTopBar;
  // Going "back" = moving to a shallower path than before.
  const prev = useRef(pathname);
  const depth = (p: string) => p.split("/").filter(Boolean).length;
  const back = depth(pathname) < depth(prev.current);
  if (prev.current !== pathname) prev.current = pathname;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-background">
      {showTopBar && (
        <header className="pt-safe sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur">
          <div className="flex h-14 items-center justify-between px-4">
            {title ? <h1 className="h2">{title}</h1> : <MotionLogo size={28} />}
            <div className="flex items-center gap-1">
              <Link
                to="/billing"
                className="inline-flex h-9 items-center gap-1 rounded-full bg-accent px-3 text-sm font-semibold text-accent-foreground"
                aria-label="Credits"
              >
                <Zap className="h-4 w-4 fill-current" />
                {credits.data ? fmtBalance(credits.data.balance) : "—"}
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
      )}

      <main className="app-scroll-bottom flex-1 px-4 pt-4">
        <motion.div
          key={pathname}
          initial={tabRoot ? { opacity: 0 } : { opacity: 0, x: back ? -24 : 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: tabRoot ? 0.15 : 0.25, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <Outlet />
        </motion.div>
      </main>
      <BottomSheet open={quick} onClose={() => setQuick(false)} title="Quick actions">
        <div className="-mx-2 flex flex-col">
          {[
            { label: "Upload resume", icon: Upload, go: () => nav({ to: "/resumes", search: { upload: true } }) },
            { label: "Add job", icon: BriefcaseBusiness, go: () => nav({ to: "/jobs/new" }) },
            { label: "New analysis", icon: LineChart, go: () => openNewAnalysis() },
          ].map((a) => (
            <button
              key={a.label}
              onClick={() => {
                setQuick(false);
                void a.go();
              }}
              className="flex min-h-14 items-center gap-3 rounded-lg px-3 text-left text-base font-medium hover:bg-accent"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                <a.icon className="h-5 w-5" />
              </span>
              {a.label}
            </button>
          ))}
        </div>
      </BottomSheet>
      <UpgradeSheet />
      <NewAnalysisSheet />

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 mx-auto max-w-lg border-t border-border bg-card">
        <ul className="grid grid-cols-5 items-end">
          {[TABS[0], TABS[1], null, TABS[2], TABS[3]].map((t) => {
            if (!t)
              return (
                <li key="plus" className="flex justify-center">
                  <button
                    onClick={() => {
                      haptic("light");
                      setQuick(true);
                    }}
                    aria-label="Quick actions"
                    className="-mt-6 mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background hover:bg-primary-hover focus-visible:ring-primary"
                  >
                    <Plus className="h-7 w-7" />
                  </button>
                </li>
              );
            const active = "exact" in t ? pathname === t.to : pathname.startsWith(t.to);
            const Icon = t.icon;
            return (
              <li key={t.to}>
                <Link
                  to={t.to}
                  className={cn(
                    "flex min-h-16 flex-col items-center justify-center gap-1 px-0.5 py-1.5 text-center text-[0.6875rem] font-medium leading-tight focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <Icon className={cn("h-5 w-5 shrink-0", active && "stroke-[2.4]")} />
                  <span className="max-w-full truncate">{t.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
