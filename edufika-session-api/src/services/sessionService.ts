import crypto from "node:crypto";
import dayjs from "dayjs";
import { v4 as uuidv4 } from "uuid";
import { config } from "../config";
import { dbPool, DbClient } from "../db/pool";
import { calculateRisk, violationSeverityFromType } from "../risk/score";
import { signAccessSignature, verifyAccessSignature } from "./tokenService";
import { WsHub } from "./wsHub";

type Role = "student" | "admin" | "developer";

type CreateSessionInput = {
  proctorId: string;
  examName?: string;
  tokenCount?: number;
  launchUrl?: string;
  tokenTtlMinutes?: number;
};

type ClaimSessionInput = {
  token: string;
  deviceFingerprint?: string;
  deviceBindingId?: string;
  roleHint?: Role;
  ipAddress?: string;
};

type HeartbeatInput = {
  session_id: string;
  access_signature: string;
  device_binding_id: string;
  focus: boolean;
  multi_window: boolean;
  network_state?: string;
  device_state?: string;
  timestamp: number;
  risk_score?: number;
  overlay_detected?: boolean;
  accessibility_active?: boolean;
  debug_detected?: boolean;
  emulator_detected?: boolean;
  rooted?: boolean;
};

type EventInput = {
  session_id: string;
  access_signature: string;
  event_type: string;
  detail?: string;
  severity?: number;
  risk_score?: number;
  metadata?: Record<string, unknown>;
};

type BindingAuthContext = {
  bindingId: string;
  sessionId: string;
  role: Role;
  riskScore: number;
  locked: boolean;
  sessionStatus: string;
  signatureVersion: number;
  exp?: number;
};

export class ApiError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export class SessionService {
  constructor(private readonly wsHub: WsHub) {}

  async createSession(input: CreateSessionInput): Promise<{
    sessionId: string;
    tokens: string[];
    token: string;
    launchUrl: string | null;
  }> {
    const tokenTtlMinutes = Math.max(1, input.tokenTtlMinutes ?? config.defaultTokenTtlMinutes);
    const sessionId = uuidv4();
    const studentToken = this.generateSessionToken("student");
    const adminToken = this.generateSessionToken("admin");
    const tokens = [studentToken, adminToken];

    const client = await dbPool.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        `
          INSERT INTO exam_sessions (id, exam_name, created_by, start_time, status)
          VALUES ($1, $2, $3, now(), 'ACTIVE')
        `,
        [sessionId, input.examName ?? "Edufika Exam", input.proctorId]
      );

      const roleTokenPairs: Array<{ role: "student" | "admin"; token: string }> = [
        { role: "student", token: studentToken },
        { role: "admin", token: adminToken },
      ];

      for (const roleToken of roleTokenPairs) {
        await client.query(
          `
            INSERT INTO session_tokens (token, exam_session_id, claimed, expires_at, role)
            VALUES ($1, $2, FALSE, DATE_ADD(NOW(), INTERVAL $3 MINUTE), $4)
          `,
          [roleToken.token, sessionId, tokenTtlMinutes, roleToken.role]
        );
      }

      for (const allowedUrl of config.defaultWhitelist) {
        await client.query(
          `
            INSERT IGNORE INTO session_whitelist (exam_session_id, url)
            VALUES ($1, $2)
          `,
          [sessionId, allowedUrl]
        );
      }

      let launchUrl: string | null = null;
      if (input.launchUrl?.trim()) {
        launchUrl = normalizeUrl(input.launchUrl);
        await client.query(
          `
            INSERT INTO session_browser_targets (exam_session_id, launch_url, provider, lock_to_host, created_at, updated_at)
            VALUES ($1, $2, $3, TRUE, now(), now())
            ON DUPLICATE KEY UPDATE
              launch_url = VALUES(launch_url),
              provider = VALUES(provider),
              lock_to_host = TRUE,
              updated_at = NOW()
          `,
          [sessionId, launchUrl, detectProvider(launchUrl)]
        );
        await client.query(
          `
            INSERT IGNORE INTO session_whitelist (exam_session_id, url)
            VALUES ($1, $2)
          `,
          [sessionId, launchUrl]
        );
      }

      await client.query("COMMIT");

      this.wsHub.broadcast("session_created", {
        session_id: sessionId,
        token_count: tokens.length,
        requested_token_count: input.tokenCount ?? null,
        created_by: input.proctorId,
        token_ttl_minutes: tokenTtlMinutes,
        launch_url: launchUrl,
        created_at: dayjs().toISOString(),
      });

