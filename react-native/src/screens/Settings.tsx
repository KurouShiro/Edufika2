import React from "react";
import { Text, View } from "react-native";
import { AppLanguage, tr } from "../i18n";
import Layout, { TerminalBadge, TerminalButton, terminalStyles } from "./Layout";

type SettingsScreenProps = {
  language: AppLanguage;
  onSelectLanguage: (language: AppLanguage) => void;
  onBack: () => void;
};

export default function Settings({ language, onSelectLanguage, onBack }: SettingsScreenProps) {
  return (
    <Layout
      title={tr(language, "Konfigurasi Lokal", "Local Config")}
      subtitle={tr(language, "Registri bahasa dan kontrol antarmuka.", "Language registry and interface controls.")}
      topRight={<TerminalBadge label={language === "id" ? "ID" : "EN"} tone="muted" />}
    >
      <Text style={terminalStyles.subtleText}>
        {tr(language, "LOKAL PENGGUNA:", "USER LOCALE:")}{" "}
        {language === "id" ? "BAHASA INDONESIA" : "ENGLISH (US)"}
      </Text>

      <View style={terminalStyles.splitRow}>
        <View style={terminalStyles.splitCol}>
          <TerminalButton
            label="Bahasa Indonesia"
            variant={language === "id" ? "solid" : "outline"}
            onPress={() => onSelectLanguage("id")}
          />
        </View>
        <View style={terminalStyles.splitCol}>
          <TerminalButton
            label="English"
            variant={language === "en" ? "solid" : "outline"}
            onPress={() => onSelectLanguage("en")}
          />
        </View>
      </View>

      <Text style={terminalStyles.subtleText}>
        {tr(
          language,
          "Catatan: perubahan bahasa diterapkan langsung dan dicatat di telemetri sesi.",
          "Note: language changes apply immediately and are logged to session telemetry."
        )}
      </Text>
      <TerminalButton label={tr(language, "Kembali", "Back")} variant="outline" onPress={onBack} />
    </Layout>
  );
}
