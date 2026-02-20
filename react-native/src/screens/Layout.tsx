import React, { ReactNode, useEffect, useRef } from "react";
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

export const palette = {
  bg: "#fdfcfb",
  panel: "#ffffff",
  neon: "#22c55e",
  neonSoft: "rgba(34,197,94,0.22)",
  text: "#1f2937",
  muted: "#6b7280",
  warning: "#ef4444",
  line: "#e5e7eb",
} as const;

const monoRegular = "JetBrainsMono-Regular";
const monoBold = "JetBrainsMono-Bold";
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

export default function Layout({ title, subtitle, topRight, children, footer }: LayoutProps) {
  const entranceOpacity = useRef(new Animated.Value(0)).current;
  const entranceTranslateY = useRef(new Animated.Value(12)).current;
  const entranceScale = useRef(new Animated.Value(0.98)).current;

  useEffect(() => {
    entranceOpacity.setValue(0);
    entranceTranslateY.setValue(12);
    entranceScale.setValue(0.98);

    Animated.parallel([
      Animated.timing(entranceOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(entranceTranslateY, {
        toValue: 0,
        duration: 260,
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
        <BackgroundTexture />
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
            <Text style={styles.topBarText}>EDUFIKA_UI::ACTIVE</Text>
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

function BackgroundTexture() {
  const scanProgress = useRef(new Animated.Value(0)).current;
  const scanOpacity = useRef(new Animated.Value(0.12)).current;

  useEffect(() => {
    const motionLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanProgress, {
          toValue: 1,
          duration: 2600,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(scanProgress, {
          toValue: 0,
          duration: 80,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ])
    );

    const flickerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanOpacity, {
          toValue: 0.05,
          duration: 140,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(scanOpacity, {
          toValue: 0.14,
          duration: 180,
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
    outputRange: [-16, screenHeight],
  });

  return (
    <View pointerEvents="none" style={styles.backgroundWrap}>
      <View style={styles.orbA} />
      <View style={styles.orbB} />
      <Animated.View
        style={[
          styles.scanline,
          {
            opacity: scanOpacity,
            transform: [{ translateY: scanTranslateY }],
          },
        ]}
      />
      <View style={styles.gridWrap}>
        {Array.from({ length: 10 }).map((_, idx) => (
          <View key={`v-${idx}`} style={styles.vLine} />
        ))}
      </View>
      <View style={styles.gridWrapHorizontal}>
        {Array.from({ length: 16 }).map((_, idx) => (
          <View key={`h-${idx}`} style={styles.hLine} />
        ))}
      </View>
    </View>
  );
}

export function TerminalButton({ label, onPress, variant = "solid", disabled = false }: TerminalButtonProps) {
  const outlined = variant === "outline";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        terminalStyles.button,
        outlined ? terminalStyles.buttonOutline : terminalStyles.buttonSolid,
        pressed ? terminalStyles.buttonPressed : null,
        disabled ? terminalStyles.buttonDisabled : null,
      ]}
    >
      <Text style={[terminalStyles.buttonText, outlined ? terminalStyles.buttonOutlineText : terminalStyles.buttonSolidText]}>
        {label.toUpperCase()}
      </Text>
    </Pressable>
  );
}

export function TerminalInput({ label, ...props }: TerminalInputProps) {
  return (
    <View style={terminalStyles.inputWrap}>
      {label ? <Text style={terminalStyles.inputLabel}>{label.toUpperCase()}</Text> : null}
      <TextInput {...props} placeholderTextColor={palette.muted} style={[terminalStyles.input, props.style]} />
    </View>
  );
}

export function TerminalBadge({ label, tone = "neon" }: BadgeProps) {
  const badgeToneStyle =
    tone === "warning" ? terminalStyles.badgeWarning : tone === "muted" ? terminalStyles.badgeMuted : terminalStyles.badgeNeon;

  return (
    <View style={[terminalStyles.badge, badgeToneStyle]}>
      <Text style={terminalStyles.badgeText}>{label.toUpperCase()}</Text>
    </View>
  );
}

export const terminalStyles = StyleSheet.create({
  heading: {
    color: palette.text,
    fontFamily: monoBold,
    fontSize: 16,
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  bodyText: {
    color: palette.text,
    fontFamily: monoRegular,
    fontSize: 12,
    marginBottom: 8,
    lineHeight: 18,
  },
  subtleText: {
    color: palette.muted,
    fontFamily: monoRegular,
    fontSize: 11,
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
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  buttonSolid: {
    backgroundColor: palette.neon,
    borderColor: palette.neon,
  },
  buttonOutline: {
    backgroundColor: "#ffffff",
    borderColor: palette.line,
  },
  buttonPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.988 }],
  },
  buttonDisabled: {
    opacity: 0.42,
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
    color: palette.text,
  },
  inputWrap: {
    marginBottom: 10,
  },
  inputLabel: {
    color: palette.muted,
    fontFamily: monoRegular,
    fontSize: 10,
    marginBottom: 6,
    letterSpacing: 0.8,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: palette.text,
    backgroundColor: "#ffffff",
    fontFamily: monoRegular,
    fontSize: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 12,
    marginBottom: 10,
    shadowColor: "#0f172a",
    shadowOpacity: 0.05,
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
    borderColor: "rgba(34,197,94,0.2)",
    backgroundColor: "rgba(34,197,94,0.12)",
  },
  badgeWarning: {
    borderColor: "rgba(239,68,68,0.2)",
    backgroundColor: "rgba(239,68,68,0.12)",
  },
  badgeMuted: {
    borderColor: "rgba(107,114,128,0.2)",
    backgroundColor: "rgba(107,114,128,0.1)",
  },
  badgeText: {
    color: palette.text,
    fontSize: 10,
    letterSpacing: 0.8,
    fontFamily: monoBold,
  },
  divider: {
    height: 1,
    backgroundColor: palette.line,
    marginVertical: 10,
  },
  monoRegular: {
    fontFamily: monoRegular,
  },
});

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  keyboard: {
    flex: 1,
  },
  backgroundWrap: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
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
    paddingVertical: 20,
  },
  vLine: {
    width: 1,
    backgroundColor: "rgba(15,23,42,0.025)",
  },
  hLine: {
    height: 1,
    backgroundColor: "rgba(15,23,42,0.02)",
  },
  scanline: {
    position: "absolute",
    left: 0,
    right: 0,
    top: -10,
    height: 2,
    backgroundColor: "rgba(34,197,94,0.16)",
  },
  orbA: {
    position: "absolute",
    width: 230,
    height: 230,
    borderRadius: 115,
    top: -90,
    right: -70,
    backgroundColor: "rgba(34,197,94,0.11)",
  },
  orbB: {
    position: "absolute",
    width: 290,
    height: 290,
    borderRadius: 145,
    bottom: -130,
    left: -120,
    backgroundColor: "rgba(59,130,246,0.08)",
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
    color: palette.muted,
    fontFamily: monoRegular,
    fontSize: 9,
    letterSpacing: 1.1,
  },
  headerWrap: {
    marginBottom: 10,
    paddingBottom: 8,
  },
  title: {
    color: palette.text,
    fontFamily: monoBold,
    fontSize: 22,
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  subtitle: {
    color: palette.muted,
    fontFamily: monoRegular,
    fontSize: 11,
    lineHeight: 16,
  },
  panel: {
    flex: 1,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.92)",
    padding: 12,
  },
  footer: {
    marginTop: 10,
  },
});
