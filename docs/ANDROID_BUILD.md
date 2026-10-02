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
2. **Run it:** Actions tab → *Android debug APK* → *Run workflow*. You can paste a URL into the optional `api_base_url` input to override the secret for one run. Pushing a tag like `v0.1.0` also triggers it.
3. **Download:** open the finished run → *Artifacts* → `talentpilot-debug-<short-sha>`. Unzip it, copy `app-debug.apk` to the phone, allow *Install unknown apps* for your file manager/browser, and install.
4. **If the ngrok URL changes**, update the secret (or use the `api_base_url` input) and re-run — the URL is baked into the APK at build time.

How the mobile build differs from the Lovable build: the app is TanStack Start (SSR, Cloudflare). `npm run build` is untouched. `npm run build:mobile` uses `vite.config.mobile.ts` to emit a static SPA to `dist/client/` (with `index.html`), which is Capacitor's `webDir`. **Do not change `webDir`, `build:mobile` or `vite.config.mobile.ts`.**

Local equivalent: `bun run build:mobile && npx cap sync android` (then Android Studio, or `cd android && ./gradlew assembleDebug` with JDK 21).

## Later: release builds for the Play Store (not implemented)

- A release **keystore** (generated once, backed up safely — losing it blocks updates unless Play App Signing is used).
- Repo secrets: base64 keystore, keystore password, key alias, key password; a workflow step that decodes the keystore and passes signing properties to Gradle.
- `./gradlew bundleRelease` → `app-release.aab` (Play requires AAB), uploaded to Play Console.
- A stable production API URL (not ngrok), a bumped `versionCode`/`versionName` per release, store listing assets, and a privacy policy.
