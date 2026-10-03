#!/usr/bin/env node
// Decides what the workflow should publish. Prints `key=value` lines for $GITHUB_OUTPUT.
//
//   MANIFEST_PATH        current manifest.json from the releases repo ("{}" if unreadable)
//   NATIVE_HASH          output of scripts/native-hash.mjs
//   FORCE_NATIVE         "true" when the dispatch input release_native is set
//   REQUIRE_NEW_NATIVE   "true" -> bundles then require THIS native build
//   MIN_NATIVE_OVERRIDE  optional explicit minNativeVersionCode (dispatch input)
//   NOTES_OVERRIDE       optional release notes (dispatch input)
//   VERSION_CODE         this run's Android versionCode
import { readFileSync } from 'node:fs';
import { needsNativeRelease, resolveMinNative } from './lib/manifest.mjs';

const env = process.env;
let manifest = {};
try {
  manifest = JSON.parse(readFileSync(env.MANIFEST_PATH, 'utf8'));
} catch {
  /* first release / unreadable: treated as "no native published yet" */
}
const file = JSON.parse(readFileSync('native-version.json', 'utf8'));

const releaseNative = needsNativeRelease({
  manifest,
  nativeHash: env.NATIVE_HASH,
  forced: env.FORCE_NATIVE === 'true',
});
const versionCode = Number(env.VERSION_CODE);
const override = env.MIN_NATIVE_OVERRIDE ? Number(env.MIN_NATIVE_OVERRIDE) : NaN;

const minNative = resolveMinNative({
  override,
  requireNew: releaseNative && env.REQUIRE_NEW_NATIVE === 'true',
  newVersionCode: versionCode,
  fileValue: file.minNativeVersionCode,
});
const minSupported = Math.min(
  Number.isInteger(file.minSupportedVersionCode) ? file.minSupportedVersionCode : 1,
  releaseNative ? versionCode : Number.MAX_SAFE_INTEGER,
);
const notes = (env.NOTES_OVERRIDE || file.notes || '').replace(/\s+/g, ' ').trim();

console.log(`release_native=${releaseNative}`);
console.log(`min_native=${minNative}`);
console.log(`min_supported=${minSupported}`);
console.log(`notes=${notes}`);
