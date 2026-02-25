import { Router } from "express";
import { extractBearerToken } from "../middleware/auth";
import { launchAccessSchema, launchUpdateBodySchema } from "../models/schemas";
import { SessionService } from "../services/sessionService";

export function createExamRouter(service: SessionService): Router {
  const router = Router();

  router.get("/launch", async (req, res, next) => {
    try {
      const parsed = launchAccessSchema.parse({
        session_id: req.query.session_id,
        access_signature: extractBearerToken(req),
      });

      const launchConfig = await service.getLaunchConfig(parsed.session_id, parsed.access_signature);
      res.json({
        launch_url: launchConfig.launchUrl,
        provider: launchConfig.provider,
        lock_to_host: launchConfig.lockToHost,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/launch", async (req, res, next) => {
    try {
      const parsed = launchUpdateBodySchema.parse({
        ...req.body,
        access_signature: extractBearerToken(req),
      });

      const launchConfig = await service.updateLaunchUrl(
        parsed.session_id,
        parsed.access_signature,
        parsed.launch_url
      );
      res.json({
        launch_url: launchConfig.launchUrl,
        provider: launchConfig.provider,
        lock_to_host: launchConfig.lockToHost,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
