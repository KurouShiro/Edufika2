import React, { ReactNode, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from "react-native";

export type ThemePalette = {
  bg: string;
  bgDeep: string;
  panel: string;
  panelSoft: string;
  text: string;
  muted: string;
  line: string;
  neon: string;
  neonSoft: string;
  blue: string;
  blueSoft: string;
  warning: string;
  warningSoft: string;
  gradientStart: string;
  gradientEnd: string;
};

export type ThemeId =
  | "matrix"
  | "ocean"
  | "sunset"
  | "ember"
  | "aurora"
  | "violet"
  | "graphite";

export type ThemePreset = {
  id: ThemeId;
  labelId: string;
  labelEn: string;
  palette: ThemePalette;
};

const THEME_PRESETS: ThemePreset[] = [
  {
    id: "matrix",
    labelId: "Matrix Hijau",
    labelEn: "Matrix Green",
    palette: {
      bg: "#fdfcfb",
      bgDeep: "#f5f7f9",
      panel: "#ffffff",
      panelSoft: "#f8fafc",
      text: "#1f2937",
      muted: "#9ca3af",
      line: "#e5e7eb",
      neon: "#22c55e",
      neonSoft: "rgba(34,197,94,0.16)",
      blue: "#3b82f6",
      blueSoft: "rgba(59,130,246,0.12)",
      warning: "#ef4444",
      warningSoft: "rgba(239,68,68,0.12)",
      gradientStart: "#ecfdf3",
      gradientEnd: "#ecfeff",
    },
  },
  {
    id: "ocean",
    labelId: "Biru Laut",
    labelEn: "Ocean Blue",
    palette: {
      bg: "#f6fbff",
      bgDeep: "#eaf5ff",
      panel: "#ffffff",
      panelSoft: "#f2f8ff",
      text: "#0f172a",
      muted: "#64748b",
      line: "#d6e4f5",
      neon: "#0ea5e9",
      neonSoft: "rgba(14,165,233,0.18)",
      blue: "#2563eb",
      blueSoft: "rgba(37,99,235,0.14)",
      warning: "#ef4444",
      warningSoft: "rgba(239,68,68,0.12)",
      gradientStart: "#dff4ff",
      gradientEnd: "#dbeafe",
    },
  },
  {
    id: "sunset",
    labelId: "Sunset Oranye",
    labelEn: "Sunset Orange",
    palette: {
      bg: "#fff8f1",
      bgDeep: "#ffedd5",
      panel: "#fffdfb",
      panelSoft: "#fff7ed",
      text: "#27272a",
      muted: "#78716c",
      line: "#fed7aa",
      neon: "#f97316",
      neonSoft: "rgba(249,115,22,0.18)",
      blue: "#db2777",
      blueSoft: "rgba(219,39,119,0.14)",
      warning: "#dc2626",
      warningSoft: "rgba(220,38,38,0.12)",
      gradientStart: "#ffe4d6",
      gradientEnd: "#ffe4f1",
    },
  },
  {
    id: "ember",
    labelId: "Ember Merah",
    labelEn: "Ember Red",
    palette: {
      bg: "#fff7f7",
      bgDeep: "#fee2e2",
      panel: "#fffefe",
      panelSoft: "#fff1f2",
      text: "#292524",
      muted: "#7f1d1d",
      line: "#fecaca",
      neon: "#ef4444",
      neonSoft: "rgba(239,68,68,0.16)",
      blue: "#f59e0b",
      blueSoft: "rgba(245,158,11,0.14)",
      warning: "#b91c1c",
      warningSoft: "rgba(185,28,28,0.12)",
      gradientStart: "#ffe4e6",
      gradientEnd: "#ffedd5",
    },
  },
  {
    id: "aurora",
    labelId: "Aurora Mint",
    labelEn: "Aurora Mint",
    palette: {
      bg: "#f3fffb",
      bgDeep: "#dcfce7",
      panel: "#ffffff",
      panelSoft: "#ecfeff",
      text: "#0f172a",
      muted: "#0f766e",
      line: "#a7f3d0",
      neon: "#14b8a6",
      neonSoft: "rgba(20,184,166,0.18)",
      blue: "#84cc16",
      blueSoft: "rgba(132,204,22,0.16)",
      warning: "#dc2626",
      warningSoft: "rgba(220,38,38,0.12)",
      gradientStart: "#d1fae5",
      gradientEnd: "#ccfbf1",
    },
  },
  {
    id: "violet",
    labelId: "Violet Neon",
    labelEn: "Violet Neon",
    palette: {
      bg: "#faf7ff",
      bgDeep: "#f3e8ff",
      panel: "#ffffff",
      panelSoft: "#faf5ff",
      text: "#1f2937",
      muted: "#6d28d9",
      line: "#ddd6fe",
      neon: "#8b5cf6",
      neonSoft: "rgba(139,92,246,0.18)",
      blue: "#ec4899",
      blueSoft: "rgba(236,72,153,0.14)",
      warning: "#dc2626",
      warningSoft: "rgba(220,38,38,0.12)",
      gradientStart: "#ede9fe",
      gradientEnd: "#fae8ff",
    },
  },
  {
    id: "graphite",
    labelId: "Graphite Slate",
    labelEn: "Graphite Slate",
    palette: {
      bg: "#f8fafc",
      bgDeep: "#e2e8f0",
      panel: "#ffffff",
      panelSoft: "#f1f5f9",
      text: "#111827",
      muted: "#64748b",
      line: "#cbd5e1",
      neon: "#334155",
      neonSoft: "rgba(51,65,85,0.18)",
      blue: "#475569",
      blueSoft: "rgba(71,85,105,0.16)",
      warning: "#dc2626",
      warningSoft: "rgba(220,38,38,0.12)",
      gradientStart: "#e2e8f0",
      gradientEnd: "#f8fafc",
    },
  },
];

const THEME_PRESET_MAP: Record<ThemeId, ThemePreset> = THEME_PRESETS.reduce(
  (acc, preset) => {
    acc[preset.id] = preset;
    return acc;
  },
  {} as Record<ThemeId, ThemePreset>
);

const DEFAULT_THEME_ID: ThemeId = "matrix";
let activeThemeId: ThemeId = DEFAULT_THEME_ID;
const themeListeners = new Set<() => void>();

const monoRegular = "Montserrat-Regular";
const monoBold = "Montserrat-Bold";
const screenHeight = Dimensions.get("window").height;

type LayoutProps = {
  title: string;
  subtitle?: string;
  topRight?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
};

type TerminalButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: "solid" | "outline";
  disabled?: boolean;
};

