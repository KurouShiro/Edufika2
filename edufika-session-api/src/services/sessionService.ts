import crypto from "node:crypto";
import dayjs from "dayjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { config } from "../config";
import { dbPool, DbClient } from "../db/pool";
import { calculateRisk, violationSeverityFromType } from "../risk/score";
import { signAccessSignature, verifyAccessSignature } from "./tokenService";
import { WsHub } from "./wsHub";

type Role = "student" | "admin" | "developer";
type SessionState = "ACTIVE" | "IN_PROGRESS" | "DEGRADED" | "SUSPENDED" | "PAUSED" | "LOCKED" | "REVOKED" | "FINISHED";
type ExamMode = "BROWSER_LOCKDOWN" | "HYBRID" | "IN_APP_QUIZ";

type CreateSessionInput = {
  proctorId: string;
  examName?: string;
  tokenCount?: number;
  launchUrl?: string;
  tokenTtlMinutes?: number;
  examMode?: ExamMode;
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
  examMode: ExamMode;
  signatureVersion: number;
  exp?: number;
};

type QuizOptionUpsertInput = {
  key: string;
  text: string;
  isCorrect: boolean;
};

type QuizQuestionUpsertInput = {
  subjectId: number;
  questionText: string;
  questionType?: "single_choice" | "multi_choice" | "multiple_correct" | "true_false" | "matching";
  points?: number;
  ordering?: number;
  options: QuizOptionUpsertInput[];
};

type StudentAuthTokenPayload = {
  sub?: string;
  typ?: string;
  iat?: number;
  exp?: number;
};

