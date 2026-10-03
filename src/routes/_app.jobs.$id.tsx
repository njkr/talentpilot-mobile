import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Loader2, RotateCw, Sparkles, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { qk } from "@/lib/queries";
import { toastError } from "@/lib/errors";
import { openNewAnalysis } from "@/lib/stores";
import {
  ActionButton,
  ActionSheet,
  CardSkeletons,
  ConfirmSheet,
  ErrorState,
  PageHeader,
} from "@/components/app";
import { Badge, BottomSheet, Card, Input } from "@/components/ui/tp";
import { JobStatusBadge } from "@/lib/resumeUi";
import { displayPosition } from "@/components/GlobalSheets";
import type { Importance, JobDescription } from "@/types/api";

export const Route = createFileRoute("/_app/jobs/$id")({
  head: () => ({
    meta: [
      { title: "Job — TalentPilot" },
      { name: "description", content: "Requirements, skills and keywords for this job." },
      { property: "og:title", content: "Job — TalentPilot" },
      { property: "og:description", content: "Requirements, skills and keywords for this job." },
    ],
  }),
  component: JobDetail,
});

const IMP: Record<Importance, { tone: "danger" | "primary" | "neutral"; label: string }> = {
  required: { tone: "danger", label: "Required" },
  preferred: { tone: "primary", label: "Preferred" },
  nice_to_have: { tone: "neutral", label: "Nice to have" },
};
export const ImportanceBadge = ({ i }: { i: Importance }) => (
  <Badge tone={IMP[i]?.tone ?? "neutral"}>{IMP[i]?.label ?? i}</Badge>
);

const busy = (s?: string) => s === "pending" || s === "analyzing";

function JobDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [del, setDel] = useState(false);
  const [fix, setFix] = useState(false);
  const [pos, setPos] = useState("");
  const [comp, setComp] = useState("");
  const q = useQuery({
    queryKey: qk.job(id),
    queryFn: () => api.get<JobDescription>(`/job-descriptions/${id}`),
    refetchInterval: (query) => (busy(query.state.data?.status) ? 2000 : false),
  });
  useEffect(() => {
    if (q.data && !busy(q.data.status)) void qc.invalidateQueries({ queryKey: qk.jobs });
  }, [q.data?.status, qc]); // eslint-disable-line react-hooks/exhaustive-deps

  const retry = useMutation({
    mutationFn: () => api.post<JobDescription>(`/job-descriptions/${id}/retry`),
    onSuccess: (j) => {
      qc.setQueryData(qk.job(id), j);
      toast.success("Analyzing again");
    },
    onError: (e) => toastError(e),
  });
  const remove = useMutation({
    mutationFn: () => api.delete(`/job-descriptions/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.jobs });
      toast.success("Job deleted");
      void nav({ to: "/jobs", replace: true });
    },
    onError: (e) => {
      setDel(false);
      toastError(e);
    },
  });
  const patch = useMutation({
    mutationFn: () =>
      api.patch<JobDescription>(`/job-descriptions/${id}`, {
        ...(pos.trim() ? { position: pos.trim() } : {}),
        ...(comp.trim() ? { company: comp.trim() } : {}),
      }),
    onSuccess: (j) => {
      qc.setQueryData(qk.job(id), j);
      void qc.invalidateQueries({ queryKey: qk.jobs });
      setFix(false);
      toast.success("Details saved");
    },
    onError: (e) => toastError(e),
  });

  if (q.isPending)
    return (
      <>
        <PageHeader title="Job" />
        <CardSkeletons count={4} h="h-24" />
      </>
    );
  if (q.isError)
    return (
      <>
        <PageHeader title="Job" />
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      </>
    );
  const j = q.data;
  const p = j.parsedData;

  return (
    <div className="space-y-3">
      <PageHeader
        title={displayPosition(j.position)}
        right={
          <ActionSheet
            title="Job"
            actions={[
              {
                label: "Delete",
                danger: true,
                icon: <Trash2 className="h-5 w-5" />,
                onSelect: () => setDel(true),
              },
            ]}
          />
        }
      />
      <Card className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{j.company ?? "Unknown company"}</p>
          <p className="caption">
            {[j.location, j.remoteType, j.employmentType?.replace("_", " "), j.experienceRequired]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <JobStatusBadge s={j.status} />
      </Card>

      {busy(j.status) ? (
        <Card className="space-y-3 py-8 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="h3">Analyzing the job…</p>
        </Card>
      ) : j.status === "failed" ? (
        <Card className="space-y-3 text-center">
          <p className="h3">We couldn't analyze this job</p>
          <p className="body-text">{j.parseError ?? "Something went wrong."}</p>
          <ActionButton size="full" loading={retry.isPending} onClick={() => retry.mutate()}>
            <RotateCw className="h-4 w-4" /> Retry
          </ActionButton>
        </Card>
      ) : (
        <>
          {j.missingFields.length > 0 && (
            <button
              onClick={() => {
                setPos(j.position === "Untitled position" ? "" : j.position);
                setComp(j.company ?? "");
                setFix(true);
              }}
              className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-warning/40 bg-warning/10 p-3 text-left"
            >
              <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
              <span className="flex-1 text-sm font-medium">
                Add the missing details for better results
              </span>
            </button>
          )}
          <ActionButton size="full" onClick={() => openNewAnalysis({ jobId: id })}>
            <Sparkles className="h-4 w-4" /> Analyze with my resume
          </ActionButton>
          {p && (
            <>
              {p.requirements.length > 0 && (
                <Card>
                  <h2 className="h3 mb-2">Requirements</h2>
                  <ul className="space-y-2">
                    {p.requirements.map((r, i) => (
                      <li key={i} className="flex items-start justify-between gap-2 text-sm">
                        <span>{r.text}</span>
                        <ImportanceBadge i={r.importance} />
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
              {p.skills.length > 0 && (
                <Card>
                  <h2 className="h3 mb-2">Skills</h2>
                  {(["required", "preferred", "nice_to_have"] as Importance[]).map((imp) => {
                    const list = p.skills.filter((s) => s.importance === imp);
                    if (!list.length) return null;
                    return (
                      <div key={imp} className="mb-3">
                        <p className="caption mb-1.5 font-semibold">{IMP[imp].label}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {list.map((s) => (
                            <Badge key={s.name} tone={IMP[imp].tone}>
                              {s.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </Card>
              )}
              {p.responsibilities.length > 0 && (
                <Card>
                  <h2 className="h3 mb-2">Responsibilities</h2>
                  <ul className="body-text list-disc space-y-1 pl-5">
                    {p.responsibilities.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </Card>
              )}
              {p.keywords.length > 0 && (
                <Card>
                  <h2 className="h3 mb-2">Keywords</h2>
                  <div className="flex flex-wrap gap-1.5">
                    {p.keywords.map((k) => (
                      <Badge key={k}>{k}</Badge>
                    ))}
                  </div>
                </Card>
              )}
            </>
          )}
        </>
      )}

      <ConfirmSheet
        open={del}
        onClose={() => setDel(false)}
        title="Delete this job?"
        confirmLabel="Delete"
        danger
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
      <BottomSheet open={fix} onClose={() => setFix(false)} title="Missing details">
        <div className="space-y-3">
          <Input
            label="Position"
            value={pos}
            maxLength={200}
            onChange={(e) => setPos(e.target.value)}
          />
          <Input
            label="Company"
            value={comp}
            maxLength={200}
            onChange={(e) => setComp(e.target.value)}
          />
          <ActionButton
            size="full"
            disabled={!pos.trim() && !comp.trim()}
            loading={patch.isPending}
            onClick={() => patch.mutate()}
          >
            Save
          </ActionButton>
        </div>
      </BottomSheet>
    </div>
  );
}
