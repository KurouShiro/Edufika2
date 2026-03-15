import { z } from "zod";

export const examModeSchema = z.enum(["BROWSER_LOCKDOWN", "HYBRID", "IN_APP_QUIZ"]);

export const createSessionBodySchema = z.object({
  proctor_id: z.string().trim().min(1),
  exam_name: z.string().trim().min(1).optional(),
  token_count: z.number().int().min(1).max(500).optional(),
  launch_url: z.string().trim().min(1).optional(),
  token_ttl_minutes: z.number().int().min(1).max(43200).optional(),
  exam_mode: examModeSchema.optional(),
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

export const quizAccessBodySchema = z.object({
  session_id: z.string().trim().min(1),
  access_signature: z.string().trim().min(1),
});

export const quizConfigUpsertBodySchema = z.object({
  session_id: z.string().trim().min(1),
  access_signature: z.string().trim().min(1),
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().max(4000).optional(),
  duration_minutes: z.number().int().min(1).max(1440).optional(),
  show_results_immediately: z.boolean().optional(),
  randomize_questions: z.boolean().optional(),
  allow_review: z.boolean().optional(),
});

export const quizSubjectCreateBodySchema = z.object({
  session_id: z.string().trim().min(1),
  access_signature: z.string().trim().min(1),
  subject_code: z.string().trim().min(1).max(64),
  subject_name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(4000).optional(),
  ordering: z.number().int().min(1).max(10000).optional(),
});

export const quizSubjectDeleteBodySchema = z.object({
  session_id: z.string().trim().min(1),
  access_signature: z.string().trim().min(1),
  subject_id: z.number().int().positive(),
});

export const quizQuestionOptionSchema = z.object({
  key: z.string().trim().min(1).max(16),
  text: z.string().trim().min(1).max(2000),
  is_correct: z.boolean().optional(),
});

export const quizQuestionTypeSchema = z.enum([
  "single_choice",
  "multi_choice",
  "multiple_correct",
  "true_false",
  "matching",
]);

export const quizQuestionCreateBodySchema = z.object({
  session_id: z.string().trim().min(1),
  access_signature: z.string().trim().min(1),
  subject_id: z.number().int().positive(),
  question_text: z.string().trim().min(1).max(10000),
  question_type: quizQuestionTypeSchema.optional(),
  points: z.number().int().min(1).max(1000).optional(),
  ordering: z.number().int().min(1).max(100000).optional(),
  options: z.array(quizQuestionOptionSchema).min(2).max(12),
});

export const quizQuestionBulkCreateBodySchema = z.object({
  session_id: z.string().trim().min(1),
  access_signature: z.string().trim().min(1),
  questions: z.array(
    z.object({
      subject_id: z.number().int().positive(),
      question_text: z.string().trim().min(1).max(10000),
      question_type: quizQuestionTypeSchema.optional(),
      points: z.number().int().min(1).max(1000).optional(),
      ordering: z.number().int().min(1).max(100000).optional(),
      options: z.array(quizQuestionOptionSchema).min(2).max(12),
    })
  ).min(1).max(40),
});

export const quizPublishBodySchema = z.object({
  session_id: z.string().trim().min(1),
  access_signature: z.string().trim().min(1),
  published: z.boolean(),
});

export const quizStartAttemptBodySchema = z.object({
  session_id: z.string().trim().min(1),
  access_signature: z.string().trim().min(1),
  student_name: z.string().trim().min(1).max(128).optional(),
  student_class: z.string().trim().min(1).max(64).optional(),
  student_elective: z.string().trim().min(1).max(128).optional(),
});

export const quizAnswerBodySchema = z.object({
  session_id: z.string().trim().min(1),
  access_signature: z.string().trim().min(1),
  question_id: z.number().int().positive(),
  selected_option_ids: z.array(z.number().int().positive()).max(12).optional(),
  text_answer: z.string().trim().max(4000).optional(),
});

export const quizFinishBodySchema = z.object({
  session_id: z.string().trim().min(1),
  access_signature: z.string().trim().min(1),
});

export const quizAssignTokenBodySchema = z.object({
  session_id: z.string().trim().min(1),
  access_signature: z.string().trim().min(1),
  student_token: z.string().trim().min(1),
  assigned: z.boolean().optional(),
});

export const quizResultsQuerySchema = z.object({
  session_id: z.string().trim().min(1),
  access_signature: z.string().trim().min(1),
});

export const studentRegisterBodySchema = z.object({
  name: z.string().trim().min(1).max(50),
  class: z.enum(["Fase E", "Fase F", "Fase FL"]),
  elective: z.enum(["RPL", "DKV", "AKL", "LK", "ULW", "KTKK", "TKJ", "TAV", "MPLB"]),
  username: z.string().trim().min(1).max(25),
  password: z.string().trim().min(1).max(50),
  school_year: z.string().trim().min(1),
});

export const studentLoginBodySchema = z.object({
  username: z.string().trim().min(1).max(25),
  password: z.string().trim().min(1).max(50),
});

export const quizJoinBodySchema = z.object({
  session_id: z.string().trim().min(1),
  device_fingerprint: z.string().trim().min(1).optional(),
  device_name: z.string().trim().min(1).max(128).optional(),
});

export const quizResultUploadBodySchema = z.object({
  session_id: z.string().trim().min(1),
  access_signature: z.string().trim().min(1),
  file_name: z.string().trim().min(1).max(255),
  markdown: z.string().trim().min(1),
  metadata: z.record(z.unknown()).optional(),
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
export type QuizConfigUpsertBody = z.infer<typeof quizConfigUpsertBodySchema>;
export type QuizSubjectCreateBody = z.infer<typeof quizSubjectCreateBodySchema>;
export type QuizQuestionCreateBody = z.infer<typeof quizQuestionCreateBodySchema>;
export type QuizQuestionBulkCreateBody = z.infer<typeof quizQuestionBulkCreateBodySchema>;
export type QuizAnswerBody = z.infer<typeof quizAnswerBodySchema>;
export type QuizAssignTokenBody = z.infer<typeof quizAssignTokenBodySchema>;
export type StudentRegisterBody = z.infer<typeof studentRegisterBodySchema>;
export type StudentLoginBody = z.infer<typeof studentLoginBodySchema>;
