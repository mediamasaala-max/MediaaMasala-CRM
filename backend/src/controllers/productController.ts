import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { getRecursiveReporteeIds } from '../utils/userUtils';
import { getModuleWhereClause } from '../utils/permissionUtils';
import { logActivity } from '../utils/logger';
import { safeHandler } from '../utils/handlerUtils';
import { productSelect } from '../utils/selectUtils';

export const getProducts = safeHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;

  // 1. Apply RBAC Scope using Centralized Utility
  let whereClause = await getModuleWhereClause(user, 'products');
  if (whereClause === null) return res.status(403).json({ message: 'Access denied' });
  
  // Maintain Discontinued filter
  whereClause.status = { not: 'Discontinued' };

  const products = await (prisma as any).product.findMany({
    where: whereClause,
    select: productSelect,
    orderBy: { name: 'asc' }
  });
  res.json(products);
});

export const getProductById = safeHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;

  const whereClause = await getModuleWhereClause(user, 'products');
  if (whereClause === null) return res.status(403).json({ message: 'Access denied' });

  const product = await (prisma as any).product.findFirst({
    where: {
      AND: [
        { id: parseInt(id) },
        whereClause
      ]
    },
    include: {
      productManager: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          empId: true,
          role: { select: { name: true } },
          department: { select: { name: true } }
        }
      },
      tasks: {
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          assignee: { select: { firstName: true, lastName: true } }
        },
        orderBy: { dueDate: 'asc' }
      }
    }
  });

  if (!product) return res.status(404).json({ message: 'Product not found or access denied' });

  res.json(product);
});

export const createProduct = safeHandler(async (req: Request, res: Response) => {
  const { name, description, price, category, productManagerId, status } = req.body;
  const user = (req as any).user;
  const scope = (req as any).permissionScope;

  if (scope !== 'all') {
    return res.status(403).json({ message: 'Access denied: Only users with ALL scope can add new products to the catalog' });
  }

  const pmId = productManagerId ? parseInt(productManagerId) : null;

  // SCOPE CHECK for PM assignment
  if (pmId) {
     if (scope === 'own' && pmId !== user.employeeId) {
       return res.status(403).json({ message: 'Access denied: Can only manage your own products' });
     }
     if (scope === 'team') {
        const reporteeIds = await getRecursiveReporteeIds(user.employeeId);
        if (pmId !== user.employeeId && !reporteeIds.includes(pmId)) {
          return res.status(403).json({ message: 'Access denied: PM not in your team' });
        }
     }
     if (scope === 'department') {
        const mgr = await prisma.employee.findUnique({ where: { id: pmId } });
        if (mgr && mgr.departmentId !== user.departmentId) {
          return res.status(403).json({ message: 'Access denied: PM from another department' });
        }
     }
  }

  const product = await (prisma as any).product.create({
    data: {
      name,
      description,
      price,
      category,
      status: status || 'Active',
      productManagerId: pmId
    },
    select: productSelect
  });

  await logActivity({
    employeeId: user.employeeId,
    module: 'products',
    action: 'CREATE',
    entityId: String(product.id),
    entityName: product.name,
    description: `New product added to catalog: ${product.name}`
  });

  res.status(201).json(product);
});

export const updateProduct = safeHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description, price, category, isActive, productManagerId, status } = req.body;
  const user = (req as any).user;

  const rbacWhere = await getModuleWhereClause(user, 'products', 'edit');
  if (rbacWhere === null) return res.status(403).json({ message: 'Access denied' });

  const existing = await (prisma as any).product.findFirst({ 
    where: {
      AND: [
        { id: parseInt(id) },
        rbacWhere
      ]
    }
  });
  if (!existing) return res.status(404).json({ message: 'Product not found or access denied' });

  const data: any = {};
  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description;
  if (price !== undefined) data.price = price;
  if (category !== undefined) data.category = category;
  if (isActive !== undefined) data.isActive = isActive;
  if (status !== undefined) data.status = status;
  if (productManagerId !== undefined) data.productManagerId = productManagerId ? parseInt(productManagerId) : null;

  const product = await (prisma as any).product.update({
    where: { id: parseInt(id) },
    data,
    select: productSelect
  });

  await logActivity({
    employeeId: user.employeeId,
    module: 'products',
    action: 'UPDATE',
    entityId: String(product.id),
    entityName: product.name,
    description: `Product information updated for ${product.name}`
  });

  res.json(product);
});

export const deleteProduct = safeHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;

  const rbacWhere = await getModuleWhereClause(user, 'products', 'delete');
  if (rbacWhere === null) return res.status(403).json({ message: 'Access denied' });

  const existing = await (prisma as any).product.findFirst({ 
     where: {
       AND: [
         { id: parseInt(id) },
         rbacWhere
       ]
     }
  });
  if (!existing) return res.status(404).json({ message: 'Product not found or access denied' });

  await (prisma as any).product.delete({
    where: { id: parseInt(id) }
  });

  await logActivity({
    employeeId: user.employeeId,
    module: 'products',
    action: 'DELETE',
    entityId: id,
    entityName: existing.name,
    description: `Product removed from catalog: ${existing.name}`
  });

  res.json({ message: 'Product deleted successfully' });
});
