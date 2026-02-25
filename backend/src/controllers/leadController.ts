import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { logActivity } from '../utils/logger';
import { getRecursiveReporteeIds } from '../utils/userUtils';
import { getModuleWhereClause } from '../utils/permissionUtils';
import { leadSelect, employeeSelectMinimal } from '../utils/selectUtils';
import { safeHandler } from '../utils/handlerUtils';

export const getLeads = safeHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const scope = (req as any).permissionScope;

  const { departmentId, ownerId, recursive } = req.query;
  const isRecursive = recursive === 'true';
  // Initial RBAC Scope using Centralized Utility
  let whereClause = await getModuleWhereClause(user, 'leads');
  if (whereClause === null) return res.status(403).json({ message: 'Access denied' });

  // Apply additional filters if scope allows
  if (departmentId) {
    const targetDeptId = Number(departmentId);
    if (scope === 'all') {
      whereClause.departmentId = targetDeptId;
    } else if (scope === 'department' && targetDeptId === user.departmentId) {
      whereClause.departmentId = targetDeptId;
    } else if (scope === 'team' && targetDeptId === user.departmentId) {
      whereClause.departmentId = targetDeptId;
    }
  }

  if (ownerId) {
    const targetOwnerId = Number(ownerId);
    
    if (scope === 'all') {
      if (isRecursive) {
        const reporteeIds = await getRecursiveReporteeIds(targetOwnerId);
        whereClause.ownerId = { in: [targetOwnerId, ...reporteeIds] };
      } else {
        whereClause.ownerId = targetOwnerId;
      }
    } else if (scope === 'department') {
      const ownerEmp = await prisma.employee.findUnique({ where: { id: targetOwnerId } });
      if (ownerEmp && ownerEmp.departmentId === user.departmentId) {
        if (isRecursive) {
          const reporteeIds = await getRecursiveReporteeIds(targetOwnerId);
          whereClause.ownerId = { in: [targetOwnerId, ...reporteeIds] };
        } else {
          whereClause.ownerId = targetOwnerId;
        }
      }
    } else if (scope === 'team') {
      const myReporteeIds = await getRecursiveReporteeIds(user.employeeId);
      const teamIds = [user.employeeId, ...myReporteeIds];
      
      if (teamIds.includes(targetOwnerId)) {
        if (isRecursive) {
          const itsReporteeIds = await getRecursiveReporteeIds(targetOwnerId);
          // Filter itsReporteeIds to ensure they are also within MY team scope (safety)
          const allowedReporteeIds = itsReporteeIds.filter(id => teamIds.includes(id));
          whereClause.ownerId = { in: [targetOwnerId, ...allowedReporteeIds] };
        } else {
          whereClause.ownerId = targetOwnerId;
        }
      }
    }
  }

  const leads = await prisma.lead.findMany({
    where: whereClause,
    select: leadSelect
  });

  res.json(leads);
});

export const getLeadById = safeHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;

  // 1. Apply RBAC Scope using Centralized Utility
  const whereClause = await getModuleWhereClause(user, 'leads');
  if (whereClause === null) return res.status(403).json({ message: 'Access denied' });

  const lead = await prisma.lead.findFirst({
    where: {
      AND: [
        { id },
        whereClause
      ]
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      company: true,
      source: true,
      status: true,
      notes: true,
      lostReason: true,
      ownerId: true,
      departmentId: true,
      owner: { select: employeeSelectMinimal },
      department: { select: { id: true, name: true } },
      leadNotes: {
        select: {
          id: true,
          content: true,
          isPrivate: true,
          createdAt: true,
          author: { select: employeeSelectMinimal }
        },
        orderBy: { createdAt: 'desc' }
      },
      followUpLogs: {
        select: {
          id: true,
          scheduledDate: true,
          completedDate: true,
          outcome: true,
          nextAction: true,
          employee: { select: employeeSelectMinimal }
        },
        orderBy: { scheduledDate: 'asc' }
      },
    }
  });

  if (!lead) {
    return res.status(404).json({ message: 'Sale not found or access denied' });
  }

  // SECURITY PATCH: Nested Relation Scoping (Scenario 10)
  // Ensure the user only sees tasks they are permitted to view within the lead context
  const taskScope = await getModuleWhereClause(user, 'tasks', 'view');
  if (taskScope) {
    (lead as any).tasks = await prisma.task.findMany({
      where: {
        AND: [
          { relatedToLeadId: lead.id },
          taskScope
        ]
      },
      select: {
        id: true,
        title: true,
        status: true,
        dueDate: true,
        priority: true
      },
      orderBy: { dueDate: 'asc' }
    });
  }

  // Fetch project separately if needed (to bypass relation lint)
  const project = await (prisma as any).project.findUnique({
    where: { leadId: lead.id }
  });

  res.json({ ...lead, project });
});

