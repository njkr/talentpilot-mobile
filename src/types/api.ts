/**
 * TalentPilot API types — paste into Lovable as `src/types/api.ts`.
 * Derived from talentpilot-api (NestJS) DTOs/entities/services. Dates are ISO-8601 strings on the wire.
 * Admin endpoints (/admin/*) are intentionally NOT typed: out of scope for mobile v1.
 * See 01-api-contract.md for endpoint-by-endpoint detail and source file paths.
 */

// ───────────────────────── Envelope (src/common/exceptions/app.exception.ts, raw-response.decorator.ts)

export interface ApiMeta {
  requestId: string;
  timestamp: string;
  /** list endpoints only */
  nextCursor?: string | null;
  hasMore?: boolean;
  total?: number;
}
export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta: ApiMeta;
}
export interface ApiErrorBody {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  /** VALIDATION_FAILED only: field name -> messages */
  fields?: Record<string, string[]>;
}
export interface ApiFailure {
  success: false;
  error: ApiErrorBody;
  meta: ApiMeta;
}
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

/** Paged result after unwrapping the envelope. */
export interface Page<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}
export interface CursorQuery {
  cursor?: string;
  /** 1..100, default 20 */ limit?: number;
}

export type ErrorCode =
  | "INVALID_CREDENTIALS"
  | "TOKEN_EXPIRED"
  | "TOKEN_INVALID"
  | "TOKEN_SUPERSEDED"
  | "TOKEN_REUSE_DETECTED"
  | "EMAIL_NOT_VERIFIED"
  | "ACCOUNT_SUSPENDED"
  | "OTP_INVALID"
  | "OTP_EXPIRED"
  | "OTP_MAX_ATTEMPTS"
  | "OTP_COOLDOWN"
  | "RESET_TOKEN_INVALID"
  | "VALIDATION_FAILED"
  | "NOT_FOUND"
  | "ALREADY_EXISTS"
  | "FILE_TOO_LARGE"
  | "FILE_TYPE_UNSUPPORTED"
  | "FILE_TOO_MANY_PAGES"
  | "FILE_UNREADABLE"
  | "FILE_CORRUPT"
  | "RESUME_NOT_PARSED"
  | "RESUME_IN_USE"
  | "INSUFFICIENT_CREDITS"
  | "PLAN_LIMIT_REACHED"
  | "PAYMENT_FAILED"
  | "ANALYSIS_ALREADY_RUNNING"
  | "IDEMPOTENCY_KEY_REQUIRED"
  | "RUN_NOT_RETRYABLE"
  | "REPORT_NOT_READY"
  | "STREAM_TICKET_INVALID"
  | "AI_PROVIDER_UNAVAILABLE"
  | "AI_BUDGET_EXCEEDED"
  | "AI_OUTPUT_INVALID"
  | "AI_CONTEXT_TOO_LONG"
  | "AI_CONTENT_FILTERED"
  | "JD_TOO_SHORT"
  | "JD_NOT_ANALYZED"
  | "DOCUMENT_NOT_READY"
  | "WEBHOOK_SIGNATURE_INVALID"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR"
  | "FEATURE_DISABLED"
  | "NO_ACTIVE_SUBSCRIPTION"
  | "NO_SUBSCRIPTION_TO_RESUME"
  | "PLAN_NOT_PURCHASABLE"
  | "ALREADY_SUBSCRIBED"
  | "SUBSCRIPTION_UPDATE_FAILED"
  | "SELF_ACTION_FORBIDDEN"
  | "NO_CHANGES_TO_RESCORE";

