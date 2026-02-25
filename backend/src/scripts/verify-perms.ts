import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyPermissions() {
  try {
    const roles = await prisma.role.findMany({
      include: {
        permissions: {
          include: {
            permission: true
          }
        }
      }
    });

    console.log('--- Role Permission Audit ---');
    roles.forEach(role => {
      console.log(`\nRole: ${role.code}`);
      const perms = role.permissions.map(p => `${p.permission.module}:${p.permission.action} (${p.permission.scopeType})`);
      // Group by module for readability
      const grouped: Record<string, string[]> = {};
      role.permissions.forEach(p => {
        if (!grouped[p.permission.module]) grouped[p.permission.module] = [];
        grouped[p.permission.module].push(`${p.permission.action}:${p.permission.scopeType}`);
      });
      
      Object.entries(grouped).forEach(([mod, ps]) => {
        console.log(`  - ${mod}: ${ps.join(', ')}`);
      });
    });
  } catch (err) {
    console.error('Error verifying permissions:', err);
  } finally {
    await prisma.$disconnect();
  }
}

verifyPermissions();
