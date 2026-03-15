import { Router } from "express";
import { extractBearerToken } from "../middleware/auth";
import {
  quizJoinBodySchema,
  quizAssignTokenBodySchema,
  quizAccessBodySchema,
  quizAnswerBodySchema,
  quizConfigUpsertBodySchema,
  quizFinishBodySchema,
  quizPublishBodySchema,
  quizQuestionBulkCreateBodySchema,
  quizQuestionCreateBodySchema,
  quizResultUploadBodySchema,
  quizResultsQuerySchema,
  quizStartAttemptBodySchema,
  quizSubjectDeleteBodySchema,
  quizSubjectCreateBodySchema,
} from "../models/schemas";
import { SessionService } from "../services/sessionService";

export function createQuizRouter(service: SessionService): Router {
  const router = Router();

  router.post("/config", async (req, res, next) => {
    try {
      const parsed = quizConfigUpsertBodySchema.parse(req.body);
      const result = await service.upsertQuizConfig({
        sessionId: parsed.session_id,
        accessSignature: parsed.access_signature,
        title: parsed.title,
        description: parsed.description,
        durationMinutes: parsed.duration_minutes,
        showResultsImmediately: parsed.show_results_immediately,
        randomizeQuestions: parsed.randomize_questions,
        allowReview: parsed.allow_review,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get("/active-sessions", async (req, res, next) => {
    try {
      const studentAuthToken = extractBearerToken(req);
      const sessions = await service.listActiveQuizSessions(studentAuthToken);
      res.json({ sessions });
    } catch (error) {
      next(error);
    }
  });

  router.post("/join", async (req, res, next) => {
    try {
      const parsed = quizJoinBodySchema.parse(req.body);
      const studentAuthToken = extractBearerToken(req);
      const joined = await service.joinQuizSessionWithStudentAuth({
        studentAuthToken,
        sessionId: parsed.session_id,
        deviceFingerprint: parsed.device_fingerprint,
        deviceName: parsed.device_name,
        ipAddress: req.ip,
      });
      res.json({
        session_id: joined.sessionId,
        access_signature: joined.accessSignature,
        token_expires_at: joined.tokenExpiresAt,
        device_binding_id: joined.bindingId,
        exam_mode: joined.examMode,
        student_token: joined.studentToken,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/config", async (req, res, next) => {
    try {
      const parsed = quizResultsQuerySchema.parse({
        session_id: req.query.session_id,
        access_signature: extractBearerToken(req),
      });
      const result = await service.getQuizDefinition(parsed.session_id, parsed.access_signature);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/subject", async (req, res, next) => {
    try {
      const parsed = quizSubjectCreateBodySchema.parse(req.body);
      const result = await service.addQuizSubject({
        sessionId: parsed.session_id,
        accessSignature: parsed.access_signature,
        subjectCode: parsed.subject_code,
        subjectName: parsed.subject_name,
        description: parsed.description,
        ordering: parsed.ordering,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/subject/delete", async (req, res, next) => {
    try {
      const parsed = quizSubjectDeleteBodySchema.parse(req.body);
      const result = await service.deleteQuizSubject({
        sessionId: parsed.session_id,
        accessSignature: parsed.access_signature,
        subjectId: parsed.subject_id,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/question", async (req, res, next) => {
    try {
      const parsed = quizQuestionCreateBodySchema.parse(req.body);
      const result = await service.addQuizQuestion({
        sessionId: parsed.session_id,
        accessSignature: parsed.access_signature,
        subjectId: parsed.subject_id,
        questionText: parsed.question_text,
        questionType: parsed.question_type,
        points: parsed.points,
        ordering: parsed.ordering,
        options: parsed.options.map((option) => ({
          key: option.key,
          text: option.text,
          isCorrect: Boolean(option.is_correct),
        })),
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/questions/bulk", async (req, res, next) => {
    try {
      const parsed = quizQuestionBulkCreateBodySchema.parse(req.body);
      const result = await service.addQuizQuestionsBulk({
        sessionId: parsed.session_id,
        accessSignature: parsed.access_signature,
        questions: parsed.questions.map((question) => ({
          subjectId: question.subject_id,
          questionText: question.question_text,
          questionType: question.question_type,
          points: question.points,
          ordering: question.ordering,
          options: question.options.map((option) => ({
            key: option.key,
            text: option.text,
            isCorrect: Boolean(option.is_correct),
          })),
        })),
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/publish", async (req, res, next) => {
    try {
      const parsed = quizPublishBodySchema.parse(req.body);
      const result = await service.setQuizPublished(parsed.session_id, parsed.access_signature, parsed.published);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/start", async (req, res, next) => {
    try {
      const parsed = quizStartAttemptBodySchema.parse(req.body);
      const result = await service.startQuizAttempt({
        sessionId: parsed.session_id,
        accessSignature: parsed.access_signature,
        studentName: parsed.student_name,
        studentClass: parsed.student_class,
        studentElective: parsed.student_elective,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/assign-token", async (req, res, next) => {
    try {
      const parsed = quizAssignTokenBodySchema.parse(req.body);
      const result = await service.assignQuizToStudentToken({
        sessionId: parsed.session_id,
        accessSignature: parsed.access_signature,
        studentToken: parsed.student_token,
        assigned: parsed.assigned ?? true,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/assign-all-active-tokens", async (req, res, next) => {
    try {
      const parsed = quizAccessBodySchema.parse(req.body);
      const result = await service.assignQuizToAllActiveStudentTokens({
        sessionId: parsed.session_id,
        accessSignature: parsed.access_signature,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/answer", async (req, res, next) => {
    try {
      const parsed = quizAnswerBodySchema.parse(req.body);
      const result = await service.submitQuizAnswer({
        sessionId: parsed.session_id,
        accessSignature: parsed.access_signature,
        questionId: parsed.question_id,
        selectedOptionIds: parsed.selected_option_ids,
        textAnswer: parsed.text_answer,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/finish", async (req, res, next) => {
    try {
      const parsed = quizFinishBodySchema.parse(req.body);
      const result = await service.finishQuizAttempt(parsed.session_id, parsed.access_signature);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/result/upload", async (req, res, next) => {
    try {
      const parsed = quizResultUploadBodySchema.parse(req.body);
      const result = await service.uploadQuizResultMarkdown({
        sessionId: parsed.session_id,
        accessSignature: parsed.access_signature,
        fileName: parsed.file_name,
        markdown: parsed.markdown,
        metadata: parsed.metadata ?? {},
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get("/results", async (req, res, next) => {
    try {
      const parsed = quizResultsQuerySchema.parse({
        session_id: req.query.session_id,
        access_signature: extractBearerToken(req),
      });
      const result = await service.getQuizResultsForSession(parsed.session_id, parsed.access_signature);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get("/result", async (req, res, next) => {
    try {
      const parsed = quizResultsQuerySchema.parse({
        session_id: req.query.session_id,
        access_signature: extractBearerToken(req),
      });
      const result = await service.getQuizResultForCurrentBinding(parsed.session_id, parsed.access_signature);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
