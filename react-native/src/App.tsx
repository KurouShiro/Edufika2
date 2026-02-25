import React, { Suspense, lazy, useEffect, useState } from "react";
import { Alert, BackHandler, DeviceEventEmitter, NativeModules } from "react-native";
import { AppLanguage, tr } from "./i18n";
import AdminDashboardPanel, { AdminTokenMonitorItem } from "./screens/AdminDashboardPanel";
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

type TokenPinStatus = {
  configured: boolean;
  isActiveToday: boolean;
  effectiveDate: string;
};

type TokenLaunchPolicy = {
  url: string;
  updatedAt: string;
};

type BackendMonitorToken = {
  token: string;
  role: "student" | "admin";
  status: IssuedTokenStatus;
  ipAddress?: string | null;
  deviceName?: string | null;
  expiresAt?: string | null;
  lastSeenAt?: string | null;
};

const STUDENT_TOKEN = "StudentID";
const ADMIN_TOKEN = "AdminID";
const DEVELOPER_PASSWORD = "EDU_DEV_ACCESS";
const DEFAULT_SESSION_EXPIRY_MINUTES = 120;
const BACKEND_ADMIN_CREATE_KEY = "ed9314856e2e74de0965f657da218b5531988e483f786bd377a68e41cc79cd02ba41b9f47d63c6b50f3c3fc6743010d15090d4bf98c1112a47e6271d449987fa";

const defaultWhitelist = ["https://example.org", "https://school.ac.id/exam"];
const DEFAULT_BACKEND_BASE_URL = "https://merrilee-interangular-ula.ngrok-free.dev";

type ClipboardModuleShape = {
  setString?: (value: string) => void;
};

