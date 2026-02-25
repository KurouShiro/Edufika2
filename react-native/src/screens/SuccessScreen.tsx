import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { AppLanguage, tr } from "../i18n";
import Layout, { TerminalButton, palette } from "./Layout";

type SuccessScreenProps = {
  language: AppLanguage;
  onBackToLogin: () => void;
};

export default function SuccessScreen({ language, onBackToLogin }: SuccessScreenProps) {
  const receipt = Math.random().toString(16).slice(2, 10).toUpperCase();

  return (
    <Layout
      title={tr(language, "Submission Finalized", "Submission Finalized")}
      subtitle={tr(
        language,
        "Sesi ujian ditutup aman dan telemetri telah tersinkron.",
        "Exam session closed securely and telemetry has been synchronized."
      )}
    >
      <View style={styles.iconWrap}>
        <Text style={styles.iconText}>OK</Text>
      </View>
      <View style={styles.summaryCard}>
        <Row label={tr(language, "Session Receipt", "Session Receipt")} value={receipt} />
        <Row label={tr(language, "Risk Score", "Risk Score")} value="0.00" />
        <Row label={tr(language, "Status", "Status")} value={tr(language, "COMPLETE", "COMPLETE")} />
      </View>
      <TerminalButton label={tr(language, "Keluar ke Login", "Exit to Login")} onPress={onBackToLogin} />
    </Layout>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 94,
    height: 94,
    borderRadius: 999,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(34,197,94,0.12)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.28)",
    marginVertical: 10,
  },
  iconText: {
    color: palette.neon,
    fontFamily: "Montserrat-Bold",
    fontSize: 24,
    letterSpacing: 1,
  },
  summaryCard: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 22,
    backgroundColor: "#ffffff",
    padding: 12,
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 7,
  },
  rowLabel: {
    color: "#9ca3af",
    fontFamily: "Montserrat-Bold",
    fontSize: 10,
    letterSpacing: 0.5,
  },
  rowValue: {
    color: "#1f2937",
    fontFamily: "Montserrat-Bold",
    fontSize: 11,
  },
});
