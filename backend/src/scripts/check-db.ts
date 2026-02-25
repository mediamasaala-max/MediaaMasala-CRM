
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  try {
    console.log('--- Prisma Diagnostic ---')
    const userCount = await prisma.user.count()
    console.log(`Connection successful. User count: ${userCount}`)
    
    // Check specific permissions table (since I added indexes there)
    const logsCount = await prisma.activityLog.count()
    console.log(`Activity logs count: ${logsCount}`)
    
    const tasksCount = await prisma.task.count()
    console.log(`Tasks count: ${tasksCount}`)

    console.log('--- Schema Check ---')
    const users = await prisma.user.findMany({ take: 1, select: { id: true, email: true } })
    console.log('User sample:', users)
    
  } catch (error: any) {
    console.error('--- DIAGNOSTIC FAILED ---')
    console.error('Error Code:', error.code)
    console.error('Error Message:', error.message)
    if (error.stack) console.error('Stack:', error.stack)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
