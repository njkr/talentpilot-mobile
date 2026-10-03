# Building the Android APK

Prerequisites: Node 20+, Android Studio (with an SDK + JDK 17).

1. `git pull`
2. `npm i`
3. Set the API address for the build (optional — defaults to the value in `src/config.ts`):
   - macOS/Linux: `VITE_API_BASE_URL=https://api.example.com/api/v1 npm run build`
   - Windows (PowerShell): `$env:VITE_API_BASE_URL="https://api.example.com/api/v1"; npm run build`
   - Or put `VITE_API_BASE_URL=...` in a `.env.production` file, then `npm run build`.
4. Make sure the build output folder contains an `index.html`. If your build writes it to `dist/client`, change `webDir` in `capacitor.config.ts` to `dist/client` (the app must be built as a static single-page app).
5. `npx cap add android` (first time only)
6. `npx cap sync`
7. `npx cap open android` — Android Studio opens.
8. In Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**. The APK lands in `android/app/build/outputs/apk/debug/`.

Server side: add `https://localhost` to the API's `CORS_ORIGINS` (Capacitor's Android origin).

After code changes, repeat steps 3, 6 and 8.

---

## Build via GitHub Actions (no Android Studio needed)

The workflow `.github/workflows/android-apk.yml` builds a **debug APK** in the cloud.

1. **Add the repo secret** `VITE_API_BASE_URL` (Settings → Secrets and variables → Actions → New repository secret). Use the full URL **including `/api/v1`**. For now:
   `https://bacf-2001-8f8-1a3f-834e-94d9-a569-2e9b-84dd.ngrok-free.app/api/v1`
2. **Run it:** Actions tab → *Android build & release* → *Run workflow* (it also runs on every push to `main`). You can paste a URL into the optional `api_base_url` input to override the secret for one run.
3. **Download:** open the finished run → *Artifacts* → `talentpilot-debug-<short-sha>`. Unzip it, copy `app-debug.apk` to the phone, allow *Install unknown apps* for your file manager/browser, and install.
4. **If the ngrok URL changes**, update the secret (or use the `api_base_url` input) and re-run — the URL is baked into the APK at build time.

How the mobile build differs from the Lovable build: the app is TanStack Start (SSR, Cloudflare). `npm run build` is untouched. `npm run build:mobile` uses `vite.config.mobile.ts` to emit a static SPA to `dist/client/` (with `index.html`), which is Capacitor's `webDir`. **Do not change `webDir`, `build:mobile` or `vite.config.mobile.ts`.**

Local equivalent: `bun run build:mobile && npx cap sync android` (then Android Studio, or `cd android && ./gradlew assembleDebug` with JDK 21).

## Auto-updates (sideloaded app)

The installed app updates itself in two ways. Both read `https://njkr.github.io/talentpilot-releases/manifest.json`, written by the workflow into the public repo `njkr/talentpilot-releases` (GitHub Pages serves the manifest, GitHub Releases hold the files).

| Update | What changes | How the user gets it |
|---|---|---|
| **Web bundle** (live update) | The web app (everything Lovable edits) | Downloaded silently in the background, applied on the **next cold start** (close the app fully, reopen). A toast "Update ready — restart to apply" offers an immediate restart. |
| **Native** (APK) | `android/`, `capacitor.config.ts`, native plugins | An **"Update available"** sheet (or a blocking **"Update required"** one) opens the APK download; the user taps the file to install over the old app. |

**What every push to `main` does** (workflow *Android build & release*): builds the web app, zips `dist/client` as `bundle-<version>.zip` (`<package.json version>-<short sha>`, with its SHA-256), builds the APK, and publishes the bundle. It also publishes a new **APK** release (`talentpilot-<versionName>-<versionCode>.apk`) when native inputs changed since the last native release (a hash of `android/`, `capacitor.config.ts` and the resolved native plugin versions is stored in the manifest) or when you tick **release_native**. The APK's `versionCode` is the workflow run number; `versionName` comes from `package.json`.

The app checks on start and when returning to the foreground, at most once every 6 hours. **Me → Check for updates** forces a check. "Update available" is hidden for 24h after "Later"; "Update required" cannot be dismissed.

### Required secrets (repo `njkr/talentpilot-mobile`)

| Secret | What it is |
|---|---|
| `VITE_API_BASE_URL` | API base URL incl. `/api/v1` (baked into each build) |
| `ANDROID_DEBUG_KEYSTORE` | base64 of a **stable** debug keystore (alias `androiddebugkey`, password `android`). Android only installs an update signed with the **same key** as the installed app, and every CI runner would otherwise generate a different one. Keep a backup of the keystore file. |
| `RELEASES_REPO_TOKEN` | Fine-grained personal access token with **Contents: read & write** on `njkr/talentpilot-releases` only. Create it at GitHub → Settings → Developer settings → Fine-grained tokens, then `gh secret set RELEASES_REPO_TOKEN --repo njkr/talentpilot-mobile`. Without it the workflow still builds and uploads the APK as an artifact, but publishes nothing. |

