import React from "react";
import { Switch, Text, View } from "react-native";
import { AppLanguage, tr } from "../i18n";
import Layout, {
  TerminalBadge,
  TerminalButton,
  TerminalInput,
  palette,
  terminalStyles,
} from "./Layout";

type DeveloperAccessScreenProps = {
  language: AppLanguage;
  password: string;
  onPasswordChange: (value: string) => void;
  unlocked: boolean;
  kioskEnabled: boolean;
  onUnlock: () => void;
  onToggleKiosk: (value: boolean) => void;
  browserUrl: string;
  onBrowserUrlChange: (value: string) => void;
  adminToken: string;
  adminTokenExpiryAt: string;
  adminTokenExpiryMinutes: string;
  onAdminTokenExpiryMinutesChange: (value: string) => void;
  onGenerateAdminToken: () => void;
  onCopyAdminToken: () => void;
  onOpenBrowserMode: () => void;
  onBack: () => void;
};

export default function DeveloperAccessScreen({
  language,
  password,
  onPasswordChange,
  unlocked,
  kioskEnabled,
  onUnlock,
  onToggleKiosk,
  browserUrl,
  onBrowserUrlChange,
  adminToken,
  adminTokenExpiryAt,
  adminTokenExpiryMinutes,
  onAdminTokenExpiryMinutesChange,
  onGenerateAdminToken,
  onCopyAdminToken,
  onOpenBrowserMode,
  onBack,
}: DeveloperAccessScreenProps) {
  return (
    <Layout
      title={tr(language, "Akses Inti Dev", "Dev Core Access")}
      subtitle={tr(
        language,
        "Panel terbatas untuk kontrol debug dan mode bypass browser.",
        "Restricted panel for debug controls and browser bypass mode."
      )}
      topRight={
        <TerminalBadge
          label={unlocked ? tr(language, "TERBUKA", "UNLOCKED") : tr(language, "TERKUNCI", "LOCKED")}
          tone={unlocked ? "neon" : "warning"}
        />
      }
    >
      <TerminalInput
        value={password}
        onChangeText={onPasswordChange}
        label={tr(language, "Password Developer", "Developer Password")}
        placeholder="EDU_DEV_ACCESS"
        secureTextEntry
      />
      <TerminalButton label={tr(language, "Buka Panel Developer", "Unlock Developer Panel")} onPress={onUnlock} />

      <View style={terminalStyles.card}>
        <Text style={terminalStyles.subtleText}>{tr(language, "Penegakan Kiosk", "Kiosk Enforcement")}</Text>
        <View style={terminalStyles.row}>
          <Text style={terminalStyles.bodyText}>
            {kioskEnabled
              ? tr(language, "LOCK IMMERSIVE AKTIF", "IMMERSIVE LOCK ACTIVE")
              : tr(language, "LOCK DINONAKTIFKAN", "LOCK DISABLED")}
          </Text>
          <Switch
            value={kioskEnabled}
            onValueChange={onToggleKiosk}
            disabled={!unlocked}
            trackColor={{ false: "#364036", true: palette.neonSoft }}
            thumbColor={kioskEnabled ? palette.neon : "#9BAA9B"}
          />
        </View>
      </View>

      <TerminalInput
        value={browserUrl}
        onChangeText={onBrowserUrlChange}
        label={tr(language, "URL Browser Bypass", "Bypass Browser URL")}
        placeholder="https://example.org"
        autoCapitalize="none"
        editable={unlocked}
      />

      <TerminalButton
        label={tr(language, "Buka Mode Browser (Bypass)", "Open Browser Mode (Bypass)")}
        variant="outline"
        disabled={!unlocked}
        onPress={onOpenBrowserMode}
      />

      <View style={terminalStyles.card}>
        <Text style={terminalStyles.subtleText}>
          {tr(language, "GENERASI TOKEN ADMIN", "ADMIN TOKEN MINTING")}
        </Text>
        <TerminalInput
          value={adminTokenExpiryMinutes}
          onChangeText={onAdminTokenExpiryMinutesChange}
          label={tr(language, "Expiry Token Admin (Menit)", "Admin Token Expiry (Minutes)")}
          placeholder="120"
          keyboardType="number-pad"
          editable={unlocked}
        />
        <TerminalButton
          label={tr(language, "Generate Admin Token", "Generate Admin Token")}
          variant="outline"
          disabled={!unlocked}
          onPress={onGenerateAdminToken}
        />
        <TerminalButton
          label={tr(language, "Copy Admin Token", "Copy Admin Token")}
          variant="outline"
          disabled={!unlocked || !adminToken}
          onPress={onCopyAdminToken}
        />
        <Text style={terminalStyles.bodyText}>
          {tr(language, "Admin Token Terbaru:", "Latest Admin Token:")}{" "}
          {adminToken || tr(language, "Belum ada token admin.", "No admin token generated yet.")}
        </Text>
        <Text style={terminalStyles.subtleText}>
          {tr(language, "Kadaluarsa:", "Expires at:")}{" "}
          {adminTokenExpiryAt || tr(language, "Belum ditetapkan.", "Not set yet.")}
        </Text>
      </View>

      <TerminalButton label={tr(language, "Kembali", "Back")} variant="outline" onPress={onBack} />
    </Layout>
  );
}
