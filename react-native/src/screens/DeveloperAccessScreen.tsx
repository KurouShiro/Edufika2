import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { AppLanguage, tr } from "../i18n";
import Layout, { TerminalBadge, TerminalButton, TerminalInput, palette, useTerminalStyles } from "./Layout";

type DeveloperAccessScreenProps = {
  language: AppLanguage;
  backendBaseUrl: string;
  onBackendBaseUrlChange: (value: string) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  unlocked: boolean;
  kioskEnabled: boolean;
  violationSystemEnabled: boolean;
  splitScreenDetectionEnabled: boolean;
  onUnlock: () => void;
  onToggleKiosk: (value: boolean) => void;
  onToggleViolationSystem: (value: boolean) => void;
  onToggleSplitScreenDetection: (value: boolean) => void;
  browserUrl: string;
  onBrowserUrlChange: (value: string) => void;
  developerClaimTokenInput: string;
  onDeveloperClaimTokenInputChange: (value: string) => void;
  onDeveloperClaimToken: () => void;
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
  backendBaseUrl,
  onBackendBaseUrlChange,
  password,
  onPasswordChange,
  unlocked,
  kioskEnabled,
  violationSystemEnabled,
  splitScreenDetectionEnabled,
  onUnlock,
  onToggleKiosk,
  onToggleViolationSystem,
  onToggleSplitScreenDetection,
  browserUrl,
  onBrowserUrlChange,
  developerClaimTokenInput,
  onDeveloperClaimTokenInputChange,
  onDeveloperClaimToken,
  adminToken,
  adminTokenExpiryAt,
  adminTokenExpiryMinutes,
  onAdminTokenExpiryMinutesChange,
  onGenerateAdminToken,
  onCopyAdminToken,
  onOpenBrowserMode,
  onBack,
}: DeveloperAccessScreenProps) {
  const terminalStyles = useTerminalStyles();
  const [backendCheckState, setBackendCheckState] = useState<"idle" | "checking" | "ok" | "error">("idle");
  const [backendCheckMessage, setBackendCheckMessage] = useState("");

  const backendStatusColor = useMemo(() => {
    if (backendCheckState === "ok") {
      return styles.backendStatusOk;
    }
    if (backendCheckState === "error") {
      return styles.backendStatusError;
    }
    return styles.backendStatusIdle;
  }, [backendCheckState]);

  const normalizeBackendUrl = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) {
      return "";
    }
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return trimmed;
    }
    return `http://${trimmed}`;
  };

  const checkBackendConnection = async () => {
    const normalized = normalizeBackendUrl(backendBaseUrl);
    if (!normalized) {
      setBackendCheckState("error");
      setBackendCheckMessage(tr(language, "Isi URL backend terlebih dahulu.", "Enter backend URL first."));
      return;
    }

    setBackendCheckState("checking");
    setBackendCheckMessage(tr(language, "Mengecek koneksi backend...", "Checking backend connection..."));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);

    try {
      const response = await fetch(`${normalized}/health`, {
        method: "GET",
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        setBackendCheckState("error");
        setBackendCheckMessage(`HTTP ${response.status} ${response.statusText}`);
        return;
      }

      const payload = await response.json().catch(() => ({} as Record<string, unknown>));
      const looksLikeEdufikaApi =
        payload &&
        payload.ok === true &&
        payload.service === "edufika-session-api";
      if (!looksLikeEdufikaApi) {
        setBackendCheckState("error");
        setBackendCheckMessage(
          tr(
            language,
            "Endpoint aktif, tapi bukan Edufika Session API (/health tidak cocok).",
            "Endpoint is reachable, but it is not Edufika Session API (/health payload mismatch)."
          )
        );
        return;
      }

      setBackendCheckState("ok");
      setBackendCheckMessage(tr(language, "Backend terhubung.", "Backend reachable."));
    } catch (error) {
      clearTimeout(timeout);
      setBackendCheckState("error");
      const message =
        error instanceof Error
          ? error.message
          : tr(language, "Backend tidak terjangkau.", "Backend unreachable.");
      setBackendCheckMessage(message);
    }
  };

  return (
    <Layout
      title={tr(language, "DEV_ACCESS_PANEL", "DEV_ACCESS_PANEL")}
      subtitle={tr(language, "Konfigurasi mode developer dan minting admin token.", "Developer mode configuration and admin token minting.")}
      topRight={<TerminalBadge label={unlocked ? tr(language, "UNLOCKED", "UNLOCKED") : tr(language, "LOCKED", "LOCKED")} tone={unlocked ? "neon" : "warning"} />}
    >
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <TerminalInput
          value={password}
          onChangeText={onPasswordChange}
          label={tr(language, "Developer Password", "Developer Password")}
          placeholder="EDU_DEV_ACCESS"
          secureTextEntry
        />
        <TerminalButton label={tr(language, "Unlock Panel", "Unlock Panel")} onPress={onUnlock} />

        <View style={terminalStyles.card}>
          <Text style={terminalStyles.subtleText}>{tr(language, "Backend Connection", "Backend Connection")}</Text>
          <TerminalInput
            value={backendBaseUrl}
            onChangeText={onBackendBaseUrlChange}
            label={tr(language, "Backend Base URL", "Backend Base URL")}
            placeholder="http://192.168.x.x:8091"
            autoCapitalize="none"
            editable={unlocked}
          />
          <TerminalButton
            label={
              backendCheckState === "checking"
                ? tr(language, "Checking...", "Checking...")
                : tr(language, "Test Backend Connection", "Test Backend Connection")
            }
            variant="outline"
            disabled={!unlocked || backendCheckState === "checking"}
            onPress={checkBackendConnection}
          />
          <Text style={[terminalStyles.subtleText, backendStatusColor]}>{backendCheckMessage || tr(language, "Belum dicek.", "Not checked yet.")}</Text>
        </View>

        <View style={terminalStyles.card}>
          <Text style={terminalStyles.subtleText}>{tr(language, "Security Enforcement", "Security Enforcement")}</Text>
          <View style={terminalStyles.row}>
            <Text style={terminalStyles.bodyText}>
              {kioskEnabled ? tr(language, "Kiosk Mode Aktif", "Kiosk Mode Active") : tr(language, "Kiosk Mode Nonaktif", "Kiosk Mode Disabled")}
            </Text>
            <Switch
              value={kioskEnabled}
              onValueChange={onToggleKiosk}
              disabled={!unlocked}
              trackColor={{ false: "#d1d5db", true: "rgba(34,197,94,0.35)" }}
              thumbColor={kioskEnabled ? palette.neon : "#94a3b8"}
            />
          </View>
          <View style={terminalStyles.row}>
            <Text style={terminalStyles.bodyText}>
              {violationSystemEnabled
                ? tr(language, "Violation System Aktif", "Violation System Active")
                : tr(language, "Violation System Nonaktif", "Violation System Disabled")}
            </Text>
            <Switch
              value={violationSystemEnabled}
              onValueChange={onToggleViolationSystem}
              disabled={!unlocked}
              trackColor={{ false: "#d1d5db", true: "rgba(34,197,94,0.35)" }}
              thumbColor={violationSystemEnabled ? palette.neon : "#94a3b8"}
            />
          </View>
          <View style={terminalStyles.row}>
            <Text style={terminalStyles.bodyText}>
              {splitScreenDetectionEnabled
                ? tr(language, "Split-screen Detection Aktif", "Split-screen Detection Active")
                : tr(language, "Split-screen Detection Nonaktif", "Split-screen Detection Disabled")}
            </Text>
            <Switch
              value={splitScreenDetectionEnabled}
              onValueChange={onToggleSplitScreenDetection}
              disabled={!unlocked}
              trackColor={{ false: "#d1d5db", true: "rgba(34,197,94,0.35)" }}
              thumbColor={splitScreenDetectionEnabled ? palette.neon : "#94a3b8"}
            />
          </View>
        </View>

        <TerminalInput
          value={browserUrl}
          onChangeText={onBrowserUrlChange}
          label={tr(language, "Bypass Browser URL", "Bypass Browser URL")}
          placeholder="https://example.org"
          autoCapitalize="none"
          editable={unlocked}
        />
        <TerminalButton
          label={tr(language, "Open Browser Mode", "Open Browser Mode")}
          variant="outline"
          disabled={!unlocked}
          onPress={onOpenBrowserMode}
        />

        <View style={terminalStyles.card}>
          <Text style={terminalStyles.subtleText}>{tr(language, "Developer Token Claim", "Developer Token Claim")}</Text>
          <TerminalInput
            value={developerClaimTokenInput}
            onChangeText={onDeveloperClaimTokenInputChange}
            label={tr(language, "Token To Claim", "Token To Claim")}
            placeholder="S-XXXXXXXX / A-XXXXXXXX"
            autoCapitalize="characters"
            editable={unlocked}
          />
          <TerminalButton
            label={tr(language, "Claim Token (Developer)", "Claim Token (Developer)")}
            variant="outline"
            disabled={!unlocked}
            onPress={onDeveloperClaimToken}
          />
        </View>

        <View style={terminalStyles.card}>
          <Text style={terminalStyles.subtleText}>{tr(language, "Identity Minting", "Identity Minting")}</Text>
          <TerminalInput
            value={adminTokenExpiryMinutes}
            onChangeText={onAdminTokenExpiryMinutesChange}
            label={tr(language, "Admin Token TTL (Minutes)", "Admin Token TTL (Minutes)")}
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
          <Text style={terminalStyles.bodyText}>{tr(language, "Token:", "Token:")} {adminToken || "-"}</Text>
          <Text style={terminalStyles.subtleText}>{tr(language, "Kadaluarsa:", "Expires:")} {adminTokenExpiryAt || "-"}</Text>
        </View>

        <TerminalButton label={tr(language, "Back", "Back")} variant="outline" onPress={onBack} />
      </ScrollView>
    </Layout>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 14,
  },
  backendStatusIdle: {
    color: "#9ca3af",
  },
  backendStatusOk: {
    color: "#16a34a",
  },
  backendStatusError: {
    color: "#ef4444",
  },
});
