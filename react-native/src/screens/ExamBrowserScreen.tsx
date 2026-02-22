import React, { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import type { WebViewNavigation } from "react-native-webview/lib/WebViewTypes";
import { AppLanguage, tr } from "../i18n";
import IntegrityWarningModal from "./IntegrityWarningModal";
import Layout, { TerminalBadge, TerminalButton, TerminalInput, palette } from "./Layout";
import LiveStatusOverlay from "./LiveStatusOverlay";

type ExamBrowserScreenProps = {
  language: AppLanguage;
  url: string;
  kioskEnabled: boolean;
  pinAttempt: string;
  pinStatus: string;
  studentId: string;
  sessionId: string;
  riskScore: number;
  sessionTimeLeft: string;
  overlayTimestamp: string;
  showIntegrityWarning: boolean;
  integrityMessage: string;
  whitelist: string[];
  bypassWhitelist: boolean;
  onPinAttemptChange: (value: string) => void;
  onSubmitPinExit: () => void;
  onFinishExam: () => void;
  onSimulateViolation: () => void;
  onDismissIntegrityWarning: () => void;
  onBlockedNavigation: (url: string) => void;
};

type ParsedUrl = {
  scheme: string;
  host: string;
};

function parseUrl(urlValue: string): ParsedUrl | null {
  const value = (urlValue || "").trim();
  const match = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]+)/i.exec(value);
  if (!match) {
    return null;
  }
  return {
    scheme: `${match[1].toLowerCase()}:`,
    host: match[2].toLowerCase(),
  };
}

function toHost(urlValue: string): string | null {
  return parseUrl(urlValue)?.host ?? null;
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

function normalizeAllowlist(whitelist: string[]): string[] {
  return whitelist
    .map((entry) => {
      const raw = typeof entry === "string" ? entry : "";
      const trimmed = raw.trim();
      if (!trimmed) {
        return null;
      }
      const normalized = trimmed.startsWith("http://") || trimmed.startsWith("https://")
        ? trimmed
        : `https://${trimmed}`;
      return toHost(normalized);
    })
    .filter((value): value is string => Boolean(value));
}

function isAllowedNavigation(targetUrl: string, allowedHosts: string[]): boolean {
  if (targetUrl.startsWith("about:blank") || targetUrl.startsWith("data:")) {
    return true;
  }
  const target = parseUrl(targetUrl);
  if (!target) {
    return false;
  }
  if (target.scheme !== "http:" && target.scheme !== "https:") {
    return false;
  }
  const targetHost = target.host;
  return allowedHosts.some(
    (allowedHost) =>
      hostMatchesOrSubdomain(targetHost, allowedHost) ||
      isSameTrustedHostFamily(targetHost, allowedHost)
  );
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
    return /^([a-z0-9-]+\.)?google\.[a-z.]+$/.test(normalized);
  };

  if (!isGoogleFamilyHost(allowedHost)) {
    return false;
  }

  return isGoogleFamilyHost(targetHost);
}

