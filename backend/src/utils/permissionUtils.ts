import { getRecursiveReporteeIds } from './userUtils';
import { normalizeScope } from '../types/rbac';

/**
 * Centrally builds a Prisma 'where' clause based on module and scope.
 * This ensures that hierarchical rules (ALL, DEPARTMENT, TEAM, OWN)
 * are applied consistently across the entire system.
 * 
 * Returns:
 *   {} — no filter (scope=all or ADMIN)
 *   { ...clause } — scoped filter
 *   null — DENY (no permission found)
 */
export async function getModuleWhereClause(
  user: any,
  moduleName: string,
  action: string = 'view'
): Promise<any> {
  if (user.role === 'ADMIN') return {};

  const permissions = user.permissions || [];
  
  // Standard Action Aliases (Sync with checkPermission middleware)
  const actionAliases: Record<string, string[]> = {
    'view': ['view', 'read'],
    'edit': ['edit', 'write', 'manage', 'update'],
    'delete': ['delete', 'manage'],
    'create': ['create', 'add'],
    'manage': ['manage', 'edit', 'delete']
  };

  const allowedActions = actionAliases[action] || [action];

  const permission = permissions.find(
    (p: any) => p.module === moduleName && allowedActions.includes(p.action)
  );

  if (!permission) return null; // Explicitly deny if no permission

  // Normalize legacy scope values ('assigned' → 'own')
  const scope = normalizeScope(permission.scope);

  // ─── OWN Scope ──────────────────────────────────────────────────────
  if (scope === 'own') {
    if (moduleName === 'leads') {
      return { 
        OR: [
          { ownerId: user.employeeId },
          { tasks: { some: { assigneeId: user.employeeId } } }
        ]
      };
    }
    if (moduleName === 'tasks') return { OR: [{ assigneeId: user.employeeId }, { creatorId: user.employeeId }] };
    if (moduleName === 'projects') {
      return { 
        OR: [
          { lead: { ownerId: user.employeeId } }, 
          { projectManagerId: user.employeeId }, 
          { relationshipManagerId: user.employeeId },
          { tasks: { some: { assigneeId: user.employeeId } } }
        ] 
      };
    }
    if (moduleName === 'products') return { productManagerId: user.employeeId };
    if (moduleName === 'attendance' || moduleName === 'leaves' || moduleName === 'eod') {
      return { employeeId: user.employeeId };
    }
    if (moduleName === 'employees') return { id: user.employeeId };
    if (moduleName === 'activity') return { employeeId: user.employeeId };
    if (moduleName === 'reports' || moduleName === 'dashboard') return { employeeId: user.employeeId };
    
    // Safety fallback for 'own' scope on unhandled modules
    return { employeeId: user.employeeId };
  }

  // ─── TEAM Scope (Recursive) ─────────────────────────────────────────
  if (scope === 'team') {
    const reporteeIds = await getRecursiveReporteeIds(user.employeeId);
    const teamIds = [user.employeeId, ...reporteeIds];

    if (moduleName === 'leads') {
      return { 
        OR: [
          { ownerId: { in: teamIds } },
          { tasks: { some: { assigneeId: user.employeeId } } }
        ] 
      };
    }
    if (moduleName === 'tasks') return { OR: [{ assigneeId: { in: teamIds } }, { creatorId: { in: teamIds } }] };
    if (moduleName === 'projects') {
      return { 
        OR: [
          { lead: { ownerId: { in: teamIds } } }, 
          { projectManagerId: { in: teamIds } }, 
          { relationshipManagerId: { in: teamIds } },
          { tasks: { some: { assigneeId: user.employeeId } } }
        ] 
      };
    }
    if (moduleName === 'products') {
      return { 
        OR: [
          { productManagerId: { in: teamIds } },
          { tasks: { some: { assigneeId: user.employeeId } } }
        ] 
      };
    }
    if (moduleName === 'attendance' || moduleName === 'leaves' || moduleName === 'eod') {
      return { employeeId: { in: teamIds } };
    }
    if (moduleName === 'employees') return { id: { in: teamIds } };
    if (moduleName === 'activity') return { employeeId: { in: teamIds } };
    if (moduleName === 'reports' || moduleName === 'dashboard') return { employeeId: { in: teamIds } };

    // Safety fallback for 'team' scope
    return { employeeId: { in: teamIds } };
  }

  // ─── DEPARTMENT Scope ───────────────────────────────────────────────
  if (scope === 'department') {
    if (moduleName === 'leads') {
      return { 
        OR: [
          { departmentId: user.departmentId },
          { tasks: { some: { assigneeId: user.employeeId } } }
        ] 
      };
    }
    if (moduleName === 'tasks') return { OR: [{ assignee: { departmentId: user.departmentId } }, { creator: { departmentId: user.departmentId } }] };
    if (moduleName === 'projects') {
      return { 
        OR: [
          { lead: { departmentId: user.departmentId } }, 
          { projectManager: { departmentId: user.departmentId } }, 
          { relationshipManager: { departmentId: user.departmentId } },
          { tasks: { some: { assigneeId: user.employeeId } } }
        ] 
      };
    }
    if (moduleName === 'products') {
      return { 
        OR: [
          { productManager: { departmentId: user.departmentId } },
          { tasks: { some: { assigneeId: user.employeeId } } }
        ] 
      };
    }
    if (moduleName === 'attendance' || moduleName === 'leaves' || moduleName === 'eod') {
      return { employee: { departmentId: user.departmentId } };
    }
    if (moduleName === 'employees') return { departmentId: user.departmentId };
    if (moduleName === 'activity') return { employee: { departmentId: user.departmentId } };
    if (moduleName === 'reports' || moduleName === 'dashboard') return { employee: { departmentId: user.departmentId } };

    // Safety fallback for 'department' scope
    return { departmentId: user.departmentId };
  }

  // ─── ALL Scope ──────────────────────────────────────────────────────
  return {};
}
