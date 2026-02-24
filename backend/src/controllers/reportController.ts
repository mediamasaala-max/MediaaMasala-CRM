import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { getModuleWhereClause } from '../utils/permissionUtils';
import { safeHandler } from '../utils/handlerUtils';

export const getSalesReport = safeHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;

  const whereClause = await getModuleWhereClause(user, 'leads', 'view');
  if (whereClause === null) return res.status(403).json({ message: 'Access denied' });

  const leads = await prisma.lead.findMany({
    where: whereClause,
    select: {
      id: true,
      status: true,
      source: true,
      createdAt: true,
      owner: { select: { firstName: true, lastName: true } }
    }
  });

  // Status breakdown
  const statusCounts: Record<string, number> = {};
  leads.forEach(l => {
    statusCounts[l.status] = (statusCounts[l.status] || 0) + 1;
  });

  // Source breakdown
  const sourceCounts: Record<string, number> = {};
  leads.forEach(l => {
    sourceCounts[l.source] = (sourceCounts[l.source] || 0) + 1;
  });

  // Per-employee breakdown
  const employeeStats: Record<string, { total: number; won: number; lost: number }> = {};
  leads.forEach(l => {
    const name = l.owner ? `${l.owner.firstName} ${l.owner.lastName}` : 'Unassigned';
    if (!employeeStats[name]) employeeStats[name] = { total: 0, won: 0, lost: 0 };
    employeeStats[name].total++;
    if (l.status === 'Won') employeeStats[name].won++;
    if (l.status === 'Lost') employeeStats[name].lost++;
  });

  const totalLeads = leads.length;
  const wonLeads = leads.filter(l => l.status === 'Won').length;
  const lostLeads = leads.filter(l => l.status === 'Lost').length;
  const activeLeads = totalLeads - wonLeads - lostLeads;
  const conversionRate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;

  res.json({
    summary: { totalLeads, wonLeads, lostLeads, activeLeads, conversionRate },
    statusBreakdown: Object.entries(statusCounts).map(([status, count]) => ({ status, count })),
    sourceBreakdown: Object.entries(sourceCounts).map(([source, count]) => ({ source, count })),
    employeeBreakdown: Object.entries(employeeStats).map(([name, stats]) => ({ name, ...stats }))
  });
});

export const getProductivityReport = safeHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;

  // 1. Narrow down employees by attendance module scope (or similar)
  const employeeWhere = await getModuleWhereClause(user, 'attendance', 'view'); // Using attendance as proxy for "viewing employees stats"
  if (employeeWhere === null) return res.status(403).json({ message: 'Access denied' });

  const employees = await prisma.employee.findMany({
    where: employeeWhere,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      department: { select: { name: true } },
      _count: {
        select: {
          assignedTasks: true,
          eodReports: true,
          attendanceLogs: true
        }
      }
    }
  });

  // Optimized: Fetch all task stats in one go using aggregation
  const taskStats = await prisma.task.groupBy({
    by: ['assigneeId', 'status'],
    where: { 
      assigneeId: { in: employees.map(e => e.id) },
      status: { in: ['Completed', 'Pending', 'In Progress'] }
    },
    _count: true
  });

  // Map stats to employee ID for quick lookup
  const statsMap: Record<number, { completed: number; pending: number }> = {};
  taskStats.forEach(stat => {
    if (!stat.assigneeId) return;
    if (!statsMap[stat.assigneeId]) statsMap[stat.assigneeId] = { completed: 0, pending: 0 };
    
    if (stat.status === 'Completed') {
      statsMap[stat.assigneeId].completed += stat._count;
    } else {
      statsMap[stat.assigneeId].pending += stat._count;
    }
  });

  const employeeStats = employees.map((emp) => {
    const stats = statsMap[emp.id] || { completed: 0, pending: 0 };
    
    return {
      name: `${emp.firstName} ${emp.lastName}`,
      department: emp.department?.name || 'Unassigned',
      totalTasks: emp._count.assignedTasks,
      completedTasks: stats.completed,
      pendingTasks: stats.pending,
      eodReports: emp._count.eodReports,
      attendanceDays: (emp as any)._count.attendanceLogs,
      completionRate: emp._count.assignedTasks > 0 
        ? Math.round((stats.completed / emp._count.assignedTasks) * 100) 
        : 0
    };
  });

  const totalTasks = employeeStats.reduce((a, e) => a + e.totalTasks, 0);
  const totalCompleted = employeeStats.reduce((a, e) => a + e.completedTasks, 0);
  const totalEods = employeeStats.reduce((a, e) => a + e.eodReports, 0);
  const avgCompletion = employeeStats.length > 0
    ? Math.round(employeeStats.reduce((a, e) => a + e.completionRate, 0) / employeeStats.length)
    : 0;

  res.json({
    summary: { totalEmployees: employees.length, totalTasks, totalCompleted, totalEods, avgCompletion },
    employees: employeeStats
  });
});

export const getAttendanceReport = safeHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;

  const whereClause = await getModuleWhereClause(user, 'attendance', 'view');
  if (whereClause === null) return res.status(403).json({ message: 'Access denied' });

  const records = await prisma.attendance.findMany({
    where: whereClause,
    include: {
      employee: {
        select: { firstName: true, lastName: true, department: { select: { name: true } } }
      }
    },
    orderBy: { date: 'desc' }
  });

  // Status breakdown
  const statusCounts: Record<string, number> = {};
  records.forEach((r: any) => {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
  });

  // Per-employee breakdown
  const employeeStats: Record<string, { total: number; present: number; absent: number; late: number }> = {};
  records.forEach((r: any) => {
    const name = `${r.employee.firstName} ${r.employee.lastName}`;
    if (!employeeStats[name]) employeeStats[name] = { total: 0, present: 0, absent: 0, late: 0 };
    employeeStats[name].total++;
    if (r.status === 'Present') employeeStats[name].present++;
    if (r.status === 'Absent') employeeStats[name].absent++;
    if (r.status === 'Late') employeeStats[name].late++;
  });

  const totalRecords = records.length;
  const presentCount = records.filter((r: any) => r.status === 'Present').length;
  const attendanceRate = totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : 0;

  res.json({
    summary: { totalRecords, presentCount, absentCount: statusCounts['Absent'] || 0, lateCount: statusCounts['Late'] || 0, attendanceRate },
    statusBreakdown: Object.entries(statusCounts).map(([status, count]) => ({ status, count })),
    employeeBreakdown: Object.entries(employeeStats).map(([name, stats]) => ({ name, ...stats }))
  });
});
