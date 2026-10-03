/**
 * Self-hosted updates for the sideloaded Android app. Native-only: every entry point is a
 * no-op in the browser / Lovable preview.
 *
 *  - WEB BUNDLE (live update): @capgo/capacitor-updater in manual mode (autoUpdate:false).
 *    We download a newer bundle zip in the background and stage it with next(), so it takes
 *    effect on the next cold start. We never reload mid-session on our own.
 *  - NATIVE (APK): if the installed versionCode is behind the manifest we show a sheet that
 *    opens the APK in the system browser (download -> install flow).
 *
 * Source of truth is https://njkr.github.io/talentpilot-releases/manifest.json, written by the
 * build workflow (see docs/ANDROID_BUILD.md).
 *
 * ⚠️ notifyAppReady() MUST be called once the app has rendered, every launch. If it isn't,
 * the plugin assumes the new bundle is broken and rolls back to the previous one.
 */
import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { isNative, openExternal } from "@/lib/native";

export const MANIFEST_URL = "https://njkr.github.io/talentpilot-releases/manifest.json";

/** Stamped at build time by CI (`<package.json version>-<short sha>`); "dev" locally. */
export const BUILT_IN_BUNDLE_VERSION: string =
  (import.meta.env["VITE_BUNDLE_VERSION"] as string | undefined) || "dev";

export const CHECK_INTERVAL_MS = 6 * 60 * 60_000; // at most one check every 6h
export const DISMISS_MS = 24 * 60 * 60_000; // "Update available" stays hidden 24h after dismissal
const FETCH_TIMEOUT_MS = 5_000;

const KEY_LAST_CHECK = "tp_updates_last_check";
const KEY_DISMISSED = "tp_updates_dismissed"; // JSON { versionCode, at }

// ── Manifest ────────────────────────────────────────────────────────────────

export interface BundleInfo {
  version: string;
  url: string;
  checksum: string;
  minNativeVersionCode: number;
}
export interface NativeInfo {
  versionCode: number;
  versionName: string;
  apkUrl: string;
  minSupportedVersionCode: number;
  notes: string;
}
export interface Manifest {
  bundle: BundleInfo;
  native: NativeInfo;
}

const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

/** Defensive parse: anything malformed degrades to "nothing to do" instead of throwing. */
export function parseManifest(raw: unknown): Manifest | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { bundle?: Record<string, unknown>; native?: Record<string, unknown> };
  const b = r.bundle ?? {};
  const n = r.native ?? {};
  return {
    bundle: {
      version: str(b["version"]),
      url: str(b["url"]),
      checksum: str(b["checksum"]),
      minNativeVersionCode: num(b["minNativeVersionCode"], 1),
    },
    native: {
      versionCode: num(n["versionCode"], 1),
      versionName: str(n["versionName"]),
      apkUrl: str(n["apkUrl"]),
      minSupportedVersionCode: num(n["minSupportedVersionCode"], 1),
      notes: str(n["notes"]),
    },
  };
}

// ── Decisions (pure, unit-tested) ───────────────────────────────────────────

export type NativeUpdateState = "none" | "available" | "required";

export function nativeUpdateState(installedBuild: number, native: NativeInfo): NativeUpdateState {
  if (!native.apkUrl) return "none"; // nothing published yet
  if (installedBuild < native.minSupportedVersionCode) return "required";
  if (installedBuild < native.versionCode) return "available";
  return "none";
}

export interface Dismissal {
  versionCode: number;
  at: number;
}
/** A dismissal only silences the SAME release, for 24h. */
export function isDismissed(d: Dismissal | null, versionCode: number, now: number): boolean {
  return !!d && d.versionCode === versionCode && now - d.at < DISMISS_MS;
}

export type BundleAction = "skip" | "download" | "stage";
export interface KnownBundle {
  version: string;
  status: string;
}

/**
 * Whether to fetch a new web bundle.
 *  - skip: nothing new, not compatible with this native build, already failed, or in flight
 *  - stage: already downloaded earlier — just make sure it is queued with next()
 *  - download: fetch it
 */
