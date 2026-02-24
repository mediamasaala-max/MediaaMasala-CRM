import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { getRecursiveReporteeIds } from '../utils/userUtils';
import { getModuleWhereClause } from '../utils/permissionUtils';
import { safeHandler } from '../utils/handlerUtils';

export const submitEod = safeHandler(async (req: Request, res: Response) => {
  const { content, leadsCount, tasksCount, date } = req.body;
  const user = (req as any).user;

  if (!user.employeeId) {
    return res.status(403).json({ message: 'Employee profile required' });
  }

  const eod = await prisma.eodReport.create({
    data: {
      content,
      leadsCount: leadsCount || 0,
      tasksCount: tasksCount || 0,
      date: date ? new Date(date) : new Date(),
      employeeId: user.employeeId
    }
  });

  res.status(201).json(eod);
});

export const getEodReports = safeHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const scope = (req as any).permissionScope;

  const { departmentId, employeeId } = req.query;
  // 1. Apply RBAC Scope using Centralized Utility
  let whereClause = await getModuleWhereClause(user, 'eod');
  if (whereClause === null) return res.status(403).json({ message: 'Access denied' });

  // Apply additional filters if scope allows
  if (departmentId) {
    const targetDeptId = Number(departmentId);
    if (scope === 'all') {
      whereClause.employee = { departmentId: targetDeptId };
    } else if ((scope === 'department' || scope === 'team') && targetDeptId === user.departmentId) {
      whereClause.employee = { departmentId: targetDeptId };
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

  const reports = await prisma.eodReport.findMany({
    where: whereClause,
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          department: { select: { name: true } }
        }
      }
    },
    orderBy: { date: 'desc' },
    take: 50
  });

  res.json(reports);
});