export default function ExamBrowserScreen({
  language,
  url,
  kioskEnabled,
  pinAttempt,
  pinStatus,
  studentId,
  sessionId,
  riskScore,
  sessionTimeLeft,
  overlayTimestamp,
  showIntegrityWarning,
  integrityMessage,
  whitelist,
  bypassWhitelist,
  onPinAttemptChange,
  onSubmitPinExit,
  onFinishExam,
  onSimulateViolation,
  onDismissIntegrityWarning,
  onBlockedNavigation,
}: ExamBrowserScreenProps) {
  const blockedOnceRef = useRef(false);
  const [blockedMessage, setBlockedMessage] = useState("");
  const [webError, setWebError] = useState("");
  const [showExitModal, setShowExitModal] = useState(false);

  const allowedHosts = useMemo(() => {
    const normalized = normalizeAllowlist(whitelist);
    const activeHost = toHost(url);
    if (activeHost && !normalized.includes(activeHost)) {
      return [...normalized, activeHost];
    }
    return normalized;
  }, [url, whitelist]);

  return (
    <Layout
      title={tr(language, "Exam Browser", "Exam Browser")}
      subtitle={tr(language, "Whitelist access aktif selama sesi.", "Whitelist access active for this session.")}
      topRight={
        <TerminalBadge
          label={kioskEnabled ? tr(language, "LOCKDOWN ON", "LOCKDOWN ON") : tr(language, "LOCKDOWN OFF", "LOCKDOWN OFF")}
          tone={kioskEnabled ? "neon" : "warning"}
        />
      }
    >
      <View style={styles.headerBar}>
        <View style={styles.headerLeft}>
          <Text style={styles.urlText} numberOfLines={1}>
            {url}
          </Text>
        </View>
        <View style={styles.timerPill}>
          <Text style={styles.timerText}>{sessionTimeLeft}</Text>
        </View>
        <Pressable style={styles.exitChip} onPress={() => setShowExitModal(true)}>
          <Text style={styles.exitChipText}>{tr(language, "EXIT", "EXIT")}</Text>
        </Pressable>
      </View>

      <View style={styles.browserShell}>
        <WebView
          source={{ uri: url }}
          style={styles.webview}
          originWhitelist={["http://*", "https://*"]}
          javaScriptEnabled
          domStorageEnabled
          setSupportMultipleWindows={false}
          allowsBackForwardNavigationGestures={false}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loaderWrap}>
              <ActivityIndicator size="small" color="#22c55e" />
              <Text style={styles.loaderText}>{tr(language, "Memuat endpoint ujian...", "Loading exam endpoint...")}</Text>
            </View>
          )}
          onShouldStartLoadWithRequest={(request: WebViewNavigation) => {
            if (bypassWhitelist) {
              return true;
            }
            const isAllowed = isAllowedNavigation(request.url, allowedHosts);
            if (!isAllowed) {
              setBlockedMessage(`Blocked navigation: ${request.url}`);
              if (!blockedOnceRef.current) {
                blockedOnceRef.current = true;
                onBlockedNavigation(request.url);
              }
              return false;
            }
            return true;
          }}
          onHttpError={(event) => {
            setWebError(`HTTP ${event.nativeEvent.statusCode}: ${event.nativeEvent.description}`);
          }}
          onError={(event) => {
            setWebError(
              event.nativeEvent.description || tr(language, "Halaman ujian tidak dapat dimuat.", "Unable to load exam page.")
            );
          }}
        />
        <LiveStatusOverlay studentId={studentId} sessionId={sessionId} riskScore={riskScore} timestamp={overlayTimestamp} />
      </View>

      {webError ? <Text style={styles.errorText}>{webError}</Text> : null}
      {blockedMessage ? <Text style={styles.errorText}>{blockedMessage}</Text> : null}

      <View style={styles.bottomRow}>
        <View style={styles.bottomButton}>
          <TerminalButton label={tr(language, "Selesaikan Ujian", "Finish Exam")} onPress={onFinishExam} />
        </View>
        <View style={styles.bottomButton}>
          <TerminalButton
            label={tr(language, "Simulasi Pelanggaran", "Simulate Violation")}
            variant="outline"
            onPress={onSimulateViolation}
          />
        </View>
      </View>

      <Modal transparent visible={showExitModal} animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{tr(language, "Proctor Authorization", "Proctor Authorization")}</Text>
            <Text style={styles.modalSub}>{tr(language, "Masukkan PIN proktor untuk keluar.", "Enter proctor PIN to exit.")}</Text>
            <TerminalInput
              value={pinAttempt}
              onChangeText={onPinAttemptChange}
              label={tr(language, "PIN PROKTOR", "PROCTOR PIN")}
              placeholder="____"
              keyboardType="number-pad"
              secureTextEntry
            />
            <Text style={styles.modalStatus}>{pinStatus}</Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowExitModal(false)}>
                <Text style={styles.cancelBtnText}>{tr(language, "Batal", "Cancel")}</Text>
              </Pressable>
              <Pressable
                style={styles.verifyBtn}
                onPress={() => {
                  onSubmitPinExit();
                  setShowExitModal(false);
                }}
              >
                <Text style={styles.verifyBtnText}>{tr(language, "Verifikasi", "Verify")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <IntegrityWarningModal
        visible={showIntegrityWarning}
        language={language}
        title={tr(language, "Peringatan Integritas", "Integrity Warning")}
        message={integrityMessage}
        onDismiss={onDismissIntegrityWarning}
      />
    </Layout>
  );
}

const styles = StyleSheet.create({
  headerBar: {
    height: 46,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerLeft: {
    flex: 1,
  },
  urlText: {
    color: "#4b5563",
    fontFamily: "JetBrainsMono-Bold",
    fontSize: 10,
  },
  timerPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(34,197,94,0.12)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.2)",
  },
  timerText: {
    color: "#166534",
    fontFamily: "JetBrainsMono-Bold",
    fontSize: 10,
  },
  exitChip: {
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  exitChipText: {
    color: "#6b7280",
    fontFamily: "JetBrainsMono-Bold",
    fontSize: 10,
    letterSpacing: 0.7,
  },
  browserShell: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 22,
    backgroundColor: "#ffffff",
    marginBottom: 8,
    overflow: "hidden",
    minHeight: 240,
  },
  webview: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  loaderWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    gap: 6,
  },
  loaderText: {
    color: "#16a34a",
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 11,
  },
  errorText: {
    color: palette.warning,
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 10,
    marginBottom: 4,
  },
  bottomRow: {
    flexDirection: "row",
    gap: 8,
  },
  bottomButton: {
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 18,
    justifyContent: "center",
  },
  modalCard: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 26,
    backgroundColor: "#ffffff",
    padding: 14,
  },
  modalTitle: {
    color: "#1f2937",
    fontFamily: "JetBrainsMono-Bold",
    fontSize: 14,
    marginBottom: 4,
  },
  modalSub: {
    color: "#9ca3af",
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 10,
    marginBottom: 8,
  },
  modalStatus: {
    color: "#6b7280",
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 10,
    marginBottom: 10,
  },
  modalActions: {
    flexDirection: "row",
    gap: 8,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 14,
    backgroundColor: "#f3f4f6",
    paddingVertical: 10,
    alignItems: "center",
  },
  cancelBtnText: {
    color: "#6b7280",
    fontFamily: "JetBrainsMono-Bold",
    fontSize: 10,
    letterSpacing: 0.8,
  },
  verifyBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: palette.neon,
    borderRadius: 14,
    backgroundColor: palette.neon,
    paddingVertical: 10,
    alignItems: "center",
  },
  verifyBtnText: {
    color: "#ffffff",
    fontFamily: "JetBrainsMono-Bold",
    fontSize: 10,
    letterSpacing: 0.8,
  },
});
