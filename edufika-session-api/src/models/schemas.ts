import { z } from "zod";

export const createSessionBodySchema = z.object({
  proctor_id: z.string().trim().min(1),
  exam_name: z.string().trim().min(1).optional(),
  token_count: z.number().int().min(1).max(500).optional(),
  launch_url: z.string().trim().min(1).optional(),
  token_ttl_minutes: z.number().int().min(1).max(43200).optional(),
});

export const claimSessionBodySchema = z.object({
  token: z.string().trim().min(1),
  device_fingerprint: z.string().trim().min(1).optional(),
  device_binding_id: z.string().trim().min(1).optional(),
  device_name: z.string().trim().min(1).max(128).optional(),
  role_hint: z.enum(["student", "admin", "developer"]).optional(),
});

export const heartbeatBodySchema = z.object({
  session_id: z.string().trim().min(1),
  access_signature: z.string().trim().min(1),
  device_binding_id: z.string().trim().min(1),
  focus: z.boolean(),
  multi_window: z.boolean(),
  network_state: z.string().trim().optional(),
  device_state: z.string().trim().optional(),
  timestamp: z.number().int(),
  heartbeat_seq: z.number().int().optional(),
  risk_score: z.number().int().optional(),
  overlay_detected: z.boolean().optional(),
  accessibility_active: z.boolean().optional(),
  debug_detected: z.boolean().optional(),
  emulator_detected: z.boolean().optional(),
  rooted: z.boolean().optional(),
});

export const reconnectBodySchema = z.object({
  session_id: z.string().trim().min(1),
  device_binding_id: z.string().trim().min(1),
  token: z.string().trim().min(1).optional(),
  device_fingerprint: z.string().trim().min(1).optional(),
  access_signature: z.string().trim().min(1).optional(),
  reason: z.string().trim().min(1).optional(),
});

export const eventBodySchema = z.object({
  session_id: z.string().trim().min(1),
  access_signature: z.string().trim().min(1),
  event_type: z.string().trim().min(1),
  detail: z.string().trim().min(1).optional(),
  severity: z.number().int().min(1).max(20).optional(),
  risk_score: z.number().int().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const whitelistAddBodySchema = z.object({
  session_id: z.string().trim().min(1),
  access_signature: z.string().trim().min(1),
  url: z.string().trim().min(1),
});

export const whitelistVerifyBodySchema = whitelistAddBodySchema;

export const proctorPinSetBodySchema = z.object({
  session_id: z.string().trim().min(1),
  access_signature: z.string().trim().min(1),
  pin: z.string().trim().min(4).max(32),
  student_token: z.string().trim().min(1).optional(),
});

export const proctorPinSetAllBodySchema = z.object({
  session_id: z.string().trim().min(1),
  access_signature: z.string().trim().min(1),
  pin: z.string().trim().min(4).max(32),
});

export const proctorPinVerifyBodySchema = z.object({
  session_id: z.string().trim().min(1),
  access_signature: z.string().trim().min(1),
  pin: z.string().trim().min(1).max(32),
});

export const proctorPinStatusQuerySchema = z.object({
  session_id: z.string().trim().min(1),
  access_signature: z.string().trim().min(1),
  student_token: z.string().trim().min(1).optional(),
});

export const finishSessionBodySchema = z.object({
  session_id: z.string().trim().min(1),
  access_signature: z.string().trim().min(1),
  timestamp: z.number().int().optional(),
});

export const revokeSessionBodySchema = z.object({
  session_id: z.string().trim().min(1),
  access_signature: z.string().trim().min(1),
  reason: z.string().trim().min(1),
  timestamp: z.number().int().optional(),
});

export const whitelistQuerySchema = z.object({
  session_id: z.string().trim().min(1),
});

export const launchAccessSchema = z.object({
  session_id: z.string().trim().min(1),
  access_signature: z.string().trim().min(1),
});

export const launchUpdateBodySchema = z.object({
  session_id: z.string().trim().min(1),
  access_signature: z.string().trim().min(1),
  launch_url: z.string().trim().min(1),
});

export type CreateSessionBody = z.infer<typeof createSessionBodySchema>;
export type ClaimSessionBody = z.infer<typeof claimSessionBodySchema>;
export type HeartbeatBody = z.infer<typeof heartbeatBodySchema>;
export type ReconnectBody = z.infer<typeof reconnectBodySchema>;
export type EventBody = z.infer<typeof eventBodySchema>;
export type WhitelistAddBody = z.infer<typeof whitelistAddBodySchema>;
export type ProctorPinSetBody = z.infer<typeof proctorPinSetBodySchema>;
export type ProctorPinVerifyBody = z.infer<typeof proctorPinVerifyBodySchema>;
export type FinishSessionBody = z.infer<typeof finishSessionBodySchema>;
export type RevokeSessionBody = z.infer<typeof revokeSessionBodySchema>;
