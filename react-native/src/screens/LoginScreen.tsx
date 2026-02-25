import React, { useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { AppLanguage, tr } from "../i18n";
import Keypad from "./Keypad";
import Layout, { TerminalBadge, TerminalButton, palette } from "./Layout";

type LoginScreenProps = {
  language: AppLanguage;
  token: string;
  statusMessage: string;
  onTokenChange: (value: string) => void;
  onSubmit: () => void;
  onOpenSettings: () => void;
  onExitApp: () => void;
};

export default function LoginScreen({
  language,
  token,
  statusMessage,
  onTokenChange,
  onSubmit,
  onOpenSettings,
  onExitApp,
}: LoginScreenProps) {
  const cursorOpacity = useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(cursorOpacity, { toValue: 0, duration: 450, useNativeDriver: true }),
        Animated.timing(cursorOpacity, { toValue: 1, duration: 450, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [cursorOpacity]);

  return (
    <Layout
      title={tr(language, "Access Gate", "Access Gate")}
      subtitle={tr(language, "Masukkan token sesi sementara.", "Enter your temporary session token.")}
      topRight={<TerminalBadge label={tr(language, "SESSION AUTH", "SESSION AUTH")} tone="neon" />}
      footer={
        <View style={styles.footerRow}>
          <Pressable style={styles.iconButton} onPress={onOpenSettings}>
            <Text style={styles.iconText}>{tr(language, "SET", "SET")}</Text>
          </Pressable>
          <Pressable style={styles.iconButton} onPress={onExitApp}>
            <Text style={styles.iconText}>{tr(language, "EXIT", "EXIT")}</Text>
          </Pressable>
        </View>
      }
    >
      <View style={styles.tokenShell}>
        <Text style={styles.tokenText}>{token || "____-____"}</Text>
        <Animated.View style={[styles.cursor, { opacity: cursorOpacity }]} />
      </View>
      <Text style={styles.statusText}>{statusMessage}</Text>

      <Keypad
        language={language}
        onPressDigit={(value) => onTokenChange(`${token}${value}`)}
        onBackspace={() => onTokenChange(token.slice(0, -1))}
        onClear={() => onTokenChange("")}
        currentValue={token}
        onPasteText={(value) => onTokenChange(`${token}${value}`)}
      />

      <View style={styles.buttonWrap}>
        <TerminalButton label={tr(language, "Klaim Sesi", "Claim Session")} onPress={onSubmit} />
      </View>
    </Layout>
  );
}

const styles = StyleSheet.create({
  tokenShell: {
    borderWidth: 2,
    borderColor: "rgba(34,197,94,0.22)",
    borderRadius: 22,
    minHeight: 56,
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  tokenText: {
    flex: 1,
    color: "#16a34a",
    fontFamily: "Montserrat-Bold",
    fontSize: 18,
    letterSpacing: 1.2,
  },
  cursor: {
    width: 2,
    height: 18,
    backgroundColor: "#22c55e",
    borderRadius: 1,
  },
  statusText: {
    color: palette.muted,
    fontFamily: "Montserrat-Regular",
    fontSize: 10,
    marginBottom: 8,
    minHeight: 20,
  },
  buttonWrap: {
    marginTop: 8,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  iconButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    paddingVertical: 10,
    alignItems: "center",
  },
  iconText: {
    color: "#6b7280",
    fontFamily: "Montserrat-Bold",
    fontSize: 10,
    letterSpacing: 1,
  },
});
