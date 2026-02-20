import React, { useEffect, useMemo, useRef } from "react";
import { ActivityIndicator, Animated, Easing, StyleSheet, Text, View } from "react-native";
import { Camera, useCameraDevice, useCameraPermission, useCodeScanner } from "react-native-vision-camera";
import { AppLanguage, tr } from "../i18n";
import Layout, { TerminalBadge, TerminalButton, TerminalInput, terminalStyles } from "./Layout";

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
          duration: 1800,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(scanlineValue, {
          toValue: 0,
          duration: 120,
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
      return tr(language, "IZIN KAMERA DIPERLUKAN", "CAM PERMISSION REQUIRED");
    }
    if (!cameraDevice) {
      return tr(language, "KAMERA TIDAK TERSEDIA", "NO CAMERA DEVICE");
    }
    return tr(language, "KAMERA SIAP", "CAM READY");
  }, [cameraDevice, hasPermission, language]);

  const scanlineTranslate = scanlineValue.interpolate({
    inputRange: [0, 1],
    outputRange: [6, 214],
  });

  return (
    <Layout
      title={tr(language, "Pemindai QR", "QR Scanner")}
      subtitle={tr(
        language,
        "Pemindaian kamera aktif via VisionCamera. Fallback manual tetap tersedia.",
        "Live camera scanning active via VisionCamera. Manual fallback remains available."
      )}
      topRight={<TerminalBadge label={statusLabel} />}
    >
      <View style={styles.frameWrap}>
        {hasPermission && cameraDevice ? (
          <Camera style={StyleSheet.absoluteFill} device={cameraDevice} isActive codeScanner={codeScanner} />
        ) : (
          <View style={styles.placeholder}>
            <ActivityIndicator size="small" color="#39FF14" />
            <Text style={styles.placeholderText}>
              {hasPermission
                ? tr(language, "Menyiapkan kamera...", "Preparing camera...")
                : tr(language, "Izin kamera diperlukan untuk pemindaian QR.", "Camera permission is required for QR scanning.")}
            </Text>
            {!hasPermission ? (
              <TerminalButton label={tr(language, "Izinkan Akses Kamera", "Grant Camera Access")} variant="outline" onPress={requestPermission} />
            ) : null}
          </View>
        )}
        <View style={styles.cornerTopLeft} />
        <View style={styles.cornerTopRight} />
        <View style={styles.cornerBottomLeft} />
        <View style={styles.cornerBottomRight} />
        <Animated.View style={[styles.scanline, { transform: [{ translateY: scanlineTranslate }] }]} />
      </View>

      <Text style={terminalStyles.subtleText}>
        {tr(
          language,
          "Arahkan QR ke dalam bingkai. Payload valid pertama akan langsung membuka alur ujian.",
          "Point the QR inside frame. First valid payload auto-opens exam flow."
        )}
      </Text>

      <TerminalInput
        value={manualValue}
        onChangeText={onManualValueChange}
        label={tr(language, "Fallback URL Manual", "Manual URL Fallback")}
        placeholder="https://exam.school.edu/session?qr=..."
        autoCapitalize="none"
      />

      <TerminalButton label={tr(language, "Gunakan Nilai Manual", "Use Manual Value")} onPress={onUseManualValue} />
      <TerminalButton label={tr(language, "Batalkan Scan", "Cancel Scan")} variant="outline" onPress={onBack} />
    </Layout>
  );
}

const styles = StyleSheet.create({
  frameWrap: {
    height: 250,
    borderWidth: 1,
    borderColor: "rgba(57,255,20,0.22)",
    marginBottom: 10,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(57,255,20,0.03)",
    overflow: "hidden",
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
    width: "92%",
    gap: 10,
  },
  placeholderText: {
    color: "rgba(217,255,208,0.7)",
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 11,
    textAlign: "center",
  },
  cornerTopLeft: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 30,
    height: 30,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: "#39FF14",
  },
  cornerTopRight: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 30,
    height: 30,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: "#39FF14",
  },
  cornerBottomLeft: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: 30,
    height: 30,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: "#39FF14",
  },
  cornerBottomRight: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: "#39FF14",
  },
  scanline: {
    position: "absolute",
    left: 0,
    right: 0,
    top: -2,
    height: 2,
    backgroundColor: "rgba(57,255,20,0.28)",
  },
});
