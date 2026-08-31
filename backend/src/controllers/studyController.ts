import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { studyService } from '../services/studyService.js';

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
};
