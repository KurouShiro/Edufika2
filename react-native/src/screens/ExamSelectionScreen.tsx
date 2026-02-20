import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { AppLanguage, tr } from "../i18n";
import Layout, { TerminalBadge, TerminalButton, terminalStyles } from "./Layout";

type ExamSelectionScreenProps = {
  language: AppLanguage;
  onScanQr: () => void;
  onManualInput: () => void;
  onLogout: () => void;
  onOpenSettings: () => void;
};

export default function ExamSelectionScreen({
  language,
  onScanQr,
  onManualInput,
  onLogout,
  onOpenSettings,
}: ExamSelectionScreenProps) {
  return (
    <Layout
      title={tr(language, "Mulai Ujian", "Exam Initiation")}
      subtitle={tr(
        language,
        "Pilih cara memuat URL ujian. Lockdown dimulai segera setelah dijalankan.",
        "Select how to load assigned exam URL. Lockdown starts immediately on launch."
      )}
      topRight={<TerminalBadge label={tr(language, "MODE SISWA", "STUDENT MODE")} />}
    >
      <View style={styles.mainPanel}>
        <TerminalButton label={tr(language, "Pindai Token QR", "Scan QR Token")} onPress={onScanQr} />
        <View style={styles.orRow}>
          <View style={styles.orLine} />
          <Text style={styles.orText}>{tr(language, "ATAU", "OR")}</Text>
          <View style={styles.orLine} />
        </View>
        <TerminalButton label={tr(language, "Input URL Manual", "Manual URL Input")} variant="outline" onPress={onManualInput} />
      </View>

      <Text style={terminalStyles.subtleText}>
        {tr(
          language,
          "PERINGATAN: keluar dari konteks ujian atau membuka domain di luar whitelist akan memicu log pelanggaran.",
          "WARNING: leaving exam context or opening non-whitelisted domains will trigger violation logs."
        )}
      </Text>
      <View style={terminalStyles.divider} />
      <View style={terminalStyles.splitRow}>
        <View style={terminalStyles.splitCol}>
          <TerminalButton label={tr(language, "Pengaturan", "Settings")} variant="outline" onPress={onOpenSettings} />
        </View>
        <View style={terminalStyles.splitCol}>
          <TerminalButton label={tr(language, "Logout Sesi", "Logout Session")} variant="outline" onPress={onLogout} />
        </View>
      </View>
    </Layout>
  );
}

const styles = StyleSheet.create({
  mainPanel: {
    borderWidth: 1,
    borderColor: "rgba(57,255,20,0.2)",
    backgroundColor: "rgba(57,255,20,0.04)",
    padding: 10,
    marginBottom: 8,
  },
  orRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 2,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(57,255,20,0.2)",
  },
  orText: {
    color: "rgba(217,255,208,0.56)",
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 10,
    paddingHorizontal: 8,
    letterSpacing: 1.2,
  },
});