type EdufikaSecurityModuleShape = {
  getKioskEnabled?: () => Promise<boolean>;
  setKioskEnabled?: (enabled: boolean) => void;
  syncStudentSession?: (
    token: string,
    sessionId: string,
    accessSignature: string,
    deviceBindingId: string,
    expiresAtMillis: number,
    examUrl: string
  ) => void;
  clearSession?: () => void;
  startHeartbeat?: () => void;
  stopHeartbeat?: () => void;
  triggerViolationAlarm?: () => void;
  stopViolationAlarm?: () => void;
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
  const [tokenExpiryMinutes, setTokenExpiryMinutes] = useState("120");
  const [generatedAdminToken, setGeneratedAdminToken] = useState("");
  const [generatedAdminTokenExpiryAt, setGeneratedAdminTokenExpiryAt] = useState("");
  const [adminTokenExpiryMinutes, setAdminTokenExpiryMinutes] = useState("120");
  const [issuedTokens, setIssuedTokens] = useState<IssuedToken[]>([]);
  const [activeIssuedToken, setActiveIssuedToken] = useState("");
  const [tokenPinStatuses, setTokenPinStatuses] = useState<Record<string, TokenPinStatus>>({});
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
  const [browserUrl, setBrowserUrl] = useState("https://example.org");
  const [backendBaseUrl, setBackendBaseUrl] = useState(DEFAULT_BACKEND_BASE_URL);
  const [kioskReady, setKioskReady] = useState(false);
  const [studentBackendAccessSignature, setStudentBackendAccessSignature] = useState("");
  const [studentBackendBindingId, setStudentBackendBindingId] = useState("");
  const [adminBackendSessionId, setAdminBackendSessionId] = useState("");
  const [adminBackendAccessSignature, setAdminBackendAccessSignature] = useState("");
  const [adminBackendBindingId, setAdminBackendBindingId] = useState("");
  const [backendMonitorItems, setBackendMonitorItems] = useState<AdminTokenMonitorItem[]>([]);
  const [backendMonitorError, setBackendMonitorError] = useState("");

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
        const nativeValue = await securityModule?.getKioskEnabled?.();
        if (mounted && typeof nativeValue === "boolean") {
          setKioskEnabled(nativeValue);
        }
      } catch {
        // Keep default kiosk value when native bridge is unavailable.
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
    if (!kioskReady) {
      return;
    }
    runSecurityCall(() => securityModule?.setKioskEnabled?.(kioskEnabled));
  }, [kioskEnabled, kioskReady]);

  useEffect(() => {
    setActiveTheme(themeId);
  }, [themeId]);

  useEffect(() => {
    if (screen !== "ExamBrowserScreen") {
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
  }, [language, riskScore, role, screen]);

  useEffect(() => {
    if (screen === "ViolationScreen") {
      runSecurityCall(() => securityModule?.triggerViolationAlarm?.());
      return;
    }
    runSecurityCall(() => securityModule?.stopViolationAlarm?.());
  }, [screen]);

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
        examUrl
      )
    );

    if (screen === "ExamBrowserScreen" && signatureForSync && bindingForSync) {
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
  ]);

  useEffect(() => {
    if (screen !== "AdminDashboardPanel") {
      return undefined;
    }
    if (!adminBackendSessionId || !adminBackendAccessSignature) {
      return undefined;
    }

    let active = true;
    const poll = async () => {
      if (!active) {
        return;
      }
      await loadAdminMonitor();
    };

    void poll();
    const timer = setInterval(() => {
      void poll();
    }, 5000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [screen, adminBackendSessionId, adminBackendAccessSignature, backendBaseUrl]);

  const addLog = (message: string) => {
    setLogs((prev) => [makeLogLine(message), ...prev].slice(0, 120));
  };

  useEffect(() => {
    const lockSubscription = DeviceEventEmitter.addListener(
      "EdufikaSessionLocked",
      (payload: { reason?: string }) => {
        const reason =
          typeof payload?.reason === "string" && payload.reason.trim()
            ? payload.reason.trim()
            : tr(
                language,
                "Session dikunci oleh sistem keamanan.",
                "Session has been locked by security system."
              );
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
  }, [language]);

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

  const fetchBackendWhitelistForSession = async (sessionIdValue: string): Promise<string[]> => {
    const base = normalizeBackendBaseUrl(backendBaseUrl);
    const normalizedSessionId = sessionIdValue.trim();
    if (!base || !normalizedSessionId) {
      return [];
    }

    const query = new URLSearchParams({ session_id: normalizedSessionId });
    const response = await fetch(`${base}/session/whitelist?${query.toString()}`, {
      method: "GET",
    });
    const payload = await parseJsonResponse(response);
    if (!Array.isArray(payload.whitelist)) {
      return [];
    }
    return payload.whitelist
      .map((value: unknown) => normalizeUrl(value))
      .filter((value: string) => Boolean(value));
  };

  const fetchBackendLaunchUrlForSession = async (
    sessionIdValue: string,
    accessSignatureValue: string
  ): Promise<string> => {
    const base = normalizeBackendBaseUrl(backendBaseUrl);
    const normalizedSessionId = sessionIdValue.trim();
    const normalizedSignature = accessSignatureValue.trim();
    if (!base || !normalizedSessionId || !normalizedSignature) {
      return "";
    }

    const query = new URLSearchParams({ session_id: normalizedSessionId });
    const response = await fetch(`${base}/exam/launch?${query.toString()}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${normalizedSignature}`,
      },
    });
    const payload = await parseJsonResponse(response);
    return normalizeUrl(payload.launch_url);
  };

  const fetchBackendPinStatusForToken = async (
    sessionIdValue: string,
    accessSignatureValue: string,
    studentTokenValue: string
  ): Promise<TokenPinStatus | null> => {
    const base = normalizeBackendBaseUrl(backendBaseUrl);
    const normalizedSessionId = sessionIdValue.trim();
    const normalizedSignature = accessSignatureValue.trim();
    const normalizedStudentToken = studentTokenValue.trim().toUpperCase();
    if (!base || !normalizedSessionId || !normalizedSignature || !normalizedStudentToken) {
      return null;
    }

    const query = new URLSearchParams({
      session_id: normalizedSessionId,
      student_token: normalizedStudentToken,
    });
    const response = await fetch(`${base}/session/proctor-pin/status?${query.toString()}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${normalizedSignature}`,
      },
    });
    const payload = await parseJsonResponse(response);
    const effectiveDate = String(payload.effective_date ?? "").trim();
    return {
      configured: Boolean(payload.configured),
      isActiveToday: Boolean(payload.is_active_today),
      effectiveDate,
    };
  };

  const syncTokenPinStatusFromBackend = async (studentTokenValue: string): Promise<boolean> => {
    const normalizedToken = studentTokenValue.trim().toUpperCase();
    if (!normalizedToken || !adminBackendSessionId || !adminBackendAccessSignature) {
      return false;
    }

    try {
      const status = await fetchBackendPinStatusForToken(
        adminBackendSessionId,
        adminBackendAccessSignature,
        normalizedToken
      );
      if (!status) {
        return false;
      }
      setTokenPinStatuses((prev) => ({
        ...prev,
        [normalizedToken]: status,
      }));
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      addLog(`Backend PIN status sync failed: token=${normalizedToken} reason=${message}`);
      return false;
    }
  };

  const loadAdminMonitor = async (): Promise<boolean> => {
    const base = normalizeBackendBaseUrl(backendBaseUrl);
    if (!base || !adminBackendSessionId || !adminBackendAccessSignature) {
      return false;
    }

    try {
      const query = new URLSearchParams({
        session_id: adminBackendSessionId,
      });
      const response = await fetch(`${base}/admin/monitor?${query.toString()}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${adminBackendAccessSignature}`,
        },
      });
      const payload = await parseJsonResponse(response);
      const remoteTokens: BackendMonitorToken[] = Array.isArray(payload.tokens) ? payload.tokens : [];

      const mapped: AdminTokenMonitorItem[] = remoteTokens.map((entry) => {
        const rawStatus = String(entry.status ?? "issued").toLowerCase();
        const normalizedStatus: "issued" | "online" | "offline" | "revoked" | "expired" =
          rawStatus === "online" || rawStatus === "offline" || rawStatus === "revoked" || rawStatus === "expired"
            ? rawStatus
            : "issued";
        return {
          token: String(entry.token ?? "").toUpperCase(),
          role: entry.role === "admin" ? "admin" : "student",
          status: normalizedStatus,
          ipAddress: entry.ipAddress ?? "-",
          deviceName: entry.deviceName ?? tr(language, "Belum terdaftar", "Not registered yet"),
          expiresAtLabel: formatIsoLabel(entry.expiresAt),
          lastSeenLabel: formatIsoLabel(entry.lastSeenAt),
        };
      });

      setBackendMonitorItems(mapped);
      setBackendMonitorError("");
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setBackendMonitorError(message);
      return false;
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

  const bootstrapBackendAdminSession = async (expiryMinutes: number): Promise<{
    sessionId: string;
    studentToken: string;
    studentExpiresAt: number;
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
          proctor_id: "AdminID",
          token_count: 2,
          token_ttl_minutes: expiryMinutes,
        }),
      });
      const created = await parseJsonResponse(createdResponse);
      const sessionIdFromApi = String(created.session_id ?? "");
      const createdTokens: string[] = Array.isArray(created.tokens) ? created.tokens : [];
      const studentToken = createdTokens.find((value) => String(value).toUpperCase().startsWith("S-")) ?? "";
      const adminToken = createdTokens.find((value) => String(value).toUpperCase().startsWith("A-")) ?? "";

      if (!sessionIdFromApi || !studentToken || !adminToken) {
        throw new Error("Invalid create-session response");
      }

      const claimResponse = await fetch(`${base}/session/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: adminToken,
          role_hint: "admin",
          device_fingerprint: "rn-admin-device",
          device_name: "RN Proctor Console",
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
        studentToken: studentToken.toUpperCase(),
        studentExpiresAt: Date.now() + expiryMinutes * 60 * 1000,
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
        device_fingerprint:
          inferredRole === "admin" ? "rn-admin-device" : "rn-student-device",
        device_name:
          inferredRole === "admin" ? "RN Admin Device" : "RN Student Device",
      }),
    });
    const payload = await parseJsonResponse(response);
    const accessSignature = String(payload.access_signature ?? "").trim();
    const bindingId = String(payload.device_binding_id ?? "").trim();
    const sessionIdFromApi = String(payload.session_id ?? "").trim();
    const launchUrl = normalizeUrl(payload.launch_url);
    const whitelist = Array.isArray(payload.whitelist)
      ? payload.whitelist
          .map((value: unknown) => normalizeUrl(value))
          .filter((value: string) => Boolean(value))
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

  const registerRisk = (score: number, message: string) => {
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

  const logoutToLogin = () => {
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
    setAdminBackendSessionId("");
    setAdminBackendAccessSignature("");
    setAdminBackendBindingId("");
    setBackendMonitorItems([]);
    setBackendMonitorError("");
    setRevokeTokenInput("");
    setRevokeTokenStatus(tr(language, "Masukkan token siswa untuk revoke.", "Enter a student token to revoke."));
    setSessionControlStatus(tr(language, "Kontrol sesi siap.", "Session control ready."));
    setStatusMessage(tr(language, "Masukkan token sesi untuk melanjutkan.", "Enter session token to continue."));
    setScreen("LoginScreen");
  };

  const openExamFlow = async (rawUrl: string, source: string, bypass = false) => {
    const tokenKey = activeStudentToken.trim().toUpperCase();
    const fallbackTokenKey = generatedToken.trim().toUpperCase();
    let tokenBoundUrl =
      (tokenKey ? getTokenLaunchUrl(tokenLaunchPolicies, tokenKey) : undefined) ||
      (fallbackTokenKey ? getTokenLaunchUrl(tokenLaunchPolicies, fallbackTokenKey) : undefined);
    let effectiveWhitelistBase = [...whitelist];

    const backendSessionId = sessionId.trim();
    const backendStudentSignature = studentBackendAccessSignature.trim();
    if (role === "student" && backendSessionId && backendStudentSignature) {
      try {
        const backendWhitelist = await fetchBackendWhitelistForSession(backendSessionId);
        effectiveWhitelistBase = backendWhitelist;
        setWhitelist(backendWhitelist);

        const backendLaunchUrl = await fetchBackendLaunchUrlForSession(
          backendSessionId,
          backendStudentSignature
        );
        if (backendLaunchUrl) {
          const policyToken = tokenKey || fallbackTokenKey;
          if (policyToken) {
            setTokenLaunchPolicies((prev) => ({
              ...prev,
              [policyToken]: {
                url: backendLaunchUrl,
                updatedAt: new Date().toISOString(),
              },
            }));
          }
          tokenBoundUrl = backendLaunchUrl;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        addLog(`Backend policy sync before exam launch failed: ${message}`);
      }
    }

    const effectiveWhitelist = mergeWhitelist(effectiveWhitelistBase, tokenBoundUrl);
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
    let backendClaimError: string | null = null;

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
        setWhitelist(claimed.whitelist);
        if (resolvedRole === "student" && claimed.launchUrl) {
          setTokenLaunchPolicies((prev) => ({
            ...prev,
            [tokenKey]: {
              url: claimed.launchUrl,
              updatedAt: new Date().toISOString(),
            },
          }));
          setManualUrlInput(claimed.launchUrl);
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
        backendClaimError = error instanceof Error ? error.message : String(error);
        addLog(`Backend token claim failed: token=${tokenKey} reason=${backendClaimError}`);
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
            if (claimed.launchUrl) {
              setTokenLaunchPolicies((prev) => ({
                ...prev,
                [tokenKey]: {
                  url: claimed.launchUrl,
                  updatedAt: new Date().toISOString(),
                },
              }));
              setManualUrlInput(claimed.launchUrl);
            }
            setWhitelist(claimed.whitelist);
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

    if (backendClaimError && hasBackendTarget && looksLikeSessionToken) {
      setStatusMessage(
        tr(
          language,
          `Token backend ditolak: ${backendClaimError}`,
          `Backend token rejected: ${backendClaimError}`
        )
      );
      return;
    }

    setStatusMessage(tr(language, "Token tidak valid.", "Invalid token."));
    addLog(`Invalid login token attempt: ${token || "(empty)"}`);
  };

  const generatedTokenKey = generatedToken.trim().toUpperCase();
  const generatedTokenPinState = generatedTokenKey ? tokenPinStatuses[generatedTokenKey] : undefined;
  const generatedTokenLaunchPolicy = generatedTokenKey ? tokenLaunchPolicies[generatedTokenKey] : undefined;
  const activeTokenKey = activeStudentToken.trim().toUpperCase();
  const activeTokenLaunchUrl = activeTokenKey ? tokenLaunchPolicies[activeTokenKey]?.url : undefined;
  const effectiveStudentWhitelist = mergeWhitelist(whitelist, activeTokenLaunchUrl);
  const generatedTokenPinStatus = !generatedTokenKey
    ? tr(language, "Buat token siswa dulu untuk mengikat PIN.", "Generate a student token first to bind PIN.")
    : !generatedTokenPinState
      ? tr(
          language,
          `Status PIN backend belum tersinkron untuk token ${generatedTokenKey}.`,
          `Backend PIN status has not synced for token ${generatedTokenKey}.`
        )
      : !generatedTokenPinState.configured
        ? tr(
            language,
            `PIN backend belum diset untuk token ${generatedTokenKey}.`,
            `Backend PIN is not set for token ${generatedTokenKey}.`
          )
        : generatedTokenPinState.isActiveToday
        ? tr(
            language,
            `PIN backend aktif hari ini untuk token ${generatedTokenKey} (${generatedTokenPinState.effectiveDate || "-" }).`,
            `Backend PIN is active today for token ${generatedTokenKey} (${generatedTokenPinState.effectiveDate || "-" }).`
          )
        : tr(
            language,
            `PIN backend expired untuk token ${generatedTokenKey} (${generatedTokenPinState.effectiveDate || "-" }).`,
            `Backend PIN expired for token ${generatedTokenKey} (${generatedTokenPinState.effectiveDate || "-" }).`
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
  const tokenMonitorItems: AdminTokenMonitorItem[] =
    adminBackendSessionId && adminBackendAccessSignature && backendMonitorItems.length > 0
      ? backendMonitorItems
      : localTokenMonitorItems;

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

            const sessionIdValue = sessionId.trim();
            const accessSignatureValue = studentBackendAccessSignature.trim();
            const targetToken = activeStudentToken.trim().toUpperCase();
            const normalizedPin = pinAttempt.trim();
            const base = normalizeBackendBaseUrl(backendBaseUrl);

            if (!normalizedPin) {
              const message = tr(
                language,
                "PIN tidak boleh kosong.",
                "PIN cannot be empty."
              );
              setPinStatus(message);
              addLog(`Proctor PIN rejected: empty value. token=${targetToken || "(unknown)"}`);
              return;
            }

            if (!base || !sessionIdValue || !accessSignatureValue) {
              const message = tr(
                language,
                "Verifikasi PIN membutuhkan sesi backend aktif.",
                "PIN verification requires an active backend session."
              );
              setPinStatus(message);
              addLog(`Proctor PIN verify rejected: backend session missing. token=${targetToken || "(unknown)"}`);
              return;
            }

            try {
              const response = await fetch(`${base}/session/proctor-pin/verify`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  session_id: sessionIdValue,
                  access_signature: accessSignatureValue,
                  pin: normalizedPin,
                }),
              });
              const payload = await parseJsonResponse(response);
              if (Boolean(payload.valid)) {
                addLog(`Student exited exam with backend-verified proctor PIN. token=${targetToken || "(unknown)"}`);
                if (targetToken) {
                  updateIssuedToken(targetToken, { status: "offline", lastSeenAt: Date.now() });
                }
                setScreen("ExamSelectionScreen");
                return;
              }

              const reason = String(payload.reason ?? "PIN_INVALID").toUpperCase();
              const message =
                reason === "PIN_NOT_SET"
                  ? tr(
                      language,
                      "PIN proktor backend belum diset untuk sesi ini.",
                      "Backend proctor PIN is not set for this session."
                    )
                  : reason === "PIN_EXPIRED"
                    ? tr(
                        language,
                        "PIN proktor backend sudah kedaluwarsa (harian).",
                        "Backend proctor PIN has expired (daily policy)."
                      )
                    : tr(
                        language,
                        "PIN tidak valid. Hanya proktor yang bisa menutup sesi.",
                        "Invalid PIN. Only proctor can close this session."
                      );
              setPinStatus(message);
              addLog(`Backend proctor PIN rejected: token=${targetToken || "(unknown)"} reason=${reason}`);
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              setPinStatus(
                tr(
                  language,
                  "Verifikasi PIN backend gagal. Coba lagi.",
                  "Backend PIN verification failed. Please retry."
                )
              );
              addLog(`Backend proctor PIN verify failed: token=${targetToken || "(unknown)"} reason=${message}`);
            }
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
        tokenExpiryMinutes={tokenExpiryMinutes}
        tokenLaunchUrl={tokenLaunchUrlInput}
        tokenLaunchUrlStatus={generatedTokenLaunchStatus}
        proctorPin={proctorPin}
        proctorPinStatus={generatedTokenPinStatus}
        revokeTokenInput={revokeTokenInput}
        revokeTokenStatus={revokeTokenStatus}
        sessionControlStatus={sessionControlStatus}
        tokenMonitorItems={tokenMonitorItems}
        logs={logs}
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

          const base = normalizeBackendBaseUrl(backendBaseUrl);
          if (!base || !adminBackendSessionId || !adminBackendAccessSignature) {
            addLog("Token URL binding rejected: backend admin session not active.");
            return;
          }

          try {
            const launchResponse = await fetch(`${base}/exam/launch`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminBackendAccessSignature}`,
              },
              body: JSON.stringify({
                session_id: adminBackendSessionId,
                launch_url: normalizedUrl,
              }),
            });
            const launchPayload = await parseJsonResponse(launchResponse);
            const savedLaunchUrl = normalizeUrl(launchPayload.launch_url ?? normalizedUrl) || normalizedUrl;

            setTokenLaunchPolicies((prev) => ({
              ...prev,
              [targetToken]: {
                url: savedLaunchUrl,
                updatedAt: new Date().toISOString(),
              },
            }));
            setTokenLaunchUrlInput(savedLaunchUrl);

            const backendWhitelist = await fetchBackendWhitelistForSession(adminBackendSessionId);
            setWhitelist(backendWhitelist);

            addLog(`Backend token URL binding saved. token=${targetToken} url=${savedLaunchUrl}`);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            addLog(`Backend token URL binding failed: ${message}`);
          }
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

          const base = normalizeBackendBaseUrl(backendBaseUrl);
          if (!base || !adminBackendSessionId || !adminBackendAccessSignature) {
            addLog("Proctor PIN update rejected: backend admin session not active.");
            return;
          }

          try {
            const response = await fetch(`${base}/session/proctor-pin/set`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                session_id: adminBackendSessionId,
                access_signature: adminBackendAccessSignature,
                pin: proctorPin.trim(),
                student_token: targetToken,
              }),
            });
            const payload = await parseJsonResponse(response);
            const syncedToken = String(payload.student_token ?? targetToken).trim().toUpperCase() || targetToken;
            const effectiveDate = String(payload.effective_date ?? "").trim();
            await syncTokenPinStatusFromBackend(syncedToken);
            addLog(
              `Backend proctor PIN updated for token ${syncedToken}. effective_date=${effectiveDate || "-"}`
            );
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            addLog(`Backend proctor PIN update failed: ${message}`);
          }
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
        onGenerateToken={async () => {
          const expiryMinutes = parseExpiryMinutes(tokenExpiryMinutes);
          const hasBackendTarget = Boolean(normalizeBackendBaseUrl(backendBaseUrl));

          if (hasBackendTarget) {
            setGeneratedToken("");
            setGeneratedTokenExpiryAt("");
            const remote = await bootstrapBackendAdminSession(expiryMinutes);
            if (!remote) {
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

            setGeneratedToken(remote.studentToken);
            setGeneratedTokenExpiryAt(formatTimestamp(remote.studentExpiresAt));
            setSessionId(remote.sessionId);
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
              const next = prev.filter((entry) => entry.token.toUpperCase() !== remote.studentToken);
              next.push({
                token: remote.studentToken,
                role: "student",
                expiresAt: remote.studentExpiresAt,
                source: "backend-session",
                status: "issued",
                ipAddress: "-",
                deviceName: tr(language, "Belum login", "Not logged in"),
                lastSeenAt: Date.now(),
              });
              return next;
            });
            const backendWhitelist = await fetchBackendWhitelistForSession(remote.sessionId);
            setWhitelist(backendWhitelist);
            await syncTokenPinStatusFromBackend(remote.studentToken);
            await loadAdminMonitor();
            addLog(
              `Backend session created: ${remote.sessionId} | student_token=${remote.studentToken} | ttl=${expiryMinutes}m`
            );
            return;
          }

          const token = generateToken();
          const expiresAt = Date.now() + expiryMinutes * 60 * 1000;
          setGeneratedToken(token);
          setGeneratedTokenExpiryAt(formatTimestamp(expiresAt));
          setIssuedTokens((prev) => {
            const next = prev.filter((entry) => entry.token.toUpperCase() !== token.toUpperCase());
            next.push({
              token,
              role: "student",
              expiresAt,
              source: "admin-dashboard",
              status: "issued",
              ipAddress: "-",
              deviceName: tr(language, "Belum login", "Not logged in"),
              lastSeenAt: Date.now(),
            });
            return next;
          });
          addLog(
            `Admin generated local student token (backend unavailable): ${token} | ttl=${expiryMinutes}m | exp=${formatTimestamp(expiresAt)}`
          );
          setSessionControlStatus(
            tr(
              language,
              "Kontrol session backend belum aktif.",
              "Backend session control is not active."
            )
          );
        }}
        onCopyGeneratedToken={() => {
          if (!generatedToken) {
            addLog("Copy token ignored: no generated student token.");
            return;
          }
          if (!safeCopyToClipboard(generatedToken)) {
            addLog("Copy token failed: clipboard module unavailable.");
            return;
          }
          addLog(`Student token copied to clipboard: ${generatedToken}`);
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

          const base = normalizeBackendBaseUrl(backendBaseUrl);
          if (!base || !adminBackendSessionId || !adminBackendAccessSignature) {
            addLog("Whitelist add rejected: backend admin session not active.");
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
            const backendWhitelist = await fetchBackendWhitelistForSession(adminBackendSessionId);
            setWhitelist(backendWhitelist);
            setWhitelistInput("");
            addLog(`Whitelist synced from backend: ${normalized}`);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            addLog(`Whitelist backend sync failed: ${message}`);
          }
        }}
        onSavePin={async () => {
          if (proctorPin.trim().length < 4) {
            addLog("Proctor PIN update rejected: minimum 4 digits.");
            return;
          }
          const targetToken = generatedToken.trim().toUpperCase();
          if (!targetToken) {
            addLog("Proctor PIN update rejected: no student token selected.");
            return;
          }

          const base = normalizeBackendBaseUrl(backendBaseUrl);
          if (!base || !adminBackendSessionId || !adminBackendAccessSignature) {
            addLog("Proctor PIN update rejected: backend admin session not active.");
            return;
          }

          try {
            const response = await fetch(`${base}/session/proctor-pin/set`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                session_id: adminBackendSessionId,
                access_signature: adminBackendAccessSignature,
                pin: proctorPin.trim(),
                student_token: targetToken,
              }),
            });
            const payload = await parseJsonResponse(response);
            const syncedToken = String(payload.student_token ?? targetToken).trim().toUpperCase() || targetToken;
            const effectiveDate = String(payload.effective_date ?? "").trim();
            await syncTokenPinStatusFromBackend(syncedToken);
            addLog(
              `Backend proctor PIN updated for token ${syncedToken}. effective_date=${effectiveDate || "-"}`
            );
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            addLog(`Backend proctor PIN update failed: ${message}`);
          }
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
        browserUrl={browserUrl}
        onBrowserUrlChange={setBrowserUrl}
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
