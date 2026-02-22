import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppLanguage, tr } from "../i18n";
import Layout, { TerminalButton, TerminalInput, palette } from "./Layout";

type AdminDashboardPanelProps = {
  language: AppLanguage;
  backendBaseUrl: string;
  generatedToken: string;
  generatedTokenExpiryAt: string;
  tokenExpiryMinutes: string;
  tokenLaunchUrl: string;
  tokenLaunchUrlStatus: string;
  proctorPin: string;
  proctorPinStatus: string;
  revokeTokenInput: string;
  revokeTokenStatus: string;
  sessionControlStatus: string;
  tokenMonitorItems: AdminTokenMonitorItem[];
  logs: string[];
  onTokenExpiryMinutesChange: (value: string) => void;
  onTokenLaunchUrlChange: (value: string) => void;
  onSaveTokenLaunchUrl: () => void;
  onProctorPinChange: (value: string) => void;
  onSaveProctorPin: () => void;
  onRevokeTokenInputChange: (value: string) => void;
  onRevokeStudentToken: () => void;
  onPauseSession: () => void;
  onResumeSession: () => void;
  onReissueSignature: () => void;
  onGenerateToken: () => void;
  onCopyGeneratedToken: () => void;
  onOpenWhitelist: () => void;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
};

type MonitorStatus = "issued" | "online" | "offline" | "revoked" | "expired";

export type AdminTokenMonitorItem = {
  token: string;
  role: "student" | "admin";
  status: MonitorStatus;
  ipAddress: string;
  deviceName: string;
  expiresAtLabel: string;
  lastSeenLabel: string;
};

type AdminTab = "monitor" | "tokens" | "logs";

