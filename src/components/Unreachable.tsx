import { WifiOff } from "lucide-react";
import { Button, Logo } from "@/components/ui/tp";
import { useAuth } from "@/lib/auth";

/** Shown at launch when there's a saved session but the server can't be reached and no cached user. */
export function Unreachable() {
  const { retry } = useAuth();
  return (
    <div className="pt-safe pb-safe mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <Logo size={36} />
      <WifiOff className="mt-6 h-10 w-10 text-muted-foreground" aria-hidden />
      <h1 className="h2">Can't reach TalentPilot</h1>
      <p className="text-sm text-muted-foreground">Check your connection. You're still signed in — we'll keep trying.</p>
      <Button onClick={retry} className="mt-2 w-full">
        Retry
      </Button>
    </div>
  );
}
