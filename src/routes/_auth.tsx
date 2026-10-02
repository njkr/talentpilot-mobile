import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Logo, Splash } from "@/components/ui/tp";

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
});

/** RedirectIfAuthed + auth stack chrome (no tabs). */
function AuthLayout() {
  const { status } = useAuth();
  if (status === "loading") return <Splash />;
  if (status === "authed") return <Navigate to="/" replace />;
  return (
    <div className="pt-safe pb-safe mx-auto flex min-h-dvh w-full max-w-md flex-col px-5">
      <div className="pt-10 pb-8">
        <Logo size={36} />
      </div>
      <Outlet />
    </div>
  );
}
