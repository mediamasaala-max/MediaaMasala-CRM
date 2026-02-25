import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { logActivity } from '../utils/logger';
import { getRecursiveReporteeIds } from '../utils/userUtils';
import { getModuleWhereClause } from '../utils/permissionUtils';
import { safeHandler } from '../utils/handlerUtils';
import { projectSelect, employeeSelectMinimal } from '../utils/selectUtils';

export const getProjects = safeHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const scope = (req as any).permissionScope;

  const { departmentId, employeeId } = req.query;
  // 1. Apply RBAC Scope using Centralized Utility
  let whereClause = await getModuleWhereClause(user, 'projects');
  if (whereClause === null) return res.status(403).json({ message: 'Access denied' });

  // Apply additional filters if scope allows
  if (departmentId) {
    const targetDeptId = Number(departmentId);
    if (scope === 'all') {
      whereClause.lead = { ...whereClause.lead, departmentId: targetDeptId };
    } else if ((scope === 'department' || scope === 'team') && targetDeptId === user.departmentId) {
      whereClause.lead = { ...whereClause.lead, departmentId: targetDeptId };
    }
  }

  if (employeeId) {
    const targetEmpId = Number(employeeId);
    const isRecursive = req.query.recursive === 'true';

    if (scope === 'all') {
      if (isRecursive) {
        const reporteeIds = await getRecursiveReporteeIds(targetEmpId);
        whereClause.lead = { ...whereClause.lead, ownerId: { in: [targetEmpId, ...reporteeIds] } };
      } else {
        whereClause.lead = { ...whereClause.lead, ownerId: targetEmpId };
      }
    } else if (scope === 'department') {
      const emp = await prisma.employee.findUnique({ where: { id: targetEmpId } });
      if (emp && emp.departmentId === user.departmentId) {
        if (isRecursive) {
          const reporteeIds = await getRecursiveReporteeIds(targetEmpId);
          whereClause.lead = { ...whereClause.lead, ownerId: { in: [targetEmpId, ...reporteeIds] } };
        } else {
          whereClause.lead = { ...whereClause.lead, ownerId: targetEmpId };
        }
      }
    } else if (scope === 'team') {
      const myReporteeIds = await getRecursiveReporteeIds(user.employeeId);
      const teamIds = [user.employeeId, ...myReporteeIds];

      if (teamIds.includes(targetEmpId)) {
        if (isRecursive) {
          const itsReporteeIds = await getRecursiveReporteeIds(targetEmpId);
          const allowedReporteeIds = itsReporteeIds.filter(id => teamIds.includes(id));
          whereClause.lead = { ...whereClause.lead, ownerId: { in: [targetEmpId, ...allowedReporteeIds] } };
        } else {
          whereClause.lead = { ...whereClause.lead, ownerId: targetEmpId };
        }
      }
    }
  }

  const projects = await (prisma as any).project.findMany({
    where: whereClause,
    select: projectSelect,
    orderBy: { createdAt: 'desc' },
    take: 100
  });

  res.json(projects);
});

export const getProjectById = safeHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;

  // 1. Apply RBAC Scope using Centralized Utility
  const rbacWhere = await getModuleWhereClause(user, 'projects');
  if (rbacWhere === null) return res.status(403).json({ message: 'Access denied' });

  const project = await (prisma as any).project.findFirst({
    where: {
      AND: [
        { id: Number(id) },
        rbacWhere
      ]
    },
    include: {
      lead: {
        select: {
          id: true,
          name: true,
          company: true,
          email: true,
          departmentId: true 
        }
      },
      projectManager: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: { select: { name: true } },
          department: { select: { id: true, name: true } },
          departmentId: true
        }
      },
      relationshipManager: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: { select: { name: true } },
          department: { select: { id: true, name: true } },
          departmentId: true
        }
      },
    }
  });

  if (!project) {
    return res.status(404).json({ message: 'Project not found or access denied' });
  }

  // SECURITY PATCH: Nested Relation Scoping (Scenario 10)
  const taskScope = await getModuleWhereClause(user, 'tasks', 'view');
  if (taskScope) {
    (project as any).tasks = await prisma.task.findMany({
      where: {
        AND: [
          { projectId: project.id },
          taskScope
        ]
      },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true
      },
      orderBy: { dueDate: 'asc' }
    });
  }

  res.json(project);
});

