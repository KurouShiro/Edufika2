import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { AppLanguage, tr } from "../i18n";
import Layout, { TerminalButton, TerminalInput, palette } from "./Layout";

type RegisterProps = {
  language: AppLanguage;
  nama: string;
  kelas: string;
  jurusan: string;
  username: string;
  password: string;
  schoolYear: string;
  statusMessage: string;
  loading?: boolean;
  onNamaChange: (value: string) => void;
  onKelasChange: (value: string) => void;
  onJurusanChange: (value: string) => void;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSchoolYearChange: (value: string) => void;
  onSubmit: () => void;
  onBack: () => void;
};

export default function Register({
  language,
  nama,
  kelas,
  jurusan,
  username,
  password,
  schoolYear,
  statusMessage,
  loading = false,
  onNamaChange,
  onKelasChange,
  onJurusanChange,
  onUsernameChange,
  onPasswordChange,
  onSchoolYearChange,
  onSubmit,
  onBack,
}: RegisterProps) {
  return (
    <Layout
      title={tr(language, "Registrasi Siswa", "Student Registration")}
      subtitle={tr(
        language,
        "Lengkapi data untuk menggunakan kuis in-app.",
        "Complete your details to use in-app quizzes."
      )}
      footer={
        <View style={styles.footerActions}>
          <TerminalButton label={tr(language, "Kembali", "Back")} variant="outline" onPress={onBack} />
        </View>
      }
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{tr(language, "Identitas Siswa", "Student Identity")}</Text>
          <TerminalInput
            value={nama}
            onChangeText={onNamaChange}
            label={tr(language, "Nama (Nama Lengkap)", "Name (Full Name)")}
            placeholder="Nama lengkap"
          />
          <TerminalInput
            value={kelas}
            onChangeText={onKelasChange}
            label={tr(language, "Kelas", "Class")}
            placeholder="Fase E / Fase F / Fase FL"
          />
          <TerminalInput
            value={jurusan}
            onChangeText={onJurusanChange}
            label={tr(language, "Jurusan", "Elective")}
            placeholder="RPL / DKV / AKL / LK / ULW / KTKK / TKJ / TAV / MPLB"
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{tr(language, "Akun Login", "Login Account")}</Text>
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
          <TerminalInput
            value={schoolYear}
            onChangeText={onSchoolYearChange}
            label={tr(language, "Tahun Ajaran", "School Year")}
            placeholder="2025-07-01"
          />
          <Text style={styles.helperText}>
            {tr(
              language,
              "Gunakan format tanggal (YYYY-MM-DD) untuk tahun ajaran.",
              "Use date format (YYYY-MM-DD) for school year."
            )}
          </Text>
          <Text style={styles.statusText}>{statusMessage}</Text>
          <TerminalButton
            label={tr(
              language,
              loading ? "Memproses..." : "Daftar Akun",
              loading ? "Processing..." : "Register Account"
            )}
            onPress={onSubmit}
            disabled={loading}
          />
        </View>
      </ScrollView>
    </Layout>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    padding: 12,
    marginBottom: 10,
  },
  cardTitle: {
    color: "#111827",
    fontFamily: "Montserrat-Bold",
    fontSize: 12,
    marginBottom: 8,
  },
  helperText: {
    color: "#9ca3af",
    fontFamily: "Montserrat-Regular",
    fontSize: 9,
    marginBottom: 6,
  },
  statusText: {
    color: "#6b7280",
    fontFamily: "Montserrat-Regular",
    fontSize: 10,
    marginBottom: 8,
    minHeight: 16,
  },
  footerActions: {
    gap: 0,
  },
});

