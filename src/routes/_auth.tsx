import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/ui/tp";
import { LaunchScreen, useLaunchGate } from "@/components/motion";
import { Unreachable } from "@/components/Unreachable";

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
});

/** RedirectIfAuthed + auth stack chrome (no tabs). */
function AuthLayout() {
  const { status } = useAuth();
  const phase = useLaunchGate(status === "loading");
  if (phase !== "done") return <LaunchScreen phase={phase} />;
  if (status === "authed") return <Navigate to="/" replace />;
  if (status === "unreachable") return <Unreachable />;
  return (
    <div className="pt-safe pb-safe mx-auto flex min-h-dvh w-full max-w-md flex-col px-5">
      <div className="pt-10 pb-8">
        <Logo size={36} />
      </div>
      <Outlet />
    </div>
  );
}
