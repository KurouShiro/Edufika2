import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppLanguage, tr } from "../i18n";
import Layout, { TerminalButton, TerminalInput, palette } from "./Layout";

type UserLoginProps = {
  language: AppLanguage;
  username: string;
  password: string;
  statusMessage: string;
  loading?: boolean;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
  onRegister: () => void;
  onBack: () => void;
};

export default function UserLogin({
  language,
  username,
  password,
  statusMessage,
  loading = false,
  onUsernameChange,
  onPasswordChange,
  onSubmit,
  onRegister,
  onBack,
}: UserLoginProps) {
  return (
    <Layout
      title={tr(language, "Login Kuis In-App", "In-App Quiz Login")}
      subtitle={tr(
        language,
        "Masuk dengan akun siswa untuk mengakses kuis.",
        "Sign in with your student account to access quizzes."
      )}
      footer={
        <View style={styles.footerActions}>
          <TerminalButton label={tr(language, "Kembali", "Back")} variant="outline" onPress={onBack} />
          <TerminalButton label={tr(language, "Daftar", "Register")} variant="outline" onPress={onRegister} />
        </View>
      }
    >
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{tr(language, "Kredensial Siswa", "Student Credentials")}</Text>
        <TerminalInput
          value={username}
          onChangeText={onUsernameChange}
          label={tr(language, "Username", "Username")}
          placeholder="siswa01"
          autoCapitalize="none"
        />
        <TerminalInput
          value={password}
          onChangeText={onPasswordChange}
          label={tr(language, "Password", "Password")}
          placeholder="********"
          secureTextEntry
        />
        <Text style={styles.statusText}>{statusMessage}</Text>
        <TerminalButton
          label={tr(language, loading ? "Memproses..." : "Login", loading ? "Processing..." : "Login")}
          onPress={onSubmit}
          disabled={loading}
        />
        <Pressable style={styles.helperLink} onPress={onRegister}>
          <Text style={styles.helperText}>
            {tr(language, "Belum punya akun? Daftar di sini.", "No account yet? Register here.")}
          </Text>
        </Pressable>
      </View>
    </Layout>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    padding: 12,
  },
  cardTitle: {
    color: "#111827",
    fontFamily: "Montserrat-Bold",
    fontSize: 12,
    marginBottom: 8,
  },
  statusText: {
    color: "#6b7280",
    fontFamily: "Montserrat-Regular",
    fontSize: 10,
    marginBottom: 8,
    minHeight: 18,
  },
  helperLink: {
    marginTop: 2,
  },
  helperText: {
    color: "#9ca3af",
    fontFamily: "Montserrat-Regular",
    fontSize: 9,
    textAlign: "center",
  },
  footerActions: {
    gap: 0,
  },
});
