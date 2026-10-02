import { useEffect, useState } from "react";
import { Link, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BriefcaseBusiness, Check, ExternalLink, FileText, Zap } from "lucide-react";
import { api } from "@/lib/api";
import { closeNewAnalysis, closeTopSheet, closeUpgrade, onlineStore, useNewAnalysis, useUpgrade } from "@/lib/stores";
import { exitApp, onBackButton, onNetworkChange, openExternal, WEB_BILLING_URL, initNativeChrome } from "@/lib/native";
import { toastError } from "@/lib/errors";
import { qk, useList, ANALYZE_COST } from "@/lib/queries";
import { ActionButton, flat, Gauge } from "@/components/app";
import { BottomSheet, Button, Skeleton } from "@/components/ui/tp";
import { cn } from "@/lib/utils";
import type { CreditBalance, JobDescription, MatchResponse, Resume, Workspace } from "@/types/api";

export function UpgradeSheet() {
  const info = useUpgrade();
  return (
    <BottomSheet open={!!info} onClose={closeUpgrade} title="Upgrade to continue">
      {info?.kind === "credits" ? (
        <div className="space-y-3">
          <p className="body-text">You don't have enough credits for this action.</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-muted p-3 text-center">
              <p className="caption">Required</p>
              <p className="font-display text-2xl font-bold">{info.required ?? "—"}</p>
            </div>
            <div className="rounded-xl bg-muted p-3 text-center">
              <p className="caption">Your balance</p>
              <p className="font-display text-2xl font-bold">{info.balance ?? "—"}</p>
            </div>
          </div>
        </div>
      ) : info ? (
        <div className="space-y-3">
          <p className="body-text">You've reached your plan's limit{info.feature ? ` for ${info.feature}` : ""}.</p>
          <div className="rounded-xl bg-muted p-3 text-center">
            <p className="caption">Used</p>
            <p className="font-display text-2xl font-bold">
              {info.current ?? "—"} / {info.limit ?? "—"}
            </p>
          </div>
        </div>
      ) : null}
      <div className="mt-5 space-y-3">
        <Button size="full" onClick={() => void openExternal(WEB_BILLING_URL)}>
          <ExternalLink className="h-4 w-4" /> Manage plan on web
        </Button>
        <Button variant="secondary" size="full" onClick={closeUpgrade}>
          Not now
        </Button>
      </div>
    </BottomSheet>
  );
}

export const displayPosition = (p: string) => (p === "Untitled position" ? "Untitled role" : p);

