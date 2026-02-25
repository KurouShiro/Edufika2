import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { AppLanguage, tr } from "../i18n";
import Layout, { TerminalButton, palette } from "./Layout";

type ViolationScreenProps = {
  language: AppLanguage;
  reason: string;
  onBackToLogin: () => void;
};

export default function ViolationScreen({ language, reason, onBackToLogin }: ViolationScreenProps) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 500, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Layout
      title={tr(language, "Security Breach", "Security Breach")}
      subtitle={tr(
        language,
        "Perangkat ditandai dan sesi dikunci oleh sistem integritas.",
        "Device has been flagged and session is locked by integrity engine."
      )}
    >
      <Animated.View style={[styles.alertIcon, { transform: [{ scale: pulse }] }]}>
        <Text style={styles.alertIconText}>!</Text>
      </Animated.View>

      <View style={styles.logCard}>
        <Text style={styles.logTitle}>{tr(language, "AUTOMATED LOG", "AUTOMATED LOG")}</Text>
        <Text style={styles.logLine}>{`> REASON: ${reason}`}</Text>
        <Text style={styles.logLine}>{`> STATUS: LOCKDOWN ACTIVE`}</Text>
        <Text style={styles.logLine}>{`> TELEMETRY: FORWARDED TO PROCTOR API`}</Text>
      </View>

      <Text style={styles.helpText}>
        {tr(
          language,
          "Hubungi proktor untuk membuka kembali sesi ujian.",
          "Please contact your proctor to unlock the exam session."
        )}
      </Text>
      <TerminalButton label={tr(language, "Kembali ke Login", "Return to Login")} onPress={onBackToLogin} />
    </Layout>
  );
}

const styles = StyleSheet.create({
  alertIcon: {
    width: 88,
    height: 88,
    borderRadius: 999,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(239,68,68,0.18)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.4)",
    marginVertical: 10,
  },
  alertIconText: {
    color: palette.warning,
    fontFamily: "Montserrat-Bold",
    fontSize: 40,
    marginTop: -2,
  },
  logCard: {
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.25)",
    borderRadius: 20,
    padding: 12,
    backgroundColor: "rgba(239,68,68,0.08)",
    marginBottom: 10,
  },
  logTitle: {
    color: palette.warning,
    fontFamily: "Montserrat-Bold",
    fontSize: 10,
    letterSpacing: 0.9,
    marginBottom: 6,
  },
  logLine: {
    color: "#ef4444",
    fontFamily: "Montserrat-Regular",
    fontSize: 10,
    lineHeight: 16,
  },
  helpText: {
    color: "#6b7280",
    fontFamily: "Montserrat-Regular",
    fontSize: 10,
    marginBottom: 10,
    lineHeight: 16,
  },
});
