import { Linking, NativeModules, PermissionsAndroid, Platform } from "react-native";
import RNFS from "react-native-fs";

type QuizResultStudentInfo = {
  name?: string;
  studentClass?: string;
  elective?: string;
  username?: string;
  schoolYear?: string;
  studentToken?: string;
};

export type QuizResultViolationAuditRecord = {
  timestamp: string;
  type: string;
  detail: string;
  riskDelta?: number | null;
  source?: string;
};

export type QuizResultViolationAudit = {
  hasViolations: boolean;
  currentRiskScore?: number | null;
  threshold?: number | null;
  warningTriggered?: boolean;
  latestMessage?: string;
  records?: QuizResultViolationAuditRecord[];
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
  violationAudit?: QuizResultViolationAudit;
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
  folder_name?: string;
  folder_id?: string;
};

export type DriveHealthResult = {
  configured: boolean;
  connected: boolean;
  auth_mode?: string;
  scope?: string;
  folder_name?: string;
  folder_id?: string;
  configured_folder_id?: string;
  error?: string;
};

export type DriveUploadError = Error & {
  folderName?: string;
  folderId?: string;
};

type EdufikaSecurityModuleShape = {
  hasManageExternalStorageAccess?: () => Promise<boolean>;
  openManageExternalStorageSettings?: () => Promise<boolean>;
};

const securityModule: EdufikaSecurityModuleShape | undefined = (
  NativeModules as { EdufikaSecurity?: EdufikaSecurityModuleShape }
).EdufikaSecurity;

function sanitizeFileName(value: string): string {
  const normalized = value.trim().replace(/[^\w.-]+/g, "_");
  return normalized.length > 0 ? normalized : `quiz_result_${Date.now()}`;
}

function requiresManageExternalStorageAccess(): boolean {
  return Platform.OS === "android" && Number(Platform.Version) >= 30;
}

