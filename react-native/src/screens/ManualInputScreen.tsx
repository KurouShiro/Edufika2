import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { AppLanguage, tr } from "../i18n";
import Layout, { TerminalButton, TerminalInput, palette } from "./Layout";

type ManualInputScreenProps = {
  language: AppLanguage;
  urlInput: string;
  onUrlInputChange: (value: string) => void;
  onValidate: () => void;
  onBack: () => void;
};

export default function ManualInputScreen({
  language,
  urlInput,
  onUrlInputChange,
  onValidate,
  onBack,
}: ManualInputScreenProps) {
  return (
    <Layout
      title={tr(language, "Launch URL", "Launch URL")}
      subtitle={tr(language, "Masukkan endpoint ujian yang valid.", "Enter a valid exam endpoint.")}
    >
      <View style={styles.card}>
        <TerminalInput
          value={urlInput}
          onChangeText={onUrlInputChange}
          label={tr(language, "Endpoint URL", "Endpoint URL")}
          placeholder="https://forms.google.com/..."
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TerminalButton label={tr(language, "Masuk Ruang Ujian", "Enter Exam Room")} onPress={onValidate} />
        <TerminalButton label={tr(language, "Kembali", "Back")} variant="outline" onPress={onBack} />
      </View>

      <View style={styles.note}>
        <Text style={styles.noteText}>
          {tr(
            language,
            "Hanya domain pada whitelist server yang akan diterima oleh kebijakan keamanan.",
            "Only server-whitelisted domains will be accepted by security policy."
          )}
        </Text>
      </View>
    </Layout>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 24,
    padding: 12,
    backgroundColor: "#ffffff",
    marginBottom: 10,
  },
  note: {
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.2)",
    backgroundColor: "rgba(34,197,94,0.08)",
    borderRadius: 16,
    padding: 10,
  },
  noteText: {
    color: "#4b5563",
    fontFamily: "Montserrat-Regular",
    fontSize: 10,
    lineHeight: 14,
  },
});
