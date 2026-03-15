import { Router } from "express";
import { studentLoginBodySchema, studentRegisterBodySchema } from "../models/schemas";
import { SessionService } from "../services/sessionService";

export function createStudentRouter(service: SessionService): Router {
  const router = Router();

  router.post("/register", async (req, res, next) => {
    try {
      const parsed = studentRegisterBodySchema.parse(req.body);
      const registered = await service.registerStudentAccount({
        name: parsed.name,
        studentClass: parsed.class,
        elective: parsed.elective,
        username: parsed.username,
        password: parsed.password,
        schoolYear: parsed.school_year,
      });
      res.json({
        student: registered.student,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/login", async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      let basicUsername: string | undefined;
      let basicPassword: string | undefined;
      if (authHeader && authHeader.startsWith("Basic ")) {
        const encoded = authHeader.slice("Basic ".length).trim();
        const decoded = Buffer.from(encoded, "base64").toString("utf8");
        const separatorIndex = decoded.indexOf(":");
        if (separatorIndex > 0) {
          basicUsername = decoded.slice(0, separatorIndex);
          basicPassword = decoded.slice(separatorIndex + 1);
        }
      }

      const parsed = studentLoginBodySchema.parse({
        username: basicUsername ?? req.body.username,
        password: basicPassword ?? req.body.password,
      });
      const result = await service.loginStudentAccount({
        username: parsed.username,
        password: parsed.password,
      });
      res.json({
        student_auth_token: result.token,
        expires_in: result.expiresIn,
        student: result.student,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
