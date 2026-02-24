import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { logActivity } from '../utils/logger';
import { getRecursiveReporteeIds } from '../utils/userUtils';
import { getModuleWhereClause } from '../utils/permissionUtils';
import { safeHandler } from '../utils/handlerUtils';
import { taskSelect } from '../utils/selectUtils';

export const getTasks = safeHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const scope = (req as any).permissionScope;
  const { filter, departmentId, assigneeId } = req.query;

  // 1. Apply RBAC Scope using Centralized Utility
  let whereClause = await getModuleWhereClause(user, 'tasks');
  if (whereClause === null) return res.status(403).json({ message: 'Access denied' });

  // 2. Apply explicit filters (Team/Dept)
  if (departmentId) {
    const targetDeptId = Number(departmentId);
    // Valid if Admin (all) or if it's the user's own department
    if (scope === 'all' || (scope !== 'own' && targetDeptId === user.departmentId)) {
      whereClause.assignee = { departmentId: targetDeptId };
      // Remove OR if we are strictly filtering by department
      delete whereClause.OR;
    }
  }

  if (assigneeId) {
    const targetAssigneeId = Number(assigneeId);
    const isRecursive = req.query.recursive === 'true';
    let isAllowed = false;
    let targetIds: number[] = [targetAssigneeId];

    if (scope === 'all') {
      isAllowed = true;
      if (isRecursive) {
        const reporteeIds = await getRecursiveReporteeIds(targetAssigneeId);
        targetIds = [targetAssigneeId, ...reporteeIds];
      }
    } else if (scope === 'department') {
      const emp = await prisma.employee.findUnique({ where: { id: targetAssigneeId } });
      if (emp?.departmentId === user.departmentId) {
        isAllowed = true;
        if (isRecursive) {
          const reporteeIds = await getRecursiveReporteeIds(targetAssigneeId);
          targetIds = [targetAssigneeId, ...reporteeIds];
        }
      }
    } else if (scope === 'team') {
      const myReporteeIds = await getRecursiveReporteeIds(user.employeeId);
      const teamIds = [user.employeeId, ...myReporteeIds];
      
      if (teamIds.includes(targetAssigneeId)) {
        isAllowed = true;
        if (isRecursive) {
          const itsReporteeIds = await getRecursiveReporteeIds(targetAssigneeId);
          // Filter to ensure they are within MY team scope
          const allowedReporteeIds = itsReporteeIds.filter(id => teamIds.includes(id));
          targetIds = [targetAssigneeId, ...allowedReporteeIds];
        }
      }
    } else if (scope === 'own') {
      isAllowed = (targetAssigneeId === user.employeeId);
    }

    if (isAllowed) {
      whereClause.assigneeId = targetIds.length > 1 ? { in: targetIds } : targetAssigneeId;
      delete whereClause.OR; // Narrow down to specific assignee(s)
    }
  }

  // 3. Legacy filter compatibility
  if (filter === 'my') {
    whereClause.assigneeId = user.employeeId;
    delete whereClause.OR;
  }

  const tasks = await prisma.task.findMany({
    where: whereClause,
    select: taskSelect,
    orderBy: { dueDate: 'asc' }
  });

  res.json(tasks);
});

export const getTaskById = safeHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;
  const scope = (req as any).permissionScope;

  const task = await prisma.task.findUnique({
    where: { id },
    select: {
      ...taskSelect,
      assigneeId: true, // Need for scope check
      creatorId: true   // Need for scope check
    }
  });

  if (!task) {
    return res.status(404).json({ message: 'Task not found' });
  }

  // RBAC Scope Check
  if (scope === 'own' && task.assigneeId !== user.employeeId && task.creatorId !== user.employeeId) {
    return res.status(403).json({ message: 'Access denied: Task does not belong to you' });
  }
  if (scope === 'department') {
    const assigneeDeptId = (task.assignee as any)?.departmentId || (task.assignee as any)?.department?.id;
    const creatorDeptId = (task.creator as any)?.departmentId || (task.creator as any)?.department?.id;
    if (assigneeDeptId !== user.departmentId && creatorDeptId !== user.departmentId) {
      return res.status(403).json({ message: 'Access denied: Task belongs to another department' });
    }
  }
  if (scope === 'team') {
    const reporteeIds = await getRecursiveReporteeIds(user.employeeId);
    const teamIds = [user.employeeId, ...reporteeIds];
    if (!teamIds.includes(task.assigneeId as number) && !teamIds.includes(task.creatorId as number)) {
      return res.status(403).json({ message: 'Access denied: Task is not in your team scope' });
    }
  }

  res.json(task);
});

