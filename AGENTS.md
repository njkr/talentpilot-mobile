<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Native features go through src/lib/native.ts (lazy Capacitor imports with web fallbacks) so the browser preview keeps working.
- App-wide sheets (upgrade, new analysis) and connectivity use tiny stores in src/lib/stores.ts; open BottomSheets register there so the Android back button closes them first.
- Lists use useList (cursor infinite query) + InfiniteList from src/components/app.tsx; mutations route errors through toastError/handleUpgradeError.
- Keep global top chrome on the five tab roots only; stack and detail screens use PageHeader for back, title, and actions so mobile navigation is not duplicated.

## Android build (do not break)
- Keep capacitor.config.ts webDir = "dist/client", the build:mobile script, and vite.config.mobile.ts — CI builds the APK from them.
- Never hardcode absolute Lovable-domain URLs; keep the app a client-routed SPA reading the API URL from VITE_API_BASE_URL.
- Never delete android/ or .github/workflows/android-apk.yml — they're the committed native project and APK workflow.
- Never change webDir ("dist/client"), the build:mobile script, vite.config.mobile.ts, or the android/ folder — the user has confirmed these are fixed.
- Dependencies must stay recorded in package.json and bun.lock — CI runs bun install --frozen-lockfile, so use bun add/remove rather than manual edits.

## Live updates (do not break)
- Keep UpdateSheets mounted in src/routes/__root.tsx — it calls notifyAppReady(); without it the updater rolls back the bundle.
- Keep CapacitorUpdater { autoUpdate: false } in capacitor.config.ts and never add server.url — updates are manual, staged for next cold start.
- Never remove src/lib/updates.ts, the Me-screen version/update rows, or @capgo/capacitor-updater — they are the self-update path for sideloaded installs.
- Adding/upgrading a Capacitor plugin triggers a native APK release — avoid casual native dependency changes.

## Security / session (do not regress)
- Auth bootstrap (src/lib/auth.tsx) only signs out on 401 TOKEN_INVALID / TOKEN_REUSE_DETECTED or no stored token; network/5xx keep the token and use the cached user — offline launches must not log users out.
- The API URL comes only from VITE_API_BASE_URL (src/config.ts); no hardcoded fallback — leaked/stale tunnels otherwise ship in builds.
- Fonts are self-hosted via @fontsource; no Google Fonts links — works offline and avoids third-party requests.
- AndroidManifest keeps allowBackup="false" + data_extraction_rules — tokens must not leave the device.
- Live-update bundles must be Capgo-signed (sessionKey); the public key lives in .capgo_key_v2.pub, the private key only in CI.
