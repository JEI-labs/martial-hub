import { PrismaPg } from '@prisma/adapter-pg';
import {
  ECategoryStatus,
  ETenantStatus,
  EUserRole,
  PrismaClient,
} from '@prisma/client';
import { hash } from 'argon2';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  // 1. A academia. Tudo que o sistema guarda pendura aqui.
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'thaiboxe' },
    update: {},
    create: {
      name: 'Thaiboxe & Sartorato',
      slug: 'thaiboxe',
      status: ETenantStatus.ACTIVE,
    },
  });

  // 2. Dono da academia.
  await prisma.user.upsert({
    where: {
      tenantId_email: { tenantId: tenant.id, email: 'admin@thaiboxe.com' },
    },
    update: {},
    create: {
      name: 'Admin',
      email: 'admin@thaiboxe.com',
      password: await hash('123Mudar@'),
      role: EUserRole.OWNER,
      tenantId: tenant.id,
    },
  });

  // 3. Dono do sistema: não pertence a academia nenhuma e enxerga todas.
  /* O unique é (tenantId, email) e, no Postgres, nulo nunca é igual a nulo —
     então o upsert por essa chave não serve para o master e a busca é na
     mão. */
  const master = await prisma.user.findFirst({
    where: { email: 'master@thaiboxe.com', tenantId: null },
  });

  if (!master) {
    await prisma.user.create({
      data: {
        name: 'Master',
        email: 'master@thaiboxe.com',
        password: await hash('123Mudar@'),
        role: EUserRole.MASTER,
      },
    });
  }

  // 4. A categoria fixa que recebe as mensalidades.
  const alunos = await prisma.category.findFirst({
    where: { tenantId: tenant.id, isFixed: true },
  });

  if (!alunos) {
    await prisma.category.create({
      data: {
        name: 'Alunos',
        status: ECategoryStatus.ACTIVE,
        description: 'Mensalidades dos alunos',
        isFixed: true,
        tenantId: tenant.id,
      },
    });
  }
}

main()
  .catch((e) => {
    console.error('Erro ao executar seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
