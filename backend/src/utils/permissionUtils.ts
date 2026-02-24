import { getRecursiveReporteeIds } from './userUtils';

/**
 * Centrally builds a Prisma 'where' clause based on module and scope.
 * This ensures that hierarchical rules (ALL, DEPARTMENT, TEAM, OWN)
 * are applied consistently across the entire system.
 */
export async function getModuleWhereClause(
  user: any,
  moduleName: string,
  action: string = 'view'
): Promise<any> {
  if (user.role === 'ADMIN') return {};

  const permissions = user.permissions || [];
  const permission = permissions.find(
    (p: any) => p.module === moduleName && (
      p.action === action || 
      (action === 'view' && p.action === 'read') ||
      (action === 'edit' && p.action === 'write') ||
      (action === 'delete' && p.action === 'edit') // Often users with edit can delete, but check matrix
    )
  );

  if (!permission) return null; // Explicitly deny if no permission

  // PRODUCT HYGIENE: Products are global catalog. 
  // View action is always 'all' scope regardless of initial assignment.
  if (moduleName === 'products' && action === 'view') return {};

  const scope = permission.scope;

  // 1. OWN / ASSIGNED Scope
  if (scope === 'own' || scope === 'assigned') {
    if (moduleName === 'leads') {
      return { 
        OR: [
          { ownerId: user.employeeId },
          { tasks: { some: { assigneeId: user.employeeId } } } // Implicit Inheritance
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
          { tasks: { some: { assigneeId: user.employeeId } } } // Implicit Inheritance
        ] 
      };
    }
    if (moduleName === 'products') return { productManagerId: user.employeeId };
    if (moduleName === 'attendance' || moduleName === 'leaves' || moduleName === 'eod') return { employeeId: user.employeeId };
  }

  // 2. TEAM Scope (Recursive)
  if (scope === 'team') {
    const reporteeIds = await getRecursiveReporteeIds(user.employeeId);
    const teamIds = [user.employeeId, ...reporteeIds];

    if (moduleName === 'leads') {
      return { 
        OR: [
          { ownerId: { in: teamIds } },
          { tasks: { some: { assigneeId: user.employeeId } } } // Implicit Inheritance
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
          { tasks: { some: { assigneeId: user.employeeId } } } // Implicit Inheritance
        ] 
      };
    }
    if (moduleName === 'products') {
      return { 
        OR: [
          { productManagerId: { in: teamIds } },
          { tasks: { some: { assigneeId: user.employeeId } } } // Implicit Inheritance
        ] 
      };
    }
    if (moduleName === 'attendance' || moduleName === 'leaves' || moduleName === 'eod') return { employeeId: { in: teamIds } };
  }

  // 3. DEPARTMENT Scope
  if (scope === 'department') {
    if (moduleName === 'leads') {
      return { 
        OR: [
          { departmentId: user.departmentId },
          { tasks: { some: { assigneeId: user.employeeId } } } // Implicit Inheritance
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
          { tasks: { some: { assigneeId: user.employeeId } } } // Implicit Inheritance
        ] 
      };
    }
    if (moduleName === 'products') {
      return { 
        OR: [
          { productManager: { departmentId: user.departmentId } },
          { tasks: { some: { assigneeId: user.employeeId } } } // Implicit Inheritance
        ] 
      };
    }
    if (moduleName === 'attendance' || moduleName === 'leaves' || moduleName === 'eod') return { employee: { departmentId: user.departmentId } };
  }

  // 4. ALL Scope
  return {};
}
