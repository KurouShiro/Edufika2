import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppLanguage, tr } from "../i18n";
import { palette } from "./Layout";

type KeypadProps = {
  language: AppLanguage;
  onPressDigit: (value: string) => void;
  onBackspace: () => void;
  onClear?: () => void;
};

const rows = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L", "_"],
  ["SHIFT", "Z", "X", "C", "V", "B", "N", "M", "CLR", "BACK"],
];
const letterPattern = /^[A-Z]$/;

export default function Keypad({ language, onPressDigit, onBackspace, onClear }: KeypadProps) {
  const [useLowercase, setUseLowercase] = useState(false);

  const getDisplayKey = (key: string): string => {
    if (key === "SHIFT") {
      return useLowercase ? "abc" : "ABC";
    }
    if (letterPattern.test(key)) {
      return useLowercase ? key.toLowerCase() : key;
    }
    return key;
  };

  return (
    <View style={styles.root}>
      {rows.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={styles.row}>
          {row.map((key) => {
            const isClear = key === "CLR";
            const isBack = key === "BACK";
            const isShift = key === "SHIFT";
            const isLetter = letterPattern.test(key);
            return (
              <Pressable
                key={`${rowIndex}-${key}`}
                style={({ pressed }) => [
                  styles.key,
                  rowIndex === 3 && (isClear || isBack || isShift) ? styles.specialKey : null,
                  isClear ? styles.clearKey : null,
                  isShift ? styles.shiftKey : null,
                  isShift && useLowercase ? styles.shiftKeyActive : null,
                  pressed ? styles.keyPressed : null,
                ]}
                onPress={() => {
                  if (isShift) {
                    setUseLowercase((value) => !value);
                    return;
                  }
                  if (isClear) {
                    onClear?.();
                    return;
                  }
                  if (isBack) {
                    onBackspace();
                    return;
                  }
                  const input = useLowercase && isLetter ? key.toLowerCase() : key;
                  onPressDigit(input);
                }}
              >
                <Text
                  style={[
                    styles.keyText,
                    isClear ? styles.clearText : null,
                    isShift && useLowercase ? styles.shiftTextActive : null,
                  ]}
                >
                  {key === "CLR"
                    ? tr(language, "HAPUS", "CLR")
                    : key === "BACK"
                      ? tr(language, "BKSP", "BACK")
                      : getDisplayKey(key)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginTop: 6,
    gap: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  key: {
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(229,231,235,1)",
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    minHeight: 42,
    shadowColor: "#0f172a",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  specialKey: {
    flex: 1.45,
    backgroundColor: "#f3f4f6",
  },
  clearKey: {
    borderColor: "rgba(239,68,68,0.35)",
    backgroundColor: "rgba(239,68,68,0.12)",
  },
  keyPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.985 }],
  },
  keyText: {
    color: palette.text,
    fontFamily: "JetBrainsMono-Bold",
    fontSize: 11,
    letterSpacing: 0.4,
  },
  clearText: {
    color: palette.warning,
  },
  shiftKey: {
    borderColor: "rgba(34,197,94,0.28)",
    backgroundColor: "rgba(34,197,94,0.12)",
  },
  shiftKeyActive: {
    borderColor: "rgba(34,197,94,0.9)",
    backgroundColor: "rgba(34,197,94,0.35)",
  },
  shiftTextActive: {
    color: "#065f46",
  },
});
