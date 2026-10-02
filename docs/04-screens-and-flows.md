# TalentPilot Screens & Flows (from `talentpilot-fe`, Next.js 16 App Router)

Paths relative to `talentpilot-fe/`. API paths relative to `/api/v1`. Types in `02-types.ts`.

## 1. Tech & data-fetching approach (as built)
- Next.js 16 App Router, React 19, Tailwind v4, Radix primitives, Heroicons, framer-motion, recharts (dashboard score-trend + admin charts).
- **Server state**: TanStack Query v5 (`lib/query.ts`): `staleTime 30s`, no refetch on window focus, **never retry 4xx**, retry network/5xx ≤2×, **mutations never auto-retried** (could double-charge credits). Polling via `hooks/use-poll-until.ts` (2 s default).
- **Client state**: Zustand — `stores/auth.store.ts` (`user`, `accessToken` **in memory only**, `status: loading|authed|anon`), `stores/ui.store.ts` (sidebar collapsed, upgrade modal open + `details`), toast store.
- **HTTP**: axios (`lib/api/client.ts`): `withCredentials`, request interceptor adds Bearer, response interceptor: `TOKEN_EXPIRED` → single shared `POST /auth/refresh` then replay; `TOKEN_SUPERSEDED` → replay once; `TOKEN_INVALID|TOKEN_REUSE_DETECTED` with a Bearer present → clear + go to `/login`; everything normalized to `ApiError(code,message,status,details,fields,requestId)`. Wrapper unwraps `data`; `api.list` also returns `nextCursor/hasMore`; `postIdempotent` sets `Idempotency-Key`. Error→UI mapping table: `lib/error-actions.ts` (INSUFFICIENT_CREDITS/PLAN_LIMIT_REACHED → upgrade modal; VALIDATION_FAILED → inline field errors; RATE_LIMITED → warning toast; EMAIL_NOT_VERIFIED → `/verify-email`).
- **Forms**: react-hook-form + zod (`@hookform/resolvers`).
- **Auth bootstrap** (`providers/auth-bootstrap.tsx`): on every page load calls `POST /auth/refresh` (cookie) to get a session; `RequireAuth` shows a splash while `loading`, redirects `anon → /login`, unverified → `/verify-email`.
- **Pagination**: lists load only the first page (`api.list` with default limit 20) — no infinite scroll implemented on web.
- Every `app/(app)/*/layout.tsx` besides the root one is a thin metadata wrapper.

## 2. Route list (18 app/auth routes + 13 admin + 5 marketing + 1 internal kit)

| Route | File | Purpose |
|---|---|---|
| `/` , `/pricing`, `/ai-cover-letter`, `/ats-resume-checker`, `/resume-optimizer` | `app/(marketing)/**` | Public marketing/SEO (**not for mobile**) |
| `/login` | `app/(auth)/login/page.tsx` | Sign in |
| `/register` | `app/(auth)/register/page.tsx` | Create account (`?ref=CODE`) |
| `/verify-email` | `app/(auth)/verify-email/page.tsx` | 6-digit OTP |
| `/forgot-password` | `app/(auth)/forgot-password/page.tsx` | Request reset email |
| `/reset-password?token=` | `app/(auth)/reset-password/page.tsx` | Set new password (web link from email) |
| `/onboarding` | `app/onboarding/page.tsx` | Pre-signup wizard: upload → register → verify → upload + redirect |
| `/getting-started` | `app/(app)/getting-started/page.tsx` | First resume upload fallback |
| `/dashboard` | `app/(app)/dashboard/page.tsx` | Overview |
| `/resumes`, `/resumes/[id]` | `app/(app)/resumes/**` | List/upload; detail (sections, versions) |
| `/jobs`, `/jobs/new`, `/jobs/[id]` | `app/(app)/jobs/**` | JD list, add (paste/upload), detail |
| `/workspaces`, `/workspaces/[id]` | `app/(app)/workspaces/**` | Analyses list; run progress or results tabs (`?run=<id>`, `?filter=<status>`) |
| `/billing` | `app/(app)/billing/page.tsx` | Plan, plans, credit packs, history (`?checkout=success`, `?purchase=success`) |
| `/invite` | `app/(app)/invite/page.tsx` | Referral code/stats |
| `/settings` | `app/(app)/settings/page.tsx` | Tabs: Profile, Security, Notifications, Account |
| `/kit` | `app/kit/page.tsx` | Internal component kit (ignore) |
| `/admin/**` (13 pages: overview, users, plans, credit-packs, affiliate-links, payment-config, integrations, costs, prompts, queues, audit, referrals, runs/[id]) | `app/(admin)/**` | Admin-only; **exclude from mobile** |

