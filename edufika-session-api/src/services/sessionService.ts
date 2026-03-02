import crypto from "node:crypto";
import dayjs from "dayjs";
import { v4 as uuidv4 } from "uuid";
import { config } from "../config";
import { dbPool, DbClient } from "../db/pool";
import { calculateRisk, violationSeverityFromType } from "../risk/score";
import { signAccessSignature, verifyAccessSignature } from "./tokenService";
import { WsHub } from "./wsHub";

type Role = "student" | "admin" | "developer";
type SessionState = "ACTIVE" | "IN_PROGRESS" | "DEGRADED" | "SUSPENDED" | "PAUSED" | "LOCKED" | "REVOKED" | "FINISHED";

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
  deviceName?: string;
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
  heartbeat_seq?: number;
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

type ReconnectInput = {
  session_id: string;
  device_binding_id: string;
  token?: string;
  device_fingerprint?: string;
  access_signature?: string;
  reason?: string;
};

type BindingAuthContext = {
  bindingId: string;
  sessionId: string;
  role: Role;
  riskScore: number;
  locked: boolean;
  sessionStatus: SessionState;
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
    const requestedTokenCount = Math.max(2, input.tokenCount ?? 2);
    const studentTokenCount = Math.max(1, requestedTokenCount - 1);
    const sessionId = uuidv4();
    const generatedTokenSet = new Set<string>();
    const nextUniqueToken = (role: "student" | "admin"): string => {
      let token = this.generateSessionToken(role);
      while (generatedTokenSet.has(token)) {
        token = this.generateSessionToken(role);
      }
      generatedTokenSet.add(token);
      return token;
    };
    const studentTokens = Array.from({ length: studentTokenCount }, () => nextUniqueToken("student"));
    const adminToken = nextUniqueToken("admin");
    const tokens = [...studentTokens, adminToken];

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
        ...studentTokens.map((token) => ({ role: "student" as const, token })),
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
        token: studentTokens[0],
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
      const role = tokenRow.role;
      const requestedRole = input.roleHint?.trim().toLowerCase();
      if (requestedRole && requestedRole !== role) {
        throw new ApiError(409, `Token role mismatch. Expected ${role}, received ${requestedRole}.`);
      }
      const fingerprintHash = this.hashFingerprint(fingerprintSource);

      if (tokenRow.expires_at && Date.now() > new Date(tokenRow.expires_at).getTime()) {
        throw new ApiError(410, "Token expired");
      }

      if (["LOCKED", "REVOKED", "FINISHED"].includes(tokenRow.status)) {
        throw new ApiError(409, `Session is ${tokenRow.status}`);
      }

      let bindingId = uuidv4();
      let reclaimedAdminBinding = false;

      if (toBoolean(tokenRow.claimed)) {
        if (role !== "admin") {
          throw new ApiError(409, "Token already claimed");
        }

        const existingBindingResult = await client.query<{
          binding_id: string;
          device_fingerprint: string | null;
        }>(
          `
            SELECT db.id AS binding_id, db.device_fingerprint
            FROM device_bindings db
            WHERE db.token = $1
              AND db.role = 'admin'
            ORDER BY db.created_at DESC
            LIMIT 1
            FOR UPDATE
          `,
          [input.token]
        );

        if (existingBindingResult.rowCount === 0) {
          throw new ApiError(409, "Admin token is already claimed but binding is missing");
        }

        const existingBinding = existingBindingResult.rows[0];
        if (existingBinding.device_fingerprint && existingBinding.device_fingerprint !== fingerprintHash) {
          throw new ApiError(409, "Admin token is bound to another device");
        }

        bindingId = existingBinding.binding_id;
        reclaimedAdminBinding = true;
        await client.query(
          `
            UPDATE device_bindings
            SET locked = FALSE,
                lock_reason = NULL,
                device_fingerprint = COALESCE(device_fingerprint, $2),
                last_seen_at = now()
            WHERE id = $1
          `,
          [bindingId, fingerprintHash]
        );
      } else {
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
              (id, token, role, device_fingerprint, ip_address, device_name, signature_version, risk_score, locked, created_at, last_seen_at)
            VALUES
              ($1, $2, $3, $4, $5, $6, 1, 0, FALSE, now(), now())
          `,
          [bindingId, input.token, role, fingerprintHash, input.ipAddress ?? null, input.deviceName?.trim() || null]
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
                AND student_token = $2
              LIMIT 1
            `,
            [tokenRow.exam_session_id, tokenRow.token]
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
      }

      await client.query(
        `
          UPDATE exam_sessions
          SET status = CASE WHEN status = 'ACTIVE' THEN 'IN_PROGRESS' ELSE status END
          WHERE id = $1
        `,
        [tokenRow.exam_session_id]
      );

      const accessSignature = reclaimedAdminBinding
        ? await this.rotateSignature(client, bindingId, tokenRow.exam_session_id, role)
        : signAccessSignature({
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
    sessionState: SessionState;
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
          sessionState: auth.sessionStatus,
        };
      }

      if (auth.sessionStatus === "PAUSED") {
        const whitelist = await this.getWhitelistBySession(client, auth.sessionId);
        await client.query(
          `
            UPDATE device_bindings
            SET last_seen_at = now()
            WHERE id = $1
          `,
          [auth.bindingId]
        );
        await client.query("COMMIT");
        return {
          accepted: false,
          lock: false,
          message: "session paused by proctor",
          whitelist,
          sessionState: "PAUSED",
        };
      }

      let nextSessionState: SessionState = auth.sessionStatus;
      if (auth.sessionStatus === "DEGRADED" || auth.sessionStatus === "SUSPENDED") {
        await this.setSessionState(client, auth.sessionId, "IN_PROGRESS");
        nextSessionState = "IN_PROGRESS";
        this.wsHub.broadcast("session_recovered", {
          session_id: auth.sessionId,
          binding_id: auth.bindingId,
          reason: "HEARTBEAT_RECOVERED",
          at: dayjs().toISOString(),
        });
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
              locked = CASE WHEN $3 THEN TRUE ELSE FALSE END,
              lock_reason = CASE WHEN $3 THEN $4 ELSE NULL END
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
        await this.setSessionState(client, auth.sessionId, "LOCKED");
        nextSessionState = "LOCKED";
      } else if (nextSessionState === "ACTIVE") {
        await this.setSessionState(client, auth.sessionId, "IN_PROGRESS");
        nextSessionState = "IN_PROGRESS";
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
        session_state: nextSessionState,
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
        sessionState: nextSessionState,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async reconnectSession(input: ReconnectInput): Promise<{
    accessSignature: string;
    expiresIn: number;
    whitelist: string[];
    sessionState: SessionState;
    message: string;
  }> {
    const client = await dbPool.connect();
    try {
      await client.query("BEGIN");

      const bindingResult = await client.query<{
        binding_id: string;
        session_id: string;
        token: string;
        role: Role;
        device_fingerprint: string;
        locked: number | boolean;
        lock_reason: string | null;
        session_status: SessionState;
      }>(
        `
          SELECT
            db.id AS binding_id,
            st.exam_session_id AS session_id,
            st.token,
            db.role,
            db.device_fingerprint,
            db.locked,
            db.lock_reason,
            es.status AS session_status
          FROM device_bindings db
          JOIN session_tokens st ON st.token = db.token
          JOIN exam_sessions es ON es.id = st.exam_session_id
          WHERE db.id = $1
            AND st.exam_session_id = $2
          LIMIT 1
          FOR UPDATE
        `,
        [input.device_binding_id, input.session_id]
      );

      if (bindingResult.rowCount === 0) {
        throw new ApiError(404, "Device binding not found");
      }

      const row = bindingResult.rows[0];

      if (input.token?.trim() && input.token.trim() !== row.token) {
        throw new ApiError(401, "Token mismatch for reconnect");
      }

      if (input.device_fingerprint?.trim()) {
        const providedHash = this.hashFingerprint(input.device_fingerprint.trim());
        if (providedHash !== row.device_fingerprint) {
          throw new ApiError(401, "Device fingerprint mismatch");
        }
      }

      if (row.session_status === "FINISHED" || row.session_status === "REVOKED" || row.session_status === "LOCKED") {
        throw new ApiError(409, `Session is ${row.session_status}`);
      }

      if (row.locked && row.lock_reason && row.lock_reason !== "HEARTBEAT_TIMEOUT") {
        throw new ApiError(409, `Binding is locked (${row.lock_reason})`);
      }

      await client.query(
        `
          UPDATE device_bindings
          SET locked = FALSE,
              lock_reason = NULL,
              last_seen_at = now()
          WHERE id = $1
        `,
        [row.binding_id]
      );

      let nextSessionState: SessionState = row.session_status;
      if (
        row.role === "student" &&
        (row.session_status === "DEGRADED" || row.session_status === "SUSPENDED" || row.session_status === "ACTIVE")
      ) {
        await this.setSessionState(client, row.session_id, "IN_PROGRESS");
        nextSessionState = "IN_PROGRESS";
      }

      let reconnectAuth: BindingAuthContext | null = null;
      if (input.access_signature?.trim()) {
        reconnectAuth = await this.authenticateOrNull(
          client,
          input.session_id,
          input.access_signature.trim(),
          input.device_binding_id
        );
      }

      const role = reconnectAuth?.role ?? row.role;
      const accessSignature = await this.rotateSignature(client, row.binding_id, row.session_id, role);
      const whitelist = await this.getWhitelistBySession(client, row.session_id);
      await client.query("COMMIT");

      this.wsHub.broadcast("session_reconnected", {
        session_id: row.session_id,
        binding_id: row.binding_id,
        reason: input.reason ?? "CLIENT_RECONNECT",
        session_state: nextSessionState,
        at: dayjs().toISOString(),
      });

      return {
        accessSignature,
        expiresIn: config.accessSignatureTtlSeconds,
        whitelist,
        sessionState: nextSessionState,
        message: "reconnect accepted",
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
        await this.setSessionState(client, auth.sessionId, "LOCKED");
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
    rawPin: string,
    studentToken?: string
  ): Promise<{ effectiveDate: string; studentToken: string }> {
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

      const target = await this.resolveStudentPinTarget(client, sessionId, studentToken);
      const pinHash = this.hashFingerprint(`pin:${pin}`);
      await client.query(
        `
          INSERT INTO session_student_pin_templates
            (exam_session_id, student_token, pin_hash, effective_date, updated_by_binding_id, updated_at)
          VALUES
            ($1, $2, $3, CURRENT_DATE, $4, now())
          ON DUPLICATE KEY UPDATE
            student_token = VALUES(student_token),
            pin_hash = VALUES(pin_hash),
            effective_date = CURRENT_DATE,
            updated_by_binding_id = VALUES(updated_by_binding_id),
            updated_at = NOW()
        `,
        [sessionId, target.studentToken, pinHash, auth.bindingId]
      );

      if (target.bindingId) {
        await client.query(
          `
            INSERT INTO session_proctor_pins
              (exam_session_id, binding_id, pin_hash, effective_date, updated_by_binding_id, updated_at)
            VALUES
              ($1, $2, $3, CURRENT_DATE, $4, now())
            ON DUPLICATE KEY UPDATE
              pin_hash = VALUES(pin_hash),
              effective_date = CURRENT_DATE,
              updated_by_binding_id = VALUES(updated_by_binding_id),
              updated_at = NOW()
          `,
          [sessionId, target.bindingId, pinHash, auth.bindingId]
        );
      }

      await client.query("COMMIT");

      const effectiveDate = dayjs().format("YYYY-MM-DD");
      this.wsHub.broadcast("proctor_pin_updated", {
        session_id: sessionId,
        student_token: target.studentToken,
        effective_date: effectiveDate,
      });
      return {
        effectiveDate,
        studentToken: target.studentToken,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async setProctorPinForAll(
    sessionId: string,
    accessSignature: string,
    rawPin: string
  ): Promise<{ effectiveDate: string; updatedTokens: number }> {
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

      const studentCountResult = await client.query<{ total: number }>(
        `
          SELECT COUNT(*) AS total
          FROM session_tokens
          WHERE exam_session_id = $1
            AND role = 'student'
        `,
        [sessionId]
      );
      const studentCount = Number(studentCountResult.rows[0]?.total ?? 0);
      if (studentCount <= 0) {
        throw new ApiError(404, "Student token not found for session");
      }

      const pinHash = this.hashFingerprint(`pin:${pin}`);

      await client.query(
        `
          INSERT INTO session_student_pin_templates
            (exam_session_id, student_token, pin_hash, effective_date, updated_by_binding_id, updated_at)
          SELECT
            st.exam_session_id,
            st.token,
            $1,
            CURRENT_DATE,
            $2,
            now()
          FROM session_tokens st
          WHERE st.exam_session_id = $3
            AND st.role = 'student'
          ON DUPLICATE KEY UPDATE
            student_token = VALUES(student_token),
            pin_hash = VALUES(pin_hash),
            effective_date = CURRENT_DATE,
            updated_by_binding_id = VALUES(updated_by_binding_id),
            updated_at = NOW()
        `,
        [pinHash, auth.bindingId, sessionId]
      );

      await client.query(
        `
          INSERT INTO session_proctor_pins
            (exam_session_id, binding_id, pin_hash, effective_date, updated_by_binding_id, updated_at)
          SELECT
            st.exam_session_id,
            db.id,
            $1,
            CURRENT_DATE,
            $2,
            now()
          FROM session_tokens st
          JOIN device_bindings db ON db.token = st.token
          WHERE st.exam_session_id = $3
            AND st.role = 'student'
            AND db.role = 'student'
          ON DUPLICATE KEY UPDATE
            pin_hash = VALUES(pin_hash),
            effective_date = CURRENT_DATE,
            updated_by_binding_id = VALUES(updated_by_binding_id),
            updated_at = NOW()
        `,
        [pinHash, auth.bindingId, sessionId]
      );

      await client.query("COMMIT");

      const effectiveDate = dayjs().format("YYYY-MM-DD");
      this.wsHub.broadcast("proctor_pin_updated", {
        session_id: sessionId,
        student_token: "ALL",
        effective_date: effectiveDate,
        updated_tokens: studentCount,
      });

      return {
        effectiveDate,
        updatedTokens: studentCount,
      };
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
    accessSignature: string,
    studentToken?: string
  ): Promise<{ configured: boolean; effectiveDate?: string; isActiveToday: boolean; studentToken?: string }> {
    const client = await dbPool.connect();
    try {
      const auth = await this.authenticate(client, sessionId, accessSignature);
      if (auth.role !== "student") {
        const requestedStudentToken = studentToken?.trim();
        if (requestedStudentToken) {
          const target = await this.resolveStudentPinTarget(client, sessionId, requestedStudentToken);
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
                AND student_token = $2
              LIMIT 1
            `,
            [sessionId, target.studentToken]
          );

          if (templateResult.rowCount === 0) {
            return {
              configured: false,
              isActiveToday: false,
              studentToken: target.studentToken,
            };
          }

          return {
            configured: true,
            effectiveDate: templateResult.rows[0].effective_date,
            isActiveToday: toBoolean(templateResult.rows[0].is_active_today),
            studentToken: target.studentToken,
          };
        }

        const templateResult = await client.query<{
          student_token: string;
          effective_date: string;
          is_active_today: number | boolean;
        }>(
          `
            SELECT
              student_token,
              DATE_FORMAT(effective_date, '%Y-%m-%d') AS effective_date,
              CASE WHEN effective_date = CURRENT_DATE THEN 1 ELSE 0 END AS is_active_today
            FROM session_student_pin_templates
            WHERE exam_session_id = $1
            ORDER BY updated_at DESC
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
          studentToken: templateResult.rows[0].student_token,
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

  async revokeStudentToken(
    sessionId: string,
    accessSignature: string,
    studentToken: string,
    reason?: string
  ): Promise<{ studentToken: string; bindingIds: string[]; reason: string }> {
    const client = await dbPool.connect();
    const normalizedToken = studentToken.trim().toUpperCase();
    const lockReason = reason?.trim() || "ADMIN_FORCE_LOGOUT";

    try {
      await client.query("BEGIN");
      const auth = await this.authenticate(client, sessionId, accessSignature);
      if (auth.role === "student") {
        throw new ApiError(403, "Student role cannot revoke student token");
      }

      const tokenResult = await client.query<{ token: string }>(
        `
          SELECT token
          FROM session_tokens
          WHERE exam_session_id = $1
            AND token = $2
            AND role = 'student'
          LIMIT 1
          FOR UPDATE
        `,
        [sessionId, normalizedToken]
      );

      if (tokenResult.rowCount === 0) {
        throw new ApiError(404, "Student token not found in this exam session");
      }

      await client.query(
        `
          UPDATE session_tokens
          SET claimed = TRUE,
              claimed_at = COALESCE(claimed_at, now()),
              expires_at = CASE
                WHEN expires_at IS NULL OR expires_at > now() THEN now()
                ELSE expires_at
              END
          WHERE exam_session_id = $1
            AND token = $2
            AND role = 'student'
        `,
        [sessionId, normalizedToken]
      );

      const bindingRows = await client.query<{ binding_id: string }>(
        `
          SELECT db.id AS binding_id
          FROM device_bindings db
          JOIN session_tokens st ON st.token = db.token
          WHERE st.exam_session_id = $1
            AND st.token = $2
            AND db.role = 'student'
          FOR UPDATE
        `,
        [sessionId, normalizedToken]
      );

      if ((bindingRows.rowCount ?? 0) > 0) {
        await client.query(
          `
            UPDATE device_bindings db
            JOIN session_tokens st ON st.token = db.token
            SET db.locked = TRUE,
                db.lock_reason = $3,
                db.signature_version = db.signature_version + 1,
                db.last_seen_at = now()
            WHERE st.exam_session_id = $1
              AND st.token = $2
              AND db.role = 'student'
          `,
          [sessionId, normalizedToken, lockReason]
        );
      }

      await client.query("COMMIT");
      this.wsHub.broadcast("student_session_revoked", {
        session_id: sessionId,
        student_token: normalizedToken,
        binding_ids: bindingRows.rows.map((row) => row.binding_id),
        by: auth.bindingId,
        reason: lockReason,
        at: dayjs().toISOString(),
      });

      return {
        studentToken: normalizedToken,
        bindingIds: bindingRows.rows.map((row) => row.binding_id),
        reason: lockReason,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getSessionMonitor(
    sessionId: string,
    accessSignature: string
  ): Promise<{
    sessionId: string;
    sessionState: SessionState;
    tokens: Array<{
      token: string;
      role: string;
      status: "issued" | "online" | "offline" | "revoked" | "expired";
      claimed: boolean;
      claimedAt: string | null;
      expiresAt: string | null;
      bindingId: string | null;
      ipAddress: string | null;
      deviceName: string | null;
      lastSeenAt: string | null;
      lockReason: string | null;
    }>;
  }> {
    const client = await dbPool.connect();
    try {
      const auth = await this.authenticate(client, sessionId, accessSignature);
      if (auth.role === "student") {
        throw new ApiError(403, "Student role cannot access monitor data");
      }

      const rows = await client.query<{
        token: string;
        role: string;
        claimed: number | boolean;
        claimed_at: Date | string | null;
        expires_at: Date | string | null;
        binding_id: string | null;
        ip_address: string | null;
        device_name: string | null;
        last_seen_at: Date | string | null;
        locked: number | boolean | null;
        lock_reason: string | null;
        stale_seconds: number | null;
      }>(
        `
          SELECT
            st.token,
            st.role,
            st.claimed,
            st.claimed_at,
            st.expires_at,
            db.id AS binding_id,
            db.ip_address,
            db.device_name,
            db.last_seen_at,
            db.locked,
            db.lock_reason,
            TIMESTAMPDIFF(SECOND, db.last_seen_at, NOW()) AS stale_seconds
          FROM session_tokens st
          LEFT JOIN device_bindings db ON db.token = st.token
          WHERE st.exam_session_id = $1
          ORDER BY st.role ASC, st.token ASC
        `,
        [sessionId]
      );

      const nowMs = Date.now();
      const tokens = rows.rows.map((row) => {
        const expiresAtMs = row.expires_at ? new Date(row.expires_at).getTime() : null;
        const locked = toBoolean(row.locked);
        const staleSeconds = Number(row.stale_seconds ?? 0);

        let status: "issued" | "online" | "offline" | "revoked" | "expired";
        if (expiresAtMs !== null && nowMs >= expiresAtMs) {
          status = "expired";
        } else if (locked) {
          status = "revoked";
        } else if (!toBoolean(row.claimed) || !row.binding_id) {
          status = "issued";
        } else if (staleSeconds > config.heartbeatTimeoutSeconds) {
          status = "offline";
        } else {
          status = "online";
        }

        return {
          token: row.token,
          role: row.role,
          status,
          claimed: toBoolean(row.claimed),
          claimedAt: row.claimed_at ? dayjs(row.claimed_at).toISOString() : null,
          expiresAt: row.expires_at ? dayjs(row.expires_at).toISOString() : null,
          bindingId: row.binding_id,
          ipAddress: row.ip_address ?? null,
          deviceName: row.device_name ?? null,
          lastSeenAt: row.last_seen_at ? dayjs(row.last_seen_at).toISOString() : null,
          lockReason: row.lock_reason ?? null,
        };
      });

      return {
        sessionId,
        sessionState: auth.sessionStatus,
        tokens,
      };
    } finally {
      client.release();
    }
  }

  async pauseSession(sessionId: string, accessSignature: string): Promise<void> {
    const client = await dbPool.connect();
    try {
      await client.query("BEGIN");
      const auth = await this.authenticate(client, sessionId, accessSignature);
      if (auth.role === "student") {
        throw new ApiError(403, "Student role cannot pause session");
      }
      await this.setSessionState(client, sessionId, "PAUSED");
      await client.query("COMMIT");
      this.wsHub.broadcast("session_paused", {
        session_id: sessionId,
        by: auth.bindingId,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async resumeSession(sessionId: string, accessSignature: string): Promise<void> {
    const client = await dbPool.connect();
    try {
      await client.query("BEGIN");
      const auth = await this.authenticate(client, sessionId, accessSignature);
      if (auth.role === "student") {
        throw new ApiError(403, "Student role cannot resume session");
      }
      await this.setSessionState(client, sessionId, "IN_PROGRESS");
      await client.query("COMMIT");
      this.wsHub.broadcast("session_resumed", {
        session_id: sessionId,
        by: auth.bindingId,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async reissueStudentSignature(
    sessionId: string,
    accessSignature: string,
    studentBindingId?: string
  ): Promise<{ bindingId: string; accessSignature: string; expiresIn: number; sessionState: SessionState }> {
    const client = await dbPool.connect();
    try {
      await client.query("BEGIN");
      const auth = await this.authenticate(client, sessionId, accessSignature);
      if (auth.role === "student") {
        throw new ApiError(403, "Student role cannot reissue signature");
      }

      const targetBindingId = await this.resolveStudentBindingId(client, sessionId, studentBindingId);
      const signature = await this.rotateSignature(client, targetBindingId, sessionId, "student");
      await client.query(
        `
          UPDATE device_bindings
          SET locked = FALSE,
              lock_reason = NULL,
              last_seen_at = now()
          WHERE id = $1
        `,
        [targetBindingId]
      );
      await this.setSessionState(client, sessionId, "IN_PROGRESS");
      await client.query("COMMIT");

      this.wsHub.broadcast("signature_reissued", {
        session_id: sessionId,
        binding_id: targetBindingId,
        by: auth.bindingId,
      });

      return {
        bindingId: targetBindingId,
        accessSignature: signature,
        expiresIn: config.accessSignatureTtlSeconds,
        sessionState: "IN_PROGRESS",
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async lockTimedOutSessions(): Promise<Array<{ sessionId: string; bindingId: string; reason: string; state: SessionState }>> {
    const client = await dbPool.connect();
    try {
      await client.query("BEGIN");

      const staleResult = await client.query<{
        binding_id: string;
        session_id: string;
        session_status: SessionState;
        stale_seconds: number;
      }>(
        `
          SELECT
            db.id AS binding_id,
            st.exam_session_id AS session_id,
            es.status AS session_status,
            TIMESTAMPDIFF(SECOND, db.last_seen_at, NOW()) AS stale_seconds
          FROM device_bindings db
          JOIN session_tokens st ON st.token = db.token
          JOIN exam_sessions es ON es.id = st.exam_session_id
          WHERE db.role = 'student'
            AND st.role = 'student'
            AND db.locked = FALSE
            AND es.status IN ('ACTIVE', 'IN_PROGRESS', 'DEGRADED', 'SUSPENDED')
        `
      );

      if (staleResult.rowCount === 0) {
        await client.query("COMMIT");
        return [];
      }

      const transitions: Array<{ sessionId: string; bindingId: string; reason: string; state: SessionState }> = [];
      for (const row of staleResult.rows) {
        const staleSeconds = Number(row.stale_seconds ?? 0);
        const currentState = row.session_status;
        let nextState: SessionState | null = null;
        let reason = "HEARTBEAT_OK";

        if (staleSeconds >= config.heartbeatLockSeconds) {
          reason = "HEARTBEAT_TIMEOUT";
          await client.query(
            `
              UPDATE device_bindings
              SET locked = TRUE, lock_reason = 'HEARTBEAT_TIMEOUT'
              WHERE id = $1
            `,
            [row.binding_id]
          );
          // Lock only the stale binding so other student/unclaimed tokens in the same
          // session can continue to operate.
          continue;
        } else if (staleSeconds >= config.heartbeatSuspendSeconds) {
          nextState = "SUSPENDED";
          reason = "HEARTBEAT_STALE_SUSPENDED";
        } else if (staleSeconds >= config.heartbeatTimeoutSeconds) {
          nextState = "DEGRADED";
          reason = "HEARTBEAT_STALE_DEGRADED";
        } else if (currentState === "DEGRADED" || currentState === "SUSPENDED") {
          nextState = "IN_PROGRESS";
          reason = "HEARTBEAT_RECOVERED";
        }

        if (!nextState || nextState === currentState) {
          continue;
        }

        await this.setSessionState(client, row.session_id, nextState);
        transitions.push({
          sessionId: row.session_id,
          bindingId: row.binding_id,
          reason,
          state: nextState,
        });
      }

      await client.query("COMMIT");

      return transitions;
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
      session_status: SessionState;
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

  private async authenticateOrNull(
    client: DbClient,
    sessionId: string,
    accessSignature: string,
    expectedBindingId?: string
  ): Promise<BindingAuthContext | null> {
    try {
      return await this.authenticate(client, sessionId, accessSignature, expectedBindingId);
    } catch {
      return null;
    }
  }

  private async setSessionState(client: DbClient, sessionId: string, state: SessionState): Promise<void> {
    if (state === "FINISHED" || state === "REVOKED") {
      await client.query(
        `
          UPDATE exam_sessions
          SET status = $2,
              end_time = now()
          WHERE id = $1
        `,
        [sessionId, state]
      );
      return;
    }

    await client.query(
      `
        UPDATE exam_sessions
        SET status = $2
        WHERE id = $1
          AND status NOT IN ('FINISHED', 'REVOKED')
      `,
      [sessionId, state]
    );
  }

  private async resolveStudentBindingId(
    client: DbClient,
    sessionId: string,
    requestedBindingId?: string
  ): Promise<string> {
    const explicit = requestedBindingId?.trim();
    if (explicit) {
      const check = await client.query<{ binding_id: string }>(
        `
          SELECT db.id AS binding_id
          FROM device_bindings db
          JOIN session_tokens st ON st.token = db.token
          WHERE db.id = $1
            AND st.exam_session_id = $2
            AND db.role = 'student'
          LIMIT 1
        `,
        [explicit, sessionId]
      );
      if (check.rowCount === 0) {
        throw new ApiError(404, "Requested student binding not found in session");
      }
      return explicit;
    }

    const students = await client.query<{ binding_id: string }>(
      `
        SELECT db.id AS binding_id
        FROM device_bindings db
        JOIN session_tokens st ON st.token = db.token
        WHERE st.exam_session_id = $1
          AND db.role = 'student'
        ORDER BY db.created_at DESC
        LIMIT 2
      `,
      [sessionId]
    );

    if (students.rowCount === 0) {
      throw new ApiError(404, "Student binding not found for session");
    }
    if (students.rowCount > 1) {
      throw new ApiError(400, "Multiple student bindings found. Provide student_binding_id.");
    }
    return students.rows[0].binding_id;
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

  private async resolveStudentPinTarget(
    client: DbClient,
    sessionId: string,
    providedStudentToken?: string
  ): Promise<{ studentToken: string; bindingId: string | null }> {
    const explicitToken = providedStudentToken?.trim();
    if (explicitToken) {
      return this.loadStudentPinTarget(client, sessionId, explicitToken);
    }

    const tokenResult = await client.query<{ token: string }>(
      `
        SELECT token
        FROM session_tokens
        WHERE exam_session_id = $1
          AND role = 'student'
        ORDER BY token ASC
        LIMIT 2
      `,
      [sessionId]
    );

    if (tokenResult.rowCount === 0) {
      throw new ApiError(404, "Student token not found for session");
    }
    if (tokenResult.rowCount > 1) {
      throw new ApiError(400, "Multiple student tokens exist. Provide student_token.");
    }

    return this.loadStudentPinTarget(client, sessionId, tokenResult.rows[0].token);
  }

  private async loadStudentPinTarget(
    client: DbClient,
    sessionId: string,
    studentToken: string
  ): Promise<{ studentToken: string; bindingId: string | null }> {
    const targetResult = await client.query<{
      token: string;
      binding_id: string | null;
    }>(
      `
        SELECT st.token, db.id AS binding_id
        FROM session_tokens st
        LEFT JOIN device_bindings db ON db.token = st.token AND db.role = 'student'
        WHERE st.exam_session_id = $1
          AND st.token = $2
          AND st.role = 'student'
        LIMIT 1
      `,
      [sessionId, studentToken]
    );

    if (targetResult.rowCount === 0) {
      throw new ApiError(404, "Student token not found in this exam session");
    }

    return {
      studentToken: targetResult.rows[0].token,
      bindingId: targetResult.rows[0].binding_id ?? null,
    };
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
      student_pin_templates: studentPinTemplateResult.rows,
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
