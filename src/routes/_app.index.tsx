import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CountUp } from "@/components/motion";
import { useQuery } from "@tanstack/react-query";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import {
  AlertTriangle,
  ChevronRight,
  FileText,
  Sparkles,
  Upload,
  UserRound,
  Zap,
} from "lucide-react";
import { api } from "@/lib/api";
import { qk } from "@/lib/queries";
import {
  AnalysisSubtitle,
  CardSkeletons,
  ErrorState,
  PullToRefresh,
  scoreText,
} from "@/components/app";
import { Badge, Button, Card, EmptyState } from "@/components/ui/tp";
import { cn } from "@/lib/utils";
import type { DashboardOverview, JobDescription, Profile, ResumeVersion, Suggestion, Workspace } from "@/types/api";
import type { ReactNode } from "react";
import { Check, Loader2 } from "lucide-react";
import { openNewAnalysis } from "@/lib/stores";
import { ScoreRing } from "@/components/app";

export const Route = createFileRoute("/_app/")({
  head: () => ({
    meta: [
      { title: "Home — TalentPilot" },
      {
        name: "description",
        content: "Your TalentPilot dashboard: credits, scores and recent analyses.",
      },
      { property: "og:title", content: "Home — TalentPilot" },
      {
        property: "og:description",
        content: "Your TalentPilot dashboard: credits, scores and recent analyses.",
      },
    ],
  }),
  component: HomePage,
});

type Item = DashboardOverview["actionItems"][number];

/** Extracts a workspace id from a web href like /workspaces/<uuid>?tab=… */
const wsIdFrom = (href: string) => href.match(/\/workspaces\/([0-9a-f-]{36})/i)?.[1];

