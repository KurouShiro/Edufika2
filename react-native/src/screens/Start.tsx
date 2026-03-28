import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Image,
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
const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
const logoFrameSize = Math.min(screenWidth * 0.56, 290);
const crtHeight = Math.min(screenHeight * 0.56, 430);
const TILES_PER_ROW = 8;
const TILES_PER_COL = 8;
const tileSize = logoFrameSize / TILES_PER_ROW;
const scanlineRows = Array.from({ length: 24 }, (_, index) => index);
const tileMap = Array.from({ length: TILES_PER_ROW * TILES_PER_COL }, (_, index) => {
  const row = Math.floor(index / TILES_PER_ROW);
  const col = index % TILES_PER_ROW;
  const centerX = col - (TILES_PER_ROW - 1) / 2;
  const centerY = row - (TILES_PER_COL - 1) / 2;
  const distance = Math.sqrt(centerX * centerX + centerY * centerY);

  return {
    key: `${row}-${col}`,
    row,
    col,
    delay: 1050 + distance * 120 + ((row + col) % 3) * 55,
    driftX: centerX * 10 + (row % 2 === 0 ? 9 : -9),
    driftY: centerY * 12 + (col % 2 === 0 ? -8 : 8),
  };
});

export default function Start({ language, onComplete }: StartProps) {
  const shellReveal = useRef(new Animated.Value(0)).current;
  const crtBoot = useRef(new Animated.Value(0)).current;
  const logoFocus = useRef(new Animated.Value(0)).current;
  const captionOpacity = useRef(new Animated.Value(0)).current;
  const fadeToBlack = useRef(new Animated.Value(0)).current;
  const scanTravel = useRef(new Animated.Value(0)).current;
  const flicker = useRef(new Animated.Value(0.22)).current;
  const framePulse = useRef(new Animated.Value(0.4)).current;
  const completedRef = useRef(false);
  const tileProgress = useRef(tileMap.map(() => new Animated.Value(0))).current;

  const bootTitle = tr(language, "EDUFIKA RUNTIME", "EDUFIKA RUNTIME");
  const bootSubtitle = tr(
    language,
    "Menghidupkan antarmuka ujian aman...",
    "Bringing the secure exam interface online..."
  );
  const bootFooter = tr(language, "PHOSPHOR MATRIX ONLINE", "PHOSPHOR MATRIX ONLINE");

  useEffect(() => {
    const frameLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(framePulse, {
          toValue: 1,
          duration: 1300,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(framePulse, {
          toValue: 0.4,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    const flickerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(flicker, {
          toValue: 0.08,
          duration: 95,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(flicker, {
          toValue: 0.2,
          duration: 110,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(flicker, {
          toValue: 0.12,
          duration: 140,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(260),
      ])
    );

    const scanLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanTravel, {
          toValue: 1,
          duration: 2400,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(scanTravel, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.delay(180),
      ])
    );

    frameLoop.start();
    flickerLoop.start();
    scanLoop.start();

    const tileSequence = Animated.parallel(
      tileProgress.map((value, index) =>
        Animated.sequence([
          Animated.delay(tileMap[index].delay),
          Animated.timing(value, {
            toValue: 1,
            duration: 920,
            easing: Easing.out(Easing.exp),
            useNativeDriver: true,
          }),
        ])
      ),
      { stopTogether: false }
    );

    const mainSequence = Animated.sequence([
      Animated.parallel([
        Animated.timing(shellReveal, {
          toValue: 1,
          duration: 900,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(crtBoot, {
            toValue: 0.24,
            duration: 240,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(crtBoot, {
            toValue: 1,
            duration: 760,
            easing: Easing.out(Easing.exp),
            useNativeDriver: true,
          }),
        ]),
      ]),
      Animated.parallel([
        tileSequence,
        Animated.sequence([
          Animated.delay(1200),
          Animated.timing(logoFocus, {
            toValue: 1,
            duration: 3000,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.delay(5400),
          Animated.timing(captionOpacity, {
            toValue: 1,
            duration: 850,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]);

    mainSequence.start();

    const fadeTimer = setTimeout(() => {
      Animated.timing(fadeToBlack, {
        toValue: 1,
        duration: 1250,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && !completedRef.current) {
          completedRef.current = true;
          onComplete();
        }
      });
    }, 8750);

    return () => {
      clearTimeout(fadeTimer);
      frameLoop.stop();
      flickerLoop.stop();
      scanLoop.stop();
      mainSequence.stop();
    };
  }, [captionOpacity, crtBoot, fadeToBlack, flicker, framePulse, logoFocus, onComplete, scanTravel, shellReveal, tileProgress]);

  const shellScale = shellReveal.interpolate({
    inputRange: [0, 1],
    outputRange: [0.965, 1],
  });

  const crtScaleY = crtBoot.interpolate({
    inputRange: [0, 0.2, 1],
    outputRange: [0.03, 0.06, 1],
  });

  const crtScaleX = crtBoot.interpolate({
    inputRange: [0, 0.2, 1],
    outputRange: [0.16, 1.08, 1],
  });

  const crtOpacity = crtBoot.interpolate({
    inputRange: [0, 0.15, 1],
    outputRange: [0, 0.85, 1],
  });

  const clearLogoOpacity = logoFocus.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0, 0.28, 1],
  });

  const clearLogoScale = logoFocus.interpolate({
    inputRange: [0, 1],
    outputRange: [1.18, 1],
  });

  const sweepTranslateY = scanTravel.interpolate({
    inputRange: [0, 1],
    outputRange: [-crtHeight * 0.4, crtHeight * 0.5],
  });

  const frameGlow = framePulse.interpolate({
    inputRange: [0.4, 1],
    outputRange: [0.5, 0.95],
  });

  const tileNodes = useMemo(
    () =>
      tileMap.map((tile, index) => {
        const progress = tileProgress[index];
        return (
          <Animated.View
            key={tile.key}
            style={[
              styles.pixelTile,
              {
                left: tile.col * tileSize,
                top: tile.row * tileSize,
                width: tileSize,
                height: tileSize,
                opacity: progress.interpolate({
                  inputRange: [0, 0.65, 1],
                  outputRange: [0, 0.98, 0.14],
                }),
                transform: [
                  {
                    translateX: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [tile.driftX, 0],
                    }),
                  },
                  {
                    translateY: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [tile.driftY, 0],
                    }),
                  },
                  {
                    scale: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1.42, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <Image
              source={LOGO_SOURCE}
              resizeMode="cover"
              style={[
                styles.pixelTileImage,
                {
                  width: logoFrameSize,
                  height: logoFrameSize,
                  transform: [{ translateX: -tile.col * tileSize }, { translateY: -tile.row * tileSize }],
                },
              ]}
            />
          </Animated.View>
        );
      }),
    [tileProgress]
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <View style={styles.root}>
        <View style={styles.auraOne} pointerEvents="none" />
        <View style={styles.auraTwo} pointerEvents="none" />
        <Animated.View style={[styles.shell, { opacity: shellReveal, transform: [{ scale: shellScale }] }]}>
          <View style={styles.shellHeader}>
            <Text style={styles.shellLabel}>{bootTitle}</Text>
            <Animated.View style={[styles.shellIndicator, { opacity: frameGlow }]} />
          </View>

          <View style={styles.crtFrame}>
            <Animated.View
              style={[
                styles.crtViewport,
                {
                  opacity: crtOpacity,
                  transform: [{ scaleX: crtScaleX }, { scaleY: crtScaleY }],
                },
              ]}
            >
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.crtFlash,
                  {
                    opacity: crtBoot.interpolate({
                      inputRange: [0, 0.18, 0.65, 1],
                      outputRange: [0.92, 0.48, 0.08, 0],
                    }),
                  },
                ]}
              />

              <Animated.Image
                source={LOGO_SOURCE}
                resizeMode="cover"
                style={[
                  styles.logoImage,
                  {
                    width: logoFrameSize,
                    height: logoFrameSize,
                    opacity: clearLogoOpacity,
                    transform: [{ scale: clearLogoScale }],
                  },
                ]}
              />

              <View style={[styles.pixelField, { width: logoFrameSize, height: logoFrameSize }]}>{tileNodes}</View>

              <View pointerEvents="none" style={styles.scanlineWrap}>
                {scanlineRows.map((row) => (
                  <View
                    key={`scan-${row}`}
                    style={[
                      styles.scanline,
                      {
                        top: (crtHeight / scanlineRows.length) * row,
                        opacity: row % 2 === 0 ? 0.12 : 0.05,
                      },
                    ]}
                  />
                ))}
              </View>

              <Animated.View
                pointerEvents="none"
                style={[
                  styles.scanSweep,
                  {
                    transform: [{ translateY: sweepTranslateY }],
                  },
                ]}
              />

              <Animated.View pointerEvents="none" style={[styles.noiseLayer, { opacity: flicker }]} />
              <View pointerEvents="none" style={styles.vignette} />
            </Animated.View>
          </View>

          <Animated.View style={[styles.captionWrap, { opacity: captionOpacity }]}>
            <Text style={styles.captionText}>{bootSubtitle}</Text>
            <Text style={styles.footerText}>{bootFooter}</Text>
          </Animated.View>
        </Animated.View>

        <Animated.View pointerEvents="none" style={[styles.fadeCurtain, { opacity: fadeToBlack }]} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#eef2f6",
  },
  root: {
    flex: 1,
    backgroundColor: "#eef2f6",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    paddingHorizontal: 18,
  },
  auraOne: {
    position: "absolute",
    width: screenWidth * 0.82,
    height: screenWidth * 0.82,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.82)",
    top: screenHeight * 0.1,
    left: -screenWidth * 0.12,
  },
  auraTwo: {
    position: "absolute",
    width: screenWidth * 0.72,
    height: screenWidth * 0.72,
    borderRadius: 999,
    backgroundColor: "rgba(209,213,219,0.36)",
    bottom: -screenWidth * 0.14,
    right: -screenWidth * 0.1,
  },
  shell: {
    width: "100%",
    maxWidth: 392,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.94)",
    backgroundColor: "rgba(255,255,255,0.56)",
    padding: 18,
    shadowColor: "#ffffff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.78,
    shadowRadius: 26,
    elevation: 12,
  },
  shellHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  shellLabel: {
    color: "#eef2f7",
    fontFamily: "Montserrat-Bold",
    fontSize: 12,
    letterSpacing: 2.4,
    textShadowColor: "rgba(255,255,255,0.72)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  shellIndicator: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    shadowColor: "#ffffff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
  },
  crtFrame: {
    height: crtHeight,
    borderRadius: 28,
    padding: 10,
    backgroundColor: "#e6eaef",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.88)",
    shadowColor: "#ffffff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
  },
  crtViewport: {
    flex: 1,
    borderRadius: 22,
    backgroundColor: "#000000",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  crtFlash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#f8fafc",
  },
  logoImage: {
    borderRadius: 34,
    shadowColor: "#ffffff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  pixelField: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  pixelTile: {
    position: "absolute",
    overflow: "hidden",
    borderRadius: 2,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "#050505",
  },
  pixelTileImage: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  scanlineWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  scanline: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.65)",
  },
  scanSweep: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 110,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  noiseLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 30,
  },
  captionWrap: {
    marginTop: 14,
    alignItems: "center",
    gap: 5,
  },
  captionText: {
    color: "#dbe2ea",
    fontFamily: "Montserrat-Regular",
    fontSize: 11,
    letterSpacing: 0.7,
    textAlign: "center",
  },
  footerText: {
    color: "rgba(203,213,225,0.78)",
    fontFamily: "Montserrat-Bold",
    fontSize: 9,
    letterSpacing: 2.1,
    textAlign: "center",
  },
  fadeCurtain: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000000",
  },
});