export const createLead = safeHandler(async (req: Request, res: Response) => {
  const { name, email, phone, company, source, departmentId, notes } = req.body;
  const user = (req as any).user;

  const scope = (req as any).permissionScope;

  // RBAC: Validate Department/Owner
  let finalDepartmentId = departmentId ? Number(departmentId) : user.departmentId;
  let finalOwnerId = req.body.ownerId ? Number(req.body.ownerId) : user.employeeId;

  // SECURITY PATCH: Duplicate Lead Prevention (Scenario: Payload Tampering)
  const existingDuplicate = await prisma.lead.findFirst({
    where: {
      OR: [
        { email },
        { phone: phone ? String(phone) : undefined }
      ],
      status: { not: 'Lost' } // Only check against active/pending leads
    }
  });

  if (existingDuplicate) {
    return res.status(400).json({ 
      message: `A lead with this ${existingDuplicate.email === email ? 'email' : 'phone number'} already exists or is being pursued.` 
    });
  }

  if (scope === 'own') {
    finalDepartmentId = user.departmentId;
    finalOwnerId = user.employeeId;
  } else if (scope === 'team') {
     finalDepartmentId = user.departmentId;
     const reporteeIds = await getRecursiveReporteeIds(user.employeeId);
     const teamIds = [user.employeeId, ...reporteeIds];
     if (!teamIds.includes(finalOwnerId)) {
       return res.status(403).json({ message: 'Access denied: You can only create leads for your team' });
     }
  } else if (scope === 'department') {
     finalDepartmentId = user.departmentId;
     const ownerEmp = await prisma.employee.findUnique({ where: { id: finalOwnerId } });
     if (!ownerEmp || ownerEmp.departmentId !== user.departmentId) {
       return res.status(403).json({ message: 'Access denied: You can only create leads within your department' });
     }
  }

  const lead = await prisma.lead.create({
    data: {
      name,
      email,
      phone,
      company,
      source,
      notes,
      departmentId: finalDepartmentId,
      ownerId: finalOwnerId
    }
  });


  await logActivity({
    employeeId: user.employeeId,
    module: 'leads',
    action: 'CREATE',
    entityId: lead.id,
    entityName: lead.name,
    description: `New lead created: ${lead.name}`
  });

  res.status(201).json(lead);
});

export const updateLead = safeHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, lostReason, ...rest } = req.body;
  const user = (req as any).user;
  const scope = (req as any).permissionScope;

  const rbacWhere = await getModuleWhereClause(user, 'leads', 'edit');
  if (rbacWhere === null) return res.status(403).json({ message: 'Access denied' });

  const existingLead = await prisma.lead.findFirst({ 
    where: {
      AND: [
        { id },
        rbacWhere
      ]
    }
  });

  if (!existingLead) return res.status(404).json({ message: 'Lead not found or access denied' });

  // SECURITY PATCH: Strict Updates (Scenario 9)
  const { name, email, phone, company, source, notes } = req.body;
  const updateData: any = {};
  if (name) updateData.name = name;
  if (email) updateData.email = email;
  if (phone !== undefined) updateData.phone = phone;
  if (company !== undefined) updateData.company = company;
  if (source) updateData.source = source;
  if (notes !== undefined) updateData.notes = notes;

  if (status) {
    updateData.status = status;
    if (status === 'Lost') {
      if (!lostReason || lostReason.trim().length < 3) {
        return res.status(400).json({ message: 'A valid reason is required when a lead is marked as Lost' });
      }
      updateData.lostReason = lostReason;
    }
  }

  const lead = await prisma.lead.update({
    where: { id },
    data: updateData
  });

  if (status && status !== existingLead.status) {
    await logActivity({
      employeeId: user.employeeId,
      module: 'leads',
      action: 'STATUS_CHANGE',
      entityId: lead.id,
      entityName: lead.name,
      description: `Lead status changed from ${existingLead.status} to ${status}`,
      metadata: { oldStatus: existingLead.status, newStatus: status, lostReason: updateData.lostReason }
    });
  } else {
    await logActivity({
      employeeId: user.employeeId,
      module: 'leads',
      action: 'UPDATE',
      entityId: lead.id,
      entityName: lead.name,
      description: `Lead information updated for ${lead.name}`
    });
  }

  res.json(lead);
});

