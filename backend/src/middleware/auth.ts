import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { normalizeScope } from '../types/rbac';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Performance Optimization: In-memory cache for user permissions
// TTL: 2 minutes to balance speed and security propagation
const permissionCache = new Map<number, { data: any, timestamp: number }>();
const CACHE_TTL = 2 * 60 * 1000; 

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'Authentication token required' });

  jwt.verify(token, JWT_SECRET, async (err: any, user: any) => {
    if (err) return res.status(401).json({ message: 'Invalid or expired token' });
    
    if (user.id) {
        // Check cache first
        const cached = permissionCache.get(user.id);
        const now = Date.now();

        if (cached && (now - cached.timestamp < CACHE_TTL)) {
            (req as any).fullUser = cached.data;
            (req as any).user = {
              ...user,
              id: user.id,
              employeeId: cached.data.employee?.id || null,
              departmentId: cached.data.employee?.departmentId || null,
              role: cached.data.employee?.role?.code || null
            };
            return next();
        }

        const dbUser = await prisma.user.findUnique({ 
          where: { id: user.id }, 
          select: { 
            isActive: true,
            employee: {
              select: {
                id: true,
                departmentId: true,
                isActive: true,
                role: {
                  select: {
                    code: true,
                    permissions: {
                      select: {
                        permission: true
                      }
                    }
                  }
                }
              }
            }
          } 
        });

        if (!dbUser || !dbUser.isActive) {
            return res.status(401).json({ message: 'Account is disabled or session invalid' });
        }

        // Update cache
        permissionCache.set(user.id, { data: dbUser, timestamp: now });

        (req as any).fullUser = dbUser;
        (req as any).user = {
          ...user,
          id: user.id,
          employeeId: dbUser.employee?.id || null,
          departmentId: dbUser.employee?.departmentId || null,
          role: dbUser.employee?.role?.code || null
        };
    }

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

    try {
      // 1. Re-use the consolidated User context pre-fetched in authenticateToken
      const dbUser = (req as any).fullUser;

      if (!dbUser) {
          return res.status(401).json({ message: 'Session context lost. Please re-authenticate.' });
      }

      if (!dbUser || !dbUser.isActive) {
          return res.status(401).json({ message: 'Account is disabled or session invalid' });
      }

      const roleCode = (dbUser as any).employee?.role?.code;

      // 2. ADMIN bypass (Using DB value, NOT token value)
      if (roleCode === 'ADMIN') {
        (req as any).permissionScope = 'all';
        return next();
      }

      if (!roleCode || !(dbUser as any).employee?.role?.permissions) {
        return next(new AppError('Unauthorized: No active role or permissions assigned.', 403));
      }

      // 3. Resolve and Normalize Permissions
      const freshPermissions = (dbUser as any).employee.role.permissions.map((rp: any) => ({
        module: rp.permission.module,
        action: rp.permission.action,
        scope: normalizeScope(rp.permission.scopeType)
      }));

      // 4. Match Action (with Aliases for backwards compatibility & consistency)
      // Standardize: view, create, edit, delete, assign, approve, generate, manage
      const actionAliases: Record<string, string[]> = {
        'view': ['view', 'read'],
        'edit': ['edit', 'write', 'manage', 'update'],
        'delete': ['delete', 'manage'],
        'create': ['create', 'add'],
        'manage': ['manage', 'edit', 'delete']
      };

      const allowedActions = actionAliases[action] || [action];

      const relevantPermissions = freshPermissions.filter(
        (p: any) => p.module === module && allowedActions.includes(p.action)
      );
      
      if (relevantPermissions.length === 0) {
        return next(new AppError(`Access Forbidden: Missing '${action}' permission for module '${module}'.`, 403));
      }

      // 5. Pick the most permissive scope (all > department > team > own)
      const scopeOrder = ['all', 'department', 'team', 'own'];
      relevantPermissions.sort((a: any, b: any) => 
        scopeOrder.indexOf(a.scope) - scopeOrder.indexOf(b.scope)
      );
      
      const permission = relevantPermissions[0];

      // Attach permission details to request for downstream controllers & filters
      (req as any).permissionScope = permission.scope;
      (req as any).user.permissions = freshPermissions;
      (req as any).user.role = roleCode; // Update role in req object if it changed in DB

      next();
    } catch (error) {
      console.error('RBAC Engine Error:', error);
      return next(new AppError('Internal Security Exception', 500));
    }
  };
};

