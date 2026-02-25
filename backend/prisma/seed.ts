import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Starting System Seeding ---');

  try {
    // 0. Cleanup existing data to avoid unique constraint issues
    console.log('--- Cleaning up existing data (Orderly Destruction) ---');
    
    // Most dependent first
    await prisma.activityLog.deleteMany({});
    await prisma.followUpLog.deleteMany({});
    await prisma.leadNote.deleteMany({});
    await prisma.leadAssignmentLog.deleteMany({});
    await prisma.attendance.deleteMany({});
    await prisma.leaveRequest.deleteMany({});
    await prisma.eodReport.deleteMany({});
    await prisma.task.deleteMany({});
    await prisma.project.deleteMany({});
    await prisma.lead.deleteMany({});
    await prisma.employee.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.rolePermission.deleteMany({});
    await prisma.permission.deleteMany({});
    await prisma.role.deleteMany({});
    await prisma.department.deleteMany({});
    
    console.log('✅ Cleanup complete');

    // 1. Create Initial Departments
    const departments = [
      { name: 'Administration', code: 'ADMIN', description: 'Central Management' },
      { name: 'Sales Department', code: 'SALES', description: 'Lead generation and sales' },
      { name: 'Product Department', code: 'PRODUCT', description: 'Tech and product development' },
      { name: 'Project Department', code: 'PROJECT', description: 'Project management and execution' },
      { name: 'Operation Department', code: 'OPERATION', description: 'Operations and HR' },
    ];

    for (const dept of departments) {
      await prisma.department.upsert({
        where: { code: dept.code },
        update: {},
        create: dept,
      });
    }
    console.log('✅ Departments seeded');

    // 2. Create Roles (Normalized to Matrix)
    const roles = [
      { name: 'Admin', code: 'ADMIN', description: 'Full system control', departmentCode: 'ADMIN' },
      
      // Sales Department Roles
      { name: 'Sales Head', code: 'SALES_HEAD', description: 'Head of Sales Department', departmentCode: 'SALES' },
      { name: 'Sales BM', code: 'SALES_BM', description: 'Business Manager', departmentCode: 'SALES' },
      { name: 'Sales BDM', code: 'SALES_BDM', description: 'Business Development Manager', departmentCode: 'SALES' },
      { name: 'Sales BDE', code: 'SALES_BDE', description: 'Business Development Executive', departmentCode: 'SALES' },
      
      // Product Department Roles
      { name: 'Product Head', code: 'PROD_HEAD', description: 'Head of Product Department', departmentCode: 'PRODUCT' },
      { name: 'Product Manager', code: 'PROD_PM', description: 'Product Manager', departmentCode: 'PRODUCT' },
      { name: 'Product Developer', code: 'PROD_DEV', description: 'Software Developer', departmentCode: 'PRODUCT' },
      { name: 'Product Tester', code: 'PROD_TEST', description: 'QA Tester', departmentCode: 'PRODUCT' },
      { name: 'Product Designer', code: 'PROD_DESIGNER', description: 'UI/UX Designer', departmentCode: 'PRODUCT' },

      // Project Department Roles
      { name: 'Project Head', code: 'PROJ_HEAD', description: 'Head of Project Department', departmentCode: 'PROJECT' },
      { name: 'Project Manager', code: 'PROJ_PM', description: 'Project Manager', departmentCode: 'PROJECT' },
      { name: 'Project Developer', code: 'PROJ_DEV', description: 'Developer', departmentCode: 'PROJECT' },
      { name: 'Project Tester', code: 'PROJ_TEST', description: 'Tester', departmentCode: 'PROJECT' },
      { name: 'Project Designer', code: 'PROJ_DESIGNER', description: 'UI/UX Designer', departmentCode: 'PROJECT' },

      // Operation Department Roles
      { name: 'Operations Head', code: 'OPS_HEAD', description: 'Head of Operations', departmentCode: 'OPERATION' },
      { name: 'Operation Manager', code: 'OPS_MGR', description: 'Operations Manager', departmentCode: 'OPERATION' },
    ];

    for (const role of roles) {
      const dept = await prisma.department.findUnique({ where: { code: role.departmentCode } });
      await prisma.role.upsert({
        where: { code: role.code },
        update: { 
          name: role.name, 
          description: role.description,
          departmentId: dept?.id 
        },
        create: { 
          name: role.name, 
          code: role.code, 
          description: role.description,
          departmentId: dept?.id
        },
      });
    }
    console.log('✅ Roles seeded');

    // 3. Define Permissions — ONLY actions actually used by backend routes
    // This map was derived from auditing every checkPermission() call in /routes/*.ts
    const moduleActionMap: Record<string, string[]> = {
      leads:      ['view', 'create', 'edit', 'delete', 'assign'],
      tasks:      ['view', 'create', 'edit', 'delete', 'assign'],
      projects:   ['view', 'create', 'edit', 'delete'],
      products:   ['view', 'create', 'edit', 'delete'],
      attendance: ['view', 'create', 'approve'],
      leaves:     ['view', 'create', 'approve'],
      eod:        ['view', 'create', 'edit'],
      reports:    ['view', 'generate'],
      employees:  ['view', 'edit', 'manage'],
      activity:   ['view'],
      dashboard:  ['view'],
    };

    const scopes = ['own', 'team', 'department', 'all'];

    const permissions: any[] = [];
    for (const [module, actions] of Object.entries(moduleActionMap)) {
      for (const action of actions) {
        for (const scopeType of scopes) {
          permissions.push({ module, action, scopeType });
        }
      }
    }

    console.log(`--- Seeding ${permissions.length} Targeted Permissions ---`);
    await prisma.permission.createMany({
      data: permissions,
      skipDuplicates: true,
    });
    console.log('✅ Permissions seeded');

    // 3b. Cleanup: Remove stale permissions that are no longer in the valid map
    const validKeys = new Set(permissions.map(p => `${p.module}-${p.action}-${p.scopeType}`));
    const allExistingPerms = await prisma.permission.findMany();
    const stalePermIds = allExistingPerms
      .filter(p => !validKeys.has(`${p.module}-${p.action}-${p.scopeType}`))
      .map(p => p.id);

    if (stalePermIds.length > 0) {
      // Remove role-permission mappings first (FK constraint)
      await prisma.rolePermission.deleteMany({ where: { permissionId: { in: stalePermIds } } });
      await prisma.permission.deleteMany({ where: { id: { in: stalePermIds } } });
      console.log(`🧹 Cleaned up ${stalePermIds.length} stale permission rows`);
    } else {
      console.log('✅ No stale permissions to clean up');
    }

    // 4. Map Roles to Permissions
    console.log('--- Mapping Roles to Permissions ---');
    const allFetchedPerms = await prisma.permission.findMany();
    const rolePermMappings: { roleId: number; permissionId: number }[] = [];

    const getPermId = (module: string, action: string, scope: string) => {
      const p = allFetchedPerms.find(perm => perm.module === module && perm.action === action && perm.scopeType === scope);
      return p?.id;
    };

    const rolesInDb = await prisma.role.findMany();

    // Mapping logic
    for (const role of rolesInDb) {
      if (role.code === 'ADMIN') {
        for (const p of allFetchedPerms) {
          rolePermMappings.push({ roleId: role.id, permissionId: p.id });
        }
        continue;
      }

      const roleMappings: { module: string; action: string; scope: string }[] = [];

      // 1. Universal Baseline (Every employee sees their own data across all modules)
      const modules = ['leads', 'tasks', 'projects', 'products', 'attendance', 'leaves', 'eod', 'employees', 'activity', 'dashboard', 'reports'];
      for (const mod of modules) {
        roleMappings.push({ module: mod, action: 'view', scope: 'own' });
        // Self-management modules
        if (['attendance', 'leaves', 'eod'].includes(mod)) {
          roleMappings.push({ module: mod, action: 'create', scope: 'own' });
        }
        // Reports access (own)
        if (mod === 'reports') {
          roleMappings.push({ module: mod, action: 'generate', scope: 'own' });
        }
      }

      // 2. Department Head Overrides (DEPARTMENT Scope for almost everything)
      if (['SALES_HEAD', 'PROD_HEAD', 'PROJ_HEAD', 'OPS_HEAD'].includes(role.code)) {
        for (const mod of modules) {
          roleMappings.push({ module: mod, action: 'view', scope: 'department' });
          // Heads can also edit/approve in their dept
          if (['leads', 'tasks', 'projects'].includes(mod)) {
            roleMappings.push({ module: mod, action: 'edit', scope: 'department' });
          }
          if (['attendance', 'leaves'].includes(mod)) {
            roleMappings.push({ module: mod, action: 'approve', scope: 'department' });
          }
          if (mod === 'reports') {
             roleMappings.push({ module: mod, action: 'generate', scope: 'department' });
          }
        }
      }

      // 3. Middle Management (BM/BDM/PM) Overrides (TEAM/DEPARTMENT Scope)
      if (['SALES_BM', 'SALES_BDM', 'PROD_PM', 'PROJ_PM'].includes(role.code)) {
        const scopeStr = ['SALES_BM', 'SALES_BDM'].includes(role.code) ? 'team' : 'department'; 
        for (const mod of modules) {
           roleMappings.push({ module: mod, action: 'view', scope: scopeStr });
           if (mod === 'reports') roleMappings.push({ module: mod, action: 'generate', scope: scopeStr });
           if (['attendance', 'leaves'].includes(mod)) {
             roleMappings.push({ module: mod, action: 'approve', scope: scopeStr });
           }
        }
      }

      // 4. Role-Specific Special Permissions
      if (role.code === 'SALES_BDM') {
        roleMappings.push(
          { module: 'leads', action: 'create', scope: 'all' },
          { module: 'leads', action: 'assign', scope: 'all' },
          { module: 'tasks', action: 'create', scope: 'all' },
          { module: 'tasks', action: 'assign', scope: 'all' },
        );
      }

      if (role.code === 'OPS_MGR') {
        roleMappings.push(
          { module: 'employees', action: 'view', scope: 'all' },
          { module: 'employees', action: 'manage', scope: 'all' },
          { module: 'attendance', action: 'view', scope: 'all' },
          { module: 'attendance', action: 'approve', scope: 'all' },
          { module: 'leaves', action: 'view', scope: 'all' },
          { module: 'leaves', action: 'approve', scope: 'all' },
        );
      }

      // Deduplicate and map to IDs
      const uniqueCodes = new Set<string>();
      for (const m of roleMappings) {
        const key = `${m.module}-${m.action}-${m.scope}`;
        if (!uniqueCodes.has(key)) {
          uniqueCodes.add(key);
          const pId = getPermId(m.module, m.action, m.scope);
          if (pId) {
            rolePermMappings.push({ roleId: role.id, permissionId: pId });
          }
        }
      }
    }

    // Batch insert role permissions
    await prisma.rolePermission.createMany({
      data: rolePermMappings,
      skipDuplicates: true,
    });
    console.log('✅ Role mappings seeded');

    // 5. Create Super Admin User
    const adminEmail = 'superadmin@media-masala.com';
    const hashedPassword = await bcrypt.hash('Password@123', 10);
    const adminDept = await prisma.department.findUnique({ where: { code: 'ADMIN' } });
    const adminRole = rolesInDb.find(r => r.code === 'ADMIN');

    if (adminRole && adminDept) {
      const adminUser = await prisma.user.upsert({
        where: { email: adminEmail },
        update: { passwordHash: hashedPassword },
        create: {
          email: adminEmail,
          passwordHash: hashedPassword,
        },
      });

      console.log('✅ Super Admin user created/updated');

      await prisma.employee.upsert({
        where: { email: adminEmail },
        update: {
          firstName: 'Super',
          lastName: 'Admin',
          roleId: adminRole.id,
          departmentId: adminDept.id,
        },
        create: {
          empId: 'EMP001',
          userId: adminUser.id,
          firstName: 'Super',
          lastName: 'Admin',
          email: adminEmail,
          departmentId: adminDept.id,
          roleId: adminRole.id,
        },
      });
      console.log('✅ Super Admin employee record created/updated');

      // 6. Create Sales Hierarchy (Orderly Construction)
      console.log('--- Seeding Sales Hierarchy ---');
      
      const createStaff = async (
        empId: string, firstName: string, lastName: string, 
        email: string, roleCode: string, deptCode: string, managerId?: number
      ) => {
        const d = await prisma.department.findUnique({ where: { code: deptCode } });
        const r = await prisma.role.findUnique({ where: { code: roleCode } });
        if (!d || !r) throw new Error(`Missing Dept ${deptCode} or Role ${roleCode}`);

        const user = await prisma.user.upsert({
          where: { email },
          update: { passwordHash: hashedPassword },
          create: {
            email,
            passwordHash: hashedPassword,
          }
        });

        const emp = await prisma.employee.upsert({
          where: { email },
          update: { 
            firstName, lastName, roleId: r.id, departmentId: d.id, 
            managerId: managerId ?? undefined 
          },
          create: {
            empId,
            userId: user.id,
            firstName,
            lastName,
            email,
            departmentId: d.id,
            roleId: r.id,
            managerId: managerId ?? undefined,
          }
        });
        return emp;
      };

      // Level 1: HOD
      const hod = await createStaff('EMP-HOD', 'Sales', 'HOD', 'sales.hod@test.com', 'SALES_HEAD', 'SALES');
      // Level 2: BM
      const bm = await createStaff('EMP-BM', 'Sales', 'BM', 'sales.bm@test.com', 'SALES_BM', 'SALES', hod.id);
      // Level 3: BDMs
      const bdm1 = await createStaff('EMP-BDM1', 'Sales', 'BDM-1', 'sales.bdm1@test.com', 'SALES_BDM', 'SALES', bm.id);
      const bdm2 = await createStaff('EMP-BDM2', 'Sales', 'BDM-2', 'sales.bdm2@test.com', 'SALES_BDM', 'SALES', bm.id);
      // Level 4: BDEs (Team 1)
      const bde1a = await createStaff('EMP-BDE1A', 'Sales', 'BDE-1A', 'sales.bde1a@test.com', 'SALES_BDE', 'SALES', bdm1.id);
      const bde1b = await createStaff('EMP-BDE1B', 'Sales', 'BDE-1B', 'sales.bde1b@test.com', 'SALES_BDE', 'SALES', bdm1.id);
      const bde1c = await createStaff('EMP-BDE1C', 'Sales', 'BDE-1C', 'sales.bde1c@test.com', 'SALES_BDE', 'SALES', bdm1.id);
      const bde1d = await createStaff('EMP-BDE1D', 'Sales', 'BDE-1D', 'sales.bde1d@test.com', 'SALES_BDE', 'SALES', bdm1.id);
      // Level 4: BDEs (Team 2)
      const bde2a = await createStaff('EMP-BDE2A', 'Sales', 'BDE-2A', 'sales.bde2a@test.com', 'SALES_BDE', 'SALES', bdm2.id);
      const bde2b = await createStaff('EMP-BDE2B', 'Sales', 'BDE-2B', 'sales.bde2b@test.com', 'SALES_BDE', 'SALES', bdm2.id);
      const bde2c = await createStaff('EMP-BDE2C', 'Sales', 'BDE-2C', 'sales.bde2c@test.com', 'SALES_BDE', 'SALES', bdm2.id);
      const bde2d = await createStaff('EMP-BDE2D', 'Sales', 'BDE-2D', 'sales.bde2d@test.com', 'SALES_BDE', 'SALES', bdm2.id);

      // Product Department Team (Full Hierarchy)
      const prodHod = await createStaff('EMP-PROD-HOD', 'Product', 'HOD', 'prod.hod@test.com', 'PROD_HEAD', 'PRODUCT');
      
      // Team 1
      const prodPM1 = await createStaff('EMP-PROD-PM1', 'Product', 'PM-1', 'prod.pm1@test.com', 'PROD_PM', 'PRODUCT', prodHod.id);
      await createStaff('EMP-PROD-DEV1', 'Product', 'Dev-1', 'prod.dev1@test.com', 'PROD_DEV', 'PRODUCT', prodPM1.id);
      await createStaff('EMP-PROD-TEST1', 'Product', 'Test-1', 'prod.test1@test.com', 'PROD_TEST', 'PRODUCT', prodPM1.id);
      await createStaff('EMP-PROD-DSN1', 'Product', 'Design-1', 'prod.design1@test.com', 'PROD_DESIGNER', 'PRODUCT', prodPM1.id);

      // Team 2
      const prodPM2 = await createStaff('EMP-PROD-PM2', 'Product', 'PM-2', 'prod.pm2@test.com', 'PROD_PM', 'PRODUCT', prodHod.id);
      await createStaff('EMP-PROD-DEV2', 'Product', 'Dev-2', 'prod.dev2@test.com', 'PROD_DEV', 'PRODUCT', prodPM2.id);
      await createStaff('EMP-PROD-TEST2', 'Product', 'Test-2', 'prod.test2@test.com', 'PROD_TEST', 'PRODUCT', prodPM2.id);
      await createStaff('EMP-PROD-DSN2', 'Product', 'Design-2', 'prod.design2@test.com', 'PROD_DESIGNER', 'PRODUCT', prodPM2.id);

      // Project Department Team (Full Hierarchy)
      const projHod = await createStaff('EMP-PROJ-HOD', 'Project', 'HOD', 'proj.hod@test.com', 'PROJ_HEAD', 'PROJECT');
      
      // Team 1
      const projPM1 = await createStaff('EMP-PROJ-PM1', 'Project', 'PM-1', 'proj.pm1@test.com', 'PROJ_PM', 'PROJECT', projHod.id);
      await createStaff('EMP-PROJ-DEV1', 'Project', 'Dev-1', 'proj.dev1@test.com', 'PROJ_DEV', 'PROJECT', projPM1.id);
      await createStaff('EMP-PROJ-TEST1', 'Project', 'Test-1', 'proj.test1@test.com', 'PROJ_TEST', 'PROJECT', projPM1.id);
      await createStaff('EMP-PROJ-DSN1', 'Project', 'Design-1', 'proj.design1@test.com', 'PROJ_DESIGNER', 'PROJECT', projPM1.id);

      // Team 2
      const projPM2 = await createStaff('EMP-PROJ-PM2', 'Project', 'PM-2', 'proj.pm2@test.com', 'PROJ_PM', 'PROJECT', projHod.id);
      await createStaff('EMP-PROJ-DEV2', 'Project', 'Dev-2', 'proj.dev2@test.com', 'PROJ_DEV', 'PROJECT', projPM2.id);
      await createStaff('EMP-PROJ-TEST2', 'Project', 'Test-2', 'proj.test2@test.com', 'PROJ_TEST', 'PROJECT', projPM2.id);
      await createStaff('EMP-PROJ-DSN2', 'Project', 'Design-2', 'proj.design2@test.com', 'PROJ_DESIGNER', 'PROJECT', projPM2.id);

      // Operations
      await createStaff('EMP-OPS1', 'Charlie', 'Ops', 'charlie.ops@media-masala.com', 'OPS_HEAD', 'OPERATION');

      console.log('✅ Sales hierarchy, Product team, Project team, and Ops staff created');

      // 7. Create Sample Leads (Detailed Hierarchy Leads)
      console.log('--- Seeding 80 Sample Leads ---');
      const salesDept = await prisma.department.findUnique({ where: { code: 'SALES' } });
      if (salesDept) {
        const bdes = [
          { emp: bde1a, tag: 'BDE1A' }, { emp: bde1b, tag: 'BDE1B' },
          { emp: bde1c, tag: 'BDE1C' }, { emp: bde1d, tag: 'BDE1D' },
          { emp: bde2a, tag: 'BDE2A' }, { emp: bde2b, tag: 'BDE2B' },
          { emp: bde2c, tag: 'BDE2C' }, { emp: bde2d, tag: 'BDE2D' }
        ];

        const sources = ['Website', 'Referral', 'Cold_Call', 'Email'];
        const statuses = ['New', 'Follow_Up', 'Prospect', 'Hot_Prospect', 'Proposal_Sent', 'Closing'];

        const leadData: any[] = [];
        for (const bde of bdes) {
          for (let i = 1; i <= 10; i++) {
            const leadName = `Lead-${bde.tag}-${i}`;
            const leadEmail = `${leadName.toLowerCase().replace(/ /g, '')}@example.com`;
            leadData.push({
              name: leadName,
              email: leadEmail,
              phone: `99${Math.floor(10000000 + Math.random() * 90000000)}`,
              company: `Company ${bde.tag}-${i}`,
              source: sources[i % sources.length],
              status: statuses[i % statuses.length],
              ownerId: bde.emp.id,
              departmentId: salesDept.id,
              notes: `Test lead owned by ${bde.tag}`
            });
          }
        }

        await prisma.lead.createMany({
          data: leadData,
          skipDuplicates: true
        });
        console.log('✅ 80 Sample leads created/verified');
      }

      // 8. Create Sample Products (with Product Manager)
      console.log('--- Seeding Sample Products ---');
      const productSeedData = [
        { name: 'Standard Website', description: '<p>Responsive corporate website with up to <strong>5 pages</strong>. Includes contact form, SEO optimization, and mobile-first design.</p>', category: 'Web Development', productManagerId: prodPM1.id },
        { name: 'E-commerce Portal', description: '<p>Full-featured <strong>online store</strong> with payment integration, inventory management, and customer dashboard.</p><ul><li>Razorpay / Stripe</li><li>Admin panel</li><li>Order tracking</li></ul>', category: 'Web Development', productManagerId: prodPM2.id },
        { name: 'Mobile App Foundation', description: '<p>Base structure for <em>iOS and Android</em> mobile applications using <strong>React Native</strong>.</p>', category: 'Mobile Apps', productManagerId: prodPM1.id },
        { name: 'CRM System', description: '<p>Custom <strong>Customer Relationship Management</strong> system with lead tracking, task management, and reporting.</p>', category: 'SaaS', productManagerId: prodPM2.id },
        { name: 'Social Media Dashboard', description: '<p>Centralized dashboard for managing <strong>social media accounts</strong>, scheduling posts, and tracking analytics.</p>', category: 'SaaS', productManagerId: prodPM1.id },
      ];
      for (const p of productSeedData) {
        await (prisma.product as any).upsert({
          where: { name: p.name },
          update: { description: p.description, category: p.category, productManagerId: p.productManagerId },
          create: p
        });
      }
      console.log('✅ Sample products created with Product Manager assigned');

      // 9. Create Sample Projects (with RM and PM assignments)
      console.log('--- Seeding Sample Projects ---');
      const projectSeedData: any[] = [
        { name: 'Acme Website Redesign', description: '<p>Modernizing the <strong>corporate identity</strong> for Acme Corp. Full responsive redesign with new branding.</p>', status: 'Active', relationshipManagerId: bdm1.id, projectManagerId: projPM1.id },
        { name: 'Globex Mobile App', description: '<p>Developing a new <em>consumer application</em> for Globex Inc. React Native with backend API.</p>', status: 'Planning', relationshipManagerId: bdm2.id, projectManagerId: prodPM1.id },
        { name: 'TechNova CRM Integration', description: '<p>Building a custom <strong>CRM integration</strong> for TechNova, connecting their sales pipeline with inventory.</p>', status: 'Active', relationshipManagerId: bm.id, projectManagerId: projPM2.id },
      ];
      for (const pr of projectSeedData) {
        const exists = await prisma.project.findFirst({ where: { name: pr.name } });
        if (!exists) {
            await prisma.project.create({
                data: pr
            });
        }
      }
      console.log('✅ Sample projects created with RM + PM assigned');


      // 11. Create Specific RBAC Test Scenario Cases
      console.log('--- Seeding Specific RBAC Test Scenarios ---');
      
      // Scenario: Cross-Department PM/RM Relationship
      const salesDeptObj = await prisma.department.findUnique({ where: { code: 'SALES' } });
      const prodDeptObj = await prisma.department.findUnique({ where: { code: 'PRODUCT' } });

      if (salesDeptObj && prodDeptObj) {
          // Staff A1 (Sales RM)
          const staffA1 = await createStaff('TEST-A1', 'RM-Staff', 'Sales', 'staff.a1@test.com', 'SALES_BDE', 'SALES', bm.id);
          // Staff A2 (Sales Observer - should not see A1 leads)
          const staffA2 = await createStaff('TEST-A2', 'Observer-Staff', 'Sales', 'staff.a2@test.com', 'SALES_BDE', 'SALES', bm.id);
          // Staff B1 (Product PM)
          const staffB1 = await createStaff('TEST-B1', 'PM-Staff', 'Product', 'staff.b1@test.com', 'PROD_PM', 'PRODUCT', prodPM1.id);

          // Lead owned by A1
          const leadA1 = await prisma.lead.create({
              data: {
                  name: 'Private Lead A1',
                  email: 'private@a1.com',
                  company: 'A1 Private Corp',
                  source: 'Website',
                  status: 'Prospect',
                  ownerId: staffA1.id,
                  departmentId: salesDeptObj.id
              }
          });

          // Project linked to Lead A1, managed by B1 (PM) and A1 (RM)
          await (prisma.project as any).create({
              data: {
                  name: 'Shared Project A1-B1',
                  description: 'A project where Sales RM and Product PM collaborate.',
                  status: 'Active',
                  leadId: leadA1.id,
                  projectManagerId: staffB1.id,
                  relationshipManagerId: staffA1.id
              }
          });

          console.log('✅ RBAC Test scenarios seeded successfully.');

          // 12. Seed Historical Attendance (Last 30 Days)
          console.log('--- Seeding 30 Days of Historical Attendance ---');
          const allEmployees = await prisma.employee.findMany();
          const attendanceData: any[] = [];
          const now = new Date();
          
          for (let i = 1; i <= 30; i++) {
            const date = new Date();
            date.setDate(now.getDate() - i);
            if (date.getDay() === 0) continue; // Skip Sundays

            for (const emp of allEmployees) {
              const checkIn = new Date(date);
              checkIn.setHours(9, Math.floor(Math.random() * 30), 0);
              
              const checkOut = new Date(date);
              checkOut.setHours(18, Math.floor(Math.random() * 30), 0);

              attendanceData.push({
                employeeId: emp.id,
                date: new Date(date.setHours(0,0,0,0)),
                checkIn,
                checkOut,
                status: Math.random() > 0.1 ? 'Present' : (Math.random() > 0.5 ? 'Late' : 'Half_Day'),
                location: 'Office'
              });
            }
          }
          await prisma.attendance.createMany({ data: attendanceData, skipDuplicates: true });
          console.log('✅ 30 Days of Attendance seeded');

          // 13. Seed EOD Reports (Last 10 Days)
          console.log('--- Seeding 10 Days of EOD Reports ---');
          const eodData: any[] = [];
          for (let i = 1; i <= 10; i++) {
            const date = new Date();
            date.setDate(now.getDate() - i);
            if (date.getDay() === 0) continue;

            for (const emp of allEmployees) {
              if (Math.random() > 0.3) { // 70% chance of filing EOD
                eodData.push({
                  employeeId: emp.id,
                  date: new Date(date.setHours(0,0,0,0)),
                  content: `Completed ${Math.floor(Math.random() * 5 + 1)} tasks and followed up with ${Math.floor(Math.random() * 10 + 2)} clients. Everything on track.`,
                  leadsCount: Math.floor(Math.random() * 5),
                  tasksCount: Math.floor(Math.random() * 8)
                });
              }
            }
          }
          await prisma.eodReport.createMany({ data: eodData });
          console.log('✅ 10 Days of EOD Reports seeded');

          // 14. Seed Detailed Tasks & Lead Notes
          console.log('--- Seeding Dense Task & Note Matrix ---');
          const leads = await prisma.lead.findMany({ take: 50 });
          const taskData: any[] = [];
          const noteData: any[] = [];

          for (const lead of leads) {
              // Add a Task for each lead
              taskData.push({
                  title: `Follow up with ${lead.name}`,
                  description: `Discuss the proposal sent last week regarding ${lead.company}.`,
                  dueDate: new Date(now.getTime() + (Math.random() * 7 * 24 * 60 * 60 * 1000)),
                  priority: 'High',
                  status: 'Pending',
                  assigneeId: lead.ownerId,
                  relatedToLeadId: lead.id,
                  creatorId: adminUser.id
              });

              // Add a Note for each lead
              noteData.push({
                  leadId: lead.id,
                  authorId: lead.ownerId ?? adminUser.id,
                  content: `Initial discovery call completed. Client is interested in the ${lead.source} offering.`,
                  isPrivate: false
              });
          }
          await prisma.task.createMany({ data: taskData });
          await prisma.leadNote.createMany({ data: noteData });
          console.log('✅ Task and Note matrix seeded');
      }
    }

    console.log('🚀 Seeding Complete: superadmin@media-masala.com / Password@123');
  } catch (error) {
    console.error('❌ Seeding Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
