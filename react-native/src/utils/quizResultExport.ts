import { PermissionsAndroid, Platform } from "react-native";
import RNFS from "react-native-fs";

type QuizResultStudentInfo = {
  name?: string;
  studentClass?: string;
  elective?: string;
  username?: string;
  schoolYear?: string;
  studentToken?: string;
};

export type QuizResultMarkdownPayload = {
  quizTitle: string;
  sessionId: string;
  attemptId?: number | null;
  questionCount: number;
  correctCount?: number | null;
  incorrectCount?: number | null;
  score: number;
  maxScore: number;
  durationSeconds?: number | null;
  generatedAt: string;
  student?: QuizResultStudentInfo;
  resultItems?: Array<{
    questionText: string;
    isCorrect: boolean;
    pointsAwarded: number;
    maxPoints: number;
  }>;
  note?: string;
};

type SaveMarkdownResult = {
  path: string;
  fileName: string;
  folderPath: string;
  usedExternal: boolean;
};

type UploadMarkdownResult = {
  file_id?: string;
  web_view_link?: string;
};

function sanitizeFileName(value: string): string {
  const normalized = value.trim().replace(/[^\w.-]+/g, "_");
  return normalized.length > 0 ? normalized : `quiz_result_${Date.now()}`;
}

async function requestStoragePermission(): Promise<boolean> {
  if (Platform.OS !== "android") {
    return true;
  }
  const permission = PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE;
  try {
    const status = await PermissionsAndroid.request(permission);
    return status === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

async function resolveQuizResultDirectory(): Promise<{ folderPath: string; usedExternal: boolean }> {
  const prefersExternal = Platform.OS === "android";
  let basePath = RNFS.DocumentDirectoryPath;
  let usedExternal = false;

  if (prefersExternal) {
    const granted = await requestStoragePermission();
    if (granted && RNFS.ExternalStorageDirectoryPath) {
      basePath = RNFS.ExternalStorageDirectoryPath;
      usedExternal = true;
    }
  }

  const folderPath = `${basePath}/QuizResult`;
  await RNFS.mkdir(folderPath);
  return { folderPath, usedExternal };
}

export function buildQuizResultMarkdown(payload: QuizResultMarkdownPayload): string {
  const headerLines = [
    "# Quiz Result",
    "",
    `- Quiz: ${payload.quizTitle}`,
    `- Session ID: ${payload.sessionId}`,
    payload.attemptId ? `- Attempt ID: ${payload.attemptId}` : null,
    `- Question Count: ${payload.questionCount}`,
    payload.correctCount !== null && payload.correctCount !== undefined
      ? `- Correct: ${payload.correctCount}`
      : "- Correct: N/A",
    payload.incorrectCount !== null && payload.incorrectCount !== undefined
      ? `- Incorrect: ${payload.incorrectCount}`
      : "- Incorrect: N/A",
    `- Score: ${payload.score}/${payload.maxScore}`,
    payload.durationSeconds !== null && payload.durationSeconds !== undefined
      ? `- Duration: ${payload.durationSeconds}s`
      : null,
    `- Generated At: ${payload.generatedAt}`,
  ].filter(Boolean);

  const student = payload.student;
  const studentLines = student
    ? [
        "",
        "## Student Info",
        "",
        student.name ? `- Name: ${student.name}` : null,
        student.studentClass ? `- Class: ${student.studentClass}` : null,
        student.elective ? `- Elective: ${student.elective}` : null,
        student.username ? `- Username: ${student.username}` : null,
        student.schoolYear ? `- School Year: ${student.schoolYear}` : null,
        student.studentToken ? `- Student Token: ${student.studentToken}` : null,
      ].filter(Boolean)
    : [];

  const resultLines =
    payload.resultItems && payload.resultItems.length > 0
      ? [
          "",
          "## Result Items",
          "",
          ...payload.resultItems.map((item, index) => {
            const status = item.isCorrect ? "Correct" : "Incorrect";
            return `${index + 1}. ${status} (${item.pointsAwarded}/${item.maxPoints}) - ${item.questionText}`;
          }),
        ]
      : payload.note
        ? ["", "## Notes", "", payload.note]
        : [];

  return [...headerLines, ...studentLines, ...resultLines, ""].join("\n");
}

export async function saveMarkdownToQuizResult(
  markdown: string,
  fileName: string
): Promise<SaveMarkdownResult> {
  const { folderPath, usedExternal } = await resolveQuizResultDirectory();
  const safeName = sanitizeFileName(fileName).replace(/\.md$/i, "");
  const finalName = `${safeName}.md`;
  const path = `${folderPath}/${finalName}`;
  await RNFS.writeFile(path, markdown, "utf8");
  return { path, fileName: finalName, folderPath, usedExternal };
}

export async function uploadMarkdownToDrive(options: {
  backendBaseUrl: string;
  sessionId: string;
  accessSignature: string;
  fileName: string;
  markdown: string;
  metadata?: Record<string, unknown>;
}): Promise<UploadMarkdownResult> {
  const base = options.backendBaseUrl.trim().replace(/\/+$/, "");
  if (!base) {
    throw new Error("Backend URL is empty.");
  }

  const response = await fetch(`${base}/quiz/result/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: options.sessionId,
      access_signature: options.accessSignature,
      file_name: options.fileName,
      markdown: options.markdown,
      metadata: options.metadata ?? {},
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload?.error === "string" ? payload.error : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return {
    file_id: typeof payload?.file_id === "string" ? payload.file_id : undefined,
    web_view_link: typeof payload?.web_view_link === "string" ? payload.web_view_link : undefined,
  };
}
