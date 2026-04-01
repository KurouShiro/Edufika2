import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { Alert, BackHandler, DeviceEventEmitter, NativeModules, Platform } from "react-native";
import { AppLanguage, tr } from "./i18n";
import AdminDashboardPanel from "./screens/AdminDashboardPanel";
import type {
  AdminGeneratedTokenItem,
  AdminTokenMonitorDetail,
  AdminTokenMonitorItem,
  TokenActivityLogItem,
  TokenActivityState,
} from "./screens/AdminDashboardPanel";
import DeveloperAccessScreen from "./screens/DeveloperAccessScreen";
import ExamSelectionScreen from "./screens/ExamSelectionScreen";
import HistoryScreen from "./screens/HistoryScreen";
import InAppQuizSelection, { type InAppQuizSession } from "./screens/InAppQuizSelection";
import LoginSelection from "./screens/LoginSelection";
import ManualInputFail from "./screens/ManualInputFail";
import ManualInputScreen from "./screens/ManualInputScreen";
import PermissionsScreen from "./screens/Permissions";
import QuizStudentScreen from "./screens/QuizStudentScreen";
import QuizQuestionBuilderScreen, {
  type QuizQuestionBuilderCache,
} from "./screens/QuizQuestionBuilderScreen";
import QuizTeacherScreen, { type QuizTeacherCache } from "./screens/QuizTeacherScreen";
import Register from "./screens/Register";
import Settings from "./screens/Settings";
import SplashScreen from "./screens/SplashScreen";
import StartScreen from "./screens/Start";
import SuccessScreen from "./screens/SuccessScreen";
import TokenLogin from "./screens/TokenLogin";
import UpdateScreen from "./screens/Update";
import URLWhitelist from "./screens/URLWhitelist";
import UserLogin from "./screens/UserLogin";
import ViolationScreen from "./screens/ViolationScreen";
import { ThemeId, getActiveThemeId, setActiveTheme, themePresets } from "./screens/Layout";
import {
  checkForUpdates,
  confirmCurrentBundleReady,
  installDownloadedNativeUpdate,
  openUnknownAppSourcesSettings,
  restartApp,
  startNativeUpdate,
  startOtaUpdate,
  subscribeToUpdateProgress,
  type RemoteConfigPayload,
  type UpdateProgressPayload,
  type UpdateSnapshot,
} from "./nativeUpdates";
import { fetchGoogleDriveHealth, type DriveHealthResult } from "./utils/quizResultExport";

const ExamBrowserScreen = lazy(() => import("./screens/ExamBrowserScreen"));
const QRScannerScreen = lazy(() => import("./screens/QRScannerScreen"));

type ScreenId =
  | "StartScreen"
  | "SplashScreen"
  | "LoginSelection"
  | "TokenLogin"
  | "UpdateScreen"
  | "UserLogin"
  | "Register"
  | "InAppQuizSelection"
  | "AdminDashboardPanel"
  | "DeveloperAccessScreen"
  | "ExamBrowserScreen"
  | "ViolationScreen"
  | "URLWhitelist"
  | "SuccessScreen"
  | "QRScannerScreen"
  | "ExamSelectionScreen"
  | "ManualInputScreen"
  | "ManualInputFail"
  | "PermissionsScreen"
  | "HistoryScreen"
  | "QuizQuestionBuilderScreen"
  | "QuizTeacherScreen"
  | "QuizStudentScreen"
  | "Settings";

type Role = "guest" | "student" | "admin" | "developer";
type SessionMode = "BROWSER_LOCKDOWN" | "HYBRID" | "IN_APP_QUIZ";
type IssuedTokenRole = "student" | "admin";
type IssuedTokenStatus = "issued" | "online" | "offline" | "revoked" | "expired";

type IssuedToken = {
  token: string;
  role: IssuedTokenRole;
  expiresAt: number;
  source: string;
  status: IssuedTokenStatus;
  ipAddress: string;
  deviceName: string;
  lastSeenAt: number;
  revokedReason?: string;
};

type TokenPinPolicy = {
  pin: string;
  effectiveDate: string;
};

type TokenLaunchPolicy = {
  url: string;
  updatedAt: string;
};

type StudentAccount = {
  name: string;
  studentClass: string;
  elective: string;
  username: string;
  schoolYear: string;
};

type BackendMonitorToken = {
  token: string;
  role?: "student" | "admin" | string | null;
  status?: IssuedTokenStatus | string | null;
  bindingId?: string | null;
  binding_id?: string | null;
  ipAddress?: string | null;
  deviceName?: string | null;
  claimedAt?: string | null;
  claimed_at?: string | null;
  expiresAt?: string | null;
  lastSeenAt?: string | null;
  lockReason?: string | null;
  lock_reason?: string | null;
  sessionState?: string | null;
  session_state?: string | null;
  activityState?: TokenActivityState | string | null;
  activity_state?: TokenActivityState | string | null;
  launchUrl?: string | null;
  launch_url?: string | null;
  staleSeconds?: number | string | null;
  stale_seconds?: number | string | null;
  latestViolationType?: string | null;
  latest_violation_type?: string | null;
  latestViolationDetail?: string | null;
  latest_violation_detail?: string | null;
  latestViolationAt?: string | null;
  latest_violation_at?: string | null;
  ip_address?: string | null;
  device_name?: string | null;
  expires_at?: string | null;
  last_seen_at?: string | null;
};

type TokenActivityLogMap = Record<string, TokenActivityLogItem[]>;

type BackendQuizResultRow = {
  token?: string | null;
  status?: string | null;
  score?: number | string | null;
  max_score?: number | string | null;
  submitted_at?: string | null;
  duration_seconds?: number | string | null;
  student_name?: string | null;
  student_class?: string | null;
  student_elective?: string | null;
};

type QuizResultByToken = {
  status: string;
  score: number;
  maxScore: number;
  submittedAtLabel: string;
  durationSeconds: number;
  studentName: string;
  studentClass: string;
  studentElective: string;
};

type ViolationAuditRecord = {
  timestamp: string;
  type: string;
  detail: string;
  riskDelta: number;
  source: "risk" | "native_lock";
};

type DriveHealthState = {
  loading: boolean;
  checked: boolean;
  connected: boolean;
  configured: boolean;
  folderName: string;
  folderId: string;
  authMode: string;
  scope: string;
  error: string;
  lastCheckedAt: number | null;
};

type StudentTokenAdminContext = {
  sessionId: string;
  accessSignature: string;
  bindingId: string;
};

type AdminWorkspaceSnapshotV1 = {
  version: 1;
  backendBaseUrl: string;
  sessionMode: SessionMode;
  activeExamMode: SessionMode;
  generatedToken: string;
  generatedTokenExpiryAt: string;
  generatedTokenBatch: AdminGeneratedTokenItem[];
  tokenBatchCount: string;
  tokenExpiryMinutes: string;
  issuedTokens: IssuedToken[];
  tokenPinPolicies: Record<string, TokenPinPolicy>;
  tokenLaunchPolicies: Record<string, TokenLaunchPolicy>;
  tokenLaunchUrlInput: string;
  proctorPin: string;
  proctorPinEffectiveDate: string;
  adminBackendSessionId: string;
  adminBackendAccessSignature: string;
  adminBackendBindingId: string;
  studentTokenAdminContexts: Record<string, StudentTokenAdminContext>;
  backendMonitorItems: AdminTokenMonitorItem[];
};

type AdminWorkspaceEntry = {
  sessionMode: SessionMode;
  activeExamMode: SessionMode;
  generatedToken: string;
  generatedTokenExpiryAt: string;
  generatedTokenBatch: AdminGeneratedTokenItem[];
  tokenBatchCount: string;
  tokenExpiryMinutes: string;
  issuedTokens: IssuedToken[];
  tokenPinPolicies: Record<string, TokenPinPolicy>;
  tokenLaunchPolicies: Record<string, TokenLaunchPolicy>;
  tokenLaunchUrlInput: string;
  proctorPin: string;
  proctorPinEffectiveDate: string;
  adminBackendSessionId: string;
  adminBackendAccessSignature: string;
  adminBackendBindingId: string;
  studentTokenAdminContexts: Record<string, StudentTokenAdminContext>;
  backendMonitorItems: AdminTokenMonitorItem[];
  quizBuilderCache: QuizQuestionBuilderCache;
  quizTeacherCache: QuizTeacherCache;
};

type AdminWorkspaceCache = {
  version: 2;
  backendBaseUrl: string;
  admins: Record<string, AdminWorkspaceEntry>;
};

const STUDENT_TOKEN = "StudentID";
const ADMIN_TOKEN = "AdminID";
const DEVELOPER_PASSWORD = "EDU_DEV_ACCESS";
const DEFAULT_SESSION_EXPIRY_MINUTES = 120;
const BACKEND_ADMIN_CREATE_KEY = "ed9314856e2e74de0965f657da218b5531988e483f786bd377a68e41cc79cd02ba41b9f47d63c6b50f3c3fc6743010d15090d4bf98c1112a47e6271d449987fa";
const ADMIN_MONITOR_REFRESH_INTERVAL_MS = 200;
const ADMIN_MONITOR_RETRY_INTERVAL_MS = 2500;
const ADMIN_MONITOR_QUIZ_RESULTS_REFRESH_INTERVAL_MS = 5000;
const ADMIN_WORKSPACE_SCHEMA_VERSION = 2;

const DEFAULT_QUIZ_BUILDER_CACHE: QuizQuestionBuilderCache = {
  subjectIdInput: "",
  questionCountInput: "1",
  questionDrafts: [],
  assignTokenInput: "",
};
const DEFAULT_QUIZ_TEACHER_CACHE: QuizTeacherCache = {
  title: "Edufika In-App Quiz",
  description: "",
  durationMinutes: "60",
  showResultsImmediately: true,
  randomizeQuestions: false,
  allowReview: true,
  subjectCode: "",
  subjectName: "",
  subjectIdInput: "",
  questionText: "",
  questionType: "single_choice",
  optionA: "",
  optionB: "",
  optionC: "",
  optionD: "",
  optionE: "",
  optionF: "",
  correctOptionKey: "A",
  assignTokenInput: "",
  accessMode: "",
  tokenGateInput: "",
  lockedStudentToken: "",
  tokenConfirmed: false,
};

const defaultWhitelist = ["https://example.org", "https://school.ac.id/exam"];
const DEFAULT_BACKEND_BASE_URL = "https://srv1536310.hstgr.cloud";
const LEGACY_DEFAULT_BACKEND_BASE_URLS = new Set([
  "http://103.27.207.53:8091",
  "https://103.27.207.53:8091",
  "https://merrilee-interangular-ula.ngrok-free.dev",
  "http://merrilee-interangular-ula.ngrok-free.dev",
]);

type ClipboardModuleShape = {
  setString?: (value: string) => void;
};

type EdufikaSecurityModuleShape = {
  getKioskEnabled?: () => Promise<boolean>;
  getViolationSystemEnabled?: () => Promise<boolean>;
  getSplitScreenDetectionEnabled?: () => Promise<boolean>;
  getScreenshotAccessibilityEnabled?: () => Promise<boolean>;
  getAdminWorkspaceCache?: () => Promise<string>;
  getDeviceFingerprint?: () => Promise<string>;
  setStartupPermissionGateActive?: (enabled: boolean) => void;
  setKioskEnabled?: (enabled: boolean) => void;
  setViolationSystemEnabled?: (enabled: boolean) => void;
  setSplitScreenDetectionEnabled?: (enabled: boolean) => void;
  setScreenshotAccessibilityEnabled?: (enabled: boolean) => void;
  setAdminWorkspaceCache?: (value: string) => void;
  clearAdminWorkspaceCache?: () => void;
  setPinEntryFocusBypass?: (enabled: boolean) => void;
  syncStudentSession?: (
    token: string,
    sessionId: string,
    accessSignature: string,
    deviceBindingId: string,
    expiresAtMillis: number,
    examUrl: string,
    examModeActive: boolean
  ) => void;
  clearSession?: () => void;
  startHeartbeat?: () => void;
  stopHeartbeat?: () => void;
  triggerViolationAlarm?: () => void;
  stopViolationAlarm?: () => void;
  checkAndLockIfMultiWindow?: () => Promise<boolean>;
  openCameraXQrScanner?: () => Promise<string>;
  exitApp?: () => void;
};

type UpdateFlowMode = "startup" | "manual";
type UpdateActionId =
  | "continue"
  | "retry"
  | "restart"
  | "install_native"
  | "install_downloaded_native"
  | "open_unknown_sources";

const securityModule: EdufikaSecurityModuleShape | undefined = (
  NativeModules as { EdufikaSecurity?: EdufikaSecurityModuleShape }
).EdufikaSecurity;

const clipboardModule: ClipboardModuleShape | undefined = (
  NativeModules as { Clipboard?: ClipboardModuleShape }
).Clipboard;

function safeCopyToClipboard(value: string): boolean {
  try {
    clipboardModule?.setString?.(value);
    return true;
  } catch {
    return false;
  }
}

function runSecurityCall(action: () => void): void {
  try {
    action();
  } catch {
    // Ignore native bridge failures to keep the session UI responsive.
  }
}

function normalizeUrl(raw: unknown): string {
  const input = typeof raw === "string" ? raw.trim() : "";
  if (!input) {
    return "";
  }
  if (input.startsWith("http://") || input.startsWith("https://")) {
    return input;
  }
  return `https://${input}`;
}

function normalizeBackendBaseUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }
  const withProtocol = trimmed.startsWith("http://") || trimmed.startsWith("https://")
    ? trimmed
    : `http://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    const origin = parsed.origin;
    const rawPath = parsed.pathname.replace(/\/+$/, "");
    if (!rawPath || rawPath === "/") {
      return LEGACY_DEFAULT_BACKEND_BASE_URLS.has(origin) ? DEFAULT_BACKEND_BASE_URL : origin;
    }
    if (/\/healthz?$/i.test(rawPath)) {
      return LEGACY_DEFAULT_BACKEND_BASE_URLS.has(origin) ? DEFAULT_BACKEND_BASE_URL : origin;
    }
    const normalized = `${origin}${rawPath}`;
    return LEGACY_DEFAULT_BACKEND_BASE_URLS.has(normalized) ? DEFAULT_BACKEND_BASE_URL : normalized;
  } catch {
    const normalized = withProtocol.replace(/\/+$/, "");
    return LEGACY_DEFAULT_BACKEND_BASE_URLS.has(normalized) ? DEFAULT_BACKEND_BASE_URL : normalized;
  }
}

function encodeBasicAuth(value: string): string {
  const btoaFn = (globalThis as typeof globalThis & { btoa?: (data: string) => string }).btoa;
  if (typeof btoaFn === "function") {
    return btoaFn(value);
  }
  const bufferCtor = (globalThis as typeof globalThis & { Buffer?: any }).Buffer;
  if (bufferCtor) {
    return bufferCtor.from(value, "utf8").toString("base64");
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isValidSessionMode(value: unknown): value is SessionMode {
  return value === "BROWSER_LOCKDOWN" || value === "HYBRID" || value === "IN_APP_QUIZ";
}

function buildDefaultAdminWorkspaceEntry(): AdminWorkspaceEntry {
  return {
    sessionMode: "BROWSER_LOCKDOWN",
    activeExamMode: "BROWSER_LOCKDOWN",
    generatedToken: "",
    generatedTokenExpiryAt: "",
    generatedTokenBatch: [],
    tokenBatchCount: "1",
    tokenExpiryMinutes: String(DEFAULT_SESSION_EXPIRY_MINUTES),
    issuedTokens: [],
    tokenPinPolicies: {},
    tokenLaunchPolicies: {},
    tokenLaunchUrlInput: "",
    proctorPin: "4321",
    proctorPinEffectiveDate: "",
    adminBackendSessionId: "",
    adminBackendAccessSignature: "",
    adminBackendBindingId: "",
    studentTokenAdminContexts: {},
    backendMonitorItems: [],
    quizBuilderCache: {
      subjectIdInput: DEFAULT_QUIZ_BUILDER_CACHE.subjectIdInput,
      questionCountInput: DEFAULT_QUIZ_BUILDER_CACHE.questionCountInput,
      questionDrafts: [],
      assignTokenInput: DEFAULT_QUIZ_BUILDER_CACHE.assignTokenInput,
    },
    quizTeacherCache: {
      ...DEFAULT_QUIZ_TEACHER_CACHE,
    },
  };
}

function normalizeAdminWorkspaceEntry(raw: unknown): AdminWorkspaceEntry {
  const base = buildDefaultAdminWorkspaceEntry();
  if (!isRecord(raw)) {
    return base;
  }
  const entry = raw as Partial<AdminWorkspaceEntry>;

  if (isValidSessionMode(entry.sessionMode)) {
    base.sessionMode = entry.sessionMode;
  }
  if (isValidSessionMode(entry.activeExamMode)) {
    base.activeExamMode = entry.activeExamMode;
  }
  if (typeof entry.generatedToken === "string") {
    base.generatedToken = entry.generatedToken;
  }
  if (typeof entry.generatedTokenExpiryAt === "string") {
    base.generatedTokenExpiryAt = entry.generatedTokenExpiryAt;
  }
  if (Array.isArray(entry.generatedTokenBatch)) {
    base.generatedTokenBatch = entry.generatedTokenBatch.filter(
      (item) => item && typeof item.token === "string" && typeof item.expiresAt === "string"
    );
  }
  if (typeof entry.tokenBatchCount === "string" && entry.tokenBatchCount.trim()) {
    base.tokenBatchCount = entry.tokenBatchCount.trim();
  }
  if (typeof entry.tokenExpiryMinutes === "string" && entry.tokenExpiryMinutes.trim()) {
    base.tokenExpiryMinutes = entry.tokenExpiryMinutes.trim();
  }
  if (Array.isArray(entry.issuedTokens)) {
    base.issuedTokens = entry.issuedTokens as IssuedToken[];
  }
  if (isRecord(entry.tokenPinPolicies)) {
    base.tokenPinPolicies = entry.tokenPinPolicies as Record<string, TokenPinPolicy>;
  }
  if (isRecord(entry.tokenLaunchPolicies)) {
    base.tokenLaunchPolicies = entry.tokenLaunchPolicies as Record<string, TokenLaunchPolicy>;
  }
  if (typeof entry.tokenLaunchUrlInput === "string") {
    base.tokenLaunchUrlInput = entry.tokenLaunchUrlInput;
  }
  if (typeof entry.proctorPin === "string" && entry.proctorPin.trim()) {
    base.proctorPin = entry.proctorPin.trim();
  } else if (typeof entry.proctorPin === "string") {
    base.proctorPin = entry.proctorPin;
  }
  if (typeof entry.proctorPinEffectiveDate === "string") {
    base.proctorPinEffectiveDate = entry.proctorPinEffectiveDate;
  }
  if (typeof entry.adminBackendSessionId === "string") {
    base.adminBackendSessionId = entry.adminBackendSessionId;
  }
  if (typeof entry.adminBackendAccessSignature === "string") {
    base.adminBackendAccessSignature = entry.adminBackendAccessSignature;
  }
  if (typeof entry.adminBackendBindingId === "string") {
    base.adminBackendBindingId = entry.adminBackendBindingId;
  }
  if (isRecord(entry.studentTokenAdminContexts)) {
    base.studentTokenAdminContexts = entry.studentTokenAdminContexts as Record<
      string,
      StudentTokenAdminContext
    >;
  }
  if (Array.isArray(entry.backendMonitorItems)) {
    base.backendMonitorItems = entry.backendMonitorItems as AdminTokenMonitorItem[];
  }
  if (isRecord(entry.quizBuilderCache)) {
    const cache = entry.quizBuilderCache as QuizQuestionBuilderCache;
    base.quizBuilderCache = {
      subjectIdInput:
        typeof cache.subjectIdInput === "string"
          ? cache.subjectIdInput
          : DEFAULT_QUIZ_BUILDER_CACHE.subjectIdInput,
      questionCountInput:
        typeof cache.questionCountInput === "string"
          ? cache.questionCountInput
          : DEFAULT_QUIZ_BUILDER_CACHE.questionCountInput,
      questionDrafts: Array.isArray(cache.questionDrafts) ? cache.questionDrafts : [],
      assignTokenInput:
        typeof cache.assignTokenInput === "string"
          ? cache.assignTokenInput
          : DEFAULT_QUIZ_BUILDER_CACHE.assignTokenInput,
    };
  }
  if (isRecord(entry.quizTeacherCache)) {
    const cache = entry.quizTeacherCache as QuizTeacherCache;
    base.quizTeacherCache = {
      title: typeof cache.title === "string" ? cache.title : DEFAULT_QUIZ_TEACHER_CACHE.title,
      description:
        typeof cache.description === "string" ? cache.description : DEFAULT_QUIZ_TEACHER_CACHE.description,
      durationMinutes:
        typeof cache.durationMinutes === "string"
          ? cache.durationMinutes
          : DEFAULT_QUIZ_TEACHER_CACHE.durationMinutes,
      showResultsImmediately:
        typeof cache.showResultsImmediately === "boolean"
          ? cache.showResultsImmediately
          : DEFAULT_QUIZ_TEACHER_CACHE.showResultsImmediately,
      randomizeQuestions:
        typeof cache.randomizeQuestions === "boolean"
          ? cache.randomizeQuestions
          : DEFAULT_QUIZ_TEACHER_CACHE.randomizeQuestions,
      allowReview:
        typeof cache.allowReview === "boolean"
          ? cache.allowReview
          : DEFAULT_QUIZ_TEACHER_CACHE.allowReview,
      subjectCode:
        typeof cache.subjectCode === "string" ? cache.subjectCode : DEFAULT_QUIZ_TEACHER_CACHE.subjectCode,
      subjectName:
        typeof cache.subjectName === "string" ? cache.subjectName : DEFAULT_QUIZ_TEACHER_CACHE.subjectName,
      subjectIdInput:
        typeof cache.subjectIdInput === "string"
          ? cache.subjectIdInput
          : DEFAULT_QUIZ_TEACHER_CACHE.subjectIdInput,
      questionText:
        typeof cache.questionText === "string"
          ? cache.questionText
          : DEFAULT_QUIZ_TEACHER_CACHE.questionText,
      questionType:
        cache.questionType === "single_choice" ||
        cache.questionType === "multiple_correct" ||
        cache.questionType === "true_false" ||
        cache.questionType === "matching"
          ? cache.questionType
          : DEFAULT_QUIZ_TEACHER_CACHE.questionType,
      optionA: typeof cache.optionA === "string" ? cache.optionA : DEFAULT_QUIZ_TEACHER_CACHE.optionA,
      optionB: typeof cache.optionB === "string" ? cache.optionB : DEFAULT_QUIZ_TEACHER_CACHE.optionB,
      optionC: typeof cache.optionC === "string" ? cache.optionC : DEFAULT_QUIZ_TEACHER_CACHE.optionC,
      optionD: typeof cache.optionD === "string" ? cache.optionD : DEFAULT_QUIZ_TEACHER_CACHE.optionD,
      optionE: typeof cache.optionE === "string" ? cache.optionE : DEFAULT_QUIZ_TEACHER_CACHE.optionE,
      optionF: typeof cache.optionF === "string" ? cache.optionF : DEFAULT_QUIZ_TEACHER_CACHE.optionF,
      correctOptionKey:
        typeof cache.correctOptionKey === "string"
          ? cache.correctOptionKey
          : DEFAULT_QUIZ_TEACHER_CACHE.correctOptionKey,
      assignTokenInput:
        typeof cache.assignTokenInput === "string"
          ? cache.assignTokenInput
          : DEFAULT_QUIZ_TEACHER_CACHE.assignTokenInput,
      accessMode:
        cache.accessMode === "token" || cache.accessMode === "basic" || cache.accessMode === ""
          ? cache.accessMode
          : DEFAULT_QUIZ_TEACHER_CACHE.accessMode,
      tokenGateInput:
        typeof cache.tokenGateInput === "string"
          ? cache.tokenGateInput
          : DEFAULT_QUIZ_TEACHER_CACHE.tokenGateInput,
      lockedStudentToken:
        typeof cache.lockedStudentToken === "string"
          ? cache.lockedStudentToken
          : DEFAULT_QUIZ_TEACHER_CACHE.lockedStudentToken,
      tokenConfirmed:
        typeof cache.tokenConfirmed === "boolean"
          ? cache.tokenConfirmed
          : DEFAULT_QUIZ_TEACHER_CACHE.tokenConfirmed,
    };
  }

  return base;
}

function normalizeAdminTokenKey(raw: string): string {
  return raw.trim().toUpperCase();
}

function mergeGeneratedTokenBatch(
  previous: AdminGeneratedTokenItem[],
  incoming: AdminGeneratedTokenItem[]
): AdminGeneratedTokenItem[] {
  const mergedByToken = new Map<string, AdminGeneratedTokenItem>();
  previous.forEach((item) => {
    const normalizedToken = String(item?.token ?? "")
      .trim()
      .toUpperCase();
    if (!normalizedToken) {
      return;
    }
    mergedByToken.set(normalizedToken, {
      token: normalizedToken,
      expiresAt: String(item.expiresAt ?? ""),
    });
  });
  incoming.forEach((item) => {
    const normalizedToken = String(item?.token ?? "")
      .trim()
      .toUpperCase();
    if (!normalizedToken) {
      return;
    }
    mergedByToken.set(normalizedToken, {
      token: normalizedToken,
      expiresAt: String(item.expiresAt ?? ""),
    });
  });
  return Array.from(mergedByToken.values()).sort((a, b) => a.token.localeCompare(b.token));
}

function getRuntimeDeviceName(role: "student" | "admin"): string {
  const modelFromPlatform = String((Platform as any)?.constants?.Model ?? "").trim();
  const baseName = modelFromPlatform || (Platform.OS === "android" ? "Android Device" : "Mobile Device");
  return role === "admin" ? `RN Admin (${baseName})` : baseName;
}

type ParsedUrl = {
  scheme: string;
  host: string;
  path: string;
};

function toParsedUrl(raw: unknown): ParsedUrl | null {
  const normalized = normalizeUrl(raw);
  if (!normalized) {
    return null;
  }
  const match = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]+)([^?#]*)/i.exec(normalized);
  if (!match) {
    return null;
  }
  return {
    scheme: `${match[1].toLowerCase()}:`,
    host: match[2].toLowerCase(),
    path: match[3]?.length ? match[3] : "/",
  };
}

function hostWithoutPort(host: string): string {
  const normalized = host.toLowerCase().trim();
  const lastColon = normalized.lastIndexOf(":");
  if (lastColon <= 0) {
    return normalized;
  }
  const portCandidate = normalized.slice(lastColon + 1);
  if (!/^\d+$/.test(portCandidate)) {
    return normalized;
  }
  return normalized.slice(0, lastColon);
}

function normalizeHostForCompare(host: string): string {
  const normalized = hostWithoutPort(host);
  return normalized.startsWith("www.") ? normalized.slice(4) : normalized;
}

function hostMatchesOrSubdomain(targetHost: string, allowedHost: string): boolean {
  const normalizedTarget = normalizeHostForCompare(targetHost);
  const normalizedAllowed = normalizeHostForCompare(allowedHost);
  return (
    normalizedTarget === normalizedAllowed ||
    normalizedTarget.endsWith(`.${normalizedAllowed}`)
  );
}

function normalizePathPrefix(pathname: string): string {
  if (!pathname || pathname === "/") {
    return "/";
  }
  return pathname.endsWith("/") ? pathname : `${pathname}/`;
}

function mergeWhitelist(base: string[], tokenBoundUrl?: string): string[] {
  const combined = tokenBoundUrl ? [...base, tokenBoundUrl] : [...base];
  return Array.from(
    new Set(
      combined
        .map((entry) => normalizeUrl(entry))
        .filter((entry) => entry.length > 0)
    )
  );
}

function getTokenLaunchUrl(
  tokenPolicies: Record<string, TokenLaunchPolicy>,
  rawToken: string
): string | undefined {
  const normalizedToken = rawToken.trim().toUpperCase();
  if (!normalizedToken) {
    return undefined;
  }
  const direct = tokenPolicies[normalizedToken]?.url;
  if (direct) {
    return direct;
  }

  const fallbackKey = Object.keys(tokenPolicies).find(
    (key) => key.trim().toUpperCase() === normalizedToken
  );
  return fallbackKey ? tokenPolicies[fallbackKey]?.url : undefined;
}

function getTokenLaunchPolicy(
  tokenPolicies: Record<string, TokenLaunchPolicy>,
  rawToken: string
): TokenLaunchPolicy | undefined {
  const normalizedToken = rawToken.trim().toUpperCase();
  if (!normalizedToken) {
    return undefined;
  }
  const direct = tokenPolicies[normalizedToken];
  if (direct) {
    return direct;
  }
  const fallbackKey = Object.keys(tokenPolicies).find(
    (key) => key.trim().toUpperCase() === normalizedToken
  );
  return fallbackKey ? tokenPolicies[fallbackKey] : undefined;
}

function getTokenLaunchPolicyLabel(
  tokenPolicies: Record<string, TokenLaunchPolicy>,
  rawToken: string
): string {
  const policy = getTokenLaunchPolicy(tokenPolicies, rawToken);
  if (!policy?.updatedAt) {
    return "";
  }
  return formatIsoLabel(policy.updatedAt);
}

function getTokenPinPolicy(
  tokenPolicies: Record<string, TokenPinPolicy>,
  rawToken: string
): TokenPinPolicy | undefined {
  const normalizedToken = rawToken.trim().toUpperCase();
  if (!normalizedToken) {
    return undefined;
  }
  const direct = tokenPolicies[normalizedToken];
  if (direct) {
    return direct;
  }
  const fallbackKey = Object.keys(tokenPolicies).find(
    (key) => key.trim().toUpperCase() === normalizedToken
  );
  return fallbackKey ? tokenPolicies[fallbackKey] : undefined;
}

function isWhitelisted(url: string, whitelist: string[]): boolean {
  const target = toParsedUrl(url);
  if (!target) {
    return false;
  }

  return whitelist.some((allowed) => {
    if (typeof allowed !== "string") {
      return false;
    }
    const allowedUrl = toParsedUrl(allowed);
    if (!allowedUrl) {
      // Ignore malformed allowlist entry instead of failing entire whitelist check.
      return false;
    }

    const targetHost = target.host;
    const allowedHost = allowedUrl.host;
    if (
      hostMatchesOrSubdomain(targetHost, allowedHost) ||
      isSameTrustedHostFamily(targetHost, allowedHost)
    ) {
      return true;
    }

    const sameScheme = target.scheme === allowedUrl.scheme;
    const sameHost = normalizeHostForCompare(targetHost) === normalizeHostForCompare(allowedHost);
    if (!sameScheme || !sameHost) {
      return false;
    }

    const targetPath = normalizePathPrefix(target.path);
    const allowedPath = normalizePathPrefix(allowedUrl.path);
    return targetPath.startsWith(allowedPath);
  });
}

function isSameTrustedHostFamily(targetHost: string, allowedHost: string): boolean {
  const isGoogleFamilyHost = (host: string): boolean => {
    const normalized = normalizeHostForCompare(host);
    if (normalized === "forms.gle") {
      return true;
    }
    if (normalized === "google.com" || normalized.endsWith(".google.com")) {
      return true;
    }
    // Also allow Google country domains like google.co.id, google.co.uk, etc.
    return /^([a-z0-9-]+\.)?google\.[a-z.]+$/.test(normalized);
  };

  if (!isGoogleFamilyHost(allowedHost)) {
    return false;
  }

  return isGoogleFamilyHost(targetHost);
}

function makeLogLine(message: string): string {
  const stamp = new Date()
    .toISOString()
    .replace("T", " ")
    .slice(0, 19);
  return `[${stamp}] ${message}`;
}

function classifyViolationType(detail: string): string {
  const normalized = detail.trim().toLowerCase();
  if (normalized.includes("multi-window") || normalized.includes("split-screen")) {
    return "MULTI_WINDOW";
  }
  if (
    normalized.includes("focus") ||
    normalized.includes("screen off") ||
    normalized.includes("layar mati")
  ) {
    return "FOCUS_LOST";
  }
  if (normalized.includes("background")) {
    return "APP_BACKGROUND";
  }
  if (
    normalized.includes("whitelist") ||
    normalized.includes("external navigation") ||
    normalized.includes("url")
  ) {
    return "NAVIGATION_VIOLATION";
  }
  if (normalized.includes("risk score")) {
    return "RISK_THRESHOLD";
  }
  if (normalized.includes("lock")) {
    return "SESSION_LOCK";
  }
  return "OTHER";
}

function generateToken(): string {
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `S-${randomPart}`;
}

function generateAdminToken(): string {
  const randomPart = Math.random().toString(36).slice(2, 12).toUpperCase();
  return `A-${randomPart}`;
}

function parseExpiryMinutes(raw: string): number {
  const value = Number.parseInt(raw.trim(), 10);
  if (Number.isNaN(value)) {
    return 120;
  }
  return Math.min(43200, Math.max(1, value));
}

function parseAdminTokenBatchCount(raw: string): number {
  const value = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(value) || value <= 0) {
    return 1;
  }
  return value;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseTokenBatchCount(raw: string): number {
  const value = Number.parseInt(raw.trim(), 10);
  if (Number.isNaN(value)) {
    return 1;
  }
  return Math.min(300, Math.max(1, value));
}

function normalizeExamModeValue(raw: unknown): SessionMode {
  const value = String(raw ?? "").trim().toUpperCase();
  if (value === "HYBRID") {
    return "HYBRID";
  }
  if (value === "IN_APP_QUIZ") {
    return "IN_APP_QUIZ";
  }
  return "BROWSER_LOCKDOWN";
}

function formatTimestamp(millis: number): string {
  return new Date(millis).toISOString().replace("T", " ").slice(0, 19);
}

function formatIsoLabel(value?: string | null): string {
  if (!value) {
    return "-";
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return value;
  }
  return formatTimestamp(parsed);
}

function formatTokenActivitySummary(
  activityState: TokenActivityState,
  status: IssuedTokenStatus,
  sessionState: string,
  staleSeconds: number | null,
  lockReason: string
): string {
  switch (activityState) {
    case "on_exam_screen":
      return "Student is active on the exam screen.";
    case "disconnected":
      return staleSeconds && staleSeconds > 0
        ? `Student disconnected. Heartbeat stale for ${staleSeconds}s.`
        : "Student disconnected from the exam session.";
    case "paused":
      return `Session paused by proctor (${sessionState}).`;
    case "revoked":
      return lockReason ? `Token locked: ${lockReason}.` : "Token has been locked or revoked.";
    case "expired":
      return "Token has expired.";
    case "waiting_claim":
    default:
      return status === "issued"
        ? "Waiting for student claim."
        : "Token is waiting for the next student claim.";
  }
}

function buildTokenActivityLogEntry(
  token: string,
  message: string,
  tone: TokenActivityLogItem["tone"],
  extra?: Partial<Omit<TokenActivityLogItem, "id" | "token" | "timestampLabel" | "message" | "tone">>
): TokenActivityLogItem {
  return {
    id: `${token}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    token,
    timestampLabel: formatTimestamp(Date.now()),
    message,
    tone,
    ...extra,
  };
}

