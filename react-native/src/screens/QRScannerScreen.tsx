import React, { useEffect, useMemo, useRef } from "react";
import { ActivityIndicator, Animated, Easing, StyleSheet, Text, View } from "react-native";
import { Camera, useCameraDevice, useCameraPermission, useCodeScanner } from "react-native-vision-camera";
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

export default function QRScannerScreen({
  language,
  manualValue,
  onManualValueChange,
  onUseManualValue,
  onDetectedValue,
  onBack,
}: QRScannerScreenProps) {
  const hasScannedRef = useRef(false);
  const scanlineValue = useRef(new Animated.Value(0)).current;
  const { hasPermission, requestPermission } = useCameraPermission();
  const cameraDevice = useCameraDevice("back");

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanlineValue, {
          toValue: 1,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(scanlineValue, {
          toValue: 0,
          duration: 100,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scanlineValue]);

  const codeScanner = useCodeScanner({
    codeTypes: ["qr"],
    onCodeScanned: (codes) => {
      if (hasScannedRef.current) {
        return;
      }
      const value = codes?.[0]?.value;
      if (!value) {
        return;
      }
      hasScannedRef.current = true;
      onDetectedValue(value);
      setTimeout(() => {
        hasScannedRef.current = false;
      }, 1200);
    },
  });

  const statusLabel = useMemo(() => {
    if (!hasPermission) {
      return tr(language, "IZIN KAMERA DIPERLUKAN", "CAMERA PERMISSION REQUIRED");
    }
    if (!cameraDevice) {
      return tr(language, "KAMERA TIDAK TERSEDIA", "NO CAMERA DEVICE");
    }
    return tr(language, "SECURE LENS ACTIVE", "SECURE LENS ACTIVE");
  }, [cameraDevice, hasPermission, language]);

  const scanlineTranslate = scanlineValue.interpolate({
    inputRange: [0, 1],
    outputRange: [6, 244],
  });

  return (
    <Layout
      title={tr(language, "QR Scanner", "QR Scanner")}
      subtitle={tr(language, "Arahkan kode QR ke area pemindai.", "Align QR code in scanner viewfinder.")}
    >
      <View style={styles.cameraWrap}>
        {hasPermission && cameraDevice ? (
          <Camera style={StyleSheet.absoluteFill} device={cameraDevice} isActive codeScanner={codeScanner} />
        ) : (
          <View style={styles.placeholder}>
            <ActivityIndicator size="small" color="#22c55e" />
            <Text style={styles.placeholderText}>
              {hasPermission
                ? tr(language, "Menyiapkan kamera...", "Preparing camera...")
                : tr(language, "Kamera membutuhkan izin.", "Camera needs permission.")}
            </Text>
            {!hasPermission ? (
              <TerminalButton label={tr(language, "Izinkan Kamera", "Grant Camera Permission")} variant="outline" onPress={requestPermission} />
            ) : null}
          </View>
        )}

        <View style={styles.cornerTopLeft} />
        <View style={styles.cornerTopRight} />
        <View style={styles.cornerBottomLeft} />
        <View style={styles.cornerBottomRight} />
        <Animated.View style={[styles.scanline, { transform: [{ translateY: scanlineTranslate }] }]} />
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
    gap: 10,
    paddingHorizontal: 20,
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
  cornerTopLeft: {
    position: "absolute",
    top: 14,
    left: 14,
    width: 32,
    height: 32,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: "#22c55e",
    borderTopLeftRadius: 6,
  },
  cornerTopRight: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: "#22c55e",
    borderTopRightRadius: 6,
  },
  cornerBottomLeft: {
    position: "absolute",
    bottom: 14,
    left: 14,
    width: 32,
    height: 32,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: "#22c55e",
    borderBottomLeftRadius: 6,
  },
  cornerBottomRight: {
    position: "absolute",
    bottom: 14,
    right: 14,
    width: 32,
    height: 32,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: "#22c55e",
    borderBottomRightRadius: 6,
  },
  scanline: {
    position: "absolute",
    left: 18,
    right: 18,
    top: 0,
    height: 2,
    backgroundColor: "rgba(34,197,94,0.82)",
    shadowColor: "#22c55e",
    shadowOpacity: 0.5,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 0 },
  },
});
