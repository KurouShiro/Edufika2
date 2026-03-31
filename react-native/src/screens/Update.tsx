import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { AppLanguage } from "../i18n";

type UpdateScreenProps = {
  language: AppLanguage;
  title: string;
  subtitle: string;
  statusMessage: string;
  detailMessage?: string;
  progress: number;
  progressLabel: string;
  channelLabel: string;
  currentVersionLabel: string;
  targetVersionLabel?: string;
  remoteConfigVersion?: string;
  logs: string[];
  primaryActionLabel?: string;
  secondaryActionLabel?: string;
  onPrimaryAction?: () => void;
  onSecondaryAction?: () => void;
  busy?: boolean;
};

const LOGO_SOURCE = require("../../assets/images/logo.jpeg");
const MONO_FONT = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "monospace",
}) ?? "monospace";
const { width: screenWidth } = Dimensions.get("window");
const scanlineRows = Array.from({ length: 26 }, (_, index) => index);
const progressSegments = Array.from({ length: 20 }, (_, index) => index);

export default function Update({
  language: _language,
  title,
  subtitle,
  statusMessage,
  detailMessage,
  progress,
  progressLabel,
  channelLabel,
  currentVersionLabel,
  targetVersionLabel,
  remoteConfigVersion,
  logs,
  primaryActionLabel,
  secondaryActionLabel,
  onPrimaryAction,
  onSecondaryAction,
  busy = false,
}: UpdateScreenProps) {
  const shellReveal = useRef(new Animated.Value(0)).current;
  const progressValue = useRef(new Animated.Value(0)).current;
  const cursorBlink = useRef(new Animated.Value(1)).current;
  const scanTravel = useRef(new Animated.Value(0)).current;
  const pulseGlow = useRef(new Animated.Value(0.58)).current;

  useEffect(() => {
    Animated.timing(shellReveal, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    const cursorLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(cursorBlink, {
          toValue: 0.18,
          duration: 300,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(cursorBlink, {
          toValue: 1,
          duration: 260,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ])
    );

    const scanLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanTravel, {
          toValue: 1,
          duration: 2200,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(scanTravel, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.delay(120),
      ])
    );

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseGlow, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulseGlow, {
          toValue: 0.52,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    cursorLoop.start();
    scanLoop.start();
    glowLoop.start();

    return () => {
      cursorLoop.stop();
      scanLoop.stop();
      glowLoop.stop();
    };
  }, [cursorBlink, pulseGlow, scanTravel, shellReveal]);

  useEffect(() => {
    Animated.timing(progressValue, {
      toValue: Math.max(0, Math.min(1, progress)),
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress, progressValue]);

  const shellScale = shellReveal.interpolate({
    inputRange: [0, 1],
    outputRange: [0.97, 1],
  });

  const progressWidth = progressValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  const sweepTranslateY = scanTravel.interpolate({
    inputRange: [0, 1],
    outputRange: [-180, 280],
  });

  const visibleLogs = useMemo(() => logs.slice(-3), [logs]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#020604" />
      <View style={styles.root}>
        <View style={styles.glowOrbOne} pointerEvents="none" />
        <View style={styles.glowOrbTwo} pointerEvents="none" />

        <Animated.View style={[styles.shell, { opacity: shellReveal, transform: [{ scale: shellScale }] }]}>
          <View style={styles.headerRow}>
            <Text style={styles.headerLabel}>{title}</Text>
            <Animated.View style={[styles.headerDot, { opacity: pulseGlow }]} />
          </View>

          <View style={styles.viewport}>
            <Image source={LOGO_SOURCE} resizeMode="cover" style={styles.logo} />

            <Text style={styles.primaryText}>{statusMessage}</Text>
            <View style={styles.cursorRow}>
              <Text style={styles.secondaryText}>{subtitle}</Text>
              <Animated.Text style={[styles.cursor, { opacity: cursorBlink }]}>_</Animated.Text>
            </View>

            {detailMessage ? <Text style={styles.detailText}>{detailMessage}</Text> : null}

            <View style={styles.progressMeta}>
              <Text style={styles.progressMetaLabel}>SYNC</Text>
              <Text style={styles.progressMetaValue}>{progressLabel}</Text>
            </View>

            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
              <View pointerEvents="none" style={styles.progressGrid}>
                {progressSegments.map((segment) => (
                  <View key={`segment-${segment}`} style={styles.progressDivider} />
                ))}
              </View>
            </View>

            <View style={styles.metaBlock}>
              <Text style={styles.metaText}>channel://{channelLabel}</Text>
              <Text style={styles.metaText}>current://{currentVersionLabel}</Text>
              {targetVersionLabel ? <Text style={styles.metaText}>target://{targetVersionLabel}</Text> : null}
              {remoteConfigVersion ? <Text style={styles.metaText}>config://{remoteConfigVersion}</Text> : null}
            </View>

            <View style={styles.logBlock}>
              {visibleLogs.length > 0 ? (
                visibleLogs.map((line, index) => (
                  <Text key={`${line}-${index}`} style={styles.logText}>
                    {">"} {line}
                  </Text>
                ))
              ) : (
                <Text style={styles.logText}>{">"} Awaiting update response...</Text>
              )}
            </View>

            <Text style={styles.footerText}>
              {busy ? "terminal://processing" : "terminal://ready"}
            </Text>

            <View pointerEvents="none" style={styles.scanlineWrap}>
              {scanlineRows.map((row) => (
                <View
                  key={`scan-${row}`}
                  style={[
                    styles.scanline,
                    {
                      top: row * 12,
                      opacity: row % 2 === 0 ? 0.1 : 0.04,
                    },
                  ]}
                />
              ))}
            </View>
            <Animated.View
              pointerEvents="none"
              style={[styles.scanSweep, { transform: [{ translateY: sweepTranslateY }] }]}
            />
          </View>

          {(primaryActionLabel || secondaryActionLabel) ? (
            <View style={styles.actionRow}>
              {primaryActionLabel ? (
                <ActionButton
                  label={primaryActionLabel}
                  onPress={onPrimaryAction}
                  variant="solid"
                  disabled={busy}
                />
              ) : null}
              {secondaryActionLabel ? (
                <ActionButton
                  label={secondaryActionLabel}
                  onPress={onSecondaryAction}
                  variant="outline"
                  disabled={busy}
                />
              ) : null}
            </View>
          ) : null}
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

function ActionButton({
  label,
  onPress,
  variant,
  disabled,
}: {
  label: string;
  onPress?: () => void;
  variant: "solid" | "outline";
  disabled?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        variant === "solid" ? styles.actionButtonSolid : styles.actionButtonOutline,
        pressed ? styles.actionButtonPressed : null,
        disabled ? styles.actionButtonDisabled : null,
      ]}
    >
      <Text style={[styles.actionButtonText, variant === "solid" ? styles.actionButtonTextSolid : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#020604",
  },
  root: {
    flex: 1,
    backgroundColor: "#020604",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 18,
    overflow: "hidden",
  },
  glowOrbOne: {
    position: "absolute",
    width: screenWidth * 0.74,
    height: screenWidth * 0.74,
    borderRadius: 999,
    backgroundColor: "rgba(34,197,94,0.14)",
    top: -screenWidth * 0.12,
    left: -screenWidth * 0.18,
  },
  glowOrbTwo: {
    position: "absolute",
    width: screenWidth * 0.56,
    height: screenWidth * 0.56,
    borderRadius: 999,
    backgroundColor: "rgba(16,185,129,0.1)",
    bottom: -screenWidth * 0.16,
    right: -screenWidth * 0.08,
  },
  shell: {
    width: "100%",
    maxWidth: 392,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headerLabel: {
    color: "#89f7a5",
    fontFamily: MONO_FONT,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
  },
  headerDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#3eff74",
    shadowColor: "#3eff74",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 12,
  },
  viewport: {
    minHeight: 470,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(62,255,116,0.3)",
    backgroundColor: "#040b06",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
    paddingVertical: 26,
    overflow: "hidden",
    shadowColor: "#3eff74",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.24,
    shadowRadius: 20,
    elevation: 10,
  },
  logo: {
    width: 118,
    height: 118,
    borderRadius: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(62,255,116,0.28)",
  },
  primaryText: {
    color: "#dcffe6",
    fontFamily: MONO_FONT,
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 24,
    textAlign: "center",
    marginBottom: 8,
  },
  cursorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  secondaryText: {
    color: "#8ce8a2",
    fontFamily: MONO_FONT,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    maxWidth: 280,
  },
  cursor: {
    color: "#54ff83",
    fontFamily: MONO_FONT,
    fontSize: 16,
    fontWeight: "700",
    marginLeft: 4,
  },
  detailText: {
    color: "#63bf79",
    fontFamily: MONO_FONT,
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    marginBottom: 18,
    paddingHorizontal: 4,
  },
  progressMeta: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  progressMetaLabel: {
    color: "#59de79",
    fontFamily: MONO_FONT,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },
  progressMetaValue: {
    color: "#c8ffd7",
    fontFamily: MONO_FONT,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },
  progressTrack: {
    width: "100%",
    height: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(62,255,116,0.28)",
    backgroundColor: "#06110a",
    overflow: "hidden",
    marginBottom: 18,
  },
  progressFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#39ff73",
    shadowColor: "#39ff73",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  progressGrid: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
  },
  progressDivider: {
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: "rgba(4,11,6,0.5)",
  },
  metaBlock: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(62,255,116,0.16)",
    backgroundColor: "rgba(7,16,10,0.82)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  metaText: {
    color: "#73d98c",
    fontFamily: MONO_FONT,
    fontSize: 10,
    lineHeight: 16,
    textAlign: "center",
  },
  logBlock: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(62,255,116,0.14)",
    backgroundColor: "rgba(3,8,5,0.9)",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  logText: {
    color: "#8ce8a2",
    fontFamily: MONO_FONT,
    fontSize: 10,
    lineHeight: 16,
    textAlign: "center",
  },
  footerText: {
    marginTop: 16,
    color: "#59de79",
    fontFamily: MONO_FONT,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    textAlign: "center",
  },
  scanlineWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  scanline: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(130,255,166,0.28)",
  },
  scanSweep: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 90,
    backgroundColor: "rgba(72,255,124,0.08)",
  },
  actionRow: {
    marginTop: 14,
    gap: 8,
  },
  actionButton: {
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonSolid: {
    backgroundColor: "#08160c",
    borderColor: "#39ff73",
  },
  actionButtonOutline: {
    backgroundColor: "rgba(7,16,10,0.58)",
    borderColor: "rgba(62,255,116,0.22)",
  },
  actionButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    color: "#b9f8c9",
    fontFamily: MONO_FONT,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },
  actionButtonTextSolid: {
    color: "#dfffe8",
  },
});
