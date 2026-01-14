import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { studyController } from '../controllers/studyController.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

router.get('/due', studyController.getDueCards);
router.get('/new', studyController.getNewCards);
router.post('/review', studyController.submitReview);
router.get('/stats', studyController.getStats);
router.get('/heatmap', studyController.getHeatmap);

export default router;
