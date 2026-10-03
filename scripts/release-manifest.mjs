#!/usr/bin/env node
// Updates manifest.json (in a checkout of njkr/talentpilot-releases) for one release.
// All inputs come from environment variables; nothing here is secret.
//
//   MANIFEST_PATH, BUNDLE_VERSION, BUNDLE_URL, BUNDLE_CHECKSUM, BUNDLE_SESSION_KEY, MIN_NATIVE_VERSION_CODE
//   (native release only) NATIVE_RELEASE=true NATIVE_VERSION_CODE NATIVE_VERSION_NAME
//   NATIVE_APK_URL NATIVE_MIN_SUPPORTED NATIVE_NOTES NATIVE_HASH
import { readFileSync, writeFileSync } from 'node:fs';
import { applyRelease } from './lib/manifest.mjs';

const env = process.env;
const manifest = JSON.parse(readFileSync(env.MANIFEST_PATH, 'utf8'));

const next = applyRelease(manifest, {
  bundle: {
    version: env.BUNDLE_VERSION,
    url: env.BUNDLE_URL,
    checksum: env.BUNDLE_CHECKSUM,
    sessionKey: env.BUNDLE_SESSION_KEY,
    minNativeVersionCode: Number(env.MIN_NATIVE_VERSION_CODE),
  },
  native:
    env.NATIVE_RELEASE === 'true'
      ? {
          versionCode: Number(env.NATIVE_VERSION_CODE),
          versionName: env.NATIVE_VERSION_NAME,
          apkUrl: env.NATIVE_APK_URL,
          minSupportedVersionCode: Number(env.NATIVE_MIN_SUPPORTED),
          notes: env.NATIVE_NOTES ?? '',
          nativeHash: env.NATIVE_HASH ?? '',
        }
      : undefined,
});

writeFileSync(env.MANIFEST_PATH, JSON.stringify(next, null, 2) + '\n');
console.log(`manifest updated: bundle ${next.bundle.version}, native build ${next.native.versionCode}`);
