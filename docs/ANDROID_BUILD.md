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
