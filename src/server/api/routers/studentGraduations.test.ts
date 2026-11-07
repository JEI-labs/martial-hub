import { randomUUID } from 'node:crypto';

import { ECategoryStatus, EUserRole } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

/* A sessão vem pronta no contexto de cada chamada; o next-auth não tem o que
   fazer aqui, e carregá-lo fora do Next só atrapalha. */
vi.mock('@/server/auth', () => ({ getServerAuthSession: vi.fn() }));

const { prisma } = await import('@/server/db');
const { createCallerFactory, createTRPCRouter } =
  await import('@/server/api/trpc');
const { studentRouter } = await import('./students');
const { plansRouter } = await import('./plans');
const { modalitiesRouter } = await import('./modalities');
const { dashboardRouter } = await import('./dashboard');

const createCaller = createCallerFactory(
  createTRPCRouter({
    student: studentRouter,
    plans: plansRouter,
    modalities: modalitiesRouter,
    dashboard: dashboardRouter,
  }),
);

const academias: Array<string> = [];

const novaAcademia = async () => {
  const slug = `t-${randomUUID().slice(0, 8)}`;
  const tenant = await prisma.tenant.create({ data: { name: slug, slug } });
  academias.push(tenant.id);

  const user = await prisma.user.create({
    data: {
      name: 'Professor Zé',
      email: `prof-${slug}@teste.com`,
      password: 'nao-usada',
      role: EUserRole.OWNER,
      tenantId: tenant.id,
    },
  });

  await prisma.category.create({
    data: {
      name: 'Alunos',
      status: ECategoryStatus.ACTIVE,
      isFixed: true,
      tenantId: tenant.id,
    },
  });

  const como = (role: EUserRole = EUserRole.OWNER) =>
    createCaller({
      prisma,
      headers: new Headers(),
      session: {
        expires: new Date(Date.now() + 60_000).toISOString(),
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          tenantId: tenant.id,
          role,
        },
      },
    });

  const caller = como();
  const muayThai = await caller.modalities.create({ name: 'Muay Thai' });
  const jiuJitsu = await caller.modalities.create({ name: 'Jiu-Jitsu' });
  const boxe = await caller.modalities.create({ name: 'Boxe' });
  const { data: mensal } = await caller.plans.create({
    name: 'Mensal',
    price: '15000',
    duration: '1',
    billing: 'MONTHLY',
    isDefault: true,
  });

  const faixa = async (modalityId: string, position: number) =>
    (await prisma.graduation.findFirstOrThrow({
      where: { modalityId, position },
    }))!;

  return { como, caller, mensal, muayThai, jiuJitsu, boxe, faixa };
};

type Academia = Awaited<ReturnType<typeof novaAcademia>>;

const cadastrar = async (
  a: Academia,
  enrollments: Array<{ modalityId: string; graduationId?: string | null }>,
) => {
  const { data } = await a.caller.student.create({
    name: 'Aluno de teste',
    email: `a-${randomUUID().slice(0, 8)}@teste.com`,
    phone: '11999999999',
    avatarUrl: null,
    birthDate: '01/01/2000',
    enrollments: enrollments.map((e) => ({ ...e, planId: a.mensal.id })),
  });
  return data;
};

const ficha = async (a: Academia, id: string) =>
  (await a.caller.student.getDetailsByID({ id })).data;

let a: Academia;

beforeEach(async () => {
  a = await novaAcademia();
});

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { id: { in: academias } } });
  await prisma.$disconnect();
});