      return {
        sessionId,
        tokens,
        token: studentToken,
        launchUrl,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async claimSession(input: ClaimSessionInput): Promise<{
    sessionId: string;
    accessSignature: string;
    expiresIn: number;
    tokenExpiresAt: string | null;
    role: Role;
    bindingId: string;
    launchUrl: string | null;
    whitelist: string[];
  }> {
    const fingerprintSource =
      input.deviceFingerprint?.trim() || input.deviceBindingId?.trim() || input.ipAddress || "unknown-device";

    const client = await dbPool.connect();
    try {
      await client.query("BEGIN");

      const tokenResult = await client.query<{
        token: string;
        claimed: boolean;
        exam_session_id: string;
        status: string;
        expires_at: Date | null;
        role: "student" | "admin";
      }>(
        `
          SELECT st.token, st.claimed, st.exam_session_id, es.status, st.expires_at, st.role
          FROM session_tokens st
          JOIN exam_sessions es ON es.id = st.exam_session_id
          WHERE st.token = $1
          FOR UPDATE
        `,
        [input.token]
      );

      if (tokenResult.rowCount === 0) {
        throw new ApiError(404, "Token not found");
      }

      const tokenRow = tokenResult.rows[0];
      if (toBoolean(tokenRow.claimed)) {
        throw new ApiError(409, "Token already claimed");
      }

      if (tokenRow.expires_at && Date.now() > new Date(tokenRow.expires_at).getTime()) {
        throw new ApiError(410, "Token expired");
      }

      if (["LOCKED", "REVOKED", "FINISHED"].includes(tokenRow.status)) {
        throw new ApiError(409, `Session is ${tokenRow.status}`);
      }

      const role = tokenRow.role;
      const requestedRole = input.roleHint?.trim().toLowerCase();
      if (requestedRole && requestedRole !== role) {
        throw new ApiError(409, `Token role mismatch. Expected ${role}, received ${requestedRole}.`);
      }
      const bindingId = uuidv4();
      const fingerprintHash = this.hashFingerprint(fingerprintSource);

      await client.query(
        `
          UPDATE session_tokens
          SET claimed = TRUE, claimed_at = now()
          WHERE token = $1
        `,
        [input.token]
      );

      await client.query(
        `
          INSERT INTO device_bindings
            (id, token, role, device_fingerprint, ip_address, signature_version, risk_score, locked, created_at, last_seen_at)
          VALUES
            ($1, $2, $3, $4, $5, 1, 0, FALSE, now(), now())
        `,
        [bindingId, input.token, role, fingerprintHash, input.ipAddress ?? null]
      );

      if (role === "student") {
        const pinTemplateResult = await client.query<{
          pin_hash: string;
          effective_date: string;
          updated_by_binding_id: string | null;
        }>(
          `
            SELECT pin_hash, DATE_FORMAT(effective_date, '%Y-%m-%d') AS effective_date, updated_by_binding_id
            FROM session_student_pin_templates
            WHERE exam_session_id = $1
            LIMIT 1
          `,
          [tokenRow.exam_session_id]
        );

        if ((pinTemplateResult.rowCount ?? 0) > 0) {
          const pinTemplate = pinTemplateResult.rows[0];
          await client.query(
            `
              INSERT INTO session_proctor_pins
                (exam_session_id, binding_id, pin_hash, effective_date, updated_by_binding_id, updated_at)
              VALUES
                ($1, $2, $3, $4, $5, now())
              ON DUPLICATE KEY UPDATE
                pin_hash = VALUES(pin_hash),
                effective_date = VALUES(effective_date),
                updated_by_binding_id = VALUES(updated_by_binding_id),
                updated_at = NOW()
            `,
            [
              tokenRow.exam_session_id,
              bindingId,
              pinTemplate.pin_hash,
              pinTemplate.effective_date,
              pinTemplate.updated_by_binding_id,
            ]
          );
        }
      }

      await client.query(
        `
          UPDATE exam_sessions
          SET status = CASE WHEN status = 'ACTIVE' THEN 'IN_PROGRESS' ELSE status END
          WHERE id = $1
        `,
        [tokenRow.exam_session_id]
      );

      const accessSignature = signAccessSignature({
        sid: tokenRow.exam_session_id,
        bid: bindingId,
        ver: 1,
        role,
      });

      const launchUrl = await this.getLaunchUrlBySession(client, tokenRow.exam_session_id);
      const whitelist = await this.getWhitelistBySession(client, tokenRow.exam_session_id);

      await client.query("COMMIT");

      this.wsHub.broadcast("session_claimed", {
        session_id: tokenRow.exam_session_id,
        binding_id: bindingId,
        role,
        at: dayjs().toISOString(),
      });

      return {
        sessionId: tokenRow.exam_session_id,
        accessSignature,
        expiresIn: config.accessSignatureTtlSeconds,
        tokenExpiresAt: tokenRow.expires_at ? dayjs(tokenRow.expires_at).toISOString() : null,
        role,
        bindingId,
        launchUrl,
        whitelist,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async handleHeartbeat(input: HeartbeatInput): Promise<{
    accepted: boolean;
    lock: boolean;
    rotateSignature?: string;
    message: string;
    whitelist: string[];
  }> {
    const client = await dbPool.connect();
    try {
      await client.query("BEGIN");
      const auth = await this.authenticate(client, input.session_id, input.access_signature, input.device_binding_id);

      if (auth.locked || ["LOCKED", "REVOKED", "FINISHED"].includes(auth.sessionStatus)) {
        const whitelist = await this.getWhitelistBySession(client, auth.sessionId);
        await client.query("COMMIT");
        return {
          accepted: false,
          lock: true,
          message: "session already locked",
          whitelist,
        };
      }

      const eventRisk = calculateRisk({
        focus: input.focus,
        multi_window: input.multi_window,
        network_state: input.network_state,
        overlay_detected: input.overlay_detected,
        accessibility_active: input.accessibility_active,
        debug_detected: input.debug_detected,
        emulator_detected: input.emulator_detected,
        rooted: input.rooted,
      });

      const incomingRisk = input.risk_score ?? 0;
      const nextRisk = Math.max(auth.riskScore + eventRisk, incomingRisk);
      const shouldLock = nextRisk >= config.riskLockThreshold;

      await client.query(
        `
          UPDATE device_bindings
          SET risk_score = $2,
              last_seen_at = now(),
              locked = CASE WHEN $3 THEN TRUE ELSE locked END,
              lock_reason = CASE WHEN $3 THEN $4 ELSE lock_reason END
          WHERE id = $1
        `,
        [auth.bindingId, nextRisk, shouldLock, shouldLock ? "RISK_THRESHOLD" : null]
      );

      await client.query(
        `
          INSERT INTO heartbeats
            (binding_id, focus, multi_window, risk_score, network_state, payload, created_at)
          VALUES
            ($1, $2, $3, $4, $5, $6, now())
        `,
        [
          auth.bindingId,
          input.focus,
          input.multi_window,
          nextRisk,
          input.network_state ?? null,
          JSON.stringify(input),
        ]
      );

      if (shouldLock) {
        await client.query(
          `
            UPDATE exam_sessions
            SET status = 'LOCKED'
            WHERE id = $1 AND status NOT IN ('FINISHED', 'REVOKED')
          `,
          [auth.sessionId]
        );
      }

      let rotateSignature: string | undefined;
      if (!shouldLock && this.shouldRotate(auth.exp)) {
        rotateSignature = await this.rotateSignature(client, auth.bindingId, auth.sessionId, auth.role);
      }

      const whitelist = await this.getWhitelistBySession(client, auth.sessionId);
      await client.query("COMMIT");

      this.wsHub.broadcast("heartbeat", {
        session_id: auth.sessionId,
        binding_id: auth.bindingId,
        risk_score: nextRisk,
        locked: shouldLock,
        focus: input.focus,
        multi_window: input.multi_window,
      });

      if (shouldLock) {
        this.wsHub.broadcast("session_locked", {
          session_id: auth.sessionId,
          binding_id: auth.bindingId,
          reason: "RISK_THRESHOLD",
          risk_score: nextRisk,
        });
      }

      return {
        accepted: true,
        lock: shouldLock,
        rotateSignature,
        message: shouldLock ? "session locked by risk threshold" : "heartbeat ok",
        whitelist,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async reportEvent(input: EventInput): Promise<{
    accepted: boolean;
    lock: boolean;
    riskScore: number;
    message: string;
  }> {
    const client = await dbPool.connect();
    try {
      await client.query("BEGIN");

      const auth = await this.authenticate(client, input.session_id, input.access_signature);
      const baseSeverity = input.severity ?? violationSeverityFromType(input.event_type);
      const nextRisk = Math.max(auth.riskScore + baseSeverity, input.risk_score ?? 0);
      const shouldLock = nextRisk >= config.riskLockThreshold;

      await client.query(
        `
          INSERT INTO violations (binding_id, type, severity, metadata, created_at)
          VALUES ($1, $2, $3, $4, now())
        `,
        [
          auth.bindingId,
          input.event_type,
          baseSeverity,
          JSON.stringify({ detail: input.detail ?? "", ...input.metadata }),
        ]
      );

      await client.query(
        `
          UPDATE device_bindings
          SET risk_score = $2,
              locked = CASE WHEN $3 THEN TRUE ELSE locked END,
              lock_reason = CASE WHEN $3 THEN $4 ELSE lock_reason END,
              last_seen_at = now()
          WHERE id = $1
        `,
        [auth.bindingId, nextRisk, shouldLock, shouldLock ? `VIOLATION:${input.event_type}` : null]
      );

      if (shouldLock) {
        await client.query(
          `
            UPDATE exam_sessions
            SET status = 'LOCKED'
            WHERE id = $1 AND status NOT IN ('FINISHED', 'REVOKED')
          `,
          [auth.sessionId]
        );
      }

      await client.query("COMMIT");

      this.wsHub.broadcast("violation", {
        session_id: auth.sessionId,
        binding_id: auth.bindingId,
        event_type: input.event_type,
        detail: input.detail,
        severity: baseSeverity,
        risk_score: nextRisk,
      });

      if (shouldLock) {
        this.wsHub.broadcast("session_locked", {
          session_id: auth.sessionId,
          binding_id: auth.bindingId,
          reason: `VIOLATION:${input.event_type}`,
          risk_score: nextRisk,
        });
      }

      return {
        accepted: true,
        lock: shouldLock,
        riskScore: nextRisk,
        message: shouldLock ? "session locked by violation" : "event recorded",
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getWhitelist(sessionId: string): Promise<string[]> {
    const client = await dbPool.connect();
    try {
      return await this.getWhitelistBySession(client, sessionId);
    } finally {
      client.release();
    }
  }

  async addWhitelistUrl(sessionId: string, accessSignature: string, rawUrl: string): Promise<void> {
    const client = await dbPool.connect();
    try {
      await client.query("BEGIN");
      await this.authenticate(client, sessionId, accessSignature);
      const normalized = normalizeUrl(rawUrl);

      await client.query(
        `
          INSERT IGNORE INTO session_whitelist (exam_session_id, url)
          VALUES ($1, $2)
        `,
        [sessionId, normalized]
      );

      await client.query("COMMIT");
      this.wsHub.broadcast("whitelist_updated", {
        session_id: sessionId,
        action: "added",
        url: normalized,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async verifyWhitelistUrl(sessionId: string, accessSignature: string, rawUrl: string): Promise<boolean> {
    const client = await dbPool.connect();
    try {
      await this.authenticate(client, sessionId, accessSignature);
      const whitelist = await this.getWhitelistBySession(client, sessionId);
      return isWhitelisted(rawUrl, whitelist);
    } finally {
      client.release();
    }
  }

  async setProctorPin(
    sessionId: string,
    accessSignature: string,
    rawPin: string
  ): Promise<{ effectiveDate: string }> {
    const client = await dbPool.connect();
    try {
      await client.query("BEGIN");
      const auth = await this.authenticate(client, sessionId, accessSignature);
      if (auth.role === "student") {
        throw new ApiError(403, "Student role cannot set proctor pin");
      }

      const pin = rawPin.trim();
      if (pin.length < 4) {
        throw new ApiError(400, "Proctor PIN must be at least 4 digits");
      }

      const pinHash = this.hashFingerprint(`pin:${pin}`);
      await client.query(
        `
          INSERT INTO session_student_pin_templates
            (exam_session_id, pin_hash, effective_date, updated_by_binding_id, updated_at)
          VALUES
            ($1, $2, CURRENT_DATE, $3, now())
          ON DUPLICATE KEY UPDATE
            pin_hash = VALUES(pin_hash),
            effective_date = CURRENT_DATE,
            updated_by_binding_id = VALUES(updated_by_binding_id),
            updated_at = NOW()
        `,
        [sessionId, pinHash, auth.bindingId]
      );

      await client.query(
        `
          INSERT INTO session_proctor_pins
            (exam_session_id, binding_id, pin_hash, effective_date, updated_by_binding_id, updated_at)
          SELECT
            $1,
            db.id,
            $2,
            CURRENT_DATE,
            $3,
            now()
          FROM device_bindings db
          JOIN session_tokens st ON st.token = db.token
          WHERE st.exam_session_id = $1
            AND db.role = 'student'
          ON DUPLICATE KEY UPDATE
            pin_hash = VALUES(pin_hash),
            effective_date = CURRENT_DATE,
            updated_by_binding_id = VALUES(updated_by_binding_id),
            updated_at = NOW()
        `,
        [sessionId, pinHash, auth.bindingId]
      );

      await client.query("COMMIT");

      const effectiveDate = dayjs().format("YYYY-MM-DD");
      this.wsHub.broadcast("proctor_pin_updated", {
        session_id: sessionId,
        effective_date: effectiveDate,
      });
      return { effectiveDate };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async verifyProctorPin(
    sessionId: string,
    accessSignature: string,
    rawPin: string
  ): Promise<{ valid: boolean; reason?: string; effectiveDate?: string }> {
    const client = await dbPool.connect();
    try {
      const auth = await this.authenticate(client, sessionId, accessSignature);
      const result = await client.query<{
        pin_hash: string;
        effective_date: string;
        is_active_today: number | boolean;
      }>(
        `
          SELECT
            pin_hash,
            DATE_FORMAT(effective_date, '%Y-%m-%d') AS effective_date,
            CASE WHEN effective_date = CURRENT_DATE THEN 1 ELSE 0 END AS is_active_today
          FROM session_proctor_pins
          WHERE exam_session_id = $1
            AND binding_id = $2
          LIMIT 1
        `,
        [sessionId, auth.bindingId]
      );

      if (result.rowCount === 0) {
        return { valid: false, reason: "PIN_NOT_SET" };
      }

      const row = result.rows[0];
      if (!toBoolean(row.is_active_today)) {
        return {
          valid: false,
          reason: "PIN_EXPIRED",
          effectiveDate: row.effective_date,
        };
      }

      const pinHash = this.hashFingerprint(`pin:${rawPin.trim()}`);
      if (pinHash !== row.pin_hash) {
        return {
          valid: false,
          reason: "PIN_INVALID",
          effectiveDate: row.effective_date,
        };
      }

      return {
        valid: true,
        effectiveDate: row.effective_date,
      };
    } finally {
      client.release();
    }
  }

  async getProctorPinStatus(
    sessionId: string,
    accessSignature: string
  ): Promise<{ configured: boolean; effectiveDate?: string; isActiveToday: boolean }> {
    const client = await dbPool.connect();
    try {
      const auth = await this.authenticate(client, sessionId, accessSignature);
      if (auth.role !== "student") {
        const templateResult = await client.query<{
          effective_date: string;
          is_active_today: number | boolean;
        }>(
          `
            SELECT
              DATE_FORMAT(effective_date, '%Y-%m-%d') AS effective_date,
              CASE WHEN effective_date = CURRENT_DATE THEN 1 ELSE 0 END AS is_active_today
            FROM session_student_pin_templates
            WHERE exam_session_id = $1
            LIMIT 1
          `,
          [sessionId]
        );

        if (templateResult.rowCount === 0) {
          return {
            configured: false,
            isActiveToday: false,
          };
        }

        return {
          configured: true,
          effectiveDate: templateResult.rows[0].effective_date,
          isActiveToday: toBoolean(templateResult.rows[0].is_active_today),
        };
      }

      const result = await client.query<{
        effective_date: string;
        is_active_today: number | boolean;
      }>(
        `
          SELECT
            DATE_FORMAT(effective_date, '%Y-%m-%d') AS effective_date,
            CASE WHEN effective_date = CURRENT_DATE THEN 1 ELSE 0 END AS is_active_today
          FROM session_proctor_pins
          WHERE exam_session_id = $1
            AND binding_id = $2
          LIMIT 1
        `,
        [sessionId, auth.bindingId]
      );

      if (result.rowCount === 0) {
        return {
          configured: false,
          isActiveToday: false,
        };
      }

      return {
        configured: true,
        effectiveDate: result.rows[0].effective_date,
        isActiveToday: toBoolean(result.rows[0].is_active_today),
      };
    } finally {
      client.release();
    }
  }

  async getLaunchConfig(
    sessionId: string,
    accessSignature: string
  ): Promise<{
    launchUrl: string | null;
    provider: string | null;
    lockToHost: boolean;
  }> {
    const client = await dbPool.connect();
    try {
      await this.authenticate(client, sessionId, accessSignature);
      const row = await client.query<{
        launch_url: string;
        provider: string | null;
        lock_to_host: number | boolean;
      }>(
        `
          SELECT launch_url, provider, lock_to_host
          FROM session_browser_targets
          WHERE exam_session_id = $1
          LIMIT 1
        `,
        [sessionId]
      );

      if (row.rowCount === 0) {
        return {
          launchUrl: null,
          provider: null,
          lockToHost: true,
        };
      }

      return {
        launchUrl: row.rows[0].launch_url,
        provider: row.rows[0].provider,
        lockToHost: toBoolean(row.rows[0].lock_to_host),
      };
    } finally {
      client.release();
    }
  }

  async updateLaunchUrl(sessionId: string, accessSignature: string, rawLaunchUrl: string): Promise<{
    launchUrl: string;
    provider: string;
    lockToHost: boolean;
  }> {
    const client = await dbPool.connect();
    try {
      await client.query("BEGIN");
      const auth = await this.authenticate(client, sessionId, accessSignature);
      if (auth.role === "student") {
        throw new ApiError(403, "Student role cannot modify launch URL");
      }

      const launchUrl = normalizeUrl(rawLaunchUrl);
      const provider = detectProvider(launchUrl);

      await client.query(
        `
          INSERT INTO session_browser_targets (exam_session_id, launch_url, provider, lock_to_host, created_at, updated_at)
          VALUES ($1, $2, $3, TRUE, now(), now())
          ON DUPLICATE KEY UPDATE
            launch_url = VALUES(launch_url),
            provider = VALUES(provider),
            lock_to_host = TRUE,
            updated_at = NOW()
        `,
        [sessionId, launchUrl, provider]
      );

      await client.query(
        `
          INSERT IGNORE INTO session_whitelist (exam_session_id, url)
          VALUES ($1, $2)
        `,
        [sessionId, launchUrl]
      );

      await client.query("COMMIT");

      this.wsHub.broadcast("launch_url_updated", {
        session_id: sessionId,
        launch_url: launchUrl,
        provider,
      });

      return {
        launchUrl,
        provider,
        lockToHost: true,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async finishSession(sessionId: string, accessSignature: string): Promise<void> {
    const client = await dbPool.connect();
    try {
      await client.query("BEGIN");
      await this.authenticate(client, sessionId, accessSignature);

      await client.query(
        `
          UPDATE exam_sessions
          SET status = 'FINISHED', end_time = now()
          WHERE id = $1
        `,
        [sessionId]
      );

      await client.query(
        `
          UPDATE device_bindings
          SET locked = TRUE, lock_reason = 'SESSION_FINISHED'
          WHERE token IN (SELECT token FROM session_tokens WHERE exam_session_id = $1)
        `,
        [sessionId]
      );

      await client.query("COMMIT");
      this.wsHub.broadcast("session_finished", { session_id: sessionId });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async revokeSession(sessionId: string, accessSignature: string, reason: string): Promise<void> {
    const client = await dbPool.connect();
    try {
      await client.query("BEGIN");
      const auth = await this.authenticate(client, sessionId, accessSignature);
      if (auth.role === "student") {
        throw new ApiError(403, "Student role cannot revoke session");
      }

      await client.query(
        `
          UPDATE exam_sessions
          SET status = 'REVOKED', end_time = now()
          WHERE id = $1
        `,
        [sessionId]
      );

      await client.query(
        `
          UPDATE device_bindings
          SET locked = TRUE, lock_reason = $2
          WHERE token IN (SELECT token FROM session_tokens WHERE exam_session_id = $1)
        `,
        [sessionId, reason]
      );

      await client.query("COMMIT");
      this.wsHub.broadcast("session_revoked", {
        session_id: sessionId,
        reason,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async lockTimedOutSessions(): Promise<Array<{ sessionId: string; bindingId: string; reason: string }>> {
    const client = await dbPool.connect();
    try {
      await client.query("BEGIN");

      const staleResult = await client.query<{ binding_id: string; session_id: string }>(
        `
          SELECT db.id AS binding_id, st.exam_session_id AS session_id
          FROM device_bindings db
          JOIN session_tokens st ON st.token = db.token
          JOIN exam_sessions es ON es.id = st.exam_session_id
          WHERE db.locked = FALSE
            AND es.status IN ('ACTIVE', 'IN_PROGRESS')
            AND db.last_seen_at < DATE_SUB(NOW(), INTERVAL $1 SECOND)
        `,
        [config.heartbeatTimeoutSeconds]
      );

      if (staleResult.rowCount === 0) {
        await client.query("COMMIT");
        return [];
      }

      const bindingIds = staleResult.rows.map((row) => row.binding_id);
      const sessionIds = Array.from(new Set(staleResult.rows.map((row) => row.session_id)));

      const bindingIn = this.buildInClause(bindingIds, 1);
      await client.query(
        `
          UPDATE device_bindings
          SET locked = TRUE,
              lock_reason = 'HEARTBEAT_TIMEOUT'
          WHERE id IN (${bindingIn.clause})
        `,
        bindingIn.params
      );

      const sessionIn = this.buildInClause(sessionIds, 1);
      await client.query(
        `
          UPDATE exam_sessions
          SET status = 'LOCKED'
          WHERE id IN (${sessionIn.clause})
            AND status NOT IN ('FINISHED', 'REVOKED')
        `,
        sessionIn.params
      );

      await client.query("COMMIT");

      return staleResult.rows.map((row) => ({
        sessionId: row.session_id,
        bindingId: row.binding_id,
        reason: "HEARTBEAT_TIMEOUT",
      }));
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async archiveAndCleanupEndedSessions(): Promise<Array<{ sessionId: string; status: string }>> {
    const client = await dbPool.connect();
    try {
      await client.query("BEGIN");

      const endedResult = await client.query<{ session_id: string; status: string }>(
        `
          SELECT id AS session_id, status
          FROM exam_sessions
          WHERE status IN ('FINISHED', 'REVOKED')
            AND end_time IS NOT NULL
            AND end_time <= DATE_SUB(NOW(), INTERVAL $1 SECOND)
          ORDER BY end_time ASC
          LIMIT $2
          FOR UPDATE SKIP LOCKED
        `,
        [config.sessionArchiveGraceSeconds, config.sessionCleanupBatchSize]
      );

      if (endedResult.rowCount === 0) {
        await client.query("COMMIT");
        return [];
      }

      const archived: Array<{ sessionId: string; status: string }> = [];

      for (const row of endedResult.rows) {
        const archivePayload = await this.buildSessionArchivePayload(client, row.session_id);
        await client.query(
          `
            INSERT INTO session_cleanup_audit (exam_session_id, session_status, archive_payload)
            VALUES ($1, $2, $3)
          `,
          [row.session_id, row.status, JSON.stringify(archivePayload)]
        );

        await client.query(
          `
            DELETE FROM exam_sessions
            WHERE id = $1
          `,
          [row.session_id]
        );

        archived.push({
          sessionId: row.session_id,
          status: row.status,
        });
      }

      await client.query("COMMIT");
      return archived;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async authenticate(
    client: DbClient,
    sessionId: string,
    accessSignature: string,
    expectedBindingId?: string
  ): Promise<BindingAuthContext> {
    let payload;
    try {
      payload = verifyAccessSignature(accessSignature);
    } catch {
      throw new ApiError(401, "Invalid access signature");
    }

    if (payload.sid !== sessionId) {
      throw new ApiError(401, "Session mismatch in signature");
    }

    if (expectedBindingId && payload.bid !== expectedBindingId) {
      throw new ApiError(401, "Binding mismatch in signature");
    }

    const rowResult = await client.query<{
      binding_id: string;
      session_id: string;
      role: Role;
      risk_score: number;
      locked: number | boolean;
      session_status: string;
      signature_version: number;
    }>(
      `
        SELECT
          db.id AS binding_id,
          st.exam_session_id AS session_id,
          db.role,
          db.risk_score,
          db.locked,
          es.status AS session_status,
          db.signature_version
        FROM device_bindings db
        JOIN session_tokens st ON st.token = db.token
        JOIN exam_sessions es ON es.id = st.exam_session_id
        WHERE db.id = $1
        LIMIT 1
      `,
      [payload.bid]
    );

    if (rowResult.rowCount === 0) {
      throw new ApiError(401, "Binding not found");
    }

    const row = rowResult.rows[0];
    if (row.session_id !== sessionId) {
      throw new ApiError(401, "Binding is not tied to requested session");
    }

    if (row.signature_version !== payload.ver) {
      throw new ApiError(401, "Access signature rotated, refresh required");
    }

    return {
      bindingId: row.binding_id,
      sessionId: row.session_id,
      role: row.role,
      riskScore: row.risk_score,
      locked: toBoolean(row.locked),
      sessionStatus: row.session_status,
      signatureVersion: row.signature_version,
      exp: payload.exp,
    };
  }

  private async rotateSignature(
    client: DbClient,
    bindingId: string,
    sessionId: string,
    role: Role
  ): Promise<string> {
    await client.query(
      `
        UPDATE device_bindings
        SET signature_version = signature_version + 1
        WHERE id = $1
      `,
      [bindingId]
    );

    const versionResult = await client.query<{ signature_version: number }>(
      `
        SELECT signature_version
        FROM device_bindings
        WHERE id = $1
        LIMIT 1
      `,
      [bindingId]
    );

    const version = versionResult.rows[0].signature_version;
    return signAccessSignature({ sid: sessionId, bid: bindingId, ver: version, role });
  }

  private shouldRotate(exp?: number): boolean {
    if (!exp) return false;
    const nowSeconds = Math.floor(Date.now() / 1000);
    return exp - nowSeconds <= 60;
  }

  private async getWhitelistBySession(client: DbClient, sessionId: string): Promise<string[]> {
    const result = await client.query<{ url: string }>(
      `
        SELECT url
        FROM session_whitelist
        WHERE exam_session_id = $1
        ORDER BY created_at ASC
      `,
      [sessionId]
    );

    return result.rows.map((row) => row.url);
  }

  private async getLaunchUrlBySession(client: DbClient, sessionId: string): Promise<string | null> {
    const result = await client.query<{ launch_url: string }>(
      `
        SELECT launch_url
        FROM session_browser_targets
        WHERE exam_session_id = $1
        LIMIT 1
      `,
      [sessionId]
    );

    if (result.rowCount === 0) {
      return null;
    }
    return result.rows[0].launch_url;
  }

  private generateSessionToken(role: "student" | "admin"): string {
    const prefix = role === "admin" ? "A-" : "S-";
    return `${prefix}${uuidv4().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
  }

  private hashFingerprint(value: string): string {
    return crypto.createHash("sha256").update(value).digest("hex");
  }

  private async buildSessionArchivePayload(client: DbClient, sessionId: string): Promise<Record<string, unknown>> {
    const examSessionResult = await client.query<Record<string, unknown>>(
      `
        SELECT *
        FROM exam_sessions
        WHERE id = $1
        LIMIT 1
      `,
      [sessionId]
    );

    const sessionTokensResult = await client.query<Record<string, unknown>>(
      `
        SELECT *
        FROM session_tokens
        WHERE exam_session_id = $1
      `,
      [sessionId]
    );

    const deviceBindingsResult = await client.query<Record<string, unknown>>(
      `
        SELECT db.*
        FROM device_bindings db
        JOIN session_tokens st ON st.token = db.token
        WHERE st.exam_session_id = $1
      `,
      [sessionId]
    );

    const bindingIds = deviceBindingsResult.rows
      .map((row) => String(row.id ?? ""))
      .filter((value) => value.length > 0);

    let heartbeatRows: Record<string, unknown>[] = [];
    let violationRows: Record<string, unknown>[] = [];
    if (bindingIds.length > 0) {
      const inBindings = this.buildInClause(bindingIds, 1);
      const heartbeatsResult = await client.query<Record<string, unknown>>(
        `
          SELECT *
          FROM heartbeats
          WHERE binding_id IN (${inBindings.clause})
        `,
        inBindings.params
      );
      heartbeatRows = heartbeatsResult.rows;

      const violationsResult = await client.query<Record<string, unknown>>(
        `
          SELECT *
          FROM violations
          WHERE binding_id IN (${inBindings.clause})
        `,
        inBindings.params
      );
      violationRows = violationsResult.rows;
    }

    const whitelistResult = await client.query<Record<string, unknown>>(
      `
        SELECT *
        FROM session_whitelist
        WHERE exam_session_id = $1
      `,
      [sessionId]
    );

    const browserTargetResult = await client.query<Record<string, unknown>>(
      `
        SELECT *
        FROM session_browser_targets
        WHERE exam_session_id = $1
        LIMIT 1
      `,
      [sessionId]
    );

    const proctorPinsResult = await client.query<Record<string, unknown>>(
      `
        SELECT *
        FROM session_proctor_pins
        WHERE exam_session_id = $1
      `,
      [sessionId]
    );

    const studentPinTemplateResult = await client.query<Record<string, unknown>>(
      `
        SELECT *
        FROM session_student_pin_templates
        WHERE exam_session_id = $1
        LIMIT 1
      `,
      [sessionId]
    );

    return {
      exam_session: examSessionResult.rows[0] ?? null,
      session_tokens: sessionTokensResult.rows,
      device_bindings: deviceBindingsResult.rows,
      heartbeats: heartbeatRows,
      violations: violationRows,
      whitelist: whitelistResult.rows,
      browser_target: browserTargetResult.rows[0] ?? null,
      proctor_pins: proctorPinsResult.rows,
      student_pin_template: studentPinTemplateResult.rows[0] ?? {},
    };
  }

  private buildInClause(values: string[], startIndex: number): { clause: string; params: string[] } {
    if (values.length === 0) {
      return { clause: "NULL", params: [] };
    }
    const placeholders = values.map((_, index) => `$${startIndex + index}`).join(", ");
    return {
      clause: placeholders,
      params: values,
    };
  }
}

function normalizeUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new ApiError(400, "URL is required");
  }
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    return value === "1" || value.toLowerCase() === "true";
  }
  return Boolean(value);
}

function isWhitelisted(rawTargetUrl: string, whitelist: string[]): boolean {
  try {
    const target = new URL(normalizeUrl(rawTargetUrl));
    return whitelist.some((allowedRaw) => {
      const allowed = new URL(normalizeUrl(allowedRaw));
      const targetHost = target.host.toLowerCase();
      const allowedHost = allowed.host.toLowerCase();
      return (
        targetHost === allowedHost ||
        target.href.startsWith(allowed.href) ||
        isSameTrustedHostFamily(targetHost, allowedHost)
      );
    });
  } catch {
    return false;
  }
}

function isSameTrustedHostFamily(targetHost: string, allowedHost: string): boolean {
  const allowedGoogleFamily =
    allowedHost === "google.com" ||
    allowedHost === "www.google.com" ||
    allowedHost.endsWith(".google.com") ||
    allowedHost === "forms.gle";
  if (!allowedGoogleFamily) {
    return false;
  }

  return (
    targetHost === "google.com" ||
    targetHost === "www.google.com" ||
    targetHost.endsWith(".google.com") ||
    targetHost === "forms.gle"
  );
}

function detectProvider(launchUrl: string): string {
  try {
    const hostname = new URL(launchUrl).hostname.toLowerCase();
    if (hostname.includes("docs.google.com") || hostname.includes("forms.google.com")) {
      return "google_forms";
    }
    return "web";
  } catch {
    return "web";
  }
}
