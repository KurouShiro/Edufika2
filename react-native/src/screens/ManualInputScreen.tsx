import React from "react";
import { Text, View } from "react-native";
import { AppLanguage, tr } from "../i18n";
import Layout, { TerminalButton, TerminalInput, terminalStyles } from "./Layout";

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
      title={tr(language, "Endpoint Tujuan", "Target Endpoint")}
      subtitle={tr(
        language,
        "Masukkan URL ujian valid dari protokol registry yang diizinkan.",
        "Input a valid exam URL from authorized registry protocol."
      )}
    >
      <View style={terminalStyles.card}>
        <TerminalInput
          value={urlInput}
          onChangeText={onUrlInputChange}
          label={tr(language, "URL Protokol Registry", "Registry Protocol URL")}
          placeholder="https://exam.school.edu/session"
          autoCapitalize="none"
        />
        <TerminalButton label={tr(language, "Jalankan Endpoint", "Deploy Engine")} onPress={onValidate} />
        <TerminalButton label={tr(language, "Kembali", "Back")} variant="outline" onPress={onBack} />
      </View>

      <Text style={terminalStyles.subtleText}>
        {tr(language, "Hanya domain whitelist yang dapat dimuat di browser ujian.", "Only whitelisted domains can be loaded into exam browser.")}
      </Text>
      <Text style={terminalStyles.subtleText}>
        {tr(language, "Hostname atau protokol tidak valid langsung memblokir awal sesi.", "Invalid hostname or protocol immediately blocks session startup.")}
      </Text>
    </Layout>
  );
}
