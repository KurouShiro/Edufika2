import React, { useEffect, useState } from "react";
import { Alert, BackHandler, Clipboard } from "react-native";
import { AppLanguage, tr } from "./i18n";
import AdminDashboardPanel from "./screens/AdminDashboardPanel";
import DeveloperAccessScreen from "./screens/DeveloperAccessScreen";
import ExamBrowserScreen from "./screens/ExamBrowserScreen";
import ExamSelectionScreen from "./screens/ExamSelectionScreen";
import HistoryScreen from "./screens/HistoryScreen";
import LoginScreen from "./screens/LoginScreen";
import ManualInputFail from "./screens/ManualInputFail";
import ManualInputScreen from "./screens/ManualInputScreen";
import QRScannerScreen from "./screens/QRScannerScreen";
import Settings from "./screens/Settings";
import SplashScreen from "./screens/SplashScreen";
import SuccessScreen from "./screens/SuccessScreen";
import URLWhitelist from "./screens/URLWhitelist";
import ViolationScreen from "./screens/ViolationScreen";

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

type IssuedToken = {
  token: string;
  role: IssuedTokenRole;
  expiresAt: number;
  source: string;
};

type TokenPinPolicy = {
  pin: string;
  effectiveDate: string;
};

const STUDENT_TOKEN = "StudentID";
const ADMIN_TOKEN = "AdminID";
const DEVELOPER_PASSWORD = "EDU_DEV_ACCESS";
const DEFAULT_SESSION_EXPIRY_MINUTES = 120;

const defaultWhitelist = ["https://example.org", "https://school.ac.id/exam"];

function normalizeUrl(raw: string): string {
  const input = raw.trim();
  if (!input) {
    return "";
  }
  if (input.startsWith("http://") || input.startsWith("https://")) {
    return input;
  }
  return `https://${input}`;
}

