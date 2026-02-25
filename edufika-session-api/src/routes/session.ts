import { Router } from "express";
import {
  claimSessionBodySchema,
  createSessionBodySchema,
  eventBodySchema,
  finishSessionBodySchema,
  heartbeatBodySchema,
  reconnectBodySchema,
  proctorPinSetBodySchema,
  proctorPinStatusQuerySchema,
  proctorPinVerifyBodySchema,
  whitelistAddBodySchema,
  whitelistQuerySchema,
  whitelistVerifyBodySchema,
} from "../models/schemas";
import { extractBearerToken } from "../middleware/auth";
import { config } from "../config";
import { ApiError, SessionService } from "../services/sessionService";

export function createSessionRouter(service: SessionService): Router {
  const router = Router();

  router.post("/create", async (req, res, next) => {
    try {
      if (config.adminCreateKey) {
        const providedCreateKey = req.get("x-admin-create-key")?.trim() || extractBearerToken(req);
        if (!providedCreateKey || providedCreateKey !== config.adminCreateKey) {
          throw new ApiError(401, "Unauthorized create-session request");
        }
      }

      const parsed = createSessionBodySchema.parse(req.body);
      const created = await service.createSession({
        proctorId: parsed.proctor_id,
        examName: parsed.exam_name,
        tokenCount: parsed.token_count,
        launchUrl: parsed.launch_url,
        tokenTtlMinutes: parsed.token_ttl_minutes,
      });
      res.json({
        session_id: created.sessionId,
        token: created.token,
        tokens: created.tokens,
        launch_url: created.launchUrl,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/claim", async (req, res, next) => {
    try {
      const parsed = claimSessionBodySchema.parse(req.body);
      const claimed = await service.claimSession({
        token: parsed.token,
        deviceFingerprint: parsed.device_fingerprint,
        deviceBindingId: parsed.device_binding_id,
        deviceName: parsed.device_name,
        roleHint: parsed.role_hint,
        ipAddress: req.ip,
      });

      res.json({
        session_id: claimed.sessionId,
        access_signature: claimed.accessSignature,
        expires_in: claimed.expiresIn,
        token_expires_at: claimed.tokenExpiresAt,
        role: claimed.role,
        device_binding_id: claimed.bindingId,
        launch_url: claimed.launchUrl,
        whitelist: claimed.whitelist,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/heartbeat", async (req, res, next) => {
    try {
      const parsed = heartbeatBodySchema.parse(req.body);
      const result = await service.handleHeartbeat(parsed);
      res.json({
        accepted: result.accepted,
        lock: result.lock,
        rotate_signature: result.rotateSignature,
        message: result.message,
        whitelist: result.whitelist,
        session_state: result.sessionState,
        status: result.lock ? "LOCKED" : result.sessionState,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/reconnect", async (req, res, next) => {
    try {
      const parsed = reconnectBodySchema.parse(req.body);
      const result = await service.reconnectSession({
        session_id: parsed.session_id,
        device_binding_id: parsed.device_binding_id,
        token: parsed.token,
        device_fingerprint: parsed.device_fingerprint,
        access_signature: parsed.access_signature,
        reason: parsed.reason,
      });
      res.json({
        accepted: true,
        access_signature: result.accessSignature,
        expires_in: result.expiresIn,
        session_state: result.sessionState,
        message: result.message,
        whitelist: result.whitelist,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/event", async (req, res, next) => {
    try {
      const parsed = eventBodySchema.parse(req.body);
      const result = await service.reportEvent({
        session_id: parsed.session_id,
        access_signature: parsed.access_signature,
        event_type: parsed.event_type,
        detail: parsed.detail,
        severity: parsed.severity,
        risk_score: parsed.risk_score,
        metadata: parsed.metadata,
      });
      res.json({
        accepted: result.accepted,
        lock: result.lock,
        risk_score: result.riskScore,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/whitelist", async (req, res, next) => {
    try {
      const parsed = whitelistQuerySchema.parse(req.query);
      const whitelist = await service.getWhitelist(parsed.session_id);
      res.json({ whitelist });
    } catch (error) {
      next(error);
    }
  });

  router.post("/whitelist/add", async (req, res, next) => {
    try {
      const parsed = whitelistAddBodySchema.parse(req.body);
      await service.addWhitelistUrl(parsed.session_id, parsed.access_signature, parsed.url);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.post("/whitelist/verify", async (req, res, next) => {
    try {
      const parsed = whitelistVerifyBodySchema.parse(req.body);
      const allowed = await service.verifyWhitelistUrl(parsed.session_id, parsed.access_signature, parsed.url);
      res.json({ allowed });
    } catch (error) {
      next(error);
    }
  });

  router.post("/proctor-pin/set", async (req, res, next) => {
    try {
      const parsed = proctorPinSetBodySchema.parse(req.body);
      const result = await service.setProctorPin(
        parsed.session_id,
        parsed.access_signature,
        parsed.pin,
        parsed.student_token
      );
      res.json({
        ok: true,
        effective_date: result.effectiveDate,
        student_token: result.studentToken,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/proctor-pin/verify", async (req, res, next) => {
    try {
      const parsed = proctorPinVerifyBodySchema.parse(req.body);
      const result = await service.verifyProctorPin(parsed.session_id, parsed.access_signature, parsed.pin);
      res.json({
        valid: result.valid,
        reason: result.reason ?? null,
        effective_date: result.effectiveDate ?? null,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/proctor-pin/status", async (req, res, next) => {
    try {
      const parsed = proctorPinStatusQuerySchema.parse({
        session_id: req.query.session_id,
        student_token: req.query.student_token,
        access_signature: extractBearerToken(req),
      });
      const result = await service.getProctorPinStatus(
        parsed.session_id,
        parsed.access_signature,
        parsed.student_token
      );
      res.json({
        configured: result.configured,
        effective_date: result.effectiveDate ?? null,
        is_active_today: result.isActiveToday,
        student_token: result.studentToken ?? null,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/finish", async (req, res, next) => {
    try {
      const parsed = finishSessionBodySchema.parse(req.body);
      await service.finishSession(parsed.session_id, parsed.access_signature);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