type TerminalInputProps = TextInputProps & {
  label?: string;
};

type BadgeProps = {
  label: string;
  tone?: "neon" | "warning" | "muted";
};

export const themePresets = THEME_PRESETS;
export const palette: ThemePalette = { ...THEME_PRESET_MAP[DEFAULT_THEME_ID].palette };

function getThemePreset(themeId: ThemeId): ThemePreset {
  return THEME_PRESET_MAP[themeId] ?? THEME_PRESET_MAP[DEFAULT_THEME_ID];
}

function emitThemeChange() {
  themeListeners.forEach((listener) => listener());
}

function subscribeTheme(listener: () => void): () => void {
  themeListeners.add(listener);
  return () => {
    themeListeners.delete(listener);
  };
}

function getThemeSnapshot(): ThemePreset {
  return getThemePreset(activeThemeId);
}

function getServerThemeSnapshot(): ThemePreset {
  return getThemePreset(DEFAULT_THEME_ID);
}

export function setActiveTheme(themeId: ThemeId) {
  if (!THEME_PRESET_MAP[themeId] || activeThemeId === themeId) {
    return;
  }
  activeThemeId = themeId;
  Object.assign(palette, THEME_PRESET_MAP[themeId].palette);
  emitThemeChange();
}

export function getActiveThemeId(): ThemeId {
  return activeThemeId;
}

export function useThemePreset(): ThemePreset {
  return useSyncExternalStore(subscribeTheme, getThemeSnapshot, getServerThemeSnapshot);
}

export function useThemePalette(): ThemePalette {
  return useThemePreset().palette;
}

export function useTerminalStyles() {
  const activePalette = useThemePalette();
  return useMemo(() => createTerminalStyles(activePalette), [activePalette]);
}