function isWhitelisted(url: string, whitelist: string[]): boolean {
  try {
    const target = new URL(url);
    return whitelist.some((allowed) => {
      const normalizedAllowed = normalizeUrl(allowed);
      const allowedUrl = new URL(normalizedAllowed);
      const sameHost = target.host.toLowerCase() === allowedUrl.host.toLowerCase();
      const samePrefix = url.startsWith(normalizedAllowed);
      return sameHost || samePrefix;
    });
  } catch {
    return false;
  }
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
  const [tokenPinPolicies, setTokenPinPolicies] = useState<Record<string, TokenPinPolicy>>({});
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
  const [browserUrl, setBrowserUrl] = useState("https://example.org");

  useEffect(() => {
    const timer = setTimeout(() => {
      setBootMessage(tr(language, "Semua layanan inti aktif.", "All core services online."));
      setScreen("LoginScreen");
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

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

  const addLog = (message: string) => {
    setLogs((prev) => [makeLogLine(message), ...prev].slice(0, 120));
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
    setRole("guest");
    setTokenInput("");
    setActiveStudentToken("");
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
    setStatusMessage(tr(language, "Masukkan token sesi untuk melanjutkan.", "Enter session token to continue."));
    setScreen("LoginScreen");
  };

  const openExamFlow = (rawUrl: string, source: string, bypass = false) => {
    const resolvedUrl = normalizeUrl(rawUrl || whitelist[0] || "");
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

    if (!bypass && !isWhitelisted(resolvedUrl, whitelist)) {
      setInvalidUrl(resolvedUrl);
      addLog(
        tr(
          language,
          `URL diblokir (di luar whitelist): ${resolvedUrl}`,
          `URL blocked (not whitelisted): ${resolvedUrl}`
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

  const handleLogin = () => {
    const token = tokenInput.trim();
    if (token === STUDENT_TOKEN) {
      setRole("student");
      setActiveStudentToken(token.toUpperCase());
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
      setActiveStudentToken("");
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
      setActiveStudentToken("");
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

    const issued = issuedTokens.find((entry) => entry.token.toUpperCase() === token.toUpperCase());
    if (issued) {
      if (Date.now() >= issued.expiresAt) {
        setStatusMessage(tr(language, "Token sudah kedaluwarsa.", "Token has expired."));
        addLog(`Expired token rejected: ${token}`);
        return;
      }

      const resolvedRole: Role = issued.role === "admin" ? "admin" : "student";
      setRole(resolvedRole);
      setActiveStudentToken(resolvedRole === "student" ? token.toUpperCase() : "");
      setSessionId(generateSessionId());
      setSessionExpiresAt(issued.expiresAt);
      setSessionExpiryHandled(false);
      setRiskScore(0);
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
        onExitApp={() => BackHandler.exitApp()}
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
    );
  }

  if (screen === "ExamBrowserScreen") {
    return (
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
        whitelist={whitelist}
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
        onSubmitPinExit={() => {
          if (bypassWhitelist || role === "admin" || role === "developer") {
            addLog("Exam browser closed by admin/developer.");
            setScreen(role === "admin" ? "AdminDashboardPanel" : "DeveloperAccessScreen");
            return;
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

          if (pinAttempt.trim() === policy.pin.trim()) {
            addLog(`Student exited exam with valid proctor PIN. token=${targetToken}`);
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
        onFinishExam={() => {
          addLog("Student exam marked as completed.");
          setScreen("SuccessScreen");
        }}
        onSimulateViolation={() => {
          const reason = tr(
            language,
            "Simulasi: aplikasi di-background saat sesi aktif.",
            "Simulation: app was backgrounded while session is active."
          );
          setViolationReason(reason);
          registerRisk(3, "App background detected");
          setIntegrityMessage(reason);
          setShowIntegrityWarning(true);
          addLog(reason);
          setScreen("ViolationScreen");
        }}
        onDismissIntegrityWarning={() => setShowIntegrityWarning(false)}
      />
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
        generatedToken={generatedToken}
        generatedTokenExpiryAt={generatedTokenExpiryAt}
        tokenExpiryMinutes={tokenExpiryMinutes}
        proctorPin={proctorPin}
        proctorPinStatus={generatedTokenPinStatus}
        logs={logs}
        onTokenExpiryMinutesChange={setTokenExpiryMinutes}
        onProctorPinChange={setProctorPin}
        onSaveProctorPin={() => {
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
        onGenerateToken={() => {
          const expiryMinutes = parseExpiryMinutes(tokenExpiryMinutes);
          const token = generateToken();
          const expiresAt = Date.now() + expiryMinutes * 60 * 1000;
          setGeneratedToken(token);
          setGeneratedTokenExpiryAt(formatTimestamp(expiresAt));
          setIssuedTokens((prev) => {
            const next = prev.filter((entry) => entry.token.toUpperCase() !== token.toUpperCase());
            next.push({ token, role: "student", expiresAt, source: "admin-dashboard" });
            return next;
          });
          addLog(`Admin generated new student token: ${token} | ttl=${expiryMinutes}m | exp=${formatTimestamp(expiresAt)}`);
        }}
        onCopyGeneratedToken={() => {
          if (!generatedToken) {
            addLog("Copy token ignored: no generated student token.");
            return;
          }
          Clipboard.setString(generatedToken);
          addLog(`Student token copied to clipboard: ${generatedToken}`);
        }}
        onOpenWhitelist={() => setScreen("URLWhitelist")}
        onOpenHistory={() => setScreen("HistoryScreen")}
        onOpenSettings={() => openSettingsFrom("AdminDashboardPanel")}
        onLogout={() => {
          addLog("Admin logged out.");
          logoutToLogin();
        }}
      />
    );
  }

  if (screen === "URLWhitelist") {
    return (
      <URLWhitelist
        language={language}
        whitelistInput={whitelistInput}
        onWhitelistInputChange={setWhitelistInput}
        whitelist={whitelist}
        proctorPin={proctorPin}
        onProctorPinChange={setProctorPin}
        onAddUrl={() => {
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
        onGenerateAdminToken={() => {
          if (!developerUnlocked) {
            addLog("Generate admin token blocked: developer panel locked.");
            return;
          }
          const expiryMinutes = parseExpiryMinutes(adminTokenExpiryMinutes);
          const token = generateAdminToken();
          const expiresAt = Date.now() + expiryMinutes * 60 * 1000;
          setGeneratedAdminToken(token);
          setGeneratedAdminTokenExpiryAt(formatTimestamp(expiresAt));
          setIssuedTokens((prev) => {
            const next = prev.filter((entry) => entry.token.toUpperCase() !== token.toUpperCase());
            next.push({ token, role: "admin", expiresAt, source: "developer-panel" });
            return next;
          });
          addLog(`Developer generated admin token: ${token} | ttl=${expiryMinutes}m | exp=${formatTimestamp(expiresAt)}`);
        }}
        onCopyAdminToken={() => {
          if (!generatedAdminToken) {
            addLog("Copy admin token ignored: no generated token.");
            return;
          }
          Clipboard.setString(generatedAdminToken);
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
          addLog(
            tr(
              nextLanguage,
              `Bahasa diubah ke ${nextLanguage.toUpperCase()}.`,
              `Language switched to ${nextLanguage.toUpperCase()}.`
            )
          );
        }}
        onBack={() => setScreen(returnScreen)}
      />
    );
  }

  return null;
}
