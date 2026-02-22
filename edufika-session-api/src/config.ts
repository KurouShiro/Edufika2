function parseIntEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  port: parseIntEnv("PORT", 8088),
  host: process.env.HOST || "0.0.0.0",
  jwtSecret: process.env.JWT_SECRET || "dev-only-secret",
  defaultTokenTtlMinutes: parseIntEnv("DEFAULT_TOKEN_TTL_MINUTES", 120),
  accessSignatureTtlSeconds: parseIntEnv("ACCESS_SIGNATURE_TTL_SECONDS", 300),
  heartbeatTimeoutSeconds: parseIntEnv("HEARTBEAT_TIMEOUT_SECONDS", 30),
  heartbeatSuspendSeconds: parseIntEnv("HEARTBEAT_SUSPEND_SECONDS", 90),
  heartbeatLockSeconds: parseIntEnv("HEARTBEAT_LOCK_SECONDS", 180),
  heartbeatWatchIntervalSeconds: parseIntEnv("HEARTBEAT_WATCH_INTERVAL_SECONDS", 5),
  sessionArchiveGraceSeconds: parseIntEnv("SESSION_ARCHIVE_GRACE_SECONDS", 60),
  sessionCleanupBatchSize: parseIntEnv("SESSION_CLEANUP_BATCH_SIZE", 25),
  riskLockThreshold: parseIntEnv("RISK_LOCK_THRESHOLD", 12),
  requireHttps: process.env.REQUIRE_HTTPS === "true",
  nodeEnv: process.env.NODE_ENV || "development",
  defaultWhitelist: (process.env.DEFAULT_WHITELIST || "https://example.org,https://school.ac.id/exam")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
};
