import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Pencil, RotateCw, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { qk } from "@/lib/queries";
import { toastError } from "@/lib/errors";
import { openNewAnalysis } from "@/lib/stores";
import {
  ActionButton,
  ActionSheet,
  CardSkeletons,
  Collapsible,
  ErrorState,
  fmtDate,
  PageHeader,
} from "@/components/app";
import { Badge, BottomSheet, Card } from "@/components/ui/tp";
import { ResumeStatusBadge } from "@/lib/resumeUi";
import type {
  CertificationItem,
  EducationItem,
  ExperienceItem,
  LanguageItem,
  PersonalInfoContent,
  ProjectItem,
  Resume,
  ResumeSection,
  SectionType,
} from "@/types/api";

export const Route = createFileRoute("/_app/resumes/$id")({
  head: () => ({
    meta: [
      { title: "Resume — TalentPilot" },
      { name: "description", content: "Your parsed resume sections." },
      { property: "og:title", content: "Resume — TalentPilot" },
      { property: "og:description", content: "Your parsed resume sections." },
    ],
  }),
  component: ResumeDetail,
});

const LABELS: Record<SectionType, string> = {
  personal_info: "Personal info",
  summary: "Summary",
  skills: "Skills",
  experience: "Experience",
  projects: "Projects",
  education: "Education",
  certifications: "Certifications",
  languages: "Languages",
};
const done = (s?: string) => s === "parsed" || s === "failed";

function ResumeDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [since] = useState(() => Date.now());
  const [now, setNow] = useState(Date.now());
  const q = useQuery({
    queryKey: qk.resume(id),
    queryFn: () => api.get<Resume>(`/resumes/${id}`),
    refetchInterval: (query) => (done(query.state.data?.status) ? false : 2000),
  });
  useEffect(() => {
    if (done(q.data?.status)) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [q.data?.status]);
  const parsed = q.data?.status === "parsed";
  const sections = useQuery({
    queryKey: qk.sections(id),
    queryFn: () => api.get<ResumeSection[]>(`/resumes/${id}/sections`),
    enabled: parsed,
  });
  useEffect(() => {
    if (done(q.data?.status)) void qc.invalidateQueries({ queryKey: qk.resumes });
  }, [q.data?.status, qc]);

  const retry = useMutation({
    mutationFn: () => api.post<Resume>(`/resumes/${id}/retry`),
    onSuccess: (r) => {
      qc.setQueryData(qk.resume(id), r);
      toast.success("Parsing again");
    },
    onError: (e) => toastError(e),
  });

  if (q.isPending)
    return (
      <>
        <PageHeader title="Resume" />
        <CardSkeletons count={4} h="h-24" />
      </>
    );
  if (q.isError)
    return (
      <>
        <PageHeader title="Resume" />
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      </>
    );
  const r = q.data;

  return (
    <div className="space-y-3">
      <PageHeader
        title={r.title}
        right={
          <ActionSheet
            title="Resume"
            actions={[
              {
                label: "Use in new analysis",
                icon: <Sparkles className="h-5 w-5" />,
                onSelect: () => openNewAnalysis({ resumeId: id }),
              },
              {
                label: "Retry parsing",
                icon: <RotateCw className="h-5 w-5" />,
                hidden: r.status !== "failed",
                onSelect: () => retry.mutate(),
              },
            ]}
          />
        }
      />
      <Card className="flex items-center justify-between">
        <div className="caption space-y-0.5">
          <p>
            {r.pageCount ?? "–"} {r.pageCount === 1 ? "page" : "pages"} · {r.wordCount ?? "–"} words
          </p>
          <p>
            {(r.fileSize / 1024).toFixed(0)} KB · {r.language?.toUpperCase() ?? "—"} ·{" "}
            {fmtDate(r.createdAt)}
          </p>
        </div>
        <ResumeStatusBadge s={r.status} />
      </Card>

      {r.status === "failed" ? (
        <Card className="space-y-3 text-center">
          <p className="h3">We couldn't read this resume</p>
          <p className="body-text">{r.parseError ?? "Something went wrong while parsing."}</p>
          <ActionButton loading={retry.isPending} onClick={() => retry.mutate()} size="full">
            <RotateCw className="h-4 w-4" /> Retry
          </ActionButton>
        </Card>
      ) : !parsed ? (
        <Card className="space-y-3 py-8 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="h3">Parsing your resume…</p>
          <p className="caption capitalize">{r.status}</p>
          {now - since > 30_000 && (
            <>
              <p className="body-text">This is taking longer than usual.</p>
              <ActionButton
                variant="secondary"
                loading={retry.isPending}
                onClick={() => retry.mutate()}
                size="full"
              >
                <RotateCw className="h-4 w-4" /> Retry
              </ActionButton>
            </>
          )}
        </Card>
      ) : (
        <>
          <ActionButton size="full" onClick={() => openNewAnalysis({ resumeId: id })}>
            <Sparkles className="h-4 w-4" /> Use in new analysis
          </ActionButton>
          {sections.isPending ? (
            <CardSkeletons count={5} h="h-14" />
          ) : sections.isError ? (
            <ErrorState compact error={sections.error} onRetry={() => void sections.refetch()} />
          ) : (
            <SectionList resumeId={id} sections={sections.data} />
          )}
        </>
      )}
    </div>
  );
}