export default function Layout({ title, subtitle, topRight, children, footer }: LayoutProps) {
  const activePalette = useThemePalette();
  const activePreset = useThemePreset();
  const styles = useMemo(() => createLayoutStyles(activePalette), [activePalette]);
  const entranceOpacity = useRef(new Animated.Value(0)).current;
  const entranceTranslateY = useRef(new Animated.Value(12)).current;
  const entranceScale = useRef(new Animated.Value(0.985)).current;

  useEffect(() => {
    entranceOpacity.setValue(0);
    entranceTranslateY.setValue(12);
    entranceScale.setValue(0.985);

    Animated.parallel([
      Animated.timing(entranceOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(entranceTranslateY, {
        toValue: 0,
        duration: 250,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      }),
      Animated.timing(entranceScale, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      }),
    ]).start();
  }, [entranceOpacity, entranceScale, entranceTranslateY, title, subtitle]);

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <BackgroundTexture styles={styles} activePalette={activePalette} />
        <Animated.View
          style={[
            styles.container,
            {
              opacity: entranceOpacity,
              transform: [{ translateY: entranceTranslateY }, { scale: entranceScale }],
            },
          ]}
        >
          <View style={styles.topBar}>
            <Text style={styles.topBarText}>EDUFIKA::{activePreset.id.toUpperCase()}</Text>
            {topRight}
          </View>

          <View style={styles.headerWrap}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>

          <View style={styles.panel}>{children}</View>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function BackgroundTexture({
  styles,
  activePalette,
}: {
  styles: ReturnType<typeof createLayoutStyles>;
  activePalette: ThemePalette;
}) {
  const scanProgress = useRef(new Animated.Value(0)).current;
  const scanOpacity = useRef(new Animated.Value(0.12)).current;

  useEffect(() => {
    const motionLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanProgress, {
          toValue: 1,
          duration: 2800,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(scanProgress, {
          toValue: 0,
          duration: 90,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ])
    );

    const flickerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanOpacity, {
          toValue: 0.06,
          duration: 160,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(scanOpacity, {
          toValue: 0.14,
          duration: 220,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ])
    );

    motionLoop.start();
    flickerLoop.start();
    return () => {
      motionLoop.stop();
      flickerLoop.stop();
    };
  }, [scanOpacity, scanProgress]);

  const scanTranslateY = scanProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-14, screenHeight],
  });

  return (
    <View pointerEvents="none" style={styles.backgroundWrap}>
      <View style={[styles.gradientBase, { backgroundColor: activePalette.gradientStart }]} />
      <View style={[styles.gradientBlend, { backgroundColor: activePalette.gradientEnd }]} />
      <View style={[styles.orbA, { backgroundColor: activePalette.neonSoft }]} />
      <View style={[styles.orbB, { backgroundColor: activePalette.blueSoft }]} />
      <Animated.View
        style={[
          styles.scanline,
          {
            backgroundColor: activePalette.neonSoft,
            opacity: scanOpacity,
            transform: [{ translateY: scanTranslateY }],
          },
        ]}
      />
      <View style={styles.gridWrap}>
        {Array.from({ length: 9 }).map((_, idx) => (
          <View key={`v-${idx}`} style={styles.vLine} />
        ))}
      </View>
      <View style={styles.gridWrapHorizontal}>
        {Array.from({ length: 14 }).map((_, idx) => (
          <View key={`h-${idx}`} style={styles.hLine} />
        ))}
      </View>
    </View>
  );
}

export function TerminalButton({ label, onPress, variant = "solid", disabled = false }: TerminalButtonProps) {
  const themedTerminalStyles = useTerminalStyles();
  const outlined = variant === "outline";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        themedTerminalStyles.button,
        outlined ? themedTerminalStyles.buttonOutline : themedTerminalStyles.buttonSolid,
        pressed ? themedTerminalStyles.buttonPressed : null,
        disabled ? themedTerminalStyles.buttonDisabled : null,
      ]}
    >
      <Text
        style={[
          themedTerminalStyles.buttonText,
          outlined ? themedTerminalStyles.buttonOutlineText : themedTerminalStyles.buttonSolidText,
        ]}
      >
        {label.toUpperCase()}
      </Text>
    </Pressable>
  );
}

export function TerminalInput({ label, ...props }: TerminalInputProps) {
  const activePalette = useThemePalette();
  const themedTerminalStyles = useTerminalStyles();
  return (
    <View style={themedTerminalStyles.inputWrap}>
      {label ? <Text style={themedTerminalStyles.inputLabel}>{label.toUpperCase()}</Text> : null}
      <TextInput {...props} placeholderTextColor={activePalette.muted} style={[themedTerminalStyles.input, props.style]} />
    </View>
  );
}

export function TerminalBadge({ label, tone = "neon" }: BadgeProps) {
  const themedTerminalStyles = useTerminalStyles();
  const badgeToneStyle =
    tone === "warning"
      ? themedTerminalStyles.badgeWarning
      : tone === "muted"
        ? themedTerminalStyles.badgeMuted
        : themedTerminalStyles.badgeNeon;
  return (
    <View style={[themedTerminalStyles.badge, badgeToneStyle]}>
      <Text style={themedTerminalStyles.badgeText}>{label.toUpperCase()}</Text>
    </View>
  );
}

export const terminalStyles = createTerminalStyles(palette);