function formatRemainingDuration(millis: number): string {
  const clamped = Math.max(0, millis);
  const totalSeconds = Math.floor(clamped / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => value.toString().padStart(2, "0")).join(":");
}

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function generateSessionId(): string {
  const randomPart = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `SES-${randomPart}`;
}

function createDefaultUpdateProgress(
  message = "Preparing update runtime..."
): UpdateProgressPayload {
  return {
    stage: "idle",
    kind: "manifest",
    message,
    progress: 0,
    totalBytes: -1,
    downloadedBytes: -1,
    versionLabel: "",
    restartRequired: false,
    installerLaunched: false,
    timestamp: Date.now(),
  };
}

function formatByteSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "--";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kib = bytes / 1024;
  if (kib < 1024) {
    return `${kib.toFixed(1)} KB`;
  }
  const mib = kib / 1024;
  return `${mib.toFixed(1)} MB`;
}

export default function App() {
  const [screen, setScreen] = useState<ScreenId>("StartScreen");
  const [returnScreen, setReturnScreen] = useState<ScreenId>("LoginSelection");
  const [developerOrigin, setDeveloperOrigin] = useState<ScreenId>("LoginSelection");
  const [role, setRole] = useState<Role>("guest");
  const [updateMode, setUpdateMode] = useState<UpdateFlowMode>("startup");
  const [updateReturnScreen, setUpdateReturnScreen] = useState<ScreenId>("PermissionsScreen");
  const [updateRunId, setUpdateRunId] = useState(0);
  const [updateSnapshot, setUpdateSnapshot] = useState<UpdateSnapshot | null>(null);
  const [updateProgressState, setUpdateProgressState] = useState<UpdateProgressPayload>(() =>
    createDefaultUpdateProgress()
  );
  const [updateLogs, setUpdateLogs] = useState<string[]>([
    "Boot channel armed.",
    "Awaiting manifest sync.",
  ]);
  const [updatePrimaryAction, setUpdatePrimaryAction] = useState<UpdateActionId | null>(null);
  const [updateSecondaryAction, setUpdateSecondaryAction] = useState<UpdateActionId | null>(null);
  const [updateBusy, setUpdateBusy] = useState(false);
  const [remoteConfig, setRemoteConfig] = useState<RemoteConfigPayload>({
    version: "1",
    values: {},
  });
  const [statusBanner, setStatusBanner] = useState("");
  const [allowManualThemeSelection, setAllowManualThemeSelection] = useState(true);

  const [language, setLanguage] = useState<AppLanguage>("id");
  const [themeId, setThemeId] = useState<ThemeId>(getActiveThemeId());

  const [statusMessage, setStatusMessage] = useState(
    tr("id", "Masukkan token sesi untuk melanjutkan.", "Enter session token to continue.")
  );

  const [tokenInput, setTokenInput] = useState("");
  const [studentAuthToken, setStudentAuthToken] = useState("");
  const [studentAccount, setStudentAccount] = useState<StudentAccount | null>(null);
  const [studentLoginUsername, setStudentLoginUsername] = useState("");
  const [studentLoginPassword, setStudentLoginPassword] = useState("");
  const [studentAuthStatus, setStudentAuthStatus] = useState(
    tr("id", "Masukkan kredensial siswa.", "Enter student credentials.")
  );
  const [studentAuthLoading, setStudentAuthLoading] = useState(false);
  const [registerNama, setRegisterNama] = useState("");
  const [registerKelas, setRegisterKelas] = useState("");
  const [registerJurusan, setRegisterJurusan] = useState("");
  const [registerUsername, setRegisterUsername] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerSchoolYear, setRegisterSchoolYear] = useState("");
  const [registerStatus, setRegisterStatus] = useState(
    tr("id", "Lengkapi data registrasi siswa.", "Complete student registration data.")
  );
  const [registerLoading, setRegisterLoading] = useState(false);
  const [inAppQuizSessions, setInAppQuizSessions] = useState<InAppQuizSession[]>([]);
  const [inAppQuizStatus, setInAppQuizStatus] = useState(
    tr("id", "Sinkronisasi daftar kuis.", "Syncing quiz list.")
  );
  const [driveHealth, setDriveHealth] = useState<DriveHealthState>({
    loading: false,
    checked: false,
    connected: false,
    configured: false,
    folderName: "",
    folderId: "",
    authMode: "",
    scope: "",
    error: "",
    lastCheckedAt: null,
  });
  const [quizEntryScreen, setQuizEntryScreen] = useState<ScreenId>("ExamSelectionScreen");
  const [generatedToken, setGeneratedToken] = useState("");
  const [generatedTokenExpiryAt, setGeneratedTokenExpiryAt] = useState("");
  const [tokenBatchCount, setTokenBatchCount] = useState("1");
  const [sessionMode, setSessionMode] = useState<SessionMode>("BROWSER_LOCKDOWN");
  const [generatedTokenBatch, setGeneratedTokenBatch] = useState<AdminGeneratedTokenItem[]>([]);
  const [tokenExpiryMinutes, setTokenExpiryMinutes] = useState("120");
  const [generatedAdminToken, setGeneratedAdminToken] = useState("");
  const [generatedAdminTokenExpiryAt, setGeneratedAdminTokenExpiryAt] = useState("");
  const [adminTokenExpiryMinutes, setAdminTokenExpiryMinutes] = useState("120");
  const [adminTokenBatchCount, setAdminTokenBatchCount] = useState("1");
  const [adminGeneratedTokenBatch, setAdminGeneratedTokenBatch] = useState<AdminGeneratedTokenItem[]>([]);
  const [issuedTokens, setIssuedTokens] = useState<IssuedToken[]>([]);
  const [activeIssuedToken, setActiveIssuedToken] = useState("");
  const [tokenPinPolicies, setTokenPinPolicies] = useState<Record<string, TokenPinPolicy>>({});
  const [tokenLaunchPolicies, setTokenLaunchPolicies] = useState<Record<string, TokenLaunchPolicy>>({});
  const [tokenLaunchUrlInput, setTokenLaunchUrlInput] = useState("");
  const [quizBuilderCache, setQuizBuilderCache] = useState<QuizQuestionBuilderCache>(() => ({
    subjectIdInput: DEFAULT_QUIZ_BUILDER_CACHE.subjectIdInput,
    questionCountInput: DEFAULT_QUIZ_BUILDER_CACHE.questionCountInput,
    questionDrafts: [],
    assignTokenInput: DEFAULT_QUIZ_BUILDER_CACHE.assignTokenInput,
  }));
  const [quizTeacherCache, setQuizTeacherCache] = useState<QuizTeacherCache>(() => ({
    ...DEFAULT_QUIZ_TEACHER_CACHE,
  }));
  const [revokeTokenInput, setRevokeTokenInput] = useState("");
  const [revokeTokenStatus, setRevokeTokenStatus] = useState(
    tr("id", "Masukkan token siswa untuk revoke.", "Enter a student token to revoke.")
  );
  const [reactivateTokenInput, setReactivateTokenInput] = useState("");
  const [reactivateTokenStatus, setReactivateTokenStatus] = useState(
    tr("id", "Masukkan token siswa untuk reaktivasi.", "Enter a student token to reactivate.")
  );
  const [reactivateTokenPending, setReactivateTokenPending] = useState(false);
  const [sessionControlStatus, setSessionControlStatus] = useState(
    tr("id", "Kontrol sesi siap.", "Session control ready.")
  );
  const [activeStudentToken, setActiveStudentToken] = useState("");
  const [activeExamMode, setActiveExamMode] = useState<SessionMode>("BROWSER_LOCKDOWN");
  const [sessionId, setSessionId] = useState(generateSessionId());
  const [riskScore, setRiskScore] = useState(0);
  const [overlayTimestamp, setOverlayTimestamp] = useState(
    new Date()
      .toISOString()
      .replace("T", " ")
      .slice(0, 19)
  );
  const [showIntegrityWarning, setShowIntegrityWarning] = useState(false);
  const [integrityMessage, setIntegrityMessage] = useState(
    tr(
      "id",
      "Perilaku mencurigakan terdeteksi. Aktivitas tercatat untuk proktor.",
      "Suspicious behavior detected. Activity has been logged for proctor review."
    )
  );
  const [violationHistory, setViolationHistory] = useState<ViolationAuditRecord[]>([]);

  const [logs, setLogs] = useState<string[]>([
    makeLogLine("System initialized."),
    makeLogLine("Waiting for session token authentication."),
  ]);

  const [whitelist, setWhitelist] = useState<string[]>(defaultWhitelist);
  const [whitelistInput, setWhitelistInput] = useState("");
  const [manualUrlInput, setManualUrlInput] = useState("");
  const [qrMockValue, setQrMockValue] = useState("");
  const [invalidUrl, setInvalidUrl] = useState("");

  const [examUrl, setExamUrl] = useState("");
  const [bypassWhitelist, setBypassWhitelist] = useState(false);
  const [pinAttempt, setPinAttempt] = useState("");
  const [pinStatus, setPinStatus] = useState(
    tr("id", "Masukkan PIN proktor untuk keluar browser.", "Enter proctor PIN to exit browser.")
  );
  const [proctorPin, setProctorPin] = useState("4321");
  const [proctorPinEffectiveDate, setProctorPinEffectiveDate] = useState("");
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null);
  const [sessionTimeLeftLabel, setSessionTimeLeftLabel] = useState("--:--:--");
  const [sessionExpiryHandled, setSessionExpiryHandled] = useState(false);

  const [violationReason, setViolationReason] = useState(
    tr(
      "id",
      "Aplikasi terdeteksi di-background saat sesi aktif.",
      "App was backgrounded while session is active."
    )
  );

  const [developerPassword, setDeveloperPassword] = useState("");
  const [developerUnlocked, setDeveloperUnlocked] = useState(false);
  const [kioskEnabled, setKioskEnabled] = useState(true);
  const [violationSystemEnabled, setViolationSystemEnabled] = useState(true);
  const [splitScreenDetectionEnabled, setSplitScreenDetectionEnabled] = useState(true);
  const [screenshotAccessibilityEnabled, setScreenshotAccessibilityEnabled] = useState(false);
  const [browserUrl, setBrowserUrl] = useState("https://example.org");
  const [developerClaimTokenInput, setDeveloperClaimTokenInput] = useState("");
  const [backendBaseUrl, setBackendBaseUrl] = useState(DEFAULT_BACKEND_BASE_URL);
  const [deviceFingerprint, setDeviceFingerprint] = useState("rn-device-unknown");
  const [kioskReady, setKioskReady] = useState(false);
  const [studentBackendAccessSignature, setStudentBackendAccessSignature] = useState("");
  const [studentBackendBindingId, setStudentBackendBindingId] = useState("");
  const [activeAdminTokenKey, setActiveAdminTokenKey] = useState("");
  const [adminBackendSessionId, setAdminBackendSessionId] = useState("");
  const [adminBackendAccessSignature, setAdminBackendAccessSignature] = useState("");
  const [adminBackendBindingId, setAdminBackendBindingId] = useState("");
  const [studentTokenAdminContexts, setStudentTokenAdminContexts] = useState<Record<string, StudentTokenAdminContext>>({});
  const [backendMonitorItems, setBackendMonitorItems] = useState<AdminTokenMonitorItem[]>([]);
  const [quizResultsByToken, setQuizResultsByToken] = useState<Record<string, QuizResultByToken>>({});
  const [tokenActivityLogsByToken, setTokenActivityLogsByToken] = useState<TokenActivityLogMap>({});
  const [selectedMonitorToken, setSelectedMonitorToken] = useState("");
  const [backendMonitorError, setBackendMonitorError] = useState("");
  const [adminDashboardTab, setAdminDashboardTab] = useState<"monitor" | "tokens" | "logs">("monitor");
  const multiWindowWatchLoggedRef = useRef(false);
  const adminMonitorFetchInFlightRef = useRef(false);
  const adminMonitorLastQuizRefreshAtRef = useRef(0);
  const tokenMonitorSnapshotRef = useRef<Record<string, AdminTokenMonitorItem>>({});
  const adminWorkspaceHydratedRef = useRef(false);
  const adminWorkspaceCacheRef = useRef<AdminWorkspaceCache>({
    version: ADMIN_WORKSPACE_SCHEMA_VERSION,
    backendBaseUrl: DEFAULT_BACKEND_BASE_URL,
    admins: {},
  });
  const legacyAdminWorkspaceRef = useRef<AdminWorkspaceEntry | null>(null);
  const pendingAdminTokenRef = useRef<string | null>(null);
  const pendingAdminTokenOptionsRef = useRef<{ preserveBackendSession: boolean } | null>(null);
  const startupPermissionGateActive =
    screen === "StartScreen" ||
    screen === "SplashScreen" ||
    screen === "UpdateScreen" ||
    screen === "PermissionsScreen";
  const runtimeKioskEnabled = kioskEnabled && !startupPermissionGateActive;

  const applyAdminWorkspaceEntry = (
    entry: AdminWorkspaceEntry,
    options?: { preserveBackendSession?: boolean }
  ) => {
    setSessionMode(entry.sessionMode);
    setActiveExamMode(entry.activeExamMode);
    setGeneratedToken(entry.generatedToken);
    setGeneratedTokenExpiryAt(entry.generatedTokenExpiryAt);
    setGeneratedTokenBatch(entry.generatedTokenBatch);
    setTokenBatchCount(entry.tokenBatchCount);
    setTokenExpiryMinutes(entry.tokenExpiryMinutes);
    setIssuedTokens(entry.issuedTokens);
    setTokenPinPolicies(entry.tokenPinPolicies);
    setTokenLaunchPolicies(entry.tokenLaunchPolicies);
    setTokenLaunchUrlInput(entry.tokenLaunchUrlInput);
    setProctorPin(entry.proctorPin);
    setProctorPinEffectiveDate(entry.proctorPinEffectiveDate);
    if (!options?.preserveBackendSession) {
      setAdminBackendSessionId(entry.adminBackendSessionId);
      setAdminBackendAccessSignature(entry.adminBackendAccessSignature);
      setAdminBackendBindingId(entry.adminBackendBindingId);
    }
    setStudentTokenAdminContexts(entry.studentTokenAdminContexts);
    setBackendMonitorItems(entry.backendMonitorItems);
    setQuizBuilderCache(entry.quizBuilderCache);
    setQuizTeacherCache(entry.quizTeacherCache);
  };

  const buildAdminWorkspaceEntry = (): AdminWorkspaceEntry => ({
    sessionMode,
    activeExamMode,
    generatedToken,
    generatedTokenExpiryAt,
    generatedTokenBatch,
    tokenBatchCount,
    tokenExpiryMinutes,
    issuedTokens,
    tokenPinPolicies,
    tokenLaunchPolicies,
    tokenLaunchUrlInput,
    proctorPin,
    proctorPinEffectiveDate,
    adminBackendSessionId,
    adminBackendAccessSignature,
    adminBackendBindingId,
    studentTokenAdminContexts,
    backendMonitorItems,
    quizBuilderCache,
    quizTeacherCache,
  });

  const hydrateAdminWorkspaceForToken = (
    rawToken: string,
    options?: { preserveBackendSession?: boolean }
  ) => {
    const tokenKey = normalizeAdminTokenKey(rawToken);
    if (!tokenKey) {
      return;
    }
    if (!adminWorkspaceHydratedRef.current) {
      pendingAdminTokenRef.current = tokenKey;
      pendingAdminTokenOptionsRef.current = {
        preserveBackendSession: Boolean(options?.preserveBackendSession),
      };
      return;
    }

    const cache = adminWorkspaceCacheRef.current;
    let entry: AdminWorkspaceEntry | null = null;
    if (cache.admins && cache.admins[tokenKey]) {
      entry = normalizeAdminWorkspaceEntry(cache.admins[tokenKey]);
      cache.admins = { ...cache.admins, [tokenKey]: entry };
      adminWorkspaceCacheRef.current = {
        version: ADMIN_WORKSPACE_SCHEMA_VERSION,
        backendBaseUrl: cache.backendBaseUrl,
        admins: cache.admins,
      };
    } else if (legacyAdminWorkspaceRef.current) {
      entry = normalizeAdminWorkspaceEntry(legacyAdminWorkspaceRef.current);
      legacyAdminWorkspaceRef.current = null;
      cache.admins = { ...cache.admins, [tokenKey]: entry };
      adminWorkspaceCacheRef.current = {
        version: ADMIN_WORKSPACE_SCHEMA_VERSION,
        backendBaseUrl: cache.backendBaseUrl || backendBaseUrl,
        admins: cache.admins,
      };
      runSecurityCall(() =>
        securityModule?.setAdminWorkspaceCache?.(JSON.stringify(adminWorkspaceCacheRef.current))
      );
    } else {
      entry = buildDefaultAdminWorkspaceEntry();
    }

    applyAdminWorkspaceEntry(entry, options);
  };

  const activateAdminWorkspace = (
    rawToken: string,
    options?: { preserveBackendSession?: boolean }
  ) => {
    const tokenKey = normalizeAdminTokenKey(rawToken);
    if (!tokenKey) {
      return;
    }
    if (!adminWorkspaceHydratedRef.current) {
      pendingAdminTokenRef.current = tokenKey;
      pendingAdminTokenOptionsRef.current = {
        preserveBackendSession: Boolean(options?.preserveBackendSession),
      };
      return;
    }
    setActiveAdminTokenKey(tokenKey);
    hydrateAdminWorkspaceForToken(tokenKey, options);
  };

  const resetAdminWorkspaceState = (options?: { preserveBackendSession?: boolean }) => {
    applyAdminWorkspaceEntry(buildDefaultAdminWorkspaceEntry(), options);
    setBackendMonitorError("");
    setTokenActivityLogsByToken({});
    adminMonitorLastQuizRefreshAtRef.current = 0;
    tokenMonitorSnapshotRef.current = {};
    setRevokeTokenInput("");
    setRevokeTokenStatus(
      tr(language, "Masukkan token siswa untuk revoke.", "Enter a student token to revoke.")
    );
    setReactivateTokenInput("");
    setReactivateTokenStatus(
      tr(language, "Masukkan token siswa untuk reaktivasi.", "Enter a student token to reactivate.")
    );
    setSessionControlStatus(tr(language, "Kontrol sesi siap.", "Session control ready."));
  };

  const clearAdminWorkspaceCache = () => {
    adminWorkspaceCacheRef.current = {
      version: ADMIN_WORKSPACE_SCHEMA_VERSION,
      backendBaseUrl,
      admins: {},
    };
    legacyAdminWorkspaceRef.current = null;
    pendingAdminTokenRef.current = null;
    pendingAdminTokenOptionsRef.current = null;
    runSecurityCall(() => securityModule?.clearAdminWorkspaceCache?.());
  };

  const appendUpdateLog = (line: string) => {
    const normalized = line.trim();
    if (!normalized) {
      return;
    }
    setUpdateLogs((current) => {
      if (current[current.length - 1] === normalized) {
        return current;
      }
      return [...current.slice(-4), normalized];
    });
  };

  const applyRemoteConfigPayload = (nextConfig: RemoteConfigPayload) => {
    setRemoteConfig(nextConfig);
    const values = nextConfig.values ?? {};
    const nextBanner = typeof values.statusBanner === "string" ? values.statusBanner.trim() : "";
    setStatusBanner(nextBanner);

    const nextAllowManualThemeSelection =
      typeof values.allowManualThemeSelection === "boolean" ? values.allowManualThemeSelection : true;
    setAllowManualThemeSelection(nextAllowManualThemeSelection);

    const preferredTheme = typeof values.preferredThemeId === "string" ? values.preferredThemeId.trim() : "";
    if (preferredTheme && themePresets.some((preset) => preset.id === preferredTheme)) {
      const typedThemeId = preferredTheme as ThemeId;
      setThemeId(typedThemeId);
      setActiveTheme(typedThemeId);
    }

    const previousRemoteBackend =
      typeof remoteConfig.values.defaultBackendBaseUrl === "string"
        ? normalizeBackendBaseUrl(remoteConfig.values.defaultBackendBaseUrl)
        : "";
    const remoteBackend =
      typeof values.defaultBackendBaseUrl === "string"
        ? normalizeBackendBaseUrl(values.defaultBackendBaseUrl)
        : "";
    if (
      remoteBackend &&
      (!normalizeBackendBaseUrl(backendBaseUrl) ||
        normalizeBackendBaseUrl(backendBaseUrl) === DEFAULT_BACKEND_BASE_URL ||
        normalizeBackendBaseUrl(backendBaseUrl) === previousRemoteBackend)
    ) {
      setBackendBaseUrl(remoteBackend);
    }
  };

  const finishUpdateFlow = () => {
    setUpdateBusy(false);
    setUpdatePrimaryAction(null);
    setUpdateSecondaryAction(null);
    setScreen(updateReturnScreen);
  };

  const beginUpdateFlow = (mode: UpdateFlowMode, nextReturnScreen: ScreenId) => {
    setUpdateMode(mode);
    setUpdateReturnScreen(nextReturnScreen);
    setUpdateSnapshot(null);
    setUpdateBusy(true);
    setUpdateProgressState(
      createDefaultUpdateProgress(
        mode === "startup" ? "Preparing boot-time updater..." : "Preparing manual update check..."
      )
    );
    setUpdateLogs(["Boot channel armed.", "Awaiting manifest sync."]);
    setUpdatePrimaryAction(null);
    setUpdateSecondaryAction(null);
    setScreen("UpdateScreen");
    setUpdateRunId((current) => current + 1);
  };

  const runNativeInstallFlow = async (mandatory = false) => {
    setUpdateBusy(true);
    setUpdatePrimaryAction(null);
    setUpdateSecondaryAction(null);
    try {
      const nextSnapshot = await startNativeUpdate();
      setUpdateSnapshot(nextSnapshot);
      if (nextSnapshot.native.installerPermissionGranted) {
        setUpdatePrimaryAction(mandatory ? "install_downloaded_native" : "continue");
        setUpdateSecondaryAction(mandatory ? null : "install_downloaded_native");
      } else {
        setUpdatePrimaryAction("open_unknown_sources");
        setUpdateSecondaryAction(mandatory ? "install_downloaded_native" : "continue");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : tr(language, "Update native gagal.", "Native update failed.");
      setUpdateProgressState({
        ...createDefaultUpdateProgress(message),
        stage: "error",
        kind: "native",
        progress: 1,
      });
      appendUpdateLog(message);
      setUpdatePrimaryAction("retry");
      setUpdateSecondaryAction("continue");
    } finally {
      setUpdateBusy(false);
    }
  };

  const handleUpdateAction = async (action: UpdateActionId | null) => {
    if (!action) {
      return;
    }
    if (action === "continue") {
      finishUpdateFlow();
      return;
    }
    if (action === "retry") {
      beginUpdateFlow(updateMode, updateReturnScreen);
      return;
    }
    if (action === "restart") {
      restartApp();
      return;
    }
    if (action === "install_native") {
      await runNativeInstallFlow();
      return;
    }
    if (action === "install_downloaded_native") {
      setUpdateBusy(true);
      try {
        const launched = await installDownloadedNativeUpdate();
        if (launched) {
          appendUpdateLog("Android installer relaunched.");
          setUpdatePrimaryAction(updateSnapshot?.native.mandatory ? "install_downloaded_native" : "continue");
        } else {
          appendUpdateLog("No downloaded APK is ready yet.");
        }
      } catch (error) {
        appendUpdateLog(error instanceof Error ? error.message : "Failed to launch APK installer.");
      } finally {
        setUpdateBusy(false);
      }
      return;
    }
    if (action === "open_unknown_sources") {
      setUpdateBusy(true);
      try {
        await openUnknownAppSourcesSettings();
        appendUpdateLog("Opened Android unknown app sources settings.");
      } catch (error) {
        appendUpdateLog(error instanceof Error ? error.message : "Failed to open permission settings.");
      } finally {
        setUpdateBusy(false);
      }
    }
  };

  const updateActionLabel = (action: UpdateActionId | null): string | undefined => {
    if (!action) {
      return undefined;
    }
    if (action === "continue") {
      return tr(language, "Lanjutkan", "Continue");
    }
    if (action === "retry") {
      return tr(language, "Coba Lagi", "Retry");
    }
    if (action === "restart") {
      return tr(language, "Restart Aplikasi", "Restart App");
    }
    if (action === "install_native") {
      return tr(language, "Install Update Native", "Install Native Update");
    }
    if (action === "install_downloaded_native") {
      return tr(language, "Buka Installer Lagi", "Open Installer Again");
    }
    if (action === "open_unknown_sources") {
      return tr(language, "Izinkan Install APK", "Allow APK Installs");
    }
    return undefined;
  };

  useEffect(() => {
    confirmCurrentBundleReady();
    const subscription = subscribeToUpdateProgress((payload) => {
      setUpdateProgressState(payload);
      const nextMessage = payload.message.trim();
      if (!nextMessage) {
        return;
      }
      setUpdateLogs((current) => {
        if (current[current.length - 1] === nextMessage) {
          return current;
        }
        return [...current.slice(-4), nextMessage];
      });
    });
    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (screen !== "UpdateScreen" || updateRunId <= 0) {
      return;
    }
    let active = true;
    let continueTimer: ReturnType<typeof setTimeout> | null = null;

    const run = async () => {
      setUpdateBusy(true);
      setUpdatePrimaryAction(null);
      setUpdateSecondaryAction(null);

      try {
        const snapshot = await checkForUpdates(normalizeBackendBaseUrl(backendBaseUrl));
        if (!active) {
          return;
        }
        setUpdateSnapshot(snapshot);
        applyRemoteConfigPayload(snapshot.remoteConfig);
        appendUpdateLog(`Remote config ${snapshot.remoteConfig.version} synchronized.`);

        if (snapshot.ota.available) {
          appendUpdateLog(`OTA package detected: ${snapshot.ota.version ?? "unknown"}.`);
          const otaSnapshot = await startOtaUpdate();
          if (!active) {
            return;
          }
          setUpdateSnapshot(otaSnapshot);
          setUpdateBusy(false);
          setUpdatePrimaryAction("restart");
          setUpdateSecondaryAction(null);
          appendUpdateLog("React Native package staged. Restart required.");
          return;
        }

        if (snapshot.native.available) {
          if (snapshot.native.mandatory) {
            appendUpdateLog(`Mandatory native release detected: ${snapshot.native.versionName ?? "unknown"}.`);
            await runNativeInstallFlow(true);
            return;
          }

          setUpdateBusy(false);
          setUpdatePrimaryAction("install_native");
          setUpdateSecondaryAction("continue");
          appendUpdateLog(`Optional native release available: ${snapshot.native.versionName ?? "unknown"}.`);
          setUpdateProgressState({
            ...createDefaultUpdateProgress("Optional native shell update is available."),
            stage: "ready",
            kind: "native",
            progress: 1,
            versionLabel: snapshot.native.versionName ?? "",
          });
          return;
        }

        setUpdateBusy(false);
        setUpdateProgressState({
          ...createDefaultUpdateProgress(
            updateMode === "startup"
              ? "System synchronized. Continuing boot sequence..."
              : "System synchronized. No newer package is available."
          ),
          stage: "completed",
          kind: "manifest",
          progress: 1,
        });
        appendUpdateLog("Runtime is already current.");

        if (updateMode === "startup") {
          continueTimer = setTimeout(() => {
            if (active) {
              finishUpdateFlow();
            }
          }, 720);
        } else {
          setUpdatePrimaryAction("continue");
        }
      } catch (error) {
        if (!active) {
          return;
        }
        const message =
          error instanceof Error
            ? error.message
            : tr(language, "Gagal memeriksa update.", "Failed to check for updates.");
        setUpdateBusy(false);
        setUpdateProgressState({
          ...createDefaultUpdateProgress(message),
          stage: "error",
          kind: "manifest",
          progress: 1,
        });
        appendUpdateLog(message);
        setUpdatePrimaryAction("retry");
        setUpdateSecondaryAction(updateMode === "startup" ? "continue" : null);
      }
    };

    void run();

    return () => {
      active = false;
      if (continueTimer) {
        clearTimeout(continueTimer);
      }
    };
  }, [screen, updateRunId]);

  useEffect(() => {
    let mounted = true;
    const hydrateKiosk = async () => {
      try {
        const [
          nativeKiosk,
          nativeViolationSystem,
          nativeSplitScreen,
          nativeScreenshotAccessibility,
        ] = await Promise.all([
          securityModule?.getKioskEnabled?.(),
          securityModule?.getViolationSystemEnabled?.(),
          securityModule?.getSplitScreenDetectionEnabled?.(),
          securityModule?.getScreenshotAccessibilityEnabled?.(),
        ]);
        if (!mounted) {
          return;
        }
        if (typeof nativeKiosk === "boolean") {
          setKioskEnabled(nativeKiosk);
        }
        if (typeof nativeViolationSystem === "boolean") {
          setViolationSystemEnabled(nativeViolationSystem);
        }
        if (typeof nativeSplitScreen === "boolean") {
          setSplitScreenDetectionEnabled(nativeSplitScreen);
        }
        if (typeof nativeScreenshotAccessibility === "boolean") {
          setScreenshotAccessibilityEnabled(nativeScreenshotAccessibility);
        }
      } catch {
        // Keep default values when native bridge is unavailable.
      } finally {
        if (mounted) {
          setKioskReady(true);
        }
      }
    };
    void hydrateKiosk();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const hydrateDeviceFingerprint = async () => {
      try {
        const nativeFingerprint = await securityModule?.getDeviceFingerprint?.();
        const normalized = String(nativeFingerprint ?? "").trim();
        if (mounted && normalized) {
          setDeviceFingerprint(normalized);
        }
      } catch {
        // Keep fallback fingerprint string when native bridge is unavailable.
      }
    };
    void hydrateDeviceFingerprint();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const hydrateAdminWorkspace = async () => {
      try {
        const rawSnapshot = await securityModule?.getAdminWorkspaceCache?.();
        if (!mounted) {
          return;
        }
        const parsed = JSON.parse(String(rawSnapshot ?? "{}")) as
          | Partial<AdminWorkspaceCache>
          | Partial<AdminWorkspaceSnapshotV1>;
        const version = Number((parsed as { version?: unknown })?.version ?? 0);
        if (version === 2 && isRecord(parsed)) {
          const backendUrl =
            typeof parsed.backendBaseUrl === "string" ? parsed.backendBaseUrl.trim() : "";
          const normalizedBackendUrl = backendUrl ? normalizeBackendBaseUrl(backendUrl) : "";
          if (normalizedBackendUrl) {
            setBackendBaseUrl(normalizedBackendUrl);
          }
          adminWorkspaceCacheRef.current = {
            version: ADMIN_WORKSPACE_SCHEMA_VERSION,
            backendBaseUrl: normalizedBackendUrl || adminWorkspaceCacheRef.current.backendBaseUrl,
            admins: isRecord(parsed.admins)
              ? (parsed.admins as Record<string, AdminWorkspaceEntry>)
              : {},
          };
        } else if (version === 1 && isRecord(parsed)) {
          const legacy = parsed as AdminWorkspaceSnapshotV1;
          if (typeof legacy.backendBaseUrl === "string" && legacy.backendBaseUrl.trim()) {
            setBackendBaseUrl(normalizeBackendBaseUrl(legacy.backendBaseUrl.trim()));
          }
          legacyAdminWorkspaceRef.current = normalizeAdminWorkspaceEntry(legacy);
        }
      } catch {
        // Ignore invalid/empty cache payload and continue with runtime defaults.
      } finally {
        adminWorkspaceHydratedRef.current = true;
        if (pendingAdminTokenRef.current) {
          const token = pendingAdminTokenRef.current;
          const options = pendingAdminTokenOptionsRef.current ?? undefined;
          pendingAdminTokenRef.current = null;
          pendingAdminTokenOptionsRef.current = null;
          setActiveAdminTokenKey(token);
          hydrateAdminWorkspaceForToken(token, options ?? undefined);
        }
      }
    };
    void hydrateAdminWorkspace();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!adminWorkspaceHydratedRef.current) {
      return;
    }
    const cache = adminWorkspaceCacheRef.current;
    const nextAdmins =
      role === "admin" && activeAdminTokenKey
        ? { ...cache.admins, [activeAdminTokenKey]: buildAdminWorkspaceEntry() }
        : cache.admins;
    const nextCache: AdminWorkspaceCache = {
      version: ADMIN_WORKSPACE_SCHEMA_VERSION,
      backendBaseUrl,
      admins: nextAdmins,
    };
    adminWorkspaceCacheRef.current = nextCache;
    runSecurityCall(() =>
      securityModule?.setAdminWorkspaceCache?.(JSON.stringify(nextCache))
    );
  }, [
    adminBackendAccessSignature,
    adminBackendBindingId,
    adminBackendSessionId,
    backendBaseUrl,
    role,
    activeAdminTokenKey,
    sessionMode,
    activeExamMode,
    backendMonitorItems,
    generatedToken,
    generatedTokenBatch,
    generatedTokenExpiryAt,
    issuedTokens,
    proctorPin,
    proctorPinEffectiveDate,
    studentTokenAdminContexts,
    tokenBatchCount,
    tokenExpiryMinutes,
    tokenLaunchPolicies,
    tokenLaunchUrlInput,
    tokenPinPolicies,
    quizBuilderCache,
    quizTeacherCache,
  ]);

  useEffect(() => {
    runSecurityCall(() =>
      securityModule?.setStartupPermissionGateActive?.(startupPermissionGateActive)
    );
  }, [startupPermissionGateActive]);

  useEffect(() => {
    if (!kioskReady) {
      return;
    }
    runSecurityCall(() => securityModule?.setKioskEnabled?.(runtimeKioskEnabled));
    runSecurityCall(() => securityModule?.setViolationSystemEnabled?.(violationSystemEnabled));
    runSecurityCall(() => securityModule?.setSplitScreenDetectionEnabled?.(splitScreenDetectionEnabled));
    runSecurityCall(() =>
      securityModule?.setScreenshotAccessibilityEnabled?.(screenshotAccessibilityEnabled)
    );
  }, [
    kioskReady,
    runtimeKioskEnabled,
    screenshotAccessibilityEnabled,
    splitScreenDetectionEnabled,
    violationSystemEnabled,
  ]);

  useEffect(() => {
    setActiveTheme(themeId);
  }, [themeId]);

  useEffect(() => {
    if (screen !== "ExamBrowserScreen") {
      runSecurityCall(() => securityModule?.setPinEntryFocusBypass?.(false));
      return undefined;
    }
    const timer = setInterval(() => {
      const stamp = new Date()
        .toISOString()
        .replace("T", " ")
        .slice(0, 19);
      setOverlayTimestamp(stamp);
    }, 1000);
    return () => clearInterval(timer);
  }, [screen]);

  useEffect(() => {
    if (!violationSystemEnabled) {
      return;
    }
    if (
      riskScore >= 12 &&
      role === "student" &&
      (screen === "ExamBrowserScreen" || screen === "QuizStudentScreen")
    ) {
      setViolationReason(
        tr(
          language,
          "Ambang risk score terlewati. Sesi dikunci untuk tinjauan proktor.",
          "Risk score threshold exceeded. Session locked for proctor review."
        )
      );
      setScreen("ViolationScreen");
    }
  }, [language, riskScore, role, screen, violationSystemEnabled]);

  useEffect(() => {
    if (screen === "ViolationScreen" && violationSystemEnabled) {
      runSecurityCall(() => securityModule?.triggerViolationAlarm?.());
      return;
    }
    runSecurityCall(() => securityModule?.stopViolationAlarm?.());
  }, [screen, violationSystemEnabled]);

  useEffect(() => {
    const tokenKey = generatedToken.trim().toUpperCase();
    if (!tokenKey) {
      setTokenLaunchUrlInput("");
      return;
    }
    const existing = tokenLaunchPolicies[tokenKey];
    setTokenLaunchUrlInput(existing?.url ?? "");
  }, [generatedToken, tokenLaunchPolicies]);

  useEffect(() => {
    if (role === "guest" || !sessionExpiresAt) {
      setSessionTimeLeftLabel("--:--:--");
      setSessionExpiryHandled(false);
      return undefined;
    }

    const tick = () => {
      const remaining = sessionExpiresAt - Date.now();
      setSessionTimeLeftLabel(formatRemainingDuration(remaining));

      if (remaining <= 0 && !sessionExpiryHandled) {
        const message = tr(
          language,
          "Waktu session token habis. Anda akan keluar otomatis.",
          "Session token time has expired. You will be exited automatically."
        );
        setSessionExpiryHandled(true);
        setStatusMessage(message);
        setViolationReason(message);
        addLog("Session token expired. Auto-exit triggered.");
        setScreen("ViolationScreen");
        Alert.alert(
          tr(language, "Waktu Habis", "Time Expired"),
          message
        );
        setTimeout(() => BackHandler.exitApp(), 1800);
      }
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [language, role, sessionExpiresAt, sessionExpiryHandled]);

  useEffect(() => {
    if (role !== "student") {
      runSecurityCall(() => securityModule?.stopHeartbeat?.());
      runSecurityCall(() => securityModule?.clearSession?.());
      return;
    }

    const tokenForSync = (activeStudentToken || tokenInput).trim().toUpperCase();
    if (!tokenForSync) {
      return;
    }

    const sessionIdForSync = sessionId || `RN-${Date.now()}`;
    const signatureForSync = studentBackendAccessSignature.trim();
    const bindingForSync = studentBackendBindingId.trim();
    const examActiveScreen =
      screen === "ExamBrowserScreen" || screen === "QuizStudentScreen";
    const examUrlForSync =
      screen === "QuizStudentScreen"
        ? `edufika://in-app-quiz/${sessionIdForSync}`
        : examUrl;

    runSecurityCall(() =>
      securityModule?.syncStudentSession?.(
        tokenForSync,
        sessionIdForSync,
        signatureForSync || `rn-local-signature-${tokenForSync}`,
        bindingForSync || `rn-local-binding-${tokenForSync}`,
        sessionExpiresAt ?? 0,
        examUrlForSync,
        examActiveScreen
      )
    );

    if (examActiveScreen && signatureForSync && bindingForSync && violationSystemEnabled) {
      runSecurityCall(() => securityModule?.startHeartbeat?.());
    } else {
      runSecurityCall(() => securityModule?.stopHeartbeat?.());
    }
  }, [
    activeStudentToken,
    examUrl,
    role,
    screen,
    sessionExpiresAt,
    sessionId,
    studentBackendAccessSignature,
    studentBackendBindingId,
    tokenInput,
    violationSystemEnabled,
  ]);

  useEffect(() => {
    if (
      screen !== "AdminDashboardPanel" ||
      (adminDashboardTab !== "monitor" && adminDashboardTab !== "logs")
    ) {
      return undefined;
    }
    if (!adminBackendSessionId || !adminBackendAccessSignature) {
      return undefined;
    }

    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const scheduleNextPoll = (delayMs: number) => {
      if (!active) {
        return;
      }
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        void poll();
      }, delayMs);
    };

    const poll = async () => {
      if (!active) {
        return;
      }
      if (adminMonitorFetchInFlightRef.current) {
        scheduleNextPoll(ADMIN_MONITOR_REFRESH_INTERVAL_MS);
        return;
      }

      adminMonitorFetchInFlightRef.current = true;
      const success = await loadAdminMonitor();
      adminMonitorFetchInFlightRef.current = false;
      scheduleNextPoll(success ? ADMIN_MONITOR_REFRESH_INTERVAL_MS : ADMIN_MONITOR_RETRY_INTERVAL_MS);
    };

    void poll();

    return () => {
      active = false;
      adminMonitorFetchInFlightRef.current = false;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [
    screen,
    adminDashboardTab,
    adminBackendSessionId,
    adminBackendAccessSignature,
    backendBaseUrl,
  ]);

  const addLog = useCallback((message: string) => {
    setLogs((prev) => [makeLogLine(message), ...prev].slice(0, 120));
  }, []);

  const appendTokenActivityLog = useCallback(
    (
      token: string,
      message: string,
      tone: TokenActivityLogItem["tone"],
      extra?: Partial<Omit<TokenActivityLogItem, "id" | "token" | "timestampLabel" | "message" | "tone">>
    ) => {
      const normalizedToken = token.trim().toUpperCase();
      if (!normalizedToken || !message.trim()) {
        return;
      }
      setTokenActivityLogsByToken((prev) => ({
        ...prev,
        [normalizedToken]: [
          buildTokenActivityLogEntry(normalizedToken, message, tone, extra),
          ...(prev[normalizedToken] ?? []),
        ].slice(0, 60),
      }));
    },
    []
  );

  const recordTokenMonitorSnapshot = useCallback(
    (items: AdminTokenMonitorItem[]) => {
      const previousMap = tokenMonitorSnapshotRef.current;
      const nextMap: Record<string, AdminTokenMonitorItem> = {};

      items.forEach((item) => {
        const tokenKey = item.token.trim().toUpperCase();
        if (!tokenKey) {
          return;
        }

        nextMap[tokenKey] = item;
        const previous = previousMap[tokenKey];

        const statusMessage =
          item.status === "online"
            ? previous
              ? tr(language, "Siswa kembali aktif di layar ujian.", "Student is active on the exam screen again.")
              : tr(language, "Siswa aktif di layar ujian.", "Student is active on the exam screen.")
            : item.status === "offline"
              ? previous
                ? tr(
                    language,
                    "Siswa terputus dari sesi aktif atau meninggalkan layar ujian.",
                    "Student disconnected from the active session or left the exam screen."
                  )
                : tr(
                    language,
                    "Siswa sedang terputus dari sesi aktif.",
                    "Student is currently disconnected from the active exam session."
                  )
              : item.status === "revoked"
                ? tr(
                    language,
                    `Token dikunci${item.lockReason ? `: ${item.lockReason}` : "."}`,
                    `Token was locked${item.lockReason ? `: ${item.lockReason}` : "."}`
                  )
                : item.status === "expired"
                  ? tr(language, "Token telah kadaluarsa.", "Token has expired.")
                  : previous
                    ? tr(
                        language,
                        "Token siap diklaim ulang oleh siswa.",
                        "Token is ready to be claimed again by a student."
                      )
                    : tr(language, "Token menunggu klaim siswa.", "Token is waiting for a student claim.");

        if (!previous) {
          appendTokenActivityLog(tokenKey, statusMessage, item.status === "revoked" ? "danger" : "neutral", {
            activityState: item.activityState,
            violationType: item.latestViolationType || undefined,
            examWebsite: item.launchUrl || undefined,
          });
        } else if (
          previous.status !== item.status ||
          previous.activityState !== item.activityState ||
          previous.sessionState !== item.sessionState
        ) {
          appendTokenActivityLog(
            tokenKey,
            statusMessage,
            item.status === "revoked"
              ? "danger"
              : item.status === "offline"
                ? "warning"
                : item.status === "online"
                  ? "success"
                  : "neutral",
            {
              activityState: item.activityState,
              violationType: item.latestViolationType || undefined,
              examWebsite: item.launchUrl || undefined,
            }
          );
        }

        const previousViolationSignature = previous
          ? [previous.latestViolationType, previous.latestViolationAtLabel, previous.latestViolationDetail].join("|")
          : "";
        const currentViolationSignature = [
          item.latestViolationType,
          item.latestViolationAtLabel,
          item.latestViolationDetail,
        ].join("|");
        if (
          item.latestViolationType &&
          currentViolationSignature !== previousViolationSignature
        ) {
          appendTokenActivityLog(
            tokenKey,
            tr(
              language,
              `Pelanggaran terdeteksi: ${item.latestViolationType}${item.latestViolationDetail ? ` (${item.latestViolationDetail})` : ""}`,
              `Violation detected: ${item.latestViolationType}${item.latestViolationDetail ? ` (${item.latestViolationDetail})` : ""}`
            ),
            "warning",
            {
              activityState: item.activityState,
              violationType: item.latestViolationType,
              examWebsite: item.launchUrl || undefined,
            }
          );
        }

        if (item.launchUrl && item.launchUrl !== previous?.launchUrl) {
          appendTokenActivityLog(
            tokenKey,
            tr(
              language,
              `Website ujian aktif: ${item.launchUrl}`,
              `Active exam website: ${item.launchUrl}`
            ),
            "success",
            {
              activityState: item.activityState,
              examWebsite: item.launchUrl,
            }
          );
        }
      });

      tokenMonitorSnapshotRef.current = nextMap;
    },
    [appendTokenActivityLog, language]
  );

  const recordViolation = useCallback(
    (detail: string, riskDelta: number, source: "risk" | "native_lock") => {
      const trimmedDetail = detail.trim();
      if (!trimmedDetail) {
        return;
      }
      setViolationHistory((prev) => [
        {
          timestamp: new Date().toISOString(),
          type: classifyViolationType(trimmedDetail),
          detail: trimmedDetail,
          riskDelta,
          source,
        },
        ...prev,
      ].slice(0, 40));
    },
    []
  );

  const resetViolationAudit = useCallback(() => {
    setRiskScore(0);
    setShowIntegrityWarning(false);
    setIntegrityMessage(
      tr(
        language,
        "Perilaku mencurigakan terdeteksi. Aktivitas tercatat untuk proktor.",
        "Suspicious behavior detected. Activity has been logged for proctor review."
      )
    );
    setViolationHistory([]);
  }, [language]);

  useEffect(() => {
    const lockSubscription = DeviceEventEmitter.addListener(
      "EdufikaSessionLocked",
      (payload: { reason?: string }) => {
        if (!violationSystemEnabled) {
          addLog("Native lock event ignored: violation system disabled.");
          return;
        }
        const reason =
          typeof payload?.reason === "string" && payload.reason.trim()
            ? payload.reason.trim()
            : tr(
                language,
                "Session dikunci oleh sistem keamanan.",
                "Session has been locked by security system."
              );
        runSecurityCall(() => securityModule?.triggerViolationAlarm?.());
        const activeToken = activeStudentToken.trim().toUpperCase();
        if (role === "student" && activeToken) {
          updateIssuedToken(activeToken, {
            status: "revoked",
            revokedReason: "SECURITY_LOCK",
            lastSeenAt: Date.now(),
          });
        }
        const base = normalizeBackendBaseUrl(backendBaseUrl);
        if (role === "student" && base && sessionId && studentBackendAccessSignature.trim()) {
          void fetch(`${base}/session/event`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              session_id: sessionId,
              access_signature: studentBackendAccessSignature.trim(),
              event_type: "MULTI_WINDOW",
              detail: reason,
              severity: 10,
            }),
          }).catch(() => {
            // Best-effort telemetry; UI lock path must not depend on network.
          });
        }
        setViolationReason(reason);
        setIntegrityMessage(reason);
        setShowIntegrityWarning(true);
        recordViolation(reason, 10, "native_lock");
        setLogs((prev) => [makeLogLine(`Native lock event: ${reason}`), ...prev].slice(0, 120));
        setScreen("ViolationScreen");
      }
    );

    const heartbeatSubscription = DeviceEventEmitter.addListener(
      "EdufikaHeartbeatStatus",
      (payload: { message?: string; state?: string }) => {
        const message = typeof payload?.message === "string" ? payload.message : "";
        if (!message) {
          return;
        }
        const state = typeof payload?.state === "string" ? payload.state : "";
        setLogs((prev) =>
          [makeLogLine(`Heartbeat ${state || "ACTIVE"}: ${message}`), ...prev].slice(0, 120)
        );
      }
    );

    return () => {
      lockSubscription.remove();
      heartbeatSubscription.remove();
    };
  }, [
    activeStudentToken,
    backendBaseUrl,
    language,
    recordViolation,
    role,
    sessionId,
    studentBackendAccessSignature,
    violationSystemEnabled,
  ]);

  useEffect(() => {
    const shouldWatchMultiWindow =
      role === "student" &&
      (screen === "ExamBrowserScreen" || screen === "QuizStudentScreen") &&
      violationSystemEnabled &&
      splitScreenDetectionEnabled;
    if (!shouldWatchMultiWindow || !securityModule?.checkAndLockIfMultiWindow) {
      multiWindowWatchLoggedRef.current = false;
      return undefined;
    }

    let active = true;
    const probe = async () => {
      if (!active) {
        return;
      }
      try {
        const locked = await securityModule.checkAndLockIfMultiWindow?.();
        if (locked && !multiWindowWatchLoggedRef.current) {
          multiWindowWatchLoggedRef.current = true;
          addLog("Native watchdog detected multi-window. Lock/alarm triggered.");
        }
      } catch {
        // Ignore probe failures and keep UI responsive.
      }
    };

    void probe();
    const timer = setInterval(() => {
      void probe();
    }, 1200);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [role, screen, splitScreenDetectionEnabled, violationSystemEnabled]);

  const resolveIssuedTokenStatus = (entry: IssuedToken): IssuedTokenStatus => {
    if (entry.status === "revoked") {
      return "revoked";
    }
    if (Date.now() >= entry.expiresAt) {
      return "expired";
    }
    return entry.status;
  };

  const updateIssuedToken = (token: string, patch: Partial<IssuedToken>) => {
    const normalizedToken = token.trim().toUpperCase();
    if (!normalizedToken) {
      return;
    }
    setIssuedTokens((prev) =>
      prev.map((entry) =>
        entry.token.toUpperCase() === normalizedToken
          ? {
              ...entry,
              ...patch,
              lastSeenAt: patch.lastSeenAt ?? Date.now(),
            }
          : entry
      )
    );
  };

  const markActiveIssuedTokenOffline = () => {
    const token = activeIssuedToken.trim().toUpperCase();
    if (!token) {
      return;
    }
    setIssuedTokens((prev) =>
      prev.map((entry) => {
        if (entry.token.toUpperCase() !== token) {
          return entry;
        }
        if (entry.status === "revoked") {
          return entry;
        }
        return {
          ...entry,
          status: "offline",
          lastSeenAt: Date.now(),
        };
      })
    );
    setActiveIssuedToken("");
  };

  const parseJsonResponse = async (response: any): Promise<any> => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      let message =
        typeof payload?.error === "string"
          ? payload.error
          : `HTTP ${response.status}`;
      if (response.status === 404 && typeof payload?.error !== "string") {
        message = tr(
          language,
          "Endpoint tidak ditemukan. Periksa URL backend.",
          "Endpoint not found. Check backend URL."
        );
      }
      throw new Error(message);
    }
    return payload;
  };

  const refreshDriveHealth = useCallback(
    async (source: string = "app-flow") => {
      const base = normalizeBackendBaseUrl(backendBaseUrl);
      if (!base) {
        setDriveHealth({
          loading: false,
          checked: true,
          connected: false,
          configured: false,
          folderName: "",
          folderId: "",
          authMode: "",
          scope: "",
          error: tr(language, "URL backend kosong.", "Backend URL is empty."),
          lastCheckedAt: Date.now(),
        });
        return;
      }

      setDriveHealth((prev) => ({
        ...prev,
        loading: true,
      }));

      try {
        const payload: DriveHealthResult = await fetchGoogleDriveHealth(base);
        setDriveHealth({
          loading: false,
          checked: true,
          connected: payload.connected === true,
          configured: payload.configured === true,
          folderName: payload.folder_name ?? "",
          folderId: payload.folder_id ?? "",
          authMode: payload.auth_mode ?? "",
          scope: payload.scope ?? "",
          error: payload.error ?? "",
          lastCheckedAt: Date.now(),
        });
        addLog(
          `Google Drive health check (${source}): ${payload.connected ? "connected" : "failed"}${
            payload.folder_name ? ` | folder=${payload.folder_name}` : ""
          }${payload.error ? ` | error=${payload.error}` : ""}`
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setDriveHealth({
          loading: false,
          checked: true,
          connected: false,
          configured: false,
          folderName: "",
          folderId: "",
          authMode: "",
          scope: "",
          error: message,
          lastCheckedAt: Date.now(),
        });
        addLog(`Google Drive health check failed (${source}): ${message}`);
      }
    },
    [addLog, backendBaseUrl, language]
  );

  useEffect(() => {
    if (
      screen !== "ExamSelectionScreen" &&
      screen !== "InAppQuizSelection" &&
      screen !== "QuizStudentScreen"
    ) {
      return;
    }
    void refreshDriveHealth(screen);
  }, [refreshDriveHealth, screen]);

  const loadAdminMonitor = async (): Promise<boolean> => {
    const base = normalizeBackendBaseUrl(backendBaseUrl);
    if (!base || !adminBackendSessionId || !adminBackendAccessSignature) {
      return false;
    }

    const mapMonitorTokens = (remoteTokens: BackendMonitorToken[]): AdminTokenMonitorItem[] => {
      return remoteTokens
        .map((entry) => {
          const tokenValue = String(entry.token ?? "")
            .trim()
            .toUpperCase();
          if (!tokenValue) {
            return null;
          }
          const rawStatus = String(entry.status ?? "issued").toLowerCase();
          const normalizedStatus: "issued" | "online" | "offline" | "revoked" | "expired" =
            rawStatus === "online" ||
            rawStatus === "offline" ||
            rawStatus === "revoked" ||
            rawStatus === "expired"
              ? rawStatus
              : "issued";
          const roleRaw = String(entry.role ?? "student").toLowerCase();
          const sessionState = String(entry.sessionState ?? entry.session_state ?? "IN_PROGRESS")
            .trim()
            .toUpperCase();
          const rawActivityState = String(entry.activityState ?? entry.activity_state ?? "")
            .trim()
            .toLowerCase();
          const activityState: TokenActivityState =
            rawActivityState === "on_exam_screen" ||
            rawActivityState === "disconnected" ||
            rawActivityState === "revoked" ||
            rawActivityState === "expired" ||
            rawActivityState === "paused"
              ? rawActivityState
              : "waiting_claim";
          const lockReason = String(entry.lockReason ?? entry.lock_reason ?? "").trim();
          const launchUrl = String(entry.launchUrl ?? entry.launch_url ?? "").trim();
          const latestViolationType = String(
            entry.latestViolationType ?? entry.latest_violation_type ?? ""
          )
            .trim()
            .toUpperCase();
          const latestViolationDetail = String(
            entry.latestViolationDetail ?? entry.latest_violation_detail ?? ""
          ).trim();
          const latestViolationAt = String(
            entry.latestViolationAt ?? entry.latest_violation_at ?? ""
          ).trim();
          const lastSeenRaw = String(entry.lastSeenAt ?? entry.last_seen_at ?? "").trim();
          const lastSeenAtMs = lastSeenRaw ? Date.parse(lastSeenRaw) : Number.NaN;
          const staleSecondsValue = Number(
            entry.staleSeconds ?? entry.stale_seconds ?? (Number.isFinite(lastSeenAtMs) ? Math.max(0, Math.floor((Date.now() - lastSeenAtMs) / 1000)) : 0)
          );
          return {
            token: tokenValue,
            role: roleRaw === "admin" ? "admin" : "student",
            status: normalizedStatus,
            bindingId: String(entry.bindingId ?? entry.binding_id ?? "").trim(),
            ipAddress: entry.ipAddress ?? entry.ip_address ?? "-",
            deviceName:
              entry.deviceName ??
              entry.device_name ??
              tr(language, "Belum terdaftar", "Not registered yet"),
            sessionState,
            activityState,
            activitySummary: formatTokenActivitySummary(
              activityState,
              normalizedStatus,
              sessionState,
              Number.isFinite(staleSecondsValue) ? staleSecondsValue : null,
              lockReason
            ),
            launchUrl,
            lockReason,
            latestViolationType,
            latestViolationDetail,
            latestViolationAtLabel: formatIsoLabel(latestViolationAt || null),
            claimedAtLabel: formatIsoLabel(entry.claimedAt ?? entry.claimed_at ?? null),
            expiresAtLabel: formatIsoLabel(entry.expiresAt ?? entry.expires_at),
            lastSeenLabel: formatIsoLabel(lastSeenRaw || null),
            lastSeenAtMs: Number.isFinite(lastSeenAtMs) ? lastSeenAtMs : null,
            staleSeconds: Number.isFinite(staleSecondsValue) ? staleSecondsValue : null,
          };
        })
        .filter((entry): entry is AdminTokenMonitorItem => entry !== null);
    };

    const mapQuizResultsByToken = (
      rows: BackendQuizResultRow[]
    ): Record<string, QuizResultByToken> => {
      const mapped: Record<string, QuizResultByToken> = {};
      rows.forEach((row) => {
        const token = String(row.token ?? "")
          .trim()
          .toUpperCase();
        if (!token) {
          return;
        }
        mapped[token] = {
          status: String(row.status ?? "STARTED").toUpperCase(),
          score: Number(row.score ?? 0),
          maxScore: Number(row.max_score ?? 0),
          submittedAtLabel: formatIsoLabel(row.submitted_at ?? null),
          durationSeconds: Number(row.duration_seconds ?? 0),
          studentName: String(row.student_name ?? "").trim() || "-",
          studentClass: String(row.student_class ?? "").trim() || "-",
          studentElective: String(row.student_elective ?? "").trim() || "-",
        };
      });
      return mapped;
    };

    const fetchMonitorPayload = async (
      context: StudentTokenAdminContext
    ): Promise<AdminTokenMonitorItem[]> => {
      const query = new URLSearchParams({
        session_id: context.sessionId,
        // Fallback for reverse-proxy deployments that may strip Authorization header.
        access_signature: context.accessSignature,
      });
      const response = await fetch(`${base}/admin/monitor?${query.toString()}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${context.accessSignature}`,
        },
      });
      const payload = await parseJsonResponse(response);
      const remoteTokens: BackendMonitorToken[] = Array.isArray(payload.tokens) ? payload.tokens : [];
      return mapMonitorTokens(remoteTokens);
    };

    const fetchQuizResultsPayload = async (
      context: StudentTokenAdminContext
    ): Promise<Record<string, QuizResultByToken>> => {
      try {
        const query = new URLSearchParams({
          session_id: context.sessionId,
        });
        const response = await fetch(`${base}/quiz/results?${query.toString()}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${context.accessSignature}`,
          },
        });
        const payload = await parseJsonResponse(response);
        const rows: BackendQuizResultRow[] = Array.isArray(payload.results) ? payload.results : [];
        return mapQuizResultsByToken(rows);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (isBackendAuthFailure(message)) {
          throw error;
        }
        // Non-quiz sessions or unavailable quiz results should not fail monitor polling.
        return {};
      }
    };

    const fetchMonitorBundle = async (
      context: StudentTokenAdminContext
    ): Promise<{ monitorItems: AdminTokenMonitorItem[]; quizResultsMap: Record<string, QuizResultByToken> }> => {
      const monitorItems = await fetchMonitorPayload(context);
      let quizResultsMap = quizResultsByToken;
      const now = Date.now();
      if (now - adminMonitorLastQuizRefreshAtRef.current >= ADMIN_MONITOR_QUIZ_RESULTS_REFRESH_INTERVAL_MS) {
        quizResultsMap = await fetchQuizResultsPayload(context);
        adminMonitorLastQuizRefreshAtRef.current = now;
      }
      return { monitorItems, quizResultsMap };
    };

    let activeContext: StudentTokenAdminContext = {
      sessionId: adminBackendSessionId,
      accessSignature: adminBackendAccessSignature,
      bindingId: adminBackendBindingId,
    };

    try {
      const { monitorItems, quizResultsMap } = await fetchMonitorBundle(activeContext);
      setBackendMonitorItems(monitorItems);
      setQuizResultsByToken(quizResultsMap);
      setSelectedMonitorToken((prev) => {
        const normalizedPrev = prev.trim().toUpperCase();
        if (normalizedPrev && monitorItems.some((item) => item.token.trim().toUpperCase() === normalizedPrev)) {
          return prev;
        }
        return monitorItems[0]?.token ?? "";
      });
      setBackendMonitorError("");
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (isBackendAuthFailure(message) && activeContext.bindingId) {
        const refreshedContext = await reconnectAdminContext(
          activeContext,
          "RN_ADMIN_MONITOR_RECONNECT"
        );
        if (refreshedContext) {
          try {
            activeContext = refreshedContext;
            const { monitorItems, quizResultsMap } = await fetchMonitorBundle(activeContext);
            setBackendMonitorItems(monitorItems);
            setQuizResultsByToken(quizResultsMap);
            setSelectedMonitorToken((prev) => {
              const normalizedPrev = prev.trim().toUpperCase();
              if (
                normalizedPrev &&
                monitorItems.some((item) => item.token.trim().toUpperCase() === normalizedPrev)
              ) {
                return prev;
              }
              return monitorItems[0]?.token ?? "";
            });
            setBackendMonitorError("");
            return true;
          } catch (retryError) {
            const retryMessage =
              retryError instanceof Error ? retryError.message : String(retryError);
            setBackendMonitorError(retryMessage);
            addLog(`Monitor backend fetch failed after reconnect: ${retryMessage}`);
            return false;
          }
        }
      }
      setBackendMonitorError(message);
      addLog(`Monitor backend fetch failed: ${message}`);
      return false;
    }
  };

  const getStudentTokenAdminContext = (rawToken: string): StudentTokenAdminContext | null => {
    const normalizedToken = rawToken.trim().toUpperCase();
    if (!normalizedToken) {
      return null;
    }

    const direct = studentTokenAdminContexts[normalizedToken];
    if (direct) {
      return direct;
    }

    const fallbackKey = Object.keys(studentTokenAdminContexts).find(
      (key) => key.trim().toUpperCase() === normalizedToken
    );
    if (fallbackKey) {
      return studentTokenAdminContexts[fallbackKey] ?? null;
    }

    if (
      generatedToken.trim().toUpperCase() === normalizedToken &&
      adminBackendSessionId &&
      adminBackendAccessSignature
    ) {
      return {
        sessionId: adminBackendSessionId,
        accessSignature: adminBackendAccessSignature,
        bindingId: adminBackendBindingId,
      };
    }

    // Fallback: if we have an active backend admin session, use it as the auth
    // context for token-scoped sync operations (PIN/URL) in this monitored session.
    if (adminBackendSessionId && adminBackendAccessSignature) {
      return {
        sessionId: adminBackendSessionId,
        accessSignature: adminBackendAccessSignature,
        bindingId: adminBackendBindingId,
      };
    }

    return null;
  };

  const setActiveAdminContext = (context: StudentTokenAdminContext) => {
    setAdminBackendSessionId(context.sessionId);
    setAdminBackendAccessSignature(context.accessSignature);
    setAdminBackendBindingId(context.bindingId);
  };

  const isBackendAuthFailure = (message: string): boolean => {
    const normalized = message.trim().toLowerCase();
    if (!normalized) {
      return false;
    }
    return (
      normalized.includes("unauthorized") ||
      normalized.includes("forbidden") ||
      normalized.includes("invalid access signature") ||
      normalized.includes("access signature expired") ||
      normalized.includes("token expired") ||
      normalized.includes("http 401") ||
      normalized.includes("http 403")
    );
  };

  const reconnectAdminContext = async (
    context: StudentTokenAdminContext,
    reason: string
  ): Promise<StudentTokenAdminContext | null> => {
    const base = normalizeBackendBaseUrl(backendBaseUrl);
    if (!base || !context.sessionId || !context.bindingId || !context.accessSignature) {
      return null;
    }

    try {
      const reconnectResponse = await fetch(`${base}/session/reconnect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: context.sessionId,
          device_binding_id: context.bindingId,
          access_signature: context.accessSignature,
          reason,
        }),
      });
      const reconnectPayload = await parseJsonResponse(reconnectResponse);
      const refreshedSignature = String(reconnectPayload.access_signature ?? "").trim();
      if (!refreshedSignature) {
        return null;
      }

      const refreshedContext: StudentTokenAdminContext = {
        sessionId: context.sessionId,
        accessSignature: refreshedSignature,
        bindingId: context.bindingId,
      };

      setStudentTokenAdminContexts((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((tokenKey) => {
          const entry = next[tokenKey];
          if (
            entry.sessionId === context.sessionId &&
            entry.bindingId === context.bindingId
          ) {
            next[tokenKey] = refreshedContext;
          }
        });
        return next;
      });

      if (
        adminBackendSessionId === context.sessionId &&
        adminBackendBindingId === context.bindingId
      ) {
        setActiveAdminContext(refreshedContext);
      }

      return refreshedContext;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      addLog(`Admin context reconnect failed: ${message}`);
      return null;
    }
  };

  const callAdminControl = async (
    path: "/admin/pause" | "/admin/resume" | "/admin/reissue-signature"
  ): Promise<any | null> => {
    const base = normalizeBackendBaseUrl(backendBaseUrl);
    if (!base || !adminBackendSessionId || !adminBackendAccessSignature) {
      return null;
    }

    const response = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: adminBackendSessionId,
        access_signature: adminBackendAccessSignature,
      }),
    });
    return parseJsonResponse(response);
  };

  const getRoleDeviceFingerprint = (roleHint: "student" | "admin"): string => {
    const normalized = deviceFingerprint.trim() || "rn-device-unknown";
    return `${roleHint}:${normalized}`;
  };

  const bootstrapBackendAdminSession = async (
    expiryMinutes: number,
    studentTokenCount = 1,
    requestedExamMode: SessionMode = "BROWSER_LOCKDOWN"
  ): Promise<{
    sessionId: string;
    studentTokens: string[];
    studentExpiresAt: number;
    adminAccessSignature: string;
    adminBindingId: string;
    examMode: SessionMode;
  } | null> => {
    const base = normalizeBackendBaseUrl(backendBaseUrl);
    if (!base) {
      return null;
    }

    try {
      const createHeaders: Record<string, string> = { "Content-Type": "application/json" };
      if (BACKEND_ADMIN_CREATE_KEY.trim()) {
        createHeaders["x-admin-create-key"] = BACKEND_ADMIN_CREATE_KEY.trim();
      }

      const requestedTokenCount = Math.max(2, Math.min(500, studentTokenCount + 1));
      const createdResponse = await fetch(`${base}/session/create`, {
        method: "POST",
        headers: createHeaders,
        body: JSON.stringify({
          proctor_id: "AdminID",
          token_count: requestedTokenCount,
          token_ttl_minutes: expiryMinutes,
          exam_mode: requestedExamMode,
        }),
      });
      const created = await parseJsonResponse(createdResponse);
      const sessionIdFromApi = String(created.session_id ?? "");
      const createdExamMode = normalizeExamModeValue(created.exam_mode);
      const createdTokens: string[] = Array.isArray(created.tokens) ? created.tokens : [];
      const studentTokens = createdTokens
        .filter((value) => String(value).toUpperCase().startsWith("S-"))
        .map((value) => String(value).trim().toUpperCase());
      const adminToken = createdTokens.find((value) => String(value).toUpperCase().startsWith("A-")) ?? "";
      const selectedStudentTokens = studentTokens.slice(0, Math.max(1, studentTokenCount));

      if (!sessionIdFromApi || selectedStudentTokens.length === 0 || !adminToken) {
        throw new Error("Invalid create-session response");
      }

      const claimResponse = await fetch(`${base}/session/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: adminToken,
          role_hint: "admin",
          device_fingerprint: getRoleDeviceFingerprint("admin"),
          device_name: getRuntimeDeviceName("admin"),
        }),
      });
      const claimed = await parseJsonResponse(claimResponse);
      const accessSignature = String(claimed.access_signature ?? "");
      if (!accessSignature) {
        throw new Error("Missing admin access signature");
      }

      setAdminBackendSessionId(sessionIdFromApi);
      setAdminBackendAccessSignature(accessSignature);
      setAdminBackendBindingId(String(claimed.device_binding_id ?? ""));

      return {
        sessionId: sessionIdFromApi,
        studentTokens: selectedStudentTokens,
        studentExpiresAt: Date.now() + expiryMinutes * 60 * 1000,
        adminAccessSignature: accessSignature,
        adminBindingId: String(claimed.device_binding_id ?? ""),
        examMode: createdExamMode,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setBackendMonitorError(message);
      addLog(`Backend bootstrap failed: ${message}`);
      return null;
    }
  };

  const createBackendAdminToken = async (expiryMinutes: number): Promise<{
    sessionId: string;
    adminToken: string;
    adminExpiresAt: number;
  } | null> => {
    const base = normalizeBackendBaseUrl(backendBaseUrl);
    if (!base) {
      return null;
    }

    try {
      const createHeaders: Record<string, string> = { "Content-Type": "application/json" };
      if (BACKEND_ADMIN_CREATE_KEY.trim()) {
        createHeaders["x-admin-create-key"] = BACKEND_ADMIN_CREATE_KEY.trim();
      }

      const createdResponse = await fetch(`${base}/session/create`, {
        method: "POST",
        headers: createHeaders,
        body: JSON.stringify({
          proctor_id: "DeveloperAdmin",
          token_count: 2,
          token_ttl_minutes: expiryMinutes,
        }),
      });
      const created = await parseJsonResponse(createdResponse);
      const sessionIdFromApi = String(created.session_id ?? "");
      const createdTokens: string[] = Array.isArray(created.tokens) ? created.tokens : [];
      const adminToken = createdTokens.find((value) => String(value).toUpperCase().startsWith("A-")) ?? "";

      if (!sessionIdFromApi || !adminToken) {
        throw new Error("Invalid create-session response");
      }

      return {
        sessionId: sessionIdFromApi,
        adminToken: adminToken.toUpperCase(),
        adminExpiresAt: Date.now() + expiryMinutes * 60 * 1000,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setBackendMonitorError(message);
      addLog(`Backend admin token mint failed: ${message}`);
      return null;
    }
  };

  const claimBackendSession = async (
    token: string,
    roleHint?: "student" | "admin"
  ): Promise<{
    sessionId: string;
    accessSignature: string;
    bindingId: string;
    launchUrl: string;
    whitelist: string[];
    role: "student" | "admin";
    tokenExpiresAt: number | null;
    examMode: SessionMode;
  }> => {
    const base = normalizeBackendBaseUrl(backendBaseUrl);
    if (!base) {
      throw new Error("Backend URL is empty.");
    }

    const normalizedToken = token.trim().toUpperCase();
    const inferredRole: "student" | "admin" =
      roleHint ??
      (normalizedToken.startsWith("A-") ? "admin" : "student");

    const response = await fetch(`${base}/session/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: normalizedToken,
        role_hint: inferredRole,
        device_fingerprint: getRoleDeviceFingerprint(inferredRole),
        device_name: getRuntimeDeviceName(inferredRole),
      }),
    });
    const payload = await parseJsonResponse(response);
    const accessSignature = String(payload.access_signature ?? "").trim();
    const bindingId = String(payload.device_binding_id ?? "").trim();
    const sessionIdFromApi = String(payload.session_id ?? "").trim();
    const launchUrl = normalizeUrl(payload.launch_url);
    const whitelist = Array.isArray(payload.whitelist)
      ? payload.whitelist
          .map((value) => normalizeUrl(value))
          .filter((value) => value.length > 0)
      : [];
    const backendRole: "student" | "admin" =
      String(payload.role ?? "").toLowerCase() === "admin" ? "admin" : "student";
    const tokenExpiresAtRaw = String(payload.token_expires_at ?? "").trim();
    const tokenExpiresAtParsed = tokenExpiresAtRaw ? Date.parse(tokenExpiresAtRaw) : NaN;
    const tokenExpiresAt = Number.isNaN(tokenExpiresAtParsed) ? null : tokenExpiresAtParsed;
    const examMode = normalizeExamModeValue(payload.exam_mode);

    if (!accessSignature || !bindingId || !sessionIdFromApi) {
      throw new Error("Invalid backend claim response.");
    }

    return {
      sessionId: sessionIdFromApi,
      accessSignature,
      bindingId,
      launchUrl,
      whitelist,
      role: backendRole,
      tokenExpiresAt,
      examMode,
    };
  };

  const registerStudentAccount = async () => {
    const base = normalizeBackendBaseUrl(backendBaseUrl);
    if (!base) {
      setRegisterStatus(tr(language, "Backend belum terhubung.", "Backend is not connected."));
      return;
    }
    setRegisterLoading(true);
    try {
      const response = await fetch(`${base}/student/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: registerNama.trim(),
          class: registerKelas.trim(),
          elective: registerJurusan.trim(),
          username: registerUsername.trim(),
          password: registerPassword,
          school_year: registerSchoolYear.trim(),
        }),
      });
      await parseJsonResponse(response);
      setRegisterStatus(tr(language, "Registrasi berhasil. Silakan login.", "Registration successful. Please log in."));
      setStudentLoginUsername(registerUsername.trim());
      setStudentLoginPassword("");
      setScreen("UserLogin");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRegisterStatus(message);
    } finally {
      setRegisterLoading(false);
    }
  };

  const loginStudentAccount = async () => {
    const base = normalizeBackendBaseUrl(backendBaseUrl);
    if (!base) {
      setStudentAuthStatus(tr(language, "Backend belum terhubung.", "Backend is not connected."));
      return;
    }
    setStudentAuthLoading(true);
    try {
      const credentials = `${studentLoginUsername.trim()}:${studentLoginPassword}`;
      const basicToken = encodeBasicAuth(credentials);
      const response = await fetch(`${base}/student/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${basicToken}`,
        },
        body: JSON.stringify({
          username: studentLoginUsername.trim(),
          password: studentLoginPassword,
        }),
      });
      const payload = await parseJsonResponse(response);
      const token = String(payload.student_auth_token ?? "").trim();
      const student = payload.student ?? {};
      const account: StudentAccount = {
        name: String(student.name ?? ""),
        studentClass: String(student.class ?? ""),
        elective: String(student.elective ?? ""),
        username: String(student.username ?? ""),
        schoolYear: String(student.school_year ?? ""),
      };
      if (!token) {
        throw new Error("Student auth token missing.");
      }
      setStudentAuthToken(token);
      setStudentAccount(account);
      resetViolationAudit();
      setStudentAuthStatus(tr(language, "Login siswa berhasil.", "Student login successful."));
      addLog("Student authenticated via Basic Auth.");
      setScreen("InAppQuizSelection");
      await loadInAppQuizSessions(token);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStudentAuthStatus(message);
      addLog(`Student login failed: ${message}`);
    } finally {
      setStudentAuthLoading(false);
    }
  };

  const loadInAppQuizSessions = async (tokenOverride?: string) => {
    const base = normalizeBackendBaseUrl(backendBaseUrl);
    const authToken = (tokenOverride ?? studentAuthToken).trim();
    if (!base || !authToken) {
      setInAppQuizStatus(tr(language, "Token siswa belum tersedia.", "Student token is not available."));
      return;
    }
    try {
      setInAppQuizStatus(tr(language, "Memuat daftar kuis...", "Loading quiz list..."));
      const response = await fetch(`${base}/quiz/active-sessions`, {
        method: "GET",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const payload = await parseJsonResponse(response);
      const sessions = Array.isArray(payload.sessions)
        ? payload.sessions.map((item: any) => ({
            sessionId: String(item.session_id ?? ""),
            examName: String(item.exam_name ?? ""),
            quizTitle: String(item.quiz_title ?? ""),
            questionCount: Number(item.question_count ?? 0),
            durationMinutes: Number(item.duration_minutes ?? 0),
            status: String(item.status ?? ""),
            startTime: String(item.start_time ?? ""),
          }))
        : [];
      setInAppQuizSessions(sessions);
      setInAppQuizStatus(
        sessions.length > 0
          ? tr(language, "Pilih kuis untuk memulai.", "Select a quiz to start.")
          : tr(language, "Belum ada kuis aktif.", "No active quizzes yet.")
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setInAppQuizStatus(message);
      addLog(`Load in-app quiz sessions failed: ${message}`);
    }
  };

  const joinInAppQuizSession = async (session: InAppQuizSession) => {
    const base = normalizeBackendBaseUrl(backendBaseUrl);
    const authToken = studentAuthToken.trim();
    if (!base || !authToken) {
      setInAppQuizStatus(tr(language, "Token siswa belum tersedia.", "Student token is not available."));
      return;
    }
    try {
      setInAppQuizStatus(tr(language, "Menghubungkan ke sesi...", "Joining session..."));
      const response = await fetch(`${base}/quiz/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          session_id: session.sessionId,
          device_fingerprint: getRoleDeviceFingerprint("student"),
          device_name: getRuntimeDeviceName("student"),
        }),
      });
      const payload = await parseJsonResponse(response);
      const accessSignature = String(payload.access_signature ?? "").trim();
      const bindingId = String(payload.device_binding_id ?? "").trim();
      const sessionIdFromApi = String(payload.session_id ?? session.sessionId).trim();
      const token = String(payload.student_token ?? payload.token ?? "").trim();
      const tokenExpiresAtRaw = String(payload.token_expires_at ?? "").trim();
      const tokenExpiresAtParsed = tokenExpiresAtRaw ? Date.parse(tokenExpiresAtRaw) : NaN;
      const tokenExpiresAt = Number.isNaN(tokenExpiresAtParsed) ? null : tokenExpiresAtParsed;
      const examMode = normalizeExamModeValue(payload.exam_mode);

      if (!accessSignature || !bindingId || !sessionIdFromApi) {
        throw new Error("Invalid quiz join response.");
      }

      setRole("student");
      setActiveAdminTokenKey("");
      setActiveExamMode(examMode);
      setActiveIssuedToken("");
      setActiveStudentToken(token);
      setStudentBackendAccessSignature(accessSignature);
      setStudentBackendBindingId(bindingId);
      setSessionId(sessionIdFromApi);
      setSessionExpiresAt(
        tokenExpiresAt ?? Date.now() + DEFAULT_SESSION_EXPIRY_MINUTES * 60 * 1000
      );
      setSessionExpiryHandled(false);
      resetViolationAudit();
      setQuizEntryScreen("InAppQuizSelection");
      setStatusMessage(tr(language, "Login siswa berhasil.", "Student login successful."));
      addLog(`Student joined in-app quiz session: ${sessionIdFromApi}`);
      setScreen("QuizStudentScreen");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setInAppQuizStatus(message);
      addLog(`Join in-app quiz failed: ${message}`);
    }
  };

  const claimTokenFromDeveloperPanel = async () => {
    if (!developerUnlocked) {
      addLog("Developer token claim blocked: panel locked.");
      return;
    }
    const normalizedToken = developerClaimTokenInput.trim().toUpperCase();
    if (!/^[AS]-[A-Z0-9]+$/i.test(normalizedToken)) {
      setStatusMessage(
        tr(
          language,
          "Format token tidak valid untuk developer claim.",
          "Invalid token format for developer claim."
        )
      );
      addLog(`Developer token claim rejected: invalid token format (${normalizedToken || "empty"}).`);
      return;
    }

    try {
      const roleHint: "student" | "admin" = normalizedToken.startsWith("A-") ? "admin" : "student";
      const claimed = await claimBackendSession(normalizedToken, roleHint);
      const resolvedRole: IssuedTokenRole = claimed.role === "admin" ? "admin" : "student";
      setActiveExamMode(claimed.examMode);
      const expiresAt =
        claimed.tokenExpiresAt ?? Date.now() + DEFAULT_SESSION_EXPIRY_MINUTES * 60 * 1000;

      setIssuedTokens((prev) => {
        const next = prev.filter((entry) => entry.token.toUpperCase() !== normalizedToken);
        next.push({
          token: normalizedToken,
          role: resolvedRole,
          expiresAt,
          source: "developer-claim",
          status: "online",
          ipAddress: "-",
          deviceName: "Developer Claim Device",
          lastSeenAt: Date.now(),
        });
        return next;
      });

      if (resolvedRole === "student") {
        setStudentTokenAdminContexts((prev) => ({
          ...prev,
          [normalizedToken]: {
            sessionId: claimed.sessionId,
            accessSignature: claimed.accessSignature,
            bindingId: claimed.bindingId,
          },
        }));
      } else {
        setAdminBackendSessionId(claimed.sessionId);
        setAdminBackendAccessSignature(claimed.accessSignature);
        setAdminBackendBindingId(claimed.bindingId);
      }

      if (claimed.whitelist.length > 0) {
        setWhitelist(Array.from(new Set(claimed.whitelist)));
      }
      if (resolvedRole === "student" && claimed.launchUrl) {
        setTokenLaunchPolicies((prev) => ({
          ...prev,
          [normalizedToken]: {
            url: claimed.launchUrl,
            updatedAt: new Date().toISOString(),
          },
        }));
      }

      addLog(
        `Developer claimed token without role-switch: token=${normalizedToken} role=${resolvedRole} session=${claimed.sessionId}`
      );
      setStatusMessage(
        tr(
          language,
          `Developer claim berhasil: ${normalizedToken} (${resolvedRole}).`,
          `Developer claim succeeded: ${normalizedToken} (${resolvedRole}).`
        )
      );
      await loadAdminMonitor();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatusMessage(
        tr(
          language,
          `Developer claim gagal: ${message}`,
          `Developer claim failed: ${message}`
        )
      );
      addLog(`Developer token claim failed: token=${normalizedToken} reason=${message}`);
    }
  };

  const registerRisk = (score: number, message: string) => {
    if (!violationSystemEnabled) {
      addLog(`Risk blocked (violation system disabled): ${message}`);
      return;
    }
    recordViolation(message, score, "risk");
    setRiskScore((prev) => {
      const next = prev + score;
      addLog(`${message} | risk +${score} => ${next}`);
      if (next >= 12) {
        setIntegrityMessage(
          tr(
            language,
            "Risk score melewati ambang batas. Sesi perlu verifikasi proktor.",
            "Risk score exceeded threshold. Session requires proctor verification."
          )
        );
        setShowIntegrityWarning(true);
      }
      return next;
    });
  };

  const openSettingsFrom = (from: ScreenId) => {
    setReturnScreen(from);
    setScreen("Settings");
  };

  const openUpdateFlowFrom = (from: ScreenId, mode: UpdateFlowMode = "manual") => {
    beginUpdateFlow(mode, from);
  };

  const clearAdminWorkspaceState = (options?: { clearCache?: boolean }) => {
    resetAdminWorkspaceState();
    if (options?.clearCache) {
      setActiveAdminTokenKey("");
      clearAdminWorkspaceCache();
    }
  };

  const logoutToLogin = (options?: { clearAdminWorkspace?: boolean }) => {
    const clearAdminWorkspace = options?.clearAdminWorkspace ?? false;
    markActiveIssuedTokenOffline();
    runSecurityCall(() => securityModule?.stopViolationAlarm?.());
    runSecurityCall(() => securityModule?.stopHeartbeat?.());
    runSecurityCall(() => securityModule?.clearSession?.());
    setRole("guest");
    setActiveAdminTokenKey("");
    setActiveExamMode("BROWSER_LOCKDOWN");
    setTokenInput("");
    setActiveStudentToken("");
    setStudentBackendAccessSignature("");
    setStudentBackendBindingId("");
    setStudentAuthToken("");
    setStudentAccount(null);
    setStudentLoginUsername("");
    setStudentLoginPassword("");
    setStudentAuthStatus(tr(language, "Masukkan kredensial siswa.", "Enter student credentials."));
    setStudentAuthLoading(false);
    setRegisterNama("");
    setRegisterKelas("");
    setRegisterJurusan("");
    setRegisterUsername("");
    setRegisterPassword("");
    setRegisterSchoolYear("");
    setRegisterStatus(tr(language, "Lengkapi data registrasi siswa.", "Complete student registration data."));
    setRegisterLoading(false);
    setInAppQuizSessions([]);
    setInAppQuizStatus(tr(language, "Sinkronisasi daftar kuis.", "Syncing quiz list."));
    setQuizEntryScreen("ExamSelectionScreen");
    setBypassWhitelist(false);
    setPinAttempt("");
    setSessionExpiresAt(null);
    setSessionTimeLeftLabel("--:--:--");
    setSessionExpiryHandled(false);
    resetViolationAudit();
    setSessionId(generateSessionId());
    setDeveloperUnlocked(false);
    setDeveloperOrigin("TokenLogin");
    setDeveloperClaimTokenInput("");
    if (clearAdminWorkspace) {
      clearAdminWorkspaceState({ clearCache: true });
    }
    setStatusMessage(tr(language, "Masukkan token sesi untuk melanjutkan.", "Enter session token to continue."));
    setScreen("LoginSelection");
  };

  const clearAdminWorkspaceFromLogin = () => {
    Alert.alert(
      tr(language, "Hapus cache admin?", "Clear admin cache?"),
      tr(
        language,
        "Semua data admin tersimpan lokal akan dihapus dari perangkat ini.",
        "All locally cached admin data will be removed from this device."
      ),
      [
        { text: tr(language, "Batal", "Cancel"), style: "cancel" },
        {
          text: tr(language, "Hapus", "Clear"),
          style: "destructive",
          onPress: () => {
            setActiveAdminTokenKey("");
            clearAdminWorkspaceState({ clearCache: true });
            setStatusMessage(
              tr(language, "Cache admin berhasil dibersihkan.", "Admin cache cleared.")
            );
            addLog("Admin workspace cache cleared from login screen.");
          },
        },
      ]
    );
  };

  const openExamFlow = (rawUrl: string, source: string, bypass = false) => {
    const tokenKey = activeStudentToken.trim().toUpperCase();
    const fallbackTokenKey = generatedToken.trim().toUpperCase();
    const tokenBoundUrl =
      (tokenKey ? getTokenLaunchUrl(tokenLaunchPolicies, tokenKey) : undefined) ||
      (fallbackTokenKey ? getTokenLaunchUrl(tokenLaunchPolicies, fallbackTokenKey) : undefined);
    const effectiveWhitelist = mergeWhitelist(whitelist, tokenBoundUrl);
    const resolvedUrl = normalizeUrl(rawUrl || tokenBoundUrl || effectiveWhitelist[0] || "");
    if (!resolvedUrl) {
      setInvalidUrl(rawUrl);
      addLog(
        tr(
          language,
          `URL kosong dari ${source}.`,
          `Empty URL received from ${source}.`
        )
      );
      registerRisk(6, "Repeated violation: empty URL submitted");
      setScreen("ManualInputFail");
      return;
    }

    const tokenBoundAllowed = tokenBoundUrl ? isWhitelisted(resolvedUrl, [tokenBoundUrl]) : false;
    if (!bypass && !tokenBoundAllowed && !isWhitelisted(resolvedUrl, effectiveWhitelist)) {
      setInvalidUrl(resolvedUrl);
      addLog(
        tr(
          language,
          `URL diblokir (di luar whitelist): ${resolvedUrl} | token=${tokenKey || fallbackTokenKey || "-"} | bound=${tokenBoundUrl || "-"}`,
          `URL blocked (not whitelisted): ${resolvedUrl} | token=${tokenKey || fallbackTokenKey || "-"} | bound=${tokenBoundUrl || "-"}`
        )
      );
      registerRisk(6, "Repeated violation: non-whitelisted URL");
      setScreen("ManualInputFail");
      return;
    }

    setExamUrl(resolvedUrl);
    setBypassWhitelist(bypass);
    setPinAttempt("");
    setPinStatus(tr(language, "Masukkan PIN proktor untuk keluar browser.", "Enter proctor PIN to exit browser."));
    setOverlayTimestamp(
      new Date()
        .toISOString()
        .replace("T", " ")
        .slice(0, 19)
    );
    addLog(`Exam browser opened from ${source}: ${resolvedUrl}`);
    setScreen("ExamBrowserScreen");
  };

  const handleLogin = async () => {
    const token = tokenInput.trim();
    setStudentAuthToken("");
    setStudentAccount(null);
    if (token === STUDENT_TOKEN) {
      setRole("student");
      setActiveAdminTokenKey("");
      setActiveExamMode("BROWSER_LOCKDOWN");
      setActiveIssuedToken("");
      setActiveStudentToken(token.toUpperCase());
      setStudentBackendAccessSignature("");
      setStudentBackendBindingId("");
      setSessionId(generateSessionId());
      setSessionExpiresAt(Date.now() + DEFAULT_SESSION_EXPIRY_MINUTES * 60 * 1000);
      setSessionExpiryHandled(false);
      resetViolationAudit();
      setStatusMessage(tr(language, "Login siswa berhasil.", "Student login successful."));
      addLog("Student authenticated using StudentID.");
      setScreen("ExamSelectionScreen");
      return;
    }

    if (token === ADMIN_TOKEN) {
      const adminTokenKey = normalizeAdminTokenKey(token);
      setRole("admin");
      activateAdminWorkspace(adminTokenKey);
      setActiveExamMode("BROWSER_LOCKDOWN");
      setActiveIssuedToken("");
      setActiveStudentToken("");
      setStudentBackendAccessSignature("");
      setStudentBackendBindingId("");
      setSessionId(generateSessionId());
      setSessionExpiresAt(Date.now() + DEFAULT_SESSION_EXPIRY_MINUTES * 60 * 1000);
      setSessionExpiryHandled(false);
      resetViolationAudit();
      setStatusMessage(tr(language, "Login admin/proktor berhasil.", "Admin/proctor login successful."));
      addLog("Admin authenticated using AdminID.");
      activateAdminWorkspace(adminTokenKey);
      setScreen("AdminDashboardPanel");
      return;
    }

    if (token === DEVELOPER_PASSWORD) {
      setRole("developer");
      setActiveAdminTokenKey("");
      setActiveExamMode("BROWSER_LOCKDOWN");
      setActiveIssuedToken("");
      setActiveStudentToken("");
      setStudentBackendAccessSignature("");
      setStudentBackendBindingId("");
      setSessionId(generateSessionId());
      setSessionExpiresAt(Date.now() + DEFAULT_SESSION_EXPIRY_MINUTES * 60 * 1000);
      setSessionExpiryHandled(false);
      resetViolationAudit();
      setDeveloperOrigin("TokenLogin");
      setDeveloperUnlocked(true);
      setStatusMessage(tr(language, "Akses developer diberikan.", "Developer access granted."));
      addLog("Developer authenticated using EDU_DEV_ACCESS.");
      setScreen("DeveloperAccessScreen");
      return;
    }

    const tokenKey = token.trim().toUpperCase();
    const looksLikeSessionToken = /^[AS]-[A-Z0-9]+$/i.test(tokenKey);
    const hasBackendTarget = Boolean(normalizeBackendBaseUrl(backendBaseUrl));

    if (hasBackendTarget && looksLikeSessionToken) {
      try {
        const claimed = await claimBackendSession(tokenKey);
        const resolvedRole: Role = claimed.role === "admin" ? "admin" : "student";
        const expiresAt =
          claimed.tokenExpiresAt ?? Date.now() + DEFAULT_SESSION_EXPIRY_MINUTES * 60 * 1000;

        setRole(resolvedRole);
        if (resolvedRole === "admin") {
          activateAdminWorkspace(tokenKey, { preserveBackendSession: true });
        } else {
          setActiveAdminTokenKey("");
        }
        setActiveExamMode(claimed.examMode);
        setActiveIssuedToken(tokenKey);
        setActiveStudentToken(resolvedRole === "student" ? tokenKey : "");
        setStudentBackendAccessSignature(resolvedRole === "student" ? claimed.accessSignature : "");
        setStudentBackendBindingId(resolvedRole === "student" ? claimed.bindingId : "");
        if (resolvedRole === "admin") {
          setAdminBackendSessionId(claimed.sessionId);
          setAdminBackendAccessSignature(claimed.accessSignature);
          setAdminBackendBindingId(claimed.bindingId);
          await loadAdminMonitor();
        }
        setSessionId(claimed.sessionId);
        setSessionExpiresAt(expiresAt);
        setSessionExpiryHandled(false);
        resetViolationAudit();
        if (claimed.whitelist.length > 0) {
          setWhitelist(Array.from(new Set(claimed.whitelist)));
        }
        if (resolvedRole === "student" && claimed.launchUrl) {
          setManualUrlInput(claimed.launchUrl);
          setTokenLaunchPolicies((prev) => ({
            ...prev,
            [tokenKey]: {
              url: claimed.launchUrl,
              updatedAt: new Date().toISOString(),
            },
          }));
          setWhitelist((prev) => {
            const base = claimed.whitelist.length > 0 ? claimed.whitelist : prev;
            const next = new Set(base.map((entry) => normalizeUrl(entry)));
            next.add(claimed.launchUrl);
            return Array.from(next).filter((entry) => entry.length > 0);
          });
        }
        setIssuedTokens((prev) => {
          const next = prev.filter((entry) => entry.token.toUpperCase() !== tokenKey);
          next.push({
            token: tokenKey,
            role: resolvedRole === "admin" ? "admin" : "student",
            expiresAt,
            source: "backend-claim",
            status: "online",
            ipAddress: "-",
            deviceName:
              resolvedRole === "admin"
                ? "RN Proctor Console"
                : "RN Student Device",
            lastSeenAt: Date.now(),
          });
          return next;
        });
        setStatusMessage(
          tr(
            language,
            resolvedRole === "admin" ? "Login admin/proktor berhasil." : "Login siswa berhasil.",
            resolvedRole === "admin" ? "Admin/proctor login successful." : "Student login successful."
          )
        );
        addLog(`Backend token claim success: token=${tokenKey} role=${resolvedRole} session=${claimed.sessionId}`);
        if (resolvedRole === "admin") {
          setScreen("AdminDashboardPanel");
        } else if (claimed.examMode === "IN_APP_QUIZ") {
          setQuizEntryScreen("ExamSelectionScreen");
          setScreen("QuizStudentScreen");
        } else {
          setScreen("ExamSelectionScreen");
        }
        return;
      } catch (error) {
        const backendClaimError = error instanceof Error ? error.message : String(error);
        addLog(`Backend token claim failed: token=${tokenKey} reason=${backendClaimError}`);
        setStatusMessage(
          tr(
            language,
            `Token backend ditolak: ${backendClaimError}`,
            `Backend token rejected: ${backendClaimError}`
          )
        );
        return;
      }
    }

    const issued = issuedTokens.find((entry) => entry.token.toUpperCase() === token.toUpperCase());
    if (issued) {
      if (resolveIssuedTokenStatus(issued) === "revoked") {
        const reason = issued.revokedReason ?? "ADMIN_FORCE_LOGOUT";
        setStatusMessage(
          tr(
            language,
            `Token telah direvoke proktor. Alasan: ${reason}`,
            `Token has been revoked by proctor. Reason: ${reason}`
          )
        );
        addLog(`Revoked token rejected: ${token} | reason=${reason}`);
        return;
      }

      if (Date.now() >= issued.expiresAt) {
        updateIssuedToken(issued.token, { status: "expired" });
        setStatusMessage(tr(language, "Token sudah kedaluwarsa.", "Token has expired."));
        addLog(`Expired token rejected: ${token}`);
        return;
      }

      const resolvedRole: Role = issued.role === "admin" ? "admin" : "student";
      let issuedExamMode: SessionMode = "BROWSER_LOCKDOWN";
      setRole(resolvedRole);
      setActiveExamMode("BROWSER_LOCKDOWN");
      setActiveIssuedToken(token.toUpperCase());
      setActiveStudentToken(resolvedRole === "student" ? token.toUpperCase() : "");
      setStudentBackendAccessSignature("");
      setStudentBackendBindingId("");
      setSessionId(generateSessionId());
      setSessionExpiresAt(issued.expiresAt);
      setSessionExpiryHandled(false);
      resetViolationAudit();
      updateIssuedToken(issued.token, {
        status: "online",
        ipAddress: resolvedRole === "admin" ? "192.168.1.11" : "192.168.1.23",
        deviceName: resolvedRole === "admin" ? "Proctor Console" : "Android Student Device",
        lastSeenAt: Date.now(),
      });
      if (resolvedRole === "admin") {
        activateAdminWorkspace(token);
      } else {
        setActiveAdminTokenKey("");
      }
      if (resolvedRole === "student") {
        const tokenKey = token.toUpperCase();
        const boundUrl = tokenLaunchPolicies[tokenKey]?.url;
        if (boundUrl) {
          setManualUrlInput(boundUrl);
        }
        if (tokenKey.startsWith("S-")) {
          try {
            const claimed = await claimBackendSession(tokenKey, "student");
            setStudentBackendAccessSignature(claimed.accessSignature);
            setStudentBackendBindingId(claimed.bindingId);
            setSessionId(claimed.sessionId);
            setActiveExamMode(claimed.examMode);
            issuedExamMode = claimed.examMode;
            if (claimed.whitelist.length > 0) {
              setWhitelist(Array.from(new Set(claimed.whitelist)));
            }
            if (claimed.launchUrl) {
              setManualUrlInput(claimed.launchUrl);
              setTokenLaunchPolicies((prev) => ({
                ...prev,
                [tokenKey]: {
                  url: claimed.launchUrl,
                  updatedAt: new Date().toISOString(),
                },
              }));
              setWhitelist((prev) => {
                const base = claimed.whitelist.length > 0 ? claimed.whitelist : prev;
                const next = new Set(base.map((entry) => normalizeUrl(entry)));
                next.add(claimed.launchUrl);
                return Array.from(next).filter((entry) => entry.length > 0);
              });
            }
            addLog(`Student backend claim success: token=${tokenKey} session=${claimed.sessionId}`);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            addLog(`Student backend claim failed: ${message}`);
          }
        }
      }
      setStatusMessage(
        tr(
          language,
          resolvedRole === "admin" ? "Login admin/proktor berhasil." : "Login siswa berhasil.",
          resolvedRole === "admin" ? "Admin/proctor login successful." : "Student login successful."
        )
      );
      addLog(`Issued ${issued.role} token authenticated (${issued.source}): ${token}`);
      if (resolvedRole === "admin") {
        setScreen("AdminDashboardPanel");
      } else if (issuedExamMode === "IN_APP_QUIZ") {
        setQuizEntryScreen("ExamSelectionScreen");
        setScreen("QuizStudentScreen");
      } else {
        setScreen("ExamSelectionScreen");
      }
      return;
    }

    setStatusMessage(tr(language, "Token tidak valid.", "Invalid token."));
    addLog(`Invalid login token attempt: ${token || "(empty)"}`);
  };

  const generatedTokenKey = generatedToken.trim().toUpperCase();
  const generatedTokenPinPolicy = generatedTokenKey ? tokenPinPolicies[generatedTokenKey] : undefined;
  const generatedTokenLaunchPolicy = generatedTokenKey ? tokenLaunchPolicies[generatedTokenKey] : undefined;
  const activeTokenKey = activeStudentToken.trim().toUpperCase();
  const activeTokenLaunchUrl = activeTokenKey ? tokenLaunchPolicies[activeTokenKey]?.url : undefined;
  const effectiveStudentWhitelist = mergeWhitelist(whitelist, activeTokenLaunchUrl);
  const generatedTokenPinStatus = !generatedTokenKey
    ? tr(language, "Buat token siswa dulu untuk mengikat PIN.", "Generate a student token first to bind PIN.")
    : !generatedTokenPinPolicy
      ? tr(language, `PIN belum diset untuk token ${generatedTokenKey}.`, `PIN is not set for token ${generatedTokenKey}.`)
      : generatedTokenPinPolicy.effectiveDate === todayStamp()
        ? tr(
            language,
            `PIN aktif hari ini untuk token ${generatedTokenKey} (${generatedTokenPinPolicy.effectiveDate}).`,
            `PIN active today for token ${generatedTokenKey} (${generatedTokenPinPolicy.effectiveDate}).`
          )
        : tr(
            language,
            `PIN expired untuk token ${generatedTokenKey} (${generatedTokenPinPolicy.effectiveDate}).`,
            `PIN expired for token ${generatedTokenKey} (${generatedTokenPinPolicy.effectiveDate}).`
          );
  const generatedTokenLaunchStatus = !generatedTokenKey
    ? tr(language, "Buat token siswa dulu untuk mengikat URL.", "Generate a student token first to bind URL.")
    : !generatedTokenLaunchPolicy
      ? tr(language, `URL belum diset untuk token ${generatedTokenKey}.`, `URL is not set for token ${generatedTokenKey}.`)
      : tr(
          language,
          `URL token ${generatedTokenKey}: ${generatedTokenLaunchPolicy.url}`,
          `Token URL ${generatedTokenKey}: ${generatedTokenLaunchPolicy.url}`
        );

  const normalizeTokenList = (tokens: string[]): string[] => {
    const next = new Set<string>();
    tokens.forEach((token) => {
      const normalized = token.trim().toUpperCase();
      if (normalized) {
        next.add(normalized);
      }
    });
    return Array.from(next);
  };

  const syncLaunchUrlToBackendForTokens = async (
    targetTokens: string[],
    normalizedUrl: string
  ): Promise<{ attempted: number; success: number; failed: number; skipped: number }> => {
    const base = normalizeBackendBaseUrl(backendBaseUrl);
    if (!base) {
      return { attempted: 0, success: 0, failed: 0, skipped: targetTokens.length };
    }

    const syncTargets = targetTokens
      .map((token) => ({
        token,
        context: getStudentTokenAdminContext(token),
      }))
      .filter((item): item is { token: string; context: StudentTokenAdminContext } => Boolean(item.context));

    if (syncTargets.length === 0) {
      return { attempted: 0, success: 0, failed: 0, skipped: targetTokens.length };
    }

    const groupedBySession = new Map<
      string,
      { context: StudentTokenAdminContext; tokens: string[] }
    >();
    syncTargets.forEach((item) => {
      const key = `${item.context.sessionId}::${item.context.bindingId}`;
      const existing = groupedBySession.get(key);
      if (existing) {
        existing.tokens.push(item.token);
        return;
      }
      groupedBySession.set(key, {
        context: item.context,
        tokens: [item.token],
      });
    });

    let success = 0;
    let failed = 0;
    let lastContext: StudentTokenAdminContext | null = null;
    for (const group of groupedBySession.values()) {
      let activeContext = group.context;
      let synced = false;

      for (let attempt = 0; attempt < 2 && !synced; attempt += 1) {
        try {
          const whitelistResponse = await fetch(`${base}/session/whitelist/add`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              session_id: activeContext.sessionId,
              access_signature: activeContext.accessSignature,
              url: normalizedUrl,
            }),
          });
          await parseJsonResponse(whitelistResponse);

          const launchResponse = await fetch(`${base}/exam/launch`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${activeContext.accessSignature}`,
            },
            body: JSON.stringify({
              session_id: activeContext.sessionId,
              launch_url: normalizedUrl,
            }),
          });
          await parseJsonResponse(launchResponse);
          synced = true;
          success += group.tokens.length;
          lastContext = activeContext;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (attempt === 0 && isBackendAuthFailure(message)) {
            const refreshedContext = await reconnectAdminContext(
              activeContext,
              "RN_ADMIN_URL_SYNC_RECONNECT"
            );
            if (refreshedContext) {
              activeContext = refreshedContext;
              continue;
            }
          }
          failed += group.tokens.length;
          addLog(
            `Token URL backend sync failed: session=${group.context.sessionId} tokens=${group.tokens.length} | ${message}`
          );
          break;
        }
      }
    }

    if (lastContext) {
      setActiveAdminContext(lastContext);
      setSessionId(lastContext.sessionId);
    }

    return {
      attempted: syncTargets.length,
      success,
      failed,
      skipped: targetTokens.length - syncTargets.length,
    };
  };

  const syncProctorPinToBackendForTokens = async (
    targetTokens: string[],
    normalizedPin: string
  ): Promise<{ attempted: number; success: number; failed: number; skipped: number }> => {
    const base = normalizeBackendBaseUrl(backendBaseUrl);
    if (!base) {
      return { attempted: 0, success: 0, failed: 0, skipped: targetTokens.length };
    }

    const syncTargets = targetTokens
      .map((token) => ({
        token,
        context: getStudentTokenAdminContext(token),
      }))
      .filter((item): item is { token: string; context: StudentTokenAdminContext } => Boolean(item.context));

    if (syncTargets.length === 0) {
      return { attempted: 0, success: 0, failed: 0, skipped: targetTokens.length };
    }

    let success = 0;
    let failed = 0;
    const refreshedContextBySession = new Map<string, StudentTokenAdminContext>();
    let lastContext: StudentTokenAdminContext | null = null;
    for (const item of syncTargets) {
      const sessionKey = `${item.context.sessionId}::${item.context.bindingId}`;
      let activeContext = refreshedContextBySession.get(sessionKey) ?? item.context;
      try {
        let synced = false;
        for (let attempt = 0; attempt < 2 && !synced; attempt += 1) {
          try {
            const response = await fetch(`${base}/session/proctor-pin/set`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                session_id: activeContext.sessionId,
                access_signature: activeContext.accessSignature,
                pin: normalizedPin,
                student_token: item.token,
              }),
            });
            const payload = await parseJsonResponse(response);
            const effectiveDate = String(payload.effective_date ?? "").trim();
            if (effectiveDate) {
              setProctorPinEffectiveDate(effectiveDate);
            }
            success += 1;
            synced = true;
            lastContext = activeContext;
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (attempt === 0 && isBackendAuthFailure(message)) {
              const refreshedContext = await reconnectAdminContext(
                activeContext,
                "RN_ADMIN_PIN_SYNC_RECONNECT"
              );
              if (refreshedContext) {
                activeContext = refreshedContext;
                refreshedContextBySession.set(sessionKey, refreshedContext);
                continue;
              }
            }
            throw error;
          }
        }
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : String(error);
        addLog(`Proctor PIN backend sync failed: token=${item.token} | ${message}`);
      }
    }

    if (lastContext) {
      setActiveAdminContext(lastContext);
      setSessionId(lastContext.sessionId);
    }

    return {
      attempted: syncTargets.length,
      success,
      failed,
      skipped: targetTokens.length - syncTargets.length,
    };
  };

  const localTokenMonitorItems: AdminTokenMonitorItem[] = [...issuedTokens]
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
    .map((entry) => {
      const status = resolveIssuedTokenStatus(entry);
      const activityState: TokenActivityState =
        status === "online"
          ? "on_exam_screen"
          : status === "offline"
            ? "disconnected"
            : status === "revoked"
              ? "revoked"
              : status === "expired"
                ? "expired"
                : "waiting_claim";
      const tokenLaunchUrl = getTokenLaunchUrl(tokenLaunchPolicies, entry.token) ?? "";
      return {
        token: entry.token,
        role: entry.role,
        status,
        bindingId: "",
        ipAddress: entry.ipAddress || "-",
        deviceName: entry.deviceName || tr(language, "Belum terdaftar", "Not registered yet"),
        sessionState: status === "offline" ? "DEGRADED" : "IN_PROGRESS",
        activityState,
        activitySummary: formatTokenActivitySummary(
          activityState,
          status,
          status === "offline" ? "DEGRADED" : "IN_PROGRESS",
          Math.max(0, Math.floor((Date.now() - entry.lastSeenAt) / 1000)),
          entry.revokedReason ?? ""
        ),
        launchUrl: tokenLaunchUrl,
        lockReason: entry.revokedReason ?? "",
        latestViolationType: "",
        latestViolationDetail: "",
        latestViolationAtLabel: "-",
        claimedAtLabel: "-",
        expiresAtLabel: formatTimestamp(entry.expiresAt),
        lastSeenLabel: formatTimestamp(entry.lastSeenAt),
        lastSeenAtMs: entry.lastSeenAt,
        staleSeconds: Math.max(0, Math.floor((Date.now() - entry.lastSeenAt) / 1000)),
      };
    });
  const hasBackendMonitorContext = Boolean(adminBackendSessionId && adminBackendAccessSignature);
  const tokenMonitorItems: AdminTokenMonitorItem[] = hasBackendMonitorContext
    ? (() => {
        const backendKeys = new Set(
          backendMonitorItems.map((item) => item.token.trim().toUpperCase())
        );
        const merged = [...backendMonitorItems];
        localTokenMonitorItems.forEach((item) => {
          const normalizedToken = item.token.trim().toUpperCase();
          if (!backendKeys.has(normalizedToken)) {
            merged.push(item);
          }
        });
        return merged;
      })()
    : localTokenMonitorItems;

  useEffect(() => {
    if (tokenMonitorItems.length === 0) {
      if (selectedMonitorToken) {
        setSelectedMonitorToken("");
      }
      return;
    }
    const normalizedSelected = selectedMonitorToken.trim().toUpperCase();
    if (
      normalizedSelected &&
      tokenMonitorItems.some((item) => item.token.trim().toUpperCase() === normalizedSelected)
    ) {
      return;
    }
    setSelectedMonitorToken(tokenMonitorItems[0].token);
  }, [selectedMonitorToken, tokenMonitorItems]);

  const selectedMonitorTokenKey = selectedMonitorToken.trim().toUpperCase();
  const selectedMonitorItem =
    tokenMonitorItems.find((item) => item.token.trim().toUpperCase() === selectedMonitorTokenKey) ?? null;
  const selectedMonitorPinPolicy = selectedMonitorItem
    ? getTokenPinPolicy(tokenPinPolicies, selectedMonitorItem.token)
    : undefined;
  const selectedMonitorLaunchUrl = selectedMonitorItem
    ? getTokenLaunchUrl(tokenLaunchPolicies, selectedMonitorItem.token) ?? selectedMonitorItem.launchUrl
    : "";
  const selectedMonitorLaunchPolicyUpdatedAt = selectedMonitorItem
    ? getTokenLaunchPolicyLabel(tokenLaunchPolicies, selectedMonitorItem.token)
    : "";
  const selectedMonitorQuizResult = selectedMonitorItem
    ? quizResultsByToken[selectedMonitorItem.token.trim().toUpperCase()] ?? null
    : null;
  const selectedMonitorDetail: AdminTokenMonitorDetail | null = selectedMonitorItem
    ? {
        token: selectedMonitorItem.token,
        role: selectedMonitorItem.role,
        status: selectedMonitorItem.status,
        ipAddress: selectedMonitorItem.ipAddress,
        deviceName: selectedMonitorItem.deviceName,
        bindingId: selectedMonitorItem.bindingId,
        sessionState: selectedMonitorItem.sessionState,
        activityState: selectedMonitorItem.activityState,
        activitySummary: selectedMonitorItem.activitySummary,
        latestViolationType: selectedMonitorItem.latestViolationType,
        latestViolationDetail: selectedMonitorItem.latestViolationDetail,
        latestViolationAtLabel: selectedMonitorItem.latestViolationAtLabel,
        lockReason: selectedMonitorItem.lockReason,
        expiresAtLabel: selectedMonitorItem.expiresAtLabel,
        lastSeenLabel: selectedMonitorItem.lastSeenLabel,
        lastSeenAtMs: selectedMonitorItem.lastSeenAtMs,
        staleSeconds: selectedMonitorItem.staleSeconds,
        proctorPin: selectedMonitorPinPolicy?.pin ?? "",
        pinEffectiveDate: selectedMonitorPinPolicy?.effectiveDate ?? "",
        launchUrl: selectedMonitorLaunchUrl,
        launchUpdatedAt: selectedMonitorLaunchPolicyUpdatedAt,
        quizResult: selectedMonitorQuizResult,
      }
    : null;

  useEffect(() => {
    if (screen !== "AdminDashboardPanel") {
      return;
    }
    recordTokenMonitorSnapshot(tokenMonitorItems);
  }, [recordTokenMonitorSnapshot, screen, tokenMonitorItems]);

  const updateTargetVersionLabel =
    updateProgressState.versionLabel ||
    updateSnapshot?.ota.version ||
    updateSnapshot?.native.versionName ||
    "";
  const updateProgressLabel =
    updateProgressState.totalBytes > 0 && updateProgressState.downloadedBytes >= 0
      ? `${Math.round(updateProgressState.progress * 100)}% // ${formatByteSize(
          updateProgressState.downloadedBytes
        )} / ${formatByteSize(updateProgressState.totalBytes)}`
      : `${Math.round(updateProgressState.progress * 100)}%`;
  const settingsUpdateSummary = updateSnapshot?.native.available
    ? tr(
        language,
        `Update native ${updateSnapshot.native.versionName ?? ""} tersedia.`,
        `Native update ${updateSnapshot.native.versionName ?? ""} is available.`
      )
    : updateSnapshot?.ota.available
      ? tr(
          language,
          `Patch React Native ${updateSnapshot.ota.version ?? ""} tersedia.`,
          `React Native patch ${updateSnapshot.ota.version ?? ""} is available.`
        )
      : tr(language, "Build saat ini sudah sinkron.", "Current build is synchronized.");

  if (screen === "StartScreen") {
    return (
      <StartScreen
        language={language}
        onComplete={() => {
          beginUpdateFlow("startup", "PermissionsScreen");
        }}
      />
    );
  }

  if (screen === "UpdateScreen") {
    return (
      <UpdateScreen
        language={language}
        title={tr(language, "EDUFIKA UPDATE LINK", "EDUFIKA UPDATE LINK")}
        subtitle={tr(
          language,
          "Menyinkronkan remote config, patch React Native, dan runtime native.",
          "Synchronizing remote config, React Native patches, and the native runtime."
        )}
        statusMessage={updateProgressState.message}
        detailMessage={
          updateSnapshot?.native.available
            ? updateSnapshot.native.notes
            : updateSnapshot?.ota.available
              ? updateSnapshot.ota.notes
              : statusBanner
        }
        progress={updateProgressState.progress}
        progressLabel={updateProgressLabel}
        channelLabel={updateSnapshot?.channel ?? "stable"}
        currentVersionLabel={
          updateSnapshot
            ? `${updateSnapshot.current.versionName} (${updateSnapshot.current.versionCode})`
            : "BOOTSTRAP"
        }
        targetVersionLabel={updateTargetVersionLabel}
        remoteConfigVersion={remoteConfig.version}
        logs={updateLogs}
        busy={updateBusy}
        primaryActionLabel={updateActionLabel(updatePrimaryAction)}
        secondaryActionLabel={updateActionLabel(updateSecondaryAction)}
        onPrimaryAction={() => void handleUpdateAction(updatePrimaryAction)}
        onSecondaryAction={() => void handleUpdateAction(updateSecondaryAction)}
      />
    );
  }

  if (screen === "SplashScreen") {
    return (
      <SplashScreen
        bootMessage={tr(language, "Memuat modul sistem...", "Loading system module...")}
        language={language}
      />
    );
  }

  if (screen === "LoginSelection") {
    return (
      <LoginSelection
        language={language}
        onTokenLogin={() => setScreen("TokenLogin")}
        onQuizLogin={() => setScreen("UserLogin")}
        onOpenSettings={() => openSettingsFrom("LoginSelection")}
        onExitApp={() => {
          runSecurityCall(() => securityModule?.exitApp?.());
          BackHandler.exitApp();
        }}
      />
    );
  }

  if (screen === "TokenLogin") {
    return (
      <TokenLogin
        language={language}
        token={tokenInput}
        statusMessage={statusMessage}
        onTokenChange={setTokenInput}
        onSubmit={handleLogin}
        onOpenSettings={() => openSettingsFrom("TokenLogin")}
        onClearAdminCache={clearAdminWorkspaceFromLogin}
        onExitToSelection={() => setScreen("LoginSelection")}
      />
    );
  }

  if (screen === "UserLogin") {
    return (
      <UserLogin
        language={language}
        username={studentLoginUsername}
        password={studentLoginPassword}
        statusMessage={studentAuthStatus}
        loading={studentAuthLoading}
        onUsernameChange={setStudentLoginUsername}
        onPasswordChange={setStudentLoginPassword}
        onSubmit={() => void loginStudentAccount()}
        onRegister={() => setScreen("Register")}
        onBack={() => setScreen("LoginSelection")}
      />
    );
  }

  if (screen === "Register") {
    return (
      <Register
        language={language}
        nama={registerNama}
        kelas={registerKelas}
        jurusan={registerJurusan}
        username={registerUsername}
        password={registerPassword}
        schoolYear={registerSchoolYear}
        statusMessage={registerStatus}
        loading={registerLoading}
        onNamaChange={setRegisterNama}
        onKelasChange={setRegisterKelas}
        onJurusanChange={setRegisterJurusan}
        onUsernameChange={setRegisterUsername}
        onPasswordChange={setRegisterPassword}
        onSchoolYearChange={setRegisterSchoolYear}
        onSubmit={() => void registerStudentAccount()}
        onBack={() => setScreen("UserLogin")}
      />
    );
  }

  if (screen === "InAppQuizSelection") {
    return (
      <InAppQuizSelection
        language={language}
        sessions={inAppQuizSessions}
        statusMessage={inAppQuizStatus}
        driveHealthLoading={driveHealth.loading}
        driveHealthChecked={driveHealth.checked}
        driveHealthConnected={driveHealth.connected}
        driveHealthConfigured={driveHealth.configured}
        driveHealthFolderName={driveHealth.folderName}
        driveHealthError={driveHealth.error}
        onRefreshDriveHealth={() => void refreshDriveHealth("in-app-quiz-selection")}
        onSelectSession={(session) => void joinInAppQuizSession(session)}
        onRefresh={() => void loadInAppQuizSessions()}
        onLogout={() => {
          addLog("Student logged out (in-app quiz).");
          logoutToLogin();
        }}
        onOpenSettings={() => openSettingsFrom("InAppQuizSelection")}
      />
    );
  }

  if (screen === "ExamSelectionScreen") {
    return (
      <ExamSelectionScreen
        language={language}
        onScanQr={() => setScreen("QRScannerScreen")}
        onManualInput={() => setScreen("ManualInputScreen")}
        onOpenQuiz={() => {
          setQuizEntryScreen("ExamSelectionScreen");
          setScreen("QuizStudentScreen");
        }}
        showQuizOption={activeExamMode === "HYBRID" || activeExamMode === "IN_APP_QUIZ"}
        driveHealthLoading={driveHealth.loading}
        driveHealthChecked={driveHealth.checked}
        driveHealthConnected={driveHealth.connected}
        driveHealthConfigured={driveHealth.configured}
        driveHealthFolderName={driveHealth.folderName}
        driveHealthError={driveHealth.error}
        onRefreshDriveHealth={() => void refreshDriveHealth("exam-selection")}
        onLogout={() => {
          addLog("Student logged out.");
          logoutToLogin();
        }}
        onOpenSettings={() => openSettingsFrom("ExamSelectionScreen")}
      />
    );
  }

  if (screen === "PermissionsScreen") {
    return (
      <PermissionsScreen
        language={language}
        onLog={addLog}
        onContinue={() => setScreen("LoginSelection")}
      />
    );
  }

  if (screen === "QuizStudentScreen") {
    return (
      <QuizStudentScreen
        language={language}
        backendBaseUrl={backendBaseUrl}
        sessionId={sessionId}
        accessSignature={studentBackendAccessSignature}
        driveHealthLoading={driveHealth.loading}
        driveHealthChecked={driveHealth.checked}
        driveHealthConnected={driveHealth.connected}
        driveHealthConfigured={driveHealth.configured}
        driveHealthFolderName={driveHealth.folderName}
        driveHealthError={driveHealth.error}
        onRefreshDriveHealth={() => void refreshDriveHealth("quiz-student-screen")}
        onLog={addLog}
        onBack={() => setScreen(quizEntryScreen)}
        riskScore={riskScore}
        showIntegrityWarning={showIntegrityWarning}
        integrityMessage={integrityMessage}
        onDismissIntegrityWarning={() => setShowIntegrityWarning(false)}
        studentAccount={studentAccount}
        studentToken={activeStudentToken}
        violationHistory={violationHistory}
      />
    );
  }

  if (screen === "ManualInputScreen") {
    return (
      <ManualInputScreen
        language={language}
        urlInput={manualUrlInput}
        onUrlInputChange={setManualUrlInput}
        onValidate={() => openExamFlow(manualUrlInput, "manual input")}
        onBack={() => setScreen("ExamSelectionScreen")}
      />
    );
  }

  if (screen === "ManualInputFail") {
    return (
      <ManualInputFail
        language={language}
        invalidUrl={invalidUrl}
        onTryAgain={() => setScreen("ManualInputScreen")}
        onBackToSelection={() => setScreen("ExamSelectionScreen")}
      />
    );
  }

  if (screen === "QRScannerScreen") {
    return (
      <Suspense
        fallback={
          <SplashScreen
            language={language}
            bootMessage={tr(language, "Memuat modul kamera...", "Loading camera module...")}
          />
        }
      >
        <QRScannerScreen
          language={language}
          manualValue={qrMockValue}
          onManualValueChange={setQrMockValue}
          onUseManualValue={() => openExamFlow(qrMockValue, "qr scanner manual")}
          onDetectedValue={(value) => {
            setQrMockValue(value);
            openExamFlow(value, "qr scanner camera");
          }}
          onBack={() => setScreen("ExamSelectionScreen")}
        />
      </Suspense>
    );
  }

  if (screen === "ExamBrowserScreen") {
    return (
      <Suspense
        fallback={
          <SplashScreen
            language={language}
            bootMessage={tr(language, "Memuat browser ujian...", "Loading exam browser...")}
          />
        }
      >
        <ExamBrowserScreen
          language={language}
          url={examUrl}
          kioskEnabled={kioskEnabled}
          pinAttempt={pinAttempt}
          pinStatus={pinStatus}
          studentId={tokenInput || "StudentID"}
          sessionId={sessionId}
          riskScore={riskScore}
          sessionTimeLeft={sessionTimeLeftLabel}
          overlayTimestamp={overlayTimestamp}
          showIntegrityWarning={showIntegrityWarning}
          integrityMessage={integrityMessage}
          whitelist={effectiveStudentWhitelist}
          bypassWhitelist={bypassWhitelist || role === "admin" || role === "developer"}
          onPinAttemptChange={setPinAttempt}
          onProctorPinModalVisibleChange={(visible) => {
            runSecurityCall(() => securityModule?.setPinEntryFocusBypass?.(visible));
          }}
          onBlockedNavigation={(blockedUrl) => {
            const reason = `Blocked navigation outside whitelist: ${blockedUrl}`;
            addLog(reason);
            registerRisk(6, "Repeated violation: external navigation attempt");
            setViolationReason(reason);
            setIntegrityMessage(reason);
            setShowIntegrityWarning(true);
            setScreen("ViolationScreen");
          }}
          onSubmitPinExit={async () => {
            if (bypassWhitelist || role === "admin" || role === "developer") {
              addLog("Exam browser closed by admin/developer.");
              setScreen(
                role === "admin"
                  ? "AdminDashboardPanel"
                  : "DeveloperAccessScreen"
              );
              return;
            }

            const normalizedAttempt = pinAttempt.trim();
            if (!normalizedAttempt) {
              setPinStatus(
                tr(
                  language,
                  "Masukkan PIN proktor terlebih dahulu.",
                  "Enter the proctor PIN first."
                )
              );
              return;
            }

            const base = normalizeBackendBaseUrl(backendBaseUrl);
            if (base && sessionId && studentBackendAccessSignature.trim()) {
              try {
                const verifyResponse = await fetch(`${base}/session/proctor-pin/verify`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    session_id: sessionId,
                    access_signature: studentBackendAccessSignature.trim(),
                    pin: normalizedAttempt,
                  }),
                });
                const verifyPayload = await parseJsonResponse(verifyResponse);
                if (Boolean(verifyPayload.valid)) {
                  addLog("Student exited exam with valid backend proctor PIN.");
                  updateIssuedToken(activeStudentToken, { status: "offline", lastSeenAt: Date.now() });
                  setScreen("ExamSelectionScreen");
                  return;
                }

                const reason = String(verifyPayload.reason ?? "PIN_INVALID").trim().toUpperCase();
                if (reason === "PIN_NOT_SET") {
                  setPinStatus(
                    tr(
                      language,
                      "PIN proktor belum dikonfigurasi untuk sesi ini.",
                      "Proctor PIN has not been configured for this session."
                    )
                  );
                } else if (reason === "PIN_EXPIRED") {
                  setPinStatus(
                    tr(
                      language,
                      "PIN proktor sesi ini sudah kedaluwarsa.",
                      "This session proctor PIN has expired."
                    )
                  );
                } else {
                  setPinStatus(
                    tr(
                      language,
                      "PIN tidak valid. Hanya proktor yang bisa menutup sesi.",
                      "Invalid PIN. Only proctor can close this session."
                    )
                  );
                }
                addLog(`Proctor PIN rejected by backend. reason=${reason}`);
                return;
              } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                addLog(`Proctor PIN backend verify failed. Falling back to local policy. ${message}`);
              }
            }

            const targetToken = activeStudentToken.toUpperCase();
            const policy = targetToken ? tokenPinPolicies[targetToken] : undefined;

            if (!policy) {
              const message = tr(
                language,
                "PIN proktor belum dikonfigurasi untuk token siswa ini.",
                "Proctor PIN has not been configured for this student token."
              );
              setPinStatus(message);
              addLog(`Proctor PIN rejected: token policy not configured. token=${targetToken || "(unknown)"}`);
              return;
            }

            if (policy.effectiveDate !== todayStamp()) {
              const message = tr(
                language,
                "PIN proktor token ini sudah kedaluwarsa (harian).",
                "This token-specific proctor PIN has expired (daily policy)."
              );
              setPinStatus(message);
              addLog(`Proctor PIN rejected: token policy expired. token=${targetToken}`);
              return;
            }

            if (normalizedAttempt === policy.pin.trim()) {
              addLog(`Student exited exam with valid proctor PIN. token=${targetToken}`);
              updateIssuedToken(targetToken, { status: "offline", lastSeenAt: Date.now() });
              setScreen("ExamSelectionScreen");
              return;
            }

            setPinStatus(
              tr(
                language,
                "PIN tidak valid. Hanya proktor yang bisa menutup sesi.",
                "Invalid PIN. Only proctor can close this session."
              )
            );
            addLog("Invalid proctor PIN attempt on exam exit.");
          }}
          onDismissIntegrityWarning={() => setShowIntegrityWarning(false)}
        />
      </Suspense>
    );
  }

  if (screen === "ViolationScreen") {
    return (
      <ViolationScreen
        language={language}
        reason={violationReason}
        onBackToLogin={() => {
          addLog("Violation acknowledged. Session reset to login.");
          logoutToLogin();
        }}
      />
    );
  }

  if (screen === "SuccessScreen") {
    return (
      <SuccessScreen
        language={language}
        onBackToLogin={() => {
          addLog("Session success page completed. Returning to login.");
          logoutToLogin();
        }}
      />
    );
  }

  if (screen === "AdminDashboardPanel") {
    return (
      <AdminDashboardPanel
        language={language}
        backendBaseUrl={backendBaseUrl}
        sessionMode={sessionMode}
        generatedToken={generatedToken}
        generatedTokenExpiryAt={generatedTokenExpiryAt}
        tokenBatchCount={tokenBatchCount}
        generatedTokenBatch={generatedTokenBatch}
        tokenExpiryMinutes={tokenExpiryMinutes}
        tokenLaunchUrl={tokenLaunchUrlInput}
        tokenLaunchUrlStatus={generatedTokenLaunchStatus}
        proctorPin={proctorPin}
        proctorPinStatus={generatedTokenPinStatus}
        revokeTokenInput={revokeTokenInput}
        revokeTokenStatus={revokeTokenStatus}
        sessionControlStatus={sessionControlStatus}
        backendMonitorError={backendMonitorError}
        tokenMonitorItems={tokenMonitorItems}
        selectedMonitorToken={selectedMonitorToken}
        selectedMonitorDetail={selectedMonitorDetail}
        logs={logs}
        tokenActivityLogsByToken={tokenActivityLogsByToken}
        reactivateTokenInput={reactivateTokenInput}
        reactivateTokenStatus={reactivateTokenStatus}
        reactivateTokenPending={reactivateTokenPending}
        onTabChange={setAdminDashboardTab}
        onSelectMonitorToken={(token: string) => {
          const normalized = token.trim().toUpperCase();
          if (!normalized) {
            return;
          }
          setSelectedMonitorToken(normalized);
        }}
        onTokenBatchCountChange={setTokenBatchCount}
        onSessionModeChange={setSessionMode}
        onTokenExpiryMinutesChange={setTokenExpiryMinutes}
        onTokenLaunchUrlChange={setTokenLaunchUrlInput}
        onSaveTokenLaunchUrl={async () => {
          const targetToken = generatedToken.trim().toUpperCase();
          if (!targetToken) {
            addLog("Token URL binding rejected: no student token selected.");
            return;
          }

          const normalizedUrl = normalizeUrl(tokenLaunchUrlInput);
          if (!normalizedUrl) {
            addLog(`Token URL binding rejected: empty URL for token ${targetToken}.`);
            return;
          }

          setTokenLaunchPolicies((prev) => ({
            ...prev,
            [targetToken]: {
              url: normalizedUrl,
              updatedAt: new Date().toISOString(),
            },
          }));
          setWhitelist((prev) => {
            const next = new Set(prev.map((entry) => normalizeUrl(entry)));
            next.add(normalizedUrl);
            return Array.from(next);
          });
          setTokenLaunchUrlInput(normalizedUrl);
          addLog(`Token URL binding saved. token=${targetToken} url=${normalizedUrl}`);

          const backendSummary = await syncLaunchUrlToBackendForTokens([targetToken], normalizedUrl);
          if (backendSummary.attempted === 0) {
            addLog("Token URL binding synced locally only (backend token context not available).");
            return;
          }
          if (backendSummary.failed > 0) {
            addLog(
              `Token URL backend sync partial. success=${backendSummary.success} failed=${backendSummary.failed}`
            );
            return;
          }
          addLog(`Backend whitelist synced for token URL. token=${targetToken}`);
        }}
        onSaveTokenLaunchUrlForAll={async () => {
          const batchTokens =
            generatedTokenBatch.length > 0
              ? generatedTokenBatch.map((entry) => entry.token)
              : tokenMonitorItems
                  .filter((entry) => entry.role === "student")
                  .map((entry) => entry.token);
          const tokens = normalizeTokenList(batchTokens);
          if (tokens.length === 0) {
            addLog("Batch URL binding rejected: no student tokens available.");
            return;
          }

          const normalizedUrl = normalizeUrl(tokenLaunchUrlInput);
          if (!normalizedUrl) {
            addLog("Batch URL binding rejected: empty URL.");
            return;
          }

          const updatedAt = new Date().toISOString();
          setTokenLaunchPolicies((prev) => {
            const next = { ...prev };
            tokens.forEach((token) => {
              next[token] = {
                url: normalizedUrl,
                updatedAt,
              };
            });
            return next;
          });
          setWhitelist((prev) => {
            const next = new Set(prev.map((entry) => normalizeUrl(entry)));
            next.add(normalizedUrl);
            return Array.from(next);
          });
          setTokenLaunchUrlInput(normalizedUrl);
          addLog(`Batch token URL binding saved locally. count=${tokens.length} url=${normalizedUrl}`);

          const backendSummary = await syncLaunchUrlToBackendForTokens(tokens, normalizedUrl);
          if (backendSummary.attempted === 0) {
            addLog("Batch token URL binding backend sync skipped (no backend token contexts found).");
            return;
          }
          addLog(
            `Batch token URL backend sync finished. total=${tokens.length} attempted=${backendSummary.attempted} success=${backendSummary.success} failed=${backendSummary.failed} skipped=${backendSummary.skipped}`
          );
        }}
        onProctorPinChange={setProctorPin}
        onSaveProctorPin={async () => {
          if (proctorPin.trim().length < 4) {
            addLog("Proctor PIN update rejected: minimum 4 digits.");
            return;
          }
          const targetToken = generatedToken.trim().toUpperCase();
          if (!targetToken) {
            addLog("Proctor PIN update rejected: no student token selected.");
            return;
          }
          const effectiveDate = todayStamp();
          setTokenPinPolicies((prev) => ({
            ...prev,
            [targetToken]: {
              pin: proctorPin.trim(),
              effectiveDate,
            },
          }));
          setProctorPinEffectiveDate(effectiveDate);
          addLog(`Proctor PIN updated for student token ${targetToken}. effective_date=${effectiveDate}`);

          const backendSummary = await syncProctorPinToBackendForTokens([targetToken], proctorPin.trim());
          if (backendSummary.attempted === 0) {
            addLog("Proctor PIN synced locally only (backend token context not available).");
            return;
          }
          if (backendSummary.failed > 0) {
            addLog(
              `Proctor PIN backend sync partial. success=${backendSummary.success} failed=${backendSummary.failed}`
            );
            return;
          }
          addLog(`Backend proctor PIN synced for token ${targetToken}.`);
        }}
        onSaveProctorPinForAll={async () => {
          if (proctorPin.trim().length < 4) {
            addLog("Batch proctor PIN update rejected: minimum 4 digits.");
            return;
          }
          const batchTokens =
            generatedTokenBatch.length > 0
              ? generatedTokenBatch.map((entry) => entry.token)
              : tokenMonitorItems
                  .filter((entry) => entry.role === "student")
                  .map((entry) => entry.token);
          const tokens = normalizeTokenList(batchTokens);
          if (tokens.length === 0) {
            addLog("Batch proctor PIN update rejected: no student tokens available.");
            return;
          }

          const normalizedPin = proctorPin.trim();
          const effectiveDate = todayStamp();
          setTokenPinPolicies((prev) => {
            const next = { ...prev };
            tokens.forEach((token) => {
              next[token] = {
                pin: normalizedPin,
                effectiveDate,
              };
            });
            return next;
          });
          setProctorPinEffectiveDate(effectiveDate);
          addLog(`Batch proctor PIN saved locally. count=${tokens.length} effective_date=${effectiveDate}`);

          const base = normalizeBackendBaseUrl(backendBaseUrl);
          const primaryContext = getStudentTokenAdminContext(tokens[0]);
          if (base && primaryContext) {
            try {
              const response = await fetch(`${base}/session/proctor-pin/set-all`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  session_id: primaryContext.sessionId,
                  access_signature: primaryContext.accessSignature,
                  pin: normalizedPin,
                }),
              });
              const payload = await parseJsonResponse(response);
              const effectiveDateFromApi = String(payload.effective_date ?? "").trim();
              const updatedTokens = Number(payload.updated_tokens ?? tokens.length);
              if (effectiveDateFromApi) {
                setProctorPinEffectiveDate(effectiveDateFromApi);
              }
              setActiveAdminContext(primaryContext);
              setSessionId(primaryContext.sessionId);
              addLog(
                `Batch proctor PIN backend bulk sync finished. updated_tokens=${updatedTokens} effective_date=${effectiveDateFromApi || effectiveDate}`
              );
              return;
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              addLog(`Batch proctor PIN bulk sync failed, falling back to per-token sync. ${message}`);
            }
          }

          const backendSummary = await syncProctorPinToBackendForTokens(tokens, normalizedPin);
          if (backendSummary.attempted === 0) {
            addLog("Batch proctor PIN backend sync skipped (no backend token contexts found).");
            return;
          }
          addLog(
            `Batch proctor PIN backend sync finished. total=${tokens.length} attempted=${backendSummary.attempted} success=${backendSummary.success} failed=${backendSummary.failed} skipped=${backendSummary.skipped}`
          );
        }}
        onRevokeTokenInputChange={setRevokeTokenInput}
        onReactivateTokenInputChange={setReactivateTokenInput}
        onRevokeStudentToken={async () => {
          const targetToken = revokeTokenInput.trim().toUpperCase();
          if (!targetToken) {
            const message = tr(language, "Isi token siswa terlebih dahulu.", "Provide a student token first.");
            setRevokeTokenStatus(message);
            addLog("Student revoke rejected: empty token input.");
            return;
          }

          const base = normalizeBackendBaseUrl(backendBaseUrl);
          if (base && adminBackendSessionId && adminBackendAccessSignature) {
            try {
              const response = await fetch(`${base}/admin/revoke-student`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  session_id: adminBackendSessionId,
                  access_signature: adminBackendAccessSignature,
                  student_token: targetToken,
                  reason: "ADMIN_FORCE_LOGOUT",
                }),
              });
              await parseJsonResponse(response);

              setIssuedTokens((prev) =>
                prev.map((entry) =>
                  entry.token.toUpperCase() === targetToken
                    ? {
                        ...entry,
                        status: "revoked",
                        revokedReason: "ADMIN_FORCE_LOGOUT",
                        lastSeenAt: Date.now(),
                      }
                    : entry
                )
              );
              await loadAdminMonitor();

              const successMessage = tr(
                language,
                `Sesi siswa ${targetToken} berhasil direvoke di backend.`,
                `Student session ${targetToken} was revoked in backend.`
              );
              setRevokeTokenStatus(successMessage);
              addLog(`Backend revoke success: token=${targetToken}`);

              if (activeStudentToken.trim().toUpperCase() === targetToken && role === "student") {
                const reason = tr(
                  language,
                  "Sesi Anda direvoke oleh proktor.",
                  "Your session was revoked by the proctor."
                );
                setViolationReason(reason);
                setStatusMessage(reason);
                setScreen("ViolationScreen");
              }
              return;
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              setRevokeTokenStatus(
                tr(
                  language,
                  `Gagal revoke via backend: ${message}`,
                  `Backend revoke failed: ${message}`
                )
              );
              addLog(`Backend revoke failed: token=${targetToken} | ${message}`);
              return;
            }
          }

          const targetEntry = issuedTokens.find((entry) => entry.token.toUpperCase() === targetToken);
          if (!targetEntry) {
            const message = tr(language, "Token siswa tidak ditemukan.", "Student token not found.");
            setRevokeTokenStatus(message);
            addLog(`Student revoke failed: token not found (${targetToken}).`);
            return;
          }

          if (targetEntry.role !== "student") {
            const message = tr(
              language,
              "Token tersebut bukan token siswa.",
              "That token is not a student token."
            );
            setRevokeTokenStatus(message);
            addLog(`Student revoke failed: role mismatch (${targetToken}).`);
            return;
          }

          if (targetEntry.status === "revoked") {
            const message = tr(language, "Token sudah direvoke.", "Token is already revoked.");
            setRevokeTokenStatus(message);
            addLog(`Student revoke ignored: already revoked (${targetToken}).`);
            return;
          }

          setIssuedTokens((prev) =>
            prev.map((entry) =>
              entry.token.toUpperCase() === targetToken
                ? {
                    ...entry,
                    status: "revoked",
                    revokedReason: "ADMIN_FORCE_LOGOUT",
                    lastSeenAt: Date.now(),
                  }
                : entry
            )
          );

          const successMessage = tr(
            language,
            `Sesi siswa ${targetToken} berhasil direvoke (lokal).`,
            `Student session ${targetToken} has been revoked (local).`
          );
          setRevokeTokenStatus(successMessage);
          addLog(`Admin revoked local student token ${targetToken}.`);

          if (activeStudentToken.trim().toUpperCase() === targetToken && role === "student") {
            const reason = tr(
              language,
              "Sesi Anda direvoke oleh proktor.",
              "Your session was revoked by the proctor."
            );
            setViolationReason(reason);
            setStatusMessage(reason);
            setScreen("ViolationScreen");
          }
        }}
        onReactivateStudentToken={async () => {
          const targetToken = reactivateTokenInput.trim().toUpperCase();
          if (!targetToken) {
            const message = tr(language, "Isi token siswa terlebih dahulu.", "Provide a student token first.");
            setReactivateTokenStatus(message);
            addLog("Student reactivation rejected: empty token input.");
            return;
          }

          const base = normalizeBackendBaseUrl(backendBaseUrl);
          if (!base || !adminBackendSessionId || !adminBackendAccessSignature) {
            const message = tr(
              language,
              "Sesi admin backend belum aktif. Generate token admin terlebih dahulu.",
              "Backend admin session is not active yet. Generate an admin token first."
            );
            setReactivateTokenStatus(message);
            addLog(`Student reactivation failed: backend admin session missing (${targetToken}).`);
            return;
          }

          setReactivateTokenPending(true);
          try {
            const response = await fetch(`${base}/admin/reactivate-student`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                session_id: adminBackendSessionId,
                access_signature: adminBackendAccessSignature,
                student_token: targetToken,
              }),
            });
            const payload = await parseJsonResponse(response);
            const nextExpiryAt = typeof payload.expires_at === "string" ? Date.parse(payload.expires_at) : Number.NaN;

            setIssuedTokens((prev) =>
              prev.map((entry) =>
                entry.token.toUpperCase() === targetToken
                  ? {
                      ...entry,
                      status: "issued",
                      revokedReason: undefined,
                      expiresAt: Number.isFinite(nextExpiryAt) ? nextExpiryAt : entry.expiresAt,
                      lastSeenAt: Date.now(),
                    }
                  : entry
              )
            );
            setStudentTokenAdminContexts((prev) => {
              const next = { ...prev };
              delete next[targetToken];
              return next;
            });
            appendTokenActivityLog(
              targetToken,
              tr(
                language,
                "Token direaktivasi oleh proktor dan siap login ulang.",
                "Token was reactivated by the proctor and is ready for a fresh login."
              ),
              "success",
              {
                activityState: "waiting_claim",
              }
            );
            await loadAdminMonitor();

            const message = tr(
              language,
              `Token siswa ${targetToken} berhasil direaktivasi.`,
              `Student token ${targetToken} was reactivated successfully.`
            );
            setReactivateTokenStatus(message);
            addLog(`Student token reactivated: token=${targetToken}`);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            setReactivateTokenStatus(
              tr(
                language,
                `Gagal reaktivasi token: ${message}`,
                `Token reactivation failed: ${message}`
              )
            );
            addLog(`Student token reactivation failed: token=${targetToken} | ${message}`);
          } finally {
            setReactivateTokenPending(false);
          }
        }}
        onPauseSession={async () => {
          try {
            const payload = await callAdminControl("/admin/pause");
            if (!payload) {
              const message = tr(
                language,
                "Session backend admin belum aktif. Generate token dulu.",
                "Backend admin session is not active. Generate token first."
              );
              setSessionControlStatus(message);
              addLog("Pause session rejected: backend admin session missing.");
              return;
            }
            await loadAdminMonitor();
            const state = String(payload.session_state ?? "PAUSED");
            const message = tr(
              language,
              `Session berhasil di-pause (${state}).`,
              `Session paused successfully (${state}).`
            );
            setSessionControlStatus(message);
            addLog(`Admin paused session. state=${state}`);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            setSessionControlStatus(
              tr(
                language,
                `Gagal pause session: ${message}`,
                `Failed to pause session: ${message}`
              )
            );
            addLog(`Pause session failed: ${message}`);
          }
        }}
        onResumeSession={async () => {
          try {
            const payload = await callAdminControl("/admin/resume");
            if (!payload) {
              const message = tr(
                language,
                "Session backend admin belum aktif. Generate token dulu.",
                "Backend admin session is not active. Generate token first."
              );
              setSessionControlStatus(message);
              addLog("Resume session rejected: backend admin session missing.");
              return;
            }
            await loadAdminMonitor();
            const state = String(payload.session_state ?? "IN_PROGRESS");
            const message = tr(
              language,
              `Session berhasil di-resume (${state}).`,
              `Session resumed successfully (${state}).`
            );
            setSessionControlStatus(message);
            addLog(`Admin resumed session. state=${state}`);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            setSessionControlStatus(
              tr(
                language,
                `Gagal resume session: ${message}`,
                `Failed to resume session: ${message}`
              )
            );
            addLog(`Resume session failed: ${message}`);
          }
        }}
        onReissueSignature={async () => {
          try {
            const payload = await callAdminControl("/admin/reissue-signature");
            if (!payload) {
              const message = tr(
                language,
                "Session backend admin belum aktif. Generate token dulu.",
                "Backend admin session is not active. Generate token first."
              );
              setSessionControlStatus(message);
              addLog("Reissue signature rejected: backend admin session missing.");
              return;
            }
            await loadAdminMonitor();
            const bindingId = String(payload.binding_id ?? "");
            const state = String(payload.session_state ?? "IN_PROGRESS");
            const message = tr(
              language,
              `Signature siswa diterbitkan ulang (${state})${bindingId ? ` [${bindingId}]` : ""}.`,
              `Student signature reissued (${state})${bindingId ? ` [${bindingId}]` : ""}.`
            );
            setSessionControlStatus(message);
            addLog(`Admin reissued student signature. binding=${bindingId || "-"} state=${state}`);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            setSessionControlStatus(
              tr(
                language,
                `Gagal reissue signature: ${message}`,
                `Failed to reissue signature: ${message}`
              )
            );
            addLog(`Reissue signature failed: ${message}`);
          }
        }}
        onStopSession={async () => {
          const base = normalizeBackendBaseUrl(backendBaseUrl);
          if (!base || !adminBackendSessionId || !adminBackendAccessSignature) {
            const message = tr(
              language,
              "Session backend admin belum aktif. Generate token dulu.",
              "Backend admin session is not active. Generate token first."
            );
            setSessionControlStatus(message);
            addLog("Stop session rejected: backend admin session missing.");
            return;
          }
          try {
            const response = await fetch(`${base}/session/finish`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                session_id: adminBackendSessionId,
                access_signature: adminBackendAccessSignature,
              }),
            });
            await parseJsonResponse(response);
            addLog(`Admin stopped session: session=${adminBackendSessionId}`);
            setSessionControlStatus(
              tr(language, "Session berhasil dihentikan.", "Session stopped successfully.")
            );
            logoutToLogin();
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            setSessionControlStatus(
              tr(
                language,
                `Gagal menghentikan session: ${message}`,
                `Failed to stop session: ${message}`
              )
            );
            addLog(`Stop session failed: ${message}`);
          }
        }}
        onGenerateToken={async () => {
          const expiryMinutes = parseExpiryMinutes(tokenExpiryMinutes);
          const batchCount = parseTokenBatchCount(tokenBatchCount);
          const hasBackendTarget = Boolean(normalizeBackendBaseUrl(backendBaseUrl));

          type GeneratedBatchRuntimeItem = {
            token: string;
            expiresAt: number;
            sessionId?: string;
            adminAccessSignature?: string;
            adminBindingId?: string;
          };

          if (hasBackendTarget) {
            setGeneratedToken("");
            setGeneratedTokenExpiryAt("");

            const remote = await bootstrapBackendAdminSession(expiryMinutes, batchCount, sessionMode);
            const remoteExamMode: SessionMode = remote?.examMode ?? "BROWSER_LOCKDOWN";
            const generated: GeneratedBatchRuntimeItem[] = remote
              ? remote.studentTokens.map((token) => ({
                  token,
                  expiresAt: remote.studentExpiresAt,
                  sessionId: remote.sessionId,
                  adminAccessSignature: remote.adminAccessSignature,
                  adminBindingId: remote.adminBindingId,
                }))
              : [];

            if (generated.length === 0) {
              setRevokeTokenStatus(
                tr(
                  language,
                  "Gagal generate token dari backend. Cek ADMIN_CREATE_KEY dan koneksi backend.",
                  "Failed to generate token from backend. Check ADMIN_CREATE_KEY and backend connectivity."
                )
              );
              setSessionControlStatus(
                tr(
                  language,
                  "Kontrol session backend tidak aktif.",
                  "Backend session control is not active."
                )
              );
              addLog("No backend token issued. Previous generated token has been cleared.");
              return;
            }

            const primaryToken = generated[generated.length - 1];
            const generatedBatchLabels: AdminGeneratedTokenItem[] = generated.map((entry) => ({
              token: entry.token,
              expiresAt: formatTimestamp(entry.expiresAt),
            }));
            const generatedTokenSet = new Set(generated.map((entry) => entry.token.toUpperCase()));

            setGeneratedTokenBatch((prev) => mergeGeneratedTokenBatch(prev, generatedBatchLabels));
            setGeneratedToken(primaryToken.token);
            setGeneratedTokenExpiryAt(formatTimestamp(primaryToken.expiresAt));
            if (primaryToken.sessionId) {
              setSessionId(primaryToken.sessionId);
            }
            if (primaryToken.sessionId && primaryToken.adminAccessSignature) {
              setAdminBackendSessionId(primaryToken.sessionId);
              setAdminBackendAccessSignature(primaryToken.adminAccessSignature);
              setAdminBackendBindingId(primaryToken.adminBindingId ?? "");
            }
            setActiveExamMode(remoteExamMode);
            setStudentTokenAdminContexts((prev) => {
              const next: Record<string, StudentTokenAdminContext> = { ...prev };
              generated.forEach((entry) => {
                if (!entry.sessionId || !entry.adminAccessSignature) {
                  return;
                }
                next[entry.token.toUpperCase()] = {
                  sessionId: entry.sessionId,
                  accessSignature: entry.adminAccessSignature,
                  bindingId: entry.adminBindingId ?? "",
                };
              });
              return next;
            });
            setRevokeTokenStatus(
              tr(
                language,
                "Backend aktif. Revocation siap digunakan.",
                "Backend connected. Revocation is ready."
              )
            );
            setSessionControlStatus(
              tr(
                language,
                "Kontrol session backend aktif (pause/resume/reissue).",
                "Backend session control is active (pause/resume/reissue)."
              )
            );
            setIssuedTokens((prev) => {
              const next = prev.filter((entry) => !generatedTokenSet.has(entry.token.toUpperCase()));
              generated.forEach((entry) => {
                next.push({
                  token: entry.token,
                  role: "student",
                  expiresAt: entry.expiresAt,
                  source: "backend-session",
                  status: "issued",
                  ipAddress: "-",
                  deviceName: tr(language, "Belum login", "Not logged in"),
                  lastSeenAt: Date.now(),
                });
              });
              return next;
            });
            await loadAdminMonitor();
            addLog(
              `Backend student token batch generated: requested=${batchCount} issued=${generated.length} | mode=${remoteExamMode} | ttl=${expiryMinutes}m`
            );
            if (generated.length < batchCount) {
              addLog(
                `Backend batch generation partially completed. requested=${batchCount} issued=${generated.length}`
              );
            }
            return;
          }

          const generated: GeneratedBatchRuntimeItem[] = [];
          const generatedSet = new Set<string>();
          while (generated.length < batchCount) {
            const token = generateToken();
            if (generatedSet.has(token)) {
              continue;
            }
            generatedSet.add(token);
            generated.push({
              token,
              expiresAt: Date.now() + expiryMinutes * 60 * 1000,
            });
          }

          const generatedBatchLabels: AdminGeneratedTokenItem[] = generated.map((entry) => ({
            token: entry.token,
            expiresAt: formatTimestamp(entry.expiresAt),
          }));
          const primaryToken = generated[generated.length - 1];

          setGeneratedTokenBatch((prev) => mergeGeneratedTokenBatch(prev, generatedBatchLabels));
          setGeneratedToken(primaryToken.token);
          setGeneratedTokenExpiryAt(formatTimestamp(primaryToken.expiresAt));
          setActiveExamMode(sessionMode);
          setStudentTokenAdminContexts((prev) => {
            const next = { ...prev };
            generated.forEach((entry) => {
              delete next[entry.token.toUpperCase()];
            });
            return next;
          });
          setIssuedTokens((prev) => {
            const next = prev.filter((entry) => !generatedSet.has(entry.token.toUpperCase()));
            generated.forEach((entry) => {
              next.push({
                token: entry.token,
                role: "student",
                expiresAt: entry.expiresAt,
                source: "admin-dashboard",
                status: "issued",
                ipAddress: "-",
                deviceName: tr(language, "Belum login", "Not logged in"),
                lastSeenAt: Date.now(),
              });
            });
            return next;
          });
          addLog(
            `Admin generated local student token batch: count=${generated.length} | mode=${sessionMode} | ttl=${expiryMinutes}m`
          );
          setSessionControlStatus(
            tr(
              language,
              "Kontrol session backend belum aktif.",
              "Backend session control is not active."
            )
          );
        }}
        onCopyGeneratedToken={(overrideToken?: string) => {
          const tokenToCopy = (overrideToken ?? generatedToken).trim().toUpperCase();
          if (!tokenToCopy) {
            addLog("Copy token ignored: no generated student token.");
            return;
          }
          if (!safeCopyToClipboard(tokenToCopy)) {
            addLog("Copy token failed: clipboard module unavailable.");
            return;
          }
          addLog(`Student token copied to clipboard: ${tokenToCopy}`);
        }}
        onCopyAllGeneratedTokens={() => {
          if (generatedTokenBatch.length === 0) {
            addLog("Copy all tokens ignored: batch list is empty.");
            return;
          }
          const payload = generatedTokenBatch.map((entry) => entry.token).join("\n");
          if (!safeCopyToClipboard(payload)) {
            addLog("Copy all tokens failed: clipboard module unavailable.");
            return;
          }
          addLog(`Batch student tokens copied to clipboard: count=${generatedTokenBatch.length}`);
        }}
        onSelectGeneratedToken={(token: string) => {
          const normalized = token.trim().toUpperCase();
          if (!normalized) {
            return;
          }
          const selected = generatedTokenBatch.find(
            (entry) => entry.token.trim().toUpperCase() === normalized
          );
          setGeneratedToken(normalized);
          if (selected) {
            setGeneratedTokenExpiryAt(selected.expiresAt);
          }
          const context = getStudentTokenAdminContext(normalized);
          if (context) {
            setActiveAdminContext(context);
            setSessionId(context.sessionId);
          }
          addLog(`Active student token selected: ${normalized}`);
        }}
        onOpenWhitelist={() => setScreen("URLWhitelist")}
        onOpenQuizBuilder={() => setScreen("QuizTeacherScreen")}
        onOpenHistory={() => setScreen("HistoryScreen")}
        onOpenSettings={() => openSettingsFrom("AdminDashboardPanel")}
        onLogout={() => {
          addLog("Admin logged out.");
          markActiveIssuedTokenOffline();
          logoutToLogin();
        }}
      />
    );
  }

  if (screen === "QuizTeacherScreen") {
    return (
      <QuizTeacherScreen
        language={language}
        backendBaseUrl={backendBaseUrl}
        sessionId={adminBackendSessionId}
        accessSignature={adminBackendAccessSignature}
        cache={quizTeacherCache}
        onCacheChange={setQuizTeacherCache}
        onLog={addLog}
        onOpenQuestionBuilder={() => setScreen("QuizQuestionBuilderScreen")}
        onBack={() => setScreen("AdminDashboardPanel")}
      />
    );
  }

  if (screen === "QuizQuestionBuilderScreen") {
    return (
      <QuizQuestionBuilderScreen
        language={language}
        backendBaseUrl={backendBaseUrl}
        sessionId={adminBackendSessionId}
        accessSignature={adminBackendAccessSignature}
        cache={quizBuilderCache}
        onCacheChange={setQuizBuilderCache}
        onLog={addLog}
        onBack={() => setScreen("QuizTeacherScreen")}
      />
    );
  }

  if (screen === "URLWhitelist") {
    return (
      <URLWhitelist
        language={language}
        backendBaseUrl={backendBaseUrl}
        whitelistInput={whitelistInput}
        onWhitelistInputChange={setWhitelistInput}
        whitelist={whitelist}
        proctorPin={proctorPin}
        onProctorPinChange={setProctorPin}
        onAddUrl={async () => {
          const normalized = normalizeUrl(whitelistInput);
          if (!normalized) {
            addLog("Whitelist add blocked: empty URL.");
            return;
          }
          if (whitelist.includes(normalized)) {
            addLog(`Whitelist duplicate ignored: ${normalized}`);
            return;
          }
          setWhitelist((prev) => [...prev, normalized]);
          setWhitelistInput("");
          addLog(`Whitelist URL added: ${normalized}`);

          const base = normalizeBackendBaseUrl(backendBaseUrl);
          if (!base || !adminBackendSessionId || !adminBackendAccessSignature) {
            addLog("Whitelist saved locally only (backend admin session not active).");
            return;
          }

          try {
            const response = await fetch(`${base}/session/whitelist/add`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                session_id: adminBackendSessionId,
                access_signature: adminBackendAccessSignature,
                url: normalized,
              }),
            });
            await parseJsonResponse(response);
            addLog(`Whitelist synced to backend: ${normalized}`);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            addLog(`Whitelist backend sync failed: ${message}`);
          }
        }}
        onSavePin={() => {
          if (proctorPin.trim().length < 4) {
            addLog("Proctor PIN update rejected: minimum 4 digits.");
            return;
          }
          const targetToken = generatedToken.trim().toUpperCase();
          if (!targetToken) {
            addLog("Proctor PIN update rejected: no student token selected.");
            return;
          }
          const effectiveDate = todayStamp();
          setTokenPinPolicies((prev) => ({
            ...prev,
            [targetToken]: {
              pin: proctorPin.trim(),
              effectiveDate,
            },
          }));
          setProctorPinEffectiveDate(effectiveDate);
          addLog(`Proctor PIN updated for student token ${targetToken}. effective_date=${effectiveDate}`);
        }}
        onBack={() => setScreen("AdminDashboardPanel")}
      />
    );
  }

  if (screen === "HistoryScreen") {
    return <HistoryScreen language={language} logs={logs} onBack={() => setScreen("AdminDashboardPanel")} />;
  }

  if (screen === "DeveloperAccessScreen") {
    return (
      <DeveloperAccessScreen
        language={language}
        backendBaseUrl={backendBaseUrl}
        onBackendBaseUrlChange={setBackendBaseUrl}
        password={developerPassword}
        onPasswordChange={setDeveloperPassword}
        unlocked={developerUnlocked}
        kioskEnabled={kioskEnabled}
        violationSystemEnabled={violationSystemEnabled}
        splitScreenDetectionEnabled={splitScreenDetectionEnabled}
        screenshotAccessibilityEnabled={screenshotAccessibilityEnabled}
        onUnlock={() => {
          if (developerPassword.trim() === DEVELOPER_PASSWORD) {
            setDeveloperUnlocked(true);
            if (role === "guest") {
              setRole("developer");
            }
            addLog("Developer panel unlocked.");
            return;
          }
          addLog("Developer unlock failed.");
        }}
        onToggleKiosk={(value) => {
          if (!developerUnlocked) {
            return;
          }
          setKioskEnabled(value);
          addLog(`Kiosk mode changed to ${value ? "ON" : "OFF"}.`);
        }}
        onToggleViolationSystem={(value) => {
          if (!developerUnlocked) {
            return;
          }
          setViolationSystemEnabled(value);
          if (!value) {
            setShowIntegrityWarning(false);
          }
          addLog(`Violation system changed to ${value ? "ON" : "OFF"}.`);
        }}
        onToggleSplitScreenDetection={(value) => {
          if (!developerUnlocked) {
            return;
          }
          setSplitScreenDetectionEnabled(value);
          addLog(`Split-screen detection changed to ${value ? "ON" : "OFF"}.`);
        }}
        onToggleScreenshotAccessibility={(value) => {
          if (!developerUnlocked) {
            return;
          }
          setScreenshotAccessibilityEnabled(value);
          addLog(`Screenshot accessibility changed to ${value ? "ON" : "OFF"}.`);
        }}
        browserUrl={browserUrl}
        onBrowserUrlChange={setBrowserUrl}
        developerClaimTokenInput={developerClaimTokenInput}
        onDeveloperClaimTokenInputChange={setDeveloperClaimTokenInput}
        onDeveloperClaimToken={() => {
          void claimTokenFromDeveloperPanel();
        }}
        adminToken={generatedAdminToken}
        adminTokenExpiryAt={generatedAdminTokenExpiryAt}
        adminTokenExpiryMinutes={adminTokenExpiryMinutes}
        adminTokenBatchCount={adminTokenBatchCount}
        onAdminTokenExpiryMinutesChange={setAdminTokenExpiryMinutes}
        onAdminTokenBatchCountChange={setAdminTokenBatchCount}
        adminTokenBatch={adminGeneratedTokenBatch}
        onGenerateAdminToken={async () => {
          if (!developerUnlocked) {
            addLog("Generate admin token blocked: developer panel locked.");
            return;
          }
          const expiryMinutes = parseExpiryMinutes(adminTokenExpiryMinutes);
          const batchCount = parseAdminTokenBatchCount(adminTokenBatchCount);
          const hasBackendTarget = Boolean(normalizeBackendBaseUrl(backendBaseUrl));

          if (hasBackendTarget) {
            setGeneratedAdminToken("");
            setGeneratedAdminTokenExpiryAt("");
            let lastToken = "";
            let lastExpiry = "";
            for (let index = 0; index < batchCount; index += 1) {
              if (index > 0) {
                await delay(50);
              }
              const remoteAdmin = await createBackendAdminToken(expiryMinutes);
              if (!remoteAdmin) {
                addLog("Developer backend admin token generation failed.");
                return;
              }

              lastToken = remoteAdmin.adminToken;
              lastExpiry = formatTimestamp(remoteAdmin.adminExpiresAt);
              setGeneratedAdminToken(remoteAdmin.adminToken);
              setGeneratedAdminTokenExpiryAt(lastExpiry);
              setAdminGeneratedTokenBatch((prev) =>
                mergeGeneratedTokenBatch(prev, [
                  { token: remoteAdmin.adminToken, expiresAt: lastExpiry },
                ])
              );
              setIssuedTokens((prev) => {
                const next = prev.filter(
                  (entry) => entry.token.toUpperCase() !== remoteAdmin.adminToken.toUpperCase()
                );
                next.push({
                  token: remoteAdmin.adminToken,
                  role: "admin",
                  expiresAt: remoteAdmin.adminExpiresAt,
                  source: "backend-session",
                  status: "issued",
                  ipAddress: "-",
                  deviceName: tr(language, "Belum login", "Not logged in"),
                  lastSeenAt: Date.now(),
                });
                return next;
              });
              if (batchCount === 1) {
                addLog(
                  `Developer generated backend admin token: ${remoteAdmin.adminToken} | session=${remoteAdmin.sessionId} | ttl=${expiryMinutes}m | exp=${lastExpiry}`
                );
              }
            }
            if (batchCount > 1 && lastToken) {
              addLog(
                `Developer generated ${batchCount} backend admin tokens. last=${lastToken} | ttl=${expiryMinutes}m | exp=${lastExpiry}`
              );
            }
            return;
          }

          let lastToken = "";
          let lastExpiry = "";
          for (let index = 0; index < batchCount; index += 1) {
            if (index > 0) {
              await delay(50);
            }
            const token = generateAdminToken();
            const expiresAt = Date.now() + expiryMinutes * 60 * 1000;
            lastToken = token;
            lastExpiry = formatTimestamp(expiresAt);
            setGeneratedAdminToken(token);
            setGeneratedAdminTokenExpiryAt(lastExpiry);
            setAdminGeneratedTokenBatch((prev) =>
              mergeGeneratedTokenBatch(prev, [{ token, expiresAt: lastExpiry }])
            );
            setIssuedTokens((prev) => {
              const next = prev.filter((entry) => entry.token.toUpperCase() !== token.toUpperCase());
              next.push({
                token,
                role: "admin",
                expiresAt,
                source: "developer-panel",
                status: "issued",
                ipAddress: "-",
                deviceName: tr(language, "Belum login", "Not logged in"),
                lastSeenAt: Date.now(),
              });
              return next;
            });
            if (batchCount === 1) {
              addLog(
                `Developer generated LOCAL admin token (not backend): ${token} | ttl=${expiryMinutes}m | exp=${lastExpiry}`
              );
            }
          }
          if (batchCount > 1 && lastToken) {
            addLog(
              `Developer generated ${batchCount} LOCAL admin tokens (not backend). last=${lastToken} | ttl=${expiryMinutes}m | exp=${lastExpiry}`
            );
          }
        }}
        onCopyAllAdminTokens={() => {
          if (adminGeneratedTokenBatch.length === 0) {
            addLog("Copy all admin tokens ignored: batch list is empty.");
            return;
          }
          const payload = adminGeneratedTokenBatch.map((entry) => entry.token).join("\n");
          if (!safeCopyToClipboard(payload)) {
            addLog("Copy all admin tokens failed: clipboard module unavailable.");
            return;
          }
          addLog(`Batch admin tokens copied to clipboard: count=${adminGeneratedTokenBatch.length}`);
        }}
        onCopyAdminToken={() => {
          if (!generatedAdminToken) {
            addLog("Copy admin token ignored: no generated token.");
            return;
          }
          if (!safeCopyToClipboard(generatedAdminToken)) {
            addLog("Copy admin token failed: clipboard module unavailable.");
            return;
          }
          addLog(`Admin token copied to clipboard: ${generatedAdminToken}`);
        }}
        onOpenBrowserMode={() => {
          if (!developerUnlocked) {
            addLog("Developer browser mode blocked: panel locked.");
            return;
          }
          openExamFlow(browserUrl, "developer browser mode", true);
        }}
        onBack={() => setScreen(developerOrigin)}
      />
    );
  }

  if (screen === "Settings") {
    return (
      <Settings
        language={language}
        themeId={themeId}
        allowManualThemeSelection={allowManualThemeSelection}
        appVersionLabel={
          updateSnapshot
            ? `${updateSnapshot.current.versionName} (${updateSnapshot.current.versionCode})`
            : "1.0.1"
        }
        updateSummary={settingsUpdateSummary}
        statusBanner={statusBanner}
        onSelectLanguage={(nextLanguage) => {
          setLanguage(nextLanguage);
          if (role === "guest") {
            setStatusMessage(
              tr(nextLanguage, "Masukkan token sesi untuk melanjutkan.", "Enter session token to continue.")
            );
            setStudentAuthStatus(
              tr(nextLanguage, "Masukkan kredensial siswa.", "Enter student credentials.")
            );
            setRegisterStatus(
              tr(nextLanguage, "Lengkapi data registrasi siswa.", "Complete student registration data.")
            );
            setInAppQuizStatus(
              tr(nextLanguage, "Sinkronisasi daftar kuis.", "Syncing quiz list.")
            );
          }
          setPinStatus(
            tr(nextLanguage, "Masukkan PIN proktor untuk keluar browser.", "Enter proctor PIN to exit browser.")
          );
          setRevokeTokenStatus(
            tr(nextLanguage, "Masukkan token siswa untuk revoke.", "Enter a student token to revoke.")
          );
          setReactivateTokenStatus(
            tr(nextLanguage, "Masukkan token siswa untuk reaktivasi.", "Enter a student token to reactivate.")
          );
          setSessionControlStatus(
            tr(nextLanguage, "Kontrol sesi siap.", "Session control ready.")
          );
          addLog(
            tr(
              nextLanguage,
              `Bahasa diubah ke ${nextLanguage.toUpperCase()}.`,
              `Language switched to ${nextLanguage.toUpperCase()}.`
            )
          );
        }}
        onSelectTheme={(nextThemeId) => {
          setThemeId(nextThemeId);
          addLog(
            tr(
              language,
              `Tema UI diubah ke ${nextThemeId.toUpperCase()}.`,
              `UI theme switched to ${nextThemeId.toUpperCase()}.`
            )
          );
        }}
        onOpenUpdater={() => openUpdateFlowFrom("Settings")}
        onBack={() => setScreen(returnScreen)}
      />
    );
  }

  return null;
}
