import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import type { InfiniteData, UseInfiniteQueryResult } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Check, ChevronDown, Loader2, MoreHorizontal, RefreshCw } from "lucide-react";
import { ApiError } from "@/lib/api";
import { friendlyError } from "@/lib/errors";
import { useOnline } from "@/lib/stores";
import { cn } from "@/lib/utils";
import { BottomSheet, Button, Card, Skeleton } from "@/components/ui/tp";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { qk } from "@/lib/queries";
import type { Page, Resume, Workspace } from "@/types/api";

// ── Page header with back button ──────────────────────────────────────
export function PageHeader({ title, back = true, right }: { title: string; back?: boolean; right?: ReactNode }) {
  const router = useRouter();
  return (
    <div className="-mx-1 mb-3 flex min-h-11 items-center gap-1">
      {back && (
        <button
          aria-label="Back"
          onClick={() => router.history.back()}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-accent"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      )}
      <h1 className="h2 min-w-0 flex-1 truncate">{title}</h1>
      {right}
    </div>
  );
}

export function AnalysisSubtitle({ workspaceId, resumeId, date, fallback }: { workspaceId: string; resumeId?: string; date: string; fallback?: string }) {
  const workspace = useQuery({
    queryKey: qk.workspace(workspaceId),
    queryFn: () => api.get<Workspace>(`/workspaces/${workspaceId}`),
    enabled: !resumeId,
  });
  const resolvedResumeId = resumeId ?? workspace.data?.resumeId;
  const resume = useQuery({
    queryKey: qk.resume(resolvedResumeId ?? ""),
    queryFn: () => api.get<Resume>(`/resumes/${resolvedResumeId}`),
    enabled: !!resolvedResumeId,
  });
  return <span className="caption block min-w-0 truncate">{resume.data?.title ?? fallback ?? "Resume"} · {fmtDate(date)}</span>;
}

// ── Error state ───────────────────────────────────────────────────────
export function ErrorState({ error, onRetry, compact }: { error: unknown; onRetry?: () => void; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const rid = error instanceof ApiError ? error.requestId : undefined;
  const code = error instanceof ApiError ? error.code : undefined;
  return (
    <div className={cn("flex flex-col items-center text-center", compact ? "py-6" : "px-6 py-12")}>
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h3 className="h3">Couldn't load this</h3>
      <p className="body-text mt-1 max-w-xs">{friendlyError(error)}</p>
      {onRetry && (
        <Button className="mt-4" variant="secondary" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" /> Retry
        </Button>
      )}
      {(rid || code) && (
        <button className="caption mt-3 min-h-11 underline" onClick={() => setOpen((o) => !o)}>
          {open ? "Hide details" : "Details"}
        </button>
      )}
      {open && (
        <p className="caption select-all break-all font-mono">
          {code && <>code: {code}<br /></>}
          {rid && <>requestId: {rid}</>}
        </p>
      )}
    </div>
  );
}

export function CardSkeletons({ count = 4, h = "h-20" }: { count?: number; h?: string }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={cn("w-full rounded-xl", h)} />
      ))}
    </div>
  );
}

// ── Pull to refresh ───────────────────────────────────────────────────
export function PullToRefresh({ onRefresh, children }: { onRefresh: () => Promise<unknown>; children: ReactNode }) {
  const start = useRef<number | null>(null);
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const TH = 70;
  return (
    <div
      onTouchStart={(e) => {
        if (window.scrollY <= 0 && !busy) start.current = e.touches[0]?.clientY ?? null;
      }}
      onTouchMove={(e) => {
        if (start.current == null) return;
        const d = (e.touches[0]?.clientY ?? 0) - start.current;
        setPull(d > 0 ? Math.min(d * 0.5, 100) : 0);
      }}
      onTouchEnd={async () => {
        const trigger = pull >= TH;
        start.current = null;
        setPull(0);
        if (trigger) {
          setBusy(true);
          try {
            await onRefresh();
          } finally {
            setBusy(false);
          }
        }
      }}
    >
      <div
        className="flex items-center justify-center overflow-hidden text-subtle transition-[height]"
        style={{ height: busy ? 40 : pull }}
        aria-hidden={!busy}
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" style={{ transform: `rotate(${pull * 3}deg)` }} />}
      </div>
      {children}
    </div>
  );
}

// ── Infinite list ─────────────────────────────────────────────────────
export function flat<T>(d: InfiniteData<Page<T>> | undefined): T[] {
  return d?.pages.flatMap((p) => p.data) ?? [];
}

