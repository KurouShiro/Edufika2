import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppLanguage, tr } from "../i18n";
import Layout, { TerminalButton, TerminalInput, palette } from "./Layout";

export type AdminGeneratedTokenItem = {
  token: string;
  expiresAt: string;
};

type SessionMode = "BROWSER_LOCKDOWN" | "HYBRID" | "IN_APP_QUIZ";
export type TokenActivityState =
  | "waiting_claim"
  | "on_exam_screen"
  | "disconnected"
  | "revoked"
  | "expired"
  | "paused";

export type TokenActivityLogItem = {
  id: string;
  token: string;
  timestampLabel: string;
  message: string;
  tone: "neutral" | "warning" | "danger" | "success";
  activityState?: TokenActivityState;
  violationType?: string;
  examWebsite?: string;
};

type AdminDashboardPanelProps = {
  language: AppLanguage;
  backendBaseUrl: string;
  sessionMode: SessionMode;
  generatedToken: string;
  generatedTokenExpiryAt: string;
  tokenBatchCount: string;
  generatedTokenBatch: AdminGeneratedTokenItem[];
  tokenExpiryMinutes: string;
  tokenLaunchUrl: string;
  tokenLaunchUrlStatus: string;
  proctorPin: string;
  proctorPinStatus: string;
  revokeTokenInput: string;
  revokeTokenStatus: string;
  sessionControlStatus: string;
  backendMonitorError: string;
  tokenMonitorItems: AdminTokenMonitorItem[];
  selectedMonitorToken: string;
  selectedMonitorDetail: AdminTokenMonitorDetail | null;
  logs: string[];
  tokenActivityLogsByToken: Record<string, TokenActivityLogItem[]>;
  reactivateTokenInput: string;
  reactivateTokenStatus: string;
  reactivateTokenPending: boolean;
  onSelectMonitorToken: (token: string) => void;
  onTokenBatchCountChange: (value: string) => void;
  onSessionModeChange: (value: SessionMode) => void;
  onTokenExpiryMinutesChange: (value: string) => void;
  onTokenLaunchUrlChange: (value: string) => void;
  onSaveTokenLaunchUrl: () => void;
  onSaveTokenLaunchUrlForAll: () => void;
  onProctorPinChange: (value: string) => void;
  onSaveProctorPin: () => void;
  onSaveProctorPinForAll: () => void;
  onRevokeTokenInputChange: (value: string) => void;
  onRevokeStudentToken: () => void;
  onReactivateTokenInputChange: (value: string) => void;
  onReactivateStudentToken: () => void;
  onPauseSession: () => void;
  onResumeSession: () => void;
  onReissueSignature: () => void;
  onStopSession: () => void;
  onGenerateToken: () => void;
  onCopyGeneratedToken: (token?: string) => void;
  onCopyAllGeneratedTokens: () => void;
  onSelectGeneratedToken: (token: string) => void;
  onOpenWhitelist: () => void;
  onOpenQuizBuilder: () => void;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
  onTabChange?: (tab: "monitor" | "tokens" | "logs") => void;
};

type MonitorStatus = "issued" | "online" | "offline" | "revoked" | "expired";

export type AdminTokenMonitorItem = {
  token: string;
  role: "student" | "admin";
  status: MonitorStatus;
  ipAddress: string;
  deviceName: string;
  bindingId: string;
  sessionState: string;
  activityState: TokenActivityState;
  activitySummary: string;
  launchUrl: string;
  lockReason: string;
  latestViolationType: string;
  latestViolationDetail: string;
  latestViolationAtLabel: string;
  claimedAtLabel: string;
  expiresAtLabel: string;
  lastSeenLabel: string;
  lastSeenAtMs: number | null;
  staleSeconds: number | null;
};

export type AdminTokenQuizResult = {
  status: string;
  score: number;
  maxScore: number;
  submittedAtLabel: string;
  durationSeconds: number;
  studentName: string;
  studentClass: string;
  studentElective: string;
};

