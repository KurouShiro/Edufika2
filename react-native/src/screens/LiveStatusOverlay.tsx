import React from "react";
import { StyleSheet, Text, View } from "react-native";

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
      <Text style={styles.text}>{`ID:${studentId}`}</Text>
      <Text style={styles.text}>{`SID:${sessionId}`}</Text>
      <Text style={styles.text}>{`RISK:${riskScore}`}</Text>
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
    borderColor: "rgba(255,255,255,0.24)",
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.52)",
    paddingHorizontal: 8,
    paddingVertical: 6,
    maxWidth: 190,
  },
  text: {
    color: "#86efac",
    fontSize: 9,
    lineHeight: 13,
    fontFamily: "JetBrainsMono-Regular",
  },
});
