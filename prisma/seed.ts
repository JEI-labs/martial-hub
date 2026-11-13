import { PrismaPg } from '@prisma/adapter-pg';
import {
  ECategoryStatus,
  ETenantStatus,
  EUserRole,
  PrismaClient,
} from '@prisma/client';
import { hash } from 'argon2';

import { graduacoesDoCatalogo } from '../src/common/constants/graduations';
import { slugify } from '../src/common/utils/string';

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

  // 5. A modalidade da academia de exemplo — é uma academia de Muay Thai.
  const MODALIDADE = 'Muay Thai';
  const modalidade = await prisma.modality.upsert({
    where: {
      tenantId_slug: { tenantId: tenant.id, slug: slugify(MODALIDADE) },
    },
    update: {},
    create: {
      name: MODALIDADE,
      slug: slugify(MODALIDADE),
      tenantId: tenant.id,
    },
  });

  // 6. As faixas dela, do catálogo — só se ainda não tiver nenhuma, para
  // rodar o seed de novo não duplicar.
  const faixas = await prisma.graduation.count({
    where: { modalityId: modalidade.id },
  });

  if (faixas === 0) {
    await prisma.graduation.createMany({
      data: graduacoesDoCatalogo(modalidade.slug).map((faixa) => ({
        ...faixa,
        modalityId: modalidade.id,
      })),
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
