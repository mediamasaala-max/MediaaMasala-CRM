import express from 'express';
import { getProjects, getProjectById, updateProject, createProject, deleteProject } from '../controllers/projectController';
import { getEmployees } from '../controllers/adminController';
import { authenticateToken, checkPermission } from '../middleware/auth';

const router = express.Router();

router.get('/employees', authenticateToken, checkPermission('projects', 'view'), getEmployees);
router.get('/', authenticateToken, checkPermission('projects', 'view'), getProjects);
router.get('/:id', authenticateToken, checkPermission('projects', 'view'), getProjectById);
router.patch('/:id', authenticateToken, checkPermission('projects', 'edit'), updateProject);

router.post('/', authenticateToken, checkPermission('projects', 'create'), createProject);
router.delete('/:id', authenticateToken, checkPermission('projects', 'delete'), deleteProject);

export default router;
