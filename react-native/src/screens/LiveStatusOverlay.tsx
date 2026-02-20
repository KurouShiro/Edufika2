import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { palette } from "./Layout";

type LiveStatusOverlayProps = {
  studentId: string;
  sessionId: string;
  riskScore: number;
  timestamp: string;
};

export default function LiveStatusOverlay({
  studentId,
  sessionId,
  riskScore,
  timestamp,
}: LiveStatusOverlayProps) {
  return (
    <View pointerEvents="none" style={styles.container}>
      <Text style={styles.text}>ID:{studentId}</Text>
      <Text style={styles.text}>SESSION:{sessionId}</Text>
      <Text style={styles.text}>RISK:{riskScore}</Text>
      <Text style={styles.text}>{timestamp}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 10,
    right: 10,
    borderWidth: 1,
    borderColor: "rgba(57,255,20,0.32)",
    borderRadius: 0,
    backgroundColor: "rgba(5,5,5,0.76)",
    paddingHorizontal: 8,
    paddingVertical: 6,
    maxWidth: 185,
  },
  text: {
    color: palette.neon,
    fontSize: 9,
    lineHeight: 13,
    fontFamily: "JetBrainsMono-Regular",
  },
});