**Roles**: `user` and `admin`. `admin` sees extra `/admin/*` (guarded client-side by `features/admin/components/admin-guard.tsx` and server-side by `AdminGuard`). All user-facing screens are identical for both roles. Main nav (`components/layout/nav-items.ts`): Dashboard, Resumes, Jobs, Workspaces, Billing, Invite & earn, Settings.

## 3. Shell
- Desktop: sidebar (240px, collapsible to 64px) + sticky 56px topbar (menu toggle, spacer, **credit pill** → `/billing` (`GET /credits`), **notification bell** popover, avatar menu with logout) + content `max-w-6xl`.
- <1024px: hamburger → left drawer (256px) with the same nav.
- Global **Upgrade modal** (`components/billing/upgrade-modal.tsx`): "Upgrade to continue", shows `required/balance` or `limit/current` from the error `details`, CTA "View plans" → `/billing`.
- Notification bell (`components/layout/notification-bell.tsx`): badge from `GET /notifications/unread-count` (polled every 10 min), list from `GET /notifications`, tap marks `PATCH /notifications/:id/read`, "mark all" `PATCH /notifications/read-all`, empty "You're all caught up".

## 4. Screens

### Auth group
**Login** (`GET` none; `POST /auth/login`). Layout: centered `max-w-sm` card, logo, title "Welcome back". Fields: email (zod email), password (required). Banners: `?reset=1` → "Password reset. Sign in with your new password."; `?accountDeleted=1` → deletion notice. Errors: `EMAIL_NOT_VERIFIED` → `/verify-email?email=`; `RATE_LIMITED` → toast "Slow down — retry in Ns"; `ACCOUNT_SUSPENDED` → "This account has been suspended."; anything else → ONE generic "Email or password is incorrect" (never distinguish). Links: Forgot password, Create one.
**Register** (`POST /auth/register`). Fields: email, password (hint "8+ characters, a letter and a number"; zod mirrors server). `referralCode` from `?ref=` sent silently. Errors: `ALREADY_EXISTS` → inline on email "An account with this email already exists"; `VALIDATION_FAILED.fields` → per-field; else root error. Success → `/verify-email?email=`.
**Verify email** (`POST /auth/verify-email`, `POST /auth/resend-otp`). 6-box OTP input auto-submits on 6th digit. Email source: `?email=` or session user. Errors: `OTP_INVALID` ("Incorrect code — N attempts left" from `details.remaining`), `OTP_EXPIRED`, `OTP_MAX_ATTEMPTS`; resend button with cooldown (60s; `OTP_COOLDOWN.details.retryAfterSec`). Success sets session → `/dashboard`.
**Forgot password** (`POST /auth/forgot-password`): email → always show "Check your email… If an account exists" (204 for everything). **Reset password** (`POST /auth/reset-password`): token from query; missing token → "Invalid link"; new password (8+, letter, number); `RESET_TOKEN_INVALID` → inline "invalid or expired"; success → `/login?reset=1`.
**Onboarding wizard** (`/onboarding`): 3 dots (upload → register → verify). Pick a resume file first (PDF/DOCX ≤10MB), then register, OTP, then the stored file is uploaded with `POST /resumes/upload` and user goes to `/dashboard` (on upload failure → `/getting-started`). **Mobile v1: drop** (upload-before-signup is a web-funnel trick).

