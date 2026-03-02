import React, { Suspense, lazy, useEffect, useRef, useState } from "react";
import { Alert, BackHandler, DeviceEventEmitter, NativeModules, Platform } from "react-native";
import { AppLanguage, tr } from "./i18n";
import AdminDashboardPanel from "./screens/AdminDashboardPanel";
import type { AdminGeneratedTokenItem, AdminTokenMonitorItem } from "./screens/AdminDashboardPanel";
import DeveloperAccessScreen from "./screens/DeveloperAccessScreen";
import ExamSelectionScreen from "./screens/ExamSelectionScreen";
import HistoryScreen from "./screens/HistoryScreen";
import LoginScreen from "./screens/LoginScreen";
import ManualInputFail from "./screens/ManualInputFail";
import ManualInputScreen from "./screens/ManualInputScreen";
import Settings from "./screens/Settings";
import SplashScreen from "./screens/SplashScreen";
import SuccessScreen from "./screens/SuccessScreen";
import URLWhitelist from "./screens/URLWhitelist";
import ViolationScreen from "./screens/ViolationScreen";
import { ThemeId, getActiveThemeId, setActiveTheme } from "./screens/Layout";

const ExamBrowserScreen = lazy(() => import("./screens/ExamBrowserScreen"));
const QRScannerScreen = lazy(() => import("./screens/QRScannerScreen"));

type ScreenId =
  | "SplashScreen"
  | "LoginScreen"
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
  | "HistoryScreen"
  | "Settings";

type Role = "guest" | "student" | "admin" | "developer";
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

type BackendMonitorToken = {
  token: string;
  role?: "student" | "admin" | string | null;
  status?: IssuedTokenStatus | string | null;
  ipAddress?: string | null;
  deviceName?: string | null;
  expiresAt?: string | null;
  lastSeenAt?: string | null;
  ip_address?: string | null;
  device_name?: string | null;
  expires_at?: string | null;
  last_seen_at?: string | null;
};

type StudentTokenAdminContext = {
  sessionId: string;
  accessSignature: string;
  bindingId: string;
};