export const addLeadNote = safeHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { content, isPrivate } = req.body;
  const user = (req as any).user;

  if (!user.employeeId) return res.status(403).json({ message: 'Employee profile required' });

  const rbacWhere = await getModuleWhereClause(user, 'leads', 'edit');
  if (rbacWhere === null) return res.status(403).json({ message: 'Access denied' });

  const lead = await prisma.lead.findFirst({ 
    where: {
      AND: [
        { id },
        rbacWhere
      ]
    }
  });
  if (!lead) return res.status(404).json({ message: 'Lead not found or access denied' });

  const note = await prisma.leadNote.create({
    data: {
      leadId: id,
      authorId: user.employeeId,
      content,
      isPrivate: isPrivate || false
    },
    include: { 
      author: { select: employeeSelectMinimal }
    }
  });

  await logActivity({
    employeeId: user.employeeId,
    module: 'leads',
    action: 'NOTE_ADDED',
    entityId: id,
    entityName: lead?.name,
    description: `New note added to lead: ${content.substring(0, 30)}${content.length > 30 ? '...' : ''}`
  });

  res.status(201).json(note);
});

export const addFollowUp = safeHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { scheduledDate, outcome, nextAction } = req.body;
  const user = (req as any).user;

  if (!user.employeeId) return res.status(403).json({ message: 'Employee profile required' });

  const rbacWhere = await getModuleWhereClause(user, 'leads', 'edit');
  if (rbacWhere === null) return res.status(403).json({ message: 'Access denied' });

  const lead = await prisma.lead.findFirst({ 
    where: {
      AND: [
        { id },
        rbacWhere
      ]
    }
  });
  if (!lead) return res.status(404).json({ message: 'Lead not found or access denied' });

  const followUp = await prisma.followUpLog.create({
    data: {
      leadId: id,
      employeeId: user.employeeId,
      scheduledDate: new Date(scheduledDate),
      outcome,
      nextAction
    },
    include: { 
      employee: { select: employeeSelectMinimal }
    }
  });

  await logActivity({
    employeeId: user.employeeId,
    module: 'leads',
    action: 'FOLLOW_UP',
    entityId: id,
    entityName: lead?.name,
    description: `Follow-up logged: ${outcome || 'No outcome provided'}`
  });

  res.status(201).json(followUp);
});

// DELETED REDUNDANT getEmployees (already in adminController)

