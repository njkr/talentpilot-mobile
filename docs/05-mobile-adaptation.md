# Mobile Adaptation (Android via Capacitor)

Recommendations; none of this is in the existing code. Screen names refer to `04-screens-and-flows.md`.

## 1. Navigation

**Bottom tabs (5)** — the web has 7 nav items; fold the rest:

| Tab | Maps to | Why |
|---|---|---|
| Home | Dashboard | `GET /dashboard` is one call; action items drive the user |
| Resumes | Resumes list → detail (stack) | Core asset; upload from phone files/camera-scan *(scan = future)* |
| Jobs | Jobs list → new → detail (stack) | Paste-from-clipboard is the natural mobile entry |
| Analyses | Workspaces list → detail (stack) | The product's value (reports, suggestions, cover letter…) |
| Me | Settings hub | Profile, Billing, Credits history, Invite, Security, Notifications, Account, Logout |

- **Top bar** (all tabs): title, **credit pill** (→ Billing), **bell** (→ Notifications screen, full-page list instead of popover).
- **Stack screens** (no tab bar when inside): Resume detail, Job detail/new, Workspace detail, Report sub-tabs, Billing, Invite, Notifications, legal/info.
- **Auth stack** (no tabs): Login, Register, Verify OTP, Forgot password, Reset password.
- **Workspace detail** has 7 web tabs → use a **horizontally scrollable segmented control** (ATS Report · Suggestions · Cover Letter · Interview · Company · Salary · Learning), keeping the lazy fetch-on-open behaviour. Default tab Report.
- Android hardware **Back**: pop stack; at a tab root go to Home, then exit (use `@capacitor/app` `backButton`).

## 2. Component translation

| Web | Mobile |
|---|---|
| Desktop sidebar / hamburger drawer | Bottom tabs + "Me" hub (no drawer) |
| Radix Modal (centered) | **Bottom sheet** (`vaul`/shadcn Drawer) with 16px radius top; full-screen for forms/pickers |
| Dropdown menus (`…` on cards) | Long-press or `…` opening an action sheet |
| Popover (notifications) | Full screen |
| Grid `sm:grid-cols-2` cards | Single-column full-width cards |
| Keyword/credit-history **tables** | Stacked list rows: keyword + importance/status badges on one line, evidence/suggestion collapsed below |
| Score breakdown table/bars | Vertical list of labelled progress bars |
| Recharts sparkline / activity | Keep tiny sparkline (h-12); activity = 14 small bars; or drop activity in v1 |
| Hover states (`hover:bg-bg`) | `active:` pressed states (`active:bg-border/40`), no hover-only affordances |
| Tooltips | Inline captions or tap-to-expand |
| Checkbox multi-select (suggestions) | Keep checkbox on card + **sticky bottom action bar** "Apply N" |
| File dropzone (drag & drop) | Large "Choose file" button (system picker, PDF/DOCX) |
| `window.open` / `<a target=_blank>` | `@capacitor/browser` `Browser.open` |
| Toast bottom | Toast above bottom tabs + safe area; 4s |

## 3. Touch, layout, platform
- **Touch targets ≥ 44×44px** (web buttons are 32–40px and inputs 36px — override: buttons `h-11`, inputs `h-11 text-base` (16px prevents WebView zoom), icon buttons `h-11 w-11`, list rows `min-h-[56px]`, spacing between targets ≥ 8px).
- **Safe areas**: `viewport-fit=cover`; pad with `env(safe-area-inset-top|bottom|left|right)`; bottom tab bar `pb-[env(safe-area-inset-bottom)]`; sticky action bars likewise. Use `@capacitor/status-bar` (style Light, background `#ffffff`) and `@capacitor/keyboard` (resize: `body` or `native`) so the keyboard doesn't cover the OTP/answer fields.
- **Pull-to-refresh** on Home, Resumes, Jobs, Analyses, Notifications, Billing (invalidate the TanStack query; custom touch handler or `react-simple-pull-to-refresh`).
- **Pagination**: infinite scroll with `useInfiniteQuery` using `meta.nextCursor` / `meta.hasMore` (`limit=20`).
- **Typography**: keep Inter; body 14px→15px acceptable; min 12px captions.
- **OTP input**: `inputMode="numeric"`, `autoComplete="one-time-code"`.
- **Offline / errors**: `@capacitor/network` listener → persistent banner "You're offline". TanStack Query `networkMode: 'offlineFirst'`/persist cache (`@tanstack/query-sync-storage-persister`) so Home/Resumes/Jobs/Reports render stale data offline. Disable mutating buttons while offline (analyze, apply, upload, checkout) with explanatory caption. Never auto-retry mutations (the backend charges credits). Error mapping = `lib/error-actions.ts` table (see 04 §1). Show `requestId` in an "details" expander of error screens for support.
- **Long-running work (analysis ≈ minutes)**: SSE works in the Android WebView via `EventSource` (CORS-enabled; ticket auth, so no headers needed). When the app is backgrounded Android may kill the connection: on `appStateChange → active` re-open (ticket is single-use, mint a new one) or fall back to polling `GET /workspaces/runs/:id` every 3 s. Local push for completion would need FCM — **no push infrastructure exists in the API** (v2).
- **Deep links** (email links point at the web `APP_URL`): `reset-password?token=`, referral `register?ref=`. Android App Links need the web domain's `assetlinks.json` + `@capacitor/app` `appUrlOpen` handler. v1 fallback: user opens email on the phone → web page. See 06 §6.