const MAX_QUIZ_QUESTIONS_PER_SESSION = 40;

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
    examMode: ExamMode;
  }> {
    const tokenTtlMinutes = Math.max(1, input.tokenTtlMinutes ?? config.defaultTokenTtlMinutes);
    const requestedTokenCount = Math.max(2, input.tokenCount ?? 2);
    const studentTokenCount = Math.max(1, requestedTokenCount - 1);
    const examMode = input.examMode ?? "BROWSER_LOCKDOWN";
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
          INSERT INTO exam_sessions (id, exam_name, created_by, start_time, status, exam_mode)
          VALUES ($1, $2, $3, now(), 'ACTIVE', $4)
        `,
        [sessionId, input.examName ?? "Edufika Exam", input.proctorId, examMode]
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
        exam_mode: examMode,
        created_at: dayjs().toISOString(),
      });

      return {
        sessionId,
        tokens,
        token: studentTokens[0],
        launchUrl,
        examMode,
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
    examMode: ExamMode;
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
        exam_mode: ExamMode;
        expires_at: Date | null;
        role: "student" | "admin";
      }>(
        `
          SELECT st.token, st.claimed, st.exam_session_id, es.status, es.exam_mode, st.expires_at, st.role
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
        examMode: normalizeExamMode(tokenRow.exam_mode),
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async registerStudentAccount(input: {
    name: string;
    studentClass: string;
    elective: string;
    username: string;
    password: string;
    schoolYear: string;
  }): Promise<{
    student: {
      student_id: number;
      name: string;
      class: string;
      elective: string;
      username: string;
      school_year: string;
    };
  }> {
    const client = await dbPool.connect();
    try {
      const normalizedName = input.name.trim();
      const normalizedUsername = input.username.trim().toLowerCase();
      const normalizedClass = input.studentClass.trim();
      const normalizedElective = input.elective.trim();
      const normalizedSchoolYear = input.schoolYear.trim();
      if (!normalizedName || !normalizedUsername || !input.password.trim()) {
        throw new ApiError(400, "Student registration data is incomplete");
      }
      const parsedSchoolYear = dayjs(normalizedSchoolYear);
      if (!parsedSchoolYear.isValid()) {
        throw new ApiError(400, "Invalid school_year format");
      }
      const passwordHash = this.hashStudentPassword(input.password);

      const insert = await client.query(
        `
          INSERT INTO student_accounts
            (name, \`class\`, elective, username, password, school_year)
          VALUES
            ($1, $2, $3, $4, $5, $6)
        `,
        [
          normalizedName,
          normalizedClass,
          normalizedElective,
          normalizedUsername,
          passwordHash,
          parsedSchoolYear.format("YYYY-MM-DD HH:mm:ss"),
        ]
      );

      const studentId = Number(insert.insertId ?? 0);
      if (!Number.isFinite(studentId) || studentId <= 0) {
        throw new ApiError(500, "Failed to create student account");
      }

      return {
        student: {
          student_id: studentId,
          name: normalizedName,
          class: normalizedClass,
          elective: normalizedElective,
          username: normalizedUsername,
          school_year: parsedSchoolYear.toISOString(),
        },
      };
    } catch (error: any) {
      if (error?.code === "ER_DUP_ENTRY") {
        throw new ApiError(409, "Student account already exists");
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async loginStudentAccount(input: {
    username: string;
    password: string;
  }): Promise<{
    token: string;
    expiresIn: number;
    student: {
      student_id: number;
      name: string;
      class: string;
      elective: string;
      username: string;
      school_year: string;
    };
  }> {
    const client = await dbPool.connect();
    try {
      const normalizedUsername = input.username.trim().toLowerCase();
      if (!normalizedUsername || !input.password.trim()) {
        throw new ApiError(400, "Username and password are required");
      }
      const result = await client.query<{
        studentid: number;
        name: string;
        class_name: string;
        elective: string;
        username: string;
        password: string;
        school_year: string;
      }>(
        `
          SELECT studentid, name, \`class\` AS class_name, elective, username, password,
                 DATE_FORMAT(school_year, '%Y-%m-%dT%H:%i:%sZ') AS school_year
          FROM student_accounts
          WHERE username = $1
          LIMIT 1
        `,
        [normalizedUsername]
      );

      if (result.rowCount === 0) {
        throw new ApiError(401, "Invalid username or password");
      }

      const student = result.rows[0];
      const passwordHash = this.hashStudentPassword(input.password);
      if (student.password !== passwordHash) {
        throw new ApiError(401, "Invalid username or password");
      }

      const token = this.signStudentAuthToken(student.studentid);
      return {
        token,
        expiresIn: config.studentAuthTtlHours * 3600,
        student: {
          student_id: student.studentid,
          name: student.name,
          class: student.class_name,
          elective: student.elective,
          username: student.username,
          school_year: student.school_year,
        },
      };
    } finally {
      client.release();
    }
  }

  async listActiveQuizSessions(studentAuthToken?: string): Promise<
    Array<{
      session_id: string;
      exam_name: string | null;
      quiz_title: string;
      question_count: number;
      duration_minutes: number;
      status: string;
      start_time: string | null;
    }>
  > {
    await this.authenticateStudentAuthToken(studentAuthToken);
    const client = await dbPool.connect();
    try {
      const result = await client.query<{
        session_id: string;
        exam_name: string | null;
        quiz_title: string;
        question_count: number;
        duration_minutes: number;
        status: string;
        start_time: string | null;
      }>(
        `
          SELECT
            es.id AS session_id,
            es.exam_name AS exam_name,
            qe.title AS quiz_title,
            COUNT(qq.id) AS question_count,
            qe.duration_minutes AS duration_minutes,
            es.status AS status,
            DATE_FORMAT(es.start_time, '%Y-%m-%dT%H:%i:%sZ') AS start_time
          FROM exam_sessions es
          JOIN quiz_exams qe ON qe.exam_session_id = es.id
          LEFT JOIN quiz_questions qq ON qq.exam_session_id = es.id AND qq.is_active = TRUE
          WHERE es.status IN ('ACTIVE', 'IN_PROGRESS')
            AND es.exam_mode IN ('IN_APP_QUIZ', 'HYBRID')
            AND qe.published = TRUE
          GROUP BY es.id, qe.title, qe.duration_minutes, es.exam_name, es.status, es.start_time
          ORDER BY es.start_time DESC
        `
      );
      return result.rows.map((row) => ({
        session_id: row.session_id,
        exam_name: row.exam_name ?? null,
        quiz_title: row.quiz_title,
        question_count: Number(row.question_count ?? 0),
        duration_minutes: Number(row.duration_minutes ?? 0),
        status: row.status,
        start_time: row.start_time ?? null,
      }));
    } finally {
      client.release();
    }
  }

  async joinQuizSessionWithStudentAuth(input: {
    studentAuthToken?: string;
    sessionId: string;
    deviceFingerprint?: string;
    deviceName?: string;
    ipAddress?: string;
  }): Promise<{
    sessionId: string;
    accessSignature: string;
    bindingId: string;
    tokenExpiresAt: string | null;
    examMode: ExamMode;
    studentToken: string;
  }> {
    await this.authenticateStudentAuthToken(input.studentAuthToken);
    const sessionClient = await dbPool.connect();
    let examMode: ExamMode = "BROWSER_LOCKDOWN";
    try {
      const sessionResult = await sessionClient.query<{
        status: string;
        exam_mode: ExamMode;
      }>(
        `
          SELECT status, exam_mode
          FROM exam_sessions
          WHERE id = $1
          LIMIT 1
        `,
        [input.sessionId]
      );
      if (sessionResult.rowCount === 0) {
        throw new ApiError(404, "Exam session not found");
      }
      const session = sessionResult.rows[0];
      examMode = normalizeExamMode(session.exam_mode);
      if (!["IN_APP_QUIZ", "HYBRID"].includes(examMode)) {
        throw new ApiError(409, "Exam session is not configured for in-app quiz");
      }
      if (["LOCKED", "REVOKED", "FINISHED"].includes(session.status)) {
        throw new ApiError(409, `Session is ${session.status}`);
      }
    } finally {
      sessionClient.release();
    }

    const studentToken = await this.insertStudentTokenForSession(input.sessionId);
    const claimed = await this.claimSession({
      token: studentToken,
      deviceFingerprint: input.deviceFingerprint,
      deviceName: input.deviceName,
      ipAddress: input.ipAddress,
      roleHint: "student",
    });

    const assignmentClient = await dbPool.connect();
    try {
      await assignmentClient.query("BEGIN");
      const assignmentRequired = await this.checkQuizAssignmentRequired(
        assignmentClient,
        input.sessionId,
        studentToken
      );
      if (assignmentRequired) {
        await assignmentClient.query(
          `
            INSERT IGNORE INTO quiz_token_assignments
              (exam_session_id, student_token, assigned_by_binding_id, assigned_at)
            VALUES ($1, $2, $3, now())
          `,
          [input.sessionId, studentToken, claimed.bindingId]
        );
      }
      await assignmentClient.query("COMMIT");
    } catch (error) {
      await assignmentClient.query("ROLLBACK");
      throw error;
    } finally {
      assignmentClient.release();
    }

    return {
      sessionId: claimed.sessionId,
      accessSignature: claimed.accessSignature,
      bindingId: claimed.bindingId,
      tokenExpiresAt: claimed.tokenExpiresAt ?? null,
      examMode: claimed.examMode,
      studentToken,
    };
  }

  async uploadQuizResultMarkdown(input: {
    sessionId: string;
    accessSignature: string;
    fileName: string;
    markdown: string;
    metadata: Record<string, unknown>;
  }): Promise<{ file_id: string; web_view_link?: string; folder_name?: string; folder_id?: string }> {
    const client = await dbPool.connect();
    try {
      const auth = await this.authenticate(client, input.sessionId, input.accessSignature);
      if (auth.role !== "student" && auth.role !== "admin") {
        throw new ApiError(403, "Role is not allowed to upload quiz result");
      }
      const file = await this.uploadMarkdownToGoogleDrive(input.fileName, input.markdown, input.metadata);
      return file;
    } finally {
      client.release();
    }
  }

  async getGoogleDriveHealth(): Promise<{
    configured: boolean;
    connected: boolean;
    auth_mode: "oauth" | "service_account" | "unconfigured";
    scope: string;
    folder_name: string;
    folder_id: string;
    configured_folder_id: string;
    error?: string;
  }> {
    const credentialState = this.getGoogleDriveCredentialState();
    const folderName = config.googleDriveFolderName.trim() || "QuizData";
    const configuredFolderId = config.googleDriveFolderId.trim();

    if (!credentialState.configured) {
      return {
        configured: false,
        connected: false,
        auth_mode: credentialState.authMode,
        scope: config.googleDriveScope,
        folder_name: folderName,
        folder_id: "",
        configured_folder_id: configuredFolderId,
        error:
          "Google Drive credentials are not configured (set GDRIVE_CLIENT_ID/SECRET/REFRESH_TOKEN or GOOGLE_DRIVE_CLIENT_EMAIL/PRIVATE_KEY)",
      };
    }

    try {
      const driveAuth = await this.getGoogleDriveAccessToken();
      const folder = await this.resolveGoogleDriveTargetFolder(driveAuth.accessToken);
      return {
        configured: true,
        connected: true,
        auth_mode: driveAuth.authMode,
        scope: config.googleDriveScope,
        folder_name: folder.folderName,
        folder_id: folder.folderId,
        configured_folder_id: configuredFolderId,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        configured: true,
        connected: false,
        auth_mode: credentialState.authMode,
        scope: config.googleDriveScope,
        folder_name: folderName,
        folder_id: configuredFolderId,
        configured_folder_id: configuredFolderId,
        error: message,
      };
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
        if (locked) {
          status = "revoked";
        } else if (toBoolean(row.claimed) && !row.binding_id && row.role === "student") {
          // Claimed student token without an active binding is treated as revoked.
          status = "revoked";
        } else if (expiresAtMs !== null && nowMs >= expiresAtMs) {
          status = "expired";
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

  async upsertQuizConfig(input: {
    sessionId: string;
    accessSignature: string;
    title: string;
    description?: string;
    durationMinutes?: number;
    showResultsImmediately?: boolean;
    randomizeQuestions?: boolean;
    allowReview?: boolean;
  }): Promise<{
    session_id: string;
    exam_mode: ExamMode;
    quiz: {
      title: string;
      description: string | null;
      duration_minutes: number;
      show_results_immediately: boolean;
      randomize_questions: boolean;
      allow_review: boolean;
      published: boolean;
    };
  }> {
    const client = await dbPool.connect();
    try {
      await client.query("BEGIN");
      const auth = await this.authenticate(client, input.sessionId, input.accessSignature);
      this.assertAdminRole(auth);

      const nextExamMode: ExamMode = auth.examMode === "BROWSER_LOCKDOWN" ? "HYBRID" : auth.examMode;
      if (nextExamMode !== auth.examMode) {
        await client.query(
          `
            UPDATE exam_sessions
            SET exam_mode = $2
            WHERE id = $1
          `,
          [input.sessionId, nextExamMode]
        );
      }

      await client.query(
        `
          INSERT INTO quiz_exams
            (exam_session_id, title, description, duration_minutes, show_results_immediately, randomize_questions, allow_review, published, created_by_binding_id, updated_by_binding_id, created_at, updated_at)
          VALUES
            ($1, $2, $3, $4, $5, $6, $7, FALSE, $8, $8, now(), now())
          ON DUPLICATE KEY UPDATE
            title = VALUES(title),
            description = VALUES(description),
            duration_minutes = VALUES(duration_minutes),
            show_results_immediately = VALUES(show_results_immediately),
            randomize_questions = VALUES(randomize_questions),
            allow_review = VALUES(allow_review),
            updated_by_binding_id = VALUES(updated_by_binding_id),
            updated_at = NOW()
        `,
        [
          input.sessionId,
          input.title.trim(),
          input.description?.trim() || null,
          Math.max(1, input.durationMinutes ?? 60),
          input.showResultsImmediately ?? true,
          input.randomizeQuestions ?? false,
          input.allowReview ?? true,
          auth.bindingId,
        ]
      );

      await this.logTeacherSubmission(client, input.sessionId, auth.bindingId, "QUIZ_CONFIG_UPSERT", {
        title: input.title.trim(),
        duration_minutes: Math.max(1, input.durationMinutes ?? 60),
      });

      const configResult = await client.query<{
        title: string;
        description: string | null;
        duration_minutes: number;
        show_results_immediately: number | boolean;
        randomize_questions: number | boolean;
        allow_review: number | boolean;
        published: number | boolean;
      }>(
        `
          SELECT
            title,
            description,
            duration_minutes,
            show_results_immediately,
            randomize_questions,
            allow_review,
            published
          FROM quiz_exams
          WHERE exam_session_id = $1
          LIMIT 1
        `,
        [input.sessionId]
      );

      await client.query("COMMIT");

      const row = configResult.rows[0];
      return {
        session_id: input.sessionId,
        exam_mode: nextExamMode,
        quiz: {
          title: row?.title ?? input.title.trim(),
          description: row?.description ?? (input.description?.trim() || null),
          duration_minutes: row?.duration_minutes ?? Math.max(1, input.durationMinutes ?? 60),
          show_results_immediately: toBoolean(row?.show_results_immediately),
          randomize_questions: toBoolean(row?.randomize_questions),
          allow_review: toBoolean(row?.allow_review),
          published: toBoolean(row?.published),
        },
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getQuizDefinition(
    sessionId: string,
    accessSignature: string
  ): Promise<{
    session_id: string;
    exam_mode: ExamMode;
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
        options: Array<{
          id: number;
          key: string;
          text: string;
          is_correct?: boolean;
        }>;
      }>;
    }>;
    assigned_tokens: string[];
  }> {
    const client = await dbPool.connect();
    try {
      const auth = await this.authenticate(client, sessionId, accessSignature);
      const config = await this.loadQuizConfig(client, sessionId);

      const subjectRows = await client.query<{
        id: number;
        subject_code: string;
        subject_name: string;
        description: string | null;
        ordering: number;
      }>(
        `
          SELECT id, subject_code, subject_name, description, ordering
          FROM quiz_subjects
          WHERE exam_session_id = $1
          ORDER BY ordering ASC, id ASC
        `,
        [sessionId]
      );

      const questionRows = await client.query<{
        id: number;
        subject_id: number;
        question_text: string;
        question_type: string;
        points: number;
        ordering: number;
      }>(
        `
          SELECT id, subject_id, question_text, question_type, points, ordering
          FROM quiz_questions
          WHERE exam_session_id = $1
            AND is_active = TRUE
          ORDER BY subject_id ASC, ordering ASC, id ASC
        `,
        [sessionId]
      );

      const optionRows = await client.query<{
        id: number;
        question_id: number;
        option_key: string;
        option_text: string;
        is_correct: number | boolean;
        ordering: number;
      }>(
        `
          SELECT id, question_id, option_key, option_text, is_correct, ordering
          FROM quiz_question_options
          WHERE question_id IN (
            SELECT id FROM quiz_questions WHERE exam_session_id = $1 AND is_active = TRUE
          )
          ORDER BY question_id ASC, ordering ASC, id ASC
        `,
        [sessionId]
      );

      const assignedRows = await client.query<{ student_token: string }>(
        `
          SELECT student_token
          FROM quiz_token_assignments
          WHERE exam_session_id = $1
          ORDER BY student_token ASC
        `,
        [sessionId]
      );

      const optionsByQuestion = new Map<number, Array<{ id: number; key: string; text: string; is_correct?: boolean }>>();
      for (const option of optionRows.rows) {
        const optionList = optionsByQuestion.get(option.question_id) ?? [];
        optionList.push({
          id: option.id,
          key: option.option_key,
          text: option.option_text,
          ...(auth.role === "admin" ? { is_correct: toBoolean(option.is_correct) } : {}),
        });
        optionsByQuestion.set(option.question_id, optionList);
      }

      const questionsBySubject = new Map<
        number,
        Array<{
          id: number;
          question_text: string;
          question_type: string;
          points: number;
          ordering: number;
          options: Array<{ id: number; key: string; text: string; is_correct?: boolean }>;
        }>
      >();
      for (const question of questionRows.rows) {
        const questionList = questionsBySubject.get(question.subject_id) ?? [];
        questionList.push({
          id: question.id,
          question_text: question.question_text,
          question_type: question.question_type,
          points: question.points,
          ordering: question.ordering,
          options: optionsByQuestion.get(question.id) ?? [],
        });
        questionsBySubject.set(question.subject_id, questionList);
      }

      return {
        session_id: sessionId,
        exam_mode: auth.examMode,
        quiz: config
          ? {
              title: config.title,
              description: config.description,
              duration_minutes: config.duration_minutes,
              show_results_immediately: toBoolean(config.show_results_immediately),
              randomize_questions: toBoolean(config.randomize_questions),
              allow_review: toBoolean(config.allow_review),
              published: toBoolean(config.published),
            }
          : null,
        subjects: subjectRows.rows.map((subject) => ({
          id: subject.id,
          subject_code: subject.subject_code,
          subject_name: subject.subject_name,
          description: subject.description,
          ordering: subject.ordering,
          questions: questionsBySubject.get(subject.id) ?? [],
        })),
        assigned_tokens: assignedRows.rows.map((row) => row.student_token),
      };
    } finally {
      client.release();
    }
  }

  async addQuizSubject(input: {
    sessionId: string;
    accessSignature: string;
    subjectCode: string;
    subjectName: string;
    description?: string;
    ordering?: number;
  }): Promise<{ id: number; subject_code: string; subject_name: string; ordering: number }> {
    const client = await dbPool.connect();
    try {
      await client.query("BEGIN");
      const auth = await this.authenticate(client, input.sessionId, input.accessSignature);
      this.assertAdminRole(auth);
      this.assertQuizModeEnabled(auth.examMode);
      await this.ensureQuizConfigExists(client, input.sessionId, auth.bindingId);

      await client.query(
        `
          INSERT INTO quiz_subjects (exam_session_id, subject_code, subject_name, description, ordering, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, now(), now())
          ON DUPLICATE KEY UPDATE
            subject_name = VALUES(subject_name),
            description = VALUES(description),
            ordering = VALUES(ordering),
            updated_at = NOW()
        `,
        [
          input.sessionId,
          input.subjectCode.trim().toUpperCase(),
          input.subjectName.trim(),
          input.description?.trim() || null,
          input.ordering ?? 1,
        ]
      );

      const rowResult = await client.query<{
        id: number;
        subject_code: string;
        subject_name: string;
        ordering: number;
      }>(
        `
          SELECT id, subject_code, subject_name, ordering
          FROM quiz_subjects
          WHERE exam_session_id = $1
            AND subject_code = $2
          LIMIT 1
        `,
        [input.sessionId, input.subjectCode.trim().toUpperCase()]
      );

      await this.logTeacherSubmission(client, input.sessionId, auth.bindingId, "QUIZ_SUBJECT_UPSERT", {
        subject_code: input.subjectCode.trim().toUpperCase(),
        subject_name: input.subjectName.trim(),
      });

      await client.query("COMMIT");

      const row = rowResult.rows[0];
      return {
        id: row.id,
        subject_code: row.subject_code,
        subject_name: row.subject_name,
        ordering: row.ordering,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteQuizSubject(input: {
    sessionId: string;
    accessSignature: string;
    subjectId: number;
  }): Promise<{
    session_id: string;
    subject_id: number;
    deleted: boolean;
    remaining_subject_count: number;
    remaining_question_count: number;
    assigned_tokens: string[];
  }> {
    const client = await dbPool.connect();
    try {
      await client.query("BEGIN");
      const auth = await this.authenticate(client, input.sessionId, input.accessSignature);
      this.assertAdminRole(auth);
      this.assertQuizModeEnabled(auth.examMode);

      const subjectResult = await client.query<{
        id: number;
        subject_code: string;
        subject_name: string;
      }>(
        `
          SELECT id, subject_code, subject_name
          FROM quiz_subjects
          WHERE exam_session_id = $1
            AND id = $2
          LIMIT 1
        `,
        [input.sessionId, input.subjectId]
      );
      if (subjectResult.rowCount === 0) {
        throw new ApiError(404, "Quiz subject not found in this session");
      }

      await client.query(
        `
          DELETE FROM quiz_subjects
          WHERE exam_session_id = $1
            AND id = $2
        `,
        [input.sessionId, input.subjectId]
      );

      const remainingSubjectCountResult = await client.query<{ total: number }>(
        `
          SELECT COUNT(*) AS total
          FROM quiz_subjects
          WHERE exam_session_id = $1
        `,
        [input.sessionId]
      );
      const remainingQuestionCountResult = await client.query<{ total: number }>(
        `
          SELECT COUNT(*) AS total
          FROM quiz_questions
          WHERE exam_session_id = $1
            AND is_active = TRUE
        `,
        [input.sessionId]
      );

      const remainingQuestionCount = Number(remainingQuestionCountResult.rows[0]?.total ?? 0);
      if (remainingQuestionCount <= 0) {
        await client.query(
          `
            DELETE FROM quiz_token_assignments
            WHERE exam_session_id = $1
          `,
          [input.sessionId]
        );
      }

      const assignedRows = await client.query<{ student_token: string }>(
        `
          SELECT student_token
          FROM quiz_token_assignments
          WHERE exam_session_id = $1
          ORDER BY student_token ASC
        `,
        [input.sessionId]
      );

      const subjectRow = subjectResult.rows[0];
      await this.logTeacherSubmission(client, input.sessionId, auth.bindingId, "QUIZ_SUBJECT_DELETE", {
        subject_id: subjectRow.id,
        subject_code: subjectRow.subject_code,
        subject_name: subjectRow.subject_name,
      });

      await client.query("COMMIT");
      return {
        session_id: input.sessionId,
        subject_id: input.subjectId,
        deleted: true,
        remaining_subject_count: Number(remainingSubjectCountResult.rows[0]?.total ?? 0),
        remaining_question_count: remainingQuestionCount,
        assigned_tokens: assignedRows.rows.map((row) => row.student_token),
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async addQuizQuestion(input: {
    sessionId: string;
    accessSignature: string;
    subjectId: number;
    questionText: string;
    questionType?: "single_choice" | "multi_choice" | "multiple_correct" | "true_false" | "matching";
    points?: number;
    ordering?: number;
    options: QuizOptionUpsertInput[];
  }): Promise<{ question_id: number; subject_id: number; options_count: number }> {
    const client = await dbPool.connect();
    try {
      await client.query("BEGIN");
      const auth = await this.authenticate(client, input.sessionId, input.accessSignature);
      this.assertAdminRole(auth);
      this.assertQuizModeEnabled(auth.examMode);
      await this.ensureQuizConfigExists(client, input.sessionId, auth.bindingId);
      await this.assertQuizQuestionCapacity(client, input.sessionId, 1);

      await this.assertSubjectBelongsToSession(client, input.sessionId, input.subjectId);

      const questionId = await this.insertQuizQuestionWithOptions(client, input.sessionId, auth.bindingId, {
        subjectId: input.subjectId,
        questionText: input.questionText,
        questionType: input.questionType,
        points: input.points,
        ordering: input.ordering,
        options: input.options,
      });

      await this.logTeacherSubmission(client, input.sessionId, auth.bindingId, "QUIZ_QUESTION_CREATE", {
        question_id: questionId,
        subject_id: input.subjectId,
      });

      await client.query("COMMIT");
      return {
        question_id: questionId,
        subject_id: input.subjectId,
        options_count: input.options.length,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async addQuizQuestionsBulk(input: {
    sessionId: string;
    accessSignature: string;
    questions: QuizQuestionUpsertInput[];
  }): Promise<{ inserted: number; subject_ids: number[] }> {
    const client = await dbPool.connect();
    try {
      await client.query("BEGIN");
      const auth = await this.authenticate(client, input.sessionId, input.accessSignature);
      this.assertAdminRole(auth);
      this.assertQuizModeEnabled(auth.examMode);
      await this.ensureQuizConfigExists(client, input.sessionId, auth.bindingId);
      await this.assertQuizQuestionCapacity(client, input.sessionId, input.questions.length);

      const touchedSubjectIds = new Set<number>();
      for (const question of input.questions) {
        await this.assertSubjectBelongsToSession(client, input.sessionId, question.subjectId);
        await this.insertQuizQuestionWithOptions(client, input.sessionId, auth.bindingId, question);
        touchedSubjectIds.add(question.subjectId);
      }

      await this.logTeacherSubmission(client, input.sessionId, auth.bindingId, "QUIZ_QUESTION_BULK_CREATE", {
        inserted: input.questions.length,
      });

      await client.query("COMMIT");
      return {
        inserted: input.questions.length,
        subject_ids: Array.from(touchedSubjectIds),
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async setQuizPublished(
    sessionId: string,
    accessSignature: string,
    published: boolean
  ): Promise<{ session_id: string; published: boolean; total_questions: number }> {
    const client = await dbPool.connect();
    try {
      await client.query("BEGIN");
      const auth = await this.authenticate(client, sessionId, accessSignature);
      this.assertAdminRole(auth);
      this.assertQuizModeEnabled(auth.examMode);
      await this.ensureQuizConfigExists(client, sessionId, auth.bindingId);

      const questionCountResult = await client.query<{ total: number }>(
        `
          SELECT COUNT(*) AS total
          FROM quiz_questions
          WHERE exam_session_id = $1
            AND is_active = TRUE
        `,
        [sessionId]
      );
      const totalQuestions = Number(questionCountResult.rows[0]?.total ?? 0);
      if (published && totalQuestions === 0) {
        throw new ApiError(400, "Quiz must have at least one active question before publishing");
      }

      await client.query(
        `
          UPDATE quiz_exams
          SET published = $2,
              updated_by_binding_id = $3,
              updated_at = NOW()
          WHERE exam_session_id = $1
        `,
        [sessionId, published, auth.bindingId]
      );

      await this.logTeacherSubmission(client, sessionId, auth.bindingId, "QUIZ_PUBLISH_UPDATE", {
        published,
        total_questions: totalQuestions,
      });

      await client.query("COMMIT");
      return {
        session_id: sessionId,
        published,
        total_questions: totalQuestions,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async startQuizAttempt(input: {
    sessionId: string;
    accessSignature: string;
    studentName?: string;
    studentClass?: string;
    studentElective?: string;
  }): Promise<{
    attempt_id: number;
    session_id: string;
    exam_mode: ExamMode;
    status: string;
    started_at: string;
    student_profile: {
      student_name: string | null;
      student_class: string | null;
      student_elective: string | null;
    };
    quiz: {
      title: string;
      description: string | null;
      duration_minutes: number;
      show_results_immediately: boolean;
      randomize_questions: boolean;
      allow_review: boolean;
      published: boolean;
    };
    questions: Array<{
      id: number;
      subject_id: number;
      question_text: string;
      question_type: string;
      points: number;
      ordering: number;
      options: Array<{ id: number; key: string; text: string }>;
    }>;
    existing_answers: Array<{
      question_id: number;
      selected_option_ids: number[];
      text_answer: string | null;
      is_correct: boolean;
      points_awarded: number;
    }>;
  }> {
    const client = await dbPool.connect();
    try {
      await client.query("BEGIN");
      const auth = await this.authenticate(client, input.sessionId, input.accessSignature);
      if (auth.role !== "student" && auth.role !== "admin") {
        throw new ApiError(403, "Role is not allowed to start quiz attempt");
      }
      this.assertQuizModeEnabled(auth.examMode);

      const config = await this.loadQuizConfig(client, input.sessionId);
      if (!config) {
        throw new ApiError(404, "Quiz config not found for session");
      }
      if (!toBoolean(config.published) && auth.role === "student") {
        throw new ApiError(409, "Quiz is not published yet");
      }

      let studentToken: string | null = null;
      if (auth.role === "student") {
        studentToken = await this.resolveStudentTokenForBinding(client, input.sessionId, auth.bindingId);
        const assignmentRequired = await this.checkQuizAssignmentRequired(
          client,
          input.sessionId,
          studentToken
        );
        if (assignmentRequired) {
          throw new ApiError(403, "Quiz has not been assigned to this student token yet");
        }
      }

      await client.query(
        `
          INSERT INTO quiz_student_attempts
            (exam_session_id, student_binding_id, student_name, student_class, student_elective, started_at, status, score, max_score, duration_seconds)
          VALUES
            ($1, $2, $3, $4, $5, now(), 'STARTED', 0, 0, 0)
          ON DUPLICATE KEY UPDATE
            status = IF(status = 'SUBMITTED', status, 'STARTED'),
            student_name = COALESCE(NULLIF(TRIM($3), ''), student_name),
            student_class = COALESCE(NULLIF(TRIM($4), ''), student_class),
            student_elective = COALESCE(NULLIF(TRIM($5), ''), student_elective)
        `,
        [
          input.sessionId,
          auth.bindingId,
          input.studentName?.trim() || null,
          input.studentClass?.trim() || null,
          input.studentElective?.trim() || null,
        ]
      );

      const attemptResult = await client.query<{
        id: number;
        status: string;
        started_at: Date | string;
        student_name: string | null;
        student_class: string | null;
        student_elective: string | null;
      }>(
        `
          SELECT id, status, started_at, student_name, student_class, student_elective
          FROM quiz_student_attempts
          WHERE exam_session_id = $1
            AND student_binding_id = $2
          LIMIT 1
        `,
        [input.sessionId, auth.bindingId]
      );
      const attempt = attemptResult.rows[0];

      const questionRows = await client.query<{
        id: number;
        subject_id: number;
        question_text: string;
        question_type: string;
        points: number;
        ordering: number;
      }>(
        `
          SELECT id, subject_id, question_text, question_type, points, ordering
          FROM quiz_questions
          WHERE exam_session_id = $1
            AND is_active = TRUE
          ORDER BY ordering ASC, id ASC
        `, 
        [input.sessionId]
      );

      const optionRows = await client.query<{
        id: number;
        question_id: number;
        option_key: string;
        option_text: string;
        ordering: number;
      }>(
        `
          SELECT id, question_id, option_key, option_text, ordering
          FROM quiz_question_options
          WHERE question_id IN (
            SELECT id FROM quiz_questions WHERE exam_session_id = $1 AND is_active = TRUE
          )
          ORDER BY question_id ASC, ordering ASC, id ASC
        `,
        [input.sessionId]
      );

      const answerRows = await client.query<{
        question_id: number;
        selected_option_ids: string | null;
        text_answer: string | null;
        is_correct: number | boolean;
        points_awarded: string | number;
      }>(
        `
          SELECT question_id, selected_option_ids, text_answer, is_correct, points_awarded
          FROM quiz_student_answers
          WHERE attempt_id = $1
          ORDER BY question_id ASC
        `,
        [attempt.id]
      );

      await client.query("COMMIT");

      const optionsByQuestion = new Map<number, Array<{ id: number; key: string; text: string }>>();
      for (const option of optionRows.rows) {
        const list = optionsByQuestion.get(option.question_id) ?? [];
        list.push({
          id: option.id,
          key: option.option_key,
          text: option.option_text,
        });
        optionsByQuestion.set(option.question_id, list);
      }

      const questions = questionRows.rows.map((question) => ({
        id: question.id,
        subject_id: question.subject_id,
        question_text: question.question_text,
        question_type: question.question_type,
        points: question.points,
        ordering: question.ordering,
        options: optionsByQuestion.get(question.id) ?? [],
      }));

      if (toBoolean(config.randomize_questions)) {
        shuffleInPlace(questions);
      }

      return {
        attempt_id: attempt.id,
        session_id: input.sessionId,
        exam_mode: auth.examMode,
        status: attempt.status,
        started_at: dayjs(attempt.started_at).toISOString(),
        student_profile: {
          student_name: attempt.student_name ?? null,
          student_class: attempt.student_class ?? null,
          student_elective: attempt.student_elective ?? null,
        },
        quiz: {
          title: config.title,
          description: config.description,
          duration_minutes: config.duration_minutes,
          show_results_immediately: toBoolean(config.show_results_immediately),
          randomize_questions: toBoolean(config.randomize_questions),
          allow_review: toBoolean(config.allow_review),
          published: toBoolean(config.published),
        },
        questions,
        existing_answers: answerRows.rows.map((answer) => ({
          question_id: answer.question_id,
          selected_option_ids: parseJsonNumberArray(answer.selected_option_ids),
          text_answer: answer.text_answer,
          is_correct: toBoolean(answer.is_correct),
          points_awarded: Number(answer.points_awarded ?? 0),
        })),
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async submitQuizAnswer(input: {
    sessionId: string;
    accessSignature: string;
    questionId: number;
    selectedOptionIds?: number[];
    textAnswer?: string;
  }): Promise<{
    ok: boolean;
    question_id: number;
    is_correct: boolean;
    points_awarded: number;
  }> {
    const client = await dbPool.connect();
    try {
      await client.query("BEGIN");
      const auth = await this.authenticate(client, input.sessionId, input.accessSignature);
      this.assertQuizModeEnabled(auth.examMode);
      if (auth.role !== "student" && auth.role !== "admin") {
        throw new ApiError(403, "Role is not allowed to answer quiz questions");
      }

      const attemptResult = await client.query<{
        id: number;
        status: string;
      }>(
        `
          SELECT id, status
          FROM quiz_student_attempts
          WHERE exam_session_id = $1
            AND student_binding_id = $2
          LIMIT 1
        `,
        [input.sessionId, auth.bindingId]
      );
      if (attemptResult.rowCount === 0) {
        throw new ApiError(404, "Quiz attempt not found. Call /quiz/start first.");
      }
      const attempt = attemptResult.rows[0];
      if (attempt.status === "SUBMITTED") {
        throw new ApiError(409, "Quiz attempt has already been submitted");
      }

      const questionResult = await client.query<{
        id: number;
        question_type: string;
        points: number;
      }>(
        `
          SELECT id, question_type, points
          FROM quiz_questions
          WHERE id = $1
            AND exam_session_id = $2
            AND is_active = TRUE
          LIMIT 1
        `,
        [input.questionId, input.sessionId]
      );
      if (questionResult.rowCount === 0) {
        throw new ApiError(404, "Question not found in this session");
      }
      const question = questionResult.rows[0];

      const optionRows = await client.query<{
        id: number;
        is_correct: number | boolean;
      }>(
        `
          SELECT id, is_correct
          FROM quiz_question_options
          WHERE question_id = $1
          ORDER BY id ASC
        `,
        [input.questionId]
      );

      const selectedOptionIds = Array.from(new Set(input.selectedOptionIds ?? [])).sort((a, b) => a - b);
      const correctOptionIds = optionRows.rows
        .filter((option) => toBoolean(option.is_correct))
        .map((option) => option.id)
        .sort((a, b) => a - b);

      const normalizedQuestionType = String(question.question_type || "single_choice").toLowerCase();
      let isCorrect = false;
      if (
        normalizedQuestionType === "multi_choice" ||
        normalizedQuestionType === "multiple_correct" ||
        normalizedQuestionType === "matching"
      ) {
        isCorrect = selectedOptionIds.length > 0 && arraysEqual(selectedOptionIds, correctOptionIds);
      } else {
        isCorrect =
          selectedOptionIds.length === 1 &&
          correctOptionIds.length === 1 &&
          selectedOptionIds[0] === correctOptionIds[0];
      }

      const pointsAwarded = isCorrect ? Number(question.points ?? 0) : 0;

      await client.query(
        `
          INSERT INTO quiz_student_answers
            (attempt_id, question_id, selected_option_ids, text_answer, is_correct, points_awarded, answered_at)
          VALUES
            ($1, $2, $3, $4, $5, $6, now())
          ON DUPLICATE KEY UPDATE
            selected_option_ids = VALUES(selected_option_ids),
            text_answer = VALUES(text_answer),
            is_correct = VALUES(is_correct),
            points_awarded = VALUES(points_awarded),
            answered_at = NOW()
        `,
        [
          attempt.id,
          input.questionId,
          JSON.stringify(selectedOptionIds),
          input.textAnswer?.trim() || null,
          isCorrect,
          pointsAwarded,
        ]
      );

      await client.query("COMMIT");
      return {
        ok: true,
        question_id: input.questionId,
        is_correct: isCorrect,
        points_awarded: pointsAwarded,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async finishQuizAttempt(
    sessionId: string,
    accessSignature: string
  ): Promise<{
    ok: boolean;
    attempt_id: number;
    status: string;
    submitted_at: string;
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
  }> {
    const client = await dbPool.connect();
    try {
      await client.query("BEGIN");
      const auth = await this.authenticate(client, sessionId, accessSignature);
      this.assertQuizModeEnabled(auth.examMode);
      if (auth.role !== "student" && auth.role !== "admin") {
        throw new ApiError(403, "Role is not allowed to finish quiz attempt");
      }

      const config = await this.loadQuizConfig(client, sessionId);
      if (!config) {
        throw new ApiError(404, "Quiz config not found for session");
      }

      const attemptResult = await client.query<{
        id: number;
        started_at: Date | string;
        status: string;
      }>(
        `
          SELECT id, started_at, status
          FROM quiz_student_attempts
          WHERE exam_session_id = $1
            AND student_binding_id = $2
          LIMIT 1
        `,
        [sessionId, auth.bindingId]
      );
      if (attemptResult.rowCount === 0) {
        throw new ApiError(404, "Quiz attempt not found. Call /quiz/start first.");
      }
      const attempt = attemptResult.rows[0];

      const scoreResult = await client.query<{
        score: string | number;
        max_score: string | number;
      }>(
        `
          SELECT
            COALESCE(SUM(a.points_awarded), 0) AS score,
            COALESCE(SUM(q.points), 0) AS max_score
          FROM quiz_questions q
          LEFT JOIN quiz_student_answers a
            ON a.question_id = q.id
           AND a.attempt_id = $1
          WHERE q.exam_session_id = $2
            AND q.is_active = TRUE
        `,
        [attempt.id, sessionId]
      );

      const score = Number(scoreResult.rows[0]?.score ?? 0);
      const maxScore = Number(scoreResult.rows[0]?.max_score ?? 0);
      const durationSeconds = Math.max(0, Math.floor((Date.now() - new Date(attempt.started_at).getTime()) / 1000));

      await client.query(
        `
          UPDATE quiz_student_attempts
          SET submitted_at = now(),
              status = 'SUBMITTED',
              score = $2,
              max_score = $3,
              duration_seconds = $4
          WHERE id = $1
        `,
        [attempt.id, score, maxScore, durationSeconds]
      );

      const resultItemsRows = await client.query<{
        question_id: number;
        question_text: string;
        points_awarded: string | number;
        max_points: string | number;
        is_correct: number | boolean;
      }>(
        `
          SELECT
            q.id AS question_id,
            q.question_text,
            COALESCE(a.points_awarded, 0) AS points_awarded,
            q.points AS max_points,
            COALESCE(a.is_correct, FALSE) AS is_correct
          FROM quiz_questions q
          LEFT JOIN quiz_student_answers a
            ON a.question_id = q.id
           AND a.attempt_id = $1
          WHERE q.exam_session_id = $2
            AND q.is_active = TRUE
          ORDER BY q.ordering ASC, q.id ASC
        `,
        [attempt.id, sessionId]
      );

      await client.query("COMMIT");

      const showResultsImmediately = toBoolean(config.show_results_immediately) || auth.role === "admin";
      return {
        ok: true,
        attempt_id: attempt.id,
        status: "SUBMITTED",
        submitted_at: dayjs().toISOString(),
        score,
        max_score: maxScore,
        duration_seconds: durationSeconds,
        show_results_immediately: showResultsImmediately,
        result_items: showResultsImmediately
          ? resultItemsRows.rows.map((row) => ({
              question_id: row.question_id,
              question_text: row.question_text,
              points_awarded: Number(row.points_awarded ?? 0),
              max_points: Number(row.max_points ?? 0),
              is_correct: toBoolean(row.is_correct),
            }))
          : [],
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getQuizResultForCurrentBinding(
    sessionId: string,
    accessSignature: string
  ): Promise<{
    session_id: string;
    attempt_id: number | null;
    status: string | null;
    score: number;
    max_score: number;
    submitted_at: string | null;
    show_results_immediately: boolean;
    result_items: Array<{
      question_id: number;
      question_text: string;
      points_awarded: number;
      max_points: number;
      is_correct: boolean;
    }>;
  }> {
    const client = await dbPool.connect();
    try {
      const auth = await this.authenticate(client, sessionId, accessSignature);
      this.assertQuizModeEnabled(auth.examMode);

      const config = await this.loadQuizConfig(client, sessionId);
      if (!config) {
        throw new ApiError(404, "Quiz config not found for session");
      }

      const attemptResult = await client.query<{
        id: number;
        status: string;
        score: string | number;
        max_score: string | number;
        submitted_at: Date | string | null;
      }>(
        `
          SELECT id, status, score, max_score, submitted_at
          FROM quiz_student_attempts
          WHERE exam_session_id = $1
            AND student_binding_id = $2
          LIMIT 1
        `,
        [sessionId, auth.bindingId]
      );

      if (attemptResult.rowCount === 0) {
        return {
          session_id: sessionId,
          attempt_id: null,
          status: null,
          score: 0,
          max_score: 0,
          submitted_at: null,
          show_results_immediately: toBoolean(config.show_results_immediately),
          result_items: [],
        };
      }

      const attempt = attemptResult.rows[0];
      const showResultsImmediately = toBoolean(config.show_results_immediately) || auth.role === "admin";
      if (!showResultsImmediately) {
        return {
          session_id: sessionId,
          attempt_id: attempt.id,
          status: attempt.status,
          score: Number(attempt.score ?? 0),
          max_score: Number(attempt.max_score ?? 0),
          submitted_at: attempt.submitted_at ? dayjs(attempt.submitted_at).toISOString() : null,
          show_results_immediately: false,
          result_items: [],
        };
      }

      const rows = await client.query<{
        question_id: number;
        question_text: string;
        points_awarded: string | number;
        max_points: string | number;
        is_correct: number | boolean;
      }>(
        `
          SELECT
            q.id AS question_id,
            q.question_text,
            COALESCE(a.points_awarded, 0) AS points_awarded,
            q.points AS max_points,
            COALESCE(a.is_correct, FALSE) AS is_correct
          FROM quiz_questions q
          LEFT JOIN quiz_student_answers a
            ON a.question_id = q.id
           AND a.attempt_id = $1
          WHERE q.exam_session_id = $2
            AND q.is_active = TRUE
          ORDER BY q.ordering ASC, q.id ASC
        `,
        [attempt.id, sessionId]
      );

      return {
        session_id: sessionId,
        attempt_id: attempt.id,
        status: attempt.status,
        score: Number(attempt.score ?? 0),
        max_score: Number(attempt.max_score ?? 0),
        submitted_at: attempt.submitted_at ? dayjs(attempt.submitted_at).toISOString() : null,
        show_results_immediately: true,
        result_items: rows.rows.map((row) => ({
          question_id: row.question_id,
          question_text: row.question_text,
          points_awarded: Number(row.points_awarded ?? 0),
          max_points: Number(row.max_points ?? 0),
          is_correct: toBoolean(row.is_correct),
        })),
      };
    } finally {
      client.release();
    }
  }

  async getQuizResultsForSession(
    sessionId: string,
    accessSignature: string
  ): Promise<{
    session_id: string;
    exam_mode: ExamMode;
    results: Array<{
      token: string;
      binding_id: string;
      device_name: string | null;
      status: string;
      score: number;
      max_score: number;
      submitted_at: string | null;
      duration_seconds: number;
      student_name: string | null;
      student_class: string | null;
      student_elective: string | null;
    }>;
  }> {
    const client = await dbPool.connect();
    try {
      const auth = await this.authenticate(client, sessionId, accessSignature);
      this.assertAdminRole(auth);
      this.assertQuizModeEnabled(auth.examMode);

      const rows = await client.query<{
        token: string;
        binding_id: string;
        device_name: string | null;
        status: string;
        score: string | number;
        max_score: string | number;
        submitted_at: Date | string | null;
        duration_seconds: number;
        student_name: string | null;
        student_class: string | null;
        student_elective: string | null;
      }>(
        `
          SELECT
            st.token,
            qa.student_binding_id AS binding_id,
            db.device_name,
            qa.status,
            qa.score,
            qa.max_score,
            qa.submitted_at,
            qa.duration_seconds,
            qa.student_name,
            qa.student_class,
            qa.student_elective
          FROM quiz_student_attempts qa
          JOIN device_bindings db ON db.id = qa.student_binding_id
          JOIN session_tokens st ON st.token = db.token
          WHERE qa.exam_session_id = $1
            AND st.role = 'student'
          ORDER BY qa.submitted_at DESC, qa.id DESC
        `,
        [sessionId]
      );

      return {
        session_id: sessionId,
        exam_mode: auth.examMode,
        results: rows.rows.map((row) => ({
          token: row.token,
          binding_id: row.binding_id,
          device_name: row.device_name,
          status: row.status,
          score: Number(row.score ?? 0),
          max_score: Number(row.max_score ?? 0),
          submitted_at: row.submitted_at ? dayjs(row.submitted_at).toISOString() : null,
          duration_seconds: Number(row.duration_seconds ?? 0),
          student_name: row.student_name ?? null,
          student_class: row.student_class ?? null,
          student_elective: row.student_elective ?? null,
        })),
      };
    } finally {
      client.release();
    }
  }

  async assignQuizToStudentToken(input: {
    sessionId: string;
    accessSignature: string;
    studentToken: string;
    assigned: boolean;
  }): Promise<{
    session_id: string;
    student_token: string;
    assigned: boolean;
    assigned_tokens: string[];
  }> {
    const client = await dbPool.connect();
    try {
      await client.query("BEGIN");
      const auth = await this.authenticate(client, input.sessionId, input.accessSignature);
      this.assertAdminRole(auth);
      this.assertQuizModeEnabled(auth.examMode);
      const config = await this.loadQuizConfig(client, input.sessionId);
      if (!config) {
        throw new ApiError(409, "Create quiz config first before assigning tokens");
      }
      const questionCountResult = await client.query<{ total: number }>(
        `
          SELECT COUNT(*) AS total
          FROM quiz_questions
          WHERE exam_session_id = $1
            AND is_active = TRUE
        `,
        [input.sessionId]
      );
      const questionCount = Number(questionCountResult.rows[0]?.total ?? 0);
      if (questionCount <= 0) {
        throw new ApiError(409, "Add at least one active quiz question before assigning tokens");
      }
      const normalizedStudentToken = await this.ensureStudentTokenBelongsToSession(
        client,
        input.sessionId,
        input.studentToken
      );

      if (input.assigned) {
        await client.query(
          `
            INSERT INTO quiz_token_assignments
              (exam_session_id, student_token, assigned_by_binding_id, assigned_at)
            VALUES ($1, $2, $3, now())
            ON DUPLICATE KEY UPDATE
              assigned_by_binding_id = VALUES(assigned_by_binding_id),
              assigned_at = NOW()
          `,
          [input.sessionId, normalizedStudentToken, auth.bindingId]
        );
      } else {
        await client.query(
          `
            DELETE FROM quiz_token_assignments
            WHERE exam_session_id = $1
              AND student_token = $2
          `,
          [input.sessionId, normalizedStudentToken]
        );
      }

      const assignedRows = await client.query<{ student_token: string }>(
        `
          SELECT student_token
          FROM quiz_token_assignments
          WHERE exam_session_id = $1
          ORDER BY student_token ASC
        `,
        [input.sessionId]
      );

      await this.logTeacherSubmission(client, input.sessionId, auth.bindingId, "QUIZ_ASSIGN_TOKEN", {
        student_token: normalizedStudentToken,
        assigned: input.assigned,
      });

      await client.query("COMMIT");
      return {
        session_id: input.sessionId,
        student_token: normalizedStudentToken,
        assigned: input.assigned,
        assigned_tokens: assignedRows.rows.map((row) => row.student_token),
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async assignQuizToAllActiveStudentTokens(input: {
    sessionId: string;
    accessSignature: string;
  }): Promise<{
    session_id: string;
    assigned_count: number;
    assigned_tokens: string[];
  }> {
    const client = await dbPool.connect();
    try {
      await client.query("BEGIN");
      const auth = await this.authenticate(client, input.sessionId, input.accessSignature);
      this.assertAdminRole(auth);
      this.assertQuizModeEnabled(auth.examMode);
      const config = await this.loadQuizConfig(client, input.sessionId);
      if (!config) {
        throw new ApiError(409, "Create quiz config first before assigning tokens");
      }
      const questionCountResult = await client.query<{ total: number }>(
        `
          SELECT COUNT(*) AS total
          FROM quiz_questions
          WHERE exam_session_id = $1
            AND is_active = TRUE
        `,
        [input.sessionId]
      );
      const questionCount = Number(questionCountResult.rows[0]?.total ?? 0);
      if (questionCount <= 0) {
        throw new ApiError(409, "Add at least one active quiz question before assigning tokens");
      }

      const activeStudentTokensResult = await client.query<{ token: string }>(
        `
          SELECT token
          FROM session_tokens
          WHERE exam_session_id = $1
            AND role = 'student'
            AND (expires_at IS NULL OR expires_at > NOW())
          ORDER BY token ASC
        `,
        [input.sessionId]
      );
      if (activeStudentTokensResult.rowCount === 0) {
        throw new ApiError(404, "No active student tokens found in this session");
      }

      await client.query(
        `
          INSERT INTO quiz_token_assignments
            (exam_session_id, student_token, assigned_by_binding_id, assigned_at)
          SELECT
            $1,
            st.token,
            $2,
            NOW()
          FROM session_tokens st
          WHERE st.exam_session_id = $1
            AND st.role = 'student'
            AND (st.expires_at IS NULL OR st.expires_at > NOW())
          ON DUPLICATE KEY UPDATE
            assigned_by_binding_id = VALUES(assigned_by_binding_id),
            assigned_at = NOW()
        `,
        [input.sessionId, auth.bindingId]
      );

      const assignedRows = await client.query<{ student_token: string }>(
        `
          SELECT student_token
          FROM quiz_token_assignments
          WHERE exam_session_id = $1
          ORDER BY student_token ASC
        `,
        [input.sessionId]
      );

      await this.logTeacherSubmission(client, input.sessionId, auth.bindingId, "QUIZ_ASSIGN_ALL_ACTIVE_TOKENS", {
        assigned_count: activeStudentTokensResult.rows.length,
      });

      await client.query("COMMIT");
      return {
        session_id: input.sessionId,
        assigned_count: activeStudentTokensResult.rows.length,
        assigned_tokens: assignedRows.rows.map((row) => row.student_token),
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
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
      exam_mode: ExamMode | string | null;
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
          es.exam_mode,
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
      examMode: normalizeExamMode(row.exam_mode),
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

  private assertAdminRole(auth: BindingAuthContext): void {
    if (auth.role === "student") {
      throw new ApiError(403, "Student role is not authorized for this action");
    }
  }

  private assertQuizModeEnabled(examMode: ExamMode): void {
    if (examMode === "BROWSER_LOCKDOWN") {
      throw new ApiError(409, "This session is in browser-only mode. Create HYBRID or IN_APP_QUIZ session.");
    }
  }

  private async loadQuizConfig(
    client: DbClient,
    sessionId: string
  ): Promise<{
    title: string;
    description: string | null;
    duration_minutes: number;
    show_results_immediately: number | boolean;
    randomize_questions: number | boolean;
    allow_review: number | boolean;
    published: number | boolean;
  } | null> {
    const config = await client.query<{
      title: string;
      description: string | null;
      duration_minutes: number;
      show_results_immediately: number | boolean;
      randomize_questions: number | boolean;
      allow_review: number | boolean;
      published: number | boolean;
    }>(
      `
        SELECT
          title,
          description,
          duration_minutes,
          show_results_immediately,
          randomize_questions,
          allow_review,
          published
        FROM quiz_exams
        WHERE exam_session_id = $1
        LIMIT 1
      `,
      [sessionId]
    );

    if (config.rowCount === 0) {
      return null;
    }
    return config.rows[0];
  }

  private async ensureQuizConfigExists(
    client: DbClient,
    sessionId: string,
    actorBindingId: string
  ): Promise<void> {
    const existing = await this.loadQuizConfig(client, sessionId);
    if (existing) {
      return;
    }

    await client.query(
      `
        INSERT INTO quiz_exams
          (exam_session_id, title, description, duration_minutes, show_results_immediately, randomize_questions, allow_review, published, created_by_binding_id, updated_by_binding_id, created_at, updated_at)
        VALUES
          ($1, 'Edufika Quiz', NULL, 60, TRUE, FALSE, TRUE, FALSE, $2, $2, now(), now())
      `,
      [sessionId, actorBindingId]
    );
  }

  private async assertSubjectBelongsToSession(client: DbClient, sessionId: string, subjectId: number): Promise<void> {
    const subject = await client.query<{ id: number }>(
      `
        SELECT id
        FROM quiz_subjects
        WHERE id = $1
          AND exam_session_id = $2
        LIMIT 1
      `,
      [subjectId, sessionId]
    );
    if (subject.rowCount === 0) {
      throw new ApiError(404, "Subject not found in this session");
    }
  }

  private async assertQuizQuestionCapacity(
    client: DbClient,
    sessionId: string,
    incomingCount: number
  ): Promise<void> {
    const countResult = await client.query<{ total: number }>(
      `
        SELECT COUNT(*) AS total
        FROM quiz_questions
        WHERE exam_session_id = $1
          AND is_active = TRUE
      `,
      [sessionId]
    );
    const currentTotal = Number(countResult.rows[0]?.total ?? 0);
    if (currentTotal + Math.max(0, incomingCount) > MAX_QUIZ_QUESTIONS_PER_SESSION) {
      throw new ApiError(
        400,
        `Quiz question limit exceeded. Maximum ${MAX_QUIZ_QUESTIONS_PER_SESSION} active questions per session`
      );
    }
  }

  private async ensureStudentTokenBelongsToSession(
    client: DbClient,
    sessionId: string,
    studentTokenRaw: string
  ): Promise<string> {
    const studentToken = studentTokenRaw.trim().toUpperCase();
    if (!studentToken) {
      throw new ApiError(400, "Student token is required");
    }
    const row = await client.query<{ token: string }>(
      `
        SELECT token
        FROM session_tokens
        WHERE exam_session_id = $1
          AND token = $2
          AND role = 'student'
        LIMIT 1
      `,
      [sessionId, studentToken]
    );
    if (row.rowCount === 0) {
      throw new ApiError(404, "Student token not found in this session");
    }
    return row.rows[0].token;
  }

  private async resolveStudentTokenForBinding(
    client: DbClient,
    sessionId: string,
    bindingId: string
  ): Promise<string> {
    const row = await client.query<{ token: string }>(
      `
        SELECT st.token
        FROM device_bindings db
        JOIN session_tokens st ON st.token = db.token
        WHERE db.id = $1
          AND st.exam_session_id = $2
          AND st.role = 'student'
        LIMIT 1
      `,
      [bindingId, sessionId]
    );
    if (row.rowCount === 0) {
      throw new ApiError(403, "Student token binding not found for quiz attempt");
    }
    return row.rows[0].token;
  }

  private async checkQuizAssignmentRequired(
    client: DbClient,
    sessionId: string,
    studentToken: string
  ): Promise<boolean> {
    const totalAssignmentsResult = await client.query<{ total: number }>(
      `
        SELECT COUNT(*) AS total
        FROM quiz_token_assignments
        WHERE exam_session_id = $1
      `,
      [sessionId]
    );
    const totalAssignments = Number(totalAssignmentsResult.rows[0]?.total ?? 0);
    if (totalAssignments === 0) {
      return false;
    }
    const assignedResult = await client.query<{ total: number }>(
      `
        SELECT COUNT(*) AS total
        FROM quiz_token_assignments
        WHERE exam_session_id = $1
          AND student_token = $2
      `,
      [sessionId, studentToken]
    );
    const tokenAssigned = Number(assignedResult.rows[0]?.total ?? 0) > 0;
    return !tokenAssigned;
  }

  private async insertQuizQuestionWithOptions(
    client: DbClient,
    sessionId: string,
    actorBindingId: string,
    input: QuizQuestionUpsertInput
  ): Promise<number> {
    const rawType = String(input.questionType ?? "single_choice").toLowerCase();
    const normalizedType =
      rawType === "multi_choice" ||
      rawType === "multiple_correct" ||
      rawType === "true_false" ||
      rawType === "matching"
        ? rawType
        : "single_choice";

    const normalizedOptions =
      normalizedType === "true_false"
        ? (() => {
            const providedTrue = input.options.find((option) => {
              const key = option.key.trim().toUpperCase();
              return key === "TRUE" || key === "T";
            });
            const providedFalse = input.options.find((option) => {
              const key = option.key.trim().toUpperCase();
              return key === "FALSE" || key === "F";
            });
            const hasProvided = Boolean(providedTrue || providedFalse);
            const trueIsCorrect = hasProvided ? Boolean(providedTrue?.isCorrect) : true;
            const falseIsCorrect = hasProvided ? Boolean(providedFalse?.isCorrect) : false;
            return [
              { key: "TRUE", text: "True", isCorrect: trueIsCorrect },
              { key: "FALSE", text: "False", isCorrect: falseIsCorrect },
            ];
          })()
        : input.options.map((option) => ({
            key: option.key.trim().toUpperCase(),
            text: option.text.trim(),
            isCorrect: Boolean(option.isCorrect),
          }));

    if (normalizedOptions.length < 2) {
      throw new ApiError(400, "At least two options are required");
    }

    const dedupeKeySet = new Set<string>();
    for (const option of normalizedOptions) {
      if (!option.key || !option.text) {
        throw new ApiError(400, "Option key/text cannot be empty");
      }
      if (dedupeKeySet.has(option.key)) {
        throw new ApiError(400, "Duplicate option keys are not allowed");
      }
      dedupeKeySet.add(option.key);
    }

    const correctCount = normalizedOptions.filter((option) => option.isCorrect).length;
    if (correctCount === 0) {
      throw new ApiError(400, "At least one correct option is required");
    }
    if (normalizedType === "single_choice" || normalizedType === "true_false") {
      if (correctCount !== 1) {
        throw new ApiError(400, `${normalizedType} question must have exactly one correct option`);
      }
    }

    const insertQuestion = await client.query(
      `
        INSERT INTO quiz_questions
          (exam_session_id, subject_id, question_text, question_type, points, ordering, is_active, created_by_binding_id, created_at, updated_at)
        VALUES
          ($1, $2, $3, $4, $5, $6, TRUE, $7, now(), now())
      `,
      [
        sessionId,
        input.subjectId,
        input.questionText.trim(),
        normalizedType,
        Math.max(1, input.points ?? 1),
        Math.max(1, input.ordering ?? 1),
        actorBindingId,
      ]
    );
    const questionId = Number(insertQuestion.insertId ?? 0);
    if (!Number.isFinite(questionId) || questionId <= 0) {
      throw new ApiError(500, "Failed to create quiz question");
    }

    for (let index = 0; index < normalizedOptions.length; index += 1) {
      const option = normalizedOptions[index];
      await client.query(
        `
          INSERT INTO quiz_question_options
            (question_id, option_key, option_text, is_correct, ordering, created_at)
          VALUES
            ($1, $2, $3, $4, $5, now())
        `,
        [questionId, option.key, option.text, option.isCorrect, index + 1]
      );
    }

    return questionId;
  }

  private async logTeacherSubmission(
    client: DbClient,
    sessionId: string,
    bindingId: string,
    actionType: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    await client.query(
      `
        INSERT INTO quiz_teacher_submissions (exam_session_id, binding_id, action_type, payload, created_at)
        VALUES ($1, $2, $3, $4, now())
      `,
      [sessionId, bindingId, actionType, JSON.stringify(payload)]
    );
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

  private hashStudentPassword(password: string): string {
    return crypto.createHmac("sha256", config.jwtSecret).update(password).digest("base64");
  }

  private signStudentAuthToken(studentId: number): string {
    return jwt.sign(
      { sub: `student:${studentId}`, typ: "student_auth" },
      config.jwtSecret,
      {
        issuer: "edufika-session-api",
        expiresIn: config.studentAuthTtlHours * 3600,
      }
    );
  }

  private async authenticateStudentAuthToken(token?: string): Promise<{ studentId: number }> {
    const rawToken = token?.trim();
    if (!rawToken) {
      throw new ApiError(401, "Missing student auth token");
    }
    let decoded: StudentAuthTokenPayload;
    try {
      decoded = jwt.verify(rawToken, config.jwtSecret, {
        issuer: "edufika-session-api",
      }) as StudentAuthTokenPayload;
    } catch {
      throw new ApiError(401, "Invalid student auth token");
    }
    if (decoded.typ !== "student_auth" || !decoded.sub) {
      throw new ApiError(401, "Invalid student auth token");
    }
    const match = /^student:(\d+)$/.exec(decoded.sub);
    if (!match) {
      throw new ApiError(401, "Invalid student auth token");
    }
    const studentId = Number(match[1]);
    if (!Number.isFinite(studentId) || studentId <= 0) {
      throw new ApiError(401, "Invalid student auth token");
    }
    const client = await dbPool.connect();
    try {
      const result = await client.query<{ studentid: number }>(
        `
          SELECT studentid
          FROM student_accounts
          WHERE studentid = $1
          LIMIT 1
        `,
        [studentId]
      );
      if (result.rowCount === 0) {
        throw new ApiError(401, "Student account not found");
      }
    } finally {
      client.release();
    }
    return { studentId };
  }

  private async insertStudentTokenForSession(sessionId: string): Promise<string> {
    const client = await dbPool.connect();
    try {
      let token = this.generateSessionToken("student");
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const exists = await client.query<{ token: string }>(
          `SELECT token FROM session_tokens WHERE token = $1 LIMIT 1`,
          [token]
        );
        if (exists.rowCount === 0) {
          break;
        }
        token = this.generateSessionToken("student");
      }
      await client.query(
        `
          INSERT INTO session_tokens (token, exam_session_id, claimed, expires_at, role)
          VALUES ($1, $2, FALSE, DATE_ADD(NOW(), INTERVAL $3 MINUTE), 'student')
        `,
        [token, sessionId, config.defaultTokenTtlMinutes]
      );
      return token;
    } finally {
      client.release();
    }
  }

  private async uploadMarkdownToGoogleDrive(
    fileName: string,
    markdown: string,
    metadata: Record<string, unknown>
  ): Promise<{ file_id: string; web_view_link?: string; folder_name?: string; folder_id?: string }> {
    const driveAuth = await this.getGoogleDriveAccessToken();
    let rootFolder = await this.resolveGoogleDriveTargetFolder(driveAuth.accessToken);
    let activeFolder = await this.resolveQuizResultGoogleDriveFolder(
      driveAuth.accessToken,
      rootFolder,
      metadata
    );
    let uploaded;
    try {
      uploaded = await this.uploadGoogleDriveFile(
        driveAuth.accessToken,
        fileName,
        markdown,
        metadata,
        activeFolder
      );
    } catch (error) {
      if (
        rootFolder.source === "configured" &&
        error instanceof ApiError &&
        this.isRecoverableDriveParentError(error.message)
      ) {
        rootFolder = await this.ensureWritableGoogleDriveFolder(
          driveAuth.accessToken,
          config.googleDriveFolderName
        );
        activeFolder = await this.resolveQuizResultGoogleDriveFolder(
          driveAuth.accessToken,
          rootFolder,
          metadata
        );
        uploaded = await this.uploadGoogleDriveFile(
          driveAuth.accessToken,
          fileName,
          markdown,
          metadata,
          activeFolder
        );
      } else {
        throw error;
      }
    }
    return {
      ...uploaded,
      folder_name: activeFolder.folderPath,
      folder_id: activeFolder.folderId,
    };
  }

  private async uploadGoogleDriveFile(
    accessToken: string,
    fileName: string,
    markdown: string,
    metadata: Record<string, unknown>,
    folder: { folderId: string; folderName: string }
  ): Promise<{ file_id: string; web_view_link?: string }> {
    const fetchFn = this.getFetchFn();
    const boundary = `edufika_${Date.now()}`;
    const description = Object.keys(metadata || {}).length > 0 ? JSON.stringify(metadata) : undefined;
    const lowerName = fileName.toLowerCase();
    const isMarkdown = lowerName.endsWith(".md") || lowerName.endsWith(".markdown");
    const mimeType = isMarkdown ? "text/markdown" : "text/plain";
    const metadataPayload: Record<string, unknown> = {
      name: fileName,
      mimeType,
    };
    metadataPayload.parents = [folder.folderId];
    if (description) {
      metadataPayload.description = description;
    }

    const body = [
      `--${boundary}`,
      "Content-Type: application/json; charset=UTF-8",
      "",
      JSON.stringify(metadataPayload),
      `--${boundary}`,
      `Content-Type: ${mimeType}; charset=UTF-8`,
      "",
      markdown,
      `--${boundary}--`,
      "",
    ].join("\r\n");

    const uploadResponse = await fetchFn(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body,
      }
    );
    const uploadPayload = await uploadResponse.json().catch(() => ({}));
    if (!uploadResponse.ok) {
      const message = uploadPayload?.error?.message || "Failed to upload file to Google Drive";
      throw new ApiError(502, message);
    }
    return {
      file_id: String(uploadPayload.id ?? ""),
      web_view_link: uploadPayload.webViewLink ? String(uploadPayload.webViewLink) : undefined,
    };
  }

  private async resolveGoogleDriveTargetFolder(
    accessToken: string
  ): Promise<{ folderId: string; folderName: string; folderPath: string; source: "configured" | "managed" }> {
    const configuredFolderId = config.googleDriveFolderId.trim();
    const fallbackFolderName = config.googleDriveFolderName.trim() || "QuizData";
    if (!configuredFolderId) {
      return await this.ensureWritableGoogleDriveFolder(accessToken, fallbackFolderName);
    }

    try {
      const configuredFolder = await this.getGoogleDriveFolderById(accessToken, configuredFolderId);
      if (!configuredFolder.canAddChildren) {
        throw new ApiError(
          502,
          `Configured Google Drive folder is not writable: ${configuredFolder.folderName}`
        );
      }
      return {
        folderId: configuredFolder.folderId,
        folderName: configuredFolder.folderName,
        folderPath: configuredFolder.folderName,
        source: "configured",
      };
    } catch (error) {
      if (error instanceof ApiError && this.isRecoverableDriveParentError(error.message)) {
        return await this.ensureWritableGoogleDriveFolder(accessToken, fallbackFolderName);
      }
      throw error;
    }
  }

  private async ensureWritableGoogleDriveFolder(
    accessToken: string,
    folderName: string
  ): Promise<{ folderId: string; folderName: string; folderPath: string; source: "managed" }> {
    const trimmedName = folderName.trim() || "QuizData";
    const fetchFn = this.getFetchFn();
    const escapedName = trimmedName.replace(/'/g, "\\'");
    const query = `name='${escapedName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const searchResponse = await fetchFn(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        query
      )}&fields=files(id,name)&pageSize=1&spaces=drive`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    const searchPayload = await searchResponse.json().catch(() => ({}));
    if (!searchResponse.ok) {
      const message = searchPayload?.error?.message || "Failed to search Google Drive folder";
      throw new ApiError(502, message);
    }
    const existingFolderId = String(searchPayload?.files?.[0]?.id ?? "").trim();
    const existingFolderName = String(searchPayload?.files?.[0]?.name ?? "").trim();
    if (existingFolderId) {
      return {
        folderId: existingFolderId,
        folderName: existingFolderName || trimmedName,
        folderPath: existingFolderName || trimmedName,
        source: "managed",
      };
    }

    const createResponse = await fetchFn(
      "https://www.googleapis.com/drive/v3/files?fields=id,name",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify({
          name: trimmedName,
          mimeType: "application/vnd.google-apps.folder",
        }),
      }
    );
    const createPayload = await createResponse.json().catch(() => ({}));
    if (!createResponse.ok) {
      const message = createPayload?.error?.message || "Failed to create Google Drive folder";
      throw new ApiError(502, message);
    }
    const createdFolderId = String(createPayload?.id ?? "").trim();
    const createdFolderName = String(createPayload?.name ?? "").trim() || trimmedName;
    if (!createdFolderId) {
      throw new ApiError(502, "Google Drive folder ID missing after create");
    }
    return {
      folderId: createdFolderId,
      folderName: createdFolderName,
      folderPath: createdFolderName,
      source: "managed",
    };
  }

  private async resolveQuizResultGoogleDriveFolder(
    accessToken: string,
    rootFolder: { folderId: string; folderName: string; folderPath: string; source: "configured" | "managed" },
    metadata: Record<string, unknown>
  ): Promise<{ folderId: string; folderName: string; folderPath: string; source: "configured" | "managed" }> {
    const segments = this.getQuizResultFolderSegments(metadata);
    let currentFolder = rootFolder;
    for (const segment of segments) {
      const childFolder = await this.ensureGoogleDriveChildFolder(
        accessToken,
        currentFolder.folderId,
        currentFolder.folderPath,
        segment
      );
      currentFolder = {
        ...childFolder,
        source: rootFolder.source,
      };
    }
    return currentFolder;
  }

  private getQuizResultFolderSegments(metadata: Record<string, unknown>): string[] {
    const classFolder = this.sanitizeGoogleDriveFolderName(
      this.getMetadataString(metadata, "student_class", "studentClass", "class_name", "class"),
      "Tanpa Kelas"
    );
    const electiveFolder = this.sanitizeGoogleDriveFolderName(
      this.getMetadataString(
        metadata,
        "student_elective",
        "studentElective",
        "elective",
        "elective_name"
      ),
      "Tanpa Peminatan"
    );
    return [classFolder, electiveFolder];
  }

  private getMetadataString(metadata: Record<string, unknown>, ...keys: string[]): string {
    for (const key of keys) {
      const value = metadata[key];
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
    return "";
  }

  private sanitizeGoogleDriveFolderName(raw: string, fallback: string): string {
    const normalized = raw
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, " ")
      .replace(/\.+$/g, "")
      .trim();
    return normalized || fallback;
  }

  private async ensureGoogleDriveChildFolder(
    accessToken: string,
    parentFolderId: string,
    parentFolderPath: string,
    folderName: string
  ): Promise<{ folderId: string; folderName: string; folderPath: string }> {
    const fetchFn = this.getFetchFn();
    const escapedName = folderName.replace(/'/g, "\\'");
    const query =
      `'${parentFolderId}' in parents and name='${escapedName}' and ` +
      `mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const searchResponse = await fetchFn(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        query
      )}&fields=files(id,name)&pageSize=1&spaces=drive`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    const searchPayload = await searchResponse.json().catch(() => ({}));
    if (!searchResponse.ok) {
      const message = searchPayload?.error?.message || "Failed to search Google Drive child folder";
      throw new ApiError(502, message);
    }

    const existingFolderId = String(searchPayload?.files?.[0]?.id ?? "").trim();
    const existingFolderName = String(searchPayload?.files?.[0]?.name ?? "").trim() || folderName;
    if (existingFolderId) {
      return {
        folderId: existingFolderId,
        folderName: existingFolderName,
        folderPath: `${parentFolderPath}/${existingFolderName}`,
      };
    }

    const createResponse = await fetchFn(
      "https://www.googleapis.com/drive/v3/files?fields=id,name",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify({
          name: folderName,
          mimeType: "application/vnd.google-apps.folder",
          parents: [parentFolderId],
        }),
      }
    );
    const createPayload = await createResponse.json().catch(() => ({}));
    if (!createResponse.ok) {
      const message = createPayload?.error?.message || "Failed to create Google Drive child folder";
      throw new ApiError(502, message);
    }
    const createdFolderId = String(createPayload?.id ?? "").trim();
    const createdFolderName = String(createPayload?.name ?? "").trim() || folderName;
    if (!createdFolderId) {
      throw new ApiError(502, "Google Drive child folder ID missing after create");
    }
    return {
      folderId: createdFolderId,
      folderName: createdFolderName,
      folderPath: `${parentFolderPath}/${createdFolderName}`,
    };
  }

  private async getGoogleDriveFolderById(
    accessToken: string,
    folderId: string
  ): Promise<{ folderId: string; folderName: string; canAddChildren: boolean }> {
    const fetchFn = this.getFetchFn();
    const response = await fetchFn(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
        folderId
      )}?fields=id,name,mimeType,capabilities(canAddChildren)`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload?.error?.message || "Failed to inspect Google Drive folder";
      throw new ApiError(502, message);
    }
    const mimeType = String(payload?.mimeType ?? "");
    if (mimeType !== "application/vnd.google-apps.folder") {
      throw new ApiError(502, "Configured Google Drive target is not a folder");
    }
    return {
      folderId: String(payload?.id ?? folderId).trim(),
      folderName: String(payload?.name ?? "").trim() || "QuizData",
      canAddChildren: payload?.capabilities?.canAddChildren !== false,
    };
  }

  private getGoogleDriveCredentialState(): {
    configured: boolean;
    authMode: "oauth" | "service_account" | "unconfigured";
  } {
    const useOAuth =
      Boolean(config.googleDriveClientId) &&
      Boolean(config.googleDriveClientSecret) &&
      Boolean(config.googleDriveRefreshToken);
    if (useOAuth) {
      return {
        configured: true,
        authMode: "oauth",
      };
    }
    const useServiceAccount =
      Boolean(config.googleDriveClientEmail) && Boolean(config.googleDrivePrivateKey);
    if (useServiceAccount) {
      return {
        configured: true,
        authMode: "service_account",
      };
    }
    return {
      configured: false,
      authMode: "unconfigured",
    };
  }

  private async getGoogleDriveAccessToken(): Promise<{
    accessToken: string;
    authMode: "oauth" | "service_account";
  }> {
    const credentialState = this.getGoogleDriveCredentialState();
    if (!credentialState.configured || credentialState.authMode === "unconfigured") {
      throw new ApiError(
        500,
        "Google Drive credentials are not configured (set GDRIVE_CLIENT_ID/SECRET/REFRESH_TOKEN or GOOGLE_DRIVE_CLIENT_EMAIL/PRIVATE_KEY)"
      );
    }

    const fetchFn = this.getFetchFn();
    let tokenResponse;
    if (credentialState.authMode === "oauth") {
      tokenResponse = await fetchFn("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: config.googleDriveClientId,
          client_secret: config.googleDriveClientSecret,
          refresh_token: config.googleDriveRefreshToken,
        }).toString(),
      });
    } else {
      const now = Math.floor(Date.now() / 1000);
      const assertion = jwt.sign(
        {
          iss: config.googleDriveClientEmail,
          scope: config.googleDriveScope,
          aud: "https://oauth2.googleapis.com/token",
          iat: now,
          exp: now + 3600,
        },
        config.googleDrivePrivateKey,
        { algorithm: "RS256" }
      );
      tokenResponse = await fetchFn("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion,
        }).toString(),
      });
    }
    const tokenPayload = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok) {
      const message =
        typeof tokenPayload?.error === "string"
          ? tokenPayload.error
          : tokenPayload?.error_description || "Failed to obtain Google Drive token";
      throw new ApiError(502, message);
    }
    const accessToken = String(tokenPayload.access_token ?? "");
    if (!accessToken) {
      throw new ApiError(502, "Google Drive token missing");
    }
    return {
      accessToken,
      authMode: credentialState.authMode,
    };
  }

  private isRecoverableDriveParentError(message: string): boolean {
    const normalized = message.trim().toLowerCase();
    return (
      normalized.includes("file not found") ||
      normalized.includes("insufficient permissions") ||
      normalized.includes("sufficient permissions") ||
      normalized.includes("specified parent") ||
      normalized.includes("not writable") ||
      normalized.includes("not a folder") ||
      normalized.includes("forbidden")
    );
  }

  private getFetchFn(): (
    input: string,
    init?: { method?: string; headers?: Record<string, string>; body?: any }
  ) => Promise<any> {
    const fetchFn = (globalThis as any).fetch as
      | ((input: string, init?: { method?: string; headers?: Record<string, string>; body?: any }) => Promise<any>)
      | undefined;
    if (!fetchFn) {
      throw new ApiError(500, "Fetch API is not available");
    }
    return fetchFn;
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

    const quizExamResult = await client.query<Record<string, unknown>>(
      `
        SELECT *
        FROM quiz_exams
        WHERE exam_session_id = $1
        LIMIT 1
      `,
      [sessionId]
    );

    const quizSubjectsResult = await client.query<Record<string, unknown>>(
      `
        SELECT *
        FROM quiz_subjects
        WHERE exam_session_id = $1
      `,
      [sessionId]
    );

    const quizQuestionsResult = await client.query<Record<string, unknown>>(
      `
        SELECT *
        FROM quiz_questions
        WHERE exam_session_id = $1
      `,
      [sessionId]
    );

    const quizQuestionIds = quizQuestionsResult.rows
      .map((row) => Number(row.id))
      .filter((value) => Number.isFinite(value) && value > 0)
      .map((value) => String(value));

    let quizOptionsRows: Record<string, unknown>[] = [];
    if (quizQuestionIds.length > 0) {
      const inQuizQuestions = this.buildInClause(quizQuestionIds, 1);
      const quizOptionsResult = await client.query<Record<string, unknown>>(
        `
          SELECT *
          FROM quiz_question_options
          WHERE question_id IN (${inQuizQuestions.clause})
        `,
        inQuizQuestions.params
      );
      quizOptionsRows = quizOptionsResult.rows;
    }

    const quizAttemptsResult = await client.query<Record<string, unknown>>(
      `
        SELECT *
        FROM quiz_student_attempts
        WHERE exam_session_id = $1
      `,
      [sessionId]
    );

    const attemptIds = quizAttemptsResult.rows
      .map((row) => Number(row.id))
      .filter((value) => Number.isFinite(value) && value > 0)
      .map((value) => String(value));

    let quizAnswersRows: Record<string, unknown>[] = [];
    if (attemptIds.length > 0) {
      const inAttempts = this.buildInClause(attemptIds, 1);
      const quizAnswersResult = await client.query<Record<string, unknown>>(
        `
          SELECT *
          FROM quiz_student_answers
          WHERE attempt_id IN (${inAttempts.clause})
        `,
        inAttempts.params
      );
      quizAnswersRows = quizAnswersResult.rows;
    }

    const quizTeacherSubmissionsResult = await client.query<Record<string, unknown>>(
      `
        SELECT *
        FROM quiz_teacher_submissions
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
      quiz_exam: quizExamResult.rows[0] ?? null,
      quiz_subjects: quizSubjectsResult.rows,
      quiz_questions: quizQuestionsResult.rows,
      quiz_question_options: quizOptionsRows,
      quiz_attempts: quizAttemptsResult.rows,
      quiz_answers: quizAnswersRows,
      quiz_teacher_submissions: quizTeacherSubmissionsResult.rows,
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

function normalizeExamMode(value: unknown): ExamMode {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "HYBRID") {
    return "HYBRID";
  }
  if (normalized === "IN_APP_QUIZ") {
    return "IN_APP_QUIZ";
  }
  return "BROWSER_LOCKDOWN";
}

function parseJsonNumberArray(raw: string | null): number[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((entry) => Number(entry))
      .filter((entry) => Number.isFinite(entry) && entry > 0)
      .map((entry) => Math.trunc(entry));
  } catch {
    return [];
  }
}

function arraysEqual(left: number[], right: number[]): boolean {
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

function shuffleInPlace<T>(items: T[]): void {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = items[index];
    items[index] = items[swapIndex];
    items[swapIndex] = current;
  }
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
