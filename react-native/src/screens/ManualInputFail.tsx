import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { AppLanguage, tr } from "../i18n";
import Layout, { TerminalButton, palette } from "./Layout";

type ManualInputFailProps = {
  language: AppLanguage;
  invalidUrl: string;
  onTryAgain: () => void;
  onBackToSelection: () => void;
};

export default function ManualInputFail({
  language,
  invalidUrl,
  onTryAgain,
  onBackToSelection,
}: ManualInputFailProps) {
  return (
    <Layout
      title={tr(language, "Validation Failure", "Validation Failure")}
      subtitle={tr(language, "URL tidak terdaftar pada whitelist.", "URL is not registered on the whitelist.")}
    >
      <View style={styles.alertCard}>
        <Text style={styles.alertTitle}>{tr(language, "URL_BLOCKED", "URL_BLOCKED")}</Text>
        <Text style={styles.alertBody}>{invalidUrl || "(empty payload)"}</Text>
      </View>
      <TerminalButton label={tr(language, "Ulangi Input", "Retry Input")} onPress={onTryAgain} />
      <TerminalButton label={tr(language, "Kembali ke Pilihan", "Back to Selection")} variant="outline" onPress={onBackToSelection} />
    </Layout>
  );
}

const styles = StyleSheet.create({
  alertCard: {
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
    backgroundColor: "rgba(239,68,68,0.08)",
    borderRadius: 20,
    padding: 12,
    marginBottom: 10,
  },
  alertTitle: {
    color: palette.warning,
    fontFamily: "Montserrat-Bold",
    fontSize: 12,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  alertBody: {
    color: "#ef4444",
    fontFamily: "Montserrat-Regular",
    fontSize: 11,
    lineHeight: 17,
  },
});
