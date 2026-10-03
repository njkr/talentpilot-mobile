import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Circle, Loader2, MinusCircle, RotateCw, XCircle } from "lucide-react";
import { API_BASE_URL } from "@/config";
import { api, NGROK_QUERY } from "@/lib/api";
import { qk } from "@/lib/queries";
import { toastError } from "@/lib/errors";
import { haptic, onAppResume } from "@/lib/native";
import { ActionButton, ProgressBar } from "@/components/app";
import { Card } from "@/components/ui/tp";
import { cn } from "@/lib/utils";
import { DrawCheck, FlightPath } from "@/components/motion";
import type { Run, RunStatus, StepStatus, StreamTicket } from "@/types/api";

export const STEPS: { name: string; label: string }[] = [
  { name: "parse_resume", label: "Reading your resume" },
  { name: "parse_jd", label: "Reading the job description" },
  { name: "generate_embeddings", label: "Analyzing semantics" },
  { name: "match_keywords", label: "Matching your experience against the requirements" },
  { name: "score_ats", label: "Scoring against ATS criteria" },
  { name: "optimize_resume", label: "Writing improvement suggestions" },
  { name: "generate_cover_letter", label: "Drafting your cover letter" },
  { name: "build_learning_path", label: "Building your learning roadmap" },
  { name: "generate_interview_qs", label: "Preparing interview questions" },
  { name: "research_company", label: "Researching the company" },
  { name: "estimate_salary", label: "Estimating salary range" },
  { name: "finalize", label: "Finishing up" },
];
export const stepLabel = (n: string) =>
  STEPS.find((s) => s.name === n)?.label ?? n.replace(/_/g, " ");

type StepState = StepStatus | "retrying";
export type LiveRun = {
  status: RunStatus;
  progress: number;
  steps: Record<string, StepState>;
  failedSteps?: string[] | undefined;
  refunded?: number | undefined;
};

const terminal = (s: RunStatus) =>
  s === "completed" || s === "failed" || s === "partial" || s === "cancelled";