> One-time consequence of the stable key: an APK installed *before* it was introduced was signed with a throwaway key, so it cannot be updated in place — uninstall it once and install a build from the stable-key workflow. After that, updates install over the top without uninstalling.

### Forcing a native release / when to bump `minNativeVersionCode`

- **Force an APK release:** Actions → *Android build & release* → *Run workflow* → tick **release_native** (optionally add `notes`, shown in the update sheet).
- **`minNativeVersionCode`** (in `manifest.json` → `bundle`) says "this web bundle needs at least this native build". Bump it **only when a web change depends on new native code** (new/updated Capacitor plugin, changed `capacitor.config.ts`, new permission): run with **release_native + require_new_native** — the bundle is then offered only to devices already on this new build, and older devices get the "Update available" prompt first. For other cases leave it alone; you can also set it explicitly with `min_native_version_code`, or edit `native-version.json`.
- **Make an update mandatory:** set `minSupportedVersionCode` in `native-version.json` to the versionCode that must be installed, then run **release_native**. Devices below it see the blocking "Update required" sheet.

### Rolling back

Releases are never deleted, so rollback is re-pointing the manifest: edit `manifest.json` in `njkr/talentpilot-releases` and set `bundle.version`, `bundle.url` and `bundle.checksum` to the values of an earlier bundle release (the SHA-256 is in the workflow run's output / compute it with `sha256sum bundle-<version>.zip`). Devices on the newer bundle will see a *different* version and switch to it on their next check (within 6 h). To pull a bad **native** release, point `native.apkUrl`/`versionCode`/`versionName` back at the previous APK release (devices that already installed the bad one stay on it until a higher versionCode ships).

### Testing the update path

1. Install build N (APK from the workflow artifact or the `native-N` release).
2. Push a visible text change to `main` → CI publishes a new bundle.
3. Open the app (it downloads the bundle), then **fully close and reopen** it → the change appears, no reinstall. *Me* shows the new bundle version.
4. Push a native change (e.g. a plugin or `android/` edit) → CI publishes a new APK → open the app → **Update available** → Download → install over the old app (no uninstall).

## Later: release builds for the Play Store (not implemented)

- A release **keystore** (generated once, backed up safely — losing it blocks updates unless Play App Signing is used).
- Repo secrets: base64 keystore, keystore password, key alias, key password; a workflow step that decodes the keystore and passes signing properties to Gradle.
- `./gradlew bundleRelease` → `app-release.aab` (Play requires AAB), uploaded to Play Console.
- A stable production API URL (not ngrok), a bumped `versionCode`/`versionName` per release, store listing assets, and a privacy policy.

## Release signing (opt-in: `build_type: release`)

Push builds stay **debug** for now. A manual run with `build_type = release` builds a minified, release-signed APK.

1. Create the key once (keep it forever — **if it is lost, installed apps can never be updated again**):
   ```bash
   keytool -genkeypair -v -keystore talentpilot-release.jks -alias talentpilot \
     -keyalg RSA -keysize 4096 -validity 10000
   ```
2. Back it up in two places (password manager + offline drive), with both passwords and the alias.
3. Add repo secrets: `ANDROID_RELEASE_KEYSTORE` (`base64 -w0 talentpilot-release.jks`), `ANDROID_RELEASE_KEYSTORE_PASSWORD`, `ANDROID_RELEASE_KEY_ALIAS`, `ANDROID_RELEASE_KEY_PASSWORD`.
4. Moving users from debug to release: the signing key changes, so every installed debug build must be **uninstalled once** before installing the release APK.

## Signed live-update bundles

Every published bundle is encrypted/signed with Capgo; the app rejects bundles without a session key.

1. Create the key pair (in a scratch copy, so the config isn't rewritten): `npx @capgo/cli@8.70.0 key create`.
2. Commit **only** `.capgo_key_v2.pub` at the repo root (read by `capacitor.config.ts` → `CapacitorUpdater.publicKey`).
3. Save the private key `.capgo_key_v2` as the `CAPGO_PRIVATE_KEY` repo secret, and back it up. Never commit it (gitignored).
4. Publishing fails if either is missing.
5. **This needs a native release.** The first run after adding the key must use **release_native + require_new_native**: that sets `minNativeVersionCode` to that build, so signed bundles go only to apps that have the public key; older apps get the "Update available" prompt first.
