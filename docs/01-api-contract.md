# TalentPilot API Contract (from `talentpilot-api`, NestJS 10)

All TypeScript types referenced here live in `02-types.ts`. Paths are relative to `talentpilot-api/src/`.
**Swagger exists** (`/api/docs`, `main.ts`) but `openapi.json` could NOT be exported: generating it requires booting the app (Postgres+pgvector, Redis). See Open Questions §A1. The Postman collection `talentpilot-api/postman/TalentPilot-API.postman_collection.json` is the nearest machine-readable alternative.

## 0. Base config (`main.ts`, `app.module.ts`, `config/env.schema.ts`)

| Item | Value |
|---|---|
| Global prefix | `/api/v1` (every path below is relative to this) |
| Versioning | Path prefix only; no Nest versioning |
| Port | `PORT` env (`.env.example`: 3000) |
| Body parsing | JSON + urlencoded; raw body only for `/payments/webhook` |
| CORS | `origin: [APP_URL, ...CORS_ORIGINS(comma list)]`, `credentials: true`. No other options (default methods/headers). **No Capacitor origins are allowed by default** → see 06-backend-changes.md |
| Cookies | `cookie-parser` enabled; refresh token is an httpOnly cookie `tp_rt` |
| Validation | Global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, enableImplicitConversion: true })` → **unknown body props are rejected with 400** (send only documented fields) |
| Rate limit | Global 100 req/min (`ThrottlerGuard`); per-route overrides noted below. 429 → `RATE_LIMITED` with `details.retryAfterSec` (always 60) |
| Request ID | `meta.requestId` in every response (`common/middleware/request-id.middleware.ts`) |
| Swagger | `/api/docs`, bearer scheme `access-token`, cookie scheme `tp_rt` |
| Health | `GET /health/live`, `GET /health/ready` (public, **raw bodies, no envelope**) |

## 1. Envelope & errors (`common/decorators/raw-response.decorator.ts`, `common/filters/all-exceptions.filter.ts`)

Every 2xx (except `@RawResponse`: SSE, health, webhook) is wrapped:
```json
{ "success": true, "data": <payload|null>, "meta": { "requestId": "…", "timestamp": "2026-01-01T00:00:00.000Z" } }
```
List endpoints return `data: T[]` plus `meta.nextCursor` / `meta.hasMore` (and optional `meta.total`). 204 endpoints return no body.

Errors (any status):
```json
{ "success": false,
  "error": { "code": "INSUFFICIENT_CREDITS", "message": "…", "details": { "required": 21, "balance": 5 } },
  "meta": { "requestId": "…", "timestamp": "…" } }
