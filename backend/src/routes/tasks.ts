import express from 'express';
import { 
  getTasks, 
  createTask, 
  getTaskById, 
  updateTask, 
  deleteTask 
} from '../controllers/taskController';
import { getEmployees } from '../controllers/adminController';
import { authenticateToken, checkPermission } from '../middleware/auth';

const router = express.Router();

router.get('/employees', authenticateToken, checkPermission('tasks', 'view'), getEmployees);
router.get('/', authenticateToken, checkPermission('tasks', 'view'), getTasks);
router.post('/', authenticateToken, checkPermission('tasks', 'create'), createTask);
router.get('/:id', authenticateToken, checkPermission('tasks', 'view'), getTaskById);
router.patch('/:id', authenticateToken, checkPermission('tasks', 'edit'), updateTask);
router.post('/:id/assign', authenticateToken, checkPermission('tasks', 'assign'), updateTask); // Same controller handles it
router.delete('/:id', authenticateToken, checkPermission('tasks', 'delete'), deleteTask);


export default router;
