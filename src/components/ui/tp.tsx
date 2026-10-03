import {
  forwardRef,
  useEffect,
  type HTMLAttributes,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { pushSheet } from "@/lib/stores";

// ── Logo ───────────────────────────────────────────────────────────────
export function Logo({ size = 32, wordmark = true }: { size?: number; wordmark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="inline-flex items-center justify-center rounded-lg bg-primary"
        style={{ width: size, height: size }}
        aria-hidden
      >
        <svg viewBox="0 0 24 24" width={size * 0.55} height={size * 0.55}>
          <path d="M12 4 L21 19 H3 Z" className="fill-primary-foreground" />
        </svg>
      </span>
      {wordmark && (
        <span className="font-display font-bold tracking-tight" style={{ fontSize: size * 0.62 }}>
          <span className="text-foreground">Talent</span>
          <span className="text-primary">Pilot</span>
        </span>
      )}
    </span>
  );
}

// ── Button ─────────────────────────────────────────────────────────────
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.99]",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary-hover",
        secondary: "bg-secondary text-secondary-foreground border border-border hover:bg-muted",
        danger: "bg-destructive text-destructive-foreground hover:opacity-90",
        ghost: "text-foreground hover:bg-accent",
        link: "text-primary underline-offset-4 hover:underline h-auto px-0",
      },
      size: { md: "h-11 px-4", sm: "h-9 px-3", icon: "h-11 w-11", full: "h-11 px-4 w-full" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { loading?: boolean | undefined };
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, children, disabled, ...p }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      {...p}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  ),
);
Button.displayName = "Button";

// ── Input ──────────────────────────────────────────────────────────────
type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string | undefined;
  error?: string | undefined;
  hint?: string | undefined;
};
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, ...p }, ref) => {
    const inputId = id ?? p.name;
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-foreground">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          className={cn(
            "h-11 w-full rounded-lg border border-input bg-card px-3 text-base text-foreground placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary",
            error && "border-destructive focus:ring-destructive/20 focus:border-destructive",
            className,
          )}
          {...p}
        />
        {error ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : hint ? (
          <p className="caption">{hint}</p>
        ) : null}
      </div>
    );
  },
);
Input.displayName = "Input";

// ── Card ───────────────────────────────────────────────────────────────
export function Card({ className, children, ...p }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm",
        className,
      )}
      {...p}
    >
      {children}
    </div>
  );
}

// ── Badge ──────────────────────────────────────────────────────────────
const badgeVariants = cva(
  "inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      tone: {
        primary: "bg-primary/10 text-primary",
        success: "bg-success/10 text-success",
        warning: "bg-warning/10 text-warning",
        danger: "bg-destructive/10 text-destructive",
        neutral: "bg-muted-foreground/10 text-muted-foreground",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);
export function Badge({
  tone,
  className,
  children,
}: VariantProps<typeof badgeVariants> & { className?: string; children: ReactNode }) {
  return <span className={cn(badgeVariants({ tone }), className)}>{children}</span>;
}

// ── Skeleton ───────────────────────────────────────────────────────────
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("tp-shimmer rounded-lg", className)} />;
}

// ── EmptyState ─────────────────────────────────────────────────────────
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
          {icon}
        </div>
      )}
      <h3 className="h3">{title}</h3>
      {description && <p className="body-text mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ── BottomSheet ────────────────────────────────────────────────────────
export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const pop = pushSheet(onClose);
    return () => {
      window.removeEventListener("keydown", onKey);
      pop();
    };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          role="dialog"
          aria-modal="true"
        >
          <motion.button
            aria-label="Close"
            className="absolute inset-0 bg-overlay"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
          <motion.div
            className="pb-safe relative w-full max-w-lg rounded-t-2xl bg-card shadow-[var(--shadow-sheet)]"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
          >
            <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-border" />
            <div className="flex items-center justify-between px-4 pt-3">
              <h2 className="h3">{title}</h2>
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="max-h-[75vh] overflow-y-auto px-4 pb-6">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ── Splash ─────────────────────────────────────────────────────────────
export function Splash() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background">
      <Logo size={44} />
      <Loader2 className="h-5 w-5 animate-spin text-subtle" />
    </div>
  );
}
