import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const db = new PrismaClient();

async function hash(password: string) {
  return argon2.hash(password, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4 });
}

async function main() {
  console.log('Seeding database...');

  // Platform Admin
  await db.platformAdmin.upsert({
    where: { username: 'superadmin' },
    update: {},
    create: {
      username: 'superadmin',
      passwordHash: await hash('SuperAdmin2024!'),
      nombre: 'Super Administrador',
      email: 'admin@terminalbuses.com',
      activo: true,
    },
  });
  console.log('✓ Platform admin creado (superadmin / SuperAdmin2024!)');

  // Tenant de prueba
  const tenant = await db.tenant.upsert({
    where: { codigo: 'trans-andina' },
    update: {},
    create: {
      codigo: 'trans-andina',
      nombre: 'Trans Andina S.A.',
      emailContacto: 'contacto@transandina.com',
      telefonoContacto: '+591 70000000',
      estado: 'Active',
      fechaCompra: new Date(),
    },
  });
  console.log(`✓ Tenant creado: ${tenant.nombre} (codigo: trans-andina)`);

  // Sucursal principal
  const branch = await db.branch.upsert({
    where: { tenantId_nombre: { tenantId: tenant.id, nombre: 'Sucursal Central' } },
    update: {},
    create: { tenantId: tenant.id, nombre: 'Sucursal Central', ciudad: 'La Paz', activo: true },
  });
  console.log(`✓ Sucursal creada: ${branch.nombre}`);

  // Admin del tenant
  await db.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'admin@transandina.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'admin@transandina.com',
      passwordHash: await hash('Admin2024!'),
      nombre: 'Administrador Trans Andina',
      rol: 'admin',
      branchId: null,
      estado: 'Activo',
      mustChangePassword: true,
    },
  });
  console.log('✓ Admin creado (admin@transandina.com / Admin2024!)');

  // Boletero de prueba
  await db.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'boletero@transandina.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'boletero@transandina.com',
      passwordHash: await hash('Boletero2024!'),
      nombre: 'Juan Pérez',
      rol: 'boletero',
      branchId: branch.id,
      estado: 'Activo',
    },
  });
  console.log('✓ Boletero creado (boletero@transandina.com / Boletero2024!)');

  console.log('\nSeed completado exitosamente.');
  console.log('─────────────────────────────────');
  console.log('Login URL: http://localhost:5173/t/trans-andina/login');
  console.log('  admin@transandina.com   / Admin2024!');
  console.log('  boletero@transandina.com / Boletero2024!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
