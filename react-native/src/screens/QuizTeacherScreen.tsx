import React, { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { AppLanguage, tr } from "../i18n";
import Layout, { TerminalButton, TerminalInput, palette } from "./Layout";
import { saveMarkdownToQuizResult, uploadMarkdownToDrive } from "../utils/quizResultExport";

type QuizTeacherScreenProps = {
  language: AppLanguage;
  backendBaseUrl: string;
  sessionId: string;
  accessSignature: string;
  onBack: () => void;
  onLog: (message: string) => void;
  onOpenQuestionBuilder?: () => void;
};

type QuizDefinition = {
  session_id: string;
  assigned_tokens?: string[];
  quiz: {
    title: string;
    description: string | null;
    duration_minutes: number;
    show_results_immediately: boolean;
    randomize_questions: boolean;
    allow_review: boolean;
    published: boolean;
  } | null;
  subjects: Array<{
    id: number;
    subject_code: string;
    subject_name: string;
    description: string | null;
    ordering: number;
    questions: Array<{
      id: number;
      question_text: string;
      question_type: string;
      points: number;
      ordering: number;
      options: Array<{ id: number; key: string; text: string; is_correct?: boolean }>;
    }>;
  }>;
};

type QuizResults = {
  results: Array<{
    token: string;
    device_name: string | null;
    status: string;
    score: number;
    max_score: number;
    submitted_at: string | null;
    duration_seconds: number;
    student_name?: string | null;
    student_class?: string | null;
    student_elective?: string | null;
  }>;
};

type QuizQuestionType =
  | "single_choice"
  | "multiple_correct"
  | "true_false"
  | "matching";

type MonitorPayload = {
  tokens?: Array<{
    token: string;
    role?: string | null;
  }>;
};

function normalizeBackendBaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, "");
}

function parseJsonResponse(response: any): Promise<any> {
  return response.json().catch(() => ({})).then((payload: any) => {
    if (!response.ok) {
      const message = typeof payload?.error === "string" ? payload.error : `HTTP ${response.status}`;
      throw new Error(message);
    }
    return payload;
  });
}

