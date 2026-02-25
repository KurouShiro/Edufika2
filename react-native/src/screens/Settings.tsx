import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppLanguage, tr } from "../i18n";
import Layout, { ThemeId, TerminalButton, palette, themePresets } from "./Layout";

type SettingsScreenProps = {
  language: AppLanguage;
  themeId: ThemeId;
  onSelectLanguage: (language: AppLanguage) => void;
  onSelectTheme: (themeId: ThemeId) => void;
  onBack: () => void;
};

export default function Settings({
  language,
  themeId,
  onSelectLanguage,
  onSelectTheme,
  onBack,
}: SettingsScreenProps) {
  return (
    <Layout
      title={tr(language, "Settings", "Settings")}
      subtitle={tr(language, "Konfigurasi bahasa dan tema aplikasi.", "Language and theme configuration.")}
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

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{tr(language, "Theme", "Theme").toUpperCase()}</Text>
        <View style={styles.themeGrid}>
          {themePresets.map((preset) => {
            const active = preset.id === themeId;
            const label = language === "id" ? preset.labelId : preset.labelEn;
            return (
              <Pressable
                key={preset.id}
                onPress={() => onSelectTheme(preset.id)}
                style={[
                  styles.themeCard,
                  active
                    ? {
                        borderColor: palette.neon,
                        backgroundColor: preset.palette.neonSoft,
                      }
                    : null,
                ]}
              >
                <View style={styles.gradientPreview}>
                  <View style={[styles.gradientLeft, { backgroundColor: preset.palette.gradientStart }]} />
                  <View style={[styles.gradientRight, { backgroundColor: preset.palette.gradientEnd }]} />
                </View>
                <Text style={[styles.themeLabel, active ? { color: palette.text } : null]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.note}>
        <Text style={styles.noteText}>
          {tr(
            language,
            "Perubahan bahasa dan tema diterapkan langsung pada alur sesi aktif.",
            "Language and theme changes apply immediately in the active session flow."
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
    fontFamily: "Montserrat-Bold",
    fontSize: 10,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  langRow: {
    flexDirection: "row",
    gap: 8,
  },
  themeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  themeCard: {
    width: "48%",
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 14,
    padding: 8,
    backgroundColor: "#ffffff",
  },
  gradientPreview: {
    height: 28,
    borderRadius: 10,
    overflow: "hidden",
    flexDirection: "row",
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  gradientLeft: {
    flex: 1,
  },
  gradientRight: {
    flex: 1,
  },
  themeLabel: {
    color: "#4b5563",
    fontFamily: "Montserrat-Bold",
    fontSize: 10,
    textAlign: "center",
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
    fontFamily: "Montserrat-Bold",
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
    fontFamily: "Montserrat-Regular",
    fontSize: 10,
    lineHeight: 15,
  },
});
