import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        employee: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true
                  }
                }
              }
            },
            department: true
          }
        }
      }
    });

    if (!user || !user.passwordHash) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (!user.isActive) {
      return res.status(401).json({ message: 'Account is deactivated. Please contact admin.' });
    }

    if (!user.employee) {
      return res.status(403).json({ message: 'User account has no associated employee profile. Please contact admin.' });
    }

    // Flatten permissions for the token/response
    let permissions = user.employee.role.permissions.map(rp => ({
      module: rp.permission.module,
      action: rp.permission.action,
      scope: rp.permission.scopeType
    }));

    const token = jwt.sign(
      {
        id: user.id,
        employeeId: user.employee.id,
        email: user.email,
        role: user.employee.role.code,
        roleVersion: user.employee.role.roleVersion,
        departmentId: user.employee.departmentId,
        permissions: permissions
      },
      JWT_SECRET,
      { expiresIn: '48h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        employeeId: user.employee.id,
        employee: {
          id: user.employee.id,
          firstName: user.employee.firstName,
          lastName: user.employee.lastName,
          empId: user.employee.empId
        },
        email: user.email,
        name: `${user.employee.firstName} ${user.employee.lastName}`,
        role: user.employee.role.code,
        department: user.employee.department.name
      },
      permissions
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/register', async (req, res) => {
  const { email, password, firstName, lastName } = req.body;

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already in use' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [unassignedRole, unassignedDept] = await Promise.all([
      prisma.role.findUnique({ where: { code: 'UNASSIGNED' } }),
      prisma.department.findUnique({ where: { code: 'UNASSIGNED' } })
    ]);

    if (!unassignedRole || !unassignedDept) {
      return res.status(500).json({ message: 'Infrastructure error: Default roles missing' });
    }

    // Atomic creation of User and Employee
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash: hashedPassword,
          isActive: true
        }
      });

      // Simple empId generator logic (could be improved)
      const count = await tx.employee.count();
      const empId = `EMP${String(count + 1).padStart(3, '0')}`;

      const employee = await tx.employee.create({
        data: {
          empId,
          userId: user.id,
          firstName: firstName || email.split('@')[0],
          lastName: lastName || '',
          email,
          roleId: unassignedRole.id,
          departmentId: unassignedDept.id,
          isActive: true
        }
      });

      return { user, employee };
    });

    res.status(201).json({ 
      message: 'Registration successful. Profile created with default roles.',
      userId: result.user.id,
      employeeId: result.employee.id
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Internal server error during registration' });
  }
});

router.get('/me', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'Token required' });

  try {
    const JWT_SECRET_LOCAL = process.env.JWT_SECRET || 'your-secret-key';
    const decoded = jwt.verify(token, JWT_SECRET_LOCAL) as any;
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: {
        employee: {
          include: {
            role: {
              include: {
                permissions: {
                  include: { permission: true }
                }
              }
            },
            department: true
          }
        }
      }
    });

    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.isActive) return res.status(401).json({ message: 'Account is disabled' });
    if (!user.employee) return res.status(403).json({ message: 'No employee profile' });

    // JWT Hygiene: Check Role Version
    if (decoded.roleVersion !== undefined && user.employee.role.roleVersion !== decoded.roleVersion) {
      return res.status(401).json({ 
        message: 'Permissions updated. Please log in again.',
        code: 'TOKEN_STALE',
        refreshRequired: true 
      });
    }

    const permissions = user.employee.role.permissions.map(rp => ({
      module: rp.permission.module,
      action: rp.permission.action,
      scope: rp.permission.scopeType
    }));

    res.json({
      user: {
        id: user.id,
        employeeId: user.employee.id,
        email: user.email,
        name: `${user.employee.firstName} ${user.employee.lastName}`,
        role: user.employee.role.code,
        department: user.employee.department.name
      },
      permissions
    });
  } catch (error) {
    console.error('Me endpoint error:', error);
    res.status(401).json({ message: 'Invalid token' });
  }
});

router.post('/logout', (req, res) => {
  // Client handles token removal, backend can log or invalidate if using redis
  res.json({ message: 'Logged out successfully' });
});

export default router;
