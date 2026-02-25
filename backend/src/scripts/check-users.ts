import { PrismaClient } from '@prisma/client';

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

    console.log('--- Current Users in DB ---');
    users.forEach(u => {
      console.log(`- ${u.email} (${u.employee?.role?.code || 'NO_ROLE'})`);
    });
    
    if (users.length === 0) {
      console.log('⚠️  NO USERS FOUND IN DATABASE');
    }
  } catch (err) {
    console.error('Error checking users:', err);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();