function SectionList({ resumeId, sections }: { resumeId: string; sections: ResumeSection[] }) {
  const map = new Map<string, ResumeSection>();
  for (const s of sections) if (!map.has(s.sectionType)) map.set(s.sectionType, s);
  const list = [...map.values()].sort((a, b) => a.orderIndex - b.orderIndex);
  const [edit, setEdit] = useState(false);
  const summary = map.get("summary") as ResumeSection<"summary"> | undefined;
  const [text, setText] = useState("");
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: () => api.patch(`/resumes/${resumeId}/sections/summary`, { content: { text } }),
    onSuccess: () => {
      setEdit(false);
      void qc.invalidateQueries({ queryKey: qk.sections(resumeId) });
      toast.success("Summary saved");
    },
    onError: (e) => toastError(e),
  });

  return (
    <div className="space-y-3">
      {list.map((s) => (
        <Collapsible
          key={s.sectionType}
          defaultOpen={s.sectionType === "summary" || s.sectionType === "experience"}
          title={
            <span className="flex items-center gap-2">
              {LABELS[s.sectionType] ?? s.sectionType}
              {s.editedByUser && <Badge tone="primary">Edited</Badge>}
            </span>
          }
          right={
            s.sectionType === "summary" ? (
              <button
                aria-label="Edit summary"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-accent"
                onClick={() => {
                  setText(summary?.content.text ?? "");
                  setEdit(true);
                }}
              >
                <Pencil className="h-4 w-4" />
              </button>
            ) : undefined
          }
        >
          <SectionBody s={s} />
        </Collapsible>
      ))}
      <BottomSheet open={edit} onClose={() => setEdit(false)} title="Edit summary">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          className="w-full rounded-lg border border-input bg-card p-3 text-base"
          aria-label="Summary"
        />
        <div className="mt-3">
          <ActionButton size="full" loading={save.isPending} onClick={() => save.mutate()}>
            Save
          </ActionButton>
        </div>
      </BottomSheet>
    </div>
  );
}

const range = (a: string | null, b: string | null, cur?: boolean) =>
  [a, cur ? "Present" : b].filter(Boolean).join(" – ");

function SectionBody({ s }: { s: ResumeSection }) {
  const c = s.content as unknown;
  switch (s.sectionType) {
    case "summary":
      return (
        <p className="body-text whitespace-pre-wrap">
          {(c as { text: string | null }).text || "—"}
        </p>
      );
    case "skills":
      return (
        <div className="flex flex-wrap gap-1.5">
          {(c as string[]).map((k) => (
            <Badge key={k}>{k}</Badge>
          ))}
        </div>
      );
    case "personal_info": {
      const p = c as PersonalInfoContent;
      return (
        <div className="body-text space-y-0.5">
          {[p.fullName, p.email, p.phone, p.location].filter(Boolean).map((v) => (
            <p key={v}>{v}</p>
          ))}
          {p.links.map((l) => (
            <p key={l.url} className="break-all">
              {l.label}: {l.url}
            </p>
          ))}
        </div>
      );
    }
    case "experience":
      return (
        <div className="space-y-4">
          {(c as ExperienceItem[]).map((e, i) => (
            <div key={i}>
              <p className="font-semibold">
                {e.title}
                {e.company ? ` · ${e.company}` : ""}
              </p>
              <p className="caption">
                {range(e.startDate, e.endDate, e.isCurrent)}
                {e.location ? ` · ${e.location}` : ""}
              </p>
              <ul className="body-text mt-1 list-disc space-y-1 pl-5">
                {e.highlights.map((h, j) => (
                  <li key={j}>{h}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      );
    case "projects":
      return (
        <div className="space-y-3">
          {(c as ProjectItem[]).map((p, i) => (
            <div key={i}>
              <p className="font-semibold">{p.name}</p>
              {p.description && <p className="body-text">{p.description}</p>}
              {p.technologies.length > 0 && <p className="caption">{p.technologies.join(", ")}</p>}
            </div>
          ))}
        </div>
      );
    case "education":
      return (
        <div className="space-y-3">
          {(c as EducationItem[]).map((e, i) => (
            <div key={i}>
              <p className="font-semibold">{e.institution}</p>
              <p className="body-text">{[e.degree, e.field].filter(Boolean).join(", ")}</p>
              <p className="caption">{range(e.startDate, e.endDate)}</p>
            </div>
          ))}
        </div>
      );
    case "certifications":
      return (
        <ul className="body-text space-y-1">
          {(c as CertificationItem[]).map((e, i) => (
            <li key={i}>
              {e.name}
              {e.issuer ? ` — ${e.issuer}` : ""}
              {e.date ? ` (${e.date})` : ""}
            </li>
          ))}
        </ul>
      );
    case "languages":
      return (
        <ul className="body-text space-y-1">
          {(c as LanguageItem[]).map((e, i) => (
            <li key={i}>
              {e.name}
              {e.proficiency ? ` — ${e.proficiency}` : ""}
            </li>
          ))}
        </ul>
      );
    default:
      return <pre className="caption whitespace-pre-wrap">{JSON.stringify(c, null, 2)}</pre>;
  }
}
