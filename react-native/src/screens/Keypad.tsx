import React, { useState } from "react";
import { Clipboard, Pressable, StyleSheet, Text, View } from "react-native";
import { AppLanguage, tr } from "../i18n";
import { palette } from "./Layout";

type KeypadProps = {
  language: AppLanguage;
  onPressDigit: (value: string) => void;
  onBackspace: () => void;
  onClear?: () => void;
  currentValue?: string;
  onPasteText?: (value: string) => void;
};

const rows = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["Z", "X", "C", "V", "B", "N", "M"],
];

const letterPattern = /^[A-Z]$/;

export default function Keypad({
  language,
  onPressDigit,
  onBackspace,
  onClear,
  currentValue = "",
  onPasteText,
}: KeypadProps) {
  const [useUppercase, setUseUppercase] = useState(true);

  const applyCase = (key: string) => (useUppercase ? key.toUpperCase() : key.toLowerCase());
  const normalizeClipboardText = (value: string) => value.replace(/\r?\n/g, "").trim();

  const handleCopy = () => {
    Clipboard.setString(currentValue);
  };

  const handlePaste = async () => {
    const raw = await Clipboard.getString();
    const normalized = normalizeClipboardText(raw);
    if (!normalized) {
      return;
    }
    const shaped = useUppercase ? normalized.toUpperCase() : normalized;
    if (onPasteText) {
      onPasteText(shaped);
      return;
    }
    shaped.split("").forEach((char) => onPressDigit(char));
  };

  return (
    <View style={styles.root}>
      {rows.map((row, rowIndex) => (
        <View
          key={`row-${rowIndex}`}
          style={[
            styles.row,
            rowIndex === 2 ? styles.rowPadA : null,
            rowIndex === 3 ? styles.rowPadB : null,
          ]}
        >
          {row.map((key) => (
            <Pressable
              key={`${rowIndex}-${key}`}
              onPress={() => onPressDigit(applyCase(key))}
              style={({ pressed }) => [styles.key, pressed ? styles.keyPressed : null]}
            >
              <Text style={styles.keyText}>{letterPattern.test(key) ? applyCase(key) : key}</Text>
            </Pressable>
          ))}
        </View>
      ))}

      <View style={styles.controlsRow}>
        <Pressable
          onPress={() => setUseUppercase((prev) => !prev)}
          style={({ pressed }) => [
            styles.shift,
            useUppercase ? styles.shiftActive : null,
            pressed ? styles.keyPressed : null,
          ]}
        >
          <Text style={[styles.controlText, useUppercase ? styles.shiftActiveText : null]}>
            {useUppercase
              ? tr(language, "SHIFT ON", "SHIFT ON")
              : tr(language, "SHIFT OFF", "SHIFT OFF")}
          </Text>
        </Pressable>

        <Pressable onPress={() => onPressDigit("_")} style={({ pressed }) => [styles.underscore, pressed ? styles.keyPressed : null]}>
          <Text style={styles.keyText}>_</Text>
        </Pressable>

        <Pressable onPress={() => onPressDigit("-")} style={({ pressed }) => [styles.dash, pressed ? styles.keyPressed : null]}>
          <Text style={styles.keyText}>-</Text>
        </Pressable>

        <Pressable onPress={onBackspace} style={({ pressed }) => [styles.backspace, pressed ? styles.keyPressed : null]}>
          <Text style={styles.controlText}>{tr(language, "BKSP", "BACK")}</Text>
        </Pressable>
      </View>

      <View style={styles.clipboardRow}>
        <Pressable onPress={handleCopy} style={({ pressed }) => [styles.copyPaste, pressed ? styles.keyPressed : null]}>
          <Text style={styles.copyPasteText}>{tr(language, "SALIN", "COPY")}</Text>
        </Pressable>
        <Pressable onPress={handlePaste} style={({ pressed }) => [styles.copyPaste, pressed ? styles.keyPressed : null]}>
          <Text style={styles.copyPasteText}>{tr(language, "TEMPEL", "PASTE")}</Text>
        </Pressable>
        <Pressable onPress={onClear} style={({ pressed }) => [styles.clear, pressed ? styles.keyPressed : null]}>
          <Text style={styles.clearText}>{tr(language, "HAPUS", "CLEAR")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 6,
  },
  row: {
    flexDirection: "row",
    gap: 5,
    justifyContent: "center",
  },
  rowPadA: {
    paddingHorizontal: 16,
  },
  rowPadB: {
    paddingHorizontal: 30,
  },
  key: {
    flex: 1,
    minWidth: 26,
    height: 40,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 11,
    backgroundColor: palette.panel,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0f172a",
    shadowOpacity: 0.04,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  keyPressed: {
    transform: [{ scale: 0.95 }],
    opacity: 0.86,
  },
  keyText: {
    color: "#4b5563",
    fontFamily: "JetBrainsMono-Bold",
    fontSize: 12,
  },
  controlsRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 2,
  },
  shift: {
    flex: 1.6,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.panel,
    alignItems: "center",
    justifyContent: "center",
  },
  shiftActive: {
    backgroundColor: palette.neon,
    borderColor: palette.neon,
  },
  shiftActiveText: {
    color: "#ffffff",
  },
  underscore: {
    flex: 1.55,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.panel,
    alignItems: "center",
    justifyContent: "center",
  },
  dash: {
    flex: 0.95,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.panel,
    alignItems: "center",
    justifyContent: "center",
  },
  backspace: {
    flex: 1.2,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
  },
  controlText: {
    color: "#6b7280",
    fontFamily: "JetBrainsMono-Bold",
    fontSize: 10,
    letterSpacing: 0.6,
  },
  clear: {
    flex: 1.1,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.2)",
    backgroundColor: "rgba(239,68,68,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  clearText: {
    color: palette.warning,
    fontFamily: "JetBrainsMono-Bold",
    fontSize: 10,
    letterSpacing: 0.7,
  },
  clipboardRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 1,
  },
  copyPaste: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
  },
  copyPasteText: {
    color: "#4b5563",
    fontFamily: "JetBrainsMono-Bold",
    fontSize: 10,
    letterSpacing: 0.7,
  },
});
