import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { getRecursiveReporteeIds } from '../utils/userUtils';
import { getModuleWhereClause } from '../utils/permissionUtils';
import { safeHandler } from '../utils/handlerUtils';

export const getLeaves = safeHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const scope = (req as any).permissionScope;

  const { departmentId, employeeId } = req.query;
  // 1. Apply RBAC Scope using Centralized Utility
  let whereClause = await getModuleWhereClause(user, 'leaves');
  if (whereClause === null) return res.status(403).json({ message: 'Access denied' });

  // Apply additional filters if scope allows
  if (departmentId) {
    const targetDeptId = Number(departmentId);
    if (scope === 'all') {
      whereClause.employee = { ...whereClause.employee, departmentId: targetDeptId };
    } else if ((scope === 'department' || scope === 'team') && targetDeptId === user.departmentId) {
      whereClause.employee = { ...whereClause.employee, departmentId: targetDeptId };
    }
  }

  if (employeeId) {
    const targetEmpId = Number(employeeId);
    const isRecursive = req.query.recursive === 'true';

    if (scope === 'all') {
      if (isRecursive) {
        const reporteeIds = await getRecursiveReporteeIds(targetEmpId);
        whereClause.employeeId = { in: [targetEmpId, ...reporteeIds] };
      } else {
        whereClause.employeeId = targetEmpId;
      }
    } else if (scope === 'department') {
      const emp = await prisma.employee.findUnique({ where: { id: targetEmpId } });
      if (emp && emp.departmentId === user.departmentId) {
        if (isRecursive) {
          const reporteeIds = await getRecursiveReporteeIds(targetEmpId);
          whereClause.employeeId = { in: [targetEmpId, ...reporteeIds] };
        } else {
          whereClause.employeeId = targetEmpId;
        }
      }
    } else if (scope === 'team') {
      const myReporteeIds = await getRecursiveReporteeIds(user.employeeId);
      const teamIds = [user.employeeId, ...myReporteeIds];

      if (teamIds.includes(targetEmpId)) {
        if (isRecursive) {
          const itsReporteeIds = await getRecursiveReporteeIds(targetEmpId);
          const allowedReporteeIds = itsReporteeIds.filter(id => teamIds.includes(id));
          whereClause.employeeId = { in: [targetEmpId, ...allowedReporteeIds] };
        } else {
          whereClause.employeeId = targetEmpId;
        }
      }
    }
  }

  const leaves = await (prisma as any).leaveRequest.findMany({
    where: whereClause,
    include: {
      employee: {
        select: { firstName: true, lastName: true, department: { select: { name: true } } }
      },
      approvedBy: {
        select: { firstName: true, lastName: true }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 100
  });
  res.json(leaves);
});

export const applyLeave = safeHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { startDate, endDate, type, reason } = req.body;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (start < today) {
    return res.status(400).json({ message: 'Leave start date cannot be in the past' });
  }
  if (end < start) {
    return res.status(400).json({ message: 'End date cannot be before start date' });
  }

  // CONCURRENCY/INTEGRITY: Check for overlapping leave requests for this employee
  const overlapping = await (prisma as any).leaveRequest.findFirst({
    where: {
      employeeId: user.employeeId,
      status: { in: ['Pending', 'Approved'] },
      OR: [
        {
          startDate: { lte: end },
          endDate: { gte: start }
        }
      ]
    }
  });

  if (overlapping) {
    return res.status(400).json({ 
      message: `You already have a ${overlapping.status.toLowerCase()} leave request that overlaps with these dates.` 
    });
  }

  const leave = await (prisma as any).leaveRequest.create({
    data: {
      employeeId: user.employeeId,
      startDate: start,
      endDate: end,
      type,
      reason,
      status: 'Pending'
    }
  });

  res.status(201).json(leave);
});

export const approveLeave = safeHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { id } = req.params;
  const { status, managerNote } = req.body;
  const scope = (req as any).permissionScope;

  const existingLeave = await (prisma as any).leaveRequest.findUnique({
    where: { id: parseInt(id) },
    include: { employee: true }
  });

  if (!existingLeave) {
    return res.status(404).json({ message: 'Leave request not found' });
  }

  if (status === 'Rejected' && (!managerNote || managerNote.trim().length < 5)) {
    return res.status(400).json({ message: 'A manager note (min 5 chars) is required when rejecting a leave request' });
  }

  // 1. Prevent self-approval
  if (existingLeave.employeeId === user.employeeId) {
    return res.status(403).json({ message: 'You cannot approve your own leave request' });
  }

    // 2. RBAC Scope Check
    if (scope === 'department' && existingLeave.employee.departmentId !== user.departmentId) {
      return res.status(403).json({ message: 'Access denied: Employee belongs to another department' });
    }
    
    if (scope === 'team') {
      const reporteeIds = await getRecursiveReporteeIds(user.employeeId);
      if (!reporteeIds.includes(existingLeave.employeeId)) {
        return res.status(403).json({ message: 'Access denied: Employee is not in your team scope' });
      }
    }
    
    if (scope === 'own') {
       return res.status(403).json({ message: 'Access denied: You do not have permission to approve leaves' });
    }

    const leave = await (prisma as any).leaveRequest.update({
      where: { id: parseInt(id) },
      data: {
        status,
        managerNote,
        approvedById: user.employeeId,
        updatedAt: new Date()
      }
    });

    res.json(leave);
});