### Dashboard (`/dashboard`) — `GET /dashboard`
Header "Dashboard" + plan badge (`plan.name`). Skeleton: 4 cards + 2 panels. **Empty** (`resumes.count === 0`): `FirstRunEmptyState` (upload CTA). Else: (1) **Action items** list (`actionItems`: failed_run, pending_suggestions, low_credits, incomplete_profile; each has `label`, `href`, `priority`); (2) 4 metric cards: Credits (balance, spent/granted 30d, `runsRemaining`), Score trend (sparkline of `scoreInsight.trend`, latest/avg/best), Activity (14-day `activity` runs-per-day visual), Workspaces (total/completed/processing/failed + resumes count/limit); (3) Recent workspaces (`workspaces.recent`, tap → workspace) and Top skill gaps (`topGaps` keyword + missCount).
`href` values are **web routes** (e.g. `/workspaces?filter=failed`, `/settings`, `/billing`) → map to mobile routes.

### Resumes (`/resumes`) — `GET /resumes`
Title + Upload dropzone (`POST /resumes/upload`, field `file`) + grid of ResumeCards (2-col ≥640). Card: title, status badge, pages/words, date; actions menu (Rename `PATCH /resumes/:id`, Delete `DELETE /resumes/:id`, Retry button when `failed` → `POST /resumes/:id/retry`). Delete of an in-use resume returns `RESUME_IN_USE` → modal listing workspaces. Upload errors: `PLAN_LIMIT_REACHED` → upgrade modal; `FILE_TOO_LARGE` (`maxMb`); `FILE_TYPE_UNSUPPORTED` "Upload a PDF or DOCX file."; `FILE_UNREADABLE` "scanned or image-only PDF…"; `FILE_CORRUPT`. Client-side pre-check: mime pdf/docx, ≤10MB. Empty: "No resumes yet". Loading: 4 skeleton cards.
### Resume detail (`/resumes/[id]`) — `GET /resumes/:id` (polled 2s while not `parsed`)
Non-`parsed`: header + **ParseProgress** (status steps; `failed` shows `parseError` + Retry; `stuck` after 30 s in `uploaded|extracting` shows "taking longer than usual" + retry). `parsed`: header + tabs **Sections** (`GET /resumes/:id/sections`; collapsible SectionCards per type ordered by `orderIndex`, Edit for summary → `PATCH /resumes/:id/sections/summary` `{content:{text}}`) and **Version History** (`GET /resumes/:id/versions`; rows with label/changeSummary/createdBy/suggestionsApplied; compare `GET …/versions/diff?from&to` rendered as word-diff; restore with confirm → `POST …/versions/:version/restore`).

### Jobs
**List** (`GET /job-descriptions`): "Add job description" button; JobCards (company, position via `displayPosition()` = "Untitled role" when sentinel, status badge, location/remote); empty "No job descriptions yet" + action.
**New** (`/jobs/new`): tabs *Paste text* (textarea `text` ≤50k, optional position & company → `POST /job-descriptions/paste`) and *Upload file* (`POST /job-descriptions/upload`, field `file`). Error JD_TOO_SHORT.
**Detail** (`GET /job-descriptions/:id`, polled while `analyzing`): analyzing → spinner card; `failed` → JobFailedCard (`parseError` + Retry `POST …/:id/retry`); `analyzed` → header + MissingFieldsBanner (company/position → inline edit `PATCH /job-descriptions/:id`), Requirements card, Skills card (importance badges), Responsibilities, Keywords chips; Delete (`DELETE`).