## 4. Auth token storage (CRITICAL)

**Current API relies on a cookie for the refresh token** (`tp_rt`, httpOnly, `path=/api/v1/auth`, SameSite=None;Secure cross-site) and never returns it in JSON. The web app keeps the access token in memory only and re-bootstraps from the cookie on every load. This does **not** transfer cleanly to Capacitor:
- The WebView origin is `https://localhost` (or `http://localhost`, `capacitor://localhost` on iOS) → cross-site to the API; Android WebView increasingly blocks third-party cookies, and cookie persistence across app restarts isn't guaranteed. A mobile app must not depend on it.
- **Required backend change** (06 §2): let mobile clients receive the refresh token in the response body and send it back in the body/header (e.g. `X-Client: mobile` opt-in).
- **Mobile storage** once available:
  - Refresh token → **secure storage**: `@capacitor-community/secure-storage` / `capacitor-secure-storage-plugin` (Android Keystore). Fallback `@capacitor/preferences` (unencrypted SharedPreferences — acceptable only if you accept device-root risk; prefer secure storage).
  - Access token → memory only (as web does) + re-derive on launch via refresh. Do **not** put either in `localStorage`.
  - Hydrate at startup: read refresh token → `POST /auth/refresh` → set session; splash screen until resolved (mirrors `RequireAuth` loading state). Rotation: **every refresh returns a new refresh token — persist it immediately and atomically**, serialise refresh calls (single in-flight promise); on `TOKEN_SUPERSEDED` retry once with the *current* stored token; on `TOKEN_INVALID`/`TOKEN_REUSE_DETECTED` wipe storage and go to Login.
  - Logout: `POST /auth/logout` (revokes the family) then wipe storage + clear TanStack cache.
  - Biometric unlock (`@capacitor-community/biometric-auth`) optional v2.

## 5. Scope for mobile v1

**Include**: Auth (login, register, OTP, forgot/reset), Home dashboard, Resumes (list, upload from file picker, status/poll, rename, delete, sections read-only + summary edit), Jobs (paste, upload, detail, fix missing fields), Analyses (create, analyze w/ match pre-check, live progress, retry), Results tabs (Report, Suggestions apply/reject/provide-detail, Cover letter + regenerate, Interview + practice, Company, Salary, Learning), Notifications (in-app list), Credits pill + history, Profile settings, Sessions/Security, Account (export, delete — required by Play policy for account deletion), Sign-out.

**Defer to v1.1/v2**: Version history diff/restore UI, document export (PDF/DOCX) *(include only if downloads are solved, see below)*, billing/plans/credit packs *(see risk below)*, referrals/invite, notification email preferences, push notifications, biometric lock, resume scan/camera, deep links.
**Drop**: marketing pages, onboarding wizard (`/onboarding`), `/kit`, all `/admin/*`, Next proxy/ngrok concerns.

**Billing on Android (policy risk)**: Google Play requires Play Billing for digital goods consumed in-app (subscriptions, credit packs). Current backend uses Stripe Checkout/Portal and web redirect URLs (`APP_URL/billing?...`). Recommended v1: show balance + plan read-only; "Manage plan on the web" button opening `Browser.open(APP_URL + '/billing')`. Do not ship Stripe purchase buttons in a Play Store build without legal/policy review. (Decision for owner — Open Q M3.)

**File handling on mobile**:
- Upload: `<input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document">` works in Android WebView and opens the system picker; send via `FormData` field `file` (no manual Content-Type). Client precheck ≤10MB.
- Downloads: `GET /workspaces/:id/documents/:docId/download` returns a presigned URL (works with `Browser.open` or `@capacitor/filesystem` + `@capacitor/share`). `GET /resumes/:id/download` is a **302 requiring a Bearer header** — a plain link won't carry it; call via `fetch` with header (manual redirect) or use the document-export route instead.
- Copy: `@capacitor/clipboard` for cover letters; `@capacitor/share` for sharing referral link/letters.

## 6. Capacitor setup checklist
- `capacitor.config.ts`: `appId`, `appName: 'TalentPilot'`, `webDir: 'dist'`, `server.androidScheme: 'https'` (WebView origin becomes `https://localhost`), `plugins.SplashScreen`, `StatusBar`, `Keyboard`.
- API calls over HTTPS only (Android blocks cleartext by default; dev tunnels like ngrok are HTTPS). `VITE_API_BASE_URL` must be absolute (`https://api.example.com/api/v1`) — **the web's relative `/api/v1` + Next proxy does not exist in the APK**.
- If using `CapacitorHttp` (native HTTP) CORS is bypassed, but SSE still needs WebView `fetch/EventSource` → backend CORS must still allow the origin (06 §1).
- Plugins: `@capacitor/app`, `/browser`, `/network`, `/status-bar`, `/keyboard`, `/clipboard`, `/share`, `/preferences`, secure-storage plugin, `/splash-screen`, `/haptics` (optional).
- Request header: ngrok free tunnels need `ngrok-skip-browser-warning: true` on every request (the web proxy adds it); keep it in the mobile client during dev only.
