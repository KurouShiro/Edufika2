import React, { useCallback, useEffect, useState } from "react";
import { AppState, AppStateStatus } from "react-native";
import { Alert, StyleSheet, Text, View } from "react-native";
import { AppLanguage, tr } from "../i18n";
import Layout, { TerminalButton, palette } from "./Layout";
import {
  hasQuizResultStoragePermission,
  openQuizResultStorageSettings,
  requestQuizResultStoragePermission,
  usesQuizResultStorageSettingsFlow,
} from "../utils/quizResultExport";

type PermissionsScreenProps = {
  language: AppLanguage;
  onContinue: () => void;
  onLog: (message: string) => void;
};

export default function PermissionsScreen({
  language,
  onContinue,
  onLog,
}: PermissionsScreenProps) {
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [loading, setLoading] = useState(false);
  const settingsFlow = usesQuizResultStorageSettingsFlow();
  const [statusLine, setStatusLine] = useState(
    tr(
      language,
      settingsFlow
        ? "Buka pengaturan Android lalu aktifkan akses file agar aplikasi bisa menyimpan hasil ke perangkat."
        : "Izinkan akses file agar aplikasi bisa menyimpan hasil ujian dan kuis ke perangkat.",
      settingsFlow
        ? "Open Android settings and enable file access so the app can save results to the device."
        : "Allow file access so the app can save exam and quiz results to the device."
    )
  );
  const refreshPermissionState = useCallback(async () => {
    const granted = await hasQuizResultStoragePermission();
    setPermissionGranted(granted);
    if (granted) {
      setStatusLine(
        tr(
          language,
          "Izin file sudah aktif. Mengarahkan ke login...",
          "File permission is already active. Redirecting to login..."
        )
      );
      onLog("Startup file permission already granted. Redirecting to login.");
      onContinue();
      return;
    }
    setStatusLine(
      tr(
        language,
        settingsFlow
          ? "Akses file belum aktif. Buka pengaturan Android lalu aktifkan izin untuk aplikasi ini."
          : "Izinkan akses file agar aplikasi bisa menyimpan hasil ujian dan kuis ke perangkat.",
        settingsFlow
          ? "File access is not active yet. Open Android settings and enable permission for this app."
          : "Allow file access so the app can save exam and quiz results to the device."
      )
    );
  }, [language, onContinue, onLog, settingsFlow]);

  useEffect(() => {
    void refreshPermissionState();
  }, [refreshPermissionState]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (nextState === "active") {
        void refreshPermissionState();
      }
    });
    return () => subscription.remove();
  }, [refreshPermissionState]);

  const requestPermission = useCallback(async () => {
    setLoading(true);
    try {
      if (settingsFlow) {
        const opened = await openQuizResultStorageSettings();
        if (!opened) {
          setStatusLine(
            tr(
              language,
              "Gagal membuka pengaturan izin. Buka izin aplikasi secara manual dari Settings Android.",
              "Failed to open permission settings. Open the app permissions manually from Android Settings."
            )
          );
          onLog("Unable to open manage external storage settings.");
        } else {
          setStatusLine(
            tr(
              language,
              "Pengaturan dibuka. Aktifkan akses file lalu kembali ke aplikasi.",
              "Settings opened. Enable file access, then return to the app."
            )
          );
          onLog("Opened manage external storage settings.");
        }
        return;
      }
      const granted = await requestQuizResultStoragePermission();
      setPermissionGranted(granted);
      onLog(`Startup file permission ${granted ? "granted" : "denied"} from Permissions screen.`);
      if (granted) {
        setStatusLine(
          tr(
            language,
            "Izin file diberikan. Mengarahkan ke login...",
            "File permission granted. Redirecting to login..."
          )
        );
        onContinue();
        return;
      }
      setStatusLine(
        tr(
          language,
          "Izin file belum diberikan. Silakan coba lagi.",
          "File permission has not been granted yet. Please try again."
        )
      );
      Alert.alert(
        tr(language, "Izin Diperlukan", "Permission Required"),
        tr(
          language,
          "Aplikasi memerlukan izin file untuk menyimpan hasil. Coba lagi dan pilih Izinkan.",
          "The app needs file permission to save results. Please try again and choose Allow."
        ),
        [
          {
            text: tr(language, "Coba Lagi", "Retry"),
            onPress: () => void requestPermission(),
          },
        ]
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatusLine(message);
      onLog(`Quiz file permission request failed: ${message}`);
    } finally {
      setLoading(false);
    }
  }, [language, onContinue, onLog, settingsFlow]);

  return (
    <Layout
      title={tr(language, "File Permissions", "File Permissions")}
      subtitle={tr(
        language,
        settingsFlow
          ? "Kiosk mode dimatikan sementara di layar ini agar Android bisa membuka halaman pengaturan akses file sebelum login."
          : "Kiosk mode dimatikan sementara di layar ini agar dialog izin Android bisa muncul normal sebelum login.",
        settingsFlow
          ? "Kiosk mode is temporarily disabled on this screen so Android can open the file access settings page before login."
          : "Kiosk mode is temporarily disabled on this screen so the Android permission dialog can appear normally before login."
      )}
    >
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{tr(language, "Simpan Hasil", "Save Results")}</Text>
        <Text style={styles.bodyText}>
          {tr(
            language,
            settingsFlow
              ? "Pada Android baru, akses file tidak muncul sebagai popup biasa. Tekan tombol di bawah untuk membuka halaman izin khusus, aktifkan akses file, lalu kembali ke aplikasi."
              : "Akses ini dipakai untuk menyimpan file hasil ujian dan kuis ke perangkat sebelum diproses lebih lanjut.",
            settingsFlow
              ? "On newer Android versions, file access does not appear as a normal popup. Use the button below to open the special permission page, enable file access, then return to the app."
              : "This access is used to save exam and quiz result files to the device before further processing."
          )}
        </Text>
        <Text style={styles.statusText}>{statusLine}</Text>
        <TerminalButton
          label={
            permissionGranted
              ? tr(language, "Mengarahkan...", "Redirecting...")
              : settingsFlow
                ? tr(language, "Buka Pengaturan Izin", "Open Permission Settings")
                : tr(language, "Izinkan Akses File", "Allow File Access")
          }
          variant={permissionGranted ? "solid" : "outline"}
          onPress={() => void requestPermission()}
          disabled={loading || permissionGranted}
        />
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
    padding: 14,
    gap: 10,
  },
  cardTitle: {
    color: "#111827",
    fontFamily: "Montserrat-Bold",
    fontSize: 13,
  },
  bodyText: {
    color: "#4b5563",
    fontFamily: "Montserrat-Regular",
    fontSize: 11,
    lineHeight: 18,
  },
  statusText: {
    color: "#6b7280",
    fontFamily: "Montserrat-Regular",
    fontSize: 10,
  },
});