/** HTTP status per error code (app.exception.ts STATUS map). Unlisted codes default to 400. */
export const ERROR_STATUS: Partial<Record<ErrorCode, number>> = {
  INVALID_CREDENTIALS: 401,
  TOKEN_EXPIRED: 401,
  TOKEN_INVALID: 401,
  TOKEN_SUPERSEDED: 401,
  TOKEN_REUSE_DETECTED: 401,
  OTP_INVALID: 400,
  OTP_EXPIRED: 400,
  OTP_MAX_ATTEMPTS: 429,
  OTP_COOLDOWN: 429,
  RESET_TOKEN_INVALID: 400,
  EMAIL_NOT_VERIFIED: 403,
  ACCOUNT_SUSPENDED: 403,
  PLAN_LIMIT_REACHED: 403,
  VALIDATION_FAILED: 400,
  NOT_FOUND: 404,
  ALREADY_EXISTS: 409,
  FILE_TOO_LARGE: 413,
  FILE_TYPE_UNSUPPORTED: 422,
  FILE_TOO_MANY_PAGES: 422,
  FILE_UNREADABLE: 422,
  FILE_CORRUPT: 422,
  RESUME_NOT_PARSED: 409,
  RESUME_IN_USE: 409,
  INSUFFICIENT_CREDITS: 402,
  PAYMENT_FAILED: 402,
  ANALYSIS_ALREADY_RUNNING: 409,
  IDEMPOTENCY_KEY_REQUIRED: 400,
  RUN_NOT_RETRYABLE: 409,
  REPORT_NOT_READY: 409,
  STREAM_TICKET_INVALID: 401,
  AI_PROVIDER_UNAVAILABLE: 503,
  AI_BUDGET_EXCEEDED: 429,
  AI_OUTPUT_INVALID: 502,
  AI_CONTEXT_TOO_LONG: 422,
  AI_CONTENT_FILTERED: 422,
  JD_TOO_SHORT: 422,
  JD_NOT_ANALYZED: 409,
  DOCUMENT_NOT_READY: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  FEATURE_DISABLED: 403,
  NO_ACTIVE_SUBSCRIPTION: 404,
  NO_SUBSCRIPTION_TO_RESUME: 404,
  PLAN_NOT_PURCHASABLE: 404,
  ALREADY_SUBSCRIBED: 409,
  SUBSCRIPTION_UPDATE_FAILED: 502,
  SELF_ACTION_FORBIDDEN: 400,
  NO_CHANGES_TO_RESCORE: 409,
};

// ───────────────────────── Auth

export interface User {
  id: string;
  email: string;
  isVerified: boolean;
  role: "user" | "admin";
  createdAt: string;
}
export interface SessionResponse {
  accessToken: string;
  user: User;
}

export interface RegisterRequest {
  /** IsEmail, max 255; lowercased server-side */
  email: string;
  /** 8..72 chars, >=1 letter and >=1 digit */
  password: string;
  /** max 20; invalid codes silently ignored */
  referralCode?: string;
}
export interface LoginRequest {
  email: string;
  /** non-empty, no length rule */ password: string;
}
export interface VerifyOtpRequest {
  email: string;
  /** exactly 6 digits */ code: string;
}
export interface EmailRequest {
  email: string;
}
export interface ResetPasswordRequest {
  /** opaque token from email link */ token: string;
  /** 8..72 (server does NOT enforce letter/digit here) */ password: string;
}
export interface SessionInfo {
  familyId: string;
  createdAt: string;
  ip: string | null;
  userAgent: string | null;
  isCurrent: boolean;
}

// ───────────────────────── Profile

export interface Profile {
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  linkedin: string | null;
  github: string | null;
  portfolio: string | null;
  country: string | null;
  city: string | null;
  timezone: string | null;
  yearsExperience: number | null;
  targetRole: string | null;
  salaryExpectation: number | null;
  salaryCurrency: string | null;
  /** 0..100: % of 7 fields filled (firstName,lastName,city,country,yearsExperience,targetRole,linkedin) */
  completeness: number;
}
export interface UpdateProfileRequest {
  /** each optional; strings max 100 unless noted */
  firstName?: string;
  lastName?: string;
  /** max 30 */ phone?: string;
  /** IsUrl, host must end linkedin.com */ linkedin?: string;
  /** IsUrl, host must end github.com */ github?: string;
  /** IsUrl */ portfolio?: string;
  country?: string;
  city?: string;
  /** max 64 */ timezone?: string;
  /** int 0..60 */ yearsExperience?: number;
  /** max 150 */ targetRole?: string;
  /** int >= 0 */ salaryExpectation?: number;
  /** ISO-4217, e.g. "USD" */ salaryCurrency?: string;
}

// ───────────────────────── Resumes

export type ResumeStatus =
  "uploaded" | "extracting" | "extracted" | "parsing" | "parsed" | "failed";
export interface Resume {
  id: string;
  title: string;
  status: ResumeStatus;
  pageCount: number | null;
  wordCount: number | null;
  /** bytes */ fileSize: number;
  /** 2-letter */ language: string | null;
  parseError: string | null;
  createdAt: string;
}
export interface RenameResumeRequest {
  /** non-empty, max 200 */ title: string;
}

