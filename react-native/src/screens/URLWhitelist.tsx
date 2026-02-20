import React from "react";
import { ScrollView, Text } from "react-native";
import { AppLanguage, tr } from "../i18n";
import Layout, { TerminalBadge, TerminalButton, TerminalInput, terminalStyles } from "./Layout";

type URLWhitelistProps = {
  language: AppLanguage;
  whitelistInput: string;
  onWhitelistInputChange: (value: string) => void;
  whitelist: string[];
  proctorPin: string;
  onProctorPinChange: (value: string) => void;
  onAddUrl: () => void;
  onSavePin: () => void;
  onBack: () => void;
};

export default function URLWhitelist({
  language,
  whitelistInput,
  onWhitelistInputChange,
  whitelist,
  proctorPin,
  onProctorPinChange,
  onAddUrl,
  onSavePin,
  onBack,
}: URLWhitelistProps) {
  return (
    <Layout
      title={tr(language, "Registry Whitelist", "Whitelist Registry")}
      subtitle={tr(
        language,
        "Kontrol khusus proktor untuk domain ujian yang diizinkan dan kebijakan PIN.",
        "Proctor-only controls for allowed exam domains and PIN policy."
      )}
      topRight={<TerminalBadge label={tr(language, "OTORISASI PROKTOR", "PROCTOR AUTH")} />}
      footer={<TerminalButton label={tr(language, "Kembali ke Dashboard", "Back To Dashboard")} variant="outline" onPress={onBack} />}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        <TerminalInput
          value={whitelistInput}
          onChangeText={onWhitelistInputChange}
          label={tr(language, "Tambah URL / Domain Diizinkan", "Add Allowed URL / Domain")}
          placeholder="https://exam.school.edu"
          autoCapitalize="none"
        />
        <TerminalButton label={tr(language, "Tambah URL Whitelist", "Add Whitelist URL")} onPress={onAddUrl} />

        <TerminalInput
          value={proctorPin}
          onChangeText={onProctorPinChange}
          label={tr(language, "PIN Proktor Untuk Keluar Browser", "Proctor PIN For Browser Exit")}
          placeholder={tr(language, "Masukkan PIN", "Input PIN")}
          keyboardType="number-pad"
          secureTextEntry
        />
        <TerminalButton label={tr(language, "Simpan PIN Proktor", "Save Proctor PIN")} variant="outline" onPress={onSavePin} />

        <Text style={terminalStyles.heading}>{tr(language, "Allowlist Aktif", "Active Allowlist")}</Text>
        {whitelist.map((url, index) => (
          <Text style={terminalStyles.bodyText} key={`${index}-${url}`}>
            {index + 1}. {url}
          </Text>
        ))}
      </ScrollView>
    </Layout>
  );
}