export const assignLead = safeHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { assigneeId } = req.body;
  const user = (req as any).user;

  // 1. Check if user can VIEW this lead
  const rbacWhere = await getModuleWhereClause(user, 'leads', 'view');
  if (rbacWhere === null) return res.status(403).json({ message: 'Access denied' });

  const lead = await prisma.lead.findFirst({ 
    where: {
      AND: [
        { id },
        rbacWhere
      ]
    }
  });
  if (!lead) return res.status(404).json({ message: 'Lead not found or access denied' });

  // 2. Check ASSIGN permission and scope for the target assignee
  const permissions = (req as any).user.permissions || [];
  const assignPerm = permissions.find((p: any) => p.module === 'leads' && p.action === 'assign');
  
  if (!assignPerm) {
    return res.status(403).json({ message: 'Access denied: You do not have permission to assign leads' });
  }

  const targetAssigneeId = Number(assigneeId);
  const assignScope = assignPerm.scope;

  if (assignScope === 'own' && targetAssigneeId !== user.employeeId) {
    return res.status(403).json({ message: 'Access denied: You can only assign leads to yourself' });
  }

  if (assignScope === 'team') {
    const reporteeIds = await getRecursiveReporteeIds(user.employeeId);
    const teamIds = [user.employeeId, ...reporteeIds];
    if (!teamIds.includes(targetAssigneeId)) {
      return res.status(403).json({ message: 'Access denied: You can only assign leads to members of your team' });
    }
  }

  if (assignScope === 'department') {
     const assigneeEmp = await prisma.employee.findUnique({ 
       where: { id: targetAssigneeId },
       select: { departmentId: true }
     });
     if (!assigneeEmp || assigneeEmp.departmentId !== user.departmentId) {
       return res.status(403).json({ message: 'Access denied: You can only assign leads within your department' });
     }
  }


  const updatedLead = await prisma.lead.update({
    where: { id },
    data: { ownerId: assigneeId },
    include: { 
      owner: { select: employeeSelectMinimal }
    }
  });

  await prisma.leadAssignmentLog.create({
    data: {
      leadId: id,
      assignedToId: assigneeId,
      performedById: user.employeeId || 1, 
      leadStatus: updatedLead.status
    }
  });
  await logActivity({
    employeeId: user.employeeId,
    module: 'leads',
    action: 'ASSIGN',
    entityId: id,
    entityName: updatedLead.name,
    description: `Lead reassigned to ${updatedLead.owner?.firstName} ${updatedLead.owner?.lastName}`
  });

  res.json(updatedLead);
});

export const deleteLead = safeHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;

  const rbacWhere = await getModuleWhereClause(user, 'leads', 'delete');
  if (rbacWhere === null) return res.status(403).json({ message: 'Access denied' });

  const lead = await prisma.lead.findFirst({ 
    where: {
      AND: [
        { id },
        rbacWhere
      ]
    },
    include: { project: true }
  });
  if (!lead) return res.status(404).json({ message: 'Lead not found or access denied' });

  // SAFEGUARD: Don't delete lead if it has an active project
  if (lead.project) {
      const proj = lead.project as any;
      if (proj.status !== 'Cancelled') {
          return res.status(400).json({ 
              message: 'Cannot delete a lead with an active or completed project. Please cancel or archive the project first.' 
          });
      }
  }

  await prisma.lead.delete({
    where: { id }
  });

  await logActivity({
    employeeId: user.employeeId,
    module: 'leads',
    action: 'DELETE',
    entityId: id,
    entityName: lead.name,
    description: `Lead deleted: ${lead.name}`
  });

  res.json({ message: 'Lead deleted successfully' });
});

export const convertToProject = safeHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { projectName, description } = req.body;
  const user = (req as any).user;
  const scope = (req as any).permissionScope;

  // RBAC: Validate scope (Universal Scope Implementation)

  const rbacWhere = await getModuleWhereClause(user, 'leads', 'edit');
  if (rbacWhere === null) return res.status(403).json({ message: 'Access denied' });

  const lead = await prisma.lead.findFirst({ 
      where: {
        AND: [
          { id },
          rbacWhere
        ]
      }
  });
  if (!lead) return res.status(404).json({ message: 'Sale not found or access denied' });

  if (lead.status !== 'Won') return res.status(400).json({ message: 'Only "Won" sales can be converted to projects' });
  
  const existingProject = await (prisma as any).project.findUnique({
      where: { leadId: id }
  });
  if (existingProject) return res.status(400).json({ message: 'This sale already has an associated project' });

  const project = await (prisma as any).project.create({
    data: {
      name: projectName || `${lead.company || lead.name} - Implementation`,
      description: description || `Project initiated from Lead conversion.`,
      leadId: id,
      status: 'Active'
    }
  });

  await logActivity({
    employeeId: (req as any).user.employeeId,
    module: 'leads',
    action: 'CONVERT_TO_PROJECT',
    entityId: id,
    entityName: lead.name,
    description: `Lead converted to project: ${project.name}`
  });

  res.status(201).json(project);
});
