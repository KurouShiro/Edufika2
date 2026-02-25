import { Router } from "express";
import { z } from "zod";
import { extractBearerToken } from "../middleware/auth";
import { SessionService } from "../services/sessionService";

const revokeSchema = z.object({
  session_id: z.string().trim().min(1),
  access_signature: z.string().trim().min(1),
  reason: z.string().trim().min(1),
});

const revokeStudentSchema = z.object({
  session_id: z.string().trim().min(1),
  access_signature: z.string().trim().min(1),
  student_token: z.string().trim().min(1),
  reason: z.string().trim().min(1).max(256).optional(),
});

const pauseResumeSchema = z.object({
  session_id: z.string().trim().min(1),
  access_signature: z.string().trim().min(1),
});

const reissueSignatureSchema = z.object({
  session_id: z.string().trim().min(1),
  access_signature: z.string().trim().min(1),
  student_binding_id: z.string().trim().min(1).optional(),
});

const monitorQuerySchema = z.object({
  session_id: z.string().trim().min(1),
  access_signature: z.string().trim().min(1),
});

export function createAdminRouter(service: SessionService): Router {
  const router = Router();

  router.post("/revoke", async (req, res, next) => {
    try {
      const parsed = revokeSchema.parse(req.body);
      await service.revokeSession(parsed.session_id, parsed.access_signature, parsed.reason);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.post("/revoke-student", async (req, res, next) => {
    try {
      const parsed = revokeStudentSchema.parse(req.body);
      const result = await service.revokeStudentToken(
        parsed.session_id,
        parsed.access_signature,
        parsed.student_token,
        parsed.reason
      );
      res.json({
        ok: true,
        student_token: result.studentToken,
        binding_ids: result.bindingIds,
        reason: result.reason,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/pause", async (req, res, next) => {
    try {
      const parsed = pauseResumeSchema.parse(req.body);
      await service.pauseSession(parsed.session_id, parsed.access_signature);
      res.json({ ok: true, session_state: "PAUSED" });
    } catch (error) {
      next(error);
    }
  });

  router.post("/resume", async (req, res, next) => {
    try {
      const parsed = pauseResumeSchema.parse(req.body);
      await service.resumeSession(parsed.session_id, parsed.access_signature);
      res.json({ ok: true, session_state: "IN_PROGRESS" });
    } catch (error) {
      next(error);
    }
  });

  router.post("/reissue-signature", async (req, res, next) => {
    try {
      const parsed = reissueSignatureSchema.parse(req.body);
      const result = await service.reissueStudentSignature(
        parsed.session_id,
        parsed.access_signature,
        parsed.student_binding_id
      );
      res.json({
        ok: true,
        session_state: result.sessionState,
        binding_id: result.bindingId,
        access_signature: result.accessSignature,
        expires_in: result.expiresIn,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/monitor", async (req, res, next) => {
    try {
      const parsed = monitorQuerySchema.parse({
        session_id: req.query.session_id,
        access_signature: extractBearerToken(req),
      });
      const result = await service.getSessionMonitor(parsed.session_id, parsed.access_signature);
      res.json({
        session_id: result.sessionId,
        session_state: result.sessionState,
        tokens: result.tokens,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