```
- Validation: `400`, `code: "VALIDATION_FAILED"`, `message: "Validation failed."`, `fields: { email: ["email must be an email"] }`. NOTE: the field key is the **first word of the class-validator message**, so it is usually the property name but not guaranteed.
- Passport/Nest `UnauthorizedException` → 401 `TOKEN_INVALID`. Generic `HttpException` → its status with `code: NOT_FOUND` (404) or `INTERNAL_ERROR`. Postgres unique violation → 409 `ALREADY_EXISTS`. Unhandled → 500 `INTERNAL_ERROR`.
- Code → status map and all codes: `ErrorCode` + `ERROR_STATUS` in `02-types.ts` (source `common/exceptions/app.exception.ts`).
- Client reactions defined by the backend: `TOKEN_EXPIRED` → silent refresh+retry; `TOKEN_SUPERSEDED` → retry with current token (NOT logout); `TOKEN_INVALID`/`TOKEN_REUSE_DETECTED` → hard logout; `EMAIL_NOT_VERIFIED` → OTP screen; `INSUFFICIENT_CREDITS`/`PLAN_LIMIT_REACHED` → upgrade prompt.

## 2. Auth (`auth/*`)

- **Strategy**: JWT access token (HS256, `JWT_ACCESS_SECRET`) + rotating opaque refresh token. Access TTL `JWT_ACCESS_TTL` (example 15m). Refresh TTL `REFRESH_TTL_DAYS` (example 30).
- **Access token location**: `Authorization: Bearer <accessToken>` (`auth/strategies/jwt.strategy.ts`, `fromAuthHeaderAsBearerToken`). JWT payload has `sub` (user id) and `ver` (tokenVersion); a password reset bumps `ver` and invalidates all access tokens instantly (→ `TOKEN_INVALID`).
- **Refresh token location**: **httpOnly cookie `tp_rt` ONLY** — never in the JSON body. Cookie attrs: `path=/api/v1/auth`, `httpOnly`, `maxAge=REFRESH_TTL_DAYS`, `secure`+`sameSite=none` when `COOKIE_CROSS_SITE` or `NODE_ENV=production`, else `lax`. `/auth/refresh` and `/auth/logout` read `req.cookies.tp_rt`; there is **no body/header alternative today** (critical for mobile — see 06).
- **Global guard**: `JwtAuthGuard` is `APP_GUARD`; everything is protected unless `@Public()`. Expired token → `401 TOKEN_EXPIRED`; other failures → `401 TOKEN_INVALID`.
- **Other guards**: `VerifiedGuard` (`403 EMAIL_NOT_VERIFIED`) on resume upload and workspace analyze. `RolesGuard`/`AdminGuard` on `/admin/*` (role `admin` AND email in `ADMIN_ALLOWED_EMAILS`). Roles: `'user' | 'admin'`. Suspended accounts: login `403 ACCOUNT_SUSPENDED`.
- **Refresh flow**: refresh rotates the token (new cookie each call). Same-token concurrent refreshes within a ~10 s grace window → loser gets `401 TOKEN_SUPERSEDED` (retry, don't logout). Replay after the grace window = theft → whole family revoked, `TOKEN_REUSE_DETECTED`/`TOKEN_INVALID`. Logout revokes the whole device family.
- **OTP**: 6 digits, `OTP_TTL_MIN` (10), max `OTP_MAX_ATTEMPTS` (5), resend cooldown `OTP_RESEND_COOLDOWN_SEC` (60).
- New accounts get `SIGNUP_CREDIT_GRANT` credits (`.env.example`: 100; `PaymentConfig` entity default 25 — see open questions).

Endpoints (all in `auth/auth.controller.ts`):

### `POST /auth/register` — create unverified account, emails OTP
Public. Throttle 5/min. Body `RegisterRequest`. → **201** `data: User`. Errors: 400 VALIDATION_FAILED, 409 ALREADY_EXISTS (deliberately leaks "taken"), 429.
```json
{ "success": true, "data": { "id": "5f6e2f0a-8e3a-4b7a-9d3e-1a2b3c4d5e6f", "email": "jane@example.com", "isVerified": false, "role": "user", "createdAt": "2026-01-01T10:00:00.000Z" }, "meta": {…} }
```
### `POST /auth/verify-email` — confirm OTP **and log in**
Public. Throttle 10/min. Body `VerifyOtpRequest`. → **200** `SessionResponse` + `Set-Cookie: tp_rt`. Idempotent for already-verified. Errors: 400 OTP_INVALID (`details.remaining`), OTP_EXPIRED; 429 OTP_MAX_ATTEMPTS.
### `POST /auth/resend-otp` — always **204**
Public. Throttle 3/min. Body `EmailRequest`. 429 OTP_COOLDOWN (`details.retryAfterSec`).
### `POST /auth/login`
Public. Throttle 5/min/IP. Body `LoginRequest`. → **200** `SessionResponse` + `Set-Cookie: tp_rt`. Unverified users CAN log in (token issued; `user.isVerified=false`) — verified-only routes then fail with 403. Errors: 401 INVALID_CREDENTIALS "Email or password is incorrect." (identical for unknown email and wrong password), 403 ACCOUNT_SUSPENDED, 429.
### `POST /auth/refresh`
Public. No body; needs cookie `tp_rt`. → **200** `SessionResponse` + new `Set-Cookie`. 401 TOKEN_INVALID (no/invalid cookie, theft), 401 TOKEN_SUPERSEDED (race).
### `POST /auth/logout` — **204**
Bearer required. Reads cookie, revokes family, clears cookie. Idempotent.
### `POST /auth/forgot-password` — always **204** (Public, 5/min). Body `EmailRequest`.
### `POST /auth/reset-password` — **204** (Public, 5/min). Body `ResetPasswordRequest`. 400 RESET_TOKEN_INVALID. Revokes all sessions. The emailed link points at the **web** app (`APP_URL`, route `/reset-password?token=…`) — see open questions for deep links.
### `GET /auth/sessions` → `SessionInfo[]` (newest first; NOT paginated). `DELETE /auth/sessions/:familyId` (uuid) → 204; 404 if not the caller's.

## 3. Users, profile, GDPR

- `GET /users/me` → `User` (`users/users.controller.ts`; the web app never calls it — it relies on the user returned by login/refresh).
- `PATCH /users/me` → `User` — **placeholder**, DTO is empty `{}` and `forbidNonWhitelisted` rejects any property. Don't build UI on it.
- `DELETE /users/me` → **204** soft delete, revokes all sessions, 30-day grace before purge.
- `GET /profiles/me` → `Profile` (`profiles/profiles.controller.ts`). `PUT /profiles/me` body `UpdateProfileRequest` (upsert; all fields optional) → `Profile`.
```json
{ "firstName":"Jane","lastName":"Doe","phone":null,"linkedin":"https://linkedin.com/in/jane","github":null,"portfolio":null,"country":"US","city":"Austin","timezone":"America/Chicago","yearsExperience":6,"targetRole":"Senior Backend Engineer","salaryExpectation":150000,"salaryCurrency":"USD","completeness":71 }
```
- `POST /gdpr/export` → **202**, no body; emails/notifies when ready (`gdpr/gdpr.controller.ts`).

## 4. Resumes (`resumes/*`, `resume-versions/*`)

Status lifecycle: `uploaded → extracting → extracted → parsing → parsed` | `failed`. Poll `GET /resumes/:id` until `parsed|failed` (web polls every 2 s).

- `POST /resumes/upload` — **multipart/form-data, field name `file`**. Verified email required (403 EMAIL_NOT_VERIFIED). Throttle **10/hour**. Accepts **PDF or DOCX only**, validated by magic bytes (not mime/ext). Limits: `MAX_FILE_SIZE_MB` (10), `MAX_RESUME_PAGES` (15, PDF), `MIN_EXTRACTED_CHARS` (200). Plan limit checked first. Identical content (hash) re-upload returns the existing resume. → `Resume` (status `uploaded`; 201 default for POST). Errors: 403 PLAN_LIMIT_REACHED (`details {limit,current,feature}`), 413 FILE_TOO_LARGE (`details.maxMb`), 422 FILE_TYPE_UNSUPPORTED | FILE_TOO_MANY_PAGES | FILE_UNREADABLE | FILE_CORRUPT.
- `GET /resumes?cursor&limit` → `Page<Resume>`. Cursor pagination, newest first, `limit` 1–100 default 20, cursor = opaque base64url(createdAt,id) (`common/dto/cursor-query.dto.ts`, `common/utils/cursor.util.ts`).
- `GET /resumes/:id` → `Resume`. `PATCH /resumes/:id` body `{title}` → `Resume`. `DELETE /resumes/:id` → 204; 409 RESUME_IN_USE (`details.workspaces`).
- `GET /resumes/:id/download` → **302 redirect to a presigned storage URL** (not JSON, Bearer required). Awkward for mobile — see 05/06.
- `POST /resumes/:id/retry` → `Resume` (re-queues a failed parse).
- `GET /resumes/:resumeId/sections` → `ResumeSection[]` (not paginated; may contain duplicates per type — web dedupes by `sectionType`, then sorts by `orderIndex`).
- `PATCH /resumes/:resumeId/sections/:sectionType` body `{content}` (shape per type, strict) → `ResumeSection`. 400/VALIDATION on bad shape. Section types in `02-types.ts`. Web currently only edits `summary` (`{text}`).
- `GET /resumes/:id/versions` → `ResumeVersion[]`. `GET /resumes/:id/versions/diff?from=<int>&to=<int>` → `VersionDiffSection[]` (only changed sections; word-level `diff` parts). `POST /resumes/:id/versions/:version/restore` → `{ version }` (new version number). 404 if a version missing.
```json
{ "id":"…","title":"jane-doe-resume","status":"parsed","pageCount":2,"wordCount":612,"fileSize":184320,"language":"en","parseError":null,"createdAt":"2026-01-01T10:05:00.000Z" }
```

## 5. Job descriptions (`job-descriptions/*`)

Status: `pending → analyzing → analyzed | failed` (web treats `analyzing` as in-progress; `pending` also exists in the entity). Poll `GET /job-descriptions/:id`.
- `POST /job-descriptions/paste` body `PasteJdRequest` → `JobDescription`. 422 JD_TOO_SHORT.
- `POST /job-descriptions/upload` — multipart field **`file`**, PDF/DOCX (shares `FileValidatorService`; exact Multer size limit configured in `job-descriptions.module.ts` — see open questions) → `JobDescription`.
- `GET /job-descriptions?cursor&limit` → `Page<JobDescription>`. `GET /job-descriptions/:id`. `PATCH /job-descriptions/:id` body `UpdateJdRequest`. `POST /job-descriptions/:id/retry`. `DELETE /job-descriptions/:id` → 204.
- Never returns raw description text. `position` is the literal `"Untitled position"` when unresolved; `missingFields` lists `company`/`position` needing user confirmation.
```json
{ "id":"…","company":"Stripe","position":"Backend Engineer","source":"paste","employmentType":"full_time","location":"Remote","remoteType":"remote","experienceRequired":"5+ years","salaryMin":null,"salaryMax":null,"salaryCurrency":null,"parsedData":{"position":"Backend Engineer","company":"Stripe","seniority":"senior","remoteType":"remote","employmentType":"full_time","location":"Remote","experienceRequired":"5+ years","requirements":[{"text":"5+ years Node.js","category":"experience","importance":"required"}],"skills":[{"name":"PostgreSQL","category":"database","importance":"required"}],"keywords":["node","postgres"],"responsibilities":["Design APIs"],"salary":{"min":null,"max":null,"currency":null}},"status":"analyzed","parseError":null,"missingFields":[],"createdAt":"2026-01-01T10:10:00.000Z" }
```
- `POST /resumes/:resumeId/match/:jdId` (`ats/matching.controller.ts`) — free advisory pre-check, no credits → `MatchResponse`. Web uses `coverage` to warn on low required-skill match (<35% "low").

## 6. Workspaces / analysis pipeline (`workspaces/workspaces.controller.ts`)

A Workspace = one resume + one job description + the analysis outputs. Everything below `/workspaces/:id/…` is scoped to the caller (404 otherwise).

- `POST /workspaces` body `CreateWorkspaceRequest` → `Workspace`. (Web names it `"<company> — <position>"`.) Resume must be `parsed`, JD `analyzed` (409 RESUME_NOT_PARSED / JD_NOT_ANALYZED).
- `GET /workspaces?cursor&limit` → `Page<Workspace>` (with `overallScore`). No server-side status filter; web filters client-side.
- `GET /workspaces/:id` → `Workspace`. `DELETE /workspaces/:id` → 204.
- `POST /workspaces/:id/analyze` — **202**, **requires header `Idempotency-Key: <uuid>`** (400 IDEMPOTENCY_KEY_REQUIRED). Verified email required. Cost = `PaymentConfig.analyzeCost` (default 21 credits; web hardcodes 21). → `AnalyzeResponse`. Errors: 402 INSUFFICIENT_CREDITS (`details {required,balance}`), 409 ANALYSIS_ALREADY_RUNNING (`details.runId`). Same key returns the same run (`replayed:true`, no re-charge). Generate **one new UUID per user click**.
- `GET /workspaces/runs/:runId` → `Run`. `POST /workspaces/runs/:runId/retry` → `Run` (409 RUN_NOT_RETRYABLE).
- **Real-time (SSE)**: `POST /workspaces/runs/:runId/stream-ticket` (Bearer) → `{ticket, expiresInSec: 60}`; then `GET /workspaces/runs/:runId/stream?ticket=<ticket>` (**Public, no Authorization header**, `text/event-stream`, no envelope). Ticket is single-use, 60 s (401 STREAM_TICKET_INVALID). Frames are **named events** (`event: snapshot|run.started|step.started|step.completed|step.skipped|step.failed|run.completed|run.failed|ping`) — `onmessage` never fires; use `addEventListener(name)`. First frame is a `snapshot` (subset: `runId,status,progress,steps[{name,status}]`). Heartbeat `ping` every 15 s. Stream completes after `run.completed|run.failed` or a terminal snapshot. `snapshot.data` has no `type` key; others do. Payload types: `RunEvent` in `02-types.ts`. Web falls back to polling `GET /runs/:id` every 3 s after 2 failed reconnects.
  Run statuses: `queued|running|completed|partial|failed|cancelled`. Steps (12): parse_resume, parse_jd, generate_embeddings, match_keywords, score_ats, optimize_resume, generate_cover_letter, build_learning_path, generate_interview_qs, research_company, estimate_salary, finalize (progress weights sum 100; `partial` = some optional steps failed, credits proportionally refunded).
```json
{ "id":"run-uuid","workspaceId":"ws-uuid","status":"running","progress":42,"currentStep":"score_ats","creditsCharged":21,"creditsRefunded":0,"error":null,"steps":[{"name":"match_keywords","status":"completed","error":null},{"name":"score_ats","status":"running","error":null}] }
```
- `GET /workspaces/:id/report` → `AtsReport` (409 REPORT_NOT_READY before first completed run; `original` = first report for before/after, `keywords` full list, `matchBand`). Score colour thresholds used by web: ≥80 success, ≥60 primary, else warning.
- `POST /workspaces/:id/rescore` → `{queued:true}`; costs `PaymentConfig.rescoreCost` (default 5); 409 NO_CHANGES_TO_RESCORE if resume unchanged since last report; 402 INSUFFICIENT_CREDITS. Result arrives asynchronously — refetch `/report` (web polls; no SSE for rescore). Web sends an Idempotency-Key here but the backend ignores it.

## 7. Suggestions (`resume-versions/suggestions.controller.ts`)

AI-generated edits produced during analysis; no AI call here. Applying creates a new resume version.
- `GET /workspaces/:id/suggestions?status=pending|accepted|rejected|stale|needs_info` (default `pending`) → `Suggestion[]` (not paginated).
- `POST /workspaces/:id/suggestions/apply` body `{suggestionIds[]}` (≥1 UUIDv4) → `{version, applied, skipped[]}`.
- `POST /workspaces/:id/suggestions/reject` same body → `{rejected: n}`.
- `POST /workspaces/:id/suggestions/:suggestionId/provide-detail` body `{newText}` (1–2000) → `Suggestion` (for `needs_info` suggestions that lack a factual detail the user must supply).

## 8. Per-workspace outputs (all GET unless noted; 404 until the step has produced data)

- `GET /workspaces/:id/cover-letter` → `CoverLetter`. `POST /workspaces/:id/cover-letter/regenerate` body `{tone?, length?}` → `CoverLetter` (cost `coverLetterRegenCost`, default 2).
- `GET /workspaces/:id/interview-questions` → `InterviewQuestion[]`. `POST /interview-questions/:id/answer` body `{answer}` (max 5000) → `InterviewQuestion` with `aiFeedback`, `answerScore` (cost `interviewFeedbackCost`, default 1 credit per try).
- `GET /workspaces/:id/company-insight` → `CompanyInsight` (raw entity). `GET /workspaces/:id/salary-estimate` → `SalaryEstimate` (always an estimate: `isEstimate:true`). `GET /workspaces/:id/learning-roadmap` → `LearningRoadmap` (≤6 items, `affiliateUrl` may be set).
- **Documents** (`documents/documents.controller.ts`): `POST /workspaces/:id/documents` body `{type: DocType}` → `GeneratedDocument` (status `queued`; poll `GET …/documents/:docId` until `ready|failed|stale`; `stale` must be re-requested). `GET …/documents` → list. `GET …/documents/:docId/download` → `{url, filename}` (presigned, ~15 min; 409 DOCUMENT_NOT_READY).

## 9. Credits, dashboard, notifications, referrals

- `GET /credits` → `{balance}`. `GET /credits/history?cursor&limit` → `Page<CreditLedgerEntry>` (`amount` signed).
- `GET /dashboard` → `DashboardOverview` (cached in Redis server-side; one call powers the home screen).
- `GET /notifications?cursor&limit` → `Page<AppNotification>`. `GET /notifications/unread-count` → `{count}`. `PATCH /notifications/:id/read` and `PATCH /notifications/read-all` → `{marked:true}`. `GET /notifications/preferences` → `{emailDisabled:string[]}`; `PUT` same shape. (Preferences are **email-only**.) Known types: `run.completed`, `run.failed`, `gdpr.export_ready`; `data` carries references (shape not typed server-side).
- `GET /referrals/me` → `ReferralInfo` (share URL = `${APP_URL}/register?ref=CODE`, a **web** URL).

## 10. Billing (Stripe) (`payments/*`)

- `GET /plans` (**public**) → `Plan[]`. `GET /credit-packs` (**public**) → `CreditPack[]`.
- `GET /payments/subscription` → `Subscription` (free plan when no row: `planKey:"free"`, limits 3/3, status `active`).
- `POST /payments/checkout` body `{planKey, interval?: 'month'|'year'}` + header `Idempotency-Key` → `{url}` (Stripe Checkout; `success_url=APP_URL/billing?checkout=success`, `cancel_url=…?checkout=canceled`). 409 ALREADY_SUBSCRIBED (use switch), 404 PLAN_NOT_PURCHASABLE, 403 FEATURE_DISABLED.
- `POST /credit-packs/:id/checkout` + `Idempotency-Key` → `{url}` (`success_url=APP_URL/billing?purchase=success`).
- `POST /payments/portal` → `{url}` (Stripe customer portal, `return_url=APP_URL/billing`).
- `POST /payments/subscription/cancel | resume | switch(body {planKey,interval?}) | clear-pending-change` → all **200** → `Subscription`. Errors NO_ACTIVE_SUBSCRIPTION, NO_SUBSCRIPTION_TO_RESUME, SUBSCRIPTION_UPDATE_FAILED(502).
- `POST /payments/webhook` — Stripe only (signature), not for clients.
- Success/cancel/return URLs are hard-wired to `APP_URL` (web). A mobile client cannot receive them — see 06.

## 11. Admin (out of scope for mobile; 28 endpoints, all `AdminGuard`)
`/admin/users` (GET, POST `:id/suspend|activate`), `/admin/plans` (GET/POST/PATCH/DELETE), `/admin/credit-packs` (same), `/admin/affiliate-links` (same), `/admin/payment-config` (GET/PATCH), `/admin/integrations` (GET, GET `:provider/daily`), `/admin/referrals` (GET, GET `stats`), `/admin/runs/:id`, `/admin/queues/:name/dead-letter` (GET, POST `:jobId/retry`), `/admin/costs`, `/admin/prompts/:key/versions` (GET), `/admin/prompts/:key/activate` (POST), `/admin/audit`. DTO shapes not documented here by design.

## 12. Endpoint tally
Client-facing: **85 endpoints** (incl. SSE stream, 2 health, 1 Stripe webhook) + **28 admin** = **113** controller routes.

## 13. Environment variables relevant to a client
Client needs only: `VITE_API_BASE_URL` (e.g. `https://<host>/api/v1`). Server-side values that shape client behaviour (never copy values): `APP_URL`, `CORS_ORIGINS`, `COOKIE_CROSS_SITE`, `JWT_ACCESS_TTL`, `REFRESH_TTL_DAYS`, `OTP_*`, `MAX_FILE_SIZE_MB`, `MAX_RESUME_PAGES`, `SIGNED_URL_TTL_SEC`, `SIGNUP_CREDIT_GRANT`. The web app uses `NEXT_PUBLIC_API_URL` (relative `/api/v1` through a Next proxy so cookies are first-party), `BACKEND_API_ORIGIN` (server-only), `NEXT_PUBLIC_SITE_URL`. The backend currently runs behind an **ngrok** free tunnel in dev; the web proxy adds `ngrok-skip-browser-warning: true` (`talentpilot-fe/proxy.ts`).

## 14. Open questions (API)
- **A1** `openapi.json` not exported (needs running DB/Redis). Run the API locally and `curl http://localhost:3000/api/docs-json` to produce it; I did not do so since it needs infra and would be a fabricated artefact otherwise.
- **A2** Signup credit: `.env.example` `SIGNUP_CREDIT_GRANT=100` vs `PaymentConfig.signup_credit_grant` default 25 — which one is authoritative at runtime?
- **A3** JD upload size/page limits (Multer config in `job-descriptions.module.ts`) not read; assumed same as resume (10 MB).
- **A4** Notification `data` payload shapes (`run.completed` etc.) not inspected in detail; web only uses it for navigation.
- **A5** `GET /users/me` — not called by web on boot (session user comes from login/refresh). Safe to use for refreshing profile of `isVerified`.
- **A6** `JD status` list per upload path unobserved in web comments (`pending`/`analyzing`); treat both as in-progress.
- **A7** `step.completed.payload` shape is untyped (`unknown`).
