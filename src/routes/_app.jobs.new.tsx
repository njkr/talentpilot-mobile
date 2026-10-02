import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ClipboardPaste, FileUp } from "lucide-react";
import { api } from "@/lib/api";
import { qk } from "@/lib/queries";
import { toastError } from "@/lib/errors";
import { readClipboard } from "@/lib/native";
import { ActionButton, PageHeader, ProgressBar } from "@/components/app";
import { Button, Card, Input } from "@/components/ui/tp";
import { FILE_ACCEPT, precheckFile, UPLOAD_ERRORS } from "@/lib/resumeUi";
import { cn } from "@/lib/utils";
import type { JobDescription } from "@/types/api";

export const Route = createFileRoute("/_app/jobs/new")({
  head: () => ({
    meta: [
      { title: "Add job — TalentPilot" },
      { name: "description", content: "Paste or upload a job description." },
      { property: "og:title", content: "Add job — TalentPilot" },
      { property: "og:description", content: "Paste or upload a job description." },
    ],
  }),
  component: NewJob,
});

const MAX = 50_000;
const JD_ERR = { ...UPLOAD_ERRORS, JD_TOO_SHORT: "This looks too short to be a full job description" };

function NewJob() {
  const [tab, setTab] = useState<"paste" | "upload">("paste");
  const [text, setText] = useState("");
  const [position, setPosition] = useState("");
  const [company, setCompany] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const nav = useNavigate();
  const qc = useQueryClient();
  const ok = (j: JobDescription) => {
    void qc.invalidateQueries({ queryKey: qk.jobs });
    toast.success("Job added");
    void nav({ to: "/jobs/$id", params: { id: j.id }, replace: true });
  };

  const paste = useMutation({
    mutationFn: () =>
      api.post<JobDescription>("/job-descriptions/paste", {
        text,
        ...(position.trim() ? { position: position.trim() } : {}),
        ...(company.trim() ? { company: company.trim() } : {}),
      }),
    onSuccess: ok,
    onError: (e) => toastError(e, JD_ERR),
  });
  const upload = useMutation({
    mutationFn: (f: File) => api.uploadWithProgress<JobDescription>("/job-descriptions/upload", f, setProgress),
    onSuccess: (j) => {
      setProgress(null);
      ok(j);
    },
    onError: (e) => {
      setProgress(null);
      toastError(e, JD_ERR);
    },
  });

  const fromClipboard = async () => {
    try {
      const t = await readClipboard();
      if (!t) return toast("Clipboard is empty");
      setText(t.slice(0, MAX));
    } catch {
      toast.error("Couldn't read the clipboard. Long-press the box and paste instead.");
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Add job" />
      <div className="grid grid-cols-2 rounded-xl bg-muted p-1">
        {(["paste", "upload"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn("min-h-11 rounded-lg text-sm font-semibold capitalize", tab === t ? "bg-card shadow-sm" : "text-muted-foreground")}>
            {t === "paste" ? "Paste text" : "Upload file"}
          </button>
        ))}
      </div>

      {tab === "paste" ? (
        <div className="space-y-3">
          <Card className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="jd" className="text-sm font-medium">Job description</label>
              <Button variant="ghost" size="sm" className="h-11" onClick={() => void fromClipboard()}>
                <ClipboardPaste className="h-4 w-4" /> Paste from clipboard
              </Button>
            </div>
            <textarea id="jd" value={text} maxLength={MAX} onChange={(e) => setText(e.target.value)} rows={10} placeholder="Paste the full job posting here…" className="w-full rounded-lg border border-input bg-card p-3 text-base" />
            <p className="caption text-right">{text.length.toLocaleString()} / {MAX.toLocaleString()}</p>
          </Card>
          <Card className="space-y-3">
            <Input label="Position (optional)" value={position} maxLength={200} onChange={(e) => setPosition(e.target.value)} />
            <Input label="Company (optional)" value={company} maxLength={200} onChange={(e) => setCompany(e.target.value)} />
          </Card>
          <ActionButton size="full" disabled={!text.trim()} loading={paste.isPending} onClick={() => paste.mutate()}>Add job</ActionButton>
        </div>
      ) : (
        <Card className="space-y-3 py-8 text-center">
          <FileUp className="mx-auto h-10 w-10 text-primary" />
          <p className="body-text">PDF or DOCX, up to 10MB</p>
          <input ref={fileRef} type="file" accept={FILE_ACCEPT} className="hidden" onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            const bad = precheckFile(f);
            if (bad) return void toast.error(bad);
            setProgress(0);
            upload.mutate(f);
          }} />
          {progress != null && <ProgressBar value={progress} />}
          <ActionButton size="full" loading={upload.isPending} onClick={() => fileRef.current?.click()}>Choose file</ActionButton>
        </Card>
      )}
    </div>
  );
}
