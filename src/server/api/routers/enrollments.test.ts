import { randomUUID } from 'node:crypto';

import { ECategoryStatus, EUserRole, PaymentStatus } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

/* A sessão vem pronta no contexto de cada chamada; o next-auth não tem o que
   fazer aqui, e carregá-lo fora do Next só atrapalha. */
vi.mock('@/server/auth', () => ({ getServerAuthSession: vi.fn() }));

const { prisma } = await import('@/server/db');
const { createCallerFactory, createTRPCRouter } =
  await import('@/server/api/trpc');
const { studentRouter } = await import('./students');
const { paymentsRouter } = await import('./payments');
const { modalitiesRouter } = await import('./modalities');
const { dashboardRouter } = await import('./dashboard');
const { deriveStudentStatus } = await import('@/server/utils/studentStatus');
const { matricular } = await import('@/server/enrollments');
const { plansRouter } = await import('./plans');

const createCaller = createCallerFactory(
  createTRPCRouter({
    student: studentRouter,
    payment: paymentsRouter,
    modalities: modalitiesRouter,
    dashboard: dashboardRouter,
    plans: plansRouter,
  }),
);

const academias: Array<string> = [];

/** Uma academia pronta para matricular: categoria, dois planos, modalidades. */
const novaAcademia = async () => {
  const slug = `t-${randomUUID().slice(0, 8)}`;
  const tenant = await prisma.tenant.create({ data: { name: slug, slug } });
  academias.push(tenant.id);

  const user = await prisma.user.create({
    data: {
      name: 'Dono',
      email: `dono-${slug}@teste.com`,
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

  const [mensal, trimestral] = await Promise.all([
    prisma.plan.create({
      data: { name: 'Mensal', price: 150, duration: 1, tenantId: tenant.id },
    }),
    prisma.plan.create({
      data: {
        name: 'Trimestral',
        price: 360,
        duration: 3,
        tenantId: tenant.id,
      },
    }),
  ]);

  const caller = createCaller({
    prisma,
    headers: new Headers(),
    session: {
      expires: new Date(Date.now() + 60_000).toISOString(),
      user: {
        id: user.id,
        name: 'Dono',
        email: user.email,
        tenantId: tenant.id,
        role: EUserRole.OWNER,
      },
    },
  });

  const muayThai = await caller.modalities.create({ name: 'Muay Thai' });
  const boxe = await caller.modalities.create({ name: 'Boxe' });

  return { tenantId: tenant.id, caller, mensal, trimestral, muayThai, boxe };
};

type Academia = Awaited<ReturnType<typeof novaAcademia>>;

const cadastrar = (
  a: Academia,
  enrollments: Array<{ modalityId: string; planId: string }>,
) =>
  a.caller.student.create({
    name: 'Aluno de teste',
    email: `a-${randomUUID().slice(0, 8)}@teste.com`,
    phone: '11999999999',
    avatarUrl: null,
    birthDate: '01/01/2000',
    enrollments,
  });

const matriculasDe = (studentId: string) =>
  prisma.enrollment.findMany({
    where: { studentId },
    include: { payments: { orderBy: { dueDate: 'asc' } }, modality: true },
    orderBy: { createdAt: 'asc' },
  });

let a: Academia;

beforeEach(async () => {
  a = await novaAcademia();
});

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { id: { in: academias } } });
  await prisma.$disconnect();
});

