import React, { useEffect, useRef } from "react";
import { Animated, Easing, Text } from "react-native";
import { AppLanguage, tr } from "../i18n";
import Layout, { TerminalBadge, TerminalButton, terminalStyles } from "./Layout";

type ViolationScreenProps = {
  language: AppLanguage;
  reason: string;
  onBackToLogin: () => void;
};

export default function ViolationScreen({ language, reason, onBackToLogin }: ViolationScreenProps) {
  const flicker = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(flicker, {
          toValue: 1,
          duration: 95,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
        Animated.timing(flicker, {
          toValue: 0,
          duration: 125,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [flicker]);

  const alertOpacity = flicker.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.84],
  });

  const alertBackground = flicker.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(255,65,65,0.08)", "rgba(255,65,65,0.18)"],
  });

  return (
    <Layout
      title={tr(language, "Sesi Terkunci", "Session Locked")}
      subtitle={tr(
        language,
        "Perilaku tidak sah terdeteksi. Perangkat ditandai untuk ditinjau proktor.",
        "Unauthorized behavior detected. Device is flagged for proctor review."
      )}
      topRight={<TerminalBadge label={tr(language, "ALARM AKTIF", "ALARM ACTIVE")} tone="warning" />}
    >
      <Animated.View
        style={[
          terminalStyles.card,
          {
            borderColor: "rgba(255,65,65,0.52)",
            backgroundColor: alertBackground,
            opacity: alertOpacity,
          },
        ]}
      >
        <Text style={[terminalStyles.heading, { color: "#FF4141" }]}>
          {tr(language, "PERINGATAN_KEAMANAN", "SECURITY_ALERT")}
        </Text>
        <Text style={terminalStyles.bodyText}>{reason}</Text>
        <Text style={terminalStyles.subtleText}>
          {tr(
            language,
            "Eskalasi alarm aktif. Log disimpan untuk verifikasi integritas.",
            "Alarm escalation enabled. Logs are retained for integrity verification."
          )}
        </Text>
      </Animated.View>
      <TerminalButton label={tr(language, "Kembali ke Login", "Return To Login")} onPress={onBackToLogin} />
    </Layout>
  );
}
