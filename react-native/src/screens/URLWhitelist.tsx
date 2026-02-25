import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { AppLanguage, tr } from "../i18n";
import Layout, { TerminalButton, TerminalInput, palette } from "./Layout";

type URLWhitelistProps = {
  language: AppLanguage;
  backendBaseUrl: string;
  whitelistInput: string;
  onWhitelistInputChange: (value: string) => void;
  whitelist: string[];
  proctorPin: string;
  onProctorPinChange: (value: string) => void;
  onAddUrl: () => void;
  onSavePin: () => void;
  onBack: () => void;
};

export default function URLWhitelist({
  language,
  backendBaseUrl,
  whitelistInput,
  onWhitelistInputChange,
  whitelist,
  proctorPin,
  onProctorPinChange,
  onAddUrl,
  onSavePin,
  onBack,
}: URLWhitelistProps) {
  return (
    <Layout
      title={tr(language, "Whitelist Manager", "Whitelist Manager")}
      subtitle={tr(language, "Kelola domain ujian dan kebijakan PIN proktor.", "Manage exam domains and proctor PIN policy.")}
      footer={<TerminalButton label={tr(language, "Kembali ke Dashboard", "Back to Dashboard")} variant="outline" onPress={onBack} />}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.backendLine}>
            {tr(language, "Backend Target:", "Backend Target:")} {backendBaseUrl}
          </Text>
          <TerminalInput
            value={whitelistInput}
            onChangeText={onWhitelistInputChange}
            label={tr(language, "Tambah URL", "Add URL")}
            placeholder="https://forms.google.com/..."
            autoCapitalize="none"
          />
          <TerminalButton label={tr(language, "Tambah ke Whitelist", "Add to Whitelist")} onPress={onAddUrl} />
        </View>

        <View style={styles.card}>
          <TerminalInput
            value={proctorPin}
            onChangeText={onProctorPinChange}
            label={tr(language, "PIN Proktor", "Proctor PIN")}
            placeholder="4321"
            keyboardType="number-pad"
            secureTextEntry
          />
          <TerminalButton label={tr(language, "Simpan PIN", "Save PIN")} variant="outline" onPress={onSavePin} />
        </View>

        <Text style={styles.sectionTitle}>{tr(language, "Active Allowlist", "Active Allowlist")}</Text>
        {whitelist.length === 0 ? (
          <Text style={styles.emptyText}>{tr(language, "Belum ada URL.", "No URLs added.")}</Text>
        ) : (
          whitelist.map((url, index) => (
            <View key={`${index}-${url}`} style={styles.item}>
              <Text style={styles.itemIdx}>{index + 1}.</Text>
              <Text style={styles.itemText}>{url}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </Layout>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 8,
  },
  card: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    padding: 12,
    marginBottom: 10,
  },
  backendLine: {
    color: "#9ca3af",
    fontFamily: "Montserrat-Regular",
    fontSize: 10,
    marginBottom: 8,
  },
  sectionTitle: {
    color: "#1f2937",
    fontFamily: "Montserrat-Bold",
    fontSize: 12,
    marginBottom: 8,
  },
  emptyText: {
    color: "#9ca3af",
    fontFamily: "Montserrat-Regular",
    fontSize: 10,
  },
  item: {
    flexDirection: "row",
    gap: 8,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  itemIdx: {
    color: "#9ca3af",
    fontFamily: "Montserrat-Bold",
    fontSize: 10,
    minWidth: 18,
  },
  itemText: {
    flex: 1,
    color: "#4b5563",
    fontFamily: "Montserrat-Regular",
    fontSize: 10,
  },
});
