import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from "react-native";
import { AppLanguage, tr } from "../i18n";
import Layout, { TerminalButton, TerminalInput, palette } from "./Layout";
import { saveMarkdownToQuizResult, uploadMarkdownToDrive } from "../utils/quizResultExport";

type QuizQuestionBuilderScreenProps = {
  language: AppLanguage;
  backendBaseUrl: string;
  sessionId: string;
  accessSignature: string;
  onBack: () => void;
  onLog: (message: string) => void;
  cache?: QuizQuestionBuilderCache;
  onCacheChange?: (cache: QuizQuestionBuilderCache) => void;
};

type QuizQuestionType = "single_choice" | "multiple_correct" | "true_false" | "matching";
type QuizQuestionTypeSelection = QuizQuestionType | "";

export type QuestionDraft = {
  id: number;
  questionText: string;
  questionType: QuizQuestionTypeSelection;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctKeys: string;
  points: string;
};

export type QuizQuestionBuilderCache = {
  subjectIdInput: string;
  questionCountInput: string;
  questionDrafts: QuestionDraft[];
  assignTokenInput: string;
};

type QuizConfigPayload = {
  quiz?: {
    published?: boolean;
    title?: string;
  };
  assigned_tokens?: string[];
  subjects?: Array<{
    id?: number;
    subject_code?: string;
    subject_name?: string;
    description?: string | null;
    ordering?: number;
    questions?: Array<unknown>;
  }>;
};

type MonitorPayload = {
  tokens?: Array<{ token?: string | null; role?: string | null }>;
};

type SavedQuizItem = {
  id: number;
  subjectCode: string;
  subjectName: string;
  description: string | null;
  ordering: number;
  questionCount: number;
};

const QUESTION_TYPE_OPTIONS: Array<{ value: QuizQuestionType; labelId: string; labelEn: string }> = [
  { value: "single_choice", labelId: "Pilihan Tunggal", labelEn: "Single Choice" },
  { value: "multiple_correct", labelId: "Pilihan Banyak", labelEn: "Multiple Correct" },
  { value: "true_false", labelId: "Benar/Salah", labelEn: "True/False" },
  { value: "matching", labelId: "Matching", labelEn: "Matching" },
];

function normalizeBackendBaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, "");
}

function parseJsonResponse(response: Response): Promise<any> {
  return response
    .json()
    .catch(() => ({}))
    .then((payload: any) => {
      if (!response.ok) {
        const message = typeof payload?.error === "string" ? payload.error : `HTTP ${response.status}`;
        throw new Error(message);
      }
      return payload;
    });
}

function getQuestionTypeLabel(language: AppLanguage, type: QuizQuestionTypeSelection): string {
  if (!type) {
    return tr(language, "Pilih tipe soal", "Select question type");
  }
  const found = QUESTION_TYPE_OPTIONS.find((item) => item.value === type);
  if (!found) {
    return type;
  }
  return tr(language, found.labelId, found.labelEn);
}

function areStringArraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
}

function areSavedQuizzesEqual(left: SavedQuizItem[], right: SavedQuizItem[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index];
    const b = right[index];
    if (
      a.id !== b.id ||
      a.subjectCode !== b.subjectCode ||
      a.subjectName !== b.subjectName ||
      a.description !== b.description ||
      a.ordering !== b.ordering ||
      a.questionCount !== b.questionCount
    ) {
      return false;
    }
  }
  return true;
}

function createDraft(seed: number): QuestionDraft {
  return {
    id: seed,
    questionText: "",
    questionType: "",
    optionA: "",
    optionB: "",
    optionC: "",
    optionD: "",
    correctKeys: "",
    points: "1",
  };
}

type QuestionDraftCardProps = {
  language: AppLanguage;
  draft: QuestionDraft;
  index: number;
  isExpanded: boolean;
  isTypeMenuOpen: boolean;
  onToggleExpanded: (id: number) => void;
  onToggleTypeMenu: (id: number) => void;
  onSelectType: (index: number, id: number, value: QuizQuestionType) => void;
  onUpdateDraft: (index: number, patch: Partial<QuestionDraft>) => void;
};

