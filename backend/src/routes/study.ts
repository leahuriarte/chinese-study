import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { studyController } from '../controllers/studyController.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

router.get('/stats', studyController.getStats);

export default router;
