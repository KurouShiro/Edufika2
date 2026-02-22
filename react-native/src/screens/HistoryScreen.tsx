import React from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { AppLanguage, tr } from "../i18n";
import Layout, { TerminalButton, palette } from "./Layout";

type HistoryScreenProps = {
  language: AppLanguage;
  logs: string[];
  onBack: () => void;
};

export default function HistoryScreen({ language, logs, onBack }: HistoryScreenProps) {
  return (
    <Layout
      title={tr(language, "Session History", "Session History")}
      subtitle={tr(language, "Timeline audit sesi dan pelanggaran.", "Session and violation timeline audit.")}
      footer={<TerminalButton label={tr(language, "Kembali", "Back")} variant="outline" onPress={onBack} />}
    >
      <FlatList
        data={logs}
        keyExtractor={(item, index) => `${index}-${item}`}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text style={styles.itemText}>{item}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>{tr(language, "Belum ada riwayat.", "No history available.")}</Text>}
      />
    </Layout>
  );
}

const styles = StyleSheet.create({
  item: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    padding: 10,
    marginBottom: 6,
  },
  itemText: {
    color: "#4b5563",
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 10,
    lineHeight: 15,
  },
  empty: {
    color: "#9ca3af",
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 10,
    marginTop: 8,
  },
});
