import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, Pencil, RotateCw, Trash2, Upload } from "lucide-react";
import { z } from "zod";
import { api, ApiError } from "@/lib/api";
import { qk, useList } from "@/lib/queries";
import { toastError } from "@/lib/errors";
import { useOnline } from "@/lib/stores";
import {
  ActionButton,
  ActionSheet,
  ConfirmSheet,
  flat,
  fmtDate,
  InfiniteList,
  ListSearch,
  matches,
  ProgressBar,
  SwipeToDelete,
} from "@/components/app";
import { BottomSheet, Button, Card, EmptyState, Input } from "@/components/ui/tp";
import {
  FILE_ACCEPT,
  precheckFile,
  ResumeStatusBadge,
  UPLOAD_ERRORS,
  uploadErrorMsg,
} from "@/lib/resumeUi";
import type { Resume, ResumeInUseDetails } from "@/types/api";

export const Route = createFileRoute("/_app/resumes/")({
  validateSearch: z.object({ upload: z.boolean().optional() }),
  head: () => ({
    meta: [
      { title: "Resumes — TalentPilot" },
      { name: "description", content: "Upload and manage your resumes." },
      { property: "og:title", content: "Resumes — TalentPilot" },
      { property: "og:description", content: "Upload and manage your resumes." },
    ],
  }),
  component: ResumesPage,
});