### Workspaces
**List** (`GET /workspaces`, optional `?filter=<status>` client-side): "New analysis" button → **CreateWorkspaceDialog**: ResumePicker (only usable/parsed resumes), JobPicker (analyzed JDs), live **MatchPreview** (`POST /resumes/:r/match/:j` once both chosen), cost caption "Analyzing will cost 21 credits — you have N (~M analyses)", low-balance warning + link to billing, button "Create workspace" → `POST /workspaces` (name auto = `"<company> — <position>"`) → navigate to workspace. Cards: name, StatusBadge, `overallScore`. Empty variants (with/without filter).
**Detail** (`/workspaces/[id]`, `GET /workspaces/:id`, `?run=`): state machine:
1. no run yet → "Ready to analyze" card + **AnalyzeButton** "Analyze — 21 credits": pre-checks credits (<21 → upgrade modal), runs `POST /resumes/:r/match/:j`; if `coverage.requiredTotal>0` and band "low" → modal "Low keyword match… analyze anyway?"; then `POST /workspaces/:id/analyze` with fresh UUID `Idempotency-Key`. `ANALYSIS_ALREADY_RUNNING` → go to `?run=<details.runId>`.
2. run active → **PipelineTimeline** (12 labelled steps in fixed order, progress bar) fed by SSE (`POST …/runs/:id/stream-ticket` + `EventSource`) with polling fallback (`GET …/runs/:id` every 3s). Step labels: parse_resume "Reading your resume", parse_jd "Reading the job description", generate_embeddings "Analyzing semantics", match_keywords "Matching your experience against the requirements", score_ats "Scoring against ATS criteria", optimize_resume "Writing improvement suggestions", generate_cover_letter "Drafting your cover letter", build_learning_path "Building your learning roadmap", generate_interview_qs "Preparing interview questions", research_company "Researching the company", estimate_salary "Estimating salary range", finalize "Finishing up". `step.failed` only marks failed when `willRetry=false`.
3. `failed|partial` → timeline + **RunFailed** (unprompted "We refunded N credits…" if `creditsRefunded>0`; "Retry at no extra cost" → `POST …/runs/:id/retry`, re-runs only failed steps).
4. `completed` → "Analysis complete" check, auto-redirect after 1.2s to the results view.
5. results (when `lastRunId` set and no active run) → **WorkspaceView** tabs (each lazily fetches on first open):
   - **ATS Report** `GET /workspaces/:id/report`: ScoreCard (ring, MatchBandBadge, "You meet X of Y required skills", delta vs `original`, "Recalculate score" → `POST …/rescore` 5 credits, disabled when the latest resume version <= `report.resumeVersion` (uses `GET /resumes/:id/versions`); polls until a new report appears, "stuck" after 45s), ScoreBreakdown (per-component bars, before/after), KeywordTable (keyword, importance badge, status matched/partial/missing, evidence, suggestion), InsightsCard (strengths/weaknesses/recommendations). `REPORT_NOT_READY` → "No report yet".
   - **Suggestions** `GET …/suggestions` (pending): shield note "Every suggestion is checked against your original resume…"; select all / per-card checkbox; **Apply N** → `POST …/suggestions/apply`; cards show impact badge, section, struck-through Current vs green Suggested, Why, `+keyword` chips; `needs_info` cards (NeedsInfoCard) ask for the missing fact (`missingFact`, `exampleValue`) → `POST …/suggestions/:id/provide-detail` (or `needsDirectEdit` → edit the resume directly). Reject → `POST …/suggestions/reject`. Empty "No pending suggestions".
   - **Cover Letter** `GET …/cover-letter`: tone chips (4) + length chips (3), "Regenerate — 2 credits" (`POST …/regenerate`, enabled only when changed or last attempt errored), letter text `whitespace-pre-wrap`, version + word count, Copy button; plus **DownloadMenu** (documents).
   - **Interview** `GET …/interview-questions`: expandable QuestionCards (type/difficulty/framework chips, "Based on your resume" quote, "What the interviewer is testing", answer textarea ≥20 chars → "Get feedback — 1 credit" `POST /interview-questions/:id/answer`, ScoreMeter + AI feedback, "Show model answer").
   - **Company** `GET …/company-insight` (overview, culture bullets, talking points, sources, confidence). **Salary** `GET …/salary-estimate` (p25/p50/p75 range bar, "estimate" disclaimer, methodology, factors, negotiation tips). **Learning** `GET …/learning-roadmap` (items: title, gapReason, resourceType, hours, priority, link/affiliate link). 404 on any of these → empty/"not available" state (steps are optional and can be skipped).
   - **Documents / download menu** (`features/documents/components/download-menu.tsx`): request `POST …/documents {type}`, poll `GET …/documents/:docId` until ready, then `GET …/download` → `{url}` opened. `stale` → re-request.

