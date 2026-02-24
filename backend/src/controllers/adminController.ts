import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import bcrypt from 'bcrypt';
import { getRecursiveReporteeIds, getEmployeeHierarchy } from '../utils/userUtils';
import { logActivity } from '../utils/logger';
import { employeeSelect } from '../utils/selectUtils';
import { safeHandler } from '../utils/handlerUtils';

//--- EMPLOYEE & USER MANAGEMENT (ONBOARDING) ---
export const getEmployees = safeHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const scope = (req as any).permissionScope;

  let whereClause: any = {};

  if (scope === 'own') {
    whereClause.id = user.employeeId;
  } else if (scope === 'department') {
    whereClause.departmentId = user.departmentId;
  } else if (scope === 'team') {
    const reporteeIds = await getRecursiveReporteeIds(user.employeeId);
    whereClause.id = { in: [user.employeeId, ...reporteeIds] };
  }

  const employees = await prisma.employee.findMany({
    where: whereClause,
    select: employeeSelect
  });
  res.json(employees);
});

export const getHierarchy = safeHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const scope = (req as any).permissionScope;

  let rootId: number | null = null;
  if (scope === 'all') {
    rootId = null; // Admin sees all
  } else if (scope === 'department') {
    // For department scope, we don't root at the user, 
    // but we filter the entire hierarchy fetch by department in userUtils
    rootId = null; 
  } else {
    rootId = user.employeeId;
  }

  const hierarchy = await getEmployeeHierarchy(rootId, scope === 'department' ? user.departmentId : undefined);
  res.json(hierarchy);
});

export const createEmployee = safeHandler(async (req: Request, res: Response) => {
  const { 
    firstName, lastName, email, phone, 
    departmentId, roleId, managerId, password 
  } = req.body;
  const user = (req as any).user;
  const scope = (req as any).permissionScope;

  // SCOPE CHECK: Only 'all' can create in any dept.
  if (scope !== 'all') {
    return res.status(403).json({ message: 'Access denied: Only users with ALL scope can onboard new employees' });
  }
  
  // Validate that departmentId is provided
  if (!departmentId) {
    return res.status(400).json({ message: 'Department ID is required' });
  }

  const result = await prisma.$transaction(async (tx) => {
    // 0. Auto-generate EmpID
    const lastEmployee = await tx.employee.findFirst({
      orderBy: { id: 'desc' }
    });
    
    let nextEmpId = "EMP001";
    if (lastEmployee && lastEmployee.empId) {
      const lastNum = parseInt(lastEmployee.empId.replace("EMP", ""));
      nextEmpId = `EMP${String(lastNum + 1).padStart(3, '0')}`;
    }

    // 1. Check for existing user
    let userRecord = await tx.user.findUnique({ where: { email } });

    if (userRecord) {
      // Validation: Role must belong to Department (or be global)
      const role = await tx.role.findUnique({ where: { id: Number(roleId) } });
      if (role && role.departmentId && role.departmentId !== Number(departmentId)) {
        throw new Error('Selected role does not belong to the selected department');
      }

    } else {
      // NEW USER
      if (!password) throw new Error('Password is required for new account induction');
      
      const hashedPassword = await bcrypt.hash(password, 10);
      userRecord = await tx.user.create({
        data: {
          email,
          passwordHash: hashedPassword,
          isActive: true
        } as any
      });
    }

    // 2. Create Employee Profile
    const employee = await tx.employee.create({
      data: {
        empId: nextEmpId,
        firstName,
        lastName,
        email,
        phone,
        departmentId: Number(departmentId),
        roleId: Number(roleId),
        managerId: managerId ? Number(managerId) : null,
        userId: userRecord.id,
        isActive: true
      }
    });

    return { user: userRecord, employee, nextEmpId };
  });

  await logActivity({
    employeeId: user.employeeId,
    module: 'admin',
    action: 'ONBOARD_EMPLOYEE',
    entityId: String(result.employee.id),
    entityName: `${result.employee.firstName} ${result.employee.lastName}`,
    description: `New employee onboarded: ${result.employee.firstName} ${result.employee.lastName} (${result.nextEmpId})`
  });

  res.status(201).json(result.employee);
});

