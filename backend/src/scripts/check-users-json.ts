import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function checkUsers() {
  try {
    const users = await prisma.user.findMany({
      include: {
        employee: {
          include: {
            role: true
          }
        }
      }
    });

    const result = users.map(u => ({
      email: u.email,
      role: u.employee?.role?.code || 'NO_ROLE'
    }));

    fs.writeFileSync('users.json', JSON.stringify(result, null, 2));
    console.log(`✅ Exported ${result.length} users to users.json`);
  } catch (err) {
    console.error('Error checking users:', err);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();
