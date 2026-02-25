import express from 'express';
import { getLeaves, applyLeave, approveLeave } from '../controllers/leaveController';
import { authenticateToken, checkPermission } from '../middleware/auth';

const router = express.Router();

router.get('/', authenticateToken, checkPermission('leaves', 'view'), getLeaves);
router.post('/', authenticateToken, checkPermission('leaves', 'create'), applyLeave);
router.patch('/:id/approve', authenticateToken, checkPermission('leaves', 'approve'), approveLeave);

export default router;