export type SectionType =
  | "personal_info"
  | "summary"
  | "skills"
  | "experience"
  | "projects"
  | "education"
  | "certifications"
  | "languages";
export interface PersonalInfoContent {
  fullName: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  links: { label: string; url: string }[];
}
export interface SummaryContent {
  text: string | null;
}
export type SkillsContent = string[];
export interface ExperienceItem {
  company: string | null;
  title: string | null;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
  highlights: string[];
}
export interface ProjectItem {
  name: string | null;
  description: string | null;
  url: string | null;
  technologies: string[];
}
export interface EducationItem {
  institution: string | null;
  degree: string | null;
  field: string | null;
  startDate: string | null;
  endDate: string | null;
}
export interface CertificationItem {
  name: string | null;
  issuer: string | null;
  date: string | null;
}
export interface LanguageItem {
  name: string | null;
  proficiency: string | null;
}
export interface SectionContentMap {
  personal_info: PersonalInfoContent;
  summary: SummaryContent;
  skills: SkillsContent;
  experience: ExperienceItem[];
  projects: ProjectItem[];
  education: EducationItem[];
  certifications: CertificationItem[];
  languages: LanguageItem[];
}
export interface ResumeSection<T extends SectionType = SectionType> {
  sectionType: T;
  content: SectionContentMap[T];
  orderIndex: number;
  /** 0..1 or null */ confidence: number | null;
  aiGenerated: boolean;
  editedByUser: boolean;
  updatedAt: string;
}
/** PATCH /resumes/:id/sections/:sectionType — content is validated server-side against the shape for that type (strict: no extra keys). */
export interface UpdateSectionRequest<T extends SectionType = SectionType> {
  content: SectionContentMap[T];
}

export interface ResumeVersion {
  id: string;
  version: number;
  label: string;
  changeSummary: string;
  createdBy: "user" | "ai" | "restore";
  suggestionsApplied: number;
  createdAt: string;
}
export interface DiffPart {
  value: string;
  added?: boolean;
  removed?: boolean;
  count?: number;
}
export interface VersionDiffSection {
  sectionType: SectionType;
  changed: true;
  changes: DiffPart[];
}
export interface RestoreVersionResponse {
  version: number;
}

// ───────────────────────── Job descriptions

export type JobStatus = "pending" | "analyzing" | "analyzed" | "failed";
export type JobSource = "paste" | "upload" | "url";
export type Importance = "required" | "preferred" | "nice_to_have";
export interface JobParsedData {
  position: string;
  company: string | null;
  seniority: string | null;
  remoteType: string | null;
  employmentType: string | null;
  location: string | null;
  experienceRequired: string | null;
  requirements: { text: string; category: string; importance: Importance }[];
  skills: { name: string; category: string; importance: Importance }[];
  keywords: string[];
  responsibilities: string[];
  salary: { min: number | null; max: number | null; currency: string | null };
}
export interface JobDescription {
  id: string;
  company: string | null;
  /** "Untitled position" sentinel when unresolved — never null */ position: string;
  source: JobSource;
  employmentType: string | null;
  location: string | null;
  remoteType: string | null;
  experienceRequired: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  parsedData: JobParsedData | null;
  status: JobStatus;
  parseError: string | null;
  missingFields: ("company" | "position")[];
  createdAt: string;
}
export interface PasteJdRequest {
  /** non-empty, max 50000 */ text: string;
  /** max 200 */ position?: string;
  /** max 200 */ company?: string;
}
export interface UpdateJdRequest {
  /** 1..200 */ position?: string;
  /** 1..200 */ company?: string;
}

// ───────────────────────── Matching (pre-check, not credit-gated)

export interface MatchKeyword {
  keyword: string;
  canonical: string;
  category: string;
  importance: Importance;
  status: "matched" | "partial" | "missing";
  foundIn: string[];
  evidence?: string | null;
  source: "exact" | "ai";
  suggestion?: string | null;
}
export interface ScoredRequirement {
  requirement: string;
  importance: Importance;
  rawSimilarity: number;
  score: number;
  evidence: string | null;
  foundIn: string | null;
  verdict: "strong" | "partial" | "weak";
}
export interface MatchCoverage {
  requiredTotal: number;
  requiredMatched: number;
  requiredMissing: number;
  preferredTotal: number;
  preferredMatched: number;
  missingRequiredKeywords: string[];
}
export interface MatchResponse {
  semanticScore: number;
  perRequirement: ScoredRequirement[];
  keywords: MatchKeyword[];
  stats: { resume: { embedded: number; reused: number }; jd: { embedded: number; reused: number } };
  coverage: MatchCoverage;
}

