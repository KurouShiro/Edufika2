import React from "react";
import { FlatList, Text, View } from "react-native";
import { AppLanguage, tr } from "../i18n";
import Layout, { TerminalBadge, TerminalButton, terminalStyles } from "./Layout";

type HistoryScreenProps = {
  language: AppLanguage;
  logs: string[];
  onBack: () => void;
};

export default function HistoryScreen({ language, logs, onBack }: HistoryScreenProps) {
  return (
    <Layout
      title={tr(language, "Riwayat Sesi", "Session History")}
      subtitle={tr(
        language,
        "Timeline audit untuk klaim token, event browser, dan pelanggaran.",
        "Audit timeline for token claims, browser events, and violations."
      )}
      topRight={<TerminalBadge label={`${logs.length} ${tr(language, "LOG", "LOGS")}`} tone="muted" />}
      footer={<TerminalButton label={tr(language, "Kembali", "Back")} variant="outline" onPress={onBack} />}
    >
      <FlatList
        data={logs}
        keyExtractor={(item, index) => `${index}-${item}`}
        renderItem={({ item }) => (
          <View style={terminalStyles.card}>
            <Text style={terminalStyles.bodyText}>{item}</Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={terminalStyles.subtleText}>{tr(language, "Belum ada riwayat.", "No history available.")}</Text>
        }
      />
    </Layout>
  );
}