export const updateEmployee = safeHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { 
        firstName, lastName, phone, 
        departmentId, roleId, managerId, isActive 
    } = req.body;

    const employeeId = Number(id);
    const user = (req as any).user;
    const scope = (req as any).permissionScope;

    // Check if user has permission for this specific employee based on scope
    if (scope === 'own' && employeeId !== user.employeeId) {
        return res.status(403).json({ message: 'Access denied: You can only edit your own profile' });
    } else if (scope === 'team') {
        const reporteeIds = await getRecursiveReporteeIds(user.employeeId);
        const teamIds = [user.employeeId, ...reporteeIds];
        if (!teamIds.includes(employeeId)) {
            return res.status(403).json({ message: 'Access denied: Employee not in your team' });
        }
    } else if (scope === 'department') {
        const targetEmp = await prisma.employee.findUnique({ where: { id: employeeId }, select: { departmentId: true } });
        if (!targetEmp || targetEmp.departmentId !== user.departmentId) {
            return res.status(403).json({ message: 'Access denied: Employee belongs to another department' });
        }
    }


    const existingEmp = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!existingEmp) return res.status(404).json({ message: 'Employee not found' });

    const employee = await prisma.$transaction(async (tx) => {
        const updateData: any = { firstName, lastName, phone };

        // SECURITY PATCH: Only allow Role/Dept/Manager/Active changes if scope is 'all'
        // OR if the values aren't actually changing (to allow the request to pass)
        if (scope === 'all') {
            if (departmentId !== undefined) updateData.departmentId = Number(departmentId);
            if (roleId !== undefined) updateData.roleId = Number(roleId);
            if (managerId !== undefined) {
                const newMgrId = managerId ? Number(managerId) : null;
                
                // CIRCULAR CHECK: New manager cannot be the employee themselves
                if (newMgrId === employeeId) {
                    throw new Error('An employee cannot be their own manager');
                }

                // CIRCULAR CHECK: New manager cannot be a subordinate of this employee
                if (newMgrId !== null) {
                    const reporteeIds = await getRecursiveReporteeIds(employeeId);
                    if (reporteeIds.includes(newMgrId)) {
                        throw new Error('Circular dependency: Selected manager is already a subordinate of this employee');
                    }
                }
                updateData.managerId = newMgrId;
            }
        } else {
            // If not 'all' scope, reject if they try to change sensitive fields
            if (
                (departmentId !== undefined && Number(departmentId) !== existingEmp.departmentId) ||
                (roleId !== undefined && Number(roleId) !== existingEmp.roleId) ||
                (managerId !== undefined && (managerId ? Number(managerId) : null) !== existingEmp.managerId) ||
                (isActive !== undefined)
            ) {
                throw new Error('Access denied: You do not have permission to change role, department, manager, or status');
            }
        }

        // Validation: Role must belong to Department (or be global)
        if (updateData.roleId && updateData.departmentId) {
            const role = await tx.role.findUnique({ where: { id: updateData.roleId } });
            if (role && role.departmentId && role.departmentId !== updateData.departmentId) {
                throw new Error('Selected role does not belong to the selected department');
            }
        }

        const emp = await tx.employee.update({
            where: { id: employeeId },
            data: updateData
        });

        if (emp.userId !== null) {
            const userUpdate: any = {};
            if (typeof isActive === 'boolean' && scope === 'all') userUpdate.isActive = isActive;

            if (Object.keys(userUpdate).length > 0) {
                await tx.user.update({
                    where: { id: emp.userId },
                    data: userUpdate
                });
            }
        }
        return emp;
    });

    await logActivity({
        employeeId: user.employeeId,
        module: 'admin',
        action: 'UPDATE_EMPLOYEE',
        entityId: String(employeeId),
        entityName: `${employee.firstName} ${employee.lastName}`,
        description: `Employee profile updated for ${employee.firstName} ${employee.lastName}`
    });

    res.json(employee);
});