async function requestStoragePermission(): Promise<boolean> {
  if (Platform.OS !== "android") {
    return true;
  }
  if (requiresManageExternalStorageAccess()) {
    return hasQuizResultStoragePermission();
  }
  const permission = PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE;
  try {
    const status = await PermissionsAndroid.request(permission);
    return status === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

export async function hasQuizResultStoragePermission(): Promise<boolean> {
  if (Platform.OS !== "android") {
    return true;
  }
  if (requiresManageExternalStorageAccess()) {
    try {
      return (await securityModule?.hasManageExternalStorageAccess?.()) ?? false;
    } catch {
      return false;
    }
  }
  try {
    return await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
  } catch {
    return false;
  }
}

export async function requestQuizResultStoragePermission(): Promise<boolean> {
  return requestStoragePermission();
}

export async function openQuizResultStorageSettings(): Promise<boolean> {
  if (Platform.OS !== "android") {
    return false;
  }
  if (!requiresManageExternalStorageAccess()) {
    return false;
  }
  try {
    const opened = await securityModule?.openManageExternalStorageSettings?.();
    if (opened) {
      return true;
    }
  } catch {
    // Fall back to the generic app settings page below.
  }
  try {
    await Linking.openSettings();
    return true;
  } catch {
    return false;
  }
}

export function usesQuizResultStorageSettingsFlow(): boolean {
  return requiresManageExternalStorageAccess();
}

async function resolveResultDirectory(
  folderName: string,
  promptForPermission: boolean
): Promise<{ folderPath: string; usedExternal: boolean }> {
  const prefersExternal = Platform.OS === "android";
  let basePath = RNFS.DocumentDirectoryPath;
  let usedExternal = false;

  if (prefersExternal) {
    let granted = await hasQuizResultStoragePermission();
    if (!granted && promptForPermission) {
      granted = await requestStoragePermission();
    }
    if (granted && RNFS.ExternalStorageDirectoryPath) {
      basePath = RNFS.ExternalStorageDirectoryPath;
      usedExternal = true;
    } else if (RNFS.ExternalDirectoryPath) {
      basePath = RNFS.ExternalDirectoryPath;
      usedExternal = true;
    }
  }

  const folderPath = `${basePath}/${folderName}`;
  await RNFS.mkdir(folderPath);
  return { folderPath, usedExternal };
}

export function buildQuizResultMarkdown(payload: QuizResultMarkdownPayload): string {
  const buildSection = (copy: {
    title: string;
    quizLabel: string;
    sessionIdLabel: string;
    attemptIdLabel: string;
    questionCountLabel: string;
    correctLabel: string;
    incorrectLabel: string;
    scoreLabel: string;
    durationLabel: string;
    generatedAtLabel: string;
    studentInfoTitle: string;
    nameLabel: string;
    classLabel: string;
    electiveLabel: string;
    usernameLabel: string;
    schoolYearLabel: string;
    studentTokenLabel: string;
    resultItemsTitle: string;
    notesTitle: string;
    noteLabel: string;
    violationAuditTitle: string;
    hasViolationsLabel: string;
    violationCountLabel: string;
    currentRiskScoreLabel: string;
    thresholdLabel: string;
    warningTriggeredLabel: string;
    latestMessageLabel: string;
    recordsTitle: string;
    noRecordsText: string;
    correctWord: string;
    incorrectWord: string;
    yesWord: string;
    noWord: string;
    naWord: string;
    missingWord: string;
  }): string[] => {
    const headerLines = [
      `# ${copy.title}`,
      "",
      `- ${copy.quizLabel}: ${payload.quizTitle}`,
      `- ${copy.sessionIdLabel}: ${payload.sessionId}`,
      payload.attemptId ? `- ${copy.attemptIdLabel}: ${payload.attemptId}` : null,
      `- ${copy.questionCountLabel}: ${payload.questionCount}`,
      payload.correctCount !== null && payload.correctCount !== undefined
        ? `- ${copy.correctLabel}: ${payload.correctCount}`
        : `- ${copy.correctLabel}: ${copy.naWord}`,
      payload.incorrectCount !== null && payload.incorrectCount !== undefined
        ? `- ${copy.incorrectLabel}: ${payload.incorrectCount}`
        : `- ${copy.incorrectLabel}: ${copy.naWord}`,
      `- ${copy.scoreLabel}: ${payload.score}/${payload.maxScore}`,
      payload.durationSeconds !== null && payload.durationSeconds !== undefined
        ? `- ${copy.durationLabel}: ${payload.durationSeconds}s`
        : null,
      `- ${copy.generatedAtLabel}: ${payload.generatedAt}`,
    ].filter(Boolean) as string[];

    const student = payload.student;
    const studentLines = student
      ? [
          "",
          `## ${copy.studentInfoTitle}`,
          "",
          student.name ? `- ${copy.nameLabel}: ${student.name}` : null,
          student.studentClass ? `- ${copy.classLabel}: ${student.studentClass}` : null,
          student.elective ? `- ${copy.electiveLabel}: ${student.elective}` : null,
          student.username ? `- ${copy.usernameLabel}: ${student.username}` : null,
          student.schoolYear ? `- ${copy.schoolYearLabel}: ${student.schoolYear}` : null,
          student.studentToken ? `- ${copy.studentTokenLabel}: ${student.studentToken}` : null,
        ].filter(Boolean) as string[]
      : [];

    const resultLines =
      payload.resultItems && payload.resultItems.length > 0
        ? [
            "",
            `## ${copy.resultItemsTitle}`,
            "",
            ...payload.resultItems.map((item, index) => {
              const status = item.isCorrect ? copy.correctWord : copy.incorrectWord;
              return `${index + 1}. ${status} (${item.pointsAwarded}/${item.maxPoints}) - ${item.questionText}`;
            }),
          ]
        : payload.note
          ? ["", `## ${copy.notesTitle}`, "", `- ${copy.noteLabel}: ${payload.note}`]
          : [];

    const violationAudit = payload.violationAudit;
    const violationRecords = violationAudit?.records ?? [];
    const violationLines = violationAudit
      ? [
          "",
          `## ${copy.violationAuditTitle}`,
          "",
          `- ${copy.hasViolationsLabel}: ${violationAudit.hasViolations ? copy.yesWord : copy.noWord}`,
          `- ${copy.violationCountLabel}: ${violationRecords.length}`,
          `- ${copy.currentRiskScoreLabel}: ${
            violationAudit.currentRiskScore !== null && violationAudit.currentRiskScore !== undefined
              ? violationAudit.currentRiskScore
              : copy.naWord
          }`,
          `- ${copy.thresholdLabel}: ${
            violationAudit.threshold !== null && violationAudit.threshold !== undefined
              ? violationAudit.threshold
              : copy.naWord
          }`,
          `- ${copy.warningTriggeredLabel}: ${violationAudit.warningTriggered ? copy.yesWord : copy.noWord}`,
          `- ${copy.latestMessageLabel}: ${
            violationAudit.latestMessage?.trim() ? violationAudit.latestMessage.trim() : copy.missingWord
          }`,
          "",
          `### ${copy.recordsTitle}`,
          "",
          ...(violationRecords.length > 0
            ? violationRecords.map((record, index) => {
                const riskLabel =
                  record.riskDelta !== null && record.riskDelta !== undefined
                    ? `risk +${record.riskDelta}`
                    : "risk +/-0";
                const sourceLabel = record.source?.trim() ? record.source.trim() : "unknown";
                return `${index + 1}. [${record.timestamp}] ${record.type || "OTHER"} | ${riskLabel} | ${sourceLabel} | ${record.detail}`;
              })
            : [copy.noRecordsText]),
        ]
      : [];

    return [...headerLines, ...studentLines, ...resultLines, ...violationLines];
  };

  const englishLines = buildSection({
    title: "Quiz Result",
    quizLabel: "Quiz",
    sessionIdLabel: "Session ID",
    attemptIdLabel: "Attempt ID",
    questionCountLabel: "Question Count",
    correctLabel: "Correct",
    incorrectLabel: "Incorrect",
    scoreLabel: "Score",
    durationLabel: "Duration",
    generatedAtLabel: "Generated At",
    studentInfoTitle: "Student Info",
    nameLabel: "Name",
    classLabel: "Class",
    electiveLabel: "Elective",
    usernameLabel: "Username",
    schoolYearLabel: "School Year",
    studentTokenLabel: "Student Token",
    resultItemsTitle: "Result Items",
    notesTitle: "Notes",
    noteLabel: "Note",
    violationAuditTitle: "Violation Audit",
    hasViolationsLabel: "Has Prior Violations In This Session",
    violationCountLabel: "Violation Count",
    currentRiskScoreLabel: "Current Risk Score",
    thresholdLabel: "Risk Lock Threshold",
    warningTriggeredLabel: "Integrity Warning Triggered",
    latestMessageLabel: "Latest Integrity Message",
    recordsTitle: "Recorded Violations",
    noRecordsText: "1. No violations were recorded.",
    correctWord: "Correct",
    incorrectWord: "Incorrect",
    yesWord: "Yes",
    noWord: "No",
    naWord: "N/A",
    missingWord: "No integrity warning message recorded",
  });

  const indonesianLines = buildSection({
    title: "Hasil Kuis",
    quizLabel: "Kuis",
    sessionIdLabel: "ID Sesi",
    attemptIdLabel: "ID Percobaan",
    questionCountLabel: "Jumlah Soal",
    correctLabel: "Benar",
    incorrectLabel: "Salah",
    scoreLabel: "Nilai",
    durationLabel: "Durasi",
    generatedAtLabel: "Dibuat Pada",
    studentInfoTitle: "Informasi Siswa",
    nameLabel: "Nama",
    classLabel: "Kelas",
    electiveLabel: "Peminatan",
    usernameLabel: "Username",
    schoolYearLabel: "Tahun Ajaran",
    studentTokenLabel: "Token Siswa",
    resultItemsTitle: "Rincian Hasil",
    notesTitle: "Catatan",
    noteLabel: "Catatan",
    violationAuditTitle: "Audit Pelanggaran",
    hasViolationsLabel: "Pernah Melakukan Pelanggaran Pada Sesi Ini",
    violationCountLabel: "Jumlah Pelanggaran",
    currentRiskScoreLabel: "Risk Score Saat Ini",
    thresholdLabel: "Ambang Kunci Risk Score",
    warningTriggeredLabel: "Peringatan Integritas Muncul",
    latestMessageLabel: "Pesan Integritas Terakhir",
    recordsTitle: "Pelanggaran Tercatat",
    noRecordsText: "1. Tidak ada pelanggaran yang tercatat.",
    correctWord: "Benar",
    incorrectWord: "Salah",
    yesWord: "Ya",
    noWord: "Tidak",
    naWord: "N/A",
    missingWord: "Tidak ada pesan peringatan integritas yang tercatat",
  });

  return [...englishLines, "", "---", "", ...indonesianLines, ""].join("\n");
}

async function saveResultFile(options: {
  content: string;
  fileName: string;
  extension: "md" | "txt";
  folderName: string;
  promptForPermission: boolean;
}): Promise<SaveMarkdownResult> {
  const { folderPath, usedExternal } = await resolveResultDirectory(
    options.folderName,
    options.promptForPermission
  );
  const safeName = sanitizeFileName(options.fileName).replace(new RegExp(`\\.${options.extension}$`, "i"), "");
  const finalName = `${safeName}.${options.extension}`;
  const path = `${folderPath}/${finalName}`;
  await RNFS.writeFile(path, options.content, "utf8");
  return { path, fileName: finalName, folderPath, usedExternal };
}

export async function saveMarkdownToQuizResult(
  markdown: string,
  fileName: string
): Promise<SaveMarkdownResult> {
  return saveResultFile({
    content: markdown,
    fileName,
    extension: "md",
    folderName: "QuizResult",
    promptForPermission: true,
  });
}

export async function saveTextToQuizResult(
  text: string,
  fileName: string
): Promise<SaveMarkdownResult> {
  return saveResultFile({
    content: text,
    fileName,
    extension: "txt",
    folderName: "QuizResult",
    promptForPermission: false,
  });
}

export async function saveTextToExamResult(
  text: string,
  fileName: string
): Promise<SaveMarkdownResult> {
  return saveResultFile({
    content: text,
    fileName,
    extension: "txt",
    folderName: "ExamResult",
    promptForPermission: false,
  });
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
    const error = new Error(message) as DriveUploadError;
    error.folderName = typeof payload?.folder_name === "string" ? payload.folder_name : undefined;
    error.folderId = typeof payload?.folder_id === "string" ? payload.folder_id : undefined;
    throw error;
  }
  return {
    file_id: typeof payload?.file_id === "string" ? payload.file_id : undefined,
    web_view_link: typeof payload?.web_view_link === "string" ? payload.web_view_link : undefined,
    folder_name: typeof payload?.folder_name === "string" ? payload.folder_name : undefined,
    folder_id: typeof payload?.folder_id === "string" ? payload.folder_id : undefined,
  };
}

export async function fetchGoogleDriveHealth(backendBaseUrl: string): Promise<DriveHealthResult> {
  const base = backendBaseUrl.trim().replace(/\/+$/, "");
  if (!base) {
    throw new Error("Backend URL is empty.");
  }

  const response = await fetch(`${base}/health/drive`, {
    method: "GET",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload?.error === "string" ? payload.error : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return {
    configured: payload?.configured === true,
    connected: payload?.connected === true,
    auth_mode: typeof payload?.auth_mode === "string" ? payload.auth_mode : undefined,
    scope: typeof payload?.scope === "string" ? payload.scope : undefined,
    folder_name: typeof payload?.folder_name === "string" ? payload.folder_name : undefined,
    folder_id: typeof payload?.folder_id === "string" ? payload.folder_id : undefined,
    configured_folder_id:
      typeof payload?.configured_folder_id === "string" ? payload.configured_folder_id : undefined,
    error: typeof payload?.error === "string" ? payload.error : undefined,
  };
}
