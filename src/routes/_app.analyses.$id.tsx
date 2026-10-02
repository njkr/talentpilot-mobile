import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2, Zap } from "lucide-react";
import { z } from "zod";
import { api, ApiError } from "@/lib/api";
import { qk, ANALYZE_COST } from "@/lib/queries";
import { handleUpgradeError, toastError } from "@/lib/errors";
import { openUpgrade } from "@/lib/stores";
import { ActionButton, ActionSheet, CardSkeletons, ConfirmSheet, ErrorState, fmtDate, PageHeader } from "@/components/app";
import { Card } from "@/components/ui/tp";
import { FailedView, ProgressView } from "@/components/analysis/Progress";
import { Results, TABS, type Tab } from "@/components/analysis/Results";
import { WsStatusBadge } from "@/lib/resumeUi";
import { displayPosition } from "@/components/GlobalSheets";
import type { AnalyzeResponse, CreditBalance, JobDescription, MatchResponse, Resume, Run, Workspace } from "@/types/api";

export const Route = createFileRoute("/_app/analyses/$id")({
  validateSearch: z.object({ tab: z.enum(TABS).optional(), run: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Analysis — TalentPilot" },
      { name: "description", content: "ATS score, suggestions, cover letter and interview prep." },
      { property: "og:title", content: "Analysis — TalentPilot" },
      { property: "og:description", content: "ATS score, suggestions, cover letter and interview prep." },
    ],
  }),
  component: AnalysisDetail,
});

const active = (s?: string) => s === "queued" || s === "running";