export default function QuizTeacherScreen({
  language,
  backendBaseUrl,
  sessionId,
  accessSignature,
  onBack,
  onLog,
  onOpenQuestionBuilder,
}: QuizTeacherScreenProps) {
  const [title, setTitle] = useState("Edufika In-App Quiz");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [showResultsImmediately, setShowResultsImmediately] = useState(true);
  const [randomizeQuestions, setRandomizeQuestions] = useState(false);
  const [allowReview, setAllowReview] = useState(true);
  const [subjectCode, setSubjectCode] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [subjectIdInput, setSubjectIdInput] = useState("");
  const [questionText, setQuestionText] = useState("");
  const [questionType, setQuestionType] = useState<QuizQuestionType>("single_choice");
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [optionC, setOptionC] = useState("");
  const [optionD, setOptionD] = useState("");
  const [optionE, setOptionE] = useState("");
  const [optionF, setOptionF] = useState("");
  const [correctOptionKey, setCorrectOptionKey] = useState("A");
  const [assignTokenInput, setAssignTokenInput] = useState("");
  const [studentTokens, setStudentTokens] = useState<string[]>([]);
  const [statusLine, setStatusLine] = useState("");
  const [loading, setLoading] = useState(false);
  const [definition, setDefinition] = useState<QuizDefinition | null>(null);
  const [results, setResults] = useState<QuizResults | null>(null);

  const base = useMemo(() => normalizeBackendBaseUrl(backendBaseUrl), [backendBaseUrl]);

  const authHeaders = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessSignature}`,
    }),
    [accessSignature]
  );

  const activeQuestionCount = useMemo(
    () =>
      (definition?.subjects ?? []).reduce(
        (total, subject) => total + (subject.questions?.length ?? 0),
        0
      ),
    [definition]
  );
  const questionSlotsLeft = Math.max(0, 40 - activeQuestionCount);

  const refreshData = useCallback(async () => {
    if (!base || !sessionId || !accessSignature) {
      return;
    }
    setLoading(true);
    try {
      const configRes = await fetch(
        `${base}/quiz/config?session_id=${encodeURIComponent(sessionId)}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${accessSignature}` },
        }
      );
      const configPayload = (await parseJsonResponse(configRes)) as QuizDefinition;
      setDefinition(configPayload);
      if (configPayload.quiz) {
        setTitle(configPayload.quiz.title);
        setDescription(configPayload.quiz.description ?? "");
        setDurationMinutes(String(configPayload.quiz.duration_minutes));
        setShowResultsImmediately(Boolean(configPayload.quiz.show_results_immediately));
        setRandomizeQuestions(Boolean(configPayload.quiz.randomize_questions));
        setAllowReview(Boolean(configPayload.quiz.allow_review));
      }

      const resultsRes = await fetch(
        `${base}/quiz/results?session_id=${encodeURIComponent(sessionId)}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${accessSignature}` },
        }
      );
      const resultsPayload = (await parseJsonResponse(resultsRes)) as QuizResults;
      setResults(resultsPayload);

      const monitorRes = await fetch(
        `${base}/admin/monitor?session_id=${encodeURIComponent(sessionId)}&access_signature=${encodeURIComponent(accessSignature)}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${accessSignature}` },
        }
      );
      const monitorPayload = (await parseJsonResponse(monitorRes)) as MonitorPayload;
      const tokens = Array.isArray(monitorPayload.tokens)
        ? monitorPayload.tokens
            .filter((item) => String(item.role ?? "").toLowerCase() === "student")
            .map((item) => String(item.token ?? "").trim().toUpperCase())
            .filter((token) => token.length > 0)
        : [];
      setStudentTokens(tokens);
      setStatusLine(
        tr(language, "Data kuis dimuat dari backend.", "Quiz data loaded from backend.")
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatusLine(message);
      onLog(`Quiz teacher refresh failed: ${message}`);
    } finally {
      setLoading(false);
    }
  }, [accessSignature, base, language, onLog, sessionId]);

  const saveConfig = useCallback(async () => {
    if (!base || !sessionId || !accessSignature) {
      setStatusLine(tr(language, "Backend belum terhubung.", "Backend is not connected."));
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${base}/quiz/config`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          session_id: sessionId,
          access_signature: accessSignature,
          title: title.trim(),
          description: description.trim() || undefined,
          duration_minutes: Math.max(1, Number.parseInt(durationMinutes, 10) || 60),
          show_results_immediately: showResultsImmediately,
          randomize_questions: randomizeQuestions,
          allow_review: allowReview,
        }),
      });
      await parseJsonResponse(response);
      setStatusLine(tr(language, "Konfigurasi kuis tersimpan.", "Quiz config saved."));
      onLog(`Quiz config saved for session ${sessionId}`);
      await refreshData();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatusLine(message);
      onLog(`Quiz config save failed: ${message}`);
    } finally {
      setLoading(false);
    }
  }, [
    accessSignature,
    allowReview,
    authHeaders,
    base,
    description,
    durationMinutes,
    language,
    onLog,
    randomizeQuestions,
    refreshData,
    sessionId,
    showResultsImmediately,
    title,
  ]);

  const addSubject = useCallback(async () => {
    if (!subjectCode.trim() || !subjectName.trim()) {
      setStatusLine(
        tr(
          language,
          "Isi kode dan nama subject terlebih dahulu.",
          "Fill subject code and name first."
        )
      );
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${base}/quiz/subject`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          session_id: sessionId,
          access_signature: accessSignature,
          subject_code: subjectCode.trim().toUpperCase(),
          subject_name: subjectName.trim(),
        }),
      });
      const payload = await parseJsonResponse(response);
      setStatusLine(
        tr(
          language,
          `Subject tersimpan. ID=${payload.id}`,
          `Subject saved. ID=${payload.id}`
        )
      );
      setSubjectIdInput(String(payload.id));
      onLog(`Quiz subject upserted: ${subjectCode.trim().toUpperCase()} (${subjectName.trim()})`);
      await refreshData();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatusLine(message);
      onLog(`Quiz add subject failed: ${message}`);
    } finally {
      setLoading(false);
    }
  }, [
    accessSignature,
    authHeaders,
    base,
    language,
    onLog,
    refreshData,
    sessionId,
    subjectCode,
    subjectName,
  ]);

  const addQuestion = useCallback(async () => {
    if (questionSlotsLeft <= 0) {
      setStatusLine(
        tr(
          language,
          "Batas maksimum 40 soal per sesi sudah tercapai.",
          "Maximum 40 questions per session has been reached."
        )
      );
      return;
    }
    const subjectId = Number.parseInt(subjectIdInput, 10);
    if (!Number.isFinite(subjectId) || subjectId <= 0) {
      setStatusLine(tr(language, "Subject ID tidak valid.", "Subject ID is invalid."));
      return;
    }
    if (!questionText.trim()) {
      setStatusLine(
        tr(
          language,
          "Pertanyaan wajib diisi sebelum menyimpan.",
          "Question text is required before saving."
        )
      );
      return;
    }
    if (questionType !== "true_false" && (!optionA.trim() || !optionB.trim())) {
      setStatusLine(
        tr(
          language,
          "Isi pertanyaan dan minimal opsi A/B.",
          "Fill question text and at least option A/B."
        )
      );
      return;
    }
    setLoading(true);
    try {
      const normalizedCorrectKeys = correctOptionKey
        .split(",")
        .map((value) => value.trim().toUpperCase())
        .filter((value) => value.length > 0);

      const options =
        questionType === "true_false"
          ? [
              {
                key: "TRUE",
                text: "True",
                is_correct: normalizedCorrectKeys.includes("TRUE") || normalizedCorrectKeys.includes("T"),
              },
              {
                key: "FALSE",
                text: "False",
                is_correct: normalizedCorrectKeys.includes("FALSE") || normalizedCorrectKeys.includes("F"),
              },
            ]
          : [
              { key: "A", text: optionA.trim(), is_correct: normalizedCorrectKeys.includes("A") },
              { key: "B", text: optionB.trim(), is_correct: normalizedCorrectKeys.includes("B") },
              ...(optionC.trim()
                ? [{ key: "C", text: optionC.trim(), is_correct: normalizedCorrectKeys.includes("C") }]
                : []),
              ...(optionD.trim()
                ? [{ key: "D", text: optionD.trim(), is_correct: normalizedCorrectKeys.includes("D") }]
                : []),
              ...(optionE.trim()
                ? [{ key: "E", text: optionE.trim(), is_correct: normalizedCorrectKeys.includes("E") }]
                : []),
              ...(optionF.trim()
                ? [{ key: "F", text: optionF.trim(), is_correct: normalizedCorrectKeys.includes("F") }]
                : []),
            ];

      const response = await fetch(`${base}/quiz/question`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          session_id: sessionId,
          access_signature: accessSignature,
          subject_id: subjectId,
          question_text: questionText.trim(),
          question_type: questionType,
          points: 1,
          options,
        }),
      });
      const payload = await parseJsonResponse(response);
      setStatusLine(
        tr(
          language,
          `Pertanyaan tersimpan. ID=${payload.question_id}`,
          `Question saved. ID=${payload.question_id}`
        )
      );
      onLog(`Quiz question created: id=${payload.question_id} subject=${subjectId}`);
      setQuestionText("");
      setOptionA("");
      setOptionB("");
      setOptionC("");
      setOptionD("");
      setOptionE("");
      setOptionF("");
      setCorrectOptionKey("A");
      await refreshData();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatusLine(message);
      onLog(`Quiz add question failed: ${message}`);
    } finally {
      setLoading(false);
    }
  }, [
    accessSignature,
    authHeaders,
    base,
    correctOptionKey,
    language,
    onLog,
    optionA,
    optionB,
    optionC,
    optionD,
    optionE,
    optionF,
    questionType,
    questionSlotsLeft,
    questionText,
    refreshData,
    sessionId,
    subjectIdInput,
  ]);

  const publishQuiz = useCallback(
    async (published: boolean) => {
      setLoading(true);
      try {
        const response = await fetch(`${base}/quiz/publish`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            session_id: sessionId,
            access_signature: accessSignature,
            published,
          }),
        });
        await parseJsonResponse(response);
        setStatusLine(
          published
            ? tr(language, "Kuis dipublikasikan.", "Quiz published.")
            : tr(language, "Kuis di-unpublish.", "Quiz unpublished.")
        );
        onLog(`Quiz publish changed: ${published}`);
        await refreshData();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setStatusLine(message);
        onLog(`Quiz publish update failed: ${message}`);
      } finally {
        setLoading(false);
      }
    },
    [accessSignature, authHeaders, base, language, onLog, refreshData, sessionId]
  );

  const setQuizAssignment = useCallback(
    async (studentToken: string, assigned: boolean) => {
      const normalizedToken = studentToken.trim().toUpperCase();
      if (!normalizedToken) {
        setStatusLine(
          tr(
            language,
            "Token siswa wajib diisi untuk assignment kuis.",
            "Student token is required for quiz assignment."
          )
        );
        return;
      }
      setLoading(true);
      try {
        const response = await fetch(`${base}/quiz/assign-token`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            session_id: sessionId,
            access_signature: accessSignature,
            student_token: normalizedToken,
            assigned,
          }),
        });
        const payload = await parseJsonResponse(response);
        const assignedTokens = Array.isArray(payload.assigned_tokens)
          ? payload.assigned_tokens.map((value: unknown) => String(value).trim().toUpperCase())
          : [];
        setDefinition((prev) =>
          prev
            ? {
                ...prev,
                assigned_tokens: assignedTokens,
              }
            : prev
        );
        setStatusLine(
          assigned
            ? tr(language, `Token ${normalizedToken} di-assign ke kuis.`, `Token ${normalizedToken} assigned to quiz.`)
            : tr(
                language,
                `Token ${normalizedToken} dilepas dari assignment kuis.`,
                `Token ${normalizedToken} removed from quiz assignment.`
              )
        );
        onLog(`Quiz token assignment updated: token=${normalizedToken} assigned=${assigned}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setStatusLine(message);
        onLog(`Quiz token assignment failed: ${message}`);
      } finally {
        setLoading(false);
      }
    },
    [accessSignature, authHeaders, base, language, onLog, sessionId]
  );

  const exportResults = useCallback(async () => {
    if (!results?.results || results.results.length === 0) {
      setStatusLine(tr(language, "Belum ada hasil siswa.", "No student results yet."));
      return;
    }
    const lines = [
      "# Quiz Results Summary",
      "",
      `- Session ID: ${sessionId}`,
      `- Generated At: ${new Date().toISOString()}`,
      "",
      "## Student Results",
      "",
      ...results.results.map((row, index) => {
        const name = row.student_name || "-";
        const studentClass = row.student_class || "-";
        const elective = row.student_elective || "-";
        return `${index + 1}. ${row.token} | ${name} | ${studentClass} | ${elective} | ${row.score}/${row.max_score} | ${row.status}`;
      }),
      "",
    ];
    const markdown = lines.join("\n");
    const fileNameBase = `quiz_results_${sessionId}_${Date.now()}`;
    let savedResult: Awaited<ReturnType<typeof saveMarkdownToQuizResult>> | null = null;
    try {
      savedResult = await saveMarkdownToQuizResult(markdown, fileNameBase);
      onLog(`Quiz results saved: ${savedResult.path}`);
      setStatusLine(tr(language, `Hasil disimpan: ${savedResult.fileName}`, `Results saved: ${savedResult.fileName}`));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatusLine(message);
      onLog(`Quiz results save failed: ${message}`);
    }
    try {
      await uploadMarkdownToDrive({
        backendBaseUrl,
        sessionId,
        accessSignature,
        fileName: `${fileNameBase}.md`,
        markdown,
        metadata: {
          type: "teacher_results",
          result_count: results.results.length,
        },
      });
      setStatusLine(tr(language, "Hasil terkirim ke Google Drive.", "Results uploaded to Google Drive."));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!savedResult) {
        try {
          savedResult = await saveMarkdownToQuizResult(markdown, fileNameBase);
          onLog(`Quiz results saved after upload failure: ${savedResult.path}`);
        } catch (saveError) {
          const saveMessage = saveError instanceof Error ? saveError.message : String(saveError);
          onLog(`Quiz results fallback save failed: ${saveMessage}`);
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
        setStatusLine(tr(language, `Upload Drive gagal: ${message}`, `Drive upload failed: ${message}`));
      }
    }
  }, [accessSignature, backendBaseUrl, language, onLog, results, sessionId]);

  return (
    <Layout
      title={tr(language, "In-App Quiz Builder", "In-App Quiz Builder")}
      subtitle={tr(
        language,
        "Buat subject, soal, publish kuis, dan pantau hasil siswa.",
        "Create subjects, questions, publish quiz, and monitor student results."
      )}
      footer={
        <View style={styles.footerWrap}>
          <TerminalButton
            label={tr(language, "Refresh", "Refresh")}
            variant="outline"
            onPress={() => void refreshData()}
          />
          <TerminalButton
            label={tr(language, "Kembali", "Back")}
            variant="outline"
            onPress={onBack}
          />
        </View>
      }
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{tr(language, "Quiz Config", "Quiz Config")}</Text>
          <TerminalInput
            value={title}
            onChangeText={setTitle}
            label={tr(language, "Judul Quiz", "Quiz Title")}
            placeholder="Edufika Mid Test"
          />
          <TerminalInput
            value={description}
            onChangeText={setDescription}
            label={tr(language, "Deskripsi", "Description")}
            placeholder="Matematika kelas 9"
          />
          <TerminalInput
            value={durationMinutes}
            onChangeText={setDurationMinutes}
            label={tr(language, "Durasi (Menit)", "Duration (Minutes)")}
            placeholder="60"
            keyboardType="number-pad"
          />
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>
              {tr(language, "Tampilkan hasil langsung", "Show results immediately")}
            </Text>
            <Switch value={showResultsImmediately} onValueChange={setShowResultsImmediately} />
          </View>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>{tr(language, "Acak pertanyaan", "Randomize questions")}</Text>
            <Switch value={randomizeQuestions} onValueChange={setRandomizeQuestions} />
          </View>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>{tr(language, "Izinkan review", "Allow review")}</Text>
            <Switch value={allowReview} onValueChange={setAllowReview} />
          </View>
          <TerminalButton
            label={tr(language, "Simpan Konfigurasi", "Save Config")}
            onPress={() => void saveConfig()}
            disabled={loading}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{tr(language, "Tambah Subject", "Add Subject")}</Text>
          <TerminalInput
            value={subjectCode}
            onChangeText={setSubjectCode}
            label={tr(language, "Kode Subject", "Subject Code")}
            placeholder="MTK"
            autoCapitalize="characters"
          />
          <TerminalInput
            value={subjectName}
            onChangeText={setSubjectName}
            label={tr(language, "Nama Subject", "Subject Name")}
            placeholder="Matematika"
          />
          <TerminalButton
            label={tr(language, "Simpan Subject", "Save Subject")}
            variant="outline"
            onPress={() => void addSubject()}
            disabled={loading}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{tr(language, "Tambah Soal", "Add Question")}</Text>
          <Text style={styles.statusText}>
            {tr(language, "Total soal aktif", "Active questions")}: {activeQuestionCount}/40 (
            {tr(language, "sisa", "left")} {questionSlotsLeft})
          </Text>
          {onOpenQuestionBuilder ? (
            <TerminalButton
              label={tr(
                language,
                "Buka Builder Soal Dinamis",
                "Open Dynamic Question Builder"
              )}
              variant="outline"
              onPress={onOpenQuestionBuilder}
              disabled={loading}
            />
          ) : null}
          <TerminalInput
            value={subjectIdInput}
            onChangeText={setSubjectIdInput}
            label={tr(language, "Subject ID", "Subject ID")}
            placeholder="1"
            keyboardType="number-pad"
          />
          <Text style={styles.modeLabel}>{tr(language, "Tipe Soal", "Question Type")}</Text>
          <View style={styles.modeRow}>
            {([
              ["single_choice", tr(language, "Pilihan Tunggal", "Single Choice")],
              ["multiple_correct", tr(language, "Pilihan Banyak", "Multiple Correct")],
              ["true_false", tr(language, "Benar/Salah", "True/False")],
              ["matching", tr(language, "Matching", "Matching")],
            ] as Array<[QuizQuestionType, string]>).map(([typeValue, label]) => {
              const active = questionType === typeValue;
              return (
                <Pressable
                  key={typeValue}
                  style={[styles.modeBtn, active ? styles.modeBtnActive : null]}
                  onPress={() => setQuestionType(typeValue)}
                >
                  <Text style={[styles.modeBtnText, active ? styles.modeBtnTextActive : null]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
          <TerminalInput
            value={questionText}
            onChangeText={setQuestionText}
            label={tr(language, "Pertanyaan", "Question")}
            placeholder="2 + 2 = ?"
          />
          {questionType !== "true_false" ? (
            <>
              <TerminalInput value={optionA} onChangeText={setOptionA} label="Option A" placeholder="4" />
              <TerminalInput value={optionB} onChangeText={setOptionB} label="Option B" placeholder="5" />
              <TerminalInput value={optionC} onChangeText={setOptionC} label="Option C" placeholder="6" />
              <TerminalInput value={optionD} onChangeText={setOptionD} label="Option D" placeholder="7" />
              <TerminalInput value={optionE} onChangeText={setOptionE} label="Option E" placeholder="8" />
              <TerminalInput value={optionF} onChangeText={setOptionF} label="Option F" placeholder="9" />
            </>
          ) : null}
          <TerminalInput
            value={correctOptionKey}
            onChangeText={setCorrectOptionKey}
            label={
              questionType === "true_false"
                ? tr(language, "Kunci (TRUE/FALSE)", "Correct Key (TRUE/FALSE)")
                : tr(
                    language,
                    "Kunci (A,B,...) untuk multi-kunci pisahkan koma",
                    "Correct key (A,B,...) for multi-correct use commas"
                  )
            }
            placeholder={questionType === "true_false" ? "TRUE" : "A"}
            autoCapitalize="characters"
          />
          <TerminalButton
            label={tr(language, "Simpan Soal", "Save Question")}
            variant="outline"
            onPress={() => void addQuestion()}
            disabled={loading}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{tr(language, "Assign Quiz ke Token", "Assign Quiz to Token")}</Text>
          <TerminalInput
            value={assignTokenInput}
            onChangeText={setAssignTokenInput}
            label={tr(language, "Token Siswa", "Student Token")}
            placeholder="S-XXXXXXXXXX"
            autoCapitalize="characters"
          />
          <TerminalButton
            label={tr(language, "Assign ke Token", "Assign to Token")}
            variant="outline"
            onPress={() => void setQuizAssignment(assignTokenInput, true)}
            disabled={loading}
          />
          <TerminalButton
            label={tr(language, "Lepas Assignment Token", "Remove Token Assignment")}
            variant="outline"
            onPress={() => void setQuizAssignment(assignTokenInput, false)}
            disabled={loading}
          />
          <Text style={styles.statusText}>
            {tr(language, "Token siswa tersedia", "Available student tokens")}: {studentTokens.length}
          </Text>
          {studentTokens.length > 0 ? (
            studentTokens.map((token) => {
              const assigned = (definition?.assigned_tokens ?? []).includes(token);
              return (
                <View key={token} style={styles.resultRow}>
                  <Text style={styles.resultToken}>{token}</Text>
                  <Text style={styles.resultMeta}>
                    {assigned
                      ? tr(language, "Assigned ke kuis", "Assigned to quiz")
                      : tr(language, "Belum assigned", "Not assigned")}
                  </Text>
                  <View style={styles.inlineActions}>
                    <TerminalButton
                      label={tr(language, "Assign", "Assign")}
                      variant="outline"
                      onPress={() => void setQuizAssignment(token, true)}
                      disabled={loading}
                    />
                    <TerminalButton
                      label={tr(language, "Lepas", "Remove")}
                      variant="outline"
                      onPress={() => void setQuizAssignment(token, false)}
                      disabled={loading}
                    />
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={styles.emptyText}>
              {tr(
                language,
                "Belum ada token siswa yang terdeteksi di sesi ini.",
                "No student tokens detected in this session yet."
              )}
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{tr(language, "Publish State", "Publish State")}</Text>
          <TerminalButton
            label={tr(language, "Publish Quiz", "Publish Quiz")}
            onPress={() => void publishQuiz(true)}
            disabled={loading}
          />
          <TerminalButton
            label={tr(language, "Unpublish Quiz", "Unpublish Quiz")}
            variant="outline"
            onPress={() => void publishQuiz(false)}
            disabled={loading}
          />
          <Text style={styles.statusText}>{statusLine || "-"}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{tr(language, "Struktur Quiz", "Quiz Structure")}</Text>
          {definition?.subjects?.length ? (
            definition.subjects.map((subject) => (
              <View key={`${subject.id}-${subject.subject_code}`} style={styles.subjectBlock}>
                <Text style={styles.subjectTitle}>
                  #{subject.id} {subject.subject_code} - {subject.subject_name}
                </Text>
                <Text style={styles.subjectMeta}>
                  {tr(language, "Jumlah soal", "Questions")}: {subject.questions.length}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>{tr(language, "Belum ada subject/soal.", "No subjects/questions yet.")}</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{tr(language, "Hasil Siswa", "Student Results")}</Text>
          <TerminalButton
            label={tr(language, "Export Hasil (Drive)", "Export Results (Drive)")}
            variant="outline"
            onPress={() => void exportResults()}
            disabled={loading || !results?.results?.length}
          />
          {results?.results?.length ? (
            results.results.map((row) => (
              <View key={`${row.token}-${row.submitted_at ?? "pending"}`} style={styles.resultRow}>
                <Text style={styles.resultToken}>{row.token}</Text>
                <Text style={styles.resultMeta}>
                  {row.status} | {row.score}/{row.max_score} | {row.device_name || "-"}
                </Text>
                <Text style={styles.resultMeta}>
                  {tr(language, "Nama", "Name")}: {row.student_name || "-"} |{" "}
                  {tr(language, "Kelas", "Class")}: {row.student_class || "-"} |{" "}
                  {tr(language, "Peminatan", "Elective")}: {row.student_elective || "-"}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>{tr(language, "Belum ada hasil siswa.", "No student results yet.")}</Text>
          )}
        </View>
      </ScrollView>
    </Layout>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 20,
    gap: 10,
  },
  card: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    padding: 12,
  },
  cardTitle: {
    color: "#111827",
    fontFamily: "Montserrat-Bold",
    fontSize: 12,
    marginBottom: 8,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  switchLabel: {
    color: "#4b5563",
    fontFamily: "Montserrat-Regular",
    fontSize: 10,
  },
  modeLabel: {
    color: "#4b5563",
    fontFamily: "Montserrat-SemiBold",
    fontSize: 10,
    marginBottom: 6,
    marginTop: 6,
  },
  modeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  modeBtn: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  modeBtnActive: {
    borderColor: "rgba(34,197,94,0.55)",
    backgroundColor: "rgba(34,197,94,0.14)",
  },
  modeBtnText: {
    color: "#6b7280",
    fontFamily: "Montserrat-SemiBold",
    fontSize: 9,
  },
  modeBtnTextActive: {
    color: "#166534",
    fontFamily: "Montserrat-Bold",
  },
  statusText: {
    color: "#4b5563",
    fontFamily: "Montserrat-Regular",
    fontSize: 10,
    marginTop: 8,
  },
  emptyText: {
    color: "#9ca3af",
    fontFamily: "Montserrat-Regular",
    fontSize: 10,
  },
  subjectBlock: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 8,
    marginBottom: 6,
  },
  subjectTitle: {
    color: "#111827",
    fontFamily: "Montserrat-Bold",
    fontSize: 11,
    marginBottom: 3,
  },
  subjectMeta: {
    color: "#6b7280",
    fontFamily: "Montserrat-Regular",
    fontSize: 10,
  },
  resultRow: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 8,
    marginBottom: 6,
  },
  resultToken: {
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
  inlineActions: {
    flexDirection: "row",
    gap: 6,
    marginTop: 6,
  },
  footerWrap: {
    gap: 0,
  },
});
