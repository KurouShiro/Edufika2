import { NextFunction, Request, Response } from "express";
import { config } from "../config";

export function httpsOnlyMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!config.requireHttps) {
    next();
    return;
  }

  const forwardedProto = (req.headers["x-forwarded-proto"] || "").toString().toLowerCase();
  const isSecure = req.secure || forwardedProto === "https";

  if (!isSecure) {
    res.status(400).json({ error: "HTTPS required" });
    return;
  }

  next();
}
