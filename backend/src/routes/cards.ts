import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { cardsController } from '../controllers/cardsController.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

router.get('/', cardsController.list);
router.post('/', cardsController.create);
router.get('/export', cardsController.export);
router.post('/bulk', cardsController.bulkCreate);
router.get('/:id', cardsController.get);
router.put('/:id', cardsController.update);
router.delete('/:id', cardsController.delete);

export default router;
