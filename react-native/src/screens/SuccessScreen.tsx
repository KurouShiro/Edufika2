import React from "react";
import { Text, View } from "react-native";
import { AppLanguage, tr } from "../i18n";
import Layout, { TerminalBadge, TerminalButton, terminalStyles } from "./Layout";

type SuccessScreenProps = {
  language: AppLanguage;
  onBackToLogin: () => void;
};

export default function SuccessScreen({ language, onBackToLogin }: SuccessScreenProps) {
  const receipt = Math.random().toString(16).slice(2, 10).toUpperCase();
  const syncedAt = new Date().toISOString().replace("T", " ").slice(0, 19);

  return (
    <Layout
      title={tr(language, "Misi Selesai", "Mission Complete")}
      subtitle={tr(
        language,
        "Sesi ujian ditutup dengan sukses. Telemetri dan payload jawaban telah tersinkron.",
        "Exam session closed successfully. Telemetry and answer payload are synced."
      )}
      topRight={<TerminalBadge label={tr(language, "SESI DITUTUP", "SESSION CLOSED")} />}
    >
      <View style={terminalStyles.card}>
        <Text style={terminalStyles.subtleText}>{tr(language, "BUKTI SUBMISI", "SUBMISSION RECEIPT")}</Text>
        <Text style={terminalStyles.heading}>TX-ID: {receipt}</Text>
        <Text style={terminalStyles.subtleText}>{tr(language, "TERSINKRON:", "SYNCED:")} {syncedAt}</Text>
      </View>
      <Text style={terminalStyles.subtleText}>
        {tr(language, "Urutan logout mesin keamanan Edufika selesai.", "Edufika security engine logout sequence complete.")}
      </Text>
      <TerminalButton label={tr(language, "Tutup Sesi Aplikasi", "Close Application Session")} variant="outline" onPress={onBackToLogin} />
    </Layout>
  );
}