// ───────────────────────── Workspaces & pipeline

export type WorkspaceStatus =
  "created" | "queued" | "processing" | "completed" | "partial" | "failed";
export interface Workspace {
  id: string;
  name: string;
  resumeId: string;
  jobDescriptionId: string;
  status: WorkspaceStatus;
  lastRunId: string | null;
  analyzedResumeVersion: number | null;
  createdAt: string;
  /** populated on list; null on single GET/create */ overallScore: number | null;
}
export interface CreateWorkspaceRequest {
  resumeId: string;
  jobDescriptionId: string;
  /** non-empty, max 200 */ name: string;
}

export type RunStatus = "queued" | "running" | "completed" | "partial" | "failed" | "cancelled";
export type StepStatus = "pending" | "running" | "completed" | "failed" | "skipped";
export type StepName =
  | "parse_resume"
  | "parse_jd"
  | "generate_embeddings"
  | "match_keywords"
  | "score_ats"
  | "optimize_resume"
  | "generate_cover_letter"
  | "generate_interview_qs"
  | "build_learning_path"
  | "research_company"
  | "estimate_salary"
  | "finalize";
export interface RunStep {
  name: StepName | string;
  status: StepStatus;
  error: string | null;
}
export interface Run {
  id: string;
  workspaceId: string;
  status: RunStatus;
  /** 0..100 */ progress: number;
  currentStep: string | null;
  creditsCharged: number;
  creditsRefunded: number;
  error: string | null;
  /** grows as steps start; NOT pre-populated with all 12 */ steps: RunStep[];
}
/** POST /workspaces/:id/analyze → 202 (requires header Idempotency-Key: <uuid>) */
export interface AnalyzeResponse {
  runId: string;
  status: RunStatus;
  creditsCharged: number;
  replayed: boolean;
}
export interface StreamTicket {
  ticket: string;
  expiresInSec: number;
}

/** SSE named events from GET /workspaces/runs/:runId/stream?ticket=… (use addEventListener per name). */
export type RunEvent =
  | {
      event: "snapshot";
      data: {
        runId: string;
        status: RunStatus;
        progress: number;
        steps: { name: string; status: StepStatus }[];
      };
    }
  | { event: "run.started"; data: { type: "run.started"; runId: string; stepsTotal: number } }
  | {
      event: "step.started";
      data: { type: "step.started"; runId: string; step: string; label: string; progress: number };
    }
  | {
      event: "step.completed";
      data: {
        type: "step.completed";
        runId: string;
        step: string;
        progress: number;
        payload?: unknown;
      };
    }
  | {
      event: "step.failed";
      data: {
        type: "step.failed";
        runId: string;
        step: string;
        willRetry: boolean;
        attempt: number;
      };
    }
  | {
      event: "step.skipped";
      data: { type: "step.skipped"; runId: string; step: string; progress: number; reason: string };
    }
  | {
      event: "run.completed";
      data: { type: "run.completed"; runId: string; progress: 100; durationMs: number };
    }
  | {
      event: "run.failed";
      data: {
        type: "run.failed";
        runId: string;
        status: "failed" | "partial";
        failedSteps: string[];
        refundedCredits: number;
      };
    }
  | { event: "ping"; data: Record<string, never> };

// ───────────────────────── ATS report

export interface ScoreBreakdownEntry {
  component: string;
  score: number;
  weight: number;
  contribution: number;
}
export interface KeywordMatchRow {
  keyword: string;
  canonical: string | null;
  category: string;
  importance: Importance;
  status: "matched" | "partial" | "missing";
  evidence: string | null;
  foundIn: string[];
  suggestion: string | null;
}
export interface MatchBandResult {
  band: "low" | "fair" | "strong";
  requiredMet: number;
  requiredTotal: number;
}
export interface AtsReport {
  id: string;
  workspaceId: string;
  runId: string;
  resumeVersion: number;
  overallScore: number;
  keywordScore: number;
  semanticScore: number;
  experienceScore: number;
  educationScore: number | null;
  projectScore: number;
  formatScore: number;
  grammarScore: number;
  scoreBreakdown: ScoreBreakdownEntry[];
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  keywords: KeywordMatchRow[];
  createdAt: string;
  matchBand: MatchBandResult | null;
  /** earlier report for before/after; its `keywords` is always [] and `original` null */ original: AtsReport | null;
}
export interface RescoreResponse {
  queued: true;
  rescoreId: string;
  resumeVersion: number;
}
export interface RescoreStatus {
  rescoreId: string;
  status: "queued" | "processing" | "completed" | "failed";
  resumeVersion: number;
  reportId: string | null;
  completedAt: string | null;
  error: string | null;
}

