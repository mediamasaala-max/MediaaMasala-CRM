import prisma from '../lib/prisma';

/**
 * Recursively fetches all employee IDs in the reporting line below a given manager.
 * @param managerId The ID of the manager to start from.
 * @returns A promise that resolves to an array of employee IDs.
 */
export async function getRecursiveReporteeIds(managerId: number): Promise<number[]> {
  try {
    const result = await prisma.$queryRaw<Array<{ id: number }>>`
      WITH RECURSIVE subordinates AS (
        SELECT id FROM employees WHERE "managerId" = ${managerId} AND "isActive" = true
        UNION
        SELECT e.id FROM employees e
        INNER JOIN subordinates s ON s.id = e."managerId"
        WHERE e."isActive" = true
      )
      SELECT id FROM subordinates;
    `;
    
    return result.map(r => r.id);
  } catch (error) {
    console.error("Error fetching recursive reportees:", error);
    return []; 
  }
}

/**
 * Builds a hierarchical tree of employees starting from a specific manager (or all if managerId is null).
 */
export async function getEmployeeHierarchy(managerId: number | null = null, departmentId?: number) {
  let employeeIds: number[] | null = null;

  // If we have a managerId, only fetch their subtree to optimize performance
  if (managerId) {
    const reporteeIds = await getRecursiveReporteeIds(managerId);
    employeeIds = [managerId, ...reporteeIds];
  }

  const where: any = {};
  if (employeeIds) where.id = { in: employeeIds };
  if (departmentId) where.departmentId = departmentId;

  const employees = await prisma.employee.findMany({
    where,
    include: {
      role: { select: { name: true, code: true } },
      department: { select: { name: true, code: true } }
    }
  });

  const buildTree = (mId: number | null): any[] => {
    return employees
      .filter(e => e.managerId === mId)
      .map(e => ({
        ...e,
        children: buildTree(e.id)
      }));
  };

  // If managerId is provide, we want the tree starting FROM that employee (including them)
  if (managerId) {
    const root = employees.find(e => e.id === managerId);
    if (!root) return [];
    return [{
      ...root,
      children: buildTree(root.id)
    }];
  }

  return buildTree(null);
}