export const createTask = safeHandler(async (req: Request, res: Response) => {
  const { title, description, dueDate, priority, assigneeId, leadId, projectId, productId } = req.body;
  const user = (req as any).user;
  const scope = (req as any).permissionScope;

  // RBAC: Validate Assignee based on Scope
  const targetAssigneeId = assigneeId || user.employeeId;

  if (scope === 'own' && targetAssigneeId !== user.employeeId) {
    return res.status(403).json({ message: 'Access denied: You can only assign tasks to yourself' });
  }

  if (scope === 'team') {
    const reporteeIds = await getRecursiveReporteeIds(user.employeeId);
    const teamIds = [user.employeeId, ...reporteeIds];
    if (!teamIds.includes(Number(targetAssigneeId))) {
      return res.status(403).json({ message: 'Access denied: You can only assign tasks to members of your team' });
    }
  }

  if (scope === 'department') {
    const parsedAssigneeId = Number(targetAssigneeId);
    if (isNaN(parsedAssigneeId)) {
        return res.status(400).json({ message: 'Invalid assignee ID' });
    }
    const assigneeEmp = await prisma.employee.findUnique({ 
      where: { id: parsedAssigneeId },
      select: { departmentId: true, isActive: true }
    });
    if (!assigneeEmp) return res.status(404).json({ message: 'Assignee not found' });
    if (!assigneeEmp.isActive) return res.status(400).json({ message: 'Cannot assign tasks to an inactive employee' });

    if (assigneeEmp.departmentId !== user.departmentId) {
      return res.status(403).json({ message: 'Access denied: You can only assign tasks within your department' });
    }
  }

  // SECURITY PATCH: Link Injection Validation (Scenario 4)
  if (leadId) {
    const leadScope = await getModuleWhereClause(user, 'leads', 'view');
    const validLead = await prisma.lead.findFirst({ where: { id: String(leadId), ...leadScope } });
    if (!validLead) return res.status(403).json({ message: 'Access denied: Linked lead is out of scope or does not exist' });
  }
  if (projectId) {
    const projectScope = await getModuleWhereClause(user, 'projects', 'view');
    const validProject = await (prisma as any).project.findFirst({ where: { id: Number(projectId), ...projectScope } });
    if (!validProject) return res.status(403).json({ message: 'Access denied: Linked project is out of scope or does not exist' });
  }
  if (productId) {
    // Products view is 'all' by design, but we check existence
    const validProduct = await prisma.product.findUnique({ where: { id: Number(productId), isActive: true } });
    if (!validProduct) return res.status(403).json({ message: 'Access denied: Linked product does not exist or is inactive' });
  }

  // Ensure IDs are valid numbers or null
  const validProjectId = (projectId && !isNaN(Number(projectId))) ? Number(projectId) : null;
  const validProductId = (productId && !isNaN(Number(productId))) ? Number(productId) : null;
  const validAssigneeId = (targetAssigneeId && !isNaN(Number(targetAssigneeId))) ? Number(targetAssigneeId) : user.employeeId;

  const task = await prisma.task.create({
    data: {
      title,
      description,
      dueDate: new Date(dueDate),
      priority,
      status: 'Pending',
      assigneeId: validAssigneeId,
      creatorId: user.employeeId,
      relatedToLeadId: leadId ? String(leadId) : null,
      projectId: validProjectId,
      productId: validProductId
    },
    include: {
      assignee: { select: { firstName: true, lastName: true } }
    }
  });

  if (leadId) {
     await logActivity({
      employeeId: user.employeeId,
      module: 'leads',
      action: 'TASK_CREATE',
      entityId: String(leadId),
      entityName: title,
      description: `Task created: ${title}`
    });
  }

  if (validProjectId) {
     await logActivity({
      employeeId: user.employeeId,
      module: 'projects',
      action: 'TASK_CREATE',
      entityId: String(validProjectId),
      entityName: title,
      description: `Task created: ${title}`
    });
  }
  
  if (validProductId) {
     await logActivity({
      employeeId: user.employeeId,
      module: 'products',
      action: 'TASK_CREATE',
      entityId: String(validProductId),
      entityName: title,
      description: `Task created: ${title}`
    });
  }

  res.status(201).json(task);
});

