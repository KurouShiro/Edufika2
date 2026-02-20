import React, { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { AppLanguage, tr } from "../i18n";
import Layout, { TerminalBadge, terminalStyles } from "./Layout";

type SplashScreenProps = {
  bootMessage: string;
  language: AppLanguage;
};

export default function SplashScreen({ bootMessage, language }: SplashScreenProps) {
  const [visibleLines, setVisibleLines] = useState(1);
  const bootLines = [
    tr(language, "[BOOT] KERNEL EDUFIKA SEDANG DIMULAI...", "[BOOT] EDUFIKA KERNEL INITIALIZING..."),
    tr(language, "[OK] PROTOKOL KEAMANAN DIMUAT", "[OK] SECURITY PROTOCOLS LOADED"),
    tr(language, "[OK] PROFIL IMMERSIVE TERPASANG", "[OK] IMMERSIVE PROFILE ATTACHED"),
    tr(language, "[OK] KANAL TELEMETRI SIAP", "[OK] TELEMETRY CHANNEL READY"),
    tr(language, "[OK] REVISI AKSES KAMERA SELESAI", "[OK] CAMERA ACCESS REVISION COMPLETE"),
  ];

  useEffect(() => {
    setVisibleLines(1);
    const interval = setInterval(() => {
      setVisibleLines((prev) => (prev < bootLines.length ? prev + 1 : prev));
    }, 180);
    return () => clearInterval(interval);
  }, [bootLines.length]);

  return (
    <Layout
      title="EDUFIKA"
      subtitle={tr(language, "Menyiapkan konteks sesi ujian.", "Preparing secure exam session context.")}
      topRight={<TerminalBadge label={tr(language, "BOOT SISTEM", "SYSTEM BOOT")} />}
    >
      <View style={terminalStyles.card}>
        {bootLines.slice(0, visibleLines).map((line) => (
          <Text key={line} style={styles.bootLine}>
            {"> "} {line}
          </Text>
        ))}
        {visibleLines >= bootLines.length ? <Text style={styles.cursor}>_</Text> : null}
      </View>

      <View style={terminalStyles.row}>
        <ActivityIndicator size="small" color="#22c55e" />
        <Text style={terminalStyles.subtleText}>{bootMessage.toUpperCase()}</Text>
      </View>
    </Layout>
  );
}

const styles = {
  bootLine: {
    color: "#16a34a",
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 11,
    lineHeight: 18,
    marginBottom: 3,
  },
  cursor: {
    color: "#16a34a",
    fontFamily: "JetBrainsMono-Bold",
    fontSize: 12,
    marginTop: 2,
  },
};
