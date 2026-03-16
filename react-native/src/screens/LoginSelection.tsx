import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppLanguage, tr } from "../i18n";
import Layout, { palette } from "./Layout";

type LoginSelectionProps = {
  language: AppLanguage;
  onTokenLogin: () => void;
  onQuizLogin: () => void;
  onOpenSettings?: () => void;
  onExitApp: () => void;
};

export default function LoginSelection({
  language,
  onTokenLogin,
  onQuizLogin,
  onOpenSettings,
  onExitApp,
}: LoginSelectionProps) {
  return (
    <Layout
      title={tr(language, "Pilih Akses", "Choose Access")}
      subtitle={tr(
        language,
        "Gunakan token sesi atau akun siswa untuk kuis in-app.",
        "Use a session token or a student account for in-app quizzes."
      )}
    >
      <View style={styles.container}>
        <View style={styles.brandRow}>
          <Text style={styles.brandText}>EDUFIKA</Text>
          {onOpenSettings ? (
            <Pressable style={styles.settingsChip} onPress={onOpenSettings}>
              <Text style={styles.settingsText}>SET</Text>
            </Pressable>
          ) : (
            <View style={styles.settingsPlaceholder} />
          )}
        </View>

        <View style={styles.heroWrap}>
          <Text style={styles.heroTitle}>Edufika</Text>
          <Text style={styles.heroSubtitle}>
            {tr(language, "Secure Access Console", "Secure Access Console")}
          </Text>
        </View>

        <View style={styles.actionWrap}>
          <Pressable style={styles.primaryButton} onPress={onTokenLogin}>
            <Text style={styles.primaryText}>
              {tr(language, "Masuk dengan Token", "Sign in with Token")}
            </Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={onQuizLogin}>
            <Text style={styles.secondaryText}>
              {tr(language, "Login Kuis In-App", "In-App Quiz Login")}
            </Text>
          </Pressable>
          <Pressable style={styles.exitButton} onPress={onExitApp}>
            <Text style={styles.exitButtonText}>
              {tr(language, "Keluar Aplikasi", "Exit App")}
            </Text>
          </Pressable>
          <Text style={styles.captionText}>
            {tr(
              language,
              "Kredensial siswa hanya berlaku untuk kuis in-app.",
              "Student credentials apply only to in-app quizzes."
            )}
          </Text>
        </View>
      </View>
    </Layout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
  },
  brandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brandText: {
    color: palette.muted,
    fontFamily: "Montserrat-Bold",
    fontSize: 12,
    letterSpacing: 1.4,
  },
  settingsChip: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#ffffff",
  },
  settingsText: {
    color: "#6b7280",
    fontFamily: "Montserrat-Bold",
    fontSize: 9,
    letterSpacing: 0.8,
  },
  settingsPlaceholder: {
    width: 48,
    height: 28,
  },
  heroWrap: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    marginTop: -20,
  },
  heroTitle: {
    color: "#111827",
    fontFamily: "Montserrat-Bold",
    fontSize: 34,
    letterSpacing: 1.2,
  },
  heroSubtitle: {
    color: "#9ca3af",
    fontFamily: "Montserrat-Regular",
    fontSize: 11,
    letterSpacing: 2,
    marginTop: 6,
    textTransform: "uppercase",
  },
  actionWrap: {
    gap: 10,
    paddingBottom: 6,
  },
  primaryButton: {
    borderRadius: 999,
    backgroundColor: "#111827",
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryText: {
    color: "#ffffff",
    fontFamily: "Montserrat-Bold",
    fontSize: 11,
    letterSpacing: 0.9,
  },
  secondaryButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: "#ffffff",
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryText: {
    color: "#4b5563",
    fontFamily: "Montserrat-Bold",
    fontSize: 10,
    letterSpacing: 0.9,
  },
  exitButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.warningSoft,
    backgroundColor: "#ffffff",
    paddingVertical: 10,
    alignItems: "center",
  },
  exitButtonText: {
    color: palette.warning,
    fontFamily: "Montserrat-Bold",
    fontSize: 10,
    letterSpacing: 0.9,
  },
  captionText: {
    color: "#9ca3af",
    fontFamily: "Montserrat-Regular",
    fontSize: 9,
    textAlign: "center",
    letterSpacing: 0.6,
    marginTop: 2,
  },
});
