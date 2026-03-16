import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppLanguage, tr } from "../i18n";
import Layout, { TerminalButton, TerminalInput, palette } from "./Layout";
import IntegrityWarningModal from "./IntegrityWarningModal";
import {
  buildQuizResultMarkdown,
  saveTextToQuizResult,
  uploadMarkdownToDrive,
} from "../utils/quizResultExport";

type QuizStudentScreenProps = {
  language: AppLanguage;
  backendBaseUrl: string;
  sessionId: string;
  accessSignature: string;
  onBack: () => void;
  onLog: (message: string) => void;
  kioskEnabled: boolean;
  onSetKioskEnabled?: (value: boolean) => void;
  showIntegrityWarning?: boolean;
  integrityMessage?: string;
  onDismissIntegrityWarning?: () => void;
  studentAccount?: StudentAccount | null;
  studentToken?: string;
};

type StudentAccount = {
  name: string;
  studentClass: string;
  elective: string;
  username: string;
  schoolYear: string;
};

type QuizQuestion = {
  id: number;
  question_text: string;
  question_type: string;
  points: number;
  options: Array<{ id: number; key: string; text: string }>;
};

type QuizStartPayload = {
  attempt_id: number;
  status: string;
  student_profile?: {
    student_name: string | null;
    student_class: string | null;
    student_elective: string | null;
  };
  quiz: {
    title: string;
    description: string | null;
    duration_minutes: number;
    show_results_immediately: boolean;
    allow_review: boolean;
  };
  questions: QuizQuestion[];
  existing_answers: Array<{
    question_id: number;
    selected_option_ids: number[];
  }>;
};

type QuizFinishPayload = {
  score: number;
  max_score: number;
  duration_seconds: number;
  show_results_immediately: boolean;
  result_items: Array<{
    question_id: number;
    question_text: string;
    points_awarded: number;
    max_points: number;
    is_correct: boolean;
  }>;
};

function normalizeBackendBaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, "");
}

async function parseJsonResponse(response: any): Promise<any> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload?.error === "string" ? payload.error : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return payload;
}

