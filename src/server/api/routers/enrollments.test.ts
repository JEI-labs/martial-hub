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

const createCaller = createCallerFactory(
  createTRPCRouter({
    student: studentRouter,
    payment: paymentsRouter,
    modalities: modalitiesRouter,
    dashboard: dashboardRouter,
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
