import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'Authentication token required' });

  jwt.verify(token, JWT_SECRET, async (err: any, user: any) => {
    if (err) return res.status(401).json({ message: 'Invalid or expired token' });
    
    // SECURITY PATCH: Quick check for active status if user.id is in token
    if (user.id) {
        const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { isActive: true } });
        if (!dbUser || !dbUser.isActive) {
            return res.status(401).json({ message: 'Account is disabled or does not exist' });
        }
    }

    (req as any).user = {
      ...user,
      id: user.id || null,
      employeeId: user.employeeId || null,
      departmentId: user.departmentId || null,
    };
    next();
  });
};

import { AppError } from '../utils/AppError';

export const checkPermission = (module: string, action: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    
    if (!user) {
      return next(new AppError('Access denied: No user session', 403));
    }

    // ADMIN bypass
    if (user.role === 'ADMIN') {
      (req as any).permissionScope = 'all';
      return next();
    }

    try {
      // 1. Fetch fresh permissions via the Employee profile (Schema Audit 6)
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          isActive: true,
          employee: {
            select: {
              role: {
                select: {
                  code: true,
                  permissions: {
                    include: { permission: true }
                  }
                }
              }
            }
          }
        }
      });

      if (!dbUser || !dbUser.isActive) {
          return res.status(401).json({ message: 'Account is disabled' });
      }

      if (!dbUser.employee?.role) {
        return next(new AppError('You do not have the necessary permissions to perform this action. No role assigned.', 403));
      }

      // 2. Re-check if role was updated to ADMIN
      if (dbUser.employee.role.code === 'ADMIN') {
        (req as any).permissionScope = 'all';
        return next();
      }

      const freshPermissions = dbUser.employee.role.permissions.map((rp: any) => ({
        module: rp.permission.module,
        action: rp.permission.action,
        scope: rp.permission.scopeType
      }));

      const relevantPermissions = freshPermissions.filter(
        (p: any) => p.module === module && (p.action === action || (action === 'view' && p.action === 'read'))
      );
      
      if (relevantPermissions.length === 0) {
        const actionMap: Record<string, string> = {
          'view': 'view this content',
          'create': 'create new items',
          'edit': 'make changes',
          'delete': 'delete items',
          'assign': 'assign items'
        };
        
        const readableAction = actionMap[action] || action;
        return next(new AppError(`You don't have permission to ${readableAction} in ${module}.`, 403));
      }

      // Pick the most permissive scope
      const scopeOrder = ['all', 'department', 'team', 'own'];
      relevantPermissions.sort((a: any, b: any) => 
        scopeOrder.indexOf(a.scope) - scopeOrder.indexOf(b.scope)
      );
      
      const permission = relevantPermissions[0];


      // Attach permission scope to request for controller filtering
      (req as any).permissionScope = permission.scope;
      // Also attach all fresh permissions so controllers can use them
      (req as any).user.permissions = freshPermissions;
      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return next(new AppError('Error checking permissions', 500));
    }
  };
};

