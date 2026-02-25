import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { cardService } from '../services/cardService.js';
import { z } from 'zod';

const createCardSchema = z.object({
  hanzi: z.string(),
  pinyin: z.string(),
  pinyinDisplay: z.string(),
  english: z.string(),
  englishAlt: z.array(z.string()).optional(),
  exampleSentence: z.string().optional(),
  examplePinyin: z.string().optional(),
  exampleEnglish: z.string().optional(),
  hskLevel: z.number().min(1).max(6).optional(),
  textbookPart: z.number().min(1).optional(),
  lessonNumber: z.number().min(1).optional(),
  tags: z.array(z.string()).optional(),
});

const updateCardSchema = createCardSchema.partial();

const bulkCreateSchema = z.object({
  cards: z.array(createCardSchema),
});

export const cardsController = {
  async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId!;
      const data = createCardSchema.parse(req.body);
      const card = await cardService.createCard(userId, data);
      res.status(201).json(card);
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

  async list(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId!;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const tags = req.query.tags ? (req.query.tags as string).split(',') : undefined;
      const hskLevel = req.query.hskLevel ? parseInt(req.query.hskLevel as string) : undefined;
      const textbookPart = req.query.textbookPart ? parseInt(req.query.textbookPart as string) : undefined;
      const lessonNumber = req.query.lessonNumber ? parseInt(req.query.lessonNumber as string) : undefined;
      const search = req.query.search as string;
      const folderId = req.query.folderId as string | undefined;

      const result = await cardService.listCards({
        userId,
        page,
        limit,
        tags,
        hskLevel,
        textbookPart,
        lessonNumber,
        search,
        folderId,
      });

      res.json(result);
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async get(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId!;
      const cardId = req.params.id as string;
      const card = await cardService.getCard(cardId, userId);
      res.json(card);
    } catch (error) {
      if (error instanceof Error) {
        res.status(404).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async update(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId!;
      const cardId = req.params.id as string;
      const data = updateCardSchema.parse(req.body);
      const card = await cardService.updateCard(cardId, userId, data);
      res.json(card);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.issues });
        return;
      }
      if (error instanceof Error) {
        res.status(404).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async delete(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId!;
      const cardId = req.params.id as string;
      const result = await cardService.deleteCard(cardId, userId);
      res.json(result);
    } catch (error) {
      if (error instanceof Error) {
        res.status(404).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async bulkCreate(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId!;
      const { cards } = bulkCreateSchema.parse(req.body);
      const result = await cardService.bulkCreateCards(userId, cards);
      res.status(201).json(result);
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

  async export(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId!;
      const cards = await cardService.exportCards(userId);
      res.json(cards);
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },
};
