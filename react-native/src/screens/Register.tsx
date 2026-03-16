import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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
  const [showConfirm, setShowConfirm] = useState(false);
  const emptyValue = tr(language, "Belum diisi", "Not set");
  const safeValue = (value: string) => (value.trim() ? value : emptyValue);
  const passwordPreview = password ? "*".repeat(Math.min(password.length, 8)) : emptyValue;

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
            onPress={() => setShowConfirm(true)}
            disabled={loading}
          />
        </View>
      </ScrollView>

      <Modal transparent visible={showConfirm} animationType="fade" onRequestClose={() => setShowConfirm(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{tr(language, "Konfirmasi Registrasi", "Confirm Registration")}</Text>
            <Text style={styles.modalSub}>
              {tr(
                language,
                "Periksa kembali data di bawah sebelum mendaftar.",
                "Review the details below before registering."
              )}
            </Text>
            <View style={styles.confirmList}>
              <View style={styles.confirmItem}>
                <Text style={styles.confirmLabel}>{tr(language, "Nama", "Name")}</Text>
                <Text style={styles.confirmValue}>{safeValue(nama)}</Text>
              </View>
              <View style={styles.confirmItem}>
                <Text style={styles.confirmLabel}>{tr(language, "Kelas", "Class")}</Text>
                <Text style={styles.confirmValue}>{safeValue(kelas)}</Text>
              </View>
              <View style={styles.confirmItem}>
                <Text style={styles.confirmLabel}>{tr(language, "Jurusan", "Elective")}</Text>
                <Text style={styles.confirmValue}>{safeValue(jurusan)}</Text>
              </View>
              <View style={styles.confirmItem}>
                <Text style={styles.confirmLabel}>{tr(language, "Username", "Username")}</Text>
                <Text style={styles.confirmValue}>{safeValue(username)}</Text>
              </View>
              <View style={styles.confirmItem}>
                <Text style={styles.confirmLabel}>{tr(language, "Password", "Password")}</Text>
                <Text style={styles.confirmValue}>{passwordPreview}</Text>
              </View>
              <View style={styles.confirmItemLast}>
                <Text style={styles.confirmLabel}>{tr(language, "Tahun Ajaran", "School Year")}</Text>
                <Text style={styles.confirmValue}>{safeValue(schoolYear)}</Text>
              </View>
            </View>
            <Text style={styles.passwordHint}>
              {tr(language, "Password disembunyikan untuk keamanan.", "Password is hidden for security.")}
            </Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowConfirm(false)}>
                <Text style={styles.cancelBtnText}>{tr(language, "Periksa Lagi", "Review")}</Text>
              </Pressable>
              <Pressable
                style={[styles.verifyBtn, loading ? styles.verifyBtnDisabled : null]}
                onPress={() => {
                  onSubmit();
                  setShowConfirm(false);
                }}
                disabled={loading}
              >
                <Text style={styles.verifyBtnText}>
                  {tr(
                    language,
                    loading ? "Memproses..." : "Konfirmasi",
                    loading ? "Processing..." : "Confirm"
                  )}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 18,
    justifyContent: "center",
  },
  modalCard: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 24,
    backgroundColor: "#ffffff",
    padding: 14,
  },
  modalTitle: {
    color: "#111827",
    fontFamily: "Montserrat-Bold",
    fontSize: 14,
    marginBottom: 4,
  },
  modalSub: {
    color: "#6b7280",
    fontFamily: "Montserrat-Regular",
    fontSize: 10,
    marginBottom: 10,
  },
  confirmList: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 16,
    padding: 10,
    backgroundColor: "#f9fafb",
    marginBottom: 8,
  },
  confirmItem: {
    marginBottom: 8,
  },
  confirmItemLast: {
    marginBottom: 0,
  },
  confirmLabel: {
    color: "#9ca3af",
    fontFamily: "Montserrat-Regular",
    fontSize: 9,
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  confirmValue: {
    color: "#111827",
    fontFamily: "Montserrat-Bold",
    fontSize: 11,
  },
  passwordHint: {
    color: "#9ca3af",
    fontFamily: "Montserrat-Regular",
    fontSize: 9,
    marginBottom: 10,
  },
  modalActions: {
    flexDirection: "row",
    gap: 8,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 14,
    backgroundColor: "#f3f4f6",
    paddingVertical: 10,
    alignItems: "center",
  },
  cancelBtnText: {
    color: "#6b7280",
    fontFamily: "Montserrat-Bold",
    fontSize: 10,
    letterSpacing: 0.8,
  },
  verifyBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: palette.neon,
    borderRadius: 14,
    backgroundColor: palette.neon,
    paddingVertical: 10,
    alignItems: "center",
  },
  verifyBtnText: {
    color: "#ffffff",
    fontFamily: "Montserrat-Bold",
    fontSize: 10,
    letterSpacing: 0.8,
  },
  verifyBtnDisabled: {
    opacity: 0.6,
  },
});


