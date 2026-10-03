import test from "node:test";
import assert from "node:assert/strict";
import { applyRelease, needsNativeRelease, resolveMinNative } from "./lib/manifest.mjs";

const base = {
  bundle: { version: "", url: "", checksum: "", minNativeVersionCode: 1 },
  native: {
    versionCode: 1,
    versionName: "1.0.0",
    apkUrl: "",
    minSupportedVersionCode: 1,
    notes: "",
  },
};
const sha = "a".repeat(64);
const bundle = (over = {}) => ({
  version: "1.0.0-abc1234",
  url: "https://github.com/njkr/talentpilot-releases/releases/download/bundle-1.0.0-abc1234/bundle-1.0.0-abc1234.zip",
  checksum: sha,
  sessionKey: "iv==:key==",
  minNativeVersionCode: 1,
  ...over,
});
const native = (over = {}) => ({
  versionCode: 12,
  versionName: "1.0.0",
  apkUrl:
    "https://github.com/njkr/talentpilot-releases/releases/download/native-12/talentpilot-1.0.0-12.apk",
  minSupportedVersionCode: 1,
  notes: "Fixes",
  nativeHash: "h1",
  ...over,
});

test("bundle-only release leaves the native section untouched", () => {
  const m1 = applyRelease(base, { bundle: bundle(), native: native() });
  const m2 = applyRelease(m1, { bundle: bundle({ version: "1.0.0-def5678" }) });
  assert.equal(m2.bundle.version, "1.0.0-def5678");
  assert.deepEqual(m2.native, m1.native);
});

test("native release replaces the native section and records the hash", () => {
  const m = applyRelease(base, { bundle: bundle(), native: native() });
  assert.equal(m.native.versionCode, 12);
  assert.equal(m.native.nativeHash, "h1");
});

test("does not mutate its input", () => {
  const copy = structuredClone(base);
  applyRelease(base, { bundle: bundle(), native: native() });
  assert.deepEqual(base, copy);
});

test("rejects bad input", () => {
  assert.throws(() => applyRelease(base, { bundle: bundle({ checksum: "nope" }) }), /hex/);
  assert.throws(() => applyRelease(base, { bundle: bundle({ sessionKey: "" }) }), /sessionKey/);
  assert.throws(() => applyRelease(base, { bundle: bundle({ url: "http://x" }) }), /https/);
  assert.throws(() => applyRelease(base, { bundle: bundle({ version: "" }) }), /version/);
  assert.throws(
    () => applyRelease(base, { bundle: bundle(), native: native({ minSupportedVersionCode: 99 }) }),
    /minSupported/,
  );
  assert.throws(
    () => applyRelease(base, { bundle: bundle({ minNativeVersionCode: 0 }) }),
    /minNative/,
  );
});

test("needsNativeRelease: first release, hash change, forced, unchanged", () => {
  assert.equal(needsNativeRelease({ manifest: base, nativeHash: "h1", forced: false }), true); // no apk yet
  const m = applyRelease(base, { bundle: bundle(), native: native() });
  assert.equal(needsNativeRelease({ manifest: m, nativeHash: "h1", forced: false }), false);
  assert.equal(needsNativeRelease({ manifest: m, nativeHash: "h2", forced: false }), true);
  assert.equal(needsNativeRelease({ manifest: m, nativeHash: "h1", forced: true }), true);
});

test("resolveMinNative precedence", () => {
  assert.equal(
    resolveMinNative({ override: 7, requireNew: true, newVersionCode: 12, fileValue: 3 }),
    7,
  );
  assert.equal(
    resolveMinNative({ override: NaN, requireNew: true, newVersionCode: 12, fileValue: 3 }),
    12,
  );
  assert.equal(
    resolveMinNative({ override: NaN, requireNew: false, newVersionCode: 12, fileValue: 3 }),
    3,
  );
  assert.equal(
    resolveMinNative({
      override: NaN,
      requireNew: false,
      newVersionCode: 12,
      fileValue: undefined,
    }),
    1,
  );
});