/** SSE with single-use tickets, reconnects, polling fallback and resume handling. */
export function useRunStream(
  runId: string,
  initial: Run | undefined,
  onTerminal: (r: LiveRun) => void,
) {
  const [live, setLive] = useState<LiveRun>(() => fromRun(initial));
  const cb = useRef(onTerminal);
  cb.current = onTerminal;

  useEffect(() => {
    let es: EventSource | null = null;
    let failures = 0;
    let poll: ReturnType<typeof setInterval> | null = null;
    let stopped = false;
    let state = fromRun(initial);

    const update = (fn: (s: LiveRun) => LiveRun) => {
      state = fn(state);
      setLive(state);
      if (terminal(state.status)) finish();
    };
    const finish = () => {
      if (stopped) return;
      stopped = true;
      es?.close();
      if (poll) clearInterval(poll);
      cb.current(state);
    };
    const startPolling = () => {
      if (poll || stopped) return;
      const tick = async () => {
        try {
          const r = await api.get<Run>(`/workspaces/runs/${runId}`);
          update(() => fromRun(r));
        } catch {
          /* keep polling */
        }
      };
      void tick();
      poll = setInterval(tick, 3000);
    };
    const parse = (e: Event) => {
      try {
        return JSON.parse((e as MessageEvent).data as string) as Record<string, unknown>;
      } catch {
        return {};
      }
    };
    const connect = async () => {
      if (stopped) return;
      es?.close();
      let ticket: StreamTicket;
      try {
        ticket = await api.post<StreamTicket>(`/workspaces/runs/${runId}/stream-ticket`);
      } catch {
        return onFail();
      }
      if (stopped) return;
      es = new EventSource(
        `${API_BASE_URL}/workspaces/runs/${runId}/stream?ticket=${encodeURIComponent(ticket.ticket)}${NGROK_QUERY}`,
      );
      es.addEventListener("snapshot", (e) => {
        failures = 0;
        const d = parse(e) as {
          status: RunStatus;
          progress: number;
          steps: { name: string; status: StepStatus }[];
        };
        update((s) => ({
          ...s,
          status: d.status,
          progress: d.progress,
          steps: {
            ...s.steps,
            ...Object.fromEntries((d.steps ?? []).map((x) => [x.name, x.status])),
          },
        }));
      });
      es.addEventListener("run.started", () => update((s) => ({ ...s, status: "running" })));
      es.addEventListener("step.started", (e) => {
        const d = parse(e) as { step: string; progress: number };
        update((s) => ({
          ...s,
          status: "running",
          progress: d.progress ?? s.progress,
          steps: { ...s.steps, [d.step]: "running" },
        }));
      });
      es.addEventListener("step.completed", (e) => {
        const d = parse(e) as { step: string; progress: number };
        update((s) => ({
          ...s,
          progress: d.progress ?? s.progress,
          steps: { ...s.steps, [d.step]: "completed" },
        }));
      });
      es.addEventListener("step.skipped", (e) => {
        const d = parse(e) as { step: string; progress: number };
        update((s) => ({
          ...s,
          progress: d.progress ?? s.progress,
          steps: { ...s.steps, [d.step]: "skipped" },
        }));
      });
      es.addEventListener("step.failed", (e) => {
        const d = parse(e) as { step: string; willRetry: boolean };
        update((s) => ({
          ...s,
          steps: { ...s.steps, [d.step]: d.willRetry ? "retrying" : "failed" },
        }));
      });
      es.addEventListener("run.completed", () => {
        haptic("success");
        update((s) => ({ ...s, status: "completed", progress: 100 }));
      },
      );
      es.addEventListener("run.failed", (e) => {
        const d = parse(e) as {
          status: "failed" | "partial";
          failedSteps: string[];
          refundedCredits: number;
        };
        update((s) => ({
          ...s,
          status: d.status,
          failedSteps: d.failedSteps,
          refunded: d.refundedCredits,
        }));
      });
      es.onerror = () => {
        es?.close();
        es = null;
        onFail();
      };
    };
    const onFail = () => {
      if (stopped) return;
      failures++;
      if (failures > 2) return startPolling();
      setTimeout(() => void connect(), 1000 * failures);
    };

    if (initial && terminal(initial.status)) finish();
    else void connect();

    const offResume = onAppResume(() => {
      if (stopped) return;
      failures = 0;
      if (poll) {
        clearInterval(poll);
        poll = null;
      }
      void connect();
    });
    return () => {
      stopped = true;
      es?.close();
      if (poll) clearInterval(poll);
      offResume();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  return live;
}

function fromRun(r: Run | undefined): LiveRun {
  return {
    status: r?.status ?? "queued",
    progress: r?.progress ?? 0,
    steps: Object.fromEntries((r?.steps ?? []).map((s) => [s.name, s.status])),
    refunded: r?.creditsRefunded,
  };
}

export function StepIcon({ s }: { s: StepState | undefined }) {
  if (s === "completed") return <DrawCheck className="h-5 w-5" />;
  if (s === "running") return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
  if (s === "retrying") return <RotateCw className="h-5 w-5 animate-spin text-warning" />;
  if (s === "failed") return <XCircle className="h-5 w-5 text-destructive" />;
  if (s === "skipped") return <MinusCircle className="h-5 w-5 text-subtle" />;
  return <Circle className="h-5 w-5 text-border" />;
}

export function Timeline({ live }: { live: LiveRun }) {
  return (
    <Card className="space-y-3">
      <div className="flex justify-between text-sm font-medium">
        <span>Progress</span>
        <span>{Math.round(live.progress)}%</span>
      </div>
      <FlightPath
        done={
          STEPS.filter(
            (s) => live.steps[s.name] === "completed" || live.steps[s.name] === "skipped",
          ).length
        }
        total={STEPS.length}
        landed={live.status === "completed"}
      />
      <ProgressBar value={live.progress} />
      <ol className="space-y-1">
        {STEPS.map((s) => {
          const st = live.steps[s.name];
          return (
            <li key={s.name} className="flex min-h-11 items-center gap-3">
              <StepIcon s={st} />
              <span
                className={cn(
                  "text-sm",
                  st === "running" ? "font-semibold" : st ? "" : "text-muted-foreground",
                  st === "skipped" && "line-through",
                )}
              >
                {s.label}
                {st === "retrying" && <span className="caption ml-1">retrying…</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

export function ProgressView({
  workspaceId,
  runId,
  initial,
  onDone,
}: {
  workspaceId: string;
  runId: string;
  initial: Run | undefined;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const live = useRunStream(runId, initial, (r) => {
    void qc.invalidateQueries({ queryKey: qk.workspace(workspaceId) });
    void qc.invalidateQueries({ queryKey: qk.run(runId) });
    void qc.invalidateQueries({ queryKey: qk.workspaces });
    void qc.invalidateQueries({ queryKey: qk.credits });
    void qc.invalidateQueries({ queryKey: qk.dashboard });
    if (r.status === "completed") {
      toast.success("Analysis complete");
      setTimeout(onDone, 400); // let the landing bounce play
    } else onDone();
  });
  return (
    <div className="space-y-3">
      <Timeline live={live} />
      <p className="caption text-center">You can leave this screen — we'll keep working.</p>
    </div>
  );
}

export function FailedView({
  run,
  onRetried,
  onViewResults,
}: {
  run: Run;
  onRetried: (r: Run) => void;
  onViewResults?: (() => void) | undefined;
}) {
  const qc = useQueryClient();
  const retry = useMutation({
    mutationFn: () => api.post<Run>(`/workspaces/runs/${run.id}/retry`),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: qk.workspaces });
      onRetried(r);
    },
    onError: (e) => toastError(e, { RUN_NOT_RETRYABLE: "This run can't be retried." }),
  });
  const failed = run.steps.filter((s) => s.status === "failed");
  return (
    <div className="space-y-3">
      <Card className="space-y-3">
        <p className="h3">
          {run.status === "partial" ? "Analysis partly finished" : "Analysis failed"}
        </p>
        {failed.length > 0 && (
          <ul className="space-y-1">
            {failed.map((s) => (
              <li key={s.name} className="flex items-start gap-2 text-sm">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <span>
                  {stepLabel(s.name)}
                  {s.error ? <span className="caption block">{s.error}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
        {run.error && <p className="body-text">{run.error}</p>}
        {run.creditsRefunded > 0 && (
          <p className="rounded-lg bg-success/10 p-3 text-sm font-medium text-success">
            {run.creditsRefunded} credits refunded
          </p>
        )}
        <ActionButton size="full" loading={retry.isPending} onClick={() => retry.mutate()}>
          <RotateCw className="h-4 w-4" /> Retry at no extra cost
        </ActionButton>
        {onViewResults && (
          <ActionButton variant="secondary" size="full" onClick={onViewResults}>
            View available results
          </ActionButton>
        )}
      </Card>
      <Timeline live={fromRun(run)} />
    </div>
  );
}
