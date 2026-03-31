import path from "node:path";

function parseIntEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  projectRoot: process.cwd(),
  port: parseIntEnv("PORT", 8088),
  host: process.env.HOST || "0.0.0.0",
  jwtSecret: requireEnv("JWT_SECRET"),
  adminCreateKey: process.env.ADMIN_CREATE_KEY?.trim() || "",
  wsAuthToken: process.env.WS_AUTH_TOKEN?.trim() || "",
  defaultTokenTtlMinutes: parseIntEnv("DEFAULT_TOKEN_TTL_MINUTES", 120),
  accessSignatureTtlSeconds: parseIntEnv("ACCESS_SIGNATURE_TTL_SECONDS", 300),
  heartbeatTimeoutSeconds: parseIntEnv("HEARTBEAT_TIMEOUT_SECONDS", 30),
  heartbeatSuspendSeconds: parseIntEnv("HEARTBEAT_SUSPEND_SECONDS", 90),
  heartbeatLockSeconds: parseIntEnv("HEARTBEAT_LOCK_SECONDS", 180),
  heartbeatWatchIntervalSeconds: parseIntEnv("HEARTBEAT_WATCH_INTERVAL_SECONDS", 5),
  sessionArchiveGraceSeconds: parseIntEnv("SESSION_ARCHIVE_GRACE_SECONDS", 60),
  sessionCleanupBatchSize: parseIntEnv("SESSION_CLEANUP_BATCH_SIZE", 25),
  riskLockThreshold: parseIntEnv("RISK_LOCK_THRESHOLD", 12),
  studentAuthTtlHours: parseIntEnv("STUDENT_AUTH_TTL_HOURS", 12),
  googleDriveClientId: process.env.GDRIVE_CLIENT_ID?.trim() || "",
  googleDriveClientSecret: process.env.GDRIVE_CLIENT_SECRET?.trim() || "",
  googleDriveRefreshToken: process.env.GDRIVE_REFRESH_TOKEN?.trim() || "",
  googleDriveRedirectUri: process.env.GDRIVE_REDIRECT_URI?.trim() || "",
  googleDriveClientEmail: process.env.GOOGLE_DRIVE_CLIENT_EMAIL?.trim() || "",
  googleDrivePrivateKey: (process.env.GOOGLE_DRIVE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  googleDriveFolderId:
    process.env.GDRIVE_FOLDER_ID?.trim() ||
    process.env.GOOGLE_DRIVE_FOLDER_ID?.trim() ||
    "1YBs9n7cAskGOWdjw2IGwV6zBHyYB44hT",
  googleDriveFolderName:
    process.env.GDRIVE_FOLDER_NAME?.trim() ||
    process.env.GOOGLE_DRIVE_FOLDER_NAME?.trim() ||
    "QuizData",
  googleDriveScope:
    process.env.GDRIVE_SCOPE?.trim() ||
    process.env.GOOGLE_DRIVE_SCOPE?.trim() ||
    "https://www.googleapis.com/auth/drive.file",
  requireHttps: process.env.REQUIRE_HTTPS === "true",
  nodeEnv: process.env.NODE_ENV || "development",
  defaultWhitelist: (process.env.DEFAULT_WHITELIST || "https://example.org,https://school.ac.id/exam")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  defaultUpdateChannel: process.env.UPDATE_DEFAULT_CHANNEL?.trim() || "stable",
  publicBaseUrl: process.env.PUBLIC_BASE_URL?.trim().replace(/\/+$/, "") || "",
  updateManifestsDir:
    process.env.UPDATE_MANIFESTS_DIR?.trim() ||
    path.join(process.cwd(), "updates"),
  updateManifestPath:
    process.env.UPDATE_MANIFEST_PATH?.trim() ||
    path.join(process.cwd(), "updates", "manifest.json"),
  updateAssetsDir:
    process.env.UPDATE_ASSETS_DIR?.trim() ||
    path.join(process.cwd(), "updates", "files"),
};