export type AdminTokenMonitorDetail = {
  token: string;
  role: "student" | "admin";
  status: MonitorStatus;
  ipAddress: string;
  deviceName: string;
  bindingId: string;
  sessionState: string;
  activityState: TokenActivityState;
  activitySummary: string;
  latestViolationType: string;
  latestViolationDetail: string;
  latestViolationAtLabel: string;
  lockReason: string;
  expiresAtLabel: string;
  lastSeenLabel: string;
  lastSeenAtMs: number | null;
  staleSeconds: number | null;
  proctorPin: string;
  pinEffectiveDate: string;
  launchUrl: string;
  launchUpdatedAt: string;
  quizResult: AdminTokenQuizResult | null;
};

type AdminTab = "monitor" | "tokens" | "logs";

export default function AdminDashboardPanel({
  language,
  backendBaseUrl,
  sessionMode,
  generatedToken,
  generatedTokenExpiryAt,
  tokenBatchCount,
  generatedTokenBatch,
  tokenExpiryMinutes,
  tokenLaunchUrl,
  tokenLaunchUrlStatus,
  proctorPin,
  proctorPinStatus,
  revokeTokenInput,
  revokeTokenStatus,
  sessionControlStatus,
  backendMonitorError,
  tokenMonitorItems,
  selectedMonitorToken,
  selectedMonitorDetail,
  logs,
  tokenActivityLogsByToken,
  reactivateTokenInput,
  reactivateTokenStatus,
  reactivateTokenPending,
  onSelectMonitorToken,
  onTokenBatchCountChange,
  onSessionModeChange,
  onTokenExpiryMinutesChange,
  onTokenLaunchUrlChange,
  onSaveTokenLaunchUrl,
  onSaveTokenLaunchUrlForAll,
  onProctorPinChange,
  onSaveProctorPin,
  onSaveProctorPinForAll,
  onRevokeTokenInputChange,
  onRevokeStudentToken,
  onReactivateTokenInputChange,
  onReactivateStudentToken,
  onPauseSession,
  onResumeSession,
  onReissueSignature,
  onStopSession,
  onGenerateToken,
  onCopyGeneratedToken,
  onCopyAllGeneratedTokens,
  onSelectGeneratedToken,
  onOpenWhitelist,
  onOpenQuizBuilder,
  onOpenHistory,
  onOpenSettings,
  onLogout,
  onTabChange,
}: AdminDashboardPanelProps) {
  const [tab, setTab] = useState<AdminTab>("monitor");
  const [activityTokenTab, setActivityTokenTab] = useState("");
  const [liveTick, setLiveTick] = useState(0);
  const activeCount = useMemo(
    () => tokenMonitorItems.filter((entry) => entry.activityState === "on_exam_screen").length,
    [tokenMonitorItems]
  );
  const alertCount = useMemo(
    () =>
      tokenMonitorItems.filter(
        (entry) => entry.status === "revoked" || entry.status === "offline" || Boolean(entry.latestViolationType)
      ).length,
    [tokenMonitorItems]
  );
  const activityTokenKeys = useMemo(() => {
    const keys = new Set<string>();
    tokenMonitorItems.forEach((entry) => {
      if (entry.role === "student") {
        keys.add(entry.token.trim().toUpperCase());
      }
    });
    Object.keys(tokenActivityLogsByToken).forEach((token) => {
      if (token.trim()) {
        keys.add(token.trim().toUpperCase());
      }
    });
    return Array.from(keys);
  }, [tokenActivityLogsByToken, tokenMonitorItems]);
  const selectedActivityLogs = activityTokenTab ? tokenActivityLogsByToken[activityTokenTab] ?? [] : [];

  useEffect(() => {
    onTabChange?.(tab);
  }, [onTabChange, tab]);

  useEffect(() => {
    const timer = setInterval(() => {
      setLiveTick((value) => (value + 1) % 1_000_000);
    }, 200);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (activityTokenKeys.length === 0) {
      if (activityTokenTab) {
        setActivityTokenTab("");
      }
      return;
    }
    const normalizedSelected = activityTokenTab.trim().toUpperCase();
    if (normalizedSelected && activityTokenKeys.includes(normalizedSelected)) {
      return;
    }
    const preferred = selectedMonitorToken.trim().toUpperCase();
    if (preferred && activityTokenKeys.includes(preferred)) {
      setActivityTokenTab(preferred);
      return;
    }
    setActivityTokenTab(activityTokenKeys[0]);
  }, [activityTokenKeys, activityTokenTab, selectedMonitorToken]);

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
              <TerminalButton label={tr(language, "Buka Quiz Builder", "Open Quiz Builder")} variant="outline" onPress={onOpenQuizBuilder} />
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
              <TerminalButton
                label={tr(language, "Stop Session", "Stop Session")}
                variant="outline"
                onPress={onStopSession}
              />
              <Text style={styles.infoLine}>{sessionControlStatus}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{tr(language, "PIN Sesi Aktif", "Active Session PIN")}</Text>
              <Text style={styles.pinValue}>{proctorPin || "----"}</Text>
              <Text style={styles.pinStatus}>{proctorPinStatus}</Text>
            </View>
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>
                  {tr(language, "Status Token Tergenerate", "Generated Token Status")}
                </Text>
                <Text style={styles.liveBadge}>
                  {tr(language, "LIVE // 5Hz", "LIVE // 5Hz")}
                </Text>
              </View>
              {backendMonitorError ? (
                <Text style={styles.monitorErrorText}>
                  {tr(language, "Monitor backend error", "Monitor backend error")}: {backendMonitorError}
                </Text>
              ) : null}
              {tokenMonitorItems.length === 0 ? (
                <Text style={styles.emptyText}>{tr(language, "Belum ada token.", "No generated tokens yet.")}</Text>
              ) : (
                tokenMonitorItems.map((item) => (
                  <Pressable
                    key={item.token}
                    style={[
                      styles.tokenRow,
                      item.token.trim().toUpperCase() === selectedMonitorToken.trim().toUpperCase()
                        ? styles.tokenRowActive
                        : null,
                    ]}
                    onPress={() => onSelectMonitorToken(item.token)}
                  >
                    <View style={styles.tokenHeader}>
                      <Text style={styles.tokenValue}>{item.token}</Text>
                      <StatusBadge status={item.status} />
                    </View>
                    <Text style={styles.tokenMeta}>
                      {tr(language, "Aktivitas", "Activity")}:{" "}
                      {formatActivityStateLabel(language, item.activityState)}
                    </Text>
                    <Text style={styles.tokenMeta}>
                      {item.activitySummary}
                    </Text>
                    <Text style={styles.tokenMeta}>
                      {tr(language, "Heartbeat", "Heartbeat")}:{" "}
                      {formatHeartbeatAge(language, item.lastSeenAtMs, liveTick)} | {tr(language, "State", "State")}:{" "}
                      {item.sessionState}
                    </Text>
                    <Text style={styles.tokenMeta}>
                      {tr(language, "Pelanggaran", "Violation")}: {item.latestViolationType || "-"}
                    </Text>
                    <Text style={styles.tokenMeta} numberOfLines={1}>
                      {tr(language, "Website Ujian", "Exam Website")}: {item.launchUrl || "-"}
                    </Text>
                  </Pressable>
                ))
              )}
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{tr(language, "Menu Detail Token", "Token Detail Menu")}</Text>
              {!selectedMonitorDetail ? (
                <Text style={styles.emptyText}>
                  {tr(language, "Pilih token pada daftar monitor.", "Select a token from monitor list.")}
                </Text>
              ) : (
                <>
                  <View style={styles.tokenHeader}>
                    <Text style={styles.tokenValue}>{selectedMonitorDetail.token}</Text>
                    <StatusBadge status={selectedMonitorDetail.status} />
                  </View>
                  <Text style={styles.tokenMeta}>
                    {tr(language, "Peran", "Role")}: {selectedMonitorDetail.role.toUpperCase()}
                  </Text>
                  <Text style={styles.tokenMeta}>
                    {tr(language, "Aktivitas", "Activity")}:{" "}
                    {formatActivityStateLabel(language, selectedMonitorDetail.activityState)}
                  </Text>
                  <Text style={styles.tokenMeta}>
                    {selectedMonitorDetail.activitySummary}
                  </Text>
                  <Text style={styles.tokenMeta}>
                    IP: {selectedMonitorDetail.ipAddress} | {tr(language, "Perangkat", "Device")}:{" "}
                    {selectedMonitorDetail.deviceName}
                  </Text>
                  <Text style={styles.tokenMeta}>
                    {tr(language, "Heartbeat", "Heartbeat")}:{" "}
                    {formatHeartbeatAge(language, selectedMonitorDetail.lastSeenAtMs, liveTick)}
                  </Text>
                  <Text style={styles.tokenMeta}>
                    {tr(language, "Last Seen", "Last Seen")}: {selectedMonitorDetail.lastSeenLabel}
                  </Text>
                  <Text style={styles.tokenMeta}>
                    {tr(language, "Kadaluarsa", "Expires")}: {selectedMonitorDetail.expiresAtLabel}
                  </Text>
                  <Text style={styles.tokenMeta}>
                    {tr(language, "Session State", "Session State")}: {selectedMonitorDetail.sessionState}
                  </Text>
                  <Text style={styles.tokenMeta}>
                    {tr(language, "Binding", "Binding")}: {selectedMonitorDetail.bindingId || "-"}
                  </Text>
                  <Text style={styles.tokenMeta}>
                    {tr(language, "Lock Reason", "Lock Reason")}: {selectedMonitorDetail.lockReason || "-"}
                  </Text>
                  <Text style={styles.detailSectionTitle}>{tr(language, "Aktivitas Langsung", "Live Activity")}</Text>
                  <Text style={styles.tokenMeta}>
                    {tr(language, "Violation Type", "Violation Type")}:{" "}
                    {selectedMonitorDetail.latestViolationType || "-"}
                  </Text>
                  <Text style={styles.tokenMeta}>
                    {tr(language, "Violation Detail", "Violation Detail")}:{" "}
                    {selectedMonitorDetail.latestViolationDetail || "-"}
                  </Text>
                  <Text style={styles.tokenMeta}>
                    {tr(language, "Violation At", "Violation At")}:{" "}
                    {selectedMonitorDetail.latestViolationAtLabel || "-"}
                  </Text>
                  <Text style={styles.tokenMeta}>
                    {tr(language, "Website Ujian", "Exam Website")}: {selectedMonitorDetail.launchUrl || "-"}
                  </Text>
                  {selectedMonitorDetail.quizResult ? (
                    <>
                      <Text style={styles.detailSectionTitle}>
                        {tr(language, "Hasil Ujian Token", "Token Exam Result")}
                      </Text>
                      <Text style={styles.tokenMeta}>
                        {tr(language, "Status", "Status")}: {selectedMonitorDetail.quizResult.status}
                      </Text>
                      <Text style={styles.tokenMeta}>
                        {tr(language, "Nilai", "Score")}: {selectedMonitorDetail.quizResult.score}/
                        {selectedMonitorDetail.quizResult.maxScore}
                      </Text>
                      <Text style={styles.tokenMeta}>
                        {tr(language, "Durasi", "Duration")}: {selectedMonitorDetail.quizResult.durationSeconds}s
                      </Text>
                      <Text style={styles.tokenMeta}>
                        {tr(language, "Submitted", "Submitted")}: {selectedMonitorDetail.quizResult.submittedAtLabel}
                      </Text>
                      <Text style={styles.tokenMeta}>
                        {tr(language, "Nama", "Name")}: {selectedMonitorDetail.quizResult.studentName}
                      </Text>
                      <Text style={styles.tokenMeta}>
                        {tr(language, "Kelas", "Class")}: {selectedMonitorDetail.quizResult.studentClass}
                      </Text>
                      <Text style={styles.tokenMeta}>
                        {tr(language, "Peminatan", "Elective")}: {selectedMonitorDetail.quizResult.studentElective}
                      </Text>
                    </>
                  ) : null}
                  <Text style={styles.detailSectionTitle}>
                    {tr(language, "Info Token Website", "Website Token Info")}
                  </Text>
                  <Text style={styles.tokenMeta}>
                    {tr(language, "PIN Proktor", "Proctor PIN")}: {selectedMonitorDetail.proctorPin || "-"}
                  </Text>
                  <Text style={styles.tokenMeta}>
                    {tr(language, "PIN Efektif", "PIN Effective")}:{" "}
                    {selectedMonitorDetail.pinEffectiveDate || "-"}
                  </Text>
                  <Text style={styles.tokenMeta}>
                    {tr(language, "URL Update", "URL Updated")}: {selectedMonitorDetail.launchUpdatedAt || "-"}
                  </Text>
                </>
              )}
            </View>
          </>
        ) : null}

        {tab === "tokens" ? (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{tr(language, "Generate Session Token", "Generate Session Token")}</Text>
              <TerminalInput
                value={tokenBatchCount}
                onChangeText={onTokenBatchCountChange}
                label={tr(language, "Jumlah Token", "Token Count")}
                placeholder="1-300"
                keyboardType="number-pad"
              />
              <Text style={styles.modeLabel}>{tr(language, "Mode Sesi", "Session Mode")}</Text>
              <View style={styles.modeRow}>
                {(["BROWSER_LOCKDOWN", "HYBRID", "IN_APP_QUIZ"] as SessionMode[]).map((mode) => {
                  const active = sessionMode === mode;
                  const label =
                    mode === "BROWSER_LOCKDOWN"
                      ? tr(language, "Browser", "Browser")
                      : mode === "HYBRID"
                        ? tr(language, "Hybrid", "Hybrid")
                        : tr(language, "In-App Quiz", "In-App Quiz");
                  return (
                    <Pressable
                      key={mode}
                      style={[styles.modeBtn, active ? styles.modeBtnActive : null]}
                      onPress={() => onSessionModeChange(mode)}
                    >
                      <Text style={[styles.modeBtnText, active ? styles.modeBtnTextActive : null]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <TerminalInput
                value={tokenExpiryMinutes}
                onChangeText={onTokenExpiryMinutesChange}
                label={tr(language, "Durasi Token (Menit)", "Token Duration (Minutes)")}
                placeholder="120"
                keyboardType="number-pad"
              />
              <TerminalButton
                label={tr(language, "Generate Token Siswa (Batch)", "Generate Student Tokens (Batch)")}
                onPress={onGenerateToken}
              />
              <TerminalButton
                label={tr(language, "Copy Token", "Copy Token")}
                variant="outline"
                onPress={() => onCopyGeneratedToken()}
                disabled={!generatedToken}
              />
              <TerminalButton
                label={tr(language, "Copy Semua Token", "Copy All Tokens")}
                variant="outline"
                onPress={onCopyAllGeneratedTokens}
                disabled={generatedTokenBatch.length === 0}
              />
              <Text style={styles.infoLine}>{tr(language, "Token:", "Token:")} {generatedToken || "-"}</Text>
              <Text style={styles.infoLine}>{tr(language, "Kadaluarsa:", "Expires:")} {generatedTokenExpiryAt || "-"}</Text>
              <Text style={styles.batchTitle}>
                {tr(language, "Daftar Token Batch", "Batch Token List")} ({generatedTokenBatch.length})
              </Text>
              {generatedTokenBatch.length === 0 ? (
                <Text style={styles.emptyText}>{tr(language, "Belum ada token batch.", "No batch tokens yet.")}</Text>
              ) : (
                <View style={styles.batchListWrap}>
                  {generatedTokenBatch.map((entry) => {
                    const isActive = entry.token.trim().toUpperCase() === generatedToken.trim().toUpperCase();
                    return (
                    <View key={entry.token} style={[styles.batchRow, isActive ? styles.batchRowActive : null]}>
                      <Pressable style={styles.batchInfo} onPress={() => onSelectGeneratedToken(entry.token)}>
                        <Text style={styles.batchToken}>{entry.token}</Text>
                        <Text style={styles.batchMeta}>
                          {tr(language, "Kadaluarsa", "Expires")}: {entry.expiresAt}
                        </Text>
                        <Text style={[styles.batchSelectHint, isActive ? styles.batchSelectHintActive : null]}>
                          {isActive
                            ? tr(language, "Token aktif untuk URL/PIN", "Active token for URL/PIN")
                            : tr(language, "Tap untuk jadikan aktif", "Tap to set active")}
                        </Text>
                      </Pressable>
                      <Pressable style={styles.batchCopyBtn} onPress={() => onCopyGeneratedToken(entry.token)}>
                        <Text style={styles.batchCopyText}>{tr(language, "Copy", "Copy")}</Text>
                      </Pressable>
                    </View>
                    );
                  })}
                </View>
              )}
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
              <TerminalButton
                label={tr(language, "Simpan URL ke Semua Token Batch", "Save URL to All Batch Tokens")}
                variant="outline"
                onPress={onSaveTokenLaunchUrlForAll}
                disabled={generatedTokenBatch.length === 0}
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
              <TerminalButton
                label={tr(language, "Simpan PIN ke Semua Token Batch", "Save PIN to All Batch Tokens")}
                variant="outline"
                onPress={onSaveProctorPinForAll}
                disabled={generatedTokenBatch.length === 0}
              />
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

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{tr(language, "Reaktivasi Token Siswa", "Reactivate Student Token")}</Text>
              <Text style={styles.infoLine}>
                {tr(
                  language,
                  "Gunakan saat false positive akibat koneksi/jaringan. Token akan dibuka ulang agar siswa bisa login kembali.",
                  "Use this for false positives caused by connectivity/network issues. The token will be reopened so the student can log in again."
                )}
              </Text>
              <TerminalInput
                value={reactivateTokenInput}
                onChangeText={onReactivateTokenInputChange}
                label={tr(language, "Token Siswa", "Student Token")}
                placeholder={selectedMonitorToken || "S-XXXXXXXXXX"}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              {selectedMonitorToken ? (
                <Pressable style={styles.inlineActionBtn} onPress={() => onReactivateTokenInputChange(selectedMonitorToken)}>
                  <Text style={styles.inlineActionText}>
                    {tr(language, "Gunakan token monitor terpilih", "Use selected monitor token")}
                  </Text>
                </Pressable>
              ) : null}
              <TerminalButton
                label={
                  reactivateTokenPending
                    ? tr(language, "Memproses Reaktivasi...", "Reactivating...")
                    : tr(language, "Reaktivasi Token Siswa", "Reactivate Student Token")
                }
                variant="outline"
                onPress={onReactivateStudentToken}
                disabled={reactivateTokenPending}
              />
              <Text style={styles.infoLine}>{reactivateTokenStatus}</Text>
            </View>
          </>
        ) : null}

        {tab === "logs" ? (
          <>
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

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{tr(language, "Aktivitas Token Aktif", "Active Token Activity")}</Text>
              {activityTokenKeys.length === 0 ? (
                <Text style={styles.emptyText}>
                  {tr(language, "Belum ada aktivitas token aktif.", "No active token activity yet.")}
                </Text>
              ) : (
                <>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.activityTabs}
                  >
                    {activityTokenKeys.map((token) => (
                      <Pressable
                        key={token}
                        style={[styles.activityTabBtn, activityTokenTab === token ? styles.activityTabBtnActive : null]}
                        onPress={() => setActivityTokenTab(token)}
                      >
                        <Text
                          style={[styles.activityTabText, activityTokenTab === token ? styles.activityTabTextActive : null]}
                        >
                          {token}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>

                  {selectedActivityLogs.length === 0 ? (
                    <Text style={styles.emptyText}>
                      {tr(
                        language,
                        "Belum ada log aktivitas untuk token ini.",
                        "There are no activity logs for this token yet."
                      )}
                    </Text>
                  ) : (
                    selectedActivityLogs.map((entry) => (
                      <View
                        key={entry.id}
                        style={[
                          styles.activityLogItem,
                          entry.tone === "warning"
                            ? styles.activityLogWarning
                            : entry.tone === "danger"
                              ? styles.activityLogDanger
                              : entry.tone === "success"
                                ? styles.activityLogSuccess
                                : null,
                        ]}
                      >
                        <Text style={styles.activityLogStamp}>{entry.timestampLabel}</Text>
                        <Text style={styles.activityLogText}>{entry.message}</Text>
                        {entry.violationType ? (
                          <Text style={styles.activityLogMeta}>
                            {tr(language, "Violation", "Violation")}: {entry.violationType}
                          </Text>
                        ) : null}
                        {entry.examWebsite ? (
                          <Text style={styles.activityLogMeta} numberOfLines={1}>
                            {tr(language, "Website", "Website")}: {entry.examWebsite}
                          </Text>
                        ) : null}
                      </View>
                    ))
                  )}
                </>
              )}
            </View>
          </>
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
  const isOffline = status === "offline";
  const isRevoked = status === "revoked";
  const isExpired = status === "expired";
  return (
    <View
      style={[
        styles.statusBadge,
        isOnline ? styles.statusOnline : null,
        isOffline ? styles.statusOffline : null,
        isRevoked ? styles.statusRevoked : null,
        isExpired ? styles.statusExpired : null,
      ]}
    >
      <Text style={styles.statusText}>{status.toUpperCase()}</Text>
    </View>
  );
}

function formatActivityStateLabel(language: AppLanguage, activityState: TokenActivityState): string {
  switch (activityState) {
    case "on_exam_screen":
      return tr(language, "Di Layar Ujian", "On Exam Screen");
    case "disconnected":
      return tr(language, "Terputus", "Disconnected");
    case "revoked":
      return tr(language, "Terkunci", "Locked");
    case "expired":
      return tr(language, "Kadaluarsa", "Expired");
    case "paused":
      return tr(language, "Dipause", "Paused");
    case "waiting_claim":
    default:
      return tr(language, "Menunggu Klaim", "Waiting for Claim");
  }
}

function formatHeartbeatAge(language: AppLanguage, lastSeenAtMs: number | null, tick: number): string {
  void tick;
  if (!lastSeenAtMs || Number.isNaN(lastSeenAtMs)) {
    return tr(language, "Belum ada heartbeat", "No heartbeat yet");
  }
  const diffMs = Math.max(0, Date.now() - lastSeenAtMs);
  if (diffMs < 1000) {
    return tr(language, "baru saja", "just now");
  }
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) {
    return tr(language, `${seconds} dtk lalu`, `${seconds}s ago`);
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return tr(language, `${minutes} mnt lalu`, `${minutes}m ago`);
  }
  const hours = Math.floor(minutes / 60);
  return tr(language, `${hours} jam lalu`, `${hours}h ago`);
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
    fontFamily: "Montserrat-Bold",
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
    fontFamily: "Montserrat-Bold",
    fontSize: 10,
    marginBottom: 4,
  },
  metricValue: {
    color: "#1f2937",
    fontFamily: "Montserrat-Bold",
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
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  cardTitle: {
    color: "#1f2937",
    fontFamily: "Montserrat-Bold",
    fontSize: 12,
    marginBottom: 8,
  },
  liveBadge: {
    color: "#166534",
    fontFamily: "Montserrat-Bold",
    fontSize: 9,
    letterSpacing: 0.7,
  },
  infoLine: {
    color: "#6b7280",
    fontFamily: "Montserrat-Regular",
    fontSize: 10,
    marginBottom: 4,
  },
  backendLine: {
    color: "#9ca3af",
    fontFamily: "Montserrat-Regular",
    fontSize: 10,
    marginBottom: 8,
  },
  pinValue: {
    color: "#22c55e",
    fontFamily: "Montserrat-Bold",
    fontSize: 22,
    marginBottom: 6,
  },
  pinStatus: {
    color: "#9ca3af",
    fontFamily: "Montserrat-Regular",
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
    fontFamily: "Montserrat-Regular",
    fontSize: 10,
    lineHeight: 15,
  },
  emptyText: {
    color: "#9ca3af",
    fontFamily: "Montserrat-Regular",
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
  tokenRowActive: {
    borderColor: "rgba(34,197,94,0.5)",
    backgroundColor: "rgba(34,197,94,0.09)",
  },
  tokenHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  tokenValue: {
    color: "#111827",
    fontFamily: "Montserrat-Bold",
    fontSize: 11,
  },
  tokenMeta: {
    color: "#6b7280",
    fontFamily: "Montserrat-Regular",
    fontSize: 10,
    lineHeight: 15,
  },
  detailSectionTitle: {
    color: "#111827",
    fontFamily: "Montserrat-Bold",
    fontSize: 11,
    marginTop: 8,
    marginBottom: 4,
  },
  batchTitle: {
    color: "#111827",
    fontFamily: "Montserrat-Bold",
    fontSize: 11,
    marginTop: 8,
    marginBottom: 6,
  },
  batchListWrap: {
    gap: 6,
  },
  batchRow: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    padding: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  batchRowActive: {
    borderColor: "rgba(34,197,94,0.5)",
    backgroundColor: "rgba(34,197,94,0.09)",
  },
  batchInfo: {
    flex: 1,
  },
  batchToken: {
    color: "#111827",
    fontFamily: "Montserrat-Bold",
    fontSize: 11,
    marginBottom: 2,
  },
  batchMeta: {
    color: "#6b7280",
    fontFamily: "Montserrat-Regular",
    fontSize: 9,
  },
  batchSelectHint: {
    color: "#6b7280",
    fontFamily: "Montserrat-Regular",
    fontSize: 9,
    marginTop: 2,
  },
  batchSelectHintActive: {
    color: "#166534",
    fontFamily: "Montserrat-Bold",
  },
  modeLabel: {
    color: "#6b7280",
    fontFamily: "Montserrat-SemiBold",
    fontSize: 10,
    marginBottom: 6,
  },
  modeRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 8,
  },
  modeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    paddingVertical: 8,
    alignItems: "center",
  },
  modeBtnActive: {
    borderColor: "rgba(34,197,94,0.55)",
    backgroundColor: "rgba(34,197,94,0.14)",
  },
  modeBtnText: {
    color: "#6b7280",
    fontFamily: "Montserrat-SemiBold",
    fontSize: 9,
  },
  modeBtnTextActive: {
    color: "#166534",
    fontFamily: "Montserrat-Bold",
  },
  batchCopyBtn: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#ffffff",
  },
  batchCopyText: {
    color: "#166534",
    fontFamily: "Montserrat-Bold",
    fontSize: 9,
    letterSpacing: 0.3,
  },
  inlineActionBtn: {
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.25)",
    borderRadius: 10,
    backgroundColor: "rgba(34,197,94,0.08)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  inlineActionText: {
    color: "#166534",
    fontFamily: "Montserrat-Bold",
    fontSize: 9,
    letterSpacing: 0.2,
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
  statusOffline: {
    borderColor: "rgba(245,158,11,0.45)",
    backgroundColor: "rgba(245,158,11,0.14)",
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
    fontFamily: "Montserrat-Bold",
    fontSize: 9,
    letterSpacing: 0.5,
  },
  monitorErrorText: {
    color: "#b91c1c",
    fontFamily: "Montserrat-SemiBold",
    fontSize: 11,
    marginBottom: 8,
  },
  activityTabs: {
    gap: 6,
    paddingBottom: 8,
  },
  activityTabBtn: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 10,
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  activityTabBtnActive: {
    borderColor: palette.neon,
    backgroundColor: "rgba(34,197,94,0.12)",
  },
  activityTabText: {
    color: "#6b7280",
    fontFamily: "Montserrat-Bold",
    fontSize: 9,
    letterSpacing: 0.4,
  },
  activityTabTextActive: {
    color: "#166534",
  },
  activityLogItem: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    backgroundColor: "#f8fafc",
    padding: 10,
    marginBottom: 8,
  },
  activityLogWarning: {
    borderColor: "rgba(245,158,11,0.28)",
    backgroundColor: "rgba(245,158,11,0.08)",
  },
  activityLogDanger: {
    borderColor: "rgba(239,68,68,0.28)",
    backgroundColor: "rgba(239,68,68,0.08)",
  },
  activityLogSuccess: {
    borderColor: "rgba(34,197,94,0.28)",
    backgroundColor: "rgba(34,197,94,0.08)",
  },
  activityLogStamp: {
    color: "#9ca3af",
    fontFamily: "Montserrat-Bold",
    fontSize: 9,
    marginBottom: 4,
  },
  activityLogText: {
    color: "#1f2937",
    fontFamily: "Montserrat-Regular",
    fontSize: 10,
    lineHeight: 15,
    marginBottom: 4,
  },
  activityLogMeta: {
    color: "#6b7280",
    fontFamily: "Montserrat-Regular",
    fontSize: 9,
    lineHeight: 14,
  },
  footerWrap: {
    gap: 0,
  },
});
