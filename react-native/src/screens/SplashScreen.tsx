import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { AppLanguage, tr } from "../i18n";
import Layout, { palette } from "./Layout";

type SplashScreenProps = {
  bootMessage: string;
  language: AppLanguage;
};

export default function SplashScreen({ bootMessage, language }: SplashScreenProps) {
  const [visibleLines, setVisibleLines] = useState(0);
  const pulseA = useRef(new Animated.Value(0.4)).current;
  const pulseB = useRef(new Animated.Value(0.4)).current;
  const pulseC = useRef(new Animated.Value(0.4)).current;

  const lines = [
    tr(language, "> EDUFIKA_CORE v4 initialized", "> EDUFIKA_CORE v4 initialized"),
    tr(language, "> Memeriksa integritas perangkat... [OK]", "> Checking hardware integrity... [OK]"),
    tr(language, "> Memuat lapisan GUI terminal...", "> Loading terminal GUI layer..."),
    tr(language, "> Menyambungkan Session Authority...", "> Connecting Session Authority..."),
    tr(language, "> Ready.", "> Ready."),
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setVisibleLines((prev) => (prev < lines.length ? prev + 1 : prev));
    }, 280);
    return () => clearInterval(interval);
  }, [lines.length]);

  useEffect(() => {
    const runPulse = (node: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(node, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(node, { toValue: 0.4, duration: 300, useNativeDriver: true }),
        ])
      );

    const a = runPulse(pulseA, 0);
    const b = runPulse(pulseB, 120);
    const c = runPulse(pulseC, 240);
    a.start();
    b.start();
    c.start();
    return () => {
      a.stop();
      b.stop();
      c.stop();
    };
  }, [pulseA, pulseB, pulseC]);

  return (
    <Layout title="EDUFIKA" subtitle={tr(language, "Booting secure exam runtime...", "Booting secure exam runtime...")}>
      <View style={styles.lineWrap}>
        {lines.slice(0, visibleLines).map((line) => (
          <Text key={line} style={styles.lineText}>
            {line}
          </Text>
        ))}
      </View>
      <Text style={styles.statusText}>{bootMessage}</Text>

      <View style={styles.dots}>
        <Animated.View style={[styles.dot, { opacity: pulseA }]} />
        <Animated.View style={[styles.dot, styles.dotMid, { opacity: pulseB }]} />
        <Animated.View style={[styles.dot, styles.dotStrong, { opacity: pulseC }]} />
      </View>
      <Text style={styles.footer}>TECHIVIBES</Text>
    </Layout>
  );
}

const styles = StyleSheet.create({
  lineWrap: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 20,
    padding: 12,
    marginBottom: 10,
    backgroundColor: "#ffffff",
    minHeight: 140,
    justifyContent: "center",
  },
  lineText: {
    color: "#22c55e",
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 11,
    lineHeight: 18,
    marginBottom: 2,
  },
  statusText: {
    color: palette.muted,
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 10,
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: 6,
    marginBottom: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#bbf7d0",
  },
  dotMid: {
    backgroundColor: "#86efac",
  },
  dotStrong: {
    backgroundColor: "#4ade80",
  },
  footer: {
    textAlign: "center",
    color: "rgba(156,163,175,0.6)",
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 8,
    letterSpacing: 1.5,
    marginTop: 2,
  },
});
