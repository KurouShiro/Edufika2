import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppLanguage, tr } from "../i18n";
import Layout, { TerminalButton, palette } from "./Layout";

export type InAppQuizSession = {
  sessionId: string;
  examName: string;
  quizTitle: string;
  questionCount: number;
  durationMinutes: number;
  status: string;
  startTime?: string | null;
};

type InAppQuizSelectionProps = {
  language: AppLanguage;
  sessions: InAppQuizSession[];
  statusMessage: string;
  onSelectSession: (session: InAppQuizSession) => void;
  onRefresh: () => void;
  onLogout: () => void;
  onOpenSettings?: () => void;
};

export default function InAppQuizSelection({
  language,
  sessions,
  statusMessage,
  onSelectSession,
  onRefresh,
  onLogout,
  onOpenSettings,
}: InAppQuizSelectionProps) {
  return (
    <Layout
      title={tr(language, "Pilih Quiz", "Select In-App Quiz")}
      subtitle={tr(
        language,
        "Pilih ujian aktif untuk memulai kuis.",
        "Pick an active exam session to start the quiz."
      )}
      footer={
        <View style={styles.footerActions}>
          <TerminalButton label={tr(language, "Refresh", "Refresh")} variant="outline" onPress={onRefresh} />
          <TerminalButton label={tr(language, "Logout", "Logout")} variant="outline" onPress={onLogout} />
          {onOpenSettings ? (
            <TerminalButton label={tr(language, "Pengaturan", "Settings")} variant="outline" onPress={onOpenSettings} />
          ) : null}
        </View>
      }
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {sessions.map((session) => (
          <Pressable
            key={session.sessionId}
            style={styles.card}
            onPress={() => onSelectSession(session)}
          >
            <View style={styles.iconPill}>
              <Text style={styles.iconText}>QUIZ</Text>
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{session.examName || session.quizTitle}</Text>
              <Text style={styles.cardSub}>
                {session.quizTitle} | {session.questionCount} {tr(language, "Soal", "Questions")} |{" "}
                {session.durationMinutes} {tr(language, "Menit", "Minutes")}
              </Text>
              <Text style={styles.cardMeta}>
                {tr(language, "Status", "Status")}: {session.status}
              </Text>
            </View>
          </Pressable>
        ))}

        {sessions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              {tr(
                language,
                "Belum ada kuis aktif yang dipublikasikan.",
                "No published in-app quizzes are active yet."
              )}
            </Text>
          </View>
        ) : null}

        <View style={styles.statusCard}>
          <Text style={styles.statusText}>{statusMessage}</Text>
        </View>
      </ScrollView>
    </Layout>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 20,
  },
  card: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#ffffff",
    borderColor: "rgba(14,165,233,0.22)",
    shadowColor: "#0f172a",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  iconPill: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(14,165,233,0.12)",
  },
  iconText: {
    color: "#1f2937",
    fontFamily: "Montserrat-Bold",
    fontSize: 12,
    letterSpacing: 1,
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    color: "#1f2937",
    fontFamily: "Montserrat-Bold",
    fontSize: 13,
    marginBottom: 2,
  },
  cardSub: {
    color: "#9ca3af",
    fontFamily: "Montserrat-Regular",
    fontSize: 10,
    lineHeight: 14,
  },
  cardMeta: {
    color: "#6b7280",
    fontFamily: "Montserrat-Regular",
    fontSize: 9,
    marginTop: 4,
  },
  emptyCard: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 16,
    backgroundColor: palette.panelSoft,
    padding: 12,
    marginBottom: 10,
  },
  emptyText: {
    color: "#9ca3af",
    fontFamily: "Montserrat-Regular",
    fontSize: 10,
    lineHeight: 14,
  },
  statusCard: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    padding: 12,
  },
  statusText: {
    color: "#6b7280",
    fontFamily: "Montserrat-Regular",
    fontSize: 10,
  },
  footerActions: {
    gap: 0,
  },
});

