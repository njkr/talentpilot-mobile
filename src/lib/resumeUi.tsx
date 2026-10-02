import { ApiError } from "@/lib/api";
import { Badge } from "@/components/ui/tp";
import type { JobStatus, ResumeStatus, WorkspaceStatus } from "@/types/api";

export function ResumeStatusBadge({ s }: { s: ResumeStatus }) {
  if (s === "parsed") return <Badge tone="success">Parsed</Badge>;
  if (s === "failed") return <Badge tone="danger">Failed</Badge>;
  if (s === "uploaded") return <Badge tone="neutral">Pending</Badge>;
  return <Badge tone="primary">Parsing</Badge>;
}

export function JobStatusBadge({ s }: { s: JobStatus }) {
  if (s === "analyzed") return <Badge tone="success">Analyzed</Badge>;
  if (s === "failed") return <Badge tone="danger">Failed</Badge>;
  if (s === "pending") return <Badge tone="neutral">Pending</Badge>;
  return <Badge tone="primary">Analyzing</Badge>;
}

export const WS_LABEL: Record<WorkspaceStatus, string> = {
  created: "Draft",
  queued: "Queued",
  processing: "Running",
  completed: "Complete",
  partial: "Partial",
  failed: "Failed",
};
export function WsStatusBadge({ s }: { s: WorkspaceStatus }) {
  const tone = s === "completed" ? "success" : s === "failed" ? "danger" : s === "partial" ? "warning" : s === "created" ? "neutral" : "primary";
  return <Badge tone={tone}>{WS_LABEL[s] ?? s}</Badge>;
}

export const MAX_UPLOAD = 10 * 1024 * 1024;
export const FILE_ACCEPT = ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function precheckFile(f: File): string | null {
  if (f.size > MAX_UPLOAD) return "Max 10MB";
  const ok = /\.(pdf|docx)$/i.test(f.name) || ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(f.type);
  return ok ? null : "PDF or DOCX only";
}

export const UPLOAD_ERRORS: Record<string, string> = {
  FILE_TOO_LARGE: "Max 10MB",
  FILE_TYPE_UNSUPPORTED: "PDF or DOCX only",
  FILE_UNREADABLE: "We couldn't read this file — try exporting it again",
  FILE_CORRUPT: "We couldn't read this file — try exporting it again",
  FILE_TOO_MANY_PAGES: "This file has too many pages (max 15)",
  EMAIL_NOT_VERIFIED: "Verify your email before uploading",
};

export function uploadErrorMsg(e: unknown) {
  if (e instanceof ApiError && e.code === "FILE_TOO_LARGE" && e.details?.["maxMb"]) return `Max ${String(e.details["maxMb"])}MB`;
  return null;
}
