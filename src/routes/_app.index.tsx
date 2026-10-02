import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import { AlertTriangle, ChevronRight, FileText, Sparkles, Upload, UserRound, Zap } from "lucide-react";
import { api } from "@/lib/api";
import { qk } from "@/lib/queries";
import { AnalysisSubtitle, CardSkeletons, ErrorState, PullToRefresh, scoreText } from "@/components/app";
import { Badge, Button, Card, EmptyState } from "@/components/ui/tp";
import { cn } from "@/lib/utils";
import type { DashboardOverview } from "@/types/api";

export const Route = createFileRoute("/_app/")({
  head: () => ({
    meta: [
      { title: "Home — TalentPilot" },
      { name: "description", content: "Your TalentPilot dashboard: credits, scores and recent analyses." },
      { property: "og:title", content: "Home — TalentPilot" },
      { property: "og:description", content: "Your TalentPilot dashboard: credits, scores and recent analyses." },
    ],
  }),
  component: HomePage,
});

type Item = DashboardOverview["actionItems"][number];

/** Extracts a workspace id from a web href like /workspaces/<uuid>?tab=… */
const wsIdFrom = (href: string) => href.match(/\/workspaces\/([0-9a-f-]{36})/i)?.[1];

function HomePage() {
  const q = useQuery({ queryKey: qk.dashboard, queryFn: () => api.get<DashboardOverview>("/dashboard") });
  const nav = useNavigate();

  const go = (it: Item) => {
    const id = it.workspaceId ?? wsIdFrom(it.href);
    switch (it.kind) {
      case "failed_run":
        return id ? nav({ to: "/analyses/$id", params: { id } }) : nav({ to: "/analyses", search: { filter: "failed" } });
      case "pending_suggestions":
        return id
          ? nav({ to: "/analyses/$id", params: { id }, search: { tab: "suggestions" } })
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

  return (
    <PullToRefresh onRefresh={() => q.refetch()}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="h1">Home</h1>
          <Badge tone="primary">{d.plan.name}</Badge>
        </div>

        {d.resumes.count === 0 ? (
          <Card>
            <EmptyState
              icon={<FileText className="h-7 w-7" />}
              title="Upload your resume"
              description="Start by uploading a PDF or DOCX. We'll read it and get it ready to match against jobs."
              action={
                <Button onClick={() => void nav({ to: "/resumes", search: { upload: true } })}>
                  <Upload className="h-4 w-4" /> Upload your resume
                </Button>
              }
            />
          </Card>
        ) : null}

        {d.actionItems.length > 0 && (
          <section className="space-y-2">
            {d.actionItems.map((it, i) => (
              <button
                key={i}
                onClick={() => void go(it)}
                className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left"
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                    it.priority === "high" ? "bg-destructive/10 text-destructive" : it.priority === "medium" ? "bg-warning/10 text-warning" : "bg-accent text-primary",
                  )}
                >
                  {it.kind === "low_credits" ? <Zap className="h-5 w-5" /> : it.kind === "incomplete_profile" ? <UserRound className="h-5 w-5" /> : it.kind === "failed_run" ? <AlertTriangle className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
                </span>
                <span className="flex-1 text-sm font-medium">{it.label}</span>
                <ChevronRight className="h-4 w-4 text-subtle" />
              </button>
            ))}
          </section>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Card>
            <p className="caption">Credits</p>
            <p className="font-display text-2xl font-bold">{d.creditInsight.balance}</p>
            <p className="caption mt-1">~{d.creditInsight.runsRemaining} analyses left</p>
            {(d.creditInsight.spentLast30Days > 0 || d.creditInsight.grantedLast30Days > 0) ? (
              <p className="caption">
                {[
                  d.creditInsight.spentLast30Days > 0 ? `−${d.creditInsight.spentLast30Days}` : null,
                  d.creditInsight.grantedLast30Days > 0 ? `+${d.creditInsight.grantedLast30Days}` : null,
                ].filter(Boolean).join(" / ")} · last 30 days
              </p>
            ) : (
              <p className="caption">No credit activity in the last 30 days</p>
            )}
          </Card>
          <Card>
            <p className="caption">Score trend</p>
            <p className={cn("font-display text-2xl font-bold", d.scoreInsight.latestScore != null && scoreText(d.scoreInsight.latestScore))}>
              {d.scoreInsight.latestScore ?? "—"}
            </p>
            {d.scoreInsight.trend.length > 1 ? (
              <>
                <div className="h-12">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={d.scoreInsight.trend}>
                      <Line type="monotone" dataKey="score" stroke="var(--primary)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="caption mt-1">Best {d.scoreInsight.bestScore ?? "—"} · Avg {d.scoreInsight.averageScore != null ? Math.round(d.scoreInsight.averageScore) : "—"}</p>
              </>
            ) : (
              <p className="caption mt-1">Run more analyses to see your trend</p>
            )}
          </Card>
          {d.activity.some((a) => a.runs > 0) && (
            <Card>
              <p className="caption">Activity (14 days)</p>
              <div className="mt-2 flex h-12 items-end gap-0.5">
                {(() => {
                  const max = Math.max(1, ...d.activity.map((a) => a.runs));
                  return d.activity.map((a) => (
                    <div key={a.date} title={`${a.date}: ${a.runs}`} className="flex-1 rounded-sm bg-primary/80" style={{ height: `${Math.max(6, (a.runs / max) * 100)}%`, opacity: a.runs ? 1 : 0.2 }} />
                  ));
                })()}
              </div>
            </Card>
          )}
          <Card className={d.activity.some((a) => a.runs > 0) ? undefined : "col-span-2"}>
            <p className="caption">Totals</p>
            <div className="mt-1 space-y-0.5 text-sm">
              <p>
                <b>{d.resumes.count}</b>
                {d.resumes.limit != null ? `/${d.resumes.limit}` : ""} resumes
              </p>
              <p>
                <b>{d.workspaces.total}</b> analyses
              </p>
              <p className="caption">
                {d.workspaces.completed} done · {d.workspaces.processing} running · {d.workspaces.failed} failed
              </p>
            </div>
          </Card>
        </div>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="h3">Recent analyses</h2>
            <Link to="/analyses" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary">
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
                  {w.score != null && <span className={cn("font-display text-lg font-bold", scoreText(w.score))}>{Math.round(w.score)}</span>}
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