const QuestionDraftCard = memo(function QuestionDraftCard({
  language,
  draft,
  index,
  isExpanded,
  isTypeMenuOpen,
  onToggleExpanded,
  onToggleTypeMenu,
  onSelectType,
  onUpdateDraft,
}: QuestionDraftCardProps) {
  const questionPreview = draft.questionText.trim()
    ? draft.questionText.trim()
    : tr(language, "Belum ada pertanyaan", "No question yet");

  return (
    <View style={styles.draftCard}>
      <Pressable style={styles.draftHeader} onPress={() => onToggleExpanded(draft.id)}>
        <View style={styles.draftHeaderTextWrap}>
          <Text style={styles.draftTitle}>
            {tr(language, "Soal", "Question")} #{index + 1}
          </Text>
          <Text style={styles.draftSubtitle} numberOfLines={1}>
            {questionPreview}
          </Text>
        </View>
        <View style={styles.badgesWrap}>
          <Text style={styles.typeBadge}>{getQuestionTypeLabel(language, draft.questionType)}</Text>
          <Text style={styles.chevron}>{isExpanded ? "^" : "v"}</Text>
        </View>
      </Pressable>

      {isExpanded ? (
        <View style={styles.draftBody}>
          <Text style={styles.modeLabel}>{tr(language, "Tipe Soal", "Question Type")}</Text>
          <Pressable style={styles.dropdownTrigger} onPress={() => onToggleTypeMenu(draft.id)}>
            <Text style={styles.dropdownTriggerText}>{getQuestionTypeLabel(language, draft.questionType)}</Text>
            <Text style={styles.chevron}>{isTypeMenuOpen ? "^" : "v"}</Text>
          </Pressable>

          {isTypeMenuOpen ? (
            <View style={styles.dropdownMenu}>
              {QUESTION_TYPE_OPTIONS.map((option) => {
                const active = draft.questionType === option.value;
                return (
                  <Pressable
                    key={`${draft.id}-${option.value}`}
                    style={[styles.dropdownItem, active ? styles.dropdownItemActive : null]}
                    onPress={() => onSelectType(index, draft.id, option.value)}
                  >
                    <Text style={[styles.dropdownItemText, active ? styles.dropdownItemTextActive : null]}>
                      {tr(language, option.labelId, option.labelEn)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {!draft.questionType ? (
            <Text style={styles.helperText}>
              {tr(
                language,
                "Pilih tipe soal dulu untuk membuka input pertanyaan.",
                "Pick a question type first to open the question inputs."
              )}
            </Text>
          ) : (
            <>
              <TerminalInput
                value={draft.questionText}
                onChangeText={(value) => onUpdateDraft(index, { questionText: value })}
                label={tr(language, "Pertanyaan", "Question")}
                placeholder="2 + 2 = ?"
              />
              <TerminalInput
                value={draft.points}
                onChangeText={(value) => onUpdateDraft(index, { points: value })}
                label={tr(language, "Poin Jawaban Benar", "Points for Correct Answer")}
                placeholder="1"
                keyboardType="number-pad"
              />

              {draft.questionType !== "true_false" ? (
                <>
                  <TerminalInput value={draft.optionA} onChangeText={(value) => onUpdateDraft(index, { optionA: value })} label="Option A" placeholder="A" />
                  <TerminalInput value={draft.optionB} onChangeText={(value) => onUpdateDraft(index, { optionB: value })} label="Option B" placeholder="B" />
                  <TerminalInput value={draft.optionC} onChangeText={(value) => onUpdateDraft(index, { optionC: value })} label="Option C" placeholder="C" />
                  <TerminalInput value={draft.optionD} onChangeText={(value) => onUpdateDraft(index, { optionD: value })} label="Option D" placeholder="D" />
                </>
              ) : null}

              <TerminalInput
                value={draft.correctKeys}
                onChangeText={(value) => onUpdateDraft(index, { correctKeys: value })}
                label={
                  draft.questionType === "true_false"
                    ? tr(language, "Kunci (TRUE/FALSE)", "Correct Key (TRUE/FALSE)")
                    : tr(
                        language,
                        "Kunci (A,B,...) untuk multi-kunci pisahkan koma",
                        "Correct key (A,B,...) for multi-correct use commas"
                      )
                }
                placeholder={
                  draft.questionType === "true_false"
                    ? "TRUE"
                    : draft.questionType === "multiple_correct"
                      ? "A,B"
                      : "A"
                }
                autoCapitalize="characters"
              />
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}, (prev, next) => prev.language === next.language && prev.index === next.index && prev.draft === next.draft && prev.isExpanded === next.isExpanded && prev.isTypeMenuOpen === next.isTypeMenuOpen);

export default function QuizQuestionBuilderScreen({
  language,
  backendBaseUrl,
  sessionId,
  accessSignature,
  onBack,
  onLog,
  cache,
  onCacheChange,
}: QuizQuestionBuilderScreenProps) {
  const [subjectIdInput, setSubjectIdInput] = useState(() => cache?.subjectIdInput ?? "");
  const [questionCountInput, setQuestionCountInput] = useState(() => cache?.questionCountInput ?? "1");
  const [questionDrafts, setQuestionDrafts] = useState<QuestionDraft[]>(() => cache?.questionDrafts ?? []);
  const [statusLine, setStatusLine] = useState("");
  const [loading, setLoading] = useState(false);
  const [studentTokens, setStudentTokens] = useState<string[]>([]);
  const [assignedTokens, setAssignedTokens] = useState<string[]>([]);
  const [savedQuizzes, setSavedQuizzes] = useState<SavedQuizItem[]>([]);
  const [assignTokenInput, setAssignTokenInput] = useState(() => cache?.assignTokenInput ?? "");
  const [activeQuestionCount, setActiveQuestionCount] = useState(0);
  const [expandedDraftId, setExpandedDraftId] = useState<number | null>(null);
  const [openTypeMenuId, setOpenTypeMenuId] = useState<number | null>(null);
  const [deletingQuizId, setDeletingQuizId] = useState<number | null>(null);

  const base = useMemo(() => normalizeBackendBaseUrl(backendBaseUrl), [backendBaseUrl]);
  const questionSlotsLeft = Math.max(0, 40 - activeQuestionCount);
  const selectedQuizId = useMemo(() => {
    const parsed = Number.parseInt(subjectIdInput, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [subjectIdInput]);
  const selectedQuiz = useMemo(
    () => (selectedQuizId ? savedQuizzes.find((quiz) => quiz.id === selectedQuizId) ?? null : null),
    [savedQuizzes, selectedQuizId]
  );
  const hasSelectedQuiz = Boolean(selectedQuiz);

  const authHeaders = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessSignature}`,
    }),
    [accessSignature]
  );

  useEffect(() => {
    if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    if (!onCacheChange) {
      return;
    }
    onCacheChange({
      subjectIdInput,
      questionCountInput,
      questionDrafts,
      assignTokenInput,
    });
  }, [assignTokenInput, onCacheChange, questionCountInput, questionDrafts, subjectIdInput]);

  const animateLayout = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, []);

  const refreshContext = useCallback(async (silent = false) => {
    if (!base || !sessionId || !accessSignature) {
      return;
    }
    if (!silent) {
      setLoading(true);
    }
    try {
      const configRes = await fetch(`${base}/quiz/config?session_id=${encodeURIComponent(sessionId)}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${accessSignature}` },
      });
      const configPayload = (await parseJsonResponse(configRes)) as QuizConfigPayload;
      const normalizedSubjects = Array.isArray(configPayload.subjects)
        ? configPayload.subjects
            .map((subject, index) => {
              const subjectId = Number(subject?.id ?? 0);
              const questionCount = Array.isArray(subject?.questions) ? subject.questions.length : 0;
              if (!Number.isFinite(subjectId) || subjectId <= 0) {
                return null;
              }
              return {
                id: subjectId,
                subjectCode: String(subject?.subject_code ?? `SUB-${index + 1}`).trim() || `SUB-${index + 1}`,
                subjectName:
                  String(subject?.subject_name ?? "").trim() ||
                  tr(language, "Kuis Tanpa Nama", "Untitled Quiz"),
                description: subject?.description ? String(subject.description).trim() : null,
                ordering: Number(subject?.ordering ?? index + 1),
                questionCount,
              } as SavedQuizItem;
            })
            .filter((item): item is SavedQuizItem => item !== null)
            .sort((a, b) => (a.ordering === b.ordering ? a.id - b.id : a.ordering - b.ordering))
        : [];
      setSavedQuizzes((prev) => (areSavedQuizzesEqual(prev, normalizedSubjects) ? prev : normalizedSubjects));

      const questionCount = normalizedSubjects.reduce((total, subject) => total + subject.questionCount, 0);
      setActiveQuestionCount((prev) => (prev === questionCount ? prev : questionCount));
      const assigned = Array.isArray(configPayload.assigned_tokens)
        ? configPayload.assigned_tokens.map((token) => String(token).trim().toUpperCase()).filter(Boolean)
        : [];
      setAssignedTokens((prev) => (areStringArraysEqual(prev, assigned) ? prev : assigned));

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
      setStudentTokens((prev) => (areStringArraysEqual(prev, tokens) ? prev : tokens));
      if (!silent) {
        setStatusLine(tr(language, "Builder kuis tersinkron dari backend.", "Quiz builder synced from backend."));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onLog(`Quiz question builder refresh failed: ${message}`);
      if (!silent) {
        setStatusLine(message);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [accessSignature, base, language, onLog, sessionId]);

  useEffect(() => {
    void refreshContext();
  }, [refreshContext]);

  useEffect(() => {
    if (!base || !sessionId || !accessSignature) {
      return;
    }
    const intervalId = setInterval(() => {
      void refreshContext(true);
    }, 10000);
    return () => clearInterval(intervalId);
  }, [accessSignature, base, refreshContext, sessionId]);

  const updateDraft = useCallback((index: number, patch: Partial<QuestionDraft>) => {
    setQuestionDrafts((prev) => {
      if (index < 0 || index >= prev.length) {
        return prev;
      }
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }, []);

  const toggleDraftExpanded = useCallback(
    (id: number) => {
      animateLayout();
      setExpandedDraftId((prev) => (prev === id ? null : id));
      setOpenTypeMenuId(null);
    },
    [animateLayout]
  );

  const toggleTypeMenu = useCallback(
    (id: number) => {
      animateLayout();
      setOpenTypeMenuId((prev) => (prev === id ? null : id));
    },
    [animateLayout]
  );

  const selectType = useCallback(
    (index: number, id: number, value: QuizQuestionType) => {
      animateLayout();
      updateDraft(index, {
        questionType: value,
        correctKeys: value === "true_false" ? "TRUE" : "A",
      });
      setOpenTypeMenuId(null);
      if (expandedDraftId !== id) {
        setExpandedDraftId(id);
      }
    },
    [animateLayout, expandedDraftId, updateDraft]
  );

  const generateDraftInputs = useCallback(() => {
    if (!selectedQuiz) {
      setStatusLine(
        tr(
          language,
          "Pilih kuis target dulu sebelum membuat form soal.",
          "Select a target quiz before generating question forms."
        )
      );
      return;
    }
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

    const requested = Number.parseInt(questionCountInput, 10);
    if (!Number.isFinite(requested) || requested <= 0) {
      setStatusLine(tr(language, "Jumlah soal tidak valid.", "Question count is invalid."));
      return;
    }

    const clamped = Math.max(1, Math.min(requested, questionSlotsLeft));
    const nextDrafts = Array.from({ length: clamped }, (_, index) => {
      return questionDrafts[index] ?? createDraft(Date.now() + index);
    });

    animateLayout();
    setQuestionDrafts(nextDrafts);
    setExpandedDraftId(nextDrafts[0]?.id ?? null);
    setOpenTypeMenuId(null);
    setStatusLine(
      tr(language, `Form soal dibuat: ${clamped} item.`, `Question forms generated: ${clamped} items.`)
    );
  }, [animateLayout, language, questionCountInput, questionDrafts, questionSlotsLeft, selectedQuiz]);

  const buildOptionsPayload = useCallback(
    (draft: QuestionDraft, draftIndex: number) => {
      if (!draft.questionType) {
        throw new Error(
          tr(
            language,
            `Soal #${draftIndex + 1}: tipe soal wajib dipilih.`,
            `Question #${draftIndex + 1}: question type is required.`
          )
        );
      }

      const normalizedCorrectKeys = draft.correctKeys
        .split(",")
        .map((value) => value.trim().toUpperCase())
        .filter((value) => value.length > 0);
      const correctSet = new Set(normalizedCorrectKeys);

      if (draft.questionType === "true_false") {
        const trueCorrect = correctSet.has("TRUE") || correctSet.has("T");
        const falseCorrect = correctSet.has("FALSE") || correctSet.has("F");
        if (!trueCorrect && !falseCorrect) {
          throw new Error(
            tr(
              language,
              `Soal #${draftIndex + 1}: kunci TRUE/FALSE wajib diisi.`,
              `Question #${draftIndex + 1}: TRUE/FALSE key is required.`
            )
          );
        }
        return [
          { key: "TRUE", text: "True", is_correct: trueCorrect },
          { key: "FALSE", text: "False", is_correct: falseCorrect },
        ];
      }

      const options = [
        { key: "A", text: draft.optionA.trim(), is_correct: correctSet.has("A") },
        { key: "B", text: draft.optionB.trim(), is_correct: correctSet.has("B") },
        ...(draft.optionC.trim() ? [{ key: "C", text: draft.optionC.trim(), is_correct: correctSet.has("C") }] : []),
        ...(draft.optionD.trim() ? [{ key: "D", text: draft.optionD.trim(), is_correct: correctSet.has("D") }] : []),
      ];

      if (!options[0]?.text || !options[1]?.text) {
        throw new Error(
          tr(
            language,
            `Soal #${draftIndex + 1}: minimal opsi A dan B wajib diisi.`,
            `Question #${draftIndex + 1}: at least option A and B are required.`
          )
        );
      }

      const correctCount = options.filter((item) => item.is_correct).length;
      if (correctCount <= 0) {
        throw new Error(
          tr(
            language,
            `Soal #${draftIndex + 1}: kunci jawaban wajib diisi.`,
            `Question #${draftIndex + 1}: correct answer key is required.`
          )
        );
      }
      if (draft.questionType === "single_choice" && correctCount !== 1) {
        throw new Error(
          tr(
            language,
            `Soal #${draftIndex + 1}: single choice harus tepat satu jawaban benar.`,
            `Question #${draftIndex + 1}: single-choice requires exactly one correct answer.`
          )
        );
      }

      return options;
    },
    [language]
  );

  const submitQuestionBatch = useCallback(async () => {
    if (!base || !sessionId || !accessSignature) {
      setStatusLine(tr(language, "Backend belum terhubung.", "Backend is not connected."));
      return;
    }
    if (!selectedQuiz) {
      setStatusLine(
        tr(
          language,
          "Pilih kuis target sebelum submit batch soal.",
          "Select a target quiz before submitting the question batch."
        )
      );
      return;
    }
    if (questionDrafts.length === 0) {
      setStatusLine(
        tr(language, "Generate form soal dulu sebelum submit.", "Generate question forms before submitting.")
      );
      return;
    }
    if (questionDrafts.length > questionSlotsLeft) {
      setStatusLine(
        tr(
          language,
          `Sisa slot soal ${questionSlotsLeft}. Kurangi jumlah soal batch.`,
          `${questionSlotsLeft} question slots left. Reduce batch size.`
        )
      );
      return;
    }
    const subjectId = Number.parseInt(subjectIdInput, 10);
    if (!Number.isFinite(subjectId) || subjectId <= 0) {
      setStatusLine(tr(language, "Subject ID tidak valid.", "Subject ID is invalid."));
      return;
    }

    setLoading(true);
    try {
      const payloadQuestions = questionDrafts.map((draft, index) => {
        const questionText = draft.questionText.trim();
        if (!draft.questionType) {
          throw new Error(
            tr(
              language,
              `Soal #${index + 1}: tipe soal wajib dipilih.`,
              `Question #${index + 1}: question type is required.`
            )
          );
        }
        if (!questionText) {
          throw new Error(
            tr(
              language,
              `Soal #${index + 1}: pertanyaan wajib diisi.`,
              `Question #${index + 1}: question text is required.`
            )
          );
        }
        const pointsValue = Number.parseInt(draft.points, 10);
        const points =
          Number.isFinite(pointsValue) && pointsValue > 0 ? Math.min(pointsValue, 1000) : 1;
        return {
          subject_id: subjectId,
          question_text: questionText,
          question_type: draft.questionType,
          points,
          ordering: activeQuestionCount + index + 1,
          options: buildOptionsPayload(draft, index),
        };
      });

      const response = await fetch(`${base}/quiz/questions/bulk`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          session_id: sessionId,
          access_signature: accessSignature,
          questions: payloadQuestions,
        }),
      });
      const payload = await parseJsonResponse(response);
      const createdCount = Number(payload?.created_count ?? payloadQuestions.length);
      setStatusLine(
        tr(
          language,
          `Batch soal berhasil disimpan: ${createdCount} soal.`,
          `Question batch saved: ${createdCount} questions.`
        )
      );
      onLog(`Quiz question bulk created: count=${createdCount} subject=${subjectId}`);
      animateLayout();
      setQuestionDrafts([]);
      setExpandedDraftId(null);
      setOpenTypeMenuId(null);
      setQuestionCountInput("1");
      await refreshContext();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatusLine(message);
      onLog(`Quiz question bulk create failed: ${message}`);
    } finally {
      setLoading(false);
    }
  }, [
    accessSignature,
    activeQuestionCount,
    animateLayout,
    authHeaders,
    base,
    buildOptionsPayload,
    language,
    onLog,
    questionDrafts,
    questionSlotsLeft,
    refreshContext,
    sessionId,
    selectedQuiz,
    subjectIdInput,
  ]);

  const exportDraftSnapshot = useCallback(async () => {
    if (questionDrafts.length === 0) {
      setStatusLine(tr(language, "Belum ada draft soal.", "No question drafts yet."));
      return;
    }
    const subjectLabel = selectedQuiz
      ? `${selectedQuiz.subjectCode} - ${selectedQuiz.subjectName}`
      : "-";
    const lines: string[] = [
      "# Quiz Draft Snapshot",
      "",
      `- Session ID: ${sessionId}`,
      `- Subject ID: ${subjectIdInput || "-"}`,
      `- Subject: ${subjectLabel}`,
      `- Draft Count: ${questionDrafts.length}`,
      `- Generated At: ${new Date().toISOString()}`,
      "",
      "## Drafts",
      "",
    ];
    questionDrafts.forEach((draft, index) => {
      lines.push(`${index + 1}. ${draft.questionText || "(empty question)"}`);
      lines.push(`   - Type: ${draft.questionType || "-"}`);
      if (draft.optionA) lines.push(`   - A: ${draft.optionA}`);
      if (draft.optionB) lines.push(`   - B: ${draft.optionB}`);
      if (draft.optionC) lines.push(`   - C: ${draft.optionC}`);
      if (draft.optionD) lines.push(`   - D: ${draft.optionD}`);
      if (draft.correctKeys) lines.push(`   - Answer Keys: ${draft.correctKeys}`);
      lines.push(`   - Points: ${draft.points || "1"}`);
      lines.push("");
    });
    const markdown = lines.join("\n");
    const fileNameBase = `quiz_draft_${sessionId}_${Date.now()}`;
    let savedResult: Awaited<ReturnType<typeof saveMarkdownToQuizResult>> | null = null;
    try {
      savedResult = await saveMarkdownToQuizResult(markdown, fileNameBase);
      setStatusLine(tr(language, `Draft disimpan: ${savedResult.fileName}`, `Draft saved: ${savedResult.fileName}`));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatusLine(message);
    }
    try {
      await uploadMarkdownToDrive({
        backendBaseUrl,
        sessionId,
        accessSignature,
        fileName: `${fileNameBase}.md`,
        markdown,
        metadata: {
          type: "draft_snapshot",
          draft_count: questionDrafts.length,
        },
      });
      setStatusLine(tr(language, "Draft terkirim ke Google Drive.", "Draft uploaded to Google Drive."));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!savedResult) {
        try {
          savedResult = await saveMarkdownToQuizResult(markdown, fileNameBase);
        } catch (saveError) {
          const saveMessage = saveError instanceof Error ? saveError.message : String(saveError);
          onLog(`Draft fallback save failed: ${saveMessage}`);
        }
      }
      if (savedResult) {
        setStatusLine(
          tr(
            language,
            `Upload Drive gagal, draft disimpan: ${savedResult.fileName}`,
            `Drive upload failed, draft saved: ${savedResult.fileName}`
          )
        );
      } else {
        setStatusLine(tr(language, `Upload Drive gagal: ${message}`, `Drive upload failed: ${message}`));
      }
    }
  }, [
    accessSignature,
    backendBaseUrl,
    language,
    onLog,
    questionDrafts,
    selectedQuiz,
    sessionId,
    subjectIdInput,
  ]);

  const setQuizAssignment = useCallback(
    async (tokenValue: string, assigned: boolean) => {
      const normalizedToken = tokenValue.trim().toUpperCase();
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
        const nextAssigned = Array.isArray(payload.assigned_tokens)
          ? payload.assigned_tokens
              .map((token: unknown) => String(token).trim().toUpperCase())
              .filter((token: string) => token.length > 0)
          : [];
        setAssignedTokens(nextAssigned);
        setStatusLine(
          assigned
            ? tr(language, `Token ${normalizedToken} di-assign ke kuis.`, `Token ${normalizedToken} assigned to quiz.`)
            : tr(
                language,
                `Token ${normalizedToken} dilepas dari assignment kuis.`,
                `Token ${normalizedToken} removed from quiz assignment.`
              )
        );
        onLog(`Quiz assignment updated: token=${normalizedToken} assigned=${assigned}`);
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

  const assignQuizToAllActiveTokens = useCallback(async () => {
    if (!base || !sessionId || !accessSignature) {
      setStatusLine(tr(language, "Backend belum terhubung.", "Backend is not connected."));
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${base}/quiz/assign-all-active-tokens`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          session_id: sessionId,
          access_signature: accessSignature,
        }),
      });
      const payload = await parseJsonResponse(response);
      const nextAssigned = Array.isArray(payload.assigned_tokens)
        ? payload.assigned_tokens
            .map((token: unknown) => String(token).trim().toUpperCase())
            .filter((token: string) => token.length > 0)
        : [];
      const assignedCount = Number(payload.assigned_count ?? nextAssigned.length);
      setAssignedTokens(nextAssigned);
      setStatusLine(
        tr(
          language,
          `Assignment kuis massal selesai: ${assignedCount} token aktif.`,
          `Bulk quiz assignment completed: ${assignedCount} active tokens.`
        )
      );
      onLog(`Quiz bulk assignment completed: assigned_count=${assignedCount}`);
      await refreshContext(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatusLine(message);
      onLog(`Quiz bulk assignment failed: ${message}`);
    } finally {
      setLoading(false);
    }
  }, [accessSignature, authHeaders, base, language, onLog, refreshContext, sessionId]);

  const deleteSavedQuiz = useCallback(
    async (subjectId: number) => {
      if (!base || !sessionId || !accessSignature) {
        setStatusLine(tr(language, "Backend belum terhubung.", "Backend is not connected."));
        return;
      }
      setDeletingQuizId(subjectId);
      setLoading(true);
      try {
        const response = await fetch(`${base}/quiz/subject/delete`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            session_id: sessionId,
            access_signature: accessSignature,
            subject_id: subjectId,
          }),
        });
        const payload = await parseJsonResponse(response);
        const nextAssigned = Array.isArray(payload.assigned_tokens)
          ? payload.assigned_tokens
              .map((token: unknown) => String(token).trim().toUpperCase())
              .filter((token: string) => token.length > 0)
          : assignedTokens;
        setAssignedTokens(nextAssigned);
        setStatusLine(
          tr(
            language,
            `Kuis subject #${subjectId} dihapus dari sesi.`,
            `Quiz subject #${subjectId} deleted from session.`
          )
        );
        onLog(`Quiz subject deleted: subject_id=${subjectId}`);
        await refreshContext(true);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setStatusLine(message);
        onLog(`Quiz subject delete failed: ${message}`);
      } finally {
        setLoading(false);
        setDeletingQuizId(null);
      }
    },
    [accessSignature, assignedTokens, authHeaders, base, language, onLog, refreshContext, sessionId]
  );

  const assignedTokenSummary = useMemo(() => {
    if (assignedTokens.length === 0) {
      return tr(language, "Belum ada token binding.", "No token bindings yet.");
    }
    const preview = assignedTokens.slice(0, 8).join(", ");
    const suffix =
      assignedTokens.length > 8
        ? tr(language, ` +${assignedTokens.length - 8} token lain`, ` +${assignedTokens.length - 8} more tokens`)
        : "";
    return `${preview}${suffix}`;
  }, [assignedTokens, language]);

  const renderDraftItem = useCallback(
    ({ item, index }: { item: QuestionDraft; index: number }) => (
      <QuestionDraftCard
        language={language}
        draft={item}
        index={index}
        isExpanded={expandedDraftId === item.id}
        isTypeMenuOpen={openTypeMenuId === item.id}
        onToggleExpanded={toggleDraftExpanded}
        onToggleTypeMenu={toggleTypeMenu}
        onSelectType={selectType}
        onUpdateDraft={updateDraft}
      />
    ),
    [expandedDraftId, language, openTypeMenuId, selectType, toggleDraftExpanded, toggleTypeMenu, updateDraft]
  );

  const headerSection = (
    <>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{tr(language, "Batch Setup", "Batch Setup")}</Text>
        <Text style={styles.statusText}>
          {tr(language, "Total soal aktif", "Active questions")}: {activeQuestionCount}/40 (
          {tr(language, "sisa", "left")} {questionSlotsLeft})
        </Text>
        <Text style={styles.helperText}>
          {selectedQuiz
            ? tr(
                language,
                `Target: #${selectedQuiz.id} ${selectedQuiz.subjectCode} - ${selectedQuiz.subjectName}`,
                `Target: #${selectedQuiz.id} ${selectedQuiz.subjectCode} - ${selectedQuiz.subjectName}`
              )
            : tr(
                language,
                "Pilih kuis target dari daftar di bawah sebelum membuat soal.",
                "Pick a target quiz from the list below before building questions."
              )}
        </Text>
        <TerminalInput
          value={subjectIdInput}
          onChangeText={setSubjectIdInput}
          label={tr(language, "Target Subject ID", "Target Subject ID")}
          placeholder="1"
          keyboardType="number-pad"
        />
        <TerminalInput value={questionCountInput} onChangeText={setQuestionCountInput} label={tr(language, "Jumlah Soal", "Question Count")} placeholder="10" keyboardType="number-pad" />
        <TerminalButton
          label={tr(language, "Generate Form Soal", "Generate Question Forms")}
          variant="outline"
          onPress={generateDraftInputs}
          disabled={loading || !hasSelectedQuiz}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{tr(language, "Question Inputs", "Question Inputs")}</Text>
        <Text style={styles.helperText}>
          {tr(
            language,
            "Card dibuat compact. Buka satu card, pilih tipe soal dari dropdown, lalu isi input.",
            "Cards are compact. Open one card, pick type from dropdown, then fill inputs."
          )}
        </Text>
      </View>
    </>
  );

  const footerSection = (
    <>
      <View style={styles.card}>
        <TerminalButton
          label={tr(language, "Submit Batch Soal", "Submit Question Batch")}
          onPress={() => void submitQuestionBatch()}
          disabled={loading || questionDrafts.length === 0 || !hasSelectedQuiz}
        />
      </View>

      <View style={styles.card}>
        <TerminalButton
          label={tr(language, "Export Draft (Drive)", "Export Draft (Drive)")}
          variant="outline"
          onPress={() => void exportDraftSnapshot()}
          disabled={loading || questionDrafts.length === 0}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{tr(language, "Assign Quiz ke Token", "Assign Quiz to Token")}</Text>
        <TerminalInput value={assignTokenInput} onChangeText={setAssignTokenInput} label={tr(language, "Token Siswa", "Student Token")} placeholder="S-XXXXXXXXXX" autoCapitalize="characters" />
        <TerminalButton label={tr(language, "Assign ke Token", "Assign to Token")} variant="outline" onPress={() => void setQuizAssignment(assignTokenInput, true)} disabled={loading} />
        <TerminalButton label={tr(language, "Lepas Assignment Token", "Remove Token Assignment")} variant="outline" onPress={() => void setQuizAssignment(assignTokenInput, false)} disabled={loading} />
        <TerminalButton
          label={tr(language, "Assign Semua Token Aktif", "Assign All Active Tokens")}
          variant="outline"
          onPress={() => void assignQuizToAllActiveTokens()}
          disabled={loading || studentTokens.length === 0}
        />
        <Text style={styles.statusText}>
          {tr(language, "Token siswa tersedia", "Available student tokens")}: {studentTokens.length}
        </Text>
        {studentTokens.length > 0 ? (
          studentTokens.map((token) => {
            const assigned = assignedTokens.includes(token);
            return (
              <View key={token} style={styles.tokenRow}>
                <Text style={styles.resultToken}>{token}</Text>
                <Text style={styles.resultMeta}>
                  {assigned
                    ? tr(language, "Assigned ke kuis", "Assigned to quiz")
                    : tr(language, "Belum assigned", "Not assigned")}
                </Text>
                <View style={styles.inlineActions}>
                  <TerminalButton label={tr(language, "Assign", "Assign")} variant="outline" onPress={() => void setQuizAssignment(token, true)} disabled={loading} />
                  <TerminalButton label={tr(language, "Lepas", "Remove")} variant="outline" onPress={() => void setQuizAssignment(token, false)} disabled={loading} />
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
        <Text style={styles.cardTitle}>{tr(language, "Status", "Status")}</Text>
        <Text style={styles.statusText}>{statusLine || "-"}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{tr(language, "Kuis Aktif & Tersimpan", "Active & Saved Quizzes")}</Text>
        <Text style={styles.helperText}>
          {tr(
            language,
            "Data ini sinkron langsung dari backend. Kuis berlabel ASSIGNED berarti token siswa sudah di-bind.",
            "This section is synced from backend. ASSIGNED means student tokens are already bound."
          )}
        </Text>
        {savedQuizzes.length > 0 ? (
          savedQuizzes.map((quiz) => {
            const isAssigned = assignedTokens.length > 0;
            const isSelected = selectedQuizId === quiz.id;
            return (
              <View
                key={quiz.id}
                style={[styles.savedQuizRow, isSelected ? styles.savedQuizRowSelected : null]}
              >
                <View style={styles.savedQuizHeader}>
                  <Text style={styles.resultToken}>
                    {quiz.subjectCode} - {quiz.subjectName}
                  </Text>
                  <Text style={isAssigned ? styles.assignedBadge : styles.unassignedBadge}>
                    {isAssigned ? "ASSIGNED" : tr(language, "BELUM ASSIGNED", "UNASSIGNED")}
                  </Text>
                </View>
                <Text style={styles.resultMeta}>
                  {tr(language, "Jumlah soal", "Question count")}: {quiz.questionCount}
                </Text>
                {quiz.description ? <Text style={styles.resultMeta}>{quiz.description}</Text> : null}
                <Text style={styles.resultMeta}>
                  {isAssigned
                    ? tr(
                        language,
                        `Terikat ke token: ${assignedTokenSummary}`,
                        `Bound to tokens: ${assignedTokenSummary}`
                      )
                    : tr(language, "Belum ada token yang terikat.", "No tokens are currently bound.")}
                </Text>
                {isSelected ? (
                  <Text style={styles.resultMeta}>
                    {tr(
                      language,
                      "Dipilih sebagai target builder.",
                      "Selected as the builder target."
                    )}
                  </Text>
                ) : null}
                <View style={styles.inlineActions}>
                  <TerminalButton
                    label={
                      isSelected
                        ? tr(language, "Target Aktif", "Active Target")
                        : tr(language, "Pilih Target", "Select Target")
                    }
                    variant={isSelected ? "solid" : "outline"}
                    onPress={() => setSubjectIdInput(String(quiz.id))}
                    disabled={loading}
                  />
                  <TerminalButton
                    label={tr(language, "Hapus Kuis", "Delete Quiz")}
                    variant="outline"
                    onPress={() => void deleteSavedQuiz(quiz.id)}
                    disabled={loading || deletingQuizId === quiz.id}
                  />
                </View>
              </View>
            );
          })
        ) : (
          <Text style={styles.emptyText}>
            {tr(
              language,
              "Belum ada kuis tersimpan pada sesi ini.",
              "There are no saved quizzes in this session yet."
            )}
          </Text>
        )}
      </View>
    </>
  );

  return (
    <Layout
      title={tr(language, "Dynamic Quiz Builder", "Dynamic Quiz Builder")}
      subtitle={tr(
        language,
        "Set jumlah soal, isi form dinamis, lalu submit batch dan assign token.",
        "Set question count, fill dynamic forms, then submit batch and assign token."
      )}
      footer={
        <View style={styles.footerWrap}>
          <TerminalButton label={tr(language, "Refresh", "Refresh")} variant="outline" onPress={() => void refreshContext()} />
          <TerminalButton label={tr(language, "Kembali", "Back")} variant="outline" onPress={onBack} />
        </View>
      }
    >
      <FlatList
        data={questionDrafts}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderDraftItem}
        ListHeaderComponent={headerSection}
        ListEmptyComponent={
          <View style={styles.card}>
            <Text style={styles.emptyText}>
              {tr(
                language,
                "Belum ada form soal. Isi jumlah lalu tekan Generate.",
                "No question forms yet. Set count then press Generate."
              )}
            </Text>
          </View>
        }
        ListFooterComponent={footerSection}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={false}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={12}
      />
    </Layout>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 20, gap: 10 },
  card: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    padding: 12,
    marginBottom: 10,
  },
  cardTitle: {
    color: "#111827",
    fontFamily: "Montserrat-Bold",
    fontSize: 12,
    marginBottom: 8,
  },
  statusText: { color: "#4b5563", fontFamily: "Montserrat-Regular", fontSize: 10, marginTop: 8 },
  emptyText: { color: "#9ca3af", fontFamily: "Montserrat-Regular", fontSize: 10 },
  helperText: { color: "#6b7280", fontFamily: "Montserrat-Regular", fontSize: 10, marginTop: 2 },
  draftCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    marginBottom: 8,
    overflow: "hidden",
  },
  draftHeader: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  draftHeaderTextWrap: { flex: 1, gap: 2 },
  draftTitle: { color: "#111827", fontFamily: "Montserrat-Bold", fontSize: 11 },
  draftSubtitle: { color: "#6b7280", fontFamily: "Montserrat-Regular", fontSize: 9 },
  badgesWrap: { alignItems: "flex-end", gap: 2 },
  typeBadge: {
    color: "#166534",
    fontFamily: "Montserrat-SemiBold",
    fontSize: 9,
    backgroundColor: "rgba(34,197,94,0.14)",
    borderColor: "rgba(34,197,94,0.4)",
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  chevron: { color: "#6b7280", fontFamily: "Montserrat-Bold", fontSize: 10 },
  draftBody: { borderTopWidth: 1, borderTopColor: "#ecf0f3", padding: 10, gap: 6 },
  modeLabel: { color: "#4b5563", fontFamily: "Montserrat-SemiBold", fontSize: 10, marginBottom: 2 },
  dropdownTrigger: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dropdownTriggerText: { color: "#111827", fontFamily: "Montserrat-SemiBold", fontSize: 10 },
  dropdownMenu: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10, backgroundColor: "#ffffff", marginTop: 6, overflow: "hidden" },
  dropdownItem: { paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  dropdownItemActive: { backgroundColor: "rgba(34,197,94,0.12)" },
  dropdownItemText: { color: "#111827", fontFamily: "Montserrat-Regular", fontSize: 10 },
  dropdownItemTextActive: { color: "#166534", fontFamily: "Montserrat-Bold" },
  tokenRow: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, padding: 8, marginBottom: 6 },
  savedQuizRow: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, padding: 8, marginTop: 8, gap: 4 },
  savedQuizRowSelected: {
    borderColor: "rgba(34,197,94,0.55)",
    backgroundColor: "rgba(34,197,94,0.08)",
  },
  savedQuizHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  resultToken: { color: "#111827", fontFamily: "Montserrat-Bold", fontSize: 11, marginBottom: 2 },
  resultMeta: { color: "#6b7280", fontFamily: "Montserrat-Regular", fontSize: 10 },
  assignedBadge: {
    color: "#166534",
    fontFamily: "Montserrat-Bold",
    fontSize: 9,
    backgroundColor: "rgba(34,197,94,0.14)",
    borderColor: "rgba(34,197,94,0.4)",
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  unassignedBadge: {
    color: "#9a3412",
    fontFamily: "Montserrat-Bold",
    fontSize: 9,
    backgroundColor: "rgba(251,146,60,0.14)",
    borderColor: "rgba(251,146,60,0.4)",
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  inlineActions: { flexDirection: "row", gap: 6, marginTop: 6 },
  footerWrap: { gap: 0 },
});