export function bundleAction(
  bundle: BundleInfo,
  installedBuild: number,
  currentVersion: string,
  known: KnownBundle[],
): BundleAction {
  if (!bundle.version || !bundle.url || !bundle.checksum) return "skip";
  if (bundle.version === currentVersion) return "skip";
  if (installedBuild < bundle.minNativeVersionCode) return "skip";
  const prior = known.find((k) => k.version === bundle.version);
  if (prior?.status === "error" || prior?.status === "downloading") return "skip"; // don't loop on a bad bundle
  if (prior) return "stage";
  return "download";
}

export function shouldCheck(lastCheck: number | null, now: number, force: boolean): boolean {
  return force || lastCheck === null || now - lastCheck >= CHECK_INTERVAL_MS;
}

// ── State store ─────────────────────────────────────────────────────────────

export interface UpdateState {
  installed: { versionName: string; build: number } | null;
  bundleVersion: string;
  native: { state: Exclude<NativeUpdateState, "none">; info: NativeInfo } | null;
  bundleReady: { id: string; version: string } | null;
  checking: boolean;
  /** Last failure reason, shown on the Me screen so a stuck updater is diagnosable on-device. */
  lastError: string | null;
  lastCheckedAt: number | null;
}
let state: UpdateState = {
  installed: null,
  bundleVersion: BUILT_IN_BUNDLE_VERSION,
  native: null,
  bundleReady: null,
  checking: false,
  lastError: null,
  lastCheckedAt: null,
};
const subs = new Set<() => void>();
const setState = (patch: Partial<UpdateState>) => {
  state = { ...state, ...patch };
  subs.forEach((s) => s());
};
export const getUpdateState = () => state;
export const useUpdateState = () =>
  useSyncExternalStore(
    (fn) => {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    () => state,
    () => state,
  );

// ── Runtime ─────────────────────────────────────────────────────────────────

/** Reject if a native/plugin call never answers, so one stuck call can't wedge the whole flow. */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 160);

async function prefs() {
  return (await import("@capacitor/preferences")).Preferences;
}
async function updater() {
  return (await import("@capgo/capacitor-updater")).CapacitorUpdater;
}

/** Preferences are a convenience (throttle / dismissal); a failure there must never block updates. */
async function prefGet(key: string): Promise<string | null> {
  try {
    return (
      (await withTimeout((await prefs()).get({ key }), 3_000, "Preferences.get")).value ?? null
    );
  } catch {
    return null;
  }
}
async function prefSet(key: string, value: string) {
  try {
    await withTimeout((await prefs()).set({ key, value }), 3_000, "Preferences.set");
  } catch {
    /* ignore */
  }
}

let readyDone = false;
/** Tell the plugin this bundle booted fine. Call as soon as the app has rendered. */
export async function notifyAppReady() {
  if (!isNative() || readyDone) return;
  readyDone = true;
  try {
    await withTimeout((await updater()).notifyAppReady(), 8_000, "notifyAppReady");
  } catch (e) {
    readyDone = false;
    console.warn("notifyAppReady failed", e);
    setState({ lastError: `notifyAppReady: ${errMsg(e)}` });
  }
}

/** Reads installed app + current bundle. The two reads are independent: either may fail alone. */
async function loadInstalled() {
  try {
    const { App } = await import("@capacitor/app");
    const info = await withTimeout(App.getInfo(), 5_000, "App.getInfo");
    setState({ installed: { versionName: info.version, build: Number(info.build) || 1 } });
  } catch (e) {
    setState({ lastError: `App.getInfo: ${errMsg(e)}` });
  }
  try {
    const cur = await withTimeout((await updater()).current(), 5_000, "CapacitorUpdater.current");
    setState({
      bundleVersion:
        cur.bundle.version === "builtin" ? BUILT_IN_BUNDLE_VERSION : cur.bundle.version,
    });
  } catch (e) {
    setState({ lastError: `current(): ${errMsg(e)}` });
  }
}

