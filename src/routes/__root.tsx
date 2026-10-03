import type { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";
import { LayoutGroup, MotionConfig } from "framer-motion";

import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "@fontsource/plus-jakarta-sans/800.css";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider, useAuth } from "../lib/auth";
import { useOnline } from "../lib/stores";
import { NativeBridge } from "../components/GlobalSheets";
import { UpdateSheets } from "../components/UpdateSheets";
import { THEME_BOOT_SCRIPT, ThemeSync, useTheme } from "../lib/theme";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#ffffff" },
      { name: "color-scheme", content: "light dark" },
      { title: "TalentPilot — AI job application assistant" },
      {
        name: "description",
        content:
          "Match your resume to any job, get ATS scores, edits, cover letters and interview prep.",
      },
      { property: "og:title", content: "TalentPilot — AI job application assistant" },
      {
        property: "og:description",
        content:
          "Match your resume to any job, get ATS scores, edits, cover letters and interview prep.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function OfflineBanner() {
  const online = useOnline();
  const { offline } = useAuth();
  if (online && !offline) return null;
  return (
    <div className="pt-safe fixed inset-x-0 top-0 z-[60] bg-warning text-center text-xs font-medium text-foreground">
      <div className="py-1.5">
        {online
          ? "Can't reach TalentPilot. Showing saved data."
          : "You're offline. Showing saved data."}
      </div>
    </div>
  );
}

const PERSIST_ROOTS = new Set([
  "dashboard",
  "resumes",
  "resume",
  "jobs",
  "job",
  "workspaces",
  "workspace",
  "credits",
  "profile",
]);
const persister = createSyncStoragePersister({
  storage: typeof window !== "undefined" ? window.localStorage : undefined,
  key: "tp_query_cache",
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 7 * 24 * 3600_000,
        dehydrateOptions: {
          shouldDehydrateQuery: (q) =>
            q.state.status === "success" && PERSIST_ROOTS.has(String(q.queryKey[0])),
        },
      }}
    >
      <AuthProvider>
        <ThemeSync />
        <NativeBridge />
        {/* Self-hosted updates. Calls notifyAppReady() after first render — keep it, or the
            live-update plugin rolls back to the previous bundle. */}
        <UpdateSheets />
        <OfflineBanner />
        <MotionConfig reducedMotion="user">
          <LayoutGroup>
            <Outlet />
          </LayoutGroup>
        </MotionConfig>
        <ThemedToaster />
      </AuthProvider>
    </PersistQueryClientProvider>
  );
}

function ThemedToaster() {
  const { resolved } = useTheme();
  return <Toaster position="bottom-center" offset={88} richColors theme={resolved} />;
}
