import { Request } from "express";

export function extractBearerToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (!authHeader) return undefined;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1];
}