export const deleteEmployee = safeHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = (req as any).user;
    const scope = (req as any).permissionScope;

    if (scope !== 'all') {
        return res.status(403).json({ message: 'Access denied: Only admins can delete/deactivate employees' });
    }

    const employeeId = Number(id);
    const existingEmp = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!existingEmp) return res.status(404).json({ message: 'Employee not found' });

    // SOFT DELETE Logic
    await prisma.$transaction(async (tx) => {
        // 1. Mark Employee as inactive
        await tx.employee.update({
            where: { id: employeeId },
            data: { isActive: false }
        });

        // 2. Mark User as inactive (Ghost Access Prevention)
        if (existingEmp.userId) {
            await tx.user.update({
                where: { id: existingEmp.userId },
                data: { isActive: false }
            });
        }
    });

    await logActivity({
        employeeId: user.employeeId,
        module: 'admin',
        action: 'DEACTIVATE_EMPLOYEE',
        entityId: String(employeeId),
        entityName: `${existingEmp.firstName} ${existingEmp.lastName}`,
        description: `Employee deactivated (soft-delete): ${existingEmp.firstName} ${existingEmp.lastName}`
    });

    res.json({ message: 'Employee deactivated successfully (soft-delete enforced for audit trails)' });
});

export const getPendingUsers = safeHandler(async (req: Request, res: Response) => {
  const unassignedRole = await prisma.role.findUnique({ where: { code: 'UNASSIGNED' } });
  if (!unassignedRole) return res.json([]);

  const users = await prisma.user.findMany({
    where: {
      employee: null
    },
    select: {
      id: true,
      email: true,
      createdAt: true
    }
  });
  res.json(users);
});

// --- DEPARTMENT CRUD ---

export const getDepartments = safeHandler(async (req: Request, res: Response) => {
  const departments = await prisma.department.findMany({
    include: {
      _count: {
        select: { employees: true, leads: true }
      }
    }
  });
  res.json(departments);
});

export const createDepartment = safeHandler(async (req: Request, res: Response) => {
  const { name, code, description } = req.body;
  const user = (req as any).user;
  const scope = (req as any).permissionScope;

  if (scope !== 'all') {
    return res.status(403).json({ message: 'Access denied: Requires system-wide scope' });
  }
  const department = await prisma.department.create({
    data: { name, code, description }
  });

  await logActivity({
    employeeId: user.employeeId,
    module: 'admin',
    action: 'CREATE_DEPARTMENT',
    entityId: String(department.id),
    entityName: department.name,
    description: `New department created: ${department.name}`
  });

  res.status(201).json(department);
});

export const updateDepartment = safeHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, code, description, isActive } = req.body;
  const user = (req as any).user;
  const scope = (req as any).permissionScope;

  if (scope !== 'all') {
    return res.status(403).json({ message: 'Access denied: Requires system-wide scope' });
  }
  const department = await prisma.department.update({
    where: { id: Number(id) },
    data: { name, code, description, isActive }
  });

  await logActivity({
    employeeId: user.employeeId,
    module: 'admin',
    action: 'UPDATE_DEPARTMENT',
    entityId: String(department.id),
    entityName: department.name,
    description: `Department updated: ${department.name}`
  });

  res.json(department);
});

// --- ROLE CRUD ---

export const getRoles = safeHandler(async (req: Request, res: Response) => {
  const { departmentId } = req.query;
  const user = (req as any).user;
  const scope = (req as any).permissionScope;

  const whereClause: any = {};
  
  if (scope === 'department') {
      whereClause.departmentId = user.departmentId;
  } else if (scope === 'team') {
      whereClause.departmentId = user.departmentId;
  } else if (scope === 'own') {
      return res.status(403).json({ message: 'Access denied: You cannot view roles' });
  }

  if (departmentId && scope === 'all') {
    whereClause.departmentId = Number(departmentId);
  }

  const roles = await prisma.role.findMany({
    where: whereClause,
    include: {
      department: { select: { name: true, code: true } },
      _count: { select: { employees: true } }
    }
  });
  res.json(roles);
});

export const createRole = safeHandler(async (req: Request, res: Response) => {
  const { name, code, description, departmentId } = req.body;
  const user = (req as any).user;
  const scope = (req as any).permissionScope;

  const targetDeptId = departmentId ? Number(departmentId) : null;

  if (scope !== 'all') {
      return res.status(403).json({ message: 'Access denied: Only users with ALL scope can create new roles' });
  }

  const role = await prisma.role.create({
    data: {
      name,
      code,
      description,
      departmentId: targetDeptId,
      isActive: true
    }
  });
  res.status(201).json(role);
});

