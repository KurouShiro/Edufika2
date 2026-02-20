import React from "react";
import { ScrollView, Text, View } from "react-native";
import { AppLanguage, tr } from "../i18n";
import Layout, { TerminalBadge, TerminalButton, TerminalInput, terminalStyles } from "./Layout";

type AdminDashboardPanelProps = {
  language: AppLanguage;
  generatedToken: string;
  generatedTokenExpiryAt: string;
  tokenExpiryMinutes: string;
  proctorPin: string;
  proctorPinStatus: string;
  logs: string[];
  onTokenExpiryMinutesChange: (value: string) => void;
  onProctorPinChange: (value: string) => void;
  onSaveProctorPin: () => void;
  onGenerateToken: () => void;
  onCopyGeneratedToken: () => void;
  onOpenWhitelist: () => void;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
};

export default function AdminDashboardPanel({
  language,
  generatedToken,
  generatedTokenExpiryAt,
  tokenExpiryMinutes,
  proctorPin,
  proctorPinStatus,
  logs,
  onTokenExpiryMinutesChange,
  onProctorPinChange,
  onSaveProctorPin,
  onGenerateToken,
  onCopyGeneratedToken,
  onOpenWhitelist,
  onOpenHistory,
  onOpenSettings,
  onLogout,
}: AdminDashboardPanelProps) {
  return (
    <Layout
      title={tr(language, "Kontrol Proktor", "Proctor Ctrl")}
      subtitle={tr(
        language,
        "Buat token, pantau telemetri, dan atur tata kelola ujian.",
        "Generate tokens, monitor telemetry, and configure exam governance."
      )}
      topRight={<TerminalBadge label={tr(language, "ADMIN ONLINE", "ADMIN ONLINE")} />}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 14 }}>
        <View style={terminalStyles.card}>
          <Text style={terminalStyles.subtleText}>{tr(language, "GENERASI TOKEN", "TOKEN MINTING")}</Text>
          <TerminalInput
            value={tokenExpiryMinutes}
            onChangeText={onTokenExpiryMinutesChange}
            label={tr(language, "Expiry Token (Menit)", "Token Expiry (Minutes)")}
            placeholder="120"
            keyboardType="number-pad"
          />
          <TerminalButton label={tr(language, "Buat Token Siswa", "Generate Student Token")} onPress={onGenerateToken} />
          <TerminalButton
            label={tr(language, "Copy Token", "Copy Token")}
            variant="outline"
            disabled={!generatedToken}
            onPress={onCopyGeneratedToken}
          />
          <Text style={terminalStyles.bodyText}>
            {tr(language, "Token Terbaru:", "Latest Token:")}{" "}
            {generatedToken || tr(language, "Belum ada token di sesi ini.", "No token generated in this session.")}
          </Text>
          <Text style={terminalStyles.subtleText}>
            {tr(language, "Kadaluarsa:", "Expires at:")}{" "}
            {generatedTokenExpiryAt || tr(language, "Belum ditetapkan.", "Not set yet.")}
          </Text>
        </View>

        <View style={terminalStyles.card}>
          <Text style={terminalStyles.subtleText}>
            {tr(language, "KEBIJAKAN PIN PROKTOR", "PROCTOR PIN POLICY")}
          </Text>
          <TerminalInput
            value={proctorPin}
            onChangeText={onProctorPinChange}
            label={tr(language, "PIN Proktor (Refresh Harian)", "Proctor PIN (Daily Refresh)")}
            placeholder="4321"
            keyboardType="number-pad"
            secureTextEntry
          />
          <TerminalButton
            label={tr(language, "Simpan PIN ke Database", "Save PIN to Database")}
            variant="outline"
            onPress={onSaveProctorPin}
          />
          <Text style={terminalStyles.subtleText}>{proctorPinStatus}</Text>
        </View>

        <View style={terminalStyles.splitRow}>
          <View style={terminalStyles.splitCol}>
            <TerminalButton label={tr(language, "Whitelist", "Whitelist")} variant="outline" onPress={onOpenWhitelist} />
          </View>
          <View style={terminalStyles.splitCol}>
            <TerminalButton label={tr(language, "Riwayat", "History")} variant="outline" onPress={onOpenHistory} />
          </View>
        </View>

        <View style={terminalStyles.splitRow}>
          <View style={terminalStyles.splitCol}>
            <TerminalButton label={tr(language, "Pengaturan", "Settings")} variant="outline" onPress={onOpenSettings} />
          </View>
        </View>

        <Text style={terminalStyles.heading}>{tr(language, "Stream Telemetri", "Telemetry Stream")}</Text>
        {logs.length === 0 ? (
          <Text style={terminalStyles.subtleText}>{tr(language, "Belum ada log tercatat.", "No logs recorded yet.")}</Text>
        ) : (
          logs.map((entry, idx) => (
            <View style={terminalStyles.card} key={`${idx}-${entry}`}>
              <Text style={terminalStyles.bodyText}>{entry}</Text>
            </View>
          ))
        )}
        <TerminalButton label={tr(language, "Logout Admin", "Logout Admin")} variant="outline" onPress={onLogout} />
      </ScrollView>
    </Layout>
  );
}
