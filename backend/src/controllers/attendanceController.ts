import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { getRecursiveReporteeIds } from '../utils/userUtils';
import { getModuleWhereClause } from '../utils/permissionUtils';
import { safeHandler } from '../utils/handlerUtils';

export const getAttendance = safeHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const scope = (req as any).permissionScope;

  const { departmentId, employeeId } = req.query;
  // 1. Apply RBAC Scope using Centralized Utility
  let whereClause = await getModuleWhereClause(user, 'attendance');
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

  const attendance = await prisma.attendance.findMany({
    where: whereClause,
    include: {
      employee: {
        select: { id: true, firstName: true, lastName: true, department: { select: { name: true } } }
      }
    },
    orderBy: { date: 'desc' },
    take: 100
  });
  res.json(attendance);
});

export const checkIn = safeHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { location, notes } = req.body;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 1. Check for any ACTIVE session (check-out is null)
  const activeSession = await prisma.attendance.findFirst({
    where: {
      employeeId: user.employeeId,
      checkOut: null
    },
    orderBy: { date: 'desc' }
  });

  if (activeSession) {
    return res.status(400).json({ 
      message: 'You have an active check-in session. Please check out first.' 
    });
  }

  // 2. Check if a record for TODAY already exists (Concurrency/Integrity Rule)
  const existingToday = await prisma.attendance.findFirst({
    where: {
      employeeId: user.employeeId,
      date: today
    }
  });

  if (existingToday) {
    return res.status(400).json({ 
      message: 'You have already completed your attendance for today.' 
    });
  }

  const record = await prisma.attendance.create({
    data: {
      employeeId: user.employeeId,
      date: today,
      location: location ? String(location).trim() : null,
      notes: notes ? String(notes).trim() : null,
      status: 'Present'
    }
  });

  res.status(201).json(record);
});

export const checkOut = safeHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;

  // Find the most recent active check-in record
  const record = await prisma.attendance.findFirst({
    where: {
      employeeId: user.employeeId,
      checkOut: null
    },
    orderBy: { date: 'desc' }
  });

  if (!record) {
    return res.status(404).json({ message: 'No active check-in session found' });
  }

  const updated = await prisma.attendance.update({
    where: { id: record.id },
    data: { checkOut: new Date() }
  });

  res.json(updated);
});
