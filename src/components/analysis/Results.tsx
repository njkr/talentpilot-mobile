import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { diffWords } from "diff";
import { scoreText } from "@/components/app";
import type { Profile } from "@/types/api";
import { animate, motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Pencil,
  X,
  Copy,
  ExternalLink,
  Loader2,
  RefreshCw,
  Share2,
  ShieldCheck,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { qk, COVER_REGEN_COST, FEEDBACK_COST, RESCORE_COST } from "@/lib/queries";
import { toastError } from "@/lib/errors";
import { copyText, haptic, openExternal, shareText } from "@/lib/native";
import {
  ActionButton,
  CardSkeletons,
  CheckBox,
  Chip,
  Collapsible,
  ErrorState,
  ProgressBar,
  ScoreRing,
  scoreTone,
} from "@/components/app";
import { ImportanceBadge } from "@/routes/_app.jobs.$id";
import { Badge, Card, EmptyState, Input } from "@/components/ui/tp";
import { cn } from "@/lib/utils";
import type { RescoreResponse, RescoreStatus, ResumeVersion } from "@/types/api";
import type {
  AtsReport,
  CompanyInsight,
  CoverLetter,
  CoverLetterLength,
  CoverLetterTone,
  InterviewQuestion,
  LearningRoadmap,
  SalaryEstimate,
  Suggestion,
} from "@/types/api";

export const TABS = ["improve", "prepare", "research"] as const;
export type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = { improve: "Improve", prepare: "Prepare", research: "Research" };
/** Old 7-tab values still arrive from links/notifications: map them onto the 3 segments. */
const LEGACY: Record<string, Tab> = {
  report: "improve",
  suggestions: "improve",
  "cover-letter": "prepare",
  interview: "prepare",
  company: "research",
  salary: "research",
  learning: "research",
};
export const toTab = (v: string | undefined): Tab | undefined =>
  v == null ? undefined : (TABS as readonly string[]).includes(v) ? (v as Tab) : LEGACY[v];

export function Results({
  wsId,
  resumeId,
  tab,
  setTab,
}: {
  wsId: string;
  resumeId: string;
  tab: Tab;
  setTab: (t: Tab) => void;
}) {
  const [opened, setOpened] = useState<Set<Tab>>(() => new Set([tab]));
  useEffect(() => {
    setOpened((s) => (s.has(tab) ? s : new Set(s).add(tab)));
  }, [tab]);
  return (
    <div className="space-y-3">
      <div role="tablist" className="grid grid-cols-3 gap-1 rounded-full bg-muted p-1">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              "min-h-11 min-w-0 truncate rounded-full px-2 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-primary",
              tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>
      {TABS.map((t) =>
        opened.has(t) ? (
          <div key={t} hidden={t !== tab} role="tabpanel">
            {t === "improve" && <ImproveView wsId={wsId} resumeId={resumeId} />}
            {t === "prepare" && (
              <>
                <LazySection title="Cover letter">
                  <CoverTab wsId={wsId} />
                </LazySection>
                <LazySection title="Interview">
                  <InterviewTab wsId={wsId} />
                </LazySection>
              </>
            )}
            {t === "research" && (
              <>
                <LazySection title="Company">
                  <CompanyTab wsId={wsId} />
                </LazySection>
                <LazySection title="Salary">
                  <SalaryTab wsId={wsId} />
                </LazySection>
                <LazySection title="Learning">
                  <LearningTab wsId={wsId} />
                </LazySection>
              </>
            )}
          </div>
        ) : null,
      )}
    </div>
  );
}

/** Section with a sticky header whose body (and its data fetch) mounts only when scrolled near. */
function LazySection({ title, children }: { title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    if (typeof IntersectionObserver === "undefined") return setNear(true);
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && setNear(true), {
      rootMargin: "400px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  return (
    <section ref={ref} className="pb-4">
      <h2 className="h3 pt-safe sticky top-0 z-10 -mx-4 bg-background/95 px-4 py-2 backdrop-blur">{title}</h2>
      {near ? children : <CardSkeletons count={1} h="h-32" />}
    </section>
  );
}

/** Shared recalculation state so both the score card and the "All reviewed" card can start it. */
function useRescore(wsId: string) {
  const qc = useQueryClient();
  const [rescoreId, setRescoreId] = useState<string | null>(null);
  const status = useQuery({
    queryKey: qk.ws(wsId, `rescore-${rescoreId}`),
    queryFn: () => api.get<RescoreStatus>(`/workspaces/${wsId}/rescore/${rescoreId}`),
    enabled: !!rescoreId,
    refetchInterval: 2500,
    retry: false,
  });
  useEffect(() => {
    if (!rescoreId) return;
    if (status.isError) {
      setRescoreId(null);
      toast("Couldn't track the recalculation — pull to refresh in a bit.");
      return;
    }
    const st = status.data?.status;
    if (st === "completed") {
      setRescoreId(null);
      haptic("success");
      toast.success("Score updated");
      void qc.invalidateQueries({ queryKey: qk.ws(wsId, "report") });
      void qc.invalidateQueries({ queryKey: qk.workspaces });
      void qc.invalidateQueries({ queryKey: qk.dashboard });
    } else if (st === "failed") {
      setRescoreId(null);
      haptic("warning");
      toast.error(status.data?.error ?? "Recalculation failed");
    }
  }, [status.data, status.isError, rescoreId, wsId, qc]);
  const m = useMutation({
    mutationFn: () => api.postIdempotent<RescoreResponse>(`/workspaces/${wsId}/rescore`),
    onSuccess: (r) => {
      setRescoreId(r.rescoreId);
      void qc.invalidateQueries({ queryKey: qk.credits });
    },
    onError: (e) => {
      haptic("warning");
      toastError(e, { NO_CHANGES_TO_RESCORE: "Apply some suggestions first" });
    },
  });
  return { waiting: !!rescoreId, start: () => m.mutate(), starting: m.isPending };
}
type Rescore = ReturnType<typeof useRescore>;

function ImproveView({ wsId, resumeId }: { wsId: string; resumeId: string }) {
  const rescore = useRescore(wsId);
  return (
    <>
      <LazySection title="Score">
        <ReportTab wsId={wsId} resumeId={resumeId} rescore={rescore} />
      </LazySection>
      <LazySection title="Suggestions">
        <SuggestionsTab wsId={wsId} rescore={rescore} />
      </LazySection>
    </>
  );
}

const is404 = (e: unknown) => e instanceof ApiError && (e.status === 404 || e.code === "NOT_FOUND");
function Gate<T>({
  q,
  children,
  notReady,
}: {
  q: {
    isPending: boolean;
    isError: boolean;
    error: unknown;
    data: T | undefined;
    refetch: () => unknown;
  };
  children: (d: T) => ReactNode;
  notReady?: string;
}) {
  if (q.isPending) return <CardSkeletons count={3} h="h-32" />;
  if (q.isError && !q.data) {
    if (is404(q.error) || (q.error instanceof ApiError && q.error.code === "REPORT_NOT_READY"))
      return <EmptyState title={notReady ?? "Not available for this analysis"} />;
    return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  }
  return <>{children(q.data as T)}</>;
}

// ── Report ────────────────────────────────────────────────────────────
function ReportTab({ wsId, resumeId, rescore }: { wsId: string; resumeId: string; rescore: Rescore }) {
  const waitFrom = rescore.waiting;
  const q = useQuery({
    queryKey: qk.ws(wsId, "report"),
    queryFn: () => api.get<AtsReport>(`/workspaces/${wsId}/report`),
  });
  const versions = useQuery({
    queryKey: qk.versions(resumeId),
    queryFn: () => api.get<ResumeVersion[]>(`/resumes/${resumeId}/versions`),
  });
  const [openKw, setOpenKw] = useState<string | null>(null);

  return (
    <Gate q={q} notReady="No report yet">
      {(r) => {
        const delta = r.original ? Math.round(r.overallScore - r.original.overallScore) : 0;
        const latestVersion = Math.max(
          r.resumeVersion,
          ...(versions.data ?? []).map((v) => v.version),
        );
        const canRescore = latestVersion > r.resumeVersion;
        return (
          <div className="space-y-3">
            <Card className="flex flex-wrap items-center gap-4">
              <ScoreRing score={r.overallScore} />
              <div className="min-w-0 flex-1 space-y-1.5">
                {r.matchBand && (
                  <Badge
                    tone={
                      r.matchBand.band === "strong"
                        ? "success"
                        : r.matchBand.band === "fair"
                          ? "primary"
                          : "warning"
                    }
                  >
                    <span className="capitalize">{r.matchBand.band} match</span>
                  </Badge>
                )}
                {r.matchBand && (
                  <p className="text-sm">
                    Meets {r.matchBand.requiredMet} of {r.matchBand.requiredTotal} required
                  </p>
                )}
                {delta !== 0 && (
                  <p
                    className={cn(
                      "text-sm font-semibold",
                      delta > 0 ? "text-success" : "text-destructive",
                    )}
                  >
                    {delta > 0 ? `▲ +${delta}` : `▼ ${delta}`} vs original
                  </p>
                )}
              </div>
            </Card>
            {waitFrom ? (
              <Card className="flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Recalculating…
              </Card>
            ) : (
              <ActionButton
                variant={canRescore ? "primary" : "secondary"}
                size="full"
                disabled={!canRescore}
                loading={rescore.starting}
                onClick={rescore.start}
              >
                <RefreshCw className="h-4 w-4" /> Recalculate — {RESCORE_COST} credits
              </ActionButton>
            )}
            {!waitFrom && !canRescore && (
              <p className="caption -mt-2 text-center">Apply suggestions first</p>
            )}
            {r.summary && (
              <Card>
                <p className="body-text">{r.summary}</p>
              </Card>
            )}
            {r.scoreBreakdown.length > 0 && (
              <Card className="space-y-3">
                <h3 className="h3">Score breakdown</h3>
                {r.scoreBreakdown.map((b) => (
                  <div key={b.component}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="capitalize">{b.component.replace(/_/g, " ")}</span>
                      <span className="font-semibold">{Math.round(b.score)}</span>
                    </div>
                    <ProgressBar value={b.score} tone={scoreTone(b.score)} />
                  </div>
                ))}
              </Card>
            )}
            {(["matched", "partial", "missing"] as const).map((st) => {
              const list = r.keywords.filter((k) => k.status === st);
              if (!list.length) return null;
              return (
                <Collapsible
                  key={st}
                  defaultOpen={st === "missing"}
                  title={
                    <span className="capitalize">
                      {st} keywords ({list.length})
                    </span>
                  }
                >
                  <ul className="divide-y divide-border">
                    {list.map((k) => (
                      <li key={k.keyword}>
                        <button
                          className="flex min-h-11 w-full items-center gap-2 text-left"
                          onClick={() => setOpenKw(openKw === k.keyword ? null : k.keyword)}
                        >
                          <span className="flex-1 text-sm font-medium">{k.keyword}</span>
                          <ImportanceBadge i={k.importance} />
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 transition-transform",
                              openKw !== k.keyword && "-rotate-90",
                            )}
                          />
                        </button>
                        {openKw === k.keyword && (
                          <div className="caption space-y-1 pb-2">
                            {k.evidence && (
                              <p>
                                <b>Evidence:</b> {k.evidence}
                              </p>
                            )}
                            {k.suggestion && (
                              <p>
                                <b>Suggestion:</b> {k.suggestion}
                              </p>
                            )}
                            {!k.evidence && !k.suggestion && <p>No extra details.</p>}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </Collapsible>
              );
            })}
            <ListCard title="Strengths" items={r.strengths} />
            <ListCard title="Weaknesses" items={r.weaknesses} />
            <ListCard title="Recommendations" items={r.recommendations} />
          </div>
        );
      }}
    </Gate>
  );
}

function ListCard({ title, items }: { title: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <Card>
      <h3 className="h3 mb-2">{title}</h3>
      <ul className="body-text list-disc space-y-1 pl-5">
        {items.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
    </Card>
  );
}

// ── Suggestions ───────────────────────────────────────────────────────
function SuggestionsTab({ wsId, rescore }: { wsId: string; rescore: Rescore }) {
  const qc = useQueryClient();
  const get = (st: string) => api.get<Suggestion[]>(`/workspaces/${wsId}/suggestions?status=${st}`);
  const pending = useQuery({ queryKey: qk.ws(wsId, "sug-pending"), queryFn: () => get("pending") });
  const needs = useQuery({ queryKey: qk.ws(wsId, "sug-needs"), queryFn: () => get("needs_info") });
  const accepted = useQuery({ queryKey: qk.ws(wsId, "sug-accepted"), queryFn: () => get("accepted") });
  const rejected = useQuery({ queryKey: qk.ws(wsId, "sug-rejected"), queryFn: () => get("rejected") });
  const [sel, setSel] = useState<Set<string>>(new Set());
  const inval = () =>
    ["sug-pending", "sug-needs", "sug-accepted", "sug-rejected"].forEach(
      (p) => void qc.invalidateQueries({ queryKey: qk.ws(wsId, p) }),
    );

  /** Optimistic: move cards out of "pending" into accepted/rejected; roll back on error. */
  const review = useMutation({
    mutationFn: ({ kind, ids }: { kind: "apply" | "reject"; ids: string[] }) =>
      api.post<{ applied?: number; rejected?: number; skipped?: string[] }>(
        `/workspaces/${wsId}/suggestions/${kind}`,
        { suggestionIds: ids },
      ),
    onMutate: async ({ kind, ids }) => {
      const pk = qk.ws(wsId, "sug-pending");
      const tk = qk.ws(wsId, kind === "apply" ? "sug-accepted" : "sug-rejected");
      await qc.cancelQueries({ queryKey: pk });
      const prevP = qc.getQueryData<Suggestion[]>(pk);
      const prevT = qc.getQueryData<Suggestion[]>(tk);
      const moved = (prevP ?? [])
        .filter((x) => ids.includes(x.id))
        .map((x) => ({ ...x, status: (kind === "apply" ? "accepted" : "rejected") as Suggestion["status"] }));
      qc.setQueryData<Suggestion[]>(pk, (l) => l?.filter((x) => !ids.includes(x.id)));
      qc.setQueryData<Suggestion[]>(tk, (l) => [...moved, ...(l ?? [])]);
      setSel((cur) => new Set([...cur].filter((id) => !ids.includes(id))));
      haptic("light");
      return { pk, tk, prevP, prevT };
    },
    onError: (e, _v, ctx) => {
      if (ctx) {
        qc.setQueryData(ctx.pk, ctx.prevP);
        qc.setQueryData(ctx.tk, ctx.prevT);
      }
      haptic("warning");
      toastError(e);
    },
    onSuccess: (r, { kind, ids }) => {
      if (kind === "apply") void qc.invalidateQueries({ queryKey: qk.dashboard });
      if (ids.length > 1)
        toast.success(
          kind === "apply"
            ? `Applied ${r.applied ?? ids.length}${r.skipped?.length ? ` · ${r.skipped.length} skipped` : ""}`
            : `Rejected ${r.rejected ?? ids.length}`,
        );
    },
    onSettled: inval,
  });
  const act = (kind: "apply" | "reject", ids: string[]) => review.mutate({ kind, ids });

  if (pending.isPending) return <CardSkeletons count={3} h="h-40" />;
  if (pending.isError) return <ErrorState error={pending.error} onRetry={() => void pending.refetch()} />;
  const list = pending.data;
  const reviewedList = [...(accepted.data ?? []), ...(rejected.data ?? [])];
  const reviewed = reviewedList.length;
  const total = reviewed + list.length;
  const allSel = list.length > 0 && sel.size === list.length;
  const toggle = (id: string, v: boolean) =>
    setSel((cur) => {
      const n = new Set(cur);
      if (v) n.add(id);
      else n.delete(id);
      return n;
    });

  return (
    <div className="space-y-3 pb-20">
      {total > 0 && (
        <div className="space-y-1.5">
          <p className="text-sm font-semibold">
            {reviewed} of {total} reviewed
          </p>
          <ProgressBar value={(reviewed / total) * 100} />
        </div>
      )}
      <p className="caption flex items-center gap-1.5">
        <ShieldCheck className="h-4 w-4 shrink-0" /> Every suggestion is checked against your original resume.
      </p>
      {list.length === 0 && total > 0 && !needs.data?.length && (
        <Card className="space-y-3 border-primary/30 bg-accent text-center">
          <p className="font-semibold">All reviewed</p>
          {rescore.waiting ? (
            <p className="flex items-center justify-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Recalculating…
            </p>
          ) : (
            <ActionButton size="full" loading={rescore.starting} onClick={rescore.start}>
              <RefreshCw className="h-4 w-4" /> Recalculate your score ({RESCORE_COST} credits)
            </ActionButton>
          )}
        </Card>
      )}
      {list.length === 0 && total === 0 && !needs.data?.length && (
        <EmptyState title="No suggestions" description="Nothing to change for this job." />
      )}
      {list.length > 1 && (
        <div className="flex items-center">
          <CheckBox
            checked={allSel}
            label="Select all"
            onChange={(v) => setSel(v ? new Set(list.map((x) => x.id)) : new Set())}
          />
          <span className="text-sm font-medium">Select all ({list.length})</span>
        </div>
      )}
      {list.length > 0 && <p className="caption">Swipe right to apply, left to reject.</p>}
      {list.map((x) => (
        <SwipeCard key={x.id} onApply={() => act("apply", [x.id])} onReject={() => act("reject", [x.id])}>
          <SuggestionCard
            s={x}
            checked={sel.has(x.id)}
            onCheck={(v) => toggle(x.id, v)}
            onApply={() => act("apply", [x.id])}
            onReject={() => act("reject", [x.id])}
          />
        </SwipeCard>
      ))}
      {needs.data?.map((x) => <NeedsInfoCard key={x.id} wsId={wsId} s={x} onDone={inval} />)}
      {reviewed > 0 && (
        <Collapsible title={`Reviewed (${reviewed})`}>
          <div className="space-y-3">
            {reviewedList.map((x) => (
              <SuggestionCard key={x.id} s={x} />
            ))}
          </div>
        </Collapsible>
      )}
      {sel.size > 0 && (
        <div className="pb-safe fixed inset-x-0 bottom-16 z-20 mx-auto flex max-w-lg gap-2 border-t border-border bg-card p-3">
          <div className="flex-1">
            <ActionButton variant="secondary" size="full" onClick={() => act("reject", [...sel])}>
              Reject {sel.size}
            </ActionButton>
          </div>
          <div className="flex-[2]">
            <ActionButton size="full" onClick={() => act("apply", [...sel])}>
              Apply {sel.size}
            </ActionButton>
          </div>
        </div>
      )}
    </div>
  );
}

/** Swipe right = apply, left = reject (35% of width), revealing a check / x behind the card. */
function SwipeCard({ children, onApply, onReject }: { children: ReactNode; onApply: () => void; onReject: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const applyOpacity = useTransform(x, [0, 80], [0, 1]);
  const rejectOpacity = useTransform(x, [-80, 0], [1, 0]);
  const end = (_: unknown, info: PanInfo) => {
    const w = ref.current?.offsetWidth ?? 320;
    if (info.offset.x > w * 0.35) {
      void animate(x, w, { duration: 0.18 });
      onApply();
    } else if (info.offset.x < -w * 0.35) {
      void animate(x, -w, { duration: 0.18 });
      onReject();
    } else void animate(x, 0, { type: "spring", stiffness: 500, damping: 40 });
  };
  return (
    <div ref={ref} className="relative overflow-hidden rounded-xl">
      <motion.div style={{ opacity: applyOpacity }} className="absolute inset-0 flex items-center justify-start bg-success/15 pl-6 text-success" aria-hidden>
        <Check className="h-7 w-7" />
      </motion.div>
      <motion.div style={{ opacity: rejectOpacity }} className="absolute inset-0 flex items-center justify-end bg-destructive/15 pr-6 text-destructive" aria-hidden>
        <X className="h-7 w-7" />
      </motion.div>
      <motion.div drag="x" dragDirectionLock dragSnapToOrigin={false} dragElastic={0.6} dragConstraints={{ left: 0, right: 0 }} style={{ x, touchAction: "pan-y" }} onDragEnd={end} className="relative">
        {children}
      </motion.div>
    </div>
  );
}

/** One paragraph, word-level diff of old → new text. */
function WordDiff({ oldText, newText }: { oldText: string; newText: string }) {
  const parts = diffWords(oldText, newText);
  return (
    <p className="text-sm leading-relaxed">
      {parts.map((p, i) =>
        p.removed ? (
          <span key={i} className="rounded bg-destructive/10 text-destructive line-through">
            {p.value}
          </span>
        ) : p.added ? (
          <span key={i} className="rounded bg-success/10 font-medium text-success">
            {p.value}
          </span>
        ) : (
          <span key={i}>{p.value}</span>
        ),
      )}
    </p>
  );
}

function SuggestionCard({
  s,
  checked,
  onCheck,
  onApply,
  onReject,
}: {
  s: Suggestion;
  checked?: boolean;
  onCheck?: (v: boolean) => void;
  onApply?: () => void;
  onReject?: () => void;
}) {
  return (
    <Card className="space-y-2 p-3">
      <div className="flex flex-wrap items-center gap-2">
        {onCheck && <CheckBox checked={!!checked} label="Select suggestion" onChange={onCheck} />}
        <span className="caption min-w-0 flex-1 font-semibold uppercase tracking-wide">
          {s.sectionType.replace(/_/g, " ")}
        </span>
        <Badge tone={s.impact === "high" ? "success" : s.impact === "medium" ? "primary" : "neutral"}>
          {s.impact} impact
        </Badge>
        {s.status !== "pending" && (
          <Badge tone={s.status === "accepted" ? "success" : "neutral"}>{s.status}</Badge>
        )}
      </div>
      {s.oldText ? (
        <WordDiff oldText={s.oldText} newText={s.newText} />
      ) : (
        <p className="text-sm font-medium text-success">{s.newText}</p>
      )}
      {s.reason && <p className="caption">{s.reason}</p>}
      {s.keywordsAdded.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {s.keywordsAdded.map((k) => (
            <Badge key={k} tone="primary">
              +{k}
            </Badge>
          ))}
        </div>
      )}
      {onApply && onReject && (
        <div className="grid grid-cols-2 gap-2 pt-1">
          <ActionButton variant="secondary" onClick={onReject}>
            <X className="h-4 w-4" /> Reject
          </ActionButton>
          <ActionButton onClick={onApply}>
            <Check className="h-4 w-4" /> Apply
          </ActionButton>
        </div>
      )}
    </Card>
  );
}

function NeedsInfoCard({ wsId, s, onDone }: { wsId: string; s: Suggestion; onDone: () => void }) {
  const [v, setV] = useState("");
  const m = useMutation({
    mutationFn: () =>
      api.post<Suggestion>(`/workspaces/${wsId}/suggestions/${s.id}/provide-detail`, {
        newText: v.trim(),
      }),
    onSuccess: () => {
      toast.success("Thanks — suggestion updated");
      onDone();
    },
    onError: (e) => toastError(e),
  });
  return (
    <Card className="space-y-2 border-warning/40 p-3">
      <Badge tone="warning">Needs your input</Badge>
      <p className="text-sm">{s.newText}</p>
      {s.missingFact && <p className="text-sm font-medium">{s.missingFact}</p>}
      <Input
        value={v}
        maxLength={2000}
        onChange={(e) => setV(e.target.value)}
        placeholder={s.exampleValue ? `e.g. ${s.exampleValue}` : "Add the detail"}
        aria-label="Detail"
      />
      <ActionButton
        size="full"
        disabled={!v.trim()}
        loading={m.isPending}
        onClick={() => m.mutate()}
      >
        Submit
      </ActionButton>
    </Card>
  );
}

// ── Cover letter ──────────────────────────────────────────────────────
const TONES: CoverLetterTone[] = ["professional", "friendly", "confident", "enthusiastic"];
const LENGTHS: CoverLetterLength[] = ["short", "standard", "long"];
function CoverTab({ wsId }: { wsId: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: qk.ws(wsId, "cover"),
    queryFn: () => api.get<CoverLetter>(`/workspaces/${wsId}/cover-letter`),
  });
  const [tone, setTone] = useState<CoverLetterTone | null>(null);
  const [len, setLen] = useState<CoverLetterLength | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<{ v: number; text: string } | null>(null);
  const regen = useMutation({
    mutationFn: () =>
      api.post<CoverLetter>(`/workspaces/${wsId}/cover-letter/regenerate`, {
        tone: tone ?? q.data?.tone,
        length: len ?? q.data?.length,
      }),
    onSuccess: (c) => {
      qc.setQueryData(qk.ws(wsId, "cover"), c);
      void qc.invalidateQueries({ queryKey: qk.credits });
      toast.success("Cover letter regenerated");
    },
    onError: (e) => toastError(e),
  });
  return (
    <Gate q={q}>
      {(c) => {
        const t = tone ?? c.tone,
          l = len ?? c.length;
        const text = draft && draft.v === c.version ? draft.text : c.content;
        return (
          <div className="space-y-3">
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
              {TONES.map((x) => (
                <Chip key={x} active={t === x} onClick={() => setTone(x)}>
                  {x}
                </Chip>
              ))}
            </div>
            <div className="flex gap-2">
              {LENGTHS.map((x) => (
                <Chip key={x} active={l === x} onClick={() => setLen(x)}>
                  {x}
                </Chip>
              ))}
            </div>
            <ActionButton
              variant="secondary"
              size="full"
              disabled={t === c.tone && l === c.length && !regen.isError}
              loading={regen.isPending}
              onClick={() => regen.mutate()}
            >
              <RefreshCw className="h-4 w-4" /> Regenerate — {COVER_REGEN_COST} credits
            </ActionButton>
            <Card>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="caption min-w-0">
                  Version {c.version} · {c.wordCount} words{text !== c.content ? " · edited" : ""}
                </p>
                <button
                  onClick={() => setEditing((v) => !v)}
                  className="inline-flex min-h-11 shrink-0 items-center gap-1.5 px-2 text-sm font-semibold text-primary"
                >
                  {editing ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                  {editing ? "Done" : "Edit"}
                </button>
              </div>
              {editing ? (
                <textarea
                  value={text}
                  onChange={(e) => setDraft({ v: c.version, text: e.target.value })}
                  rows={14}
                  aria-label="Cover letter text"
                  className="w-full rounded-lg border border-input bg-card p-3 text-base leading-relaxed"
                />
              ) : (
                <p className="whitespace-pre-wrap text-base leading-relaxed">{text}</p>
              )}
            </Card>
            <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom)+0.5rem)] z-10 grid grid-cols-2 gap-2 rounded-xl bg-background/95 py-2 backdrop-blur">
              <ActionButton
                onClick={async () => {
                  await copyText(text);
                  haptic("light");
                  toast.success("Copied");
                }}
              >
                <Copy className="h-4 w-4" /> Copy
              </ActionButton>
              <ActionButton
                variant="secondary"
                onClick={async () => {
                  if (!(await shareText("Cover letter", text))) {
                    await copyText(text);
                    toast.success("Copied (sharing not available)");
                  }
                }}
              >
                <Share2 className="h-4 w-4" /> Share
              </ActionButton>
            </div>
          </div>
        );
      }}
    </Gate>
  );
}

// ── Interview ─────────────────────────────────────────────────────────
function InterviewTab({ wsId }: { wsId: string }) {
  const q = useQuery({
    queryKey: qk.ws(wsId, "interview"),
    queryFn: () => api.get<InterviewQuestion[]>(`/workspaces/${wsId}/interview-questions`),
  });
  const [practice, setPractice] = useState(false);
  return (
    <Gate q={q}>
      {(list) =>
        list.length === 0 ? (
          <EmptyState title="No interview questions" />
        ) : (
          <div className="space-y-3">
            <ActionButton size="full" onClick={() => setPractice(true)}>
              Practice — one question at a time
            </ActionButton>
            {list.map((iq) => (
              <QuestionCard key={iq.id} wsId={wsId} iq={iq} />
            ))}
            {practice && <PracticeView wsId={wsId} list={list} onClose={() => setPractice(false)} />}
          </div>
        )
      }
    </Gate>
  );
}
function useAnswer(wsId: string, iq: InterviewQuestion) {
  const qc = useQueryClient();
  const [ans, setAns] = useState(iq.userAnswer ?? "");
  const m = useMutation({
    mutationFn: () =>
      api.post<InterviewQuestion>(`/interview-questions/${iq.id}/answer`, { answer: ans.trim() }),
    onSuccess: (r) => {
      qc.setQueryData<InterviewQuestion[]>(qk.ws(wsId, "interview"), (l) =>
        l?.map((x) => (x.id === r.id ? r : x)),
      );
      void qc.invalidateQueries({ queryKey: qk.credits });
      toast.success("Feedback ready");
    },
    onError: (e) => {
      haptic("warning");
      toastError(e);
    },
  });
  return { ans, setAns, m };
}
const diffTone = (d: string) => (d === "easy" ? "success" : d === "medium" ? "warning" : "danger");

/** Full-screen, one question per screen. */
function PracticeView({ wsId, list, onClose }: { wsId: string; list: InterviewQuestion[]; onClose: () => void }) {
  const [i, setI] = useState(0);
  const iq = list[Math.min(i, list.length - 1)]!;
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  return (
    <div role="dialog" aria-modal aria-label="Interview practice" className="pt-safe pb-safe fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex min-h-14 items-center gap-2 border-b border-border px-2">
        <button aria-label="Close practice" onClick={onClose} className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-accent">
          <X className="h-5 w-5" />
        </button>
        <p className="min-w-0 flex-1 truncate font-semibold">
          Question {i + 1} of {list.length}
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-1.5 px-4 pt-3" aria-hidden>
        {list.map((q, k) => (
          <span
            key={q.id}
            className={cn(
              "h-2 w-2 rounded-full",
              k === i ? "bg-primary" : q.answerScore != null ? "bg-success" : "bg-border",
            )}
          />
        ))}
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <PracticeQuestion key={iq.id} wsId={wsId} iq={list.find((x) => x.id === iq.id) ?? iq} />
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-border p-3">
        <ActionButton variant="secondary" disabled={i === 0} onClick={() => setI(i - 1)}>
          <ChevronLeft className="h-4 w-4" /> Previous
        </ActionButton>
        {i < list.length - 1 ? (
          <ActionButton onClick={() => setI(i + 1)}>
            Next <ChevronRight className="h-4 w-4" />
          </ActionButton>
        ) : (
          <ActionButton onClick={onClose}>Finish</ActionButton>
        )}
      </div>
    </div>
  );
}
function PracticeQuestion({ wsId, iq }: { wsId: string; iq: InterviewQuestion }) {
  const { ans, setAns, m } = useAnswer(wsId, iq);
  const [ideal, setIdeal] = useState(false);
  return (
    <div className="mx-auto max-w-lg space-y-3">
      <div className="flex flex-wrap gap-1.5">
        <Badge>{categoryLabel(iq.type)}</Badge>
        <Badge tone={diffTone(iq.difficulty)}>{categoryLabel(iq.difficulty)}</Badge>
      </div>
      <h2 className="h2 break-words">{iq.question}</h2>
      {iq.whyAsked && <p className="caption"><b>What they're testing:</b> {iq.whyAsked}</p>}
      <textarea
        value={ans}
        maxLength={5000}
        onChange={(e) => setAns(e.target.value)}
        rows={7}
        placeholder="Type your answer (at least 20 characters)"
        className="w-full rounded-lg border border-input bg-card p-3 text-base"
        aria-label="Your answer"
      />
      <p className="caption text-right">{ans.trim().length} / 20 min</p>
      <ActionButton size="full" disabled={ans.trim().length < 20} loading={m.isPending} onClick={() => m.mutate()}>
        Get feedback — {FEEDBACK_COST} credit
      </ActionButton>
      {iq.answerScore != null && (
        <div className="rounded-lg bg-muted p-3">
          <p className={cn("font-display text-2xl font-bold", scoreText(iq.answerScore))}>{iq.answerScore}/100</p>
          {iq.aiFeedback && <p className="body-text mt-1 whitespace-pre-wrap">{iq.aiFeedback}</p>}
        </div>
      )}
      <button className="min-h-11 text-sm font-semibold text-primary" onClick={() => setIdeal((v) => !v)}>
        {ideal ? "Hide ideal answer" : "Show ideal answer"}
      </button>
      {ideal && <p className="body-text whitespace-pre-wrap rounded-lg bg-accent p-3">{iq.idealAnswer}</p>}
    </div>
  );
}

function QuestionCard({ wsId, iq }: { wsId: string; iq: InterviewQuestion }) {
  const { ans, setAns, m } = useAnswer(wsId, iq);
  const [ideal, setIdeal] = useState(false);
  const dTone =
    iq.difficulty === "easy" ? "success" : iq.difficulty === "medium" ? "warning" : "danger";
  return (
    <Collapsible
      title={
        <span className="block text-sm font-semibold leading-snug">
          {iq.question}
          <span className="mt-1 flex gap-1.5">
            <Badge>{categoryLabel(iq.type)}</Badge>
            <Badge tone={dTone}>{categoryLabel(iq.difficulty)}</Badge>
          </span>
        </span>
      }
    >
      <div className="space-y-3">
        {iq.whyAsked && (
          <p className="caption">
            <b>What they're testing:</b> {iq.whyAsked}
          </p>
        )}
        {iq.basedOn && <p className="caption italic">Based on your resume: "{iq.basedOn}"</p>}
        <textarea
          value={ans}
          maxLength={5000}
          onChange={(e) => setAns(e.target.value)}
          rows={5}
          placeholder="Type your answer (at least 20 characters)"
          className="w-full rounded-lg border border-input bg-card p-3 text-base"
          aria-label="Your answer"
        />
        <p className="caption text-right">{ans.trim().length} / 20 min</p>
        <ActionButton
          size="full"
          disabled={ans.trim().length < 20}
          loading={m.isPending}
          onClick={() => m.mutate()}
        >
          Get feedback — {FEEDBACK_COST} credit
        </ActionButton>
        {iq.answerScore != null && (
          <div className="rounded-lg bg-muted p-3">
            <p
              className={cn(
                "font-display text-xl font-bold",
                iq.answerScore >= 75
                  ? "text-success"
                  : iq.answerScore >= 50
                    ? "text-primary"
                    : "text-warning",
              )}
            >
              {iq.answerScore}/100
            </p>
            {iq.aiFeedback && <p className="body-text mt-1 whitespace-pre-wrap">{iq.aiFeedback}</p>}
          </div>
        )}
        <button
          className="min-h-11 text-sm font-semibold text-primary"
          onClick={() => setIdeal((v) => !v)}
        >
          {ideal ? "Hide ideal answer" : "Reveal ideal answer"}
        </button>
        {ideal && (
          <p className="body-text whitespace-pre-wrap rounded-lg bg-accent p-3">{iq.idealAnswer}</p>
        )}
      </div>
    </Collapsible>
  );
}

// ── Company / Salary / Learning ───────────────────────────────────────
function CompanyTab({ wsId }: { wsId: string }) {
  const q = useQuery({
    queryKey: qk.ws(wsId, "company"),
    queryFn: () => api.get<CompanyInsight>(`/workspaces/${wsId}/company-insight`),
  });
  return (
    <Gate q={q}>
      {(c) => (
        <div className="space-y-3">
          <Card>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="h3">{c.companyName}</h3>
              <Badge>{c.confidence} confidence</Badge>
            </div>
            <p className="body-text whitespace-pre-wrap">{c.overview}</p>
          </Card>
          <ListCard title="Culture" items={c.culture} />
          <ListCard title="Talking points & tips" items={c.talkingPoints} />
          {c.sources?.length > 0 && (
            <Card>
              <h3 className="h3 mb-2">Sources</h3>
              {c.sources.map((s) => (
                <button
                  key={s}
                  onClick={() => void openExternal(s)}
                  className="flex min-h-11 w-full items-center gap-2 text-left text-sm font-medium text-primary"
                >
                  <span className="min-w-0 flex-1 truncate">{sourceDomain(s)}</span>
                  <ExternalLink className="h-4 w-4 shrink-0" />
                </button>
              ))}
            </Card>
          )}
        </div>
      )}
    </Gate>
  );
}

function SalaryTab({ wsId }: { wsId: string }) {
  const q = useQuery({
    queryKey: qk.ws(wsId, "salary"),
    queryFn: () => api.get<SalaryEstimate>(`/workspaces/${wsId}/salary-estimate`),
  });
  const profile = useQuery({ queryKey: qk.profile, queryFn: () => api.get<Profile>("/profiles/me") });
  const myCur = profile.data?.salaryCurrency;
  const fmt = (n: number, cur: string) => {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: cur,
        maximumFractionDigits: 0,
      }).format(n);
    } catch {
      return `${n} ${cur}`;
    }
  };
  return (
    <Gate q={q}>
      {(s) => {
        const lo = s.p25 * 0.85,
          hi = s.p75 * 1.15,
          pos = (v: number) => ((v - lo) / (hi - lo)) * 100;
        return (
          <div className="space-y-3">
            <Card className="space-y-4">
              <div className="text-center">
                <p className="caption">Median estimate</p>
                {myCur && myCur.toUpperCase() !== s.currency.toUpperCase() && (
                  <p className="caption mt-0.5">Estimate in {s.currency.toUpperCase()}</p>
                )}
                <p className="font-display text-3xl font-bold text-primary">
                  {fmt(s.p50, s.currency)}
                </p>
              </div>
              <div className="relative h-3 rounded-full bg-border/70">
                <div
                  className="absolute h-3 rounded-full bg-primary/30"
                  style={{ left: `${pos(s.p25)}%`, width: `${pos(s.p75) - pos(s.p25)}%` }}
                />
                <div
                  className="absolute -top-1 h-5 w-1.5 rounded bg-primary"
                  style={{ left: `${pos(s.p50)}%` }}
                />
              </div>
              <div className="flex flex-wrap justify-between gap-x-3 text-sm">
                <span>P25 {fmt(s.p25, s.currency)}</span>
                <span>P75 {fmt(s.p75, s.currency)}</span>
              </div>
              <p className="caption rounded-lg bg-warning/10 p-2 text-center">
                Estimate only — actual offers vary.
              </p>
            </Card>
            {s.methodology && (
              <Card>
                <h3 className="h3 mb-2">How we estimated</h3>
                <p className="body-text">{s.methodology}</p>
              </Card>
            )}
            <ListCard title="Factors" items={s.factors} />
            <ListCard title="Negotiation tips" items={s.negotiationTips} />
          </div>
        );
      }}
    </Gate>
  );
}

function LearningTab({ wsId }: { wsId: string }) {
  const q = useQuery({
    queryKey: qk.ws(wsId, "learning"),
    queryFn: () => api.get<LearningRoadmap>(`/workspaces/${wsId}/learning-roadmap`),
  });
  const key = `tp-learning-${wsId}`;
  const [done, setDone] = useState<Set<number>>(new Set());
  useEffect(() => {
    try {
      setDone(new Set(JSON.parse(localStorage.getItem(key) ?? "[]") as number[]));
    } catch {
      /* ignore */
    }
  }, [key]);
  const flip = (i: number, v: boolean) =>
    setDone((cur) => {
      const n = new Set(cur);
      if (v) n.add(i);
      else n.delete(i);
      try {
        localStorage.setItem(key, JSON.stringify([...n]));
      } catch {
        /* ignore */
      }
      return n;
    });
  return (
    <Gate q={q}>
      {(r) =>
        r.items.length === 0 ? (
          <EmptyState title="No gaps to learn — nice!" />
        ) : (
          <ol className="space-y-3">
            <li className="space-y-1.5">
              <p className="text-sm font-semibold">
                {r.items.filter((_, i) => done.has(i)).length} of {r.items.length} done
              </p>
              <ProgressBar value={(r.items.filter((_, i) => done.has(i)).length / r.items.length) * 100} />
            </li>
            {r.items.map((it, i) => {
              const url = it.affiliateUrl ?? it.url;
              return (
                <Card key={i} className="space-y-1.5">
                  <div className="flex items-start gap-3">
                    <CheckBox checked={done.has(i)} label={`Mark "${it.title}" done`} onChange={(v) => flip(i, v)} />
                    <div className="min-w-0 flex-1">
                      <p className={cn("font-semibold", done.has(i) && "text-muted-foreground line-through")}>{it.title}</p>
                      <p className="caption">{it.gapReason}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <Badge tone={it.priority === "required" ? "danger" : "primary"}>
                          {categoryLabel(it.priority)}
                        </Badge>
                        <Badge>{categoryLabel(it.resourceType)}</Badge>
                        <Badge>~{it.estHours}h</Badge>
                      </div>
                    </div>
                  </div>
                  {url && (
                    <button
                      onClick={() => void openExternal(url)}
                      className="flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"
                    >
                      <ExternalLink className="h-4 w-4" /> Open resource
                    </button>
                  )}
                </Card>
              );
            })}
          </ol>
        )
      }
    </Gate>
  );
}

function categoryLabel(value: string) {
  if (value.toLowerCase() === "hr") return "HR";
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function sourceDomain(source: string) {
  try {
    return new URL(source).hostname.replace(/^www\./, "");
  } catch {
    return source.replace(/^https?:\/\//, "").split("/")[0] ?? source;
  }
}

export function useIsMounted() {
  const r = useRef(true);
  useEffect(() => () => void (r.current = false), []);
  return r;
}
