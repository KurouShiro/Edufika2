import jwt from "jsonwebtoken";
import { config } from "../config";

export type AccessTokenPayload = {
  sid: string;
  bid: string;
  ver: number;
  role: string;
  iat?: number;
  exp?: number;
};

export function signAccessSignature(payload: Omit<AccessTokenPayload, "iat" | "exp">): string {
  return jwt.sign(payload, config.jwtSecret, {
    issuer: "edufika-session-api",
    expiresIn: config.accessSignatureTtlSeconds,
  });
}

export function verifyAccessSignature(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, config.jwtSecret, {
    issuer: "edufika-session-api",
  });

  if (typeof decoded !== "object" || decoded === null) {
    throw new Error("Invalid signature payload");
  }

  const payload = decoded as AccessTokenPayload;
  if (!payload.sid || !payload.bid || typeof payload.ver !== "number") {
    throw new Error("Incomplete signature payload");
  }

  return payload;
}