export default function QuizStudentScreen({
  language,
  backendBaseUrl,
  sessionId,
  accessSignature,
  onBack,
  onLog,
  showIntegrityWarning = false,
  integrityMessage = "",
  onDismissIntegrityWarning,
  studentAccount,
  studentToken,
}: QuizStudentScreenProps) {
  const [statusLine, setStatusLine] = useState(
    tr(language, "Klik Mulai Quiz untuk memuat soal.", "Tap Start Quiz to load questions.")
  );
  const [loading, setLoading] = useState(false);
  const [quizMeta, setQuizMeta] = useState<QuizStartPayload["quiz"] | null>(null);
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedByQuestion, setSelectedByQuestion] = useState<Record<number, number[]>>({});
  const [finished, setFinished] = useState<QuizFinishPayload | null>(null);
  const [resultDetailsOpen, setResultDetailsOpen] = useState(false);
  const [studentName, setStudentName] = useState(studentAccount?.name ?? "");
  const [studentClass, setStudentClass] = useState(studentAccount?.studentClass ?? "");
  const [studentElective, setStudentElective] = useState(studentAccount?.elective ?? "");
  const kioskOverrideRef = useRef<{ active: boolean; previous: boolean }>({
    active: false,
    previous: kioskEnabled,
  });

  const activateKioskOverride = useCallback(() => {
    if (!onSetKioskEnabled) {
      return;
    }
    if (!kioskOverrideRef.current.active) {
      kioskOverrideRef.current = { active: true, previous: kioskEnabled };
    }
    onSetKioskEnabled(false);
  }, [kioskEnabled, onSetKioskEnabled]);

  const restoreKioskOverride = useCallback(() => {
    if (!onSetKioskEnabled) {
      return;
    }
    if (kioskOverrideRef.current.active) {
      onSetKioskEnabled(kioskOverrideRef.current.previous);
      kioskOverrideRef.current.active = false;
    }
  }, [onSetKioskEnabled]);

  useEffect(() => {
    if (finished) {
      activateKioskOverride();
      return;
    }
    restoreKioskOverride();
  }, [activateKioskOverride, finished, restoreKioskOverride]);

  useEffect(() => restoreKioskOverride, [restoreKioskOverride]);

  useEffect(() => {
    if (!studentAccount) {
      return;
    }
    setStudentName(studentAccount.name ?? "");
    setStudentClass(studentAccount.studentClass ?? "");
    setStudentElective(studentAccount.elective ?? "");
  }, [studentAccount]);

  const base = useMemo(() => normalizeBackendBaseUrl(backendBaseUrl), [backendBaseUrl]);

  const currentQuestion = questions[currentIndex] ?? null;
  const currentSelected = currentQuestion ? selectedByQuestion[currentQuestion.id] ?? [] : [];
  const allowProfileEdit = !studentAccount;

  const exportQuizResult = useCallback(
    async (payload: QuizFinishPayload) => {
      if (!quizMeta) {
        return;
      }
      const resultItems = payload.result_items ?? [];
      const correctCount = resultItems.length > 0
        ? resultItems.filter((item) => item.is_correct).length
        : null;
      const incorrectCount = resultItems.length > 0 ? resultItems.length - (correctCount ?? 0) : null;
      const questionCount = questions.length > 0 ? questions.length : resultItems.length;
      const fileNameBase = `${quizMeta.title || "quiz"}_${sessionId}_${Date.now()}`;
      const markdown = buildQuizResultMarkdown({
        quizTitle: quizMeta.title || tr(language, "In-App Quiz", "In-App Quiz"),
        sessionId,
        attemptId,
        questionCount,
        correctCount,
        incorrectCount,
        score: payload.score,
        maxScore: payload.max_score,
        durationSeconds: payload.duration_seconds,
        generatedAt: new Date().toISOString(),
        student: {
          name: studentAccount?.name ?? studentName.trim(),
          studentClass: studentAccount?.studentClass ?? studentClass.trim(),
          elective: studentAccount?.elective ?? studentElective.trim(),
          username: studentAccount?.username,
          schoolYear: studentAccount?.schoolYear,
          studentToken,
        },
        resultItems:
          payload.show_results_immediately && resultItems.length > 0
            ? resultItems.map((item) => ({
                questionText: item.question_text,
                isCorrect: item.is_correct,
                pointsAwarded: item.points_awarded,
                maxPoints: item.max_points,
              }))
            : undefined,
        note: payload.show_results_immediately
          ? undefined
          : tr(
              language,
              "Detail hasil disembunyikan oleh pengaturan sesi.",
              "Result details are hidden by session policy."
            ),
      });

      let savedResult: Awaited<ReturnType<typeof saveTextToQuizResult>> | null = null;
      try {
        savedResult = await saveTextToQuizResult(markdown, fileNameBase);
        onLog(`Quiz result saved: ${savedResult.path}`);
        setStatusLine(
          tr(
            language,
            `Hasil disimpan: ${savedResult.fileName}`,
            `Result saved: ${savedResult.fileName}`
          )
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        onLog(`Quiz result save failed: ${message}`);
        setStatusLine(message);
      }

      try {
        const uploaded = await uploadMarkdownToDrive({
          backendBaseUrl,
          sessionId,
          accessSignature,
          fileName: `${fileNameBase}.txt`,
          markdown,
          metadata: {
            quiz_title: quizMeta.title,
            score: payload.score,
            max_score: payload.max_score,
            correct: correctCount,
            incorrect: incorrectCount,
            student_name: studentAccount?.name ?? studentName.trim(),
            student_username: studentAccount?.username,
          },
        });
        if (uploaded.file_id) {
          onLog(`Quiz result uploaded to Drive: ${uploaded.file_id}`);
          setStatusLine(
            tr(language, "Hasil terkirim ke Google Drive.", "Result uploaded to Google Drive.")
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        onLog(`Quiz result upload failed: ${message}`);
        if (!savedResult) {
          try {
            savedResult = await saveTextToQuizResult(markdown, fileNameBase);
            onLog(`Quiz result saved after upload failure: ${savedResult.path}`);
          } catch (saveError) {
            const saveMessage = saveError instanceof Error ? saveError.message : String(saveError);
            onLog(`Quiz result fallback save failed: ${saveMessage}`);
          }
        }
        if (savedResult) {
          setStatusLine(
            tr(
              language,
              `Upload Drive gagal, hasil disimpan: ${savedResult.fileName}`,
              `Drive upload failed, saved locally: ${savedResult.fileName}`
            )
          );
        } else {
          setStatusLine(
            tr(
              language,
              `Upload Drive gagal: ${message}`,
              `Drive upload failed: ${message}`
            )
          );
        }
      }
    },
    [
      accessSignature,
      attemptId,
      backendBaseUrl,
      language,
      onLog,
      questions.length,
      quizMeta,
      sessionId,
      studentAccount,
      studentClass,
      studentElective,
      studentName,
      studentToken,
    ]
  );

  const startQuiz = useCallback(async () => {
    if (!studentName.trim() || !studentClass.trim() || !studentElective.trim()) {
      setStatusLine(
        tr(
          language,
          "Isi nama, kelas, dan peminatan sebelum memulai kuis.",
          "Fill in name, class, and elective before starting the quiz."
        )
      );
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${base}/quiz/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessSignature}`,
        },
        body: JSON.stringify({
          session_id: sessionId,
          access_signature: accessSignature,
          student_name: studentName.trim(),
          student_class: studentClass.trim(),
          student_elective: studentElective.trim(),
        }),
      });
      const payload = (await parseJsonResponse(response)) as QuizStartPayload;
      setAttemptId(payload.attempt_id);
      setQuizMeta(payload.quiz);
      setQuestions(payload.questions ?? []);
      setCurrentIndex(0);
      const nextSelected: Record<number, number[]> = {};
      payload.existing_answers.forEach((entry) => {
        nextSelected[entry.question_id] = Array.isArray(entry.selected_option_ids)
          ? entry.selected_option_ids
          : [];
      });
      setSelectedByQuestion(nextSelected);
      setFinished(null);
      setStudentName(payload.student_profile?.student_name ?? studentName.trim());
      setStudentClass(payload.student_profile?.student_class ?? studentClass.trim());
      setStudentElective(payload.student_profile?.student_elective ?? studentElective.trim());
      setStatusLine(
        tr(
          language,
          `Quiz dimulai. Total soal: ${payload.questions.length}`,
          `Quiz started. Total questions: ${payload.questions.length}`
        )
      );
      onLog(`Quiz started: attempt=${payload.attempt_id} questions=${payload.questions.length}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatusLine(message);
      onLog(`Quiz start failed: ${message}`);
    } finally {
      setLoading(false);
    }
  }, [
    accessSignature,
    base,
    language,
    onLog,
    sessionId,
    studentClass,
    studentElective,
    studentName,
  ]);

  const saveAnswer = useCallback(async () => {
    if (!currentQuestion) {
      return;
    }
    try {
      const selected = selectedByQuestion[currentQuestion.id] ?? [];
      const response = await fetch(`${base}/quiz/answer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessSignature}`,
        },
        body: JSON.stringify({
          session_id: sessionId,
          access_signature: accessSignature,
          question_id: currentQuestion.id,
          selected_option_ids: selected,
        }),
      });
      await parseJsonResponse(response);
      setStatusLine(
        tr(language, "Jawaban tersimpan ke backend.", "Answer saved to backend.")
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatusLine(message);
      onLog(`Save answer failed: ${message}`);
      throw error;
    }
  }, [accessSignature, base, currentQuestion, language, onLog, selectedByQuestion, sessionId]);

  const goNext = useCallback(async () => {
    if (!currentQuestion) {
      return;
    }
    setLoading(true);
    try {
      await saveAnswer();
      setCurrentIndex((prev) => Math.min(prev + 1, questions.length - 1));
    } finally {
      setLoading(false);
    }
  }, [currentQuestion, questions.length, saveAnswer]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const finishQuiz = useCallback(async () => {
    if (!attemptId) {
      return;
    }
    setLoading(true);
    try {
      if (currentQuestion) {
        await saveAnswer();
      }
      const response = await fetch(`${base}/quiz/finish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessSignature}`,
        },
        body: JSON.stringify({
          session_id: sessionId,
          access_signature: accessSignature,
        }),
      });
      const payload = (await parseJsonResponse(response)) as QuizFinishPayload;
      setFinished(payload);
      setResultDetailsOpen(false);
      activateKioskOverride();
      setStatusLine(
        tr(
          language,
          `Quiz selesai. Nilai: ${payload.score}/${payload.max_score}`,
          `Quiz finished. Score: ${payload.score}/${payload.max_score}`
        )
      );
      onLog(`Quiz finished: attempt=${attemptId} score=${payload.score}/${payload.max_score}`);
      void exportQuizResult(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatusLine(message);
      onLog(`Quiz finish failed: ${message}`);
    } finally {
      setLoading(false);
    }
  }, [
    accessSignature,
    attemptId,
    base,
    currentQuestion,
    exportQuizResult,
    language,
    onLog,
    saveAnswer,
    sessionId,
  ]);

  const toggleOption = useCallback(
    (optionId: number) => {
      if (!currentQuestion) {
        return;
      }
      const current = selectedByQuestion[currentQuestion.id] ?? [];
      let next: number[];
      const multiSelectQuestion =
        currentQuestion.question_type === "multi_choice" ||
        currentQuestion.question_type === "multiple_correct" ||
        currentQuestion.question_type === "matching";
      if (multiSelectQuestion) {
        next = current.includes(optionId)
          ? current.filter((value) => value !== optionId)
          : [...current, optionId];
      } else {
        next = [optionId];
      }
      setSelectedByQuestion((prev) => ({
        ...prev,
        [currentQuestion.id]: next,
      }));
    },
    [currentQuestion, selectedByQuestion]
  );

  return (
    <Layout
      title={quizMeta?.title || tr(language, "In-App Quiz", "In-App Quiz")}
      subtitle={
        quizMeta?.description ||
        tr(language, "Jawab semua soal lalu kirim hasil.", "Answer all questions then submit.")
      }
      footer={
        <View style={styles.footerWrap}>
          <TerminalButton
            label={tr(language, "Kembali", "Back")}
            variant="outline"
            onPress={onBack}
          />
        </View>
      }
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!questions.length && !finished ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>{tr(language, "Data Siswa", "Student Data")}</Text>
            <TerminalInput
              value={studentName}
              onChangeText={setStudentName}
              label={tr(language, "Nama Lengkap", "Full Name")}
              placeholder={tr(language, "Nama siswa", "Student name")}
              editable={allowProfileEdit}
            />
            <TerminalInput
              value={studentClass}
              onChangeText={setStudentClass}
              label={tr(language, "Kelas", "Class")}
              placeholder={tr(language, "Contoh: 9A", "Example: 9A")}
              editable={allowProfileEdit}
            />
            <TerminalInput
              value={studentElective}
              onChangeText={setStudentElective}
              label={tr(language, "Peminatan", "Elective")}
              placeholder={tr(language, "Contoh: IPA / IPS", "Example: Science / Social")}
              editable={allowProfileEdit}
            />
            <Text style={styles.statusText}>{statusLine}</Text>
            <TerminalButton
              label={tr(language, "Mulai Quiz", "Start Quiz")}
              onPress={() => void startQuiz()}
              disabled={loading}
            />
          </View>
        ) : null}

        {currentQuestion && !finished ? (
          <View style={styles.card}>
            <Text style={styles.progressText}>
              {tr(language, "Soal", "Question")} {currentIndex + 1}/{questions.length}
            </Text>
            <Text style={styles.questionText}>{currentQuestion.question_text}</Text>
            <View style={styles.optionsWrap}>
              {currentQuestion.options.map((option) => {
                const selected = currentSelected.includes(option.id);
                return (
                  <Pressable
                    key={option.id}
                    style={[styles.optionBtn, selected ? styles.optionBtnSelected : null]}
                    onPress={() => toggleOption(option.id)}
                  >
                    <Text style={[styles.optionText, selected ? styles.optionTextSelected : null]}>
                      {option.key}. {option.text}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.statusText}>{statusLine}</Text>
            <TerminalButton
              label={tr(language, "Simpan Jawaban", "Save Answer")}
              variant="outline"
              onPress={() => void saveAnswer()}
              disabled={loading}
            />
            <TerminalButton
              label={tr(language, "Soal Sebelumnya", "Previous Question")}
              variant="outline"
              onPress={goPrev}
              disabled={loading || currentIndex === 0}
            />
            <TerminalButton
              label={tr(language, "Soal Berikutnya", "Next Question")}
              variant="outline"
              onPress={() => void goNext()}
              disabled={loading || currentIndex >= questions.length - 1}
            />
            <TerminalButton
              label={tr(language, "Selesaikan Quiz", "Finish Quiz")}
              onPress={() => void finishQuiz()}
              disabled={loading}
            />
          </View>
        ) : null}

        {finished ? (
          <View style={styles.card}>
            <Text style={styles.resultLabel}>
              {tr(language, "Nilai Akhir", "Final Grade")}
            </Text>
            <View style={styles.resultHero}>
              <Text style={styles.resultScore}>{finished.score}</Text>
              <Text style={styles.resultScoreMax}>/{finished.max_score}</Text>
            </View>
            <Text style={styles.statusText}>
              {tr(language, "Durasi", "Duration")}: {finished.duration_seconds}s
            </Text>
            {finished.show_results_immediately && finished.result_items.length > 0 ? (
              <>
                <Pressable
                  style={styles.resultDropdown}
                  onPress={() => setResultDetailsOpen((prev) => !prev)}
                >
                  <Text style={styles.resultDropdownText}>
                    {resultDetailsOpen
                      ? tr(language, "Sembunyikan Jawaban", "Hide Answers")
                      : tr(language, "Lihat Jawaban", "Show Answers")}
                  </Text>
                  <Text style={styles.resultDropdownChevron}>
                    {resultDetailsOpen ? "^" : "v"}
                  </Text>
                </Pressable>
                {resultDetailsOpen ? (
                  finished.result_items.map((item) => (
                    <View key={item.question_id} style={styles.resultItem}>
                      <Text style={styles.resultQuestion}>{item.question_text}</Text>
                      <Text style={styles.resultMeta}>
                        {item.points_awarded}/{item.max_points} |{" "}
                        {item.is_correct ? "Correct" : "Incorrect"}
                      </Text>
                    </View>
                  ))
                ) : null}
              </>
            ) : (
              <Text style={styles.statusText}>
                {tr(
                  language,
                  "Detail hasil disembunyikan oleh pengaturan sesi.",
                  "Result details are hidden by session policy."
                )}
              </Text>
            )}
          </View>
        ) : null}
      </ScrollView>

      <IntegrityWarningModal
        visible={showIntegrityWarning}
        language={language}
        title={tr(language, "Peringatan Integritas", "Integrity Warning")}
        message={integrityMessage || tr(language, "Aktivitas mencurigakan terdeteksi.", "Suspicious activity detected.")}
        onDismiss={onDismissIntegrityWarning ?? (() => {})}
      />
    </Layout>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 20,
  },
  card: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    padding: 12,
    marginBottom: 10,
  },
  progressText: {
    color: "#6b7280",
    fontFamily: "Montserrat-Bold",
    fontSize: 10,
    marginBottom: 8,
  },
  questionText: {
    color: "#111827",
    fontFamily: "Montserrat-Bold",
    fontSize: 14,
    marginBottom: 8,
  },
  optionsWrap: {
    gap: 6,
    marginBottom: 8,
  },
  optionBtn: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    padding: 10,
    backgroundColor: "#f9fafb",
  },
  optionBtnSelected: {
    borderColor: "rgba(34,197,94,0.5)",
    backgroundColor: "rgba(34,197,94,0.12)",
  },
  optionText: {
    color: "#374151",
    fontFamily: "Montserrat-Regular",
    fontSize: 11,
  },
  optionTextSelected: {
    color: "#166534",
    fontFamily: "Montserrat-Bold",
  },
  statusText: {
    color: "#6b7280",
    fontFamily: "Montserrat-Regular",
    fontSize: 10,
    marginBottom: 8,
  },
  cardLabel: {
    color: "#111827",
    fontFamily: "Montserrat-Bold",
    fontSize: 11,
    marginBottom: 4,
  },
  resultLabel: {
    color: "#4b5563",
    fontFamily: "Montserrat-SemiBold",
    fontSize: 10,
    textAlign: "center",
    marginBottom: 6,
  },
  resultHero: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-end",
    gap: 6,
    marginBottom: 8,
  },
  resultScore: {
    color: "#111827",
    fontFamily: "Montserrat-Bold",
    fontSize: 46,
    letterSpacing: 1,
  },
  resultScoreMax: {
    color: "#9ca3af",
    fontFamily: "Montserrat-SemiBold",
    fontSize: 16,
    marginBottom: 6,
  },
  resultDropdown: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#f9fafb",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  resultDropdownText: {
    color: "#111827",
    fontFamily: "Montserrat-Bold",
    fontSize: 11,
  },
  resultDropdownChevron: {
    color: "#6b7280",
    fontFamily: "Montserrat-Bold",
    fontSize: 12,
  },
  resultItem: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 8,
    marginBottom: 6,
  },
  resultQuestion: {
    color: "#111827",
    fontFamily: "Montserrat-Bold",
    fontSize: 11,
    marginBottom: 2,
  },
  resultMeta: {
    color: "#6b7280",
    fontFamily: "Montserrat-Regular",
    fontSize: 10,
  },
  footerWrap: {
    gap: 0,
  },
});
