import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { studyController } from '../controllers/studyController.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

router.get('/stats', studyController.getStats);
router.get('/sessions/latest', studyController.getLatestSession);
router.post('/sessions', studyController.createSession);
router.patch('/sessions/:id', studyController.updateSession);
router.post('/sessions/:id/complete', studyController.completeSession);

export default router;
