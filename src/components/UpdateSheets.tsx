import { useEffect } from "react";
import { toast } from "sonner";
import { Download, RefreshCw } from "lucide-react";
import { BottomSheet, Button } from "@/components/ui/tp";
import { isNative, onAppResume } from "@/lib/native";
import {
  checkForUpdates,
  dismissNativeUpdate,
  getUpdateState,
  initUpdates,
  openApk,
  useUpdateState,
} from "@/lib/updates";

const noop = () => undefined;

/**
 * Mounted once in the root route. Kicks off the update flow (incl. notifyAppReady, which
 * must run after the app has rendered) and shows the native-update sheet.
 */
export function UpdateSheets() {
  const s = useUpdateState();

  useEffect(() => {
    void initUpdates();
    // Re-check when returning to the app; checkForUpdates() itself throttles to once / 6h.
    return onAppResume(() => void checkForUpdates());
  }, []);

  const n = s.native;
  const required = n?.state === "required";
  return (
    <BottomSheet
      open={!!n}
      onClose={required ? noop : () => void dismissNativeUpdate()}
      title={required ? "Update required" : "Update available"}
    >
      {n && (
        <div className="space-y-3">
          <p className="body-text">
            {required
              ? "This version of TalentPilot is no longer supported. Install the latest version to continue."
              : "A new version of TalentPilot is ready to install."}
          </p>
          <div className="rounded-xl bg-muted p-3">
            <p className="caption">Latest version</p>
            <p className="font-display text-lg font-bold">
              {n.info.versionName || "New version"} (build {n.info.versionCode})
            </p>
            {n.info.notes && <p className="body-text mt-1 whitespace-pre-line">{n.info.notes}</p>}
          </div>
          <p className="caption">
            Tap download, then open the downloaded file to install. If asked, allow installs from
            your browser.
          </p>
          <Button size="full" onClick={() => openApk(n.info.apkUrl)}>
            <Download className="h-4 w-4" /> Download update
          </Button>
          {!required && (
            <Button variant="secondary" size="full" onClick={() => void dismissNativeUpdate()}>
              Later
            </Button>
          )}
        </div>
      )}
    </BottomSheet>
  );
}

/** "App 1.0.0 (build 12) · bundle 1.0.0-ab12cd3" for the Me screen, plus the last update problem if any. */
export function VersionFooter() {
  const s = useUpdateState();
  if (!isNative()) return <p className="caption text-center">TalentPilot · web preview</p>;
  return (
    <div className="space-y-1 text-center">
      <p className="caption">
        App {s.installed?.versionName ?? "—"} (build {s.installed?.build ?? "—"}) · bundle{" "}
        {s.bundleVersion}
      </p>
      {s.lastCheckedAt && !s.lastError && (
        <p className="caption">Last checked {new Date(s.lastCheckedAt).toLocaleTimeString()}</p>
      )}
      {s.lastError && (
        <p className="caption text-destructive">Update check failed: {s.lastError}</p>
      )}
    </div>
  );
}

/** "Check for updates" row for the Me screen (native only). */
export function CheckUpdatesRow() {
  const s = useUpdateState();
  if (!isNative()) return null;
  return (
    <button
      onClick={async () => {
        const r = await checkForUpdates({ force: true });
        if (r === "up-to-date") toast.success("You're up to date");
        else if (r === "error")
          toast.error(getUpdateState().lastError ?? "Couldn't check for updates. Try again later.");
        else if (r === "bundle-ready") return; // the "restart to apply" toast is already showing
      }}
      disabled={s.checking}
      className="flex min-h-14 w-full items-center gap-3 px-4 text-left disabled:opacity-60"
    >
      <RefreshCw
        className={
          s.checking
            ? "h-5 w-5 animate-spin text-muted-foreground"
            : "h-5 w-5 text-muted-foreground"
        }
      />
      <span className="flex-1 font-medium">{s.checking ? "Checking…" : "Check for updates"}</span>
    </button>
  );
}
