import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { folderService } from '../services/folderService.js';

export const foldersController = {
  async getFolders(req: AuthRequest, res: Response): Promise<void> {
    try {
      const folders = await folderService.getFolders(req.userId!);
      res.json(folders);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async createFolder(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { name, description } = req.body;
      if (!name || typeof name !== 'string') {
        res.status(400).json({ error: 'Name is required' });
        return;
      }
      const folder = await folderService.createFolder(req.userId!, name.trim(), description?.trim());
      res.status(201).json(folder);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async updateFolder(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const { name, description } = req.body;
      const folder = await folderService.updateFolder(req.userId!, id, { name, description });
      res.json(folder);
    } catch (error) {
      if (error instanceof Error && error.message === 'Folder not found') {
        res.status(404).json({ error: 'Folder not found' });
        return;
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async deleteFolder(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      await folderService.deleteFolder(req.userId!, id);
      res.json({ message: 'Folder deleted' });
    } catch (error) {
      if (error instanceof Error && error.message === 'Folder not found') {
        res.status(404).json({ error: 'Folder not found' });
        return;
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async getFolderCards(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const cards = await folderService.getFolderCards(req.userId!, id);
      res.json(cards);
    } catch (error) {
      if (error instanceof Error && error.message === 'Folder not found') {
        res.status(404).json({ error: 'Folder not found' });
        return;
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async addCardsToFolder(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const { cardIds } = req.body;
      if (!Array.isArray(cardIds)) {
        res.status(400).json({ error: 'cardIds must be an array' });
        return;
      }
      const result = await folderService.addCardsToFolder(req.userId!, id, cardIds);
      res.json(result);
    } catch (error) {
      if (error instanceof Error && error.message === 'Folder not found') {
        res.status(404).json({ error: 'Folder not found' });
        return;
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async removeCardFromFolder(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const cardId = req.params.cardId as string;
      await folderService.removeCardFromFolder(req.userId!, id, cardId);
      res.json({ message: 'Card removed from folder' });
    } catch (error) {
      if (error instanceof Error && error.message === 'Folder not found') {
        res.status(404).json({ error: 'Folder not found' });
        return;
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },
};
