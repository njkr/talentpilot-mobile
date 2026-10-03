import { useAuthOptional } from "@/lib/auth";
import { useOnline } from "@/lib/stores";

/**
 * Top notice for no-network / server-unreachable. Must never throw: it sits in the
 * root layout, so a crash here blanks every screen. Outside an AuthProvider it
 * falls back to network state only.
 */
export function OfflineBanner() {
  const online = useOnline();
  const offline = useAuthOptional()?.offline ?? false;
  if (online && !offline) return null;
  return (
    <div
      role="status"
      className="pt-safe fixed inset-x-0 top-0 z-[60] bg-warning text-center text-xs font-medium text-foreground"
    >
      <div className="py-1.5">
        {online ? "Can't reach TalentPilot. Showing saved data." : "You're offline. Showing saved data."}
      </div>
    </div>
  );
}
