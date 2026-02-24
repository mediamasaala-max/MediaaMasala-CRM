/**
 * Centralized Prisma select objects to reduce payload size and prevent leakage.
 */

export const employeeSelect = {
  id: true,
  empId: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  departmentId: true,
  roleId: true,
  managerId: true,
  department: {
    select: { id: true, name: true, code: true }
  },
  role: {
    select: { id: true, name: true, code: true }
  },
  manager: {
    select: { id: true, firstName: true, lastName: true }
  },
  user: {
    select: { isActive: true }
  }
};

export const employeeSelectMinimal = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  department: {
    select: { id: true, name: true }
  }
};

export const leadSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  company: true,
  source: true,
  status: true,
  lostReason: true,
  createdAt: true,
  updatedAt: true,
  department: { select: { id: true, name: true } },
  owner: { select: { id: true, firstName: true, lastName: true } }
};

export const projectSelect = {
  id: true,
  name: true,
  description: true,
  startDate: true,
  endDate: true,
  status: true,
  lead: { select: { id: true, name: true, company: true } },
  projectManager: { select: { id: true, firstName: true, lastName: true } },
  relationshipManager: { select: { id: true, firstName: true, lastName: true } },
  _count: { select: { tasks: true } }
};

export const taskSelect = {
  id: true,
  title: true,
  description: true,
  dueDate: true,
  priority: true,
  status: true,
  completedAt: true,
  completionNote: true,
  relatedToLeadId: true,
  projectId: true,
  productId: true,
  assignee: { select: employeeSelectMinimal },
  creator: { select: employeeSelectMinimal },
  lead: { select: { id: true, name: true, company: true, status: true } },
  project: { select: { id: true, name: true, status: true } },
  product: { select: { id: true, name: true, category: true } }
};

export const productSelect = {
  id: true,
  name: true,
  description: true,
  price: true,
  category: true,
  status: true,
  isActive: true,
  productManager: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      empId: true,
      role: { select: { name: true } },
      department: { select: { name: true } }
    }
  }
};