export const updateRole = safeHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, code, description, isActive, departmentId } = req.body;
  const user = (req as any).user;
  const scope = (req as any).permissionScope;

  const existingRole = await prisma.role.findUnique({ where: { id: Number(id) } });
  if (!existingRole) return res.status(404).json({ message: 'Role not found' });

  if (scope === 'department' && existingRole.departmentId !== user.departmentId) {
      return res.status(403).json({ message: 'Access denied: Cannot modify role outside your department' });
  }
  if (scope === 'team' || scope === 'own') {
      return res.status(403).json({ message: 'Access denied: Insufficient scope' });
  }

  // Prevent changing department if not admin
  const targetDeptId = scope === 'all' ? (departmentId ? Number(departmentId) : null) : existingRole.departmentId;

  const role = await prisma.role.update({
    where: { id: Number(id) },
    data: { 
      name, 
      code, 
      description, 
      isActive,
      departmentId: targetDeptId,
      roleVersion: { increment: 1 } as any // Triggers JWT hygiene
    }
  });
  res.json(role);
});

// --- PERMISSION MATRIX ---
export const getAllPermissions = async (req: Request, res: Response) => {
  try {
    const permissions = await prisma.permission.findMany();
    res.json(permissions);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching permissions' });
  }
};

export const getRolePermissions = async (req: Request, res: Response) => {
  const { roleId } = req.params;
  try {
    const rolePermissions = await prisma.rolePermission.findMany({
      where: { roleId: Number(roleId) },
      include: { permission: true }
    });
    res.json(rolePermissions.map(rp => rp.permission));
  } catch (error) {
    res.status(500).json({ message: 'Error fetching role permissions' });
  }
};

export const syncRolePermissions = async (req: Request, res: Response) => {
  const { roleId } = req.params;
  const { permissionIds } = req.body;
  const user = (req as any).user;
  const scope = (req as any).permissionScope;

  try {
    const targetRole = await prisma.role.findUnique({ where: { id: Number(roleId) } });
    if (!targetRole) return res.status(404).json({ message: 'Role not found' });

    if (scope === 'department' && targetRole.departmentId !== user.departmentId) {
        return res.status(403).json({ message: 'Access denied: Cannot sync permissions for role outside your department' });
    }
    if (scope === 'team' || scope === 'own') {
        return res.status(403).json({ message: 'Access denied: Insufficient scope' });
    }

    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId: Number(roleId) } }),
      prisma.rolePermission.createMany({
        data: permissionIds.map((pId: number) => ({
          roleId: Number(roleId),
          permissionId: pId
        }))
      }),
      // Bump roleVersion to force re-login for all users with this role
      prisma.role.update({
          where: { id: Number(roleId) },
          data: { roleVersion: { increment: 1 } as any }
      })
    ]);

    await logActivity({
      employeeId: user.employeeId,
      module: 'admin',
      action: 'SYNC_PERMISSIONS',
      entityId: String(roleId),
      entityName: targetRole.name,
      description: `Permissions synced for role: ${targetRole.name}`
    });

    res.json({ message: 'Permissions synced successfully' });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ message: 'Error syncing permissions' });
  }
};

export const getPermissionMatrix = async (req: Request, res: Response) => {
  const { departmentId } = req.query;
  const user = (req as any).user;
  const scope = (req as any).permissionScope;

  try {
    const whereRole: any = {};
    
    if (scope === 'department' || scope === 'team') {
        whereRole.departmentId = user.departmentId;
    } else if (scope === 'own') {
        return res.status(403).json({ message: 'Access denied: Insufficient scope to view matrix' });
    }

    if (departmentId && departmentId !== 'all' && scope === 'all') {
      whereRole.OR = [
        { departmentId: Number(departmentId) },
        { departmentId: null }
      ];
    }

    const [roles, permissions, rolePermissions] = await Promise.all([
      prisma.role.findMany({
        where: whereRole,
        select: { id: true, name: true, code: true, departmentId: true }
      }),
      prisma.permission.findMany(),
      prisma.rolePermission.findMany()
    ]);

    // Build the matrix: { roleId: permIds[] }
    const matrix: Record<number, number[]> = {};
    
    // Initialize for all roles found
    roles.forEach(r => { matrix[r.id] = []; });
    
    // Populate with actual permissions
    rolePermissions.forEach(rp => {
      if (matrix[rp.roleId]) {
        matrix[rp.roleId].push(rp.permissionId);
      }
    });

    res.json({
      roles,
      permissions,
      matrix
    });
  } catch (error) {
    console.error('Matrix fetch error:', error);
    res.status(500).json({ message: 'Error fetching permission matrix' });
  }
};
