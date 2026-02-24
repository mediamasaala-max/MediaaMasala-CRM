import express from 'express';
import { 
  getLeads, 
  createLead, 
  getLeadById, 
  updateLead, 
  addLeadNote, 
  addFollowUp,
  assignLead,
  deleteLead,
  convertToProject
} from '../controllers/leadController';
import { getEmployees } from '../controllers/adminController';
import { authenticateToken, checkPermission } from '../middleware/auth';

const router = express.Router();

router.get('/employees', authenticateToken, checkPermission('leads', 'view'), getEmployees);
router.get('/', authenticateToken, checkPermission('leads', 'view'), getLeads);
router.post('/', authenticateToken, checkPermission('leads', 'create'), createLead);
router.get('/:id', authenticateToken, checkPermission('leads', 'view'), getLeadById);
router.patch('/:id', authenticateToken, checkPermission('leads', 'edit'), updateLead);
router.post('/:id/notes', authenticateToken, checkPermission('leads', 'edit'), addLeadNote);
router.post('/:id/follow-ups', authenticateToken, checkPermission('leads', 'edit'), addFollowUp);
router.post('/:id/assign', authenticateToken, checkPermission('leads', 'assign'), assignLead);
router.post('/:id/convert-to-project', authenticateToken, checkPermission('leads', 'edit'), convertToProject);
router.delete('/:id', authenticateToken, checkPermission('leads', 'delete'), deleteLead);

export default router;