function AnalysisDetail() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [del, setDel] = useState(false);
  const ws = useQuery({ queryKey: qk.workspace(id), queryFn: () => api.get<Workspace>(`/workspaces/${id}`) });
  const resume = useQuery({ queryKey: qk.resume(ws.data?.resumeId ?? ""), queryFn: () => api.get<Resume>(`/resumes/${ws.data?.resumeId}`), enabled: !!ws.data?.resumeId });
  const runId = search.run ?? ws.data?.lastRunId ?? null;
  const run = useQuery({ queryKey: qk.run(runId ?? ""), queryFn: () => api.get<Run>(`/workspaces/runs/${runId}`), enabled: !!runId });
  const setSearch = (s: { tab?: Tab | undefined; run?: string | undefined }) => void nav({ to: "/analyses/$id", params: { id }, search: s, replace: true });

  const remove = useMutation({
    mutationFn: () => api.delete(`/workspaces/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.workspaces });
      void qc.invalidateQueries({ queryKey: qk.dashboard });
      toast.success("Analysis deleted");
      void nav({ to: "/analyses", replace: true });
    },
    onError: (e) => { setDel(false); toastError(e); },
  });

  if (ws.isPending) return <><PageHeader title="Analysis" /><CardSkeletons count={3} h="h-28" /></>;
  if (ws.isError) return <><PageHeader title="Analysis" /><ErrorState error={ws.error} onRetry={() => void ws.refetch()} /></>;
  const w = ws.data;

  let body;
  if (!runId) body = <ReadyToAnalyze w={w} onStarted={(rid) => setSearch({ run: rid })} />;
  else if (run.isPending) body = <CardSkeletons count={2} h="h-40" />;
  else if (run.isError) body = <ErrorState error={run.error} onRetry={() => void run.refetch()} />;
  else if (active(run.data.status))
    body = <ProgressView workspaceId={id} runId={run.data.id} initial={run.data} onDone={() => void run.refetch()} />;
  else if (run.data.status === "completed") body = <Results wsId={id} resumeId={w.resumeId} tab={search.tab ?? "report"} setTab={(t) => setSearch({ tab: t, run: search.run })} />;
  else if (run.data.status === "partial" && search.tab)
    body = <Results wsId={id} resumeId={w.resumeId} tab={search.tab} setTab={(t) => setSearch({ tab: t, run: search.run })} />;
  else
    body = (
      <FailedView
        run={run.data}
        onRetried={(r) => { qc.setQueryData(qk.run(r.id), r); setSearch({ run: r.id }); }}
        onViewResults={run.data.status === "partial" ? () => setSearch({ tab: "report", run: search.run }) : undefined}
      />
    );

  return (
    <div className="space-y-3">
      <PageHeader
        title={w.name}
        right={<ActionSheet title="Analysis" actions={[{ label: "Delete analysis", danger: true, icon: <Trash2 className="h-5 w-5" />, onSelect: () => setDel(true) }]} />}
      />
      <div className="-mt-2 flex min-w-0 items-center gap-2"><WsStatusBadge s={w.status} /><span className="caption truncate">{resume.data?.title ?? "Resume"} · {fmtDate(w.createdAt)}</span></div>
      {body}
      <ConfirmSheet open={del} onClose={() => setDel(false)} title="Delete this analysis?" body="Its report, suggestions and other results will be removed." confirmLabel="Delete" danger loading={remove.isPending} onConfirm={() => remove.mutate()} />
    </div>
  );
}

function ReadyToAnalyze({ w, onStarted }: { w: Workspace; onStarted: (runId: string) => void }) {
  const qc = useQueryClient();
  const [lowMatch, setLowMatch] = useState(false);
  const [checking, setChecking] = useState(false);
  const resume = useQuery({ queryKey: qk.resume(w.resumeId), queryFn: () => api.get<Resume>(`/resumes/${w.resumeId}`) });
  const job = useQuery({ queryKey: qk.job(w.jobDescriptionId), queryFn: () => api.get<JobDescription>(`/job-descriptions/${w.jobDescriptionId}`) });

  const analyze = useMutation({
    mutationFn: () => api.postIdempotent<AnalyzeResponse>(`/workspaces/${w.id}/analyze`), // new key per tap
    onSuccess: (r) => {
      setLowMatch(false);
      void qc.invalidateQueries({ queryKey: qk.credits });
      void qc.invalidateQueries({ queryKey: qk.workspaces });
      void qc.invalidateQueries({ queryKey: qk.workspace(w.id) });
      onStarted(r.runId);
    },
    onError: (e) => {
      setLowMatch(false);
      if (e instanceof ApiError && e.code === "ANALYSIS_ALREADY_RUNNING" && typeof e.details?.["runId"] === "string") return onStarted(e.details["runId"] as string);
      if (handleUpgradeError(e)) return;
      toastError(e, { EMAIL_NOT_VERIFIED: "Verify your email before running an analysis." });
    },
  });

  const start = async () => {
    setChecking(true);
    try {
      const bal = await qc.fetchQuery({ queryKey: qk.credits, queryFn: () => api.get<CreditBalance>("/credits"), staleTime: 0 });
      if (bal.balance < ANALYZE_COST) return openUpgrade({ kind: "credits", required: ANALYZE_COST, balance: bal.balance });
      try {
        const m = await api.post<MatchResponse>(`/resumes/${w.resumeId}/match/${w.jobDescriptionId}`);
        const c = m.coverage;
        if (c.requiredTotal > 0 && c.requiredMatched / c.requiredTotal < 0.35) return setLowMatch(true);
      } catch {
        /* advisory only */
      }
      analyze.mutate();
    } catch (e) {
      toastError(e);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-3">
      <Card className="space-y-2">
        <p className="caption font-semibold uppercase">Resume</p>
        <p className="font-semibold">{resume.data?.title ?? "…"}</p>
        <p className="caption font-semibold uppercase pt-2">Job</p>
        <p className="font-semibold">{job.data ? `${displayPosition(job.data.position)} · ${job.data.company ?? "Unknown company"}` : "…"}</p>
      </Card>
      <Card className="space-y-3 text-center">
        <p className="h3">Ready to analyze</p>
        <p className="body-text">Get your ATS score, suggested edits, cover letter, interview questions and more.</p>
        <ActionButton size="full" className="h-14 text-base" loading={checking || analyze.isPending} onClick={() => void start()}>
          <Zap className="h-5 w-5" /> Analyze — {ANALYZE_COST} credits
        </ActionButton>
      </Card>
      <ConfirmSheet
        open={lowMatch}
        onClose={() => setLowMatch(false)}
        title="Low match — analyze anyway?"
        body="Your resume matches less than 35% of the required skills for this job. You can still analyze it."
        confirmLabel={`Analyze anyway — ${ANALYZE_COST} credits`}
        loading={analyze.isPending}
        onConfirm={() => analyze.mutate()}
      />
    </div>
  );
}