export function InfiniteList<T>({
  q,
  items,
  render,
  empty,
  skeleton,
}: {
  q: UseInfiniteQueryResult<InfiniteData<Page<T>>, Error>;
  items?: T[] | undefined;
  render: (item: T) => ReactNode;
  empty: ReactNode;
  skeleton?: ReactNode;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = q;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver((e) => {
      if (e[0]?.isIntersecting && !isFetchingNextPage) void fetchNextPage();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const list = items ?? flat(q.data);
  return (
    <PullToRefresh onRefresh={() => q.refetch()}>
      {q.isPending ? (
        (skeleton ?? <CardSkeletons />)
      ) : q.isError && !q.data ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : list.length === 0 ? (
        empty
      ) : (
        <div className="space-y-3">
          {list.map(render)}
          <div ref={sentinel} />
          {isFetchingNextPage && <Loader2 className="mx-auto h-5 w-5 animate-spin text-subtle" />}
        </div>
      )}
    </PullToRefresh>
  );
}

// ── Action sheet ("…" menus) ──────────────────────────────────────────
export type SheetAction = { label: string; icon?: ReactNode; danger?: boolean; onSelect: () => void; hidden?: boolean };
export function ActionSheet({ title, actions }: { title: string; actions: SheetAction[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        aria-label="More actions"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title={title}>
        <div className="-mx-2 flex flex-col">
          {actions
            .filter((a) => !a.hidden)
            .map((a) => (
              <button
                key={a.label}
                onClick={() => {
                  setOpen(false);
                  a.onSelect();
                }}
                className={cn(
                  "flex min-h-14 items-center gap-3 rounded-lg px-3 text-left text-base font-medium hover:bg-accent",
                  a.danger && "text-destructive",
                )}
              >
                {a.icon}
                {a.label}
              </button>
            ))}
        </div>
      </BottomSheet>
    </>
  );
}

// ── Confirm sheet ─────────────────────────────────────────────────────
export function ConfirmSheet({
  open,
  onClose,
  title,
  body,
  confirmLabel,
  danger,
  loading,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      {body && <div className="body-text">{body}</div>}
      <div className="mt-5 space-y-3">
        <ActionButton variant={danger ? "danger" : "primary"} size="full" loading={loading} onClick={onConfirm}>
          {confirmLabel}
        </ActionButton>
        <Button variant="secondary" size="full" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </BottomSheet>
  );
}

// ── Mutating button: disabled offline with caption ────────────────────
export function ActionButton(props: Parameters<typeof Button>[0]) {
  const online = useOnline();
  return (
    <div className="w-full">
      <Button {...props} disabled={props.disabled || !online} />
      {!online && <p className="caption mt-1 text-center">Requires connection</p>}
    </div>
  );
}

// ── Collapsible section ───────────────────────────────────────────────
export function Collapsible({
  title,
  right,
  defaultOpen = false,
  children,
}: {
  title: ReactNode;
  right?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="p-0">
      <div className="flex items-center">
        <button className="flex min-h-14 flex-1 items-center gap-2 px-4 text-left" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", !open && "-rotate-90")} />
          <span className="h3 flex-1">{title}</span>
        </button>
        {right && <div className="pr-2">{right}</div>}
      </div>
      {open && <div className="border-t border-border px-4 py-3">{children}</div>}
    </Card>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────
export function ProgressBar({ value, className, tone = "primary" }: { value: number; className?: string; tone?: "primary" | "success" | "warning" }) {
  const bg = tone === "success" ? "bg-success" : tone === "warning" ? "bg-warning" : "bg-primary";
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-border/70", className)}>
      <div className={cn("h-full rounded-full transition-all duration-500", bg)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export const scoreTone = (s: number) => (s >= 80 ? "success" : s >= 60 ? "primary" : "warning");
export const scoreText = (s: number) => (s >= 80 ? "text-success" : s >= 60 ? "text-primary" : "text-warning");

// ── Score ring ────────────────────────────────────────────────────────
export function ScoreRing({ score, size = 112 }: { score: number; size?: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setV(score), 50);
    return () => clearTimeout(t);
  }, [score]);
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  const stroke = score >= 80 ? "stroke-success" : score >= 60 ? "stroke-primary" : "stroke-warning";
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={10} className="fill-none stroke-border" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={10}
          strokeLinecap="round"
          className={cn("fill-none transition-[stroke-dashoffset] duration-1000 ease-out", stroke)}
          strokeDasharray={c}
          strokeDashoffset={c - (c * v) / 100}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("font-display text-3xl font-extrabold", scoreText(score))}>{Math.round(score)}</span>
        <span className="caption">/ 100</span>
      </div>
    </div>
  );
}

// ── Semicircle gauge (match preview) ──────────────────────────────────
export function Gauge({ pct }: { pct: number }) {
  const p = Math.max(0, Math.min(100, pct));
  const band = p < 35 ? "Low" : p < 70 ? "Fair" : "Strong";
  const stroke = p < 35 ? "stroke-warning" : p < 70 ? "stroke-primary" : "stroke-success";
  const r = 70;
  const len = Math.PI * r;
  return (
    <div className="flex flex-col items-center">
      <svg width={170} height={95} viewBox="0 0 170 95">
        <path d="M15 85 A70 70 0 0 1 155 85" strokeWidth={12} className="fill-none stroke-border" strokeLinecap="round" />
        <path
          d="M15 85 A70 70 0 0 1 155 85"
          strokeWidth={12}
          strokeLinecap="round"
          className={cn("fill-none transition-[stroke-dashoffset] duration-700", stroke)}
          strokeDasharray={len}
          strokeDashoffset={len - (len * p) / 100}
        />
        <text x="85" y="72" textAnchor="middle" className="fill-foreground font-display text-2xl font-extrabold">
          {Math.round(p)}%
        </text>
      </svg>
      <span className="caption -mt-1 font-semibold">{band} match</span>
    </div>
  );
}

export function CheckBox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center"
    >
      <span
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded-md border-2",
          checked ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card",
        )}
      >
        {checked && <Check className="h-4 w-4" />}
      </span>
    </button>
  );
}

export function Chip({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium capitalize focus-visible:ring-2 focus-visible:ring-primary",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";
export const fmtDateTime = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";
