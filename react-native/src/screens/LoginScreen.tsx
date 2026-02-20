import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppLanguage, tr } from "../i18n";
import Keypad from "./Keypad";
import Layout, { TerminalBadge, TerminalButton, terminalStyles } from "./Layout";

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
  const [maskInput, setMaskInput] = useState(false);

  return (
    <Layout
      title={tr(language, "Access Gate", "Access Gate")}
      subtitle={tr(
        language,
        "Masukkan token sesi sementara untuk memulai.",
        "Enter your temporary session token to continue."
      )}
      topRight={<TerminalBadge label={tr(language, "SESSION AUTH", "SESSION AUTH")} tone="neon" />}
      footer={
        <View style={terminalStyles.splitRow}>
          <View style={terminalStyles.splitCol}>
            <TerminalButton
              label={tr(language, "Buka Pengaturan", "Open Settings")}
              variant="outline"
              onPress={onOpenSettings}
            />
          </View>
          <View style={terminalStyles.splitCol}>
            <TerminalButton label={tr(language, "Keluar Aplikasi", "Exit App")} variant="outline" onPress={onExitApp} />
          </View>
        </View>
      }
    >
      <View style={styles.tokenPanel}>
        <Text style={[terminalStyles.subtleText, styles.tokenLabel]}>MASTER_ID</Text>
        <View style={styles.tokenDisplay}>
          <Text style={styles.tokenText}>
            {token ? (maskInput ? "*".repeat(token.length) : token) : tr(language, "____-____", "____-____")}
          </Text>
          <View style={styles.cursor} />
        </View>
      </View>

      <Pressable
        onPress={() => setMaskInput((value) => !value)}
        style={({ pressed }) => [terminalStyles.card, styles.maskToggle, pressed ? styles.togglePressed : null]}
      >
        <Text style={terminalStyles.subtleText}>
          {maskInput
            ? tr(language, "TAMPILKAN INPUT TOKEN", "SHOW TOKEN INPUT")
            : tr(language, "SEMBUNYIKAN INPUT TOKEN", "HIDE TOKEN INPUT")}
        </Text>
      </Pressable>

      <Keypad
        language={language}
        onPressDigit={(value) => onTokenChange(`${token}${value}`)}
        onBackspace={() => onTokenChange(token.slice(0, -1))}
        onClear={() => onTokenChange("")}
      />

      <View style={terminalStyles.divider} />
      <TerminalButton label={tr(language, "Klaim Sesi", "Claim Session")} onPress={onSubmit} />
      <Text style={terminalStyles.subtleText}>{statusMessage}</Text>
    </Layout>
  );
}

const styles = StyleSheet.create({
  tokenPanel: {
    borderWidth: 1,
    borderColor: "rgba(229,231,235,1)",
    backgroundColor: "#ffffff",
    padding: 10,
    marginBottom: 10,
    borderRadius: 18,
  },
  tokenLabel: {
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  tokenDisplay: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: "rgba(229,231,235,1)",
    borderRadius: 14,
    backgroundColor: "#f9fafb",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tokenText: {
    flex: 1,
    color: "#16a34a",
    fontFamily: "JetBrainsMono-Bold",
    fontSize: 16,
    letterSpacing: 1.1,
  },
  cursor: {
    width: 3,
    height: 22,
    borderRadius: 2,
    backgroundColor: "#22c55e",
  },
  maskToggle: {
    paddingVertical: 8,
    marginBottom: 2,
    borderRadius: 14,
  },
  togglePressed: {
    opacity: 0.8,
  },
});
