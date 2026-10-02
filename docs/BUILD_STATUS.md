# TalentPilot mobile — build status

- [x] Phase 1 — Shell, auth, session refresh (tested against the real API by the user)
- [x] Phase 2 — Home, Notifications, Me hub, Profile, Billing (read-only), Security, Account
- [x] Phase 3 — Resumes list (upload with progress, rename, delete/RESUME_IN_USE, retry), Resume detail (polling, sections, summary edit)
- [x] Phase 4 — Jobs list, Add job (paste/clipboard, upload), Job detail (polling, missing-fields sheet, delete)
- [x] Phase 5 — Analyses list + filters, New analysis sheet (match gauge), Analysis detail state machine, SSE progress with ticket reconnects + polling fallback + resume reconnect, failed/partial view with retry
- [x] Phase 6 — Results: Report (ring, breakdown, keywords, rescore polling), Suggestions (select/apply/reject, needs_info)
- [x] Phase 7 — Cover letter (tone/length regen, copy/share), Interview (feedback, ideal answer), Company, Salary, Learning
- [x] Phase 8 — Capacitor config + plugins, `src/lib/native.ts`, Android back button, offline banner + "Requires connection", persisted query cache, `docs/ANDROID_BUILD.md`

## Not tested end-to-end
Phases 2–8 compile and every screen loads, but none were exercised with a signed-in account (no test credentials available to the builder). Native-only behaviour (back button, secure storage, status bar, share, clipboard) needs a device build.

## API questions / mismatches
- `GET /dashboard` `actionItems` have no workspace id — the app parses it from `href` (`/workspaces/<id>`) and otherwise opens the filtered Analyses list.
- `GET /auth/sessions` doesn't flag the current session — the app assumes the newest one is "This device".
- `POST /resumes/:r/match/:j` — `semanticScore` scale (0–1 vs 0–100) is unspecified; gauge uses required-skill coverage when available.
- Rescore completion is detected by a new report `id`; confirm that a rescore creates a new report row.