export const updateProject = safeHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description, status, leadId, projectManagerId, relationshipManagerId } = req.body;
  const user = (req as any).user;

  const rbacWhere = await getModuleWhereClause(user, 'projects', 'edit');
  if (rbacWhere === null) return res.status(403).json({ message: 'Access denied' });

  const existingProject = await (prisma as any).project.findFirst({ 
    where: {
      AND: [
        { id: Number(id) },
        rbacWhere
      ]
    }
  });
  if (!existingProject) {
      return res.status(404).json({ message: 'Project not found or access denied' });
  }

  // SECURITY PATCH: Strict Updates (Scenario 9)
  const updateData: any = {};
  if (name) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (status) updateData.status = status;

  if (projectManagerId !== undefined) {
      const pmId = projectManagerId ? Number(projectManagerId) : null;
      // RBAC: If setting a PM, ensure they are in scope (reusing createProject logic pattern)
      if (pmId) {
          const scope = (req as any).permissionScope;
          if (scope === 'team') {
              const reporteeIds = await getRecursiveReporteeIds(user.employeeId);
              if (![user.employeeId, ...reporteeIds].includes(pmId)) return res.status(403).json({ message: 'Access denied: PM not in your team' });
          } else if (scope === 'department') {
              const pm = await prisma.employee.findUnique({ where: { id: pmId }, select: { departmentId: true } });
              if (!pm || pm.departmentId !== user.departmentId) return res.status(403).json({ message: 'Access denied: PM from another department' });
          }
      }
      updateData.projectManagerId = pmId;
  }

  if (relationshipManagerId !== undefined) {
      const rmId = relationshipManagerId ? Number(relationshipManagerId) : null;
      if (rmId) {
          const scope = (req as any).permissionScope;
          if (scope === 'team') {
              const reporteeIds = await getRecursiveReporteeIds(user.employeeId);
              if (![user.employeeId, ...reporteeIds].includes(rmId)) return res.status(403).json({ message: 'Access denied: RM not in your team' });
          } else if (scope === 'department') {
              const rm = await prisma.employee.findUnique({ where: { id: rmId }, select: { departmentId: true } });
              if (!rm || rm.departmentId !== user.departmentId) return res.status(403).json({ message: 'Access denied: RM from another department' });
          }
      }
      updateData.relationshipManagerId = rmId;
  }

  const project = await (prisma as any).project.update({
    where: { id: Number(id) },
    data: updateData
  });

  await logActivity({
    employeeId: user.employeeId,
    module: 'projects',
    action: 'UPDATE',
    entityId: id,
    entityName: project.name,
    description: `Project details updated`
  });

  res.json(project);
});

export const createProject = safeHandler(async (req: Request, res: Response) => {
  const { name, description, status, leadId, projectManagerId, relationshipManagerId } = req.body;
  const user = (req as any).user;
  const scope = (req as any).permissionScope;

  // RBAC: Validate scope (Universal Scope Implementation)
  if (leadId) {
    // RBC: Verify lead access
    const lead = await prisma.lead.findUnique({ where: { id: String(leadId) } });
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    if (scope === 'own' && lead.ownerId !== user.employeeId) {
      return res.status(403).json({ message: 'Access denied: You can only create projects for your own leads' });
    }
    if (scope === 'department' && lead.departmentId !== user.departmentId) {
      return res.status(403).json({ message: 'Access denied: Lead belongs to another department' });
    }
    if (scope === 'team') {
      const reporteeIds = await getRecursiveReporteeIds(user.employeeId);
      if (lead.ownerId !== user.employeeId && !reporteeIds.includes(lead.ownerId as number)) {
        return res.status(403).json({ message: 'Access denied: Lead not in your team scope' });
      }
    }
  }

  // RBAC: Validate PM/RM Scope
  const pmId = projectManagerId ? Number(projectManagerId) : null;
  const rmId = relationshipManagerId ? Number(relationshipManagerId) : null;

  if (scope === 'team') {
     const reporteeIds = await getRecursiveReporteeIds(user.employeeId);
     const teamIds = [user.employeeId, ...reporteeIds];
     if (pmId && !teamIds.includes(pmId)) return res.status(403).json({ message: 'Access denied: Project Manager not in your team' });
     if (rmId && !teamIds.includes(rmId)) return res.status(403).json({ message: 'Access denied: Relationship Manager not in your team' });
  } else if (scope === 'department') {
     if (pmId) {
        const pm = await prisma.employee.findUnique({ where: { id: pmId }, select: { departmentId: true } });
        if (!pm || pm.departmentId !== user.departmentId) return res.status(403).json({ message: 'Access denied: PM from another department' });
     }
     if (rmId) {
        const rm = await prisma.employee.findUnique({ where: { id: rmId }, select: { departmentId: true } });
        if (!rm || rm.departmentId !== user.departmentId) return res.status(403).json({ message: 'Access denied: RM from another department' });
     }
  }

  const project = await (prisma as any).project.create({
    data: {
      name,
      description,
      status: status || 'Active',
      leadId: leadId ? String(leadId) : undefined,
      projectManagerId: pmId || undefined,
      relationshipManagerId: rmId || undefined
    }
  });


  await logActivity({
    employeeId: user.employeeId,
    module: 'projects',
    action: 'CREATE',
    entityId: String(project.id),
    entityName: project.name,
    description: `Created new project: ${project.name}`
  });

  res.status(201).json(project);
});

export const deleteProject = safeHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;

  const rbacWhere = await getModuleWhereClause(user, 'projects', 'delete');
  if (rbacWhere === null) return res.status(403).json({ message: 'Access denied' });

  const existingProject = await (prisma as any).project.findFirst({ 
    where: {
      AND: [
        { id: Number(id) },
        rbacWhere
      ]
    }
  });
  if (!existingProject) {
      return res.status(404).json({ message: 'Project not found or access denied' });
  }
  
  await (prisma as any).project.delete({
    where: { id: Number(id) }
  });

  await logActivity({
    employeeId: user.employeeId,
    module: 'projects',
    action: 'DELETE',
    entityId: id,
    entityName: 'Project',
    description: `Project deleted`
  });

  res.json({ message: 'Project deleted successfully' });
});