describe('matrícula por modalidade', () => {
  it('uma modalidade funciona como antes', async () => {
    const { data } = await cadastrar(a, [
      { modalityId: a.muayThai.id, planId: a.trimestral.id },
    ]);

    const [matricula, ...outras] = await matriculasDe(data.id);
    expect(outras).toHaveLength(0);
    expect(matricula?.modalityId).toBe(a.muayThai.id);
    expect(
      matricula?.payments.map((p) => [Number(p.amount), p.status]),
    ).toEqual([
      [120, PaymentStatus.PAID],
      [120, PaymentStatus.PENDING],
      [120, PaymentStatus.PENDING],
    ]);
  });

  it('duas modalidades: duas matrículas, cada uma com o seu plano', async () => {
    const { data } = await cadastrar(a, [
      { modalityId: a.muayThai.id, planId: a.trimestral.id },
      { modalityId: a.boxe.id, planId: a.mensal.id },
    ]);

    const matriculas = await matriculasDe(data.id);
    expect(matriculas.map((m) => [m.modality.name, m.payments.length])).toEqual(
      [
        ['Muay Thai', 3],
        ['Boxe', 1],
      ],
    );

    /* A primeira parcela de cada uma entra no caixa. */
    const lancamentos = await prisma.financeEntry.findMany({
      where: { studentId: data.id },
    });
    expect(lancamentos.map((l) => l.amount).sort()).toEqual([12000, 15000]);
  });

  it('a mesma modalidade duas vezes é recusada', async () => {
    await expect(
      cadastrar(a, [
        { modalityId: a.boxe.id, planId: a.mensal.id },
        { modalityId: a.boxe.id, planId: a.trimestral.id },
      ]),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('modalidade de outra academia ou desativada é recusada', async () => {
    const b = await novaAcademia();

    await expect(
      cadastrar(a, [{ modalityId: b.boxe.id, planId: a.mensal.id }]),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    await a.caller.modalities.update({
      id: a.boxe.id,
      name: 'Boxe',
      isActive: false,
    });
    await expect(
      cadastrar(a, [{ modalityId: a.boxe.id, planId: a.mensal.id }]),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

describe('cancelar uma modalidade não derruba as outras', () => {
  it('cancela o boxe, o muay thai segue com as parcelas', async () => {
    const { data } = await cadastrar(a, [
      { modalityId: a.muayThai.id, planId: a.trimestral.id },
      { modalityId: a.boxe.id, planId: a.trimestral.id },
    ]);
    const boxe = (await matriculasDe(data.id)).find(
      (m) => m.modalityId === a.boxe.id,
    )!;

    const { cancelled } = await a.caller.student.cancelEnrollment({
      enrollmentId: boxe.id,
    });
    expect(cancelled).toBe(2);

    const depois = await matriculasDe(data.id);
    const mt = depois.find((m) => m.modalityId === a.muayThai.id)!;
    const bx = depois.find((m) => m.modalityId === a.boxe.id)!;

    expect(mt.isActive).toBe(true);
    expect(mt.payments).toHaveLength(3);
    expect(bx.isActive).toBe(false);
    /* Só a paga fica: as futuras do boxe somem. */
    expect(bx.payments.map((p) => p.status)).toEqual([PaymentStatus.PAID]);

    const { data: lista } = await a.caller.student.getAll({
      page: 1,
      limit: 10,
    });
    const aluno = lista.find((s) => s.id === data.id)!;
    expect(aluno.status).not.toBe('SEM MATRÍCULA');
    expect(aluno.activeEnrollments.map((e) => e.modality.name)).toEqual([
      'Muay Thai',
    ]);
  });

  it('trocar o plano do boxe não mexe no muay thai', async () => {
    const { data } = await cadastrar(a, [
      { modalityId: a.muayThai.id, planId: a.trimestral.id },
      { modalityId: a.boxe.id, planId: a.trimestral.id },
    ]);
    const boxe = (await matriculasDe(data.id)).find(
      (m) => m.modalityId === a.boxe.id,
    )!;

    await a.caller.student.changePlan({
      enrollmentId: boxe.id,
      planId: a.mensal.id,
    });

    const depois = await matriculasDe(data.id);
    const ativas = depois.filter((m) => m.isActive);
    expect(
      ativas.map((m) => [m.modality.name, m.planId, m.payments.length]),
    ).toEqual([
      ['Muay Thai', a.trimestral.id, 3],
      ['Boxe', a.mensal.id, 1],
    ]);
  });

  it('cancelando a última, o aluno fica sem matrícula', async () => {
    const { data } = await cadastrar(a, [
      { modalityId: a.boxe.id, planId: a.mensal.id },
    ]);
    const [boxe] = await matriculasDe(data.id);
    await a.caller.student.cancelEnrollment({ enrollmentId: boxe!.id });

    const { data: ficha } = await a.caller.student.getDetailsByID({
      id: data.id,
    });
    expect(ficha.status).toBe('SEM MATRÍCULA');
    expect(ficha.activeEnrollments).toEqual([]);
  });
});

describe('matricular em mais uma modalidade', () => {
  it('abre a matrícula nova; na mesma modalidade é recusado', async () => {
    const { data } = await cadastrar(a, [
      { modalityId: a.muayThai.id, planId: a.mensal.id },
    ]);

    await a.caller.student.addEnrollment({
      studentId: data.id,
      modalityId: a.boxe.id,
      planId: a.mensal.id,
    });

    await expect(
      a.caller.student.addEnrollment({
        studentId: data.id,
        modalityId: a.boxe.id,
        planId: a.trimestral.id,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    const ativas = (await matriculasDe(data.id)).filter((m) => m.isActive);
    expect(ativas.map((m) => m.modality.name)).toEqual(['Muay Thai', 'Boxe']);
  });

  it('não matricula aluno de outra academia', async () => {
    const b = await novaAcademia();
    const { data } = await cadastrar(b, [
      { modalityId: b.boxe.id, planId: b.mensal.id },
    ]);

    await expect(
      a.caller.student.addEnrollment({
        studentId: data.id,
        modalityId: a.muayThai.id,
        planId: a.mensal.id,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('baixa de parcela pelo id', () => {
  it('duas parcelas no mesmo dia: só a escolhida é paga', async () => {
    const { data } = await cadastrar(a, [
      { modalityId: a.muayThai.id, planId: a.trimestral.id },
      { modalityId: a.boxe.id, planId: a.trimestral.id },
    ]);
    const matriculas = await matriculasDe(data.id);
    const segundaDoBoxe = matriculas.find((m) => m.modalityId === a.boxe.id)!
      .payments[1]!;
    const segundaDoMt = matriculas.find((m) => m.modalityId === a.muayThai.id)!
      .payments[1]!;
    expect(segundaDoBoxe.dueDate.getTime()).toBe(segundaDoMt.dueDate.getTime());

    await a.caller.payment.updatePayment({ paymentId: segundaDoBoxe.id });

    const [boxe, mt] = await Promise.all([
      prisma.payment.findUnique({ where: { id: segundaDoBoxe.id } }),
      prisma.payment.findUnique({ where: { id: segundaDoMt.id } }),
    ]);
    expect(boxe?.status).toBe(PaymentStatus.PAID);
    expect(mt?.status).toBe(PaymentStatus.PENDING);

    const lancamento = await prisma.financeEntry.findFirst({
      where: { studentId: data.id, description: { contains: 'Parcela 2' } },
    });
    expect(lancamento?.description).toContain('em Boxe');
  });

  it('parcela de outra academia não recebe baixa', async () => {
    const b = await novaAcademia();
    const { data } = await cadastrar(b, [
      { modalityId: b.boxe.id, planId: b.trimestral.id },
    ]);
    const [matricula] = await matriculasDe(data.id);

    await expect(
      a.caller.payment.updatePayment({
        paymentId: matricula!.payments[1]!.id,
      }),
    ).rejects.toThrow();

    const parcela = await prisma.payment.findUnique({
      where: { id: matricula!.payments[1]!.id },
    });
    expect(parcela?.status).toBe(PaymentStatus.PENDING);
  });
});

describe('status e painel com várias modalidades', () => {
  it('atrasado numa modalidade é atrasado', () => {
    const agora = new Date('2026-11-07T12:00:00Z');
    const em = (dias: number) => new Date(agora.getTime() + dias * 86_400_000);
    const matriculas = [
      { id: 'mt', startDate: em(-40), endDate: em(50) },
      { id: 'bx', startDate: em(-40), endDate: em(50) },
    ];

    expect(
      deriveStudentStatus(
        [
          { enrollmentId: 'mt', status: PaymentStatus.PAID, dueDate: em(-10) },
          {
            enrollmentId: 'bx',
            status: PaymentStatus.PENDING,
            dueDate: em(-5),
          },
        ],
        matriculas,
        agora,
      ),
    ).toBe('ATRASADO');

    expect(deriveStudentStatus([], [], agora)).toBe('SEM MATRÍCULA');
  });

  it('o MRR soma as matrículas; o aluno conta uma vez', async () => {
    await cadastrar(a, [
      { modalityId: a.muayThai.id, planId: a.mensal.id },
      { modalityId: a.boxe.id, planId: a.trimestral.id },
    ]);

    const { kpis, breakdowns } = await a.caller.dashboard.getOverview({});
    expect(kpis.activeStudents).toBe(1);
    expect(kpis.mrr).toBeCloseTo(150 + 120);
    expect(breakdowns.byPlan.map((p) => [p.name, p.students]).sort()).toEqual([
      ['Mensal', 1],
      ['Trimestral', 1],
    ]);
  });
});

describe('modalidade com matrícula não é apagada', () => {
  it('nem com a matrícula já encerrada', async () => {
    const { data } = await cadastrar(a, [
      { modalityId: a.muayThai.id, planId: a.mensal.id },
      { modalityId: a.boxe.id, planId: a.mensal.id },
    ]);
    const boxe = (await matriculasDe(data.id)).find(
      (m) => m.modalityId === a.boxe.id,
    )!;
    await a.caller.student.cancelEnrollment({ enrollmentId: boxe.id });

    await expect(
      a.caller.modalities.remove({ id: a.boxe.id }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

/** O que sobrou de uma leva de chamadas simultâneas: quantas deram certo e os
 *  códigos das que falharam. */
const resultadoDe = (resultados: Array<PromiseSettledResult<unknown>>) => ({
  ok: resultados.filter((r) => r.status === 'fulfilled').length,
  erros: resultados
    .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    .map((r) => (r.reason as { code?: string }).code),
});

describe('pedidos simultâneos', () => {
  it('duas matrículas na mesma modalidade ao mesmo tempo: só uma entra', async () => {
    const { data } = await cadastrar(a, [
      { modalityId: a.muayThai.id, planId: a.mensal.id },
    ]);

    const resultados = await Promise.allSettled(
      [a.mensal.id, a.trimestral.id].map((planId) =>
        a.caller.student.addEnrollment({
          studentId: data.id,
          modalityId: a.boxe.id,
          planId,
        }),
      ),
    );

    const { ok, erros } = resultadoDe(resultados);
    expect(ok).toBe(1);
    expect(['BAD_REQUEST', 'CONFLICT']).toContain(erros[0]);

    const doBoxe = (await matriculasDe(data.id)).filter(
      (m) => m.modalityId === a.boxe.id,
    );
    expect(doBoxe.filter((m) => m.isActive)).toHaveLength(1);
    /* A que falhou não deixou matrícula, parcela nem lançamento. */
    expect(doBoxe).toHaveLength(1);
    expect(
      await prisma.financeEntry.count({
        where: { studentId: data.id, description: { contains: 'Boxe' } },
      }),
    ).toBe(1);
  });

  it('duas trocas de plano da mesma matrícula: só uma vale', async () => {
    const { data } = await cadastrar(a, [
      { modalityId: a.boxe.id, planId: a.mensal.id },
    ]);
    const [boxe] = await matriculasDe(data.id);
    const anual = await prisma.plan.create({
      data: { name: 'Anual', price: 1200, duration: 12, tenantId: a.tenantId },
    });

    const resultados = await Promise.allSettled(
      [a.trimestral.id, anual.id].map((planId) =>
        a.caller.student.changePlan({ enrollmentId: boxe!.id, planId }),
      ),
    );

    const { ok, erros } = resultadoDe(resultados);
    expect(ok).toBe(1);
    /* CONFLICT quando as duas se cruzam na transação; NOT_FOUND quando a
       segunda chega depois de a primeira já ter encerrado a matrícula. */
    expect(['CONFLICT', 'NOT_FOUND']).toContain(erros[0]);
    expect(
      (await matriculasDe(data.id)).filter((m) => m.isActive),
    ).toHaveLength(1);
  });

  it('troca de plano e cancelamento juntos: não sobra matrícula a mais', async () => {
    const { data } = await cadastrar(a, [
      { modalityId: a.boxe.id, planId: a.mensal.id },
    ]);
    const [boxe] = await matriculasDe(data.id);

    const resultados = await Promise.allSettled([
      a.caller.student.changePlan({
        enrollmentId: boxe!.id,
        planId: a.trimestral.id,
      }),
      a.caller.student.cancelEnrollment({ enrollmentId: boxe!.id }),
    ]);

    expect(resultadoDe(resultados).ok).toBe(1);
    expect(
      (await matriculasDe(data.id)).filter((m) => m.isActive).length,
    ).toBeLessThanOrEqual(1);
  });

  it('duas baixas da mesma parcela: uma receita só', async () => {
    const { data } = await cadastrar(a, [
      { modalityId: a.boxe.id, planId: a.trimestral.id },
    ]);
    const [boxe] = await matriculasDe(data.id);
    const segunda = boxe!.payments[1]!;

    const resultados = await Promise.allSettled([
      a.caller.payment.updatePayment({ paymentId: segunda.id }),
      a.caller.payment.updatePayment({ paymentId: segunda.id }),
    ]);

    const { ok, erros } = resultadoDe(resultados);
    expect(ok).toBe(1);
    expect(['CONFLICT', 'NOT_FOUND']).toContain(erros[0]);
    expect(
      await prisma.financeEntry.count({
        where: { studentId: data.id, description: { contains: 'Parcela 2' } },
      }),
    ).toBe(1);
  });

  it('o índice que garante uma matrícula ativa por modalidade existe', async () => {
    const [indice] = await prisma.$queryRaw<Array<{ indexdef: string }>>`
      SELECT indexdef FROM pg_indexes
      WHERE indexname = 'Enrollment_studentId_modalityId_active_key'`;
    expect(indice?.indexdef).toMatch(/UNIQUE.*WHERE "isActive"/);
  });
});

describe('erros com a mensagem certa', () => {
  it('baixa de parcela já paga é 404, não 500', async () => {
    const { data } = await cadastrar(a, [
      { modalityId: a.boxe.id, planId: a.trimestral.id },
    ]);
    const [boxe] = await matriculasDe(data.id);

    await expect(
      a.caller.payment.updatePayment({ paymentId: boxe!.payments[0]!.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('plano com matrícula não é excluído, nem leva a matrícula junto', async () => {
    const { data } = await cadastrar(a, [
      { modalityId: a.boxe.id, planId: a.mensal.id },
    ]);

    await expect(
      a.caller.plans.delete({ id: a.mensal.id }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(await matriculasDe(data.id)).toHaveLength(1);
  });
});

describe('datas da matrícula', () => {
  it('começando no dia 31, cada mês tem uma parcela', async () => {
    const aluno = await prisma.student.create({
      data: {
        name: 'Aluno 31',
        email: `a-${randomUUID().slice(0, 8)}@teste.com`,
        phone: '11999999999',
        tenantId: a.tenantId,
      },
    });
    const categoria = await prisma.category.findFirstOrThrow({
      where: { tenantId: a.tenantId, isFixed: true },
    });
    const usuario = await prisma.user.findFirstOrThrow({
      where: { tenantId: a.tenantId },
    });
    const inicio = new Date(2026, 0, 31, 10);

    const { enrollment } = await prisma.$transaction((tx) =>
      matricular(tx, {
        student: aluno,
        modality: a.boxe,
        plan: a.trimestral,
        startDate: inicio,
        userId: usuario.id,
        tenantId: a.tenantId,
        categoryId: categoria.id,
      }),
    );

    const parcelas = await prisma.payment.findMany({
      where: { enrollmentId: enrollment.id },
      orderBy: { dueDate: 'asc' },
    });
    expect(
      parcelas.map((p) => [p.dueDate.getMonth(), p.dueDate.getDate()]),
    ).toEqual([
      [0, 31],
      [1, 28],
      [2, 31],
    ]);
    expect([
      enrollment.endDate.getMonth(),
      enrollment.endDate.getDate(),
    ]).toEqual([3, 30]);
  });
});

describe('dívida e painel depois de cancelar', () => {
  it('parcela atrasada de modalidade cancelada deixa o aluno atrasado', () => {
    const agora = new Date('2026-11-07T12:00:00Z');
    const em = (dias: number) => new Date(agora.getTime() + dias * 86_400_000);

    expect(
      deriveStudentStatus(
        [
          { enrollmentId: 'mt', status: PaymentStatus.PAID, dueDate: em(-10) },
          /* Do boxe, já cancelado: não está entre as ativas. */
          {
            enrollmentId: 'bx',
            status: PaymentStatus.PENDING,
            dueDate: em(-20),
          },
        ],
        [{ id: 'mt', startDate: em(-40), endDate: em(50) }],
        agora,
      ),
    ).toBe('ATRASADO');
  });

  it('cancelar o boxe e seguir no muay thai não é saída, no KPI nem na série', async () => {
    const { data } = await cadastrar(a, [
      { modalityId: a.muayThai.id, planId: a.mensal.id },
      { modalityId: a.boxe.id, planId: a.mensal.id },
    ]);
    const boxe = (await matriculasDe(data.id)).find(
      (m) => m.modalityId === a.boxe.id,
    )!;
    await a.caller.student.cancelEnrollment({ enrollmentId: boxe.id });

    const { kpis, series } = await a.caller.dashboard.getOverview({});
    expect(kpis.churnedThisMonth).toBe(0);
    expect(series.at(-1)?.churned).toBe(0);
  });

  it('em "por plano", quem faz duas modalidades no mesmo plano é um aluno', async () => {
    await cadastrar(a, [
      { modalityId: a.muayThai.id, planId: a.mensal.id },
      { modalityId: a.boxe.id, planId: a.mensal.id },
    ]);

    const { breakdowns } = await a.caller.dashboard.getOverview({});
    expect(breakdowns.byPlan).toEqual([
      expect.objectContaining({ name: 'Mensal', students: 1, mrr: 300 }),
    ]);
  });
});
