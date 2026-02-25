import express from 'express';
import { getProducts, getProductById, createProduct, updateProduct, deleteProduct } from '../controllers/productController';
import { getEmployees } from '../controllers/adminController';
import { authenticateToken, checkPermission } from '../middleware/auth';

const router = express.Router();

router.get('/employees', authenticateToken, checkPermission('products', 'view'), getEmployees);
router.get('/', authenticateToken, checkPermission('products', 'view'), getProducts);
router.get('/:id', authenticateToken, checkPermission('products', 'view'), getProductById);
router.post('/', authenticateToken, checkPermission('products', 'create'), createProduct);
router.patch('/:id', authenticateToken, checkPermission('products', 'edit'), updateProduct);
router.delete('/:id', authenticateToken, checkPermission('products', 'delete'), deleteProduct);

export default router;