type AdminWorkspaceSnapshot = {
  version: 1;
  backendBaseUrl: string;
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

const STUDENT_TOKEN = "StudentID";
const ADMIN_TOKEN = "AdminID";
const DEVELOPER_PASSWORD = "EDU_DEV_ACCESS";
const DEFAULT_SESSION_EXPIRY_MINUTES = 120;
const BACKEND_ADMIN_CREATE_KEY = "ed9314856e2e74de0965f657da218b5531988e483f786bd377a68e41cc79cd02ba41b9f47d63c6b50f3c3fc6743010d15090d4bf98c1112a47e6271d449987fa";
const ADMIN_MONITOR_REFRESH_INTERVAL_MS = 1200;
const ADMIN_MONITOR_RETRY_INTERVAL_MS = 2500;
const ADMIN_WORKSPACE_SCHEMA_VERSION = 1;

const defaultWhitelist = ["https://example.org", "https://school.ac.id/exam"];
const DEFAULT_BACKEND_BASE_URL = "http://103.27.207.53:8091";

type ClipboardModuleShape = {
  setString?: (value: string) => void;
};

type EdufikaSecurityModuleShape = {
  getKioskEnabled?: () => Promise<boolean>;
  getViolationSystemEnabled?: () => Promise<boolean>;
  getSplitScreenDetectionEnabled?: () => Promise<boolean>;
  getAdminWorkspaceCache?: () => Promise<string>;
  getDeviceFingerprint?: () => Promise<string>;
  setKioskEnabled?: (enabled: boolean) => void;
  setViolationSystemEnabled?: (enabled: boolean) => void;
  setSplitScreenDetectionEnabled?: (enabled: boolean) => void;
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
  return withProtocol.replace(/\/+$/, "");
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

function parseTokenBatchCount(raw: string): number {
  const value = Number.parseInt(raw.trim(), 10);
  if (Number.isNaN(value)) {
    return 1;
  }
  return Math.min(300, Math.max(1, value));
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

export default function App() {
  const [screen, setScreen] = useState<ScreenId>("SplashScreen");
  const [returnScreen, setReturnScreen] = useState<ScreenId>("LoginScreen");
  const [developerOrigin, setDeveloperOrigin] = useState<ScreenId>("LoginScreen");
  const [role, setRole] = useState<Role>("guest");

  const [language, setLanguage] = useState<AppLanguage>("id");
  const [themeId, setThemeId] = useState<ThemeId>(getActiveThemeId());

  const [bootMessage, setBootMessage] = useState(
    tr("id", "Memulai modul keamanan...", "Bootstrapping secure module...")
  );
  const [statusMessage, setStatusMessage] = useState(
    tr("id", "Masukkan token sesi untuk melanjutkan.", "Enter session token to continue.")
  );

  const [tokenInput, setTokenInput] = useState("");
  const [generatedToken, setGeneratedToken] = useState("");
  const [generatedTokenExpiryAt, setGeneratedTokenExpiryAt] = useState("");
  const [tokenBatchCount, setTokenBatchCount] = useState("1");
  const [generatedTokenBatch, setGeneratedTokenBatch] = useState<AdminGeneratedTokenItem[]>([]);
  const [tokenExpiryMinutes, setTokenExpiryMinutes] = useState("120");
  const [generatedAdminToken, setGeneratedAdminToken] = useState("");
  const [generatedAdminTokenExpiryAt, setGeneratedAdminTokenExpiryAt] = useState("");
  const [adminTokenExpiryMinutes, setAdminTokenExpiryMinutes] = useState("120");
  const [issuedTokens, setIssuedTokens] = useState<IssuedToken[]>([]);
  const [activeIssuedToken, setActiveIssuedToken] = useState("");
  const [tokenPinPolicies, setTokenPinPolicies] = useState<Record<string, TokenPinPolicy>>({});
  const [tokenLaunchPolicies, setTokenLaunchPolicies] = useState<Record<string, TokenLaunchPolicy>>({});
  const [tokenLaunchUrlInput, setTokenLaunchUrlInput] = useState("");
  const [revokeTokenInput, setRevokeTokenInput] = useState("");
  const [revokeTokenStatus, setRevokeTokenStatus] = useState(
    tr("id", "Masukkan token siswa untuk revoke.", "Enter a student token to revoke.")
  );
  const [sessionControlStatus, setSessionControlStatus] = useState(
    tr("id", "Kontrol sesi siap.", "Session control ready.")
  );
  const [activeStudentToken, setActiveStudentToken] = useState("");
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
  const [browserUrl, setBrowserUrl] = useState("https://example.org");
  const [developerClaimTokenInput, setDeveloperClaimTokenInput] = useState("");
  const [backendBaseUrl, setBackendBaseUrl] = useState(DEFAULT_BACKEND_BASE_URL);
  const [deviceFingerprint, setDeviceFingerprint] = useState("rn-device-unknown");
  const [kioskReady, setKioskReady] = useState(false);
  const [studentBackendAccessSignature, setStudentBackendAccessSignature] = useState("");
  const [studentBackendBindingId, setStudentBackendBindingId] = useState("");
  const [adminBackendSessionId, setAdminBackendSessionId] = useState("");
  const [adminBackendAccessSignature, setAdminBackendAccessSignature] = useState("");
  const [adminBackendBindingId, setAdminBackendBindingId] = useState("");
  const [studentTokenAdminContexts, setStudentTokenAdminContexts] = useState<Record<string, StudentTokenAdminContext>>({});
  const [backendMonitorItems, setBackendMonitorItems] = useState<AdminTokenMonitorItem[]>([]);
  const [backendMonitorError, setBackendMonitorError] = useState("");
  const [adminDashboardTab, setAdminDashboardTab] = useState<"monitor" | "tokens" | "logs">("monitor");
  const multiWindowWatchLoggedRef = useRef(false);
  const adminMonitorFetchInFlightRef = useRef(false);
  const adminWorkspaceHydratedRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setBootMessage(tr(language, "Semua layanan inti aktif.", "All core services online."));
      setScreen("LoginScreen");
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let mounted = true;
    const hydrateKiosk = async () => {
      try {
        const [nativeKiosk, nativeViolationSystem, nativeSplitScreen] = await Promise.all([
          securityModule?.getKioskEnabled?.(),
          securityModule?.getViolationSystemEnabled?.(),
          securityModule?.getSplitScreenDetectionEnabled?.(),
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
        const parsed = JSON.parse(String(rawSnapshot ?? "{}")) as Partial<AdminWorkspaceSnapshot>;
        if (parsed.version !== ADMIN_WORKSPACE_SCHEMA_VERSION) {
          return;
        }
        if (typeof parsed.backendBaseUrl === "string" && parsed.backendBaseUrl.trim()) {
          setBackendBaseUrl(parsed.backendBaseUrl.trim());
        }
        if (typeof parsed.generatedToken === "string") {
          setGeneratedToken(parsed.generatedToken);
        }
        if (typeof parsed.generatedTokenExpiryAt === "string") {
          setGeneratedTokenExpiryAt(parsed.generatedTokenExpiryAt);
        }
        if (typeof parsed.tokenBatchCount === "string" && parsed.tokenBatchCount.trim()) {
          setTokenBatchCount(parsed.tokenBatchCount.trim());
        }
        if (typeof parsed.tokenExpiryMinutes === "string" && parsed.tokenExpiryMinutes.trim()) {
          setTokenExpiryMinutes(parsed.tokenExpiryMinutes.trim());
        }
        if (Array.isArray(parsed.generatedTokenBatch)) {
          setGeneratedTokenBatch(parsed.generatedTokenBatch.filter((item) => (
            item &&
            typeof item.token === "string" &&
            typeof item.expiresAt === "string"
          )));
        }
        if (Array.isArray(parsed.issuedTokens)) {
          setIssuedTokens(parsed.issuedTokens);
        }
        if (parsed.tokenPinPolicies && typeof parsed.tokenPinPolicies === "object") {
          setTokenPinPolicies(parsed.tokenPinPolicies as Record<string, TokenPinPolicy>);
        }
        if (parsed.tokenLaunchPolicies && typeof parsed.tokenLaunchPolicies === "object") {
          setTokenLaunchPolicies(parsed.tokenLaunchPolicies as Record<string, TokenLaunchPolicy>);
        }
        if (typeof parsed.tokenLaunchUrlInput === "string") {
          setTokenLaunchUrlInput(parsed.tokenLaunchUrlInput);
        }
        if (typeof parsed.proctorPin === "string" && parsed.proctorPin.trim()) {
          setProctorPin(parsed.proctorPin.trim());
        }
        if (typeof parsed.proctorPinEffectiveDate === "string") {
          setProctorPinEffectiveDate(parsed.proctorPinEffectiveDate);
        }
        if (typeof parsed.adminBackendSessionId === "string") {
          setAdminBackendSessionId(parsed.adminBackendSessionId);
        }
        if (typeof parsed.adminBackendAccessSignature === "string") {
          setAdminBackendAccessSignature(parsed.adminBackendAccessSignature);
        }
        if (typeof parsed.adminBackendBindingId === "string") {
          setAdminBackendBindingId(parsed.adminBackendBindingId);
        }
        if (parsed.studentTokenAdminContexts && typeof parsed.studentTokenAdminContexts === "object") {
          setStudentTokenAdminContexts(
            parsed.studentTokenAdminContexts as Record<string, StudentTokenAdminContext>
          );
        }
        if (Array.isArray(parsed.backendMonitorItems)) {
          setBackendMonitorItems(parsed.backendMonitorItems);
        }
      } catch {
        // Ignore invalid/empty cache payload and continue with runtime defaults.
      } finally {
        adminWorkspaceHydratedRef.current = true;
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
    const snapshot: AdminWorkspaceSnapshot = {
      version: ADMIN_WORKSPACE_SCHEMA_VERSION,
      backendBaseUrl,
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
    };
    runSecurityCall(() =>
      securityModule?.setAdminWorkspaceCache?.(JSON.stringify(snapshot))
    );
  }, [
    adminBackendAccessSignature,
    adminBackendBindingId,
    adminBackendSessionId,
    backendBaseUrl,
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
  ]);

  useEffect(() => {
    if (!kioskReady) {
      return;
    }
    runSecurityCall(() => securityModule?.setKioskEnabled?.(kioskEnabled));
    runSecurityCall(() => securityModule?.setViolationSystemEnabled?.(violationSystemEnabled));
    runSecurityCall(() => securityModule?.setSplitScreenDetectionEnabled?.(splitScreenDetectionEnabled));
  }, [kioskEnabled, kioskReady, splitScreenDetectionEnabled, violationSystemEnabled]);

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
    if (riskScore >= 12 && role === "student" && screen === "ExamBrowserScreen") {
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

    runSecurityCall(() =>
      securityModule?.syncStudentSession?.(
        tokenForSync,
        sessionIdForSync,
        signatureForSync || `rn-local-signature-${tokenForSync}`,
        bindingForSync || `rn-local-binding-${tokenForSync}`,
        sessionExpiresAt ?? 0,
        examUrl,
        screen === "ExamBrowserScreen"
      )
    );

    if (screen === "ExamBrowserScreen" && signatureForSync && bindingForSync && violationSystemEnabled) {
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
    if (screen !== "AdminDashboardPanel" || adminDashboardTab !== "monitor") {
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

  const addLog = (message: string) => {
    setLogs((prev) => [makeLogLine(message), ...prev].slice(0, 120));
  };

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
  }, [activeStudentToken, backendBaseUrl, language, role, sessionId, studentBackendAccessSignature, violationSystemEnabled]);

  useEffect(() => {
    const shouldWatchMultiWindow =
      role === "student" &&
      screen === "ExamBrowserScreen" &&
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
      const message =
        typeof payload?.error === "string"
          ? payload.error
          : `HTTP ${response.status}`;
      throw new Error(message);
    }
    return payload;
  };

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
          return {
            token: tokenValue,
            role: roleRaw === "admin" ? "admin" : "student",
            status: normalizedStatus,
            ipAddress: entry.ipAddress ?? entry.ip_address ?? "-",
            deviceName:
              entry.deviceName ??
              entry.device_name ??
              tr(language, "Belum terdaftar", "Not registered yet"),
            expiresAtLabel: formatIsoLabel(entry.expiresAt ?? entry.expires_at),
            lastSeenLabel: formatIsoLabel(entry.lastSeenAt ?? entry.last_seen_at),
          };
        })
        .filter((entry): entry is AdminTokenMonitorItem => entry !== null);
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

    let activeContext: StudentTokenAdminContext = {
      sessionId: adminBackendSessionId,
      accessSignature: adminBackendAccessSignature,
      bindingId: adminBackendBindingId,
    };

    try {
      const mapped = await fetchMonitorPayload(activeContext);
      setBackendMonitorItems(mapped);
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
            const mapped = await fetchMonitorPayload(activeContext);
            setBackendMonitorItems(mapped);
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
    studentTokenCount = 1
  ): Promise<{
    sessionId: string;
    studentTokens: string[];
    studentExpiresAt: number;
    adminAccessSignature: string;
    adminBindingId: string;
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
        }),
      });
      const created = await parseJsonResponse(createdResponse);
      const sessionIdFromApi = String(created.session_id ?? "");
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
    };
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

  const clearAdminWorkspaceState = () => {
    setGeneratedToken("");
    setGeneratedTokenExpiryAt("");
    setGeneratedTokenBatch([]);
    setTokenBatchCount("1");
    setIssuedTokens([]);
    setTokenPinPolicies({});
    setTokenLaunchPolicies({});
    setTokenLaunchUrlInput("");
    setProctorPin("4321");
    setProctorPinEffectiveDate("");
    setAdminBackendSessionId("");
    setAdminBackendAccessSignature("");
    setAdminBackendBindingId("");
    setStudentTokenAdminContexts({});
    setBackendMonitorItems([]);
    setBackendMonitorError("");
    setRevokeTokenInput("");
    setRevokeTokenStatus(tr(language, "Masukkan token siswa untuk revoke.", "Enter a student token to revoke."));
    setSessionControlStatus(tr(language, "Kontrol sesi siap.", "Session control ready."));
    runSecurityCall(() => securityModule?.clearAdminWorkspaceCache?.());
  };

  const logoutToLogin = (options?: { clearAdminWorkspace?: boolean }) => {
    const clearAdminWorkspace = options?.clearAdminWorkspace ?? false;
    markActiveIssuedTokenOffline();
    runSecurityCall(() => securityModule?.stopViolationAlarm?.());
    runSecurityCall(() => securityModule?.stopHeartbeat?.());
    runSecurityCall(() => securityModule?.clearSession?.());
    setRole("guest");
    setTokenInput("");
    setActiveStudentToken("");
    setStudentBackendAccessSignature("");
    setStudentBackendBindingId("");
    setBypassWhitelist(false);
    setPinAttempt("");
    setSessionExpiresAt(null);
    setSessionTimeLeftLabel("--:--:--");
    setSessionExpiryHandled(false);
    setRiskScore(0);
    setSessionId(generateSessionId());
    setShowIntegrityWarning(false);
    setIntegrityMessage(
      tr(
        language,
        "Perilaku mencurigakan terdeteksi. Aktivitas tercatat untuk proktor.",
        "Suspicious behavior detected. Activity has been logged for proctor review."
      )
    );
    setDeveloperUnlocked(false);
    setDeveloperOrigin("LoginScreen");
    setDeveloperClaimTokenInput("");
    if (clearAdminWorkspace) {
      clearAdminWorkspaceState();
    }
    setStatusMessage(tr(language, "Masukkan token sesi untuk melanjutkan.", "Enter session token to continue."));
    setScreen("LoginScreen");
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
    if (token === STUDENT_TOKEN) {
      setRole("student");
      setActiveIssuedToken("");
      setActiveStudentToken(token.toUpperCase());
      setStudentBackendAccessSignature("");
      setStudentBackendBindingId("");
      setSessionId(generateSessionId());
      setSessionExpiresAt(Date.now() + DEFAULT_SESSION_EXPIRY_MINUTES * 60 * 1000);
      setSessionExpiryHandled(false);
      setRiskScore(0);
      setStatusMessage(tr(language, "Login siswa berhasil.", "Student login successful."));
      addLog("Student authenticated using StudentID.");
      setScreen("ExamSelectionScreen");
      return;
    }

    if (token === ADMIN_TOKEN) {
      setRole("admin");
      setActiveIssuedToken("");
      setActiveStudentToken("");
      setStudentBackendAccessSignature("");
      setStudentBackendBindingId("");
      setSessionId(generateSessionId());
      setSessionExpiresAt(Date.now() + DEFAULT_SESSION_EXPIRY_MINUTES * 60 * 1000);
      setSessionExpiryHandled(false);
      setRiskScore(0);
      setStatusMessage(tr(language, "Login admin/proktor berhasil.", "Admin/proctor login successful."));
      addLog("Admin authenticated using AdminID.");
      setScreen("AdminDashboardPanel");
      return;
    }

    if (token === DEVELOPER_PASSWORD) {
      setRole("developer");
      setActiveIssuedToken("");
      setActiveStudentToken("");
      setStudentBackendAccessSignature("");
      setStudentBackendBindingId("");
      setSessionId(generateSessionId());
      setSessionExpiresAt(Date.now() + DEFAULT_SESSION_EXPIRY_MINUTES * 60 * 1000);
      setSessionExpiryHandled(false);
      setRiskScore(0);
      setDeveloperOrigin("LoginScreen");
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
        setRiskScore(0);
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
        setScreen(resolvedRole === "admin" ? "AdminDashboardPanel" : "ExamSelectionScreen");
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
      setRole(resolvedRole);
      setActiveIssuedToken(token.toUpperCase());
      setActiveStudentToken(resolvedRole === "student" ? token.toUpperCase() : "");
      setStudentBackendAccessSignature("");
      setStudentBackendBindingId("");
      setSessionId(generateSessionId());
      setSessionExpiresAt(issued.expiresAt);
      setSessionExpiryHandled(false);
      setRiskScore(0);
      updateIssuedToken(issued.token, {
        status: "online",
        ipAddress: resolvedRole === "admin" ? "192.168.1.11" : "192.168.1.23",
        deviceName: resolvedRole === "admin" ? "Proctor Console" : "Android Student Device",
        lastSeenAt: Date.now(),
      });
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
      setScreen(resolvedRole === "admin" ? "AdminDashboardPanel" : "ExamSelectionScreen");
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
    .map((entry) => ({
      token: entry.token,
      role: entry.role,
      status: resolveIssuedTokenStatus(entry),
      ipAddress: entry.ipAddress || "-",
      deviceName: entry.deviceName || tr(language, "Belum terdaftar", "Not registered yet"),
      expiresAtLabel: formatTimestamp(entry.expiresAt),
      lastSeenLabel: formatTimestamp(entry.lastSeenAt),
    }));
  const hasBackendMonitorContext = Boolean(adminBackendSessionId && adminBackendAccessSignature);
  const tokenMonitorItems: AdminTokenMonitorItem[] =
    hasBackendMonitorContext ? backendMonitorItems : localTokenMonitorItems;

  if (screen === "SplashScreen") {
    return <SplashScreen bootMessage={bootMessage} language={language} />;
  }

  if (screen === "LoginScreen") {
    return (
      <LoginScreen
        language={language}
        token={tokenInput}
        statusMessage={statusMessage}
        onTokenChange={setTokenInput}
        onSubmit={handleLogin}
        onOpenSettings={() => openSettingsFrom("LoginScreen")}
        onExitApp={() => {
          runSecurityCall(() => securityModule?.exitApp?.());
          BackHandler.exitApp();
        }}
      />
    );
  }

  if (screen === "ExamSelectionScreen") {
    return (
      <ExamSelectionScreen
        language={language}
        onScanQr={() => setScreen("QRScannerScreen")}
        onManualInput={() => setScreen("ManualInputScreen")}
        onLogout={() => {
          addLog("Student logged out.");
          logoutToLogin();
        }}
        onOpenSettings={() => openSettingsFrom("ExamSelectionScreen")}
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
        logs={logs}
        onTabChange={setAdminDashboardTab}
        onTokenBatchCountChange={setTokenBatchCount}
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
            logoutToLogin({ clearAdminWorkspace: true });
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
            setGeneratedTokenBatch([]);

            const remote = await bootstrapBackendAdminSession(expiryMinutes, batchCount);
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

            setGeneratedTokenBatch(generatedBatchLabels);
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
              `Backend student token batch generated: requested=${batchCount} issued=${generated.length} | ttl=${expiryMinutes}m`
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

          setGeneratedTokenBatch(generatedBatchLabels);
          setGeneratedToken(primaryToken.token);
          setGeneratedTokenExpiryAt(formatTimestamp(primaryToken.expiresAt));
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
            `Admin generated local student token batch: count=${generated.length} | ttl=${expiryMinutes}m`
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
        onAdminTokenExpiryMinutesChange={setAdminTokenExpiryMinutes}
        onGenerateAdminToken={async () => {
          if (!developerUnlocked) {
            addLog("Generate admin token blocked: developer panel locked.");
            return;
          }
          const expiryMinutes = parseExpiryMinutes(adminTokenExpiryMinutes);
          const hasBackendTarget = Boolean(normalizeBackendBaseUrl(backendBaseUrl));

          if (hasBackendTarget) {
            setGeneratedAdminToken("");
            setGeneratedAdminTokenExpiryAt("");
            const remoteAdmin = await createBackendAdminToken(expiryMinutes);
            if (!remoteAdmin) {
              addLog("Developer backend admin token generation failed.");
              return;
            }

            setGeneratedAdminToken(remoteAdmin.adminToken);
            setGeneratedAdminTokenExpiryAt(formatTimestamp(remoteAdmin.adminExpiresAt));
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
            addLog(
              `Developer generated backend admin token: ${remoteAdmin.adminToken} | session=${remoteAdmin.sessionId} | ttl=${expiryMinutes}m | exp=${formatTimestamp(remoteAdmin.adminExpiresAt)}`
            );
            return;
          }

          const token = generateAdminToken();
          const expiresAt = Date.now() + expiryMinutes * 60 * 1000;
          setGeneratedAdminToken(token);
          setGeneratedAdminTokenExpiryAt(formatTimestamp(expiresAt));
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
          addLog(
            `Developer generated LOCAL admin token (not backend): ${token} | ttl=${expiryMinutes}m | exp=${formatTimestamp(expiresAt)}`
          );
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
        onSelectLanguage={(nextLanguage) => {
          setLanguage(nextLanguage);
          if (role === "guest") {
            setStatusMessage(
              tr(nextLanguage, "Masukkan token sesi untuk melanjutkan.", "Enter session token to continue.")
            );
          }
          setPinStatus(
            tr(nextLanguage, "Masukkan PIN proktor untuk keluar browser.", "Enter proctor PIN to exit browser.")
          );
          setRevokeTokenStatus(
            tr(nextLanguage, "Masukkan token siswa untuk revoke.", "Enter a student token to revoke.")
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
        onBack={() => setScreen(returnScreen)}
      />
    );
  }

  return null;
}
