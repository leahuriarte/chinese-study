import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { foldersController } from '../controllers/foldersController.js';

const router = Router();

router.use(authMiddleware);

router.get('/', foldersController.getFolders);
router.post('/', foldersController.createFolder);
router.put('/:id', foldersController.updateFolder);
router.delete('/:id', foldersController.deleteFolder);
router.get('/:id/cards', foldersController.getFolderCards);
router.post('/:id/cards', foldersController.addCardsToFolder);
router.delete('/:id/cards/:cardId', foldersController.removeCardFromFolder);

export default router;
