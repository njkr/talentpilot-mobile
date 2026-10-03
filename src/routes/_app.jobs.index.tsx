import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BriefcaseBusiness, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { toastError } from "@/lib/errors";
import { qk, useList } from "@/lib/queries";
import { ConfirmSheet, flat, fmtDate, InfiniteList, ListSearch, matches, SwipeToDelete } from "@/components/app";
import { Card, EmptyState } from "@/components/ui/tp";
import { JobStatusBadge } from "@/lib/resumeUi";
import { displayPosition } from "@/components/GlobalSheets";
import type { JobDescription } from "@/types/api";

export const Route = createFileRoute("/_app/jobs/")({
  head: () => ({
    meta: [
      { title: "Jobs — TalentPilot" },
      { name: "description", content: "Job descriptions you want to apply for." },
      { property: "og:title", content: "Jobs — TalentPilot" },
      { property: "og:description", content: "Job descriptions you want to apply for." },
    ],
  }),
  component: JobsPage,
});

function JobsPage() {
  const q = useList<JobDescription>(qk.jobs, "/job-descriptions");
  const all = flat(q.data);
  const [term, setTerm] = useState("");
  const [del, setDel] = useState<JobDescription | null>(null);
  const qc = useQueryClient();
  const remove = useMutation({
    mutationFn: (j: JobDescription) => api.delete(`/job-descriptions/${j.id}`),
    onSuccess: () => {
      setDel(null);
      void qc.invalidateQueries({ queryKey: qk.jobs });
      void qc.invalidateQueries({ queryKey: qk.dashboard });
      toast.success("Job deleted");
    },
    onError: (e) => {
      setDel(null);
      toastError(e);
    },
  });
  const items = all.filter((j) => matches(term, j.position, j.company, j.location));
  return (
    <div>
      {all.length > 6 && <ListSearch value={term} onChange={setTerm} placeholder="Search jobs" />}
      <InfiniteList
        q={q}
        items={items}
        empty={
          <EmptyState
            icon={<BriefcaseBusiness className="h-7 w-7" />}
            title="No job descriptions yet"
            description="Paste or upload a job posting to see how well you match."
            action={
              <Link
                to="/jobs/new"
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-4 font-semibold text-primary-foreground"
              >
                <Plus className="h-4 w-4" /> Add job
              </Link>
            }
          />
        }
        render={(j) => (
          <SwipeToDelete onDelete={() => setDel(j)}>
          <Link key={j.id} to="/jobs/$id" params={{ id: j.id }} className="block">
            <Card className="flex min-h-14 items-center gap-3 p-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                <BriefcaseBusiness className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{displayPosition(j.position)}</span>
                <span className="caption block truncate">
                  {[j.company, j.location, j.remoteType].filter(Boolean).join(" · ") ||
                    "Unknown company"}{" "}
                  · {fmtDate(j.createdAt)}
                </span>
              </span>
              <JobStatusBadge s={j.status} />
            </Card>
          </Link>
          </SwipeToDelete>
        )}
      />
      <ConfirmSheet
        open={!!del}
        onClose={() => setDel(null)}
        title="Delete this job?"
        body={del ? displayPosition(del.position) : undefined}
        confirmLabel="Delete"
        danger
        loading={remove.isPending}
        onConfirm={() => del && remove.mutate(del)}
      />
    </div>
  );
}