function createTerminalStyles(activePalette: ThemePalette) {
  return StyleSheet.create({
    heading: {
      color: activePalette.text,
      fontFamily: monoBold,
      fontSize: 16,
      letterSpacing: 0.3,
      marginBottom: 10,
    },
    bodyText: {
      color: activePalette.text,
      fontFamily: monoRegular,
      fontSize: 12,
      marginBottom: 8,
      lineHeight: 18,
    },
    subtleText: {
      color: activePalette.muted,
      fontFamily: monoRegular,
      fontSize: 10,
      lineHeight: 16,
      marginBottom: 6,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      marginBottom: 10,
    },
    splitRow: {
      flexDirection: "row",
      gap: 8,
    },
    splitCol: {
      flex: 1,
    },
    button: {
      borderRadius: 16,
      paddingVertical: 12,
      paddingHorizontal: 12,
      marginBottom: 10,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
    },
    buttonSolid: {
      backgroundColor: activePalette.neon,
      borderColor: activePalette.neon,
      shadowColor: activePalette.neon,
      shadowOpacity: 0.18,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    buttonOutline: {
      backgroundColor: activePalette.panel,
      borderColor: activePalette.line,
    },
    buttonPressed: {
      opacity: 0.88,
      transform: [{ scale: 0.986 }],
    },
    buttonDisabled: {
      opacity: 0.46,
    },
    buttonText: {
      fontFamily: monoBold,
      fontSize: 11,
      letterSpacing: 0.9,
    },
    buttonSolidText: {
      color: "#ffffff",
    },
    buttonOutlineText: {
      color: activePalette.text,
    },
    inputWrap: {
      marginBottom: 10,
    },
    inputLabel: {
      color: activePalette.muted,
      fontFamily: monoRegular,
      fontSize: 10,
      marginBottom: 6,
      letterSpacing: 0.8,
      paddingHorizontal: 2,
    },
    input: {
      borderWidth: 1,
      borderColor: activePalette.line,
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 11,
      color: activePalette.text,
      backgroundColor: activePalette.panel,
      fontFamily: monoRegular,
      fontSize: 12,
    },
    card: {
      borderWidth: 1,
      borderColor: activePalette.line,
      backgroundColor: activePalette.panel,
      borderRadius: 20,
      padding: 12,
      marginBottom: 10,
      shadowColor: "#0f172a",
      shadowOpacity: 0.06,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    badge: {
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 4,
      alignSelf: "flex-start",
    },
    badgeNeon: {
      borderColor: activePalette.neonSoft,
      backgroundColor: activePalette.neonSoft,
    },
    badgeWarning: {
      borderColor: activePalette.warningSoft,
      backgroundColor: activePalette.warningSoft,
    },
    badgeMuted: {
      borderColor: activePalette.line,
      backgroundColor: activePalette.panelSoft,
    },
    badgeText: {
      color: activePalette.text,
      fontSize: 10,
      letterSpacing: 0.8,
      fontFamily: monoBold,
    },
    divider: {
      height: 1,
      backgroundColor: activePalette.line,
      marginVertical: 10,
    },
    monoRegular: {
      fontFamily: monoRegular,
    },
  });
}

function createLayoutStyles(activePalette: ThemePalette) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: activePalette.bg,
    },
    keyboard: {
      flex: 1,
    },
    backgroundWrap: {
      ...StyleSheet.absoluteFillObject,
      overflow: "hidden",
    },
    gradientBase: {
      ...StyleSheet.absoluteFillObject,
    },
    gradientBlend: {
      ...StyleSheet.absoluteFillObject,
      opacity: 0.6,
      transform: [{ translateY: 30 }, { scale: 1.08 }],
    },
    gridWrap: {
      ...StyleSheet.absoluteFillObject,
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 14,
    },
    gridWrapHorizontal: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "space-between",
      paddingVertical: 18,
    },
    vLine: {
      width: 1,
      backgroundColor: "rgba(15,23,42,0.018)",
    },
    hLine: {
      height: 1,
      backgroundColor: "rgba(15,23,42,0.017)",
    },
    scanline: {
      position: "absolute",
      left: 0,
      right: 0,
      top: -8,
      height: 2,
    },
    orbA: {
      position: "absolute",
      width: 230,
      height: 230,
      borderRadius: 115,
      top: -92,
      right: -70,
    },
    orbB: {
      position: "absolute",
      width: 260,
      height: 260,
      borderRadius: 130,
      bottom: -110,
      left: -112,
    },
    container: {
      flex: 1,
      paddingHorizontal: 14,
      paddingTop: 8,
      paddingBottom: 12,
    },
    topBar: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
    },
    topBarText: {
      color: activePalette.muted,
      fontFamily: monoRegular,
      fontSize: 9,
      letterSpacing: 1.05,
    },
    headerWrap: {
      marginBottom: 10,
      paddingBottom: 8,
    },
    title: {
      color: activePalette.text,
      fontFamily: monoBold,
      fontSize: 24,
      letterSpacing: 0.2,
      marginBottom: 3,
    },
    subtitle: {
      color: activePalette.muted,
      fontFamily: monoRegular,
      fontSize: 11,
      lineHeight: 16,
    },
    panel: {
      flex: 1,
      borderWidth: 1,
      borderColor: activePalette.line,
      borderRadius: 24,
      backgroundColor: activePalette.panel,
      padding: 12,
      overflow: "hidden",
    },
    footer: {
      marginTop: 10,
    },
  });
}