### Billing (`/billing`)
Header; confirming banners after Stripe redirect (`?checkout=success` polls `GET /payments/subscription` every 2s until `currentPeriodEnd`, 40s timeout; `?purchase=success` polls `GET /credits` until balance exceeds the pre-purchase balance stored in `sessionStorage`). **CurrentPlanCard**: plan name/status, stats (monthly credits, resumes, workspaces), renewal/cancel info, "Manage billing" (`POST /payments/portal` → redirect), "Cancel subscription" (confirm modal → `POST /payments/subscription/cancel`), "Resume subscription" (`…/resume`), pending-change chip + clear (`…/clear-pending-change`). **PlanCards** (`GET /plans`, month/year toggle): "Upgrade to X" → `POST /payments/checkout` (Idempotency-Key) → `window.location = url` (Stripe); with an active sub → "Switch to X" → `POST /payments/subscription/switch`. **CreditPacks** (`GET /credit-packs`): buy → `POST /credit-packs/:id/checkout` → redirect. **CreditHistory** (`GET /credits/history`, paged): rows with reason label, ±amount, date.

### Invite (`/invite`) — `GET /referrals/me`
Disabled (`enabled=false`) → "Invites aren't available right now". Else: code + share URL with copy, share links (email/social), stats Invited / Joined / Credits earned; caption "You'll earn credits once someone you invite runs their first analysis." (reward `rewardPerReferral`).

### Settings (`/settings`) — 4 tabs
- **Profile** `GET/PUT /profiles/me`: First name, Last name, Target role, Years of experience (number 0–60), Phone, LinkedIn (host linkedin.com), GitHub (host github.com), Portfolio (URL), City, Country, Timezone (IANA text), Salary expectation + Currency (ISO-4217, 3 letters). Server field errors via `applyFieldErrors`. Shows profile completeness.
- **Security** `GET /auth/sessions` list devices (UA parsed to "Chrome on Windows"), revoke → `DELETE /auth/sessions/:familyId`; empty "No other sessions".
- **Notifications** `GET/PUT /notifications/preferences`: toggle per type (email only): Analysis complete, Analysis failed, Data export ready.
- **Account**: Export my data (`POST /gdpr/export`, 202 "we'll notify you"), Delete account (confirm dialog → `DELETE /users/me` → `/login?accountDeleted=1`).

## 5. User flows
1. **New user**: Register → OTP verify (auto-login) → Dashboard first-run empty state → upload resume (poll parse) → add job (paste/upload) → create workspace → analyze (21 credits, SSE progress) → review report → apply suggestions → recalc score (5) → cover letter / interview prep / export docs.
2. **Returning**: app load → silent `POST /auth/refresh` → Dashboard.
3. **Low credits**: any 402 → Upgrade modal → Billing (Stripe Checkout in browser) → redirect back → polling confirms.
4. **Failure recovery**: run `partial/failed` → refund notice → Retry at no cost.
5. **Admin**: separate `/admin/*` area — not relevant to mobile.

## 6. Open questions (screens)
- **S1** `features/jobs/components/job-card.tsx`, `workspace-card.tsx`, `resume-card.tsx`, `section-card.tsx`, `salary-range.tsx`, `learning-card.tsx`, `company-tab.tsx` were skimmed via types/API only, not read line-by-line; exact card typography may differ slightly.
- **S2** Web never loads page 2 of any list — on mobile decide infinite scroll vs "load more" (API supports it).
- **S3** Section editing on web is summary-only; other sections are read-only. Is full editing needed on mobile? (Default: no.)
- **S4** The referral share links composition (`features/referrals/components/invite-page.tsx` line ~46) not fully inspected (email/social targets).
