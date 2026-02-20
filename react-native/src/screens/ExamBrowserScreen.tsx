import React, { useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import type { WebViewNavigation } from "react-native-webview/lib/WebViewTypes";
import { AppLanguage, tr } from "../i18n";
import Layout, {
  TerminalBadge,
  TerminalButton,
  TerminalInput,
  terminalStyles,
} from "./Layout";
import IntegrityWarningModal from "./IntegrityWarningModal";
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

function toHost(urlValue: string): string | null {
  try {
    return new URL(urlValue).host.toLowerCase();
  } catch {
    return null;
  }
}

function normalizeAllowlist(whitelist: string[]): string[] {
  return whitelist
    .map((entry) => {
      const normalized = entry.trim().startsWith("http://") || entry.trim().startsWith("https://")
        ? entry.trim()
        : `https://${entry.trim()}`;
      return toHost(normalized);
    })
    .filter((value): value is string => Boolean(value));
}

function isAllowedNavigation(targetUrl: string, allowedHosts: string[]): boolean {
  if (targetUrl.startsWith("about:blank") || targetUrl.startsWith("data:")) {
    return true;
  }

  try {
    const target = new URL(targetUrl);
    if (target.protocol !== "http:" && target.protocol !== "https:") {
      return false;
    }

    const targetHost = target.host.toLowerCase();
    return allowedHosts.some(
      (allowedHost) => targetHost === allowedHost || targetHost.endsWith(`.${allowedHost}`)
    );
  } catch {
    return false;
  }
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
      subtitle={tr(
        language,
        "Akses web terbatas whitelist. Keluar memerlukan PIN proktor.",
        "Whitelist-only access. Exiting requires proctor PIN."
      )}
      topRight={
        <TerminalBadge
          label={kioskEnabled ? tr(language, "KIOSK:ON", "KIOSK:ON") : tr(language, "KIOSK:OFF", "KIOSK:OFF")}
          tone={kioskEnabled ? "neon" : "warning"}
        />
      }
    >
      <View style={styles.urlHeader}>
        <Text style={styles.urlLabel}>{tr(language, "URL AKTIF", "ACTIVE URL")}</Text>
        <Text numberOfLines={1} style={styles.urlText}>
          {url}
        </Text>
        <Text style={styles.timerText}>
          {tr(language, "SISA WAKTU TOKEN", "TOKEN TIME LEFT")}: {sessionTimeLeft}
        </Text>
      </View>

      <View style={styles.browserPanel}>
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
              <Text style={styles.loaderText}>
                {tr(language, "Memuat endpoint ujian...", "Loading exam endpoint...")}
              </Text>
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
              event.nativeEvent.description ||
                tr(language, "Halaman ujian tidak dapat dimuat.", "Unable to load exam page.")
            );
          }}
        />
        <LiveStatusOverlay
          studentId={studentId}
          sessionId={sessionId}
          riskScore={riskScore}
          timestamp={overlayTimestamp}
        />
      </View>

      {webError ? <Text style={styles.errorText}>{webError}</Text> : null}
      {blockedMessage ? <Text style={styles.errorText}>{blockedMessage}</Text> : null}

      <View style={styles.exitPanel}>
        <TerminalInput
          value={pinAttempt}
          onChangeText={onPinAttemptChange}
          label={tr(language, "PIN Proktor Untuk Melepas Sesi", "Proctor PIN to Release Session")}
          placeholder={tr(language, "Masukkan PIN", "Input PIN")}
          keyboardType="number-pad"
          secureTextEntry
        />
        <Text style={terminalStyles.subtleText}>{pinStatus}</Text>
      </View>

      <View style={terminalStyles.splitRow}>
        <View style={terminalStyles.splitCol}>
          <TerminalButton
            label={tr(language, "Keluar Browser (PIN)", "Exit Browser (PIN)")}
            variant="outline"
            onPress={onSubmitPinExit}
          />
        </View>
        <View style={terminalStyles.splitCol}>
          <TerminalButton label={tr(language, "Selesaikan Ujian", "Finish Exam")} onPress={onFinishExam} />
        </View>
      </View>

      <TerminalButton
        label={tr(
          language,
          "Picu Pelanggaran (Background/Layar Mati)",
          "Trigger Violation (Background/Screen Off)"
        )}
        variant="outline"
        onPress={onSimulateViolation}
      />

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
  urlHeader: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    backgroundColor: "#ffffff",
    padding: 8,
    marginBottom: 8,
  },
  urlLabel: {
    color: "#6b7280",
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 10,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  urlText: {
    color: "#16a34a",
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 11,
  },
  timerText: {
    color: "#1f2937",
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 10,
    marginTop: 6,
  },
  browserPanel: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 18,
    backgroundColor: "#ffffff",
    marginBottom: 8,
    minHeight: 240,
    overflow: "hidden",
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
    color: "#ef4444",
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 10,
    marginBottom: 4,
  },
  exitPanel: {
    marginTop: 2,
  },
});
