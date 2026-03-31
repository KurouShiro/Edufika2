import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { AppLanguage, tr } from "../i18n";

type StartProps = {
  language: AppLanguage;
  onComplete: () => void;
};

const LOGO_SOURCE = require("../../assets/images/logo.jpeg");
const MONO_FONT = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "monospace",
}) ?? "monospace";
const { width: screenWidth } = Dimensions.get("window");
const scanlineRows = Array.from({ length: 24 }, (_, index) => index);
const progressSegments = Array.from({ length: 18 }, (_, index) => index);

export default function Start({ language, onComplete }: StartProps) {
  const shellReveal = useRef(new Animated.Value(0)).current;
  const progressValue = useRef(new Animated.Value(0)).current;
  const cursorBlink = useRef(new Animated.Value(1)).current;
  const scanTravel = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(0.58)).current;
  const completedRef = useRef(false);

  const bootTitle = tr(language, "EDUFIKA RUNTIME", "EDUFIKA RUNTIME");
  const bootSubtitle = tr(
    language,
    "Menyiapkan pemeriksaan update dan boot sequence...",
    "Preparing update checks and boot sequence..."
  );
  const bootFooter = tr(language, "terminal://startup", "terminal://startup");

  useEffect(() => {
    Animated.parallel([
      Animated.timing(shellReveal, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(progressValue, {
        toValue: 1,
        duration: 2300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();

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
        Animated.delay(100),
      ])
    );

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(glowPulse, {
          toValue: 0.52,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    cursorLoop.start();
    scanLoop.start();
    glowLoop.start();

    const completeTimer = setTimeout(() => {
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete();
      }
    }, 2500);

    return () => {
      clearTimeout(completeTimer);
      cursorLoop.stop();
      scanLoop.stop();
      glowLoop.stop();
    };
  }, [cursorBlink, glowPulse, onComplete, progressValue, scanTravel, shellReveal]);

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
    outputRange: [-170, 250],
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#020604" />
      <View style={styles.root}>
        <View style={styles.glowOrbOne} pointerEvents="none" />
        <View style={styles.glowOrbTwo} pointerEvents="none" />

        <Animated.View style={[styles.shell, { opacity: shellReveal, transform: [{ scale: shellScale }] }]}>
          <View style={styles.headerRow}>
            <Text style={styles.headerLabel}>BOOT</Text>
            <Animated.View style={[styles.headerDot, { opacity: glowPulse }]} />
          </View>

          <View style={styles.viewport}>
            <Image source={LOGO_SOURCE} resizeMode="cover" style={styles.logo} />

            <Text style={styles.titleText}>{bootTitle}</Text>
            <View style={styles.subtitleRow}>
              <Text style={styles.subtitleText}>{bootSubtitle}</Text>
              <Animated.Text style={[styles.cursor, { opacity: cursorBlink }]}>_</Animated.Text>
            </View>

            <Text style={styles.footerLabel}>{bootFooter}</Text>

            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
              <View pointerEvents="none" style={styles.progressGrid}>
                {progressSegments.map((segment) => (
                  <View key={`segment-${segment}`} style={styles.progressDivider} />
                ))}
              </View>
            </View>

            <Text style={styles.progressText}>running preflight checks...</Text>

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
        </Animated.View>
      </View>
    </SafeAreaView>
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
    width: screenWidth * 0.76,
    height: screenWidth * 0.76,
    borderRadius: 999,
    backgroundColor: "rgba(34,197,94,0.14)",
    top: -screenWidth * 0.16,
    left: -screenWidth * 0.14,
  },
  glowOrbTwo: {
    position: "absolute",
    width: screenWidth * 0.58,
    height: screenWidth * 0.58,
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
    minHeight: 420,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(62,255,116,0.3)",
    backgroundColor: "#040b06",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
    paddingVertical: 30,
    overflow: "hidden",
    shadowColor: "#3eff74",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.24,
    shadowRadius: 20,
    elevation: 10,
  },
  logo: {
    width: 136,
    height: 136,
    borderRadius: 26,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: "rgba(62,255,116,0.28)",
  },
  titleText: {
    color: "#e4ffea",
    fontFamily: MONO_FONT,
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 1.2,
    textAlign: "center",
    marginBottom: 8,
  },
  subtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  subtitleText: {
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
  footerLabel: {
    color: "#59de79",
    fontFamily: MONO_FONT,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    textAlign: "center",
    marginBottom: 20,
  },
  progressTrack: {
    width: "100%",
    height: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(62,255,116,0.28)",
    backgroundColor: "#06110a",
    overflow: "hidden",
    marginBottom: 12,
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
  progressText: {
    color: "#73d98c",
    fontFamily: MONO_FONT,
    fontSize: 11,
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
});
