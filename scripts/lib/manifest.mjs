// Pure helpers for the release manifest (served at
// https://njkr.github.io/talentpilot-releases/manifest.json). Kept free of I/O so they can be
// unit-tested with `node --test scripts/`.


function must(cond, msg) {
  if (!cond) throw new Error(`release-manifest: ${msg}`);
}

/**
 * Returns a NEW manifest with the given release applied.
 *  - bundle: always replaced (version, url, checksum, minNativeVersionCode).
 *  - native: replaced only when a native release is given; otherwise the previous native
 *    section is preserved exactly (so a bundle-only release never touches the APK entry).
 */
export function applyRelease(manifest, { bundle, native }) {
  must(bundle, 'bundle is required');
  must(bundle.version, 'bundle.version is empty');
  must(/^https:\/\//.test(bundle.url), 'bundle.url must be https');
  // Signed bundles carry the Capgo-encrypted checksum (long hex) + ivSessionKey.
  must(bundle.sessionKey, 'bundle.sessionKey is empty (bundle must be signed/encrypted)');
  must(/^[0-9a-f]{64,}$/i.test(bundle.checksum), 'bundle.checksum must be a hex string');
  must(Number.isInteger(bundle.minNativeVersionCode) && bundle.minNativeVersionCode >= 1, 'bundle.minNativeVersionCode must be an integer >= 1');

  const next = {
    bundle: {
      version: bundle.version,
      url: bundle.url,
      checksum: bundle.checksum,
      sessionKey: bundle.sessionKey,
      minNativeVersionCode: bundle.minNativeVersionCode,
    },
    native: { ...manifest.native },
  };

  if (native) {
    must(Number.isInteger(native.versionCode) && native.versionCode >= 1, 'native.versionCode must be an integer >= 1');
    must(native.versionName, 'native.versionName is empty');
    must(/^https:\/\//.test(native.apkUrl), 'native.apkUrl must be https');
    must(
      Number.isInteger(native.minSupportedVersionCode) &&
        native.minSupportedVersionCode >= 1 &&
        native.minSupportedVersionCode <= native.versionCode,
      'native.minSupportedVersionCode must be between 1 and versionCode',
    );
    next.native = {
      versionCode: native.versionCode,
      versionName: native.versionName,
      apkUrl: native.apkUrl,
      minSupportedVersionCode: native.minSupportedVersionCode,
      notes: native.notes ?? '',
      nativeHash: native.nativeHash ?? '',
    };
  }
  return next;
}

/** True when the committed native inputs differ from what the last native release was built from. */
export function needsNativeRelease({ manifest, nativeHash, forced }) {
  if (forced) return true;
  const n = manifest?.native;
  return !n || !n.apkUrl || n.nativeHash !== nativeHash;
}

/** minNativeVersionCode for the bundle: explicit override > "require the new native" > file value. */
export function resolveMinNative({ override, requireNew, newVersionCode, fileValue }) {
  if (Number.isInteger(override) && override >= 1) return override;
  if (requireNew && Number.isInteger(newVersionCode)) return newVersionCode;
  return Number.isInteger(fileValue) && fileValue >= 1 ? fileValue : 1;
}