// ───────────────────────── Suggestions

export type SuggestionStatus = "pending" | "accepted" | "rejected" | "stale" | "needs_info";
export interface Suggestion {
  id: string;
  sectionType: string;
  itemIndex: number | null;
  bulletIndex: number | null;
  oldText: string;
  newText: string;
  reason: string;
  impact: "high" | "medium" | "low";
  keywordsAdded: string[];
  status: SuggestionStatus;
  missingFact: string | null;
  exampleValue: string | null;
  needsDirectEdit: boolean;
}
/** apply/reject body: 1+ UUID v4 */ export interface SuggestionIdsRequest {
  suggestionIds: string[];
}
export interface ApplySuggestionsResponse {
  version: number;
  applied: number;
  skipped: string[];
}
export interface RejectSuggestionsResponse {
  rejected: number;
}
export interface ProvideDetailRequest {
  /** 1..2000 */ newText: string;
}

// ───────────────────────── Cover letter / interview / company / salary / learning

export type CoverLetterTone = "professional" | "friendly" | "confident" | "enthusiastic";
export type CoverLetterLength = "short" | "standard" | "long";
export interface CoverLetter {
  id: string;
  workspaceId: string;
  version: number;
  tone: CoverLetterTone;
  length: CoverLetterLength;
  content: string;
  wordCount: number;
  createdAt: string;
}
export interface RegenerateCoverLetterRequest {
  tone?: CoverLetterTone;
  length?: CoverLetterLength;
}

export interface InterviewQuestion {
  id: string;
  type: "hr" | "behavioral" | "technical" | "coding" | "system_design";
  difficulty: "easy" | "medium" | "hard";
  question: string;
  idealAnswer: string;
  framework: string | null;
  whyAsked: string;
  basedOn: string | null;
  userAnswer: string | null;
  aiFeedback: string | null;
  /** 0..100 */ answerScore: number | null;
}
export interface SubmitAnswerRequest {
  /** non-empty, max 5000 (UI requires >= 20 chars) */ answer: string;
}

/** Raw entity; extra fields (workspaceId, runId, createdAt, id) also present. */
export interface CompanyInsight {
  id: string;
  workspaceId: string;
  runId: string;
  companyName: string;
  overview: string;
  culture: string[];
  talkingPoints: string[];
  sources: string[];
  confidence: "high" | "medium" | "low";
  fromCache: boolean;
  createdAt: string;
}
export interface SalaryEstimate {
  id: string;
  workspaceId: string;
  runId: string;
  currency: string;
  p25: number;
  p50: number;
  p75: number;
  /** always true */ isEstimate: true;
  methodology: string;
  factors: string[];
  negotiationTips: string[];
  createdAt: string;
}
export interface LearningRoadmapItem {
  title: string;
  gapReason: string;
  resourceType: "documentation" | "course" | "book" | "project" | "other";
  url: string | null;
  estHours: number;
  priority: "required" | "preferred";
  affiliateUrl: string | null;
}
export interface LearningRoadmap {
  id: string;
  workspaceId: string;
  runId: string;
  items: LearningRoadmapItem[];
  createdAt: string;
}

// ───────────────────────── Documents (PDF/DOCX export)

export type DocType =
  "resume_pdf" | "resume_docx" | "cover_letter_pdf" | "cover_letter_docx" | "full_report_pdf";
