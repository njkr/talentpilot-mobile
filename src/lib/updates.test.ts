import { describe, expect, it } from "vitest";
import {
  bundleAction,
  CHECK_INTERVAL_MS,
  DISMISS_MS,
  isDismissed,
  nativeUpdateState,
  parseManifest,
  shouldCheck,
  type BundleInfo,
  type NativeInfo,
} from "./updates";

const native = (o: Partial<NativeInfo> = {}): NativeInfo => ({
  versionCode: 10,
  versionName: "1.0.0",
  apkUrl: "https://example.com/app.apk",
  minSupportedVersionCode: 5,
  notes: "",
  ...o,
});
const bundle = (o: Partial<BundleInfo> = {}): BundleInfo => ({
  version: "1.0.0-new",
  url: "https://example.com/b.zip",
  checksum: "a".repeat(64),
  minNativeVersionCode: 1,
  ...o,
});

describe("parseManifest", () => {
  it("parses a full manifest", () => {
    const m = parseManifest({ bundle: bundle(), native: native({ notes: "hi" }) });
    expect(m?.bundle.version).toBe("1.0.0-new");
    expect(m?.native.notes).toBe("hi");
  });
  it("degrades junk to safe defaults instead of throwing", () => {
    expect(parseManifest(null)).toBeNull();
    expect(parseManifest("x")).toBeNull();
    const m = parseManifest({ bundle: { version: 5 }, native: { versionCode: "9" } });
    expect(m?.bundle.version).toBe("");
    expect(m?.native.versionCode).toBe(1);
    expect(m?.native.apkUrl).toBe("");
  });
});

describe("nativeUpdateState", () => {
  it("is none when up to date or when no APK is published yet", () => {
    expect(nativeUpdateState(10, native())).toBe("none");
    expect(nativeUpdateState(11, native())).toBe("none");
    expect(nativeUpdateState(1, native({ apkUrl: "" }))).toBe("none");
  });
  it("is available when behind but still supported", () => {
    expect(nativeUpdateState(5, native())).toBe("available");
    expect(nativeUpdateState(9, native())).toBe("available");
  });
  it("is required when below minSupportedVersionCode", () => {
    expect(nativeUpdateState(4, native())).toBe("required");
    expect(nativeUpdateState(1, native())).toBe("required");
  });
});

describe("isDismissed", () => {
  const now = 1_000_000_000;
  it("silences the same release for 24h only", () => {
    expect(isDismissed({ versionCode: 10, at: now - 1000 }, 10, now)).toBe(true);
    expect(isDismissed({ versionCode: 10, at: now - DISMISS_MS - 1 }, 10, now)).toBe(false);
  });
  it("does not silence a newer release or when nothing was dismissed", () => {
    expect(isDismissed({ versionCode: 10, at: now - 1000 }, 11, now)).toBe(false);
    expect(isDismissed(null, 10, now)).toBe(false);
  });
});

describe("bundleAction", () => {
  it("downloads a new, compatible bundle", () => {
    expect(bundleAction(bundle(), 10, "1.0.0-old", [])).toBe("download");
  });
  it("skips when the bundle is already the current one (incl. the built-in)", () => {
    expect(bundleAction(bundle(), 10, "1.0.0-new", [])).toBe("skip");
  });
  it("skips when the installed build is older than minNativeVersionCode", () => {
    expect(bundleAction(bundle({ minNativeVersionCode: 11 }), 10, "old", [])).toBe("skip");
    expect(bundleAction(bundle({ minNativeVersionCode: 10 }), 10, "old", [])).toBe("download");
  });
  it("skips an empty / unpublished bundle", () => {
    expect(bundleAction(bundle({ version: "" }), 10, "old", [])).toBe("skip");
    expect(bundleAction(bundle({ url: "" }), 10, "old", [])).toBe("skip");
    expect(bundleAction(bundle({ checksum: "" }), 10, "old", [])).toBe("skip");
  });
  it("re-stages an already downloaded bundle but never retries a failed or in-flight one", () => {
    expect(bundleAction(bundle(), 10, "old", [{ version: "1.0.0-new", status: "success" }])).toBe(
      "stage",
    );
    expect(bundleAction(bundle(), 10, "old", [{ version: "1.0.0-new", status: "pending" }])).toBe(
      "stage",
    );
    expect(bundleAction(bundle(), 10, "old", [{ version: "1.0.0-new", status: "error" }])).toBe(
      "skip",
    );
    expect(
      bundleAction(bundle(), 10, "old", [{ version: "1.0.0-new", status: "downloading" }]),
    ).toBe("skip");
  });
});

describe("shouldCheck", () => {
  const now = 5_000_000_000;
  it("checks the first time, after 6h, or when forced", () => {
    expect(shouldCheck(null, now, false)).toBe(true);
    expect(shouldCheck(now - CHECK_INTERVAL_MS, now, false)).toBe(true);
    expect(shouldCheck(now - 1000, now, true)).toBe(true);
  });
  it("throttles within 6h", () => {
    expect(shouldCheck(now - CHECK_INTERVAL_MS + 1, now, false)).toBe(false);
  });
});