describe('faixa por modalidade', () => {
  it('o aluno chega com a faixa de cada modalidade, independentes', async () => {
    const mt4 = await a.faixa(a.muayThai.id, 3);
    const jjAzul = await a.faixa(a.jiuJitsu.id, 13);
    const aluno = await cadastrar(a, [
      { modalityId: a.muayThai.id, graduationId: mt4.id },
      { modalityId: a.jiuJitsu.id, graduationId: jjAzul.id },
    ]);

    const { currentGraduations } = await ficha(a, aluno.id);
    expect(
      currentGraduations.map((r) => [
        r.graduation.modality.name,
        r.graduation.name,
      ]),
    ).toEqual([
      ['Muay Thai', 'Vermelho e Azul Claro'],
      ['Jiu-Jitsu', 'Azul'],
    ]);

    const { data: lista } = await a.caller.student.getAll({
      page: 1,
      limit: 10,
    });
    expect(
      lista
        .find((s) => s.id === aluno.id)
        ?.currentGraduations.map((g) => g.name),
    ).toEqual(['Vermelho e Azul Claro', 'Azul']);
  });

  it('faixa de outra modalidade na linha errada é recusada', async () => {
    const jjAzul = await a.faixa(a.jiuJitsu.id, 13);
    await expect(
      cadastrar(a, [{ modalityId: a.muayThai.id, graduationId: jjAzul.id }]),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('aluno sem faixa continua válido', async () => {
    const aluno = await cadastrar(a, [{ modalityId: a.boxe.id }]);
    const dados = await ficha(a, aluno.id);
    expect(dados.currentGraduations).toEqual([]);
    expect(dados.graduationHistory).toEqual([]);
  });
});

describe('graduar e o histórico', () => {
  it('cada graduação é um registro; a atual é a mais recente', async () => {
    const mt1 = await a.faixa(a.muayThai.id, 0);
    const mt2 = await a.faixa(a.muayThai.id, 1);
    const aluno = await cadastrar(a, [
      { modalityId: a.muayThai.id, graduationId: mt1.id },
    ]);

    await a.como(EUserRole.TEACHER).student.awardGraduation({
      studentId: aluno.id,
      graduationId: mt2.id,
      awardedAt: '',
      note: 'Exame de novembro',
    });

    const { currentGraduations, graduationHistory } = await ficha(a, aluno.id);
    expect(currentGraduations[0]?.graduation.name).toBe('Vermelho e Branco');
    expect(
      graduationHistory.map((r) => [r.graduation.name, r.note, r.user?.name]),
    ).toEqual([
      ['Vermelho e Branco', 'Exame de novembro', 'Professor Zé'],
      ['Branco', null, 'Professor Zé'],
    ]);
  });

  it('lançar um exame antigo entra no histórico sem virar a faixa atual', async () => {
    const mt2 = await a.faixa(a.muayThai.id, 1);
    const mt3 = await a.faixa(a.muayThai.id, 2);
    const aluno = await cadastrar(a, [
      { modalityId: a.muayThai.id, graduationId: mt3.id },
    ]);

    await a.caller.student.awardGraduation({
      studentId: aluno.id,
      graduationId: mt2.id,
      awardedAt: '10/01/2025',
    });

    const { currentGraduations, graduationHistory } = await ficha(a, aluno.id);
    expect(currentGraduations[0]?.graduation.name).toBe('Vermelho');
    expect(graduationHistory.map((r) => r.graduation.name)).toEqual([
      'Vermelho',
      'Vermelho e Branco',
    ]);
  });

  it('desfazer a última volta à anterior; sem nenhuma, avisa', async () => {
    const mt1 = await a.faixa(a.muayThai.id, 0);
    const mt2 = await a.faixa(a.muayThai.id, 1);
    const aluno = await cadastrar(a, [
      { modalityId: a.muayThai.id, graduationId: mt1.id },
    ]);
    await a.caller.student.awardGraduation({
      studentId: aluno.id,
      graduationId: mt2.id,
    });

    await a.caller.student.undoLastGraduation({
      studentId: aluno.id,
      modalityId: a.muayThai.id,
    });
    expect(
      (await ficha(a, aluno.id)).currentGraduations[0]?.graduation.name,
    ).toBe('Branco');

    await a.caller.student.undoLastGraduation({
      studentId: aluno.id,
      modalityId: a.muayThai.id,
    });
    await expect(
      a.caller.student.undoLastGraduation({
        studentId: aluno.id,
        modalityId: a.muayThai.id,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('graduar no jiu-jitsu não mexe no muay thai', async () => {
    const mt4 = await a.faixa(a.muayThai.id, 3);
    const jjBranca = await a.faixa(a.jiuJitsu.id, 0);
    const aluno = await cadastrar(a, [
      { modalityId: a.muayThai.id, graduationId: mt4.id },
      { modalityId: a.jiuJitsu.id },
    ]);

    await a.caller.student.awardGraduation({
      studentId: aluno.id,
      graduationId: jjBranca.id,
    });

    expect(
      (await ficha(a, aluno.id)).currentGraduations.map(
        (r) => r.graduation.name,
      ),
    ).toEqual(['Vermelho e Azul Claro', 'Branca']);
  });
});

describe('o que a graduação recusa', () => {
  it('modalidade que o aluno não faz', async () => {
    const jjBranca = await a.faixa(a.jiuJitsu.id, 0);
    const aluno = await cadastrar(a, [{ modalityId: a.muayThai.id }]);

    await expect(
      a.caller.student.awardGraduation({
        studentId: aluno.id,
        graduationId: jjBranca.id,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('a mesma faixa que ele já tem', async () => {
    const mt1 = await a.faixa(a.muayThai.id, 0);
    const aluno = await cadastrar(a, [
      { modalityId: a.muayThai.id, graduationId: mt1.id },
    ]);

    await expect(
      a.caller.student.awardGraduation({
        studentId: aluno.id,
        graduationId: mt1.id,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('data no futuro', async () => {
    const mt1 = await a.faixa(a.muayThai.id, 0);
    const aluno = await cadastrar(a, [{ modalityId: a.muayThai.id }]);

    await expect(
      a.caller.student.awardGraduation({
        studentId: aluno.id,
        graduationId: mt1.id,
        awardedAt: '01/01/2099',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('faixa de outra academia', async () => {
    const b = await novaAcademia();
    const deB = await b.faixa(b.muayThai.id, 0);
    const aluno = await cadastrar(a, [{ modalityId: a.muayThai.id }]);

    await expect(
      a.caller.student.awardGraduation({
        studentId: aluno.id,
        graduationId: deB.id,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('cancelar a matrícula guarda o histórico, mas não gradua mais ali', async () => {
    const mt1 = await a.faixa(a.muayThai.id, 0);
    const mt2 = await a.faixa(a.muayThai.id, 1);
    const aluno = await cadastrar(a, [
      { modalityId: a.muayThai.id, graduationId: mt1.id },
    ]);
    const [matricula] = (await ficha(a, aluno.id)).activeEnrollments;
    await a.caller.student.cancelEnrollment({ enrollmentId: matricula!.id });

    expect((await ficha(a, aluno.id)).currentGraduations).toHaveLength(1);
    await expect(
      a.caller.student.awardGraduation({
        studentId: aluno.id,
        graduationId: mt2.id,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

describe('gráfico do painel', () => {
  it('uma lista por modalidade com faixa, contando quem faz cada uma', async () => {
    const mt4 = await a.faixa(a.muayThai.id, 3);
    const jjAzul = await a.faixa(a.jiuJitsu.id, 13);
    await cadastrar(a, [
      { modalityId: a.muayThai.id, graduationId: mt4.id },
      { modalityId: a.jiuJitsu.id, graduationId: jjAzul.id },
    ]);
    await cadastrar(a, [
      { modalityId: a.muayThai.id, graduationId: mt4.id },
      { modalityId: a.boxe.id },
    ]);
    await cadastrar(a, [{ modalityId: a.jiuJitsu.id }]);

    const { breakdowns } = await a.caller.dashboard.getOverview({});
    expect(
      breakdowns.byGraduation.map((grupo) => [
        grupo.modality.name,
        grupo.bars.map((bar) => [bar.name, bar.students]),
      ]),
    ).toEqual([
      ['Muay Thai', [['Vermelho e Azul Claro', 2]]],
      [
        'Jiu-Jitsu',
        [
          ['Azul', 1],
          [null, 1],
        ],
      ],
    ]);
  });
});
