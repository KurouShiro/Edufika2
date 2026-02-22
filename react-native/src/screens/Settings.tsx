import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppLanguage, tr } from "../i18n";
import Layout, { TerminalButton, palette } from "./Layout";

type SettingsScreenProps = {
  language: AppLanguage;
  onSelectLanguage: (language: AppLanguage) => void;
  onBack: () => void;
};

export default function Settings({ language, onSelectLanguage, onBack }: SettingsScreenProps) {
  return (
    <Layout
      title={tr(language, "Settings", "Settings")}
      subtitle={tr(language, "Konfigurasi bahasa aplikasi.", "Application language configuration.")}
    >
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{tr(language, "Language", "Language").toUpperCase()}</Text>
        <View style={styles.langRow}>
          <LangButton
            active={language === "id"}
            label="Bahasa"
            onPress={() => onSelectLanguage("id")}
          />
          <LangButton
            active={language === "en"}
            label="English"
            onPress={() => onSelectLanguage("en")}
          />
        </View>
      </View>

      <View style={styles.note}>
        <Text style={styles.noteText}>
          {tr(
            language,
            "Perubahan bahasa diterapkan langsung pada alur sesi aktif.",
            "Language changes apply immediately in the active session flow."
          )}
        </Text>
      </View>

      <TerminalButton label={tr(language, "Terapkan dan Kembali", "Apply and Back")} onPress={onBack} />
    </Layout>
  );
}

function LangButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.langBtn, active ? styles.langBtnActive : null]}>
      <Text style={[styles.langBtnText, active ? styles.langBtnTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 22,
    padding: 12,
    backgroundColor: "#ffffff",
    marginBottom: 10,
  },
  sectionLabel: {
    color: "#9ca3af",
    fontFamily: "JetBrainsMono-Bold",
    fontSize: 10,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  langRow: {
    flexDirection: "row",
    gap: 8,
  },
  langBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#f9fafb",
  },
  langBtnActive: {
    borderColor: palette.neon,
    backgroundColor: palette.neon,
  },
  langBtnText: {
    color: "#6b7280",
    fontFamily: "JetBrainsMono-Bold",
    fontSize: 11,
  },
  langBtnTextActive: {
    color: "#ffffff",
  },
  note: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 16,
    backgroundColor: "#f8fafc",
    padding: 10,
    marginBottom: 10,
  },
  noteText: {
    color: "#9ca3af",
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 10,
    lineHeight: 15,
  },
});
