import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { studyService } from '../services/studyService.js';
import { z } from 'zod';

const reviewSchema = z.object({
  cardId: z.string(),
  mode: z.enum([
    'hanzi_to_pinyin',
    'pinyin_to_english',
    'english_to_hanzi',
    'english_to_pinyin',
    'pinyin_to_hanzi',
    'hanzi_to_english',
  ]),
  quality: z.number().min(0).max(5),
  responseTimeMs: z.number(),
});

export const studyController = {
  async getDueCards(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId!;
      const mode = req.query.mode as any;
      const limit = parseInt(req.query.limit as string) || 20;

      if (!mode) {
        res.status(400).json({ error: 'Mode is required' });
        return;
      }

      const cards = await studyService.getDueCards(userId, mode, limit);
      res.json(cards);
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async getNewCards(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId!;
      const mode = req.query.mode as any;
      const limit = parseInt(req.query.limit as string) || 10;

      if (!mode) {
        res.status(400).json({ error: 'Mode is required' });
        return;
      }

      const cards = await studyService.getNewCards(userId, mode, limit);
      res.json(cards);
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async submitReview(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId!;
      const data = reviewSchema.parse(req.body);
      const result = await studyService.submitReview(userId, data);
      res.json(result);
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

  async getHeatmap(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId!;
      const days = parseInt(req.query.days as string) || 90;
      const heatmap = await studyService.getHeatmap(userId, days);
      res.json(heatmap);
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },
};