export const updateTask = safeHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, completionNote, dueDate, ...rest } = req.body;
  const user = (req as any).user;

  const rbacWhere = await getModuleWhereClause(user, 'tasks', 'edit');
  if (rbacWhere === null) return res.status(403).json({ message: 'Access denied' });

  const existingTask = await prisma.task.findFirst({ 
    where: {
      AND: [
        { id },
        rbacWhere
      ]
    }
  });
  if (!existingTask) return res.status(404).json({ message: 'Task not found or access denied' });

  // SECURITY PATCH: Strict Updates (Scenario 9) - Prevents hijacking owner/department fields
  const { title, description, priority, assigneeId: newAssigneeId } = req.body;
  const updateData: any = {};
  if (title) updateData.title = title;
  if (description !== undefined) updateData.description = description;
  if (priority) updateData.priority = priority;
  if (dueDate) updateData.dueDate = new Date(dueDate);

  // RBAC: Assignment Scope Check
  if (newAssigneeId && Number(newAssigneeId) !== existingTask.assigneeId) {
    const permissions = (req as any).user.permissions || [];
    const assignPerm = permissions.find((p: any) => p.module === 'tasks' && p.action === 'assign');
    
    if (!assignPerm) {
      return res.status(403).json({ message: 'Access denied: You do not have permission to assign tasks' });
    }

    const targetAssigneeId = Number(newAssigneeId);
    const assignScope = assignPerm.scope;

    if (assignScope === 'own' && targetAssigneeId !== user.employeeId) {
      return res.status(403).json({ message: 'Access denied: You can only assign tasks to yourself' });
    }

    if (assignScope === 'team') {
      const reporteeIds = await getRecursiveReporteeIds(user.employeeId);
      const teamIds = [user.employeeId, ...reporteeIds];
      if (!teamIds.includes(targetAssigneeId)) {
        return res.status(403).json({ message: 'Access denied: You can only assign tasks to members of your team' });
      }
    }

    if (assignScope === 'department') {
      const assigneeEmp = await prisma.employee.findUnique({ 
        where: { id: targetAssigneeId },
        select: { departmentId: true, isActive: true }
      });
      if (!assigneeEmp) return res.status(404).json({ message: 'Assignee not found' });
      if (!assigneeEmp.isActive) return res.status(400).json({ message: 'Cannot assign tasks to an inactive employee' });

      if (assigneeEmp.departmentId !== user.departmentId) {
        return res.status(403).json({ message: 'Access denied: You can only assign tasks within your department' });
      }
    }
    updateData.assigneeId = targetAssigneeId;
  }

  if (status) {
    updateData.status = status;
    if (status === 'Completed') {
      if (!completionNote || completionNote.trim().length < 5) {
        return res.status(400).json({ message: 'A completion note (min 5 chars) is required to close a task' });
      }
      updateData.completedAt = new Date();
      updateData.completionNote = completionNote;
    } else if (existingTask.status === 'Completed' && status !== 'Completed') {
      updateData.completedAt = null;
      updateData.completionNote = null;
    }
  }

  const task = await prisma.task.update({
    where: { id },
    data: updateData
  });

  if (status && status !== existingTask.status) {
      await logActivity({
          employeeId: user.employeeId,
          module: 'tasks',
          action: 'STATUS_CHANGE',
          entityId: id,
          entityName: task.title,
          description: `Task status changed from ${existingTask.status} to ${status}`,
          metadata: { oldStatus: existingTask.status, newStatus: status, completionNote: updateData.completionNote }
      });
  }

  res.json(task);
});

export const deleteTask = safeHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;

  const rbacWhere = await getModuleWhereClause(user, 'tasks', 'delete');
  if (rbacWhere === null) return res.status(403).json({ message: 'Access denied' });

  const existingTask = await prisma.task.findFirst({ 
    where: {
      AND: [
        { id },
        rbacWhere
      ]
    }
  });
  if (!existingTask) return res.status(404).json({ message: 'Task not found or access denied' });

  await prisma.task.delete({ where: { id } });

  await logActivity({
      employeeId: user.employeeId,
      module: 'tasks',
      action: 'DELETE',
      entityId: id,
      entityName: existingTask.title,
      description: `Task deleted: ${existingTask.title}`
  });

  res.status(204).send();
});
