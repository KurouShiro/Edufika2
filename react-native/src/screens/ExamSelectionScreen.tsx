import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppLanguage, tr } from "../i18n";
import Layout, { TerminalButton, palette } from "./Layout";

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
      title={tr(language, "Metode Ujian", "Exam Method")}
      subtitle={tr(
        language,
        "Pilih cara untuk bergabung ke sesi ujian.",
        "Choose how you want to join the exam session."
      )}
      footer={
        <View style={styles.footerActions}>
          <TerminalButton label={tr(language, "Pengaturan", "Settings")} variant="outline" onPress={onOpenSettings} />
          <TerminalButton label={tr(language, "Logout", "Logout")} variant="outline" onPress={onLogout} />
        </View>
      }
    >
      <Pressable style={[styles.card, styles.qrCard]} onPress={onScanQr}>
        <View style={[styles.iconPill, styles.qrIcon]}>
          <Text style={styles.iconText}>QR</Text>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{tr(language, "Pindai Kode QR", "Scan QR Code")}</Text>
          <Text style={styles.cardSub}>{tr(language, "Pindai kode dari proktor.", "Scan printed proctor code.")}</Text>
        </View>
      </Pressable>

      <Pressable style={[styles.card, styles.manualCard]} onPress={onManualInput}>
        <View style={[styles.iconPill, styles.manualIcon]}>
          <Text style={styles.iconText}>URL</Text>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{tr(language, "URL Manual", "Manual URL")}</Text>
          <Text style={styles.cardSub}>{tr(language, "Masukkan tautan ujian manual.", "Enter exam link manually.")}</Text>
        </View>
      </Pressable>

      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerText}>
          {tr(
            language,
            "Dengan melanjutkan, Anda menyetujui pemantauan sesi. Upaya keluar aplikasi akan dicatat untuk panel proktor.",
            "By continuing, you agree to session monitoring. Exit attempts will be logged to the proctor panel."
          )}
        </Text>
      </View>
    </Layout>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#ffffff",
    shadowColor: "#0f172a",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  qrCard: {
    borderColor: "rgba(34,197,94,0.25)",
  },
  manualCard: {
    borderColor: "rgba(59,130,246,0.2)",
  },
  iconPill: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  qrIcon: {
    backgroundColor: "rgba(34,197,94,0.12)",
  },
  manualIcon: {
    backgroundColor: "rgba(59,130,246,0.12)",
  },
  iconText: {
    color: "#1f2937",
    fontFamily: "Montserrat-Bold",
    fontSize: 12,
    letterSpacing: 1,
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    color: "#1f2937",
    fontFamily: "Montserrat-Bold",
    fontSize: 13,
    marginBottom: 2,
  },
  cardSub: {
    color: "#9ca3af",
    fontFamily: "Montserrat-Regular",
    fontSize: 10,
    lineHeight: 14,
  },
  disclaimer: {
    marginTop: 2,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 16,
    backgroundColor: palette.panelSoft,
    padding: 10,
  },
  disclaimerText: {
    color: "#9ca3af",
    fontFamily: "Montserrat-Regular",
    fontSize: 9,
    lineHeight: 14,
  },
  footerActions: {
    gap: 0,
  },
});
