import express from 'express';
import { 
  getDepartments, createDepartment, updateDepartment,
  getRoles, createRole, updateRole,
  getAllPermissions, getRolePermissions, syncRolePermissions,
  getEmployees, createEmployee, updateEmployee, deleteEmployee, getPendingUsers,
  getHierarchy,
  getPermissionMatrix
} from '../controllers/adminController';
import { authenticateToken, checkPermission } from '../middleware/auth';

const router = express.Router();

// All admin routes require authentication
router.use(authenticateToken);

// TODO: Add strict isAdmin middleware check here if needed

// Employees
router.get('/employees', checkPermission('employees', 'view'), getEmployees);
router.get('/hierarchy-tree', checkPermission('employees', 'view'), getHierarchy);
router.get('/pending-users', checkPermission('employees', 'manage'), getPendingUsers);
router.post('/employees', checkPermission('employees', 'manage'), createEmployee);
router.patch('/employees/:id', checkPermission('employees', 'edit'), updateEmployee);
router.delete('/employees/:id', checkPermission('employees', 'manage'), deleteEmployee);

// Departments
router.get('/departments', checkPermission('employees', 'view'), getDepartments);
router.post('/departments', checkPermission('employees', 'manage'), createDepartment);
router.patch('/departments/:id', checkPermission('employees', 'manage'), updateDepartment);

// Roles
router.get('/roles', checkPermission('employees', 'view'), getRoles);
router.post('/roles', checkPermission('employees', 'manage'), createRole);
router.patch('/roles/:id', checkPermission('employees', 'manage'), updateRole);

// Permissions
router.get('/permissions', checkPermission('employees', 'manage'), getAllPermissions);
router.get('/permissions-matrix', checkPermission('employees', 'manage'), getPermissionMatrix);
router.get('/roles/:roleId/permissions', checkPermission('employees', 'view'), getRolePermissions);
router.post('/roles/:roleId/permissions/sync', checkPermission('employees', 'manage'), syncRolePermissions);

export default router;
