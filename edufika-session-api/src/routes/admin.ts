import { Router } from "express";
import { z } from "zod";
import { SessionService } from "../services/sessionService";

const revokeSchema = z.object({
  session_id: z.string().trim().min(1),
  access_signature: z.string().trim().min(1),
  reason: z.string().trim().min(1),
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

  return router;
}