export type DocStatus = "queued" | "generating" | "ready" | "stale" | "failed";
export interface GeneratedDocument {
  id: string;
  workspaceId: string;
  type: DocType;
  filename: string;
  status: DocStatus;
  fileSize: number | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface RequestDocumentRequest {
  type: DocType;
}
/** short-lived presigned URL (SIGNED_URL_TTL_SEC, default 900s) */
export interface DocumentDownload {
  url: string;
  filename: string;
}

// ───────────────────────── Credits / dashboard / notifications / referrals

export interface CreditBalance {
  balance: number;
}
export type CreditReason =
  | "signup_bonus"
  | "analyze"
  | "refund"
  | "grant"
  | "cover_letter_regenerate"
  | "answer_feedback"
  | "rescore"
  | "monthly_refill"
  | "purchase"
  | "admin_adjust"
  | "retry_reversal"
  | "referral_reward"
  | "referral_bonus"
  | "plan_upgrade";
export interface CreditLedgerEntry {
  id: string;
  amount: number;
  reason: CreditReason;
  referenceId: string | null;
  referenceType: string | null;
  createdAt: string;
}

export interface DashboardOverview {
  creditBalance: number;
  plan: { key: string; name: string; status: string; monthlyCredits: number };
  /** `limit` is set by the service though absent from the Swagger DTO */
  resumes: { count: number; limit?: number };
  workspaces: {
    total: number;
    completed: number;
    processing: number;
    failed: number;
    recent: { id: string; name: string; status: string; updatedAt: string; score: number | null }[];
  };
  unreadNotifications: number;
  scoreInsight: {
    latestScore: number | null;
    averageScore: number | null;
    bestScore: number | null;
    trend: { date: string; score: number }[];
  };
  creditInsight: {
    balance: number;
    spentLast30Days: number;
    grantedLast30Days: number;
    monthlyAllowance: number;
    runsRemaining: number;
  };
  topGaps: { keyword: string; missCount: number }[];
  /** last 14 days, zero-filled */ activity: { date: string; runs: number }[];
  actionItems: {
    kind: "failed_run" | "pending_suggestions" | "low_credits" | "incomplete_profile";
    label: string;
    /** web route, e.g. "/workspaces?filter=failed" — map to mobile route */ href: string;
    workspaceId?: string;
    runId?: string;
    resumeId?: string;
    priority: "high" | "medium" | "low";
  }[];
  attention: { failedRuns: number; workspacesWithPendingSuggestions: number };
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}
export interface UnreadCount {
  count: number;
}
export interface NotificationPreferences {
  /** notification `type`s with email turned OFF */ emailDisabled: string[];
}
export const NOTIFICATION_TYPES = [
  { type: "run.completed", label: "Analysis complete" },
  { type: "run.failed", label: "Analysis failed" },
  { type: "gdpr.export_ready", label: "Data export ready" },
] as const;

export interface ReferralInfo {
  code: string;
  shareUrl: string;
  rewardPerReferral: number;
  enabled: boolean;
  stats: { invited: number; qualified: number; creditsEarned: number };
}

// ───────────────────────── Billing

export type SubscriptionStatus = "active" | "past_due" | "canceled" | "incomplete";
export interface Plan {
  id: string;
  key: string;
  name: string;
  description: string | null;
  priceMonthlyCents: number;
  priceYearlyCents: number;
  monthlyCredits: number;
  maxResumes: number;
  maxWorkspaces: number;
  displayOrder: number;
}
export interface CreditPack {
  id: string;
  name: string;
  description: string | null;
  credits: number;
  priceCents: number;
  bestValue: boolean;
  displayOrder: number;
}
export interface Subscription {
  planKey: string;
  planName: string;
  monthlyCredits: number;
  maxResumes: number;
  maxWorkspaces: number;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  pendingPlanKey: string | null;
}
export interface CheckoutRequest {
  planKey: string;
  interval?: "month" | "year";
}
export type SwitchPlanRequest = CheckoutRequest;
/** Stripe-hosted page; open in system browser / Custom Tab */
export interface UrlResponse {
  url: string;
}

// ───────────────────────── Error `details` shapes worth handling
export interface InsufficientCreditsDetails {
  required: number;
  balance: number;
}
export interface PlanLimitDetails {
  limit: number;
  current: number;
  feature: string;
}
export interface FileTooLargeDetails {
  maxMb: number;
}
export interface OtpInvalidDetails {
  remaining?: number;
}
export interface RetryAfterDetails {
  retryAfterSec: number;
}
export interface AnalysisRunningDetails {
  runId: string;
}
export interface ResumeInUseDetails {
  workspaces: { id: string; name: string }[];
}
