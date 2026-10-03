import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { LineChart, Plus } from "lucide-react";
import { z } from "zod";
import { qk, useList } from "@/lib/queries";
import { openNewAnalysis } from "@/lib/stores";
import { useState } from "react";
import { AnalysisSubtitle, bandOf, Chip, flat, InfiniteList, ListSearch, matches, scoreText } from "@/components/app";
import { Button, Card, EmptyState } from "@/components/ui/tp";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { AtsReport } from "@/types/api";
import { WsStatusBadge } from "@/lib/resumeUi";
import { cn } from "@/lib/utils";
import type { Workspace, WorkspaceStatus } from "@/types/api";

const FILTERS = {
  all: null,
  running: ["queued", "processing"],
  complete: ["completed", "partial"],
  failed: ["failed"],
} as const satisfies Record<string, readonly WorkspaceStatus[] | null>;
type FilterKey = keyof typeof FILTERS;

export const Route = createFileRoute("/_app/analyses/")({
  validateSearch: z.object({ filter: z.enum(["all", "running", "complete", "failed"]).optional() }),
  head: () => ({
    meta: [
      { title: "Analyses — TalentPilot" },
      { name: "description", content: "Your resume-to-job analyses and ATS scores." },
      { property: "og:title", content: "Analyses — TalentPilot" },
      { property: "og:description", content: "Your resume-to-job analyses and ATS scores." },
    ],
  }),
  component: AnalysesPage,
});

function AnalysesPage() {
  const { filter = "all" } = Route.useSearch();
  const nav = useNavigate();
  const q = useList<Workspace>(qk.workspaces, "/workspaces");
  const allowed = FILTERS[filter] as readonly WorkspaceStatus[] | null;
  const all = flat(q.data);
  const [term, setTerm] = useState("");
  const items = all.filter((w) => (!allowed || allowed.includes(w.status)) && matches(term, w.name));

  return (
    <div>
      <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
        {(Object.keys(FILTERS) as FilterKey[]).map((f) => (
          <Chip
            key={f}
            active={filter === f}
            onClick={() =>
              void nav({ to: "/analyses", search: f === "all" ? {} : { filter: f }, replace: true })
            }
          >
            {f}
          </Chip>
        ))}
      </div>
      {all.length > 6 && <ListSearch value={term} onChange={setTerm} placeholder="Search analyses" />}
      <InfiniteList
        q={q}
        items={items}
        empty={
          <EmptyState
            icon={<LineChart className="h-7 w-7" />}
            title={filter === "all" ? "No analyses yet" : `No ${filter} analyses`}
            description={
              filter === "all"
                ? "Pick a resume and a job to see your ATS score, suggested edits and more."
                : "Try another filter."
            }
            action={
              filter === "all" ? (
                <Button onClick={() => openNewAnalysis()}>
                  <Plus className="h-4 w-4" /> New analysis
                </Button>
              ) : undefined
            }
          />
        }
        render={(w) => (
          <Link key={w.id} to="/analyses/$id" params={{ id: w.id }} className="block">
            <Card className="flex min-h-14 items-center gap-3 p-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{w.name}</span>
                <span className="mt-1 flex min-w-0 items-center gap-2">
                  <WsStatusBadge s={w.status} />
                  <AnalysisSubtitle workspaceId={w.id} resumeId={w.resumeId} date={w.createdAt} />
                </span>
              </span>
              {w.overallScore != null && <ScoreCell wsId={w.id} score={w.overallScore} />}
            </Card>
          </Link>
        )}
      />
    </div>
  );
}

/** Score + band + delta vs original (delta from the cached/lazily fetched report). */
function ScoreCell({ wsId, score }: { wsId: string; score: number }) {
  const r = useQuery({
    queryKey: ["workspace", wsId, "report"],
    queryFn: () => api.get<AtsReport>(`/workspaces/${wsId}/report`),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const delta = r.data?.original ? Math.round(r.data.overallScore - r.data.original.overallScore) : 0;
  return (
    <span className="flex shrink-0 flex-col items-end text-right">
      <span className={cn("font-display text-xl font-extrabold leading-tight", scoreText(score))}>{Math.round(score)}</span>
      <span className="caption whitespace-nowrap">{bandOf(score)} match</span>
      {delta !== 0 && (
        <span className={cn("whitespace-nowrap text-xs font-semibold", delta > 0 ? "text-success" : "text-destructive")}>
          {delta > 0 ? `▲ +${delta}` : `▼ ${delta}`}
        </span>
      )}
    </span>
  );
}