async function fetchManifest(): Promise<Manifest | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${MANIFEST_URL}?t=${Date.now()}`, {
      cache: "no-store",
      signal: ctl.signal,
    });
    if (!res.ok) throw new Error(`manifest HTTP ${res.status}`);
    return parseManifest(await res.json());
  } catch (e) {
    setState({ lastError: `manifest: ${errMsg(e)}` }); // offline / timeout / CORS / bad JSON
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function readDismissal(): Promise<Dismissal | null> {
  try {
    const raw = await prefGet(KEY_DISMISSED);
    return raw ? (JSON.parse(raw) as Dismissal) : null;
  } catch {
    return null;
  }
}

export async function dismissNativeUpdate() {
  const n = state.native;
  if (!n || n.state === "required") return; // a required update can't be dismissed
  setState({ native: null });
  await prefSet(
    KEY_DISMISSED,
    JSON.stringify({ versionCode: n.info.versionCode, at: Date.now() } satisfies Dismissal),
  );
}

/** Apply the staged bundle right now (reloads the app). Only ever called from a user tap. */
export async function restartToApply(id: string) {
  await (await updater()).set({ id });
}

async function applyBundle(bundle: BundleInfo): Promise<{ id: string; version: string } | null> {
  const u = await updater();
  const cur = await withTimeout(u.current(), 5_000, "current()");
  const currentVersion =
    cur.bundle.version === "builtin" ? BUILT_IN_BUNDLE_VERSION : cur.bundle.version;
  const list = await withTimeout(u.list(), 5_000, "list()");
  // Unknown installed build (App.getInfo failed): assume compatible rather than blocking updates.
  const build = state.installed?.build ?? Number.MAX_SAFE_INTEGER;

  const action = bundleAction(bundle, build, currentVersion, list.bundles);
  if (action === "skip") return null;

  let id: string;
  if (action === "stage") {
    id = list.bundles.find((b) => b.version === bundle.version)!.id;
  } else {
    const info = await withTimeout(
      u.download({ url: bundle.url, version: bundle.version, checksum: bundle.checksum }),
      120_000,
      "download",
    );
    id = info.id;
  }
  await withTimeout(u.next({ id }), 5_000, "next()"); // takes effect on the next cold start — never reload mid-session

  // Best-effort cleanup of older staged bundles so storage doesn't grow.
  for (const b of list.bundles) {
    if (b.id !== id && b.id !== cur.bundle.id && b.id !== "builtin")
      void u.delete({ id: b.id }).catch(() => undefined);
  }
  return { id, version: bundle.version };
}

export type CheckResult =
  "unsupported" | "throttled" | "busy" | "error" | "up-to-date" | "native" | "bundle-ready";

let inFlight = false;
export async function checkForUpdates({
  force = false,
}: { force?: boolean } = {}): Promise<CheckResult> {
  if (!isNative()) return "unsupported";
  if (inFlight) return "busy";
  inFlight = true;
  setState({ checking: true, lastError: null });
  try {
    const last = Number(await prefGet(KEY_LAST_CHECK)) || null;
    if (!shouldCheck(last, Date.now(), force)) return "throttled";
    if (!state.installed) await loadInstalled();

    const manifest = await fetchManifest();
    if (!manifest) return "error";
    await prefSet(KEY_LAST_CHECK, String(Date.now()));
    setState({ lastCheckedAt: Date.now() });

    let result: CheckResult = "up-to-date";

    // Native prompt needs the installed build; if it couldn't be read, skip it (bundle path still runs).
    const build = state.installed?.build;
    const ns = build === undefined ? "none" : nativeUpdateState(build, manifest.native);
    if (ns !== "none") {
      const hidden =
        ns === "available" &&
        !force &&
        isDismissed(await readDismissal(), manifest.native.versionCode, Date.now());
      if (!hidden) {
        setState({ native: { state: ns, info: manifest.native } });
        result = "native";
      }
    } else {
      setState({ native: null });
    }

    try {
      const ready = await applyBundle(manifest.bundle);
      if (ready) {
        setState({ bundleReady: ready });
        toast("Update ready — restart to apply", {
          duration: 12_000,
          action: { label: "Restart", onClick: () => void restartToApply(ready.id) },
        });
        if (result === "up-to-date") result = "bundle-ready";
      }
    } catch (e) {
      console.warn("bundle update failed", e);
      setState({ lastError: `bundle: ${errMsg(e)}` });
      if (result === "up-to-date") result = "error";
    }
    return result;
  } catch (e) {
    console.warn("update check failed", e);
    setState({ lastError: errMsg(e) });
    return "error";
  } finally {
    inFlight = false;
    setState({ checking: false });
  }
}

/** Call once from the root component after first render. */
export async function initUpdates() {
  if (!isNative()) return;
  // Not awaited: a slow/stuck notifyAppReady must never stop the rest of the flow.
  void notifyAppReady();
  await loadInstalled();
  void checkForUpdates();
}

export function openApk(url: string) {
  void openExternal(url);
}