export default function AdminDashboardPanel({
  language,
  backendBaseUrl,
  generatedToken,
  generatedTokenExpiryAt,
  tokenExpiryMinutes,
  tokenLaunchUrl,
  tokenLaunchUrlStatus,
  proctorPin,
  proctorPinStatus,
  revokeTokenInput,
  revokeTokenStatus,
  sessionControlStatus,
  tokenMonitorItems,
  logs,
  onTokenExpiryMinutesChange,
  onTokenLaunchUrlChange,
  onSaveTokenLaunchUrl,
  onProctorPinChange,
  onSaveProctorPin,
  onRevokeTokenInputChange,
  onRevokeStudentToken,
  onPauseSession,
  onResumeSession,
  onReissueSignature,
  onGenerateToken,
  onCopyGeneratedToken,
  onOpenWhitelist,
  onOpenHistory,
  onOpenSettings,
  onLogout,
}: AdminDashboardPanelProps) {
  const [tab, setTab] = useState<AdminTab>("monitor");
  const activeCount = useMemo(() => Math.max(1, Math.min(99, logs.length)), [logs.length]);
  const alertCount = useMemo(() => logs.filter((entry) => entry.toLowerCase().includes("risk") || entry.toLowerCase().includes("violation")).length, [logs]);

  return (
    <Layout
      title={tr(language, "Proctor Panel", "Proctor Panel")}
      subtitle={tr(language, "Monitoring sesi, token, dan audit log.", "Session monitoring, token control, and audit logs.")}
      footer={
        <View style={styles.footerWrap}>
          <TerminalButton label={tr(language, "Pengaturan", "Settings")} variant="outline" onPress={onOpenSettings} />
          <TerminalButton label={tr(language, "Logout Admin", "Logout Admin")} variant="outline" onPress={onLogout} />
        </View>
      }
    >
      <View style={styles.tabs}>
        <TabButton label={tr(language, "PANTAU", "MONITOR")} active={tab === "monitor"} onPress={() => setTab("monitor")} />
        <TabButton label={tr(language, "TOKEN", "TOKENS")} active={tab === "tokens"} onPress={() => setTab("tokens")} />
        <TabButton label={tr(language, "LOG", "LOGS")} active={tab === "logs"} onPress={() => setTab("logs")} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {tab === "monitor" ? (
          <>
            <View style={styles.metricsRow}>
              <MetricCard label={tr(language, "Aktif", "Active")} value={`${activeCount}`} tone="neutral" />
              <MetricCard label={tr(language, "Alert", "Alerts")} value={`${alertCount}`} tone="warning" />
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{tr(language, "Aksi Cepat", "Quick Actions")}</Text>
              <Text style={styles.backendLine}>
                {tr(language, "Backend:", "Backend:")} {backendBaseUrl}
              </Text>
              <TerminalButton label={tr(language, "Kelola URL Whitelist", "Manage URL Whitelist")} variant="outline" onPress={onOpenWhitelist} />
              <TerminalButton label={tr(language, "Buka Riwayat", "Open History")} variant="outline" onPress={onOpenHistory} />
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{tr(language, "Kontrol Sesi Langsung", "Live Session Controls")}</Text>
              <TerminalButton
                label={tr(language, "Pause Session", "Pause Session")}
                variant="outline"
                onPress={onPauseSession}
              />
              <TerminalButton
                label={tr(language, "Resume Session", "Resume Session")}
                variant="outline"
                onPress={onResumeSession}
              />
              <TerminalButton
                label={tr(language, "Reissue Signature", "Reissue Signature")}
                variant="outline"
                onPress={onReissueSignature}
              />
              <Text style={styles.infoLine}>{sessionControlStatus}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{tr(language, "PIN Sesi Aktif", "Active Session PIN")}</Text>
              <Text style={styles.pinValue}>{proctorPin || "----"}</Text>
              <Text style={styles.pinStatus}>{proctorPinStatus}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{tr(language, "Status Token Tergenerate", "Generated Token Status")}</Text>
              {tokenMonitorItems.length === 0 ? (
                <Text style={styles.emptyText}>{tr(language, "Belum ada token.", "No generated tokens yet.")}</Text>
              ) : (
                tokenMonitorItems.map((item) => (
                  <View key={item.token} style={styles.tokenRow}>
                    <View style={styles.tokenHeader}>
                      <Text style={styles.tokenValue}>{item.token}</Text>
                      <StatusBadge status={item.status} />
                    </View>
                    <Text style={styles.tokenMeta}>
                      {tr(language, "Peran", "Role")}: {item.role.toUpperCase()}
                    </Text>
                    <Text style={styles.tokenMeta}>
                      IP: {item.ipAddress} | {tr(language, "Perangkat", "Device")}: {item.deviceName}
                    </Text>
                    <Text style={styles.tokenMeta}>
                      {tr(language, "Last Seen", "Last Seen")}: {item.lastSeenLabel}
                    </Text>
                    <Text style={styles.tokenMeta}>
                      {tr(language, "Kadaluarsa", "Expires")}: {item.expiresAtLabel}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </>
        ) : null}

        {tab === "tokens" ? (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{tr(language, "Generate Session Token", "Generate Session Token")}</Text>
              <TerminalInput
                value={tokenExpiryMinutes}
                onChangeText={onTokenExpiryMinutesChange}
                label={tr(language, "Durasi Token (Menit)", "Token Duration (Minutes)")}
                placeholder="120"
                keyboardType="number-pad"
              />
              <TerminalButton label={tr(language, "Generate Token Siswa", "Generate Student Token")} onPress={onGenerateToken} />
              <TerminalButton
                label={tr(language, "Copy Token", "Copy Token")}
                variant="outline"
                onPress={onCopyGeneratedToken}
                disabled={!generatedToken}
              />
              <Text style={styles.infoLine}>{tr(language, "Token:", "Token:")} {generatedToken || "-"}</Text>
              <Text style={styles.infoLine}>{tr(language, "Kadaluarsa:", "Expires:")} {generatedTokenExpiryAt || "-"}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{tr(language, "Token URL Binding", "Token URL Binding")}</Text>
              <TerminalInput
                value={tokenLaunchUrl}
                onChangeText={onTokenLaunchUrlChange}
                label={tr(language, "URL Untuk Token Ini", "URL For This Token")}
                placeholder="https://docs.google.com/forms/..."
                autoCapitalize="none"
              />
              <TerminalButton
                label={tr(language, "Simpan URL ke Token", "Save URL to Token")}
                variant="outline"
                onPress={onSaveTokenLaunchUrl}
              />
              <Text style={styles.infoLine}>{tokenLaunchUrlStatus}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{tr(language, "Konfigurasi PIN Proktor", "Configure Proctor PIN")}</Text>
              <TerminalInput
                value={proctorPin}
                onChangeText={onProctorPinChange}
                label={tr(language, "PIN Proktor", "Proctor PIN")}
                placeholder="4321"
                keyboardType="number-pad"
                secureTextEntry
              />
              <TerminalButton label={tr(language, "Simpan PIN", "Save PIN")} variant="outline" onPress={onSaveProctorPin} />
              <Text style={styles.pinStatus}>{proctorPinStatus}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{tr(language, "Revoke Session Siswa", "Revoke Student Session")}</Text>
              <TerminalInput
                value={revokeTokenInput}
                onChangeText={onRevokeTokenInputChange}
                label={tr(language, "Token Siswa", "Student Token")}
                placeholder="S-XXXXXXXXXX"
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <TerminalButton
                label={tr(language, "Revoke Login Siswa", "Revoke Student Login")}
                variant="outline"
                onPress={onRevokeStudentToken}
              />
              <Text style={styles.infoLine}>{revokeTokenStatus}</Text>
            </View>
          </>
        ) : null}

        {tab === "logs" ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{tr(language, "Live Logs", "Live Logs")}</Text>
            {logs.length === 0 ? (
              <Text style={styles.emptyText}>{tr(language, "Belum ada log.", "No logs yet.")}</Text>
            ) : (
              logs.slice(0, 60).map((entry, index) => (
                <View key={`${index}-${entry}`} style={styles.logItem}>
                  <Text style={styles.logText}>{entry}</Text>
                </View>
              ))
            )}
          </View>
        ) : null}
      </ScrollView>
    </Layout>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.tabBtn, active ? styles.tabBtnActive : null]} onPress={onPress}>
      <Text style={[styles.tabText, active ? styles.tabTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone: "neutral" | "warning" }) {
  return (
    <View style={[styles.metricCard, tone === "warning" ? styles.metricWarning : null]}>
      <Text style={styles.metricLabel}>{label.toUpperCase()}</Text>
      <Text style={[styles.metricValue, tone === "warning" ? styles.metricValueWarning : null]}>{value}</Text>
    </View>
  );
}

function StatusBadge({ status }: { status: MonitorStatus }) {
  const isOnline = status === "online";
  const isRevoked = status === "revoked";
  const isExpired = status === "expired";
  return (
    <View
      style={[
        styles.statusBadge,
        isOnline ? styles.statusOnline : null,
        isRevoked ? styles.statusRevoked : null,
        isExpired ? styles.statusExpired : null,
      ]}
    >
      <Text style={styles.statusText}>{status.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 8,
  },
  tabBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    paddingVertical: 8,
    alignItems: "center",
  },
  tabBtnActive: {
    borderColor: palette.neon,
    backgroundColor: "rgba(34,197,94,0.12)",
  },
  tabText: {
    color: "#9ca3af",
    fontFamily: "JetBrainsMono-Bold",
    fontSize: 10,
    letterSpacing: 0.8,
  },
  tabTextActive: {
    color: "#166534",
  },
  scrollContent: {
    paddingBottom: 14,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  metricCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    padding: 12,
  },
  metricWarning: {
    borderColor: "rgba(239,68,68,0.22)",
    backgroundColor: "rgba(239,68,68,0.08)",
  },
  metricLabel: {
    color: "#9ca3af",
    fontFamily: "JetBrainsMono-Bold",
    fontSize: 10,
    marginBottom: 4,
  },
  metricValue: {
    color: "#1f2937",
    fontFamily: "JetBrainsMono-Bold",
    fontSize: 24,
  },
  metricValueWarning: {
    color: "#ef4444",
  },
  card: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    padding: 12,
    marginBottom: 10,
  },
  cardTitle: {
    color: "#1f2937",
    fontFamily: "JetBrainsMono-Bold",
    fontSize: 12,
    marginBottom: 8,
  },
  infoLine: {
    color: "#6b7280",
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 10,
    marginBottom: 4,
  },
  backendLine: {
    color: "#9ca3af",
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 10,
    marginBottom: 8,
  },
  pinValue: {
    color: "#22c55e",
    fontFamily: "JetBrainsMono-Bold",
    fontSize: 22,
    marginBottom: 6,
  },
  pinStatus: {
    color: "#9ca3af",
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 10,
    lineHeight: 15,
  },
  logItem: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    backgroundColor: "#f8fafc",
    padding: 8,
    marginBottom: 6,
  },
  logText: {
    color: "#4b5563",
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 10,
    lineHeight: 15,
  },
  emptyText: {
    color: "#9ca3af",
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 10,
  },
  tokenRow: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    backgroundColor: "#f8fafc",
    padding: 8,
    marginBottom: 8,
  },
  tokenHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  tokenValue: {
    color: "#111827",
    fontFamily: "JetBrainsMono-Bold",
    fontSize: 11,
  },
  tokenMeta: {
    color: "#6b7280",
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 10,
    lineHeight: 15,
  },
  statusBadge: {
    borderWidth: 1,
    borderColor: "#9ca3af",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: "#f3f4f6",
  },
  statusOnline: {
    borderColor: "rgba(34,197,94,0.45)",
    backgroundColor: "rgba(34,197,94,0.14)",
  },
  statusRevoked: {
    borderColor: "rgba(239,68,68,0.45)",
    backgroundColor: "rgba(239,68,68,0.14)",
  },
  statusExpired: {
    borderColor: "rgba(245,158,11,0.45)",
    backgroundColor: "rgba(245,158,11,0.14)",
  },
  statusText: {
    color: "#111827",
    fontFamily: "JetBrainsMono-Bold",
    fontSize: 9,
    letterSpacing: 0.5,
  },
  footerWrap: {
    gap: 0,
  },
});