export function NewAnalysisSheet() {
  const init = useNewAnalysis();
  const open = !!init;
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const nav = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (init) {
      setResumeId(init.resumeId ?? null);
      setJobId(init.jobId ?? null);
    }
  }, [init]);

  const resumes = useList<Resume>(qk.resumes, "/resumes");
  const jobs = useList<JobDescription>(qk.jobs, "/job-descriptions");
  const credits = useQuery({ queryKey: qk.credits, queryFn: () => api.get<CreditBalance>("/credits"), enabled: open });
  const parsed = flat(resumes.data).filter((r) => r.status === "parsed");
  const analyzed = flat(jobs.data).filter((j) => j.status === "analyzed");
  const match = useQuery({
    queryKey: ["match", resumeId, jobId],
    queryFn: () => api.post<MatchResponse>(`/resumes/${resumeId}/match/${jobId}`),
    enabled: open && !!resumeId && !!jobId,
    staleTime: 5 * 60_000,
  });

  const create = useMutation({
    mutationFn: () => {
      const j = analyzed.find((x) => x.id === jobId);
      const name = `${j?.company ?? "Company"} — ${displayPosition(j?.position ?? "Role")}`.slice(0, 200);
      return api.post<Workspace>("/workspaces", { resumeId, jobDescriptionId: jobId, name });
    },
    onSuccess: (w) => {
      void qc.invalidateQueries({ queryKey: qk.workspaces });
      void qc.invalidateQueries({ queryKey: qk.dashboard });
      toast.success("Analysis created");
      closeNewAnalysis();
      void nav({ to: "/analyses/$id", params: { id: w.id } });
    },
    onError: (e) => toastError(e, { RESUME_NOT_PARSED: "That resume isn't ready yet.", JD_NOT_ANALYZED: "That job isn't analyzed yet." }),
  });

  const cov = match.data?.coverage;
  const pct = cov && cov.requiredTotal > 0 ? (cov.requiredMatched / cov.requiredTotal) * 100 : match.data ? match.data.semanticScore * (match.data.semanticScore <= 1 ? 100 : 1) : 0;
  const bal = credits.data?.balance;

  return (
    <BottomSheet open={open} onClose={closeNewAnalysis} title="New analysis">
      <div className="space-y-5">
        <section>
          <h3 className="caption mb-2 font-semibold uppercase tracking-wide">1. Resume</h3>
          {resumes.isPending ? (
            <Skeleton className="h-14 w-full" />
          ) : parsed.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-4 text-center">
              <p className="body-text">No ready resumes yet.</p>
              <Link to="/resumes" onClick={closeNewAnalysis} className="mt-2 inline-flex min-h-11 items-center font-semibold text-primary">
                Upload a resume
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {parsed.map((r) => (
                <Pick key={r.id} active={resumeId === r.id} onClick={() => setResumeId(r.id)} icon={<FileText className="h-5 w-5" />} title={r.title} sub={`${r.pageCount ?? "?"} ${r.pageCount === 1 ? "page" : "pages"} · ${r.wordCount ?? "?"} words`} />
              ))}
            </div>
          )}
        </section>
        <section>
          <h3 className="caption mb-2 font-semibold uppercase tracking-wide">2. Job</h3>
          {jobs.isPending ? (
            <Skeleton className="h-14 w-full" />
          ) : analyzed.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-4 text-center">
              <p className="body-text">No analyzed jobs yet.</p>
              <Link to="/jobs/new" onClick={closeNewAnalysis} className="mt-2 inline-flex min-h-11 items-center font-semibold text-primary">
                Add a job
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {analyzed.map((j) => (
                <Pick key={j.id} active={jobId === j.id} onClick={() => setJobId(j.id)} icon={<BriefcaseBusiness className="h-5 w-5" />} title={displayPosition(j.position)} sub={j.company ?? "Unknown company"} />
              ))}
            </div>
          )}
        </section>

        {resumeId && jobId && (
          <section className="rounded-xl bg-muted p-4 text-center">
            {match.isPending ? (
              <Skeleton className="mx-auto h-24 w-40" />
            ) : match.isError ? (
              <p className="caption">Match preview unavailable.</p>
            ) : (
              <>
                <Gauge pct={pct} />
                {cov && cov.requiredTotal > 0 && (
                  <p className="body-text mt-1">
                    Matches {cov.requiredMatched} of {cov.requiredTotal} required skills
                  </p>
                )}
              </>
            )}
          </section>
        )}

        <div className="flex items-center justify-between rounded-xl border border-border p-3 text-sm">
          <span>Analysis costs {ANALYZE_COST} credits</span>
          <span className="inline-flex items-center gap-1 font-semibold">
            <Zap className="h-4 w-4 text-primary" /> {bal ?? "—"} available
          </span>
        </div>
        <ActionButton size="full" disabled={!resumeId || !jobId} loading={create.isPending} onClick={() => create.mutate()}>
          Create analysis
        </ActionButton>
      </div>
    </BottomSheet>
  );
}

function Pick({ active, onClick, icon, title, sub }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; sub: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex min-h-14 w-full items-center gap-3 rounded-xl border p-3 text-left",
        active ? "border-primary bg-accent" : "border-border bg-card",
      )}
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{title}</span>
        <span className="caption block truncate">{sub}</span>
      </span>
      {active && <Check className="h-5 w-5 text-primary" />}
    </button>
  );
}

const TAB_ROOTS = ["/resumes", "/jobs", "/analyses", "/me"];

/** Network listener, native chrome and Android back button. */
export function NativeBridge() {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => onNetworkChange((o) => onlineStore.set(o)), []);
  useEffect(() => void initNativeChrome(), []);
  useEffect(
    () =>
      onBackButton(() => {
        if (closeTopSheet()) return;
        if (pathname === "/" || pathname === "/login") return void exitApp();
        if (TAB_ROOTS.includes(pathname)) return void router.navigate({ to: "/" });
        router.history.back();
      }),
    [pathname, router],
  );
  return null;
}