function HomePage() {
  const q = useQuery({
    queryKey: qk.dashboard,
    queryFn: () => api.get<DashboardOverview>("/dashboard"),
  });
  const nav = useNavigate();
  const profile = useQuery({ queryKey: qk.profile, queryFn: () => api.get<Profile>("/profiles/me") });
  const jobs = useQuery({
    queryKey: ["jobs", "any"],
    queryFn: () => api.list<JobDescription>("/job-descriptions", { limit: 1 }),
  });

  const go = (it: Item) => {
    const id = it.workspaceId ?? wsIdFrom(it.href);
    switch (it.kind) {
      case "failed_run":
        return id
          ? nav({ to: "/analyses/$id", params: { id } })
          : nav({ to: "/analyses", search: { filter: "failed" } });
      case "pending_suggestions":
        return id
          ? nav({ to: "/analyses/$id", params: { id }, search: { tab: "improve" } })
          : nav({ to: "/analyses", search: { filter: "complete" } });
      case "low_credits":
        return nav({ to: "/billing" });
      case "incomplete_profile":
        return nav({ to: "/profile" });
    }
  };

  if (q.isPending)
    return (
      <div className="space-y-3">
        <CardSkeletons count={1} h="h-10" />
        <div className="grid grid-cols-2 gap-3">
          <CardSkeletons count={2} h="h-28" />
          <CardSkeletons count={2} h="h-28" />
        </div>
        <CardSkeletons count={2} h="h-40" />
      </div>
    );
  if (q.isError && !q.data) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const d = q.data;
  const newUser = d.resumes.count === 0 || d.workspaces.total === 0;
  void jobs;

  return (
    <PullToRefresh onRefresh={() => q.refetch()}>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <h1 className="h1 min-w-0 break-words">{greeting(profile.data?.firstName)}</h1>
          <Badge tone="primary" className="mt-1 shrink-0">
            {d.plan.name}
          </Badge>
        </div>

        {newUser ? <GetStarted d={d} /> : d.workspaces.recent[0] ? <Hero w={d.workspaces.recent[0]} /> : null}

        <div className="grid grid-cols-3 gap-2">
          <Stat to="/billing" label="Credits">
            <CountUp value={d.creditInsight.balance} />
          </Stat>
          <Stat to="/analyses" label="Latest score">
            <span className={cn(d.scoreInsight.latestScore != null && scoreText(d.scoreInsight.latestScore))}>
              {d.scoreInsight.latestScore != null ? Math.round(d.scoreInsight.latestScore) : "—"}
            </span>
            {d.scoreInsight.trend.length > 1 && (
              <span className="mt-1 block h-6 w-full" aria-hidden>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={d.scoreInsight.trend}>
                    <Line type="monotone" dataKey="score" stroke="var(--primary)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </span>
            )}
          </Stat>
          <Stat to="/analyses" label="Analyses">
            {d.workspaces.total}
          </Stat>
        </div>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="h3">Recent analyses</h2>
            <Link
              to="/analyses"
              className="inline-flex min-h-11 items-center text-sm font-semibold text-primary"
            >
              See all
            </Link>
          </div>
          {d.workspaces.recent.length === 0 ? (
            <Card className="text-center">
              <p className="body-text">No analyses yet.</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {d.workspaces.recent.map((w) => (
                <Link
                  key={w.id}
                  to="/analyses/$id"
                  params={{ id: w.id }}
                  className="flex min-h-14 items-center gap-3 rounded-xl border border-border bg-card p-3"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{w.name}</span>
                    <AnalysisSubtitle workspaceId={w.id} date={w.updatedAt} fallback={w.status} />
                  </span>
                  {w.score != null && (
                    <span className={cn("font-display text-lg font-bold", scoreText(w.score))}>
                      {Math.round(w.score)}
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 text-subtle" />
                </Link>
              ))}
            </div>
          )}
        </section>

        {d.topGaps.length > 0 && (
          <section>
            <h2 className="h3 mb-2">Top skill gaps</h2>
            <div className="flex flex-wrap gap-2">
              {d.topGaps.map((g) => (
                <Badge key={g.keyword} tone="warning">
                  {g.keyword} · {g.missCount}
                </Badge>
              ))}
            </div>
          </section>
        )}
      </div>
    </PullToRefresh>
  );
}

function greeting(name?: string | null) {
  const h = new Date().getHours();
  const part = h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
  return `Good ${part}${name?.trim() ? `, ${name.trim()}` : ""}`;
}

function Stat({ to, label, children }: { to: "/billing" | "/analyses"; label: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="flex min-w-0 flex-col rounded-xl border border-border bg-card p-3 focus-visible:ring-2 focus-visible:ring-primary"
    >
      <span className="caption truncate">{label}</span>
      <span className="font-display text-xl font-bold leading-tight break-words">{children}</span>
    </Link>
  );
}

type Recent = DashboardOverview["workspaces"]["recent"][number];
const RUNNING = new Set(["queued", "processing", "running"]);

/** Latest analysis with ONE primary action picked from its state. */
function Hero({ w }: { w: Recent }) {
  const done = w.status === "completed" || w.status === "partial";
  const pending = useQuery({
    queryKey: ["workspace", w.id, "sug-pending"],
    queryFn: () => api.get<Suggestion[]>(`/workspaces/${w.id}/suggestions?status=pending`),
    enabled: done,
  });
  const ws = useQuery({
    queryKey: qk.workspace(w.id),
    queryFn: () => api.get<Workspace>(`/workspaces/${w.id}`),
    enabled: done,
  });
  const versions = useQuery({
    queryKey: qk.versions(ws.data?.resumeId ?? ""),
    queryFn: () => api.get<ResumeVersion[]>(`/resumes/${ws.data!.resumeId}/versions`),
    enabled: done && !!ws.data?.resumeId,
  });
  const n = pending.data?.length ?? 0;
  const latest = Math.max(0, ...(versions.data ?? []).map((v) => v.version));
  const needsRescore = ws.data?.analyzedResumeVersion != null && latest > ws.data.analyzedResumeVersion;

  let cta: ReactNode;
  if (RUNNING.has(w.status))
    cta = (
      <HeroLink id={w.id}>
        <Loader2 className="h-4 w-4 animate-spin" /> View progress
      </HeroLink>
    );
  else if (n > 0) cta = <HeroLink id={w.id} tab="improve">Review {n} suggestion{n === 1 ? "" : "s"}</HeroLink>;
  else if (needsRescore) cta = <HeroLink id={w.id} tab="improve">Recalculate score</HeroLink>;
  else cta = <HeroLink id={w.id}>Open analysis</HeroLink>;

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-3">
        {w.score != null ? (
          <ScoreRing score={Math.round(w.score)} size={56} />
        ) : (
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
            <Sparkles className="h-6 w-6" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="caption">Latest analysis</p>
          <p className="truncate font-semibold">{w.name}</p>
          <AnalysisSubtitle workspaceId={w.id} date={w.updatedAt} fallback={w.status} />
        </div>
      </div>
      {cta}
    </Card>
  );
}
function HeroLink({ id, tab, children }: { id: string; tab?: "improve"; children: ReactNode }) {
  return (
    <Link
      to="/analyses/$id"
      params={{ id }}
      search={tab ? { tab } : {}}
      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-center font-semibold text-primary-foreground hover:bg-primary-hover"
    >
      {children}
    </Link>
  );
}

/** Checklist for new users: Upload resume → Add a job → Run analysis. */
function GetStarted({ d }: { d: DashboardOverview }) {
  const nav = useNavigate();
  const jobs = useQuery({
    queryKey: ["jobs", "any"],
    queryFn: () => api.list<JobDescription>("/job-descriptions", { limit: 1 }),
  });
  const steps = [
    { label: "Upload resume", done: d.resumes.count > 0, action: "Upload", go: () => nav({ to: "/resumes", search: { upload: true } }) },
    { label: "Add a job", done: (jobs.data?.data.length ?? 0) > 0 || d.workspaces.total > 0, action: "Add job", go: () => nav({ to: "/jobs/new" }) },
    { label: "Run analysis", done: d.workspaces.total > 0, action: "Start", go: () => openNewAnalysis() },
  ];
  const next = steps.findIndex((s) => !s.done);
  return (
    <Card className="space-y-3">
      <div>
        <h2 className="h3">Get started</h2>
        <p className="caption">Three steps to your first match score.</p>
      </div>
      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li
            key={s.label}
            className={cn(
              "flex min-h-14 items-center gap-3 rounded-lg p-2",
              i === next ? "bg-accent" : undefined,
            )}
          >
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                s.done ? "bg-success text-success-foreground" : i === next ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {s.done ? <Check className="h-4 w-4" /> : i + 1}
            </span>
            <span className={cn("min-w-0 flex-1 font-medium", s.done && "text-muted-foreground line-through")}>{s.label}</span>
            {i === next && (
              <Button size="sm" onClick={() => void s.go()}>
                {s.action}
              </Button>
            )}
          </li>
        ))}
      </ol>
    </Card>
  );
}
