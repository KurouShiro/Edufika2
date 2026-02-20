import React from "react";
import { Text, View } from "react-native";
import { AppLanguage, tr } from "../i18n";
import Layout, { TerminalBadge, TerminalButton, terminalStyles } from "./Layout";

type ManualInputFailProps = {
  language: AppLanguage;
  invalidUrl: string;
  onTryAgain: () => void;
  onBackToSelection: () => void;
};

export default function ManualInputFail({
  language,
  invalidUrl,
  onTryAgain,
  onBackToSelection,
}: ManualInputFailProps) {
  return (
    <Layout
      title={tr(language, "Akses Ditolak", "Access Denied")}
      subtitle={tr(language, "URL tidak lolos validasi kebijakan whitelist.", "Input URL failed whitelist policy validation.")}
    >
      <TerminalBadge label={tr(language, "Registry Diblokir", "Registry Blocked")} tone="warning" />
      <View style={terminalStyles.card}>
        <Text style={terminalStyles.subtleText}>{tr(language, "Payload URL yang diblokir:", "Blocked URL payload:")}</Text>
        <Text style={[terminalStyles.bodyText, { color: "#FF4141" }]}>
          {invalidUrl || tr(language, "(payload kosong)", "(empty payload)")}
        </Text>
      </View>
      <TerminalButton label={tr(language, "Ulangi Input Manual", "Retry Manual Input")} onPress={onTryAgain} />
      <TerminalButton label={tr(language, "Kembali ke Pemilihan", "Back To Selection")} variant="outline" onPress={onBackToSelection} />
    </Layout>
  );
}