function ResumesPage() {
  const q = useList<Resume>(qk.resumes, "/resumes");
  const qc = useQueryClient();
  const nav = useNavigate();
  const { upload: autoOpen } = Route.useSearch();
  const fileRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [rename, setRename] = useState<Resume | null>(null);
  const [title, setTitle] = useState("");
  const [del, setDel] = useState<Resume | null>(null);
  const [inUse, setInUse] = useState<ResumeInUseDetails["workspaces"] | null>(null);
  const online = useOnline();
  const all = flat(q.data);
  const [term, setTerm] = useState("");
  const items = all.filter((r) => matches(term, r.title));
  const inval = () => {
    void qc.invalidateQueries({ queryKey: qk.resumes });
    void qc.invalidateQueries({ queryKey: qk.dashboard });
  };

  useEffect(() => {
    if (autoOpen) fileRef.current?.click();
  }, [autoOpen]);

  const upload = useMutation({
    mutationFn: (f: File) => api.uploadWithProgress<Resume>("/resumes/upload", f, setProgress),
    onSuccess: (r) => {
      setProgress(null);
      inval();
      toast.success("Resume uploaded");
      void nav({ to: "/resumes/$id", params: { id: r.id } });
    },
    onError: (e) => {
      setProgress(null);
      toastError(e, {
        ...UPLOAD_ERRORS,
        ...(uploadErrorMsg(e) ? { FILE_TOO_LARGE: uploadErrorMsg(e)! } : {}),
      });
    },
  });
  const doRename = useMutation({
    mutationFn: () => api.patch<Resume>(`/resumes/${rename!.id}`, { title: title.trim() }),
    onSuccess: () => {
      setRename(null);
      inval();
      toast.success("Renamed");
    },
    onError: (e) => toastError(e),
  });
  const doDelete = useMutation({
    mutationFn: (r: Resume) => api.delete(`/resumes/${r.id}`),
    onSuccess: () => {
      setDel(null);
      inval();
      toast.success("Resume deleted");
    },
    onError: (e) => {
      setDel(null);
      if (e instanceof ApiError && e.code === "RESUME_IN_USE") {
        setInUse((e.details?.["workspaces"] as ResumeInUseDetails["workspaces"]) ?? []);
        return;
      }
      toastError(e);
    },
  });
  const retry = useMutation({
    mutationFn: (r: Resume) => api.post<Resume>(`/resumes/${r.id}/retry`),
    onSuccess: (r) => {
      inval();
      toast.success("Parsing again");
      void nav({ to: "/resumes/$id", params: { id: r.id } });
    },
    onError: (e) => toastError(e),
  });

  const pick = (f: File | undefined) => {
    if (!f) return;
    const bad = precheckFile(f);
    if (bad) {
      toast.error(bad);
      return;
    }
    setProgress(0);
    upload.mutate(f);
  };

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept={FILE_ACCEPT}
        className="hidden"
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {progress != null && (
        <Card className="mb-3 space-y-2">
          <p className="text-sm font-medium">Uploading… {progress}%</p>
          <ProgressBar value={progress} />
        </Card>
      )}
      {all.length > 6 && <ListSearch value={term} onChange={setTerm} placeholder="Search resumes" />}
      <InfiniteList
        q={q}
        items={items}
        skeleton={
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-border/70" />
            ))}
          </div>
        }
        empty={
          <EmptyState
            icon={<FileText className="h-7 w-7" />}
            title="No resumes yet"
            description="Upload a PDF or DOCX (max 10MB) to get started."
            action={
              <Button onClick={() => fileRef.current?.click()} disabled={!online}>
                <Upload className="h-4 w-4" /> Upload resume
              </Button>
            }
          />
        }
        render={(r) => (
          <SwipeToDelete onDelete={() => setDel(r)}>
          <Card key={r.id} className="flex min-h-14 items-center gap-3 p-3">
            <Link
              to="/resumes/$id"
              params={{ id: r.id }}
              className="flex min-w-0 flex-1 items-center gap-3"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                <FileText className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{r.title}</span>
                <span className="caption block">
                  {r.pageCount ?? "–"} {r.pageCount === 1 ? "page" : "pages"} · {r.wordCount ?? "–"}{" "}
                  words · {fmtDate(r.createdAt)}
                </span>
                <span className="mt-1 block">
                  <ResumeStatusBadge s={r.status} />
                </span>
              </span>
            </Link>
            <ActionSheet
              title={r.title}
              actions={[
                {
                  label: "Rename",
                  icon: <Pencil className="h-5 w-5" />,
                  onSelect: () => {
                    setTitle(r.title);
                    setRename(r);
                  },
                },
                {
                  label: "Retry parsing",
                  icon: <RotateCw className="h-5 w-5" />,
                  hidden: r.status !== "failed",
                  onSelect: () => retry.mutate(r),
                },
                {
                  label: "Delete",
                  icon: <Trash2 className="h-5 w-5" />,
                  danger: true,
                  onSelect: () => setDel(r),
                },
              ]}
            />
          </Card>
          </SwipeToDelete>
        )}
      />


      <BottomSheet open={!!rename} onClose={() => setRename(null)} title="Rename resume">
        <div className="space-y-3">
          <Input
            value={title}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Title"
            autoFocus
          />
          <ActionButton
            size="full"
            disabled={!title.trim()}
            loading={doRename.isPending}
            onClick={() => doRename.mutate()}
          >
            Save
          </ActionButton>
        </div>
      </BottomSheet>
      <ConfirmSheet
        open={!!del}
        onClose={() => setDel(null)}
        title="Delete this resume?"
        body={del?.title}
        confirmLabel="Delete"
        danger
        loading={doDelete.isPending}
        onConfirm={() => del && doDelete.mutate(del)}
      />
      <BottomSheet open={!!inUse} onClose={() => setInUse(null)} title="Resume in use">
        <p className="body-text">
          This resume is used by these analyses. Delete them first, then try again.
        </p>
        <ul className="mt-3 space-y-2">
          {inUse?.map((w) => (
            <li key={w.id}>
              <Link
                to="/analyses/$id"
                params={{ id: w.id }}
                onClick={() => setInUse(null)}
                className="flex min-h-11 items-center rounded-lg bg-muted px-3 font-medium"
              >
                {w.name}
              </Link>
            </li>
          ))}
        </ul>
      </BottomSheet>
    </div>
  );
}
