import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { studyService } from '../services/studyService.js';
import { z } from 'zod';

const studySessionSchema = z.object({
  mode: z.string().min(1),
  sessionType: z.enum(['mastery', 'quick']),
  writingMode: z.enum(['stroke_order', 'freehand']),
  studySource: z.enum(['lesson', 'folder']),
  filters: z.object({
    textbookPart: z.number().optional(),
    lessonNumbers: z.array(z.number()).optional(),
    folderId: z.string().optional(),
  }),
  state: z.object({
    queue: z.array(z.object({
      cardId: z.string(),
      correctCount: z.number().int().min(0),
      totalAttempts: z.number().int().min(0),
    })),
    masteredCardIds: z.array(z.string()),
    completedCardIds: z.array(z.string()),
    wrongCardIds: z.array(z.string()),
    totalCards: z.number().int().min(0).optional(),
  }),
});

export const studyController = {
  async getStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId!;
      const stats = await studyService.getStats(userId);
      res.json(stats);
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async getLatestSession(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId!;
      const session = await studyService.getLatestSession(userId);
      res.json(session);
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async createSession(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId!;
      const data = studySessionSchema.parse(req.body);
      const session = await studyService.createSession(userId, data);
      res.status(201).json(session);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.issues });
        return;
      }
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async updateSession(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId!;
      const sessionId = req.params.id as string;
      const data = studySessionSchema.parse(req.body);
      const session = await studyService.updateSession(userId, sessionId, data);
      res.json(session);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.issues });
        return;
      }
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async completeSession(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId!;
      const sessionId = req.params.id as string;
      const data = studySessionSchema.parse(req.body);
      const session = await studyService.completeSession(userId, sessionId, data);
      res.json(session);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.issues });
        return;
      }
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },
};
