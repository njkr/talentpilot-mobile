import { useEffect, useRef, useState, type ReactNode } from "react";
import { animate, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/** Ease used for all short UI motion. */
export const EASE = [0.2, 0.8, 0.2, 1] as const;

/** The logo triangle. `lift` = gentle 1.2s up/down loop. */
export function Triangle({ lift, className, style }: { lift?: boolean; className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" className={cn(lift && "tp-lift", className)} style={style} aria-hidden>
      <path d="M12 4 L21 19 H3 Z" className="fill-current" />
    </svg>
  );
}

/** Logo square (+ optional wordmark) with shared layoutIds so it can fly into the top bar. */
export function MotionLogo({ size = 28, wordmark = true, loading = false, reveal = false }: { size?: number; wordmark?: boolean; loading?: boolean; reveal?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <motion.span
        layoutId="tp-logo-mark"
        className="relative inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground"
        style={{ width: size, height: size }}
        aria-hidden
      >
        <Triangle lift={loading} style={{ width: size * 0.55, height: size * 0.55 }} />
        {loading && <span className="tp-dot absolute bottom-[18%] h-1 w-1 rounded-full bg-primary-foreground" />}
      </motion.span>
      {wordmark && (
        <motion.span layoutId="tp-logo-word" className="font-display font-bold tracking-tight" style={{ fontSize: size * 0.62 }}>
          <motion.span className="text-foreground" initial={reveal ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
            Talent
          </motion.span>
          <motion.span
            className="inline-block text-primary"
            initial={reveal ? { opacity: 0, x: -8 } : false}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.15, delay: reveal ? 0.15 : 0, ease: EASE }}
          >
            Pilot
          </motion.span>
        </motion.span>
      )}
    </span>
  );
}

let launched = false;
const MIN_MS = 400;
const REVEAL_MS = 300;

/** Returns true while the launch screen should stay up. Runs once per app launch. */
export function useLaunchGate(loading: boolean) {
  const [start] = useState(() => Date.now());
  const [phase, setPhase] = useState<"loading" | "reveal" | "done">(launched ? "done" : "loading");
  useEffect(() => {
    if (phase !== "loading" || loading) return;
    const t = setTimeout(() => setPhase("reveal"), Math.max(0, MIN_MS - (Date.now() - start)));
    return () => clearTimeout(t);
  }, [loading, phase, start]);
  useEffect(() => {
    if (phase !== "reveal") return;
    const t = setTimeout(() => {
      launched = true;
      setPhase("done");
    }, REVEAL_MS);
    return () => clearTimeout(t);
  }, [phase]);
  return phase;
}

export function LaunchScreen({ phase }: { phase: "loading" | "reveal" }) {
  useEffect(() => {
    void (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;
        const { SplashScreen } = await import("@capacitor/splash-screen");
        await SplashScreen.hide({ fadeOutDuration: 200 });
      } catch {
        /* web: no-op */
      }
    })();
  }, []);
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background" aria-busy={phase === "loading"} aria-label="Loading TalentPilot">
      <MotionLogo size={44} wordmark={phase === "reveal"} loading={phase === "loading"} reveal />
    </div>
  );
}

/** Fade-up entrance for list rows / cards. Stagger capped at 8 items. */
export function FadeUp({ index = 0, animateIn = true, children, className }: { index?: number; animateIn?: boolean; children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={animateIn ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index, 7) * 0.04, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/** True only for the first render that has data; later renders (refetch, pagination) skip the entrance. */
export function useFirstLoad(hasData: boolean) {
  const done = useRef(false);
  const [first, setFirst] = useState(true);
  useEffect(() => {
    if (hasData && !done.current) {
      done.current = true;
      const t = setTimeout(() => setFirst(false), 700);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [hasData]);
  return first;
}

/** Number that counts up over 600ms ease-out. */
export function CountUp({ value, className, format = (n: number) => Math.round(n).toLocaleString() }: { value: number; className?: string; format?: (n: number) => string }) {
  const reduce = useReducedMotion();
  const [v, setV] = useState(reduce ? value : 0);
  const from = useRef(0);
  useEffect(() => {
    if (reduce) {
      setV(value);
      return;
    }
    const c = animate(from.current, value, { duration: 0.6, ease: "easeOut", onUpdate: (n) => setV(n) });
    from.current = value;
    return () => c.stop();
  }, [value, reduce]);
  return <span className={className}>{format(v)}</span>;
}

/** Check mark that draws in. */
export function DrawCheck({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="10" className="fill-success/15" />
      <motion.path
        d="M7 12.5l3.2 3.2L17 9"
        fill="none"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-success"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.3, ease: EASE }}
      />
    </svg>
  );
}

/** Dashed flight path with the triangle travelling along it. */
export function FlightPath({ done, total, landed }: { done: number; total: number; landed: boolean }) {
  const pct = total ? Math.min(1, done / total) : 0;
  return (
    <div className="relative h-8" aria-hidden>
      <div className="absolute inset-x-3 top-1/2 border-t-2 border-dashed border-border" />
      <div className="absolute inset-x-3 top-0 h-full">
        <motion.div
          className="absolute top-1/2 -ml-3 -mt-3 h-6 w-6 text-primary"
          animate={{ left: `${pct * 100}%`, y: landed ? [0, -8, 0, -3, 0] : 0 }}
          transition={{ left: { duration: 0.3, ease: EASE }, y: { duration: 0.4, ease: "easeOut" } }}
          style={{ rotate: 90 }}
        >
          <Triangle lift={!landed} className="h-6 w-6" />
        </motion.div>
      </div>
    </div>
  );
}
