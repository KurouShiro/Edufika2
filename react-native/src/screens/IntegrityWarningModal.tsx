import React, { useEffect, useRef } from "react";
import { Animated, Easing, Modal, StyleSheet, Text, View } from "react-native";
import { AppLanguage, tr } from "../i18n";
import { TerminalButton, palette } from "./Layout";

type IntegrityWarningModalProps = {
  language: AppLanguage;
  visible: boolean;
  title: string;
  message: string;
  onDismiss: () => void;
};

export default function IntegrityWarningModal({
  language,
  visible,
  title,
  message,
  onDismiss,
}: IntegrityWarningModalProps) {
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    if (!visible) {
      return;
    }
    overlayOpacity.setValue(0);
    cardOpacity.setValue(0);
    cardScale.setValue(0.95);

    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 120,
        easing: Easing.out(Easing.linear),
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(cardScale, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      }),
    ]).start();
  }, [cardOpacity, cardScale, overlayOpacity, visible]);

  return (
    <Modal transparent visible={visible} animationType="none">
      <Animated.View style={[styles.backdrop, { opacity: overlayOpacity }]}>
        <Animated.View style={[styles.modal, { opacity: cardOpacity, transform: [{ scale: cardScale }] }]}>
          <Text style={styles.title}>{title.toUpperCase()}</Text>
          <Text style={styles.body}>{message}</Text>
          <TerminalButton label={tr(language, "Saya Mengerti", "Acknowledge")} onPress={onDismiss} />
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.56)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modal: {
    width: "100%",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.25)",
    borderRadius: 24,
    backgroundColor: palette.panel,
    padding: 14,
  },
  title: {
    color: palette.warning,
    fontSize: 13,
    marginBottom: 8,
    letterSpacing: 1,
    fontFamily: "JetBrainsMono-Bold",
  },
  body: {
    color: "#4b5563",
    fontSize: 11,
    lineHeight: 17,
    fontFamily: "JetBrainsMono-Regular",
    marginBottom: 8,
  },
});
