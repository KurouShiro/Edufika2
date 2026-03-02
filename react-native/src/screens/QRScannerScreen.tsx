import React, { useMemo, useState } from "react";
import { ActivityIndicator, NativeModules, StyleSheet, Text, View } from "react-native";
import { AppLanguage, tr } from "../i18n";
import Layout, { TerminalButton, TerminalInput } from "./Layout";

type QRScannerScreenProps = {
  language: AppLanguage;
  manualValue: string;
  onManualValueChange: (value: string) => void;
  onUseManualValue: () => void;
  onDetectedValue: (value: string) => void;
  onBack: () => void;
};

type EdufikaSecurityModuleShape = {
  openCameraXQrScanner?: () => Promise<string>;
};

const securityModule: EdufikaSecurityModuleShape | undefined = (
  NativeModules as { EdufikaSecurity?: EdufikaSecurityModuleShape }
).EdufikaSecurity;

export default function QRScannerScreen({
  language,
  manualValue,
  onManualValueChange,
  onUseManualValue,
  onDetectedValue,
  onBack,
}: QRScannerScreenProps) {
  const [scanInProgress, setScanInProgress] = useState(false);
  const [scanStatus, setScanStatus] = useState(
    tr(
      language,
      "CAMERAX SCANNER SIAP. GUNAKAN TOMBOL MULAI.",
      "CAMERAX SCANNER READY. USE START BUTTON."
    )
  );

  const startCameraScan = async () => {
    if (scanInProgress) {
      return;
    }

    if (!securityModule?.openCameraXQrScanner) {
      setScanStatus(
        tr(
          language,
          "MODUL CAMERAX TIDAK TERSEDIA. GUNAKAN INPUT MANUAL.",
          "CAMERAX MODULE NOT AVAILABLE. USE MANUAL INPUT."
        )
      );
      return;
    }

    setScanInProgress(true);
    setScanStatus(
      tr(
        language,
        "MEMBUKA CAMERAX SCANNER...",
        "OPENING CAMERAX SCANNER..."
      )
    );

    try {
      const value = await securityModule.openCameraXQrScanner();
      const normalized = String(value ?? "").trim();
      if (!normalized) {
        setScanStatus(
          tr(
            language,
            "QR TIDAK TERBACA. ULANGI SCAN ATAU INPUT MANUAL.",
            "QR NOT DETECTED. RETRY SCAN OR USE MANUAL INPUT."
          )
        );
        return;
      }
      setScanStatus(
        tr(
          language,
          "QR BERHASIL TERBACA.",
          "QR DETECTED SUCCESSFULLY."
        )
      );
      onDetectedValue(normalized);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.toLowerCase().includes("cancel")) {
        setScanStatus(
          tr(
            language,
            "SCAN DIBATALKAN. GUNAKAN TOMBOL MULAI UNTUK MENGULANG.",
            "SCAN CANCELED. USE START BUTTON TO RETRY."
          )
        );
      } else {
        setScanStatus(
          tr(
            language,
            "SCAN GAGAL. CEK IZIN KAMERA ATAU GUNAKAN INPUT MANUAL.",
            "SCAN FAILED. CHECK CAMERA PERMISSION OR USE MANUAL INPUT."
          )
        );
      }
    } finally {
      setScanInProgress(false);
    }
  };

  const statusLabel = useMemo(() => {
    return scanStatus;
  }, [scanStatus]);

  return (
    <Layout
      title={tr(language, "QR Scanner", "QR Scanner")}
      subtitle={tr(language, "Arahkan kode QR ke area pemindai.", "Align QR code in scanner viewfinder.")}
    >
      <View style={styles.cameraWrap}>
        <View style={styles.placeholder}>
          {scanInProgress ? <ActivityIndicator size="small" color="#22c55e" /> : null}
          <Text style={styles.placeholderTitle}>
            {tr(language, "CameraX QR Scanner", "CameraX QR Scanner")}
          </Text>
          <Text style={styles.placeholderText}>
            {tr(
              language,
              "Scanner kamera berjalan dari modul native Android (CameraX) agar kompatibel Android 9+.",
              "Camera scanner runs from native Android CameraX module for Android 9+ compatibility."
            )}
          </Text>
          <TerminalButton
            label={tr(language, "Mulai Scan Kamera", "Start Camera Scan")}
            onPress={() => {
              void startCameraScan();
            }}
            disabled={scanInProgress}
          />
        </View>
      </View>

      <Text style={styles.statusText}>{statusLabel}</Text>
      <TerminalInput
        value={manualValue}
        onChangeText={onManualValueChange}
        label={tr(language, "Manual URL Fallback", "Manual URL Fallback")}
        placeholder="https://docs.google.com/forms/..."
        autoCapitalize="none"
      />
      <TerminalButton label={tr(language, "Gunakan Nilai Manual", "Use Manual Value")} onPress={onUseManualValue} />
      <TerminalButton label={tr(language, "Kembali", "Back")} variant="outline" onPress={onBack} />
    </Layout>
  );
}

const styles = StyleSheet.create({
  cameraWrap: {
    height: 280,
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.24)",
    borderRadius: 24,
    marginBottom: 8,
    overflow: "hidden",
    backgroundColor: "#111827",
  },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 20,
  },
  placeholderTitle: {
    color: "#f9fafb",
    fontFamily: "Montserrat-Bold",
    fontSize: 14,
    letterSpacing: 0.4,
  },
  placeholderText: {
    color: "#d1d5db",
    fontFamily: "Montserrat-Regular",
    fontSize: 11,
    textAlign: "center",
  },
  statusText: {
    color: "#9ca3af",
    fontFamily: "Montserrat-Regular",
    fontSize: 10,
    marginBottom: 8,
    letterSpacing: 0.8,
  },
});
