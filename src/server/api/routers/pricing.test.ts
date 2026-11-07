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
const { comDesconto, descontosDasMatriculas, precoNaModalidade } =
  await import('@/common/utils/pricing');

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

  const como = (role: EUserRole = EUserRole.OWNER) =>
    createCaller({
      prisma,
      headers: new Headers(),
      session: {
        expires: new Date(Date.now() + 60_000).toISOString(),
        user: {
          id: user.id,
          name: 'Dono',
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

  /* "Mensal": R$ 150 padrão, R$ 200 no jiu-jitsu. */
  const { data: mensal } = await caller.plans.create({
    name: 'Mensal',
    price: '15000',
    duration: '1',
    billing: 'MONTHLY',
    isDefault: true,
    modalityPrices: [{ modalityId: jiuJitsu.id, price: '20000' }],
  });

  return {
    tenantId: tenant.id,
    como,
    caller,
    mensal,
    muayThai,
    jiuJitsu,
    boxe,
  };
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
    where: { studentId, isActive: true },
    include: { payments: true, modality: true },
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

describe('a conta do preço', () => {
  it('valor da modalidade, ou o padrão do plano', () => {
    const plano = {
      price: 150,
      modalityPrices: [{ modalityId: 'jj', price: 200 }],
    };
    expect(precoNaModalidade(plano, 'jj')).toBe(200);
    expect(precoNaModalidade(plano, 'mt')).toBe(150);
  });

  it('desconto arredonda para o centavo', () => {
    expect(comDesconto(150, 20)).toBe(120);
    expect(comDesconto(99.99, 15)).toBe(84.99);
    expect(comDesconto(150, 0)).toBe(150);
  });

  it('aluno novo paga cheio na mais cara; quem já faz outra ganha em todas', () => {
    expect(descontosDasMatriculas([150, 200, 100], 0, 20)).toEqual([20, 0, 20]);
    expect(descontosDasMatriculas([150], 0, 20)).toEqual([0]);
    expect(descontosDasMatriculas([150], 1, 20)).toEqual([20]);
    expect(descontosDasMatriculas([150, 200], 0, 0)).toEqual([0, 0]);
  });
});

describe('preço do plano por modalidade', () => {
  it('cada modalidade é cobrada pelo valor dela', async () => {
    const { data } = await cadastrar(a, [
      { modalityId: a.muayThai.id, planId: a.mensal.id },
    ]);
    const outro = await cadastrar(a, [
      { modalityId: a.jiuJitsu.id, planId: a.mensal.id },
    ]);

    const [mt] = await matriculasDe(data.id);
    const [jj] = await matriculasDe(outro.data.id);
    expect([mt?.price, Number(mt?.payments[0]?.amount)]).toEqual([150, 150]);
    expect([jj?.price, Number(jj?.payments[0]?.amount)]).toEqual([200, 200]);
  });

  it('editar sem mandar os valores por modalidade não apaga os que existem', async () => {
    await a.caller.plans.update({
      id: a.mensal.id,
      name: 'Mensal',
      price: '16000',
      duration: '1',
      billing: 'MONTHLY',
      isDefault: true,
    });

    const { data } = await a.caller.plans.getById({ id: a.mensal.id });
    expect(data.price).toBe(160);
    expect(data.modalityPrices.map((p) => [p.modality.name, p.price])).toEqual([
      ['Jiu-Jitsu', 200],
    ]);
  });

  it('mandar a lista regrava: vazio ou zero volta ao preço padrão', async () => {
    await a.caller.plans.update({
      id: a.mensal.id,
      name: 'Mensal',
      price: '15000',
      duration: '1',
      billing: 'MONTHLY',
      isDefault: true,
      modalityPrices: [
        { modalityId: a.jiuJitsu.id, price: '' },
        { modalityId: a.boxe.id, price: '12000' },
        { modalityId: a.muayThai.id, price: '0' },
      ],
    });

    const { data } = await a.caller.plans.getById({ id: a.mensal.id });
    expect(data.modalityPrices.map((p) => [p.modality.name, p.price])).toEqual([
      ['Boxe', 120],
    ]);
  });

  it('recusa valor para modalidade de outra academia', async () => {
    const b = await novaAcademia();
    await expect(
      a.caller.plans.update({
        id: a.mensal.id,
        name: 'Mensal',
        price: '15000',
        duration: '1',
        billing: 'MONTHLY',
        isDefault: true,
        modalityPrices: [{ modalityId: b.boxe.id, price: '9900' }],
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

describe('desconto a partir da 2ª modalidade', () => {
  beforeEach(async () => {
    await a.caller.plans.updatePricingSettings({ multiModalityDiscount: 20 });
  });

  it('aluno novo em duas: cheio na mais cara, desconto na outra', async () => {
    const { data } = await cadastrar(a, [
      { modalityId: a.muayThai.id, planId: a.mensal.id },
      { modalityId: a.jiuJitsu.id, planId: a.mensal.id },
    ]);

    const matriculas = await matriculasDe(data.id);
    expect(
      matriculas.map((m) => [
        m.modality.name,
        m.price,
        m.discountPercent,
        Number(m.payments[0]?.amount),
      ]),
    ).toEqual([
      ['Muay Thai', 120, 20, 120],
      ['Jiu-Jitsu', 200, 0, 200],
    ]);
  });

  it('matrícula em outra modalidade de quem já faz uma ganha desconto', async () => {
    const { data } = await cadastrar(a, [
      { modalityId: a.muayThai.id, planId: a.mensal.id },
    ]);
    await a.caller.student.addEnrollment({
      studentId: data.id,
      modalityId: a.jiuJitsu.id,
      planId: a.mensal.id,
    });

    const matriculas = await matriculasDe(data.id);
    expect(matriculas.map((m) => [m.modality.name, m.price])).toEqual([
      ['Muay Thai', 150],
      ['Jiu-Jitsu', 160],
    ]);
  });

  it('a troca de plano mantém quem tem desconto e quem paga cheio', async () => {
    const { data: trimestral } = await a.caller.plans.create({
      name: 'Trimestral',
      price: '42000',
      duration: '3',
      billing: 'MONTHLY',
      isDefault: false,
    });
    const { data } = await cadastrar(a, [
      { modalityId: a.muayThai.id, planId: a.mensal.id },
      { modalityId: a.jiuJitsu.id, planId: a.mensal.id },
    ]);
    const [mt, jj] = await matriculasDe(data.id);

    /* Troca o plano da que paga cheio: continua cheio. */
    await a.caller.student.changePlan({
      enrollmentId: jj!.id,
      planId: trimestral.id,
    });
    /* Troca o plano da que tem desconto: continua com desconto. */
    await a.caller.student.changePlan({
      enrollmentId: mt!.id,
      planId: trimestral.id,
    });

    const depois = await matriculasDe(data.id);
    expect(
      depois.map((m) => [m.modality.name, m.price, m.discountPercent]).sort(),
    ).toEqual([
      ['Jiu-Jitsu', 420, 0],
      ['Muay Thai', 336, 20],
    ]);
  });

  it('só o dono configura o desconto, entre 0 e 100', async () => {
    await expect(
      a.como(EUserRole.STAFF).plans.updatePricingSettings({
        multiModalityDiscount: 50,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    await expect(
      a.caller.plans.updatePricingSettings({ multiModalityDiscount: 101 }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    expect(await a.como(EUserRole.STAFF).plans.getPricingSettings()).toEqual({
      multiModalityDiscount: 20,
    });
  });
});

describe('o que já existe não muda', () => {
  it('mudar o preço do plano não mexe na matrícula nem nas parcelas', async () => {
    const { data } = await cadastrar(a, [
      { modalityId: a.muayThai.id, planId: a.mensal.id },
    ]);

    await a.caller.plans.update({
      id: a.mensal.id,
      name: 'Mensal',
      price: '19900',
      duration: '1',
      billing: 'MONTHLY',
      isDefault: true,
    });
    await a.caller.plans.updatePricingSettings({ multiModalityDiscount: 30 });

    const [mt] = await matriculasDe(data.id);
    expect([mt?.price, Number(mt?.payments[0]?.amount)]).toEqual([150, 150]);

    /* O MRR soma o que o aluno paga, não o preço novo do plano. */
    const { kpis } = await a.caller.dashboard.getOverview({});
    expect(kpis.mrr).toBeCloseTo(150);
  });

  it('plano em uso não é apagado (apagava as matrículas junto)', async () => {
    const { data } = await cadastrar(a, [
      { modalityId: a.boxe.id, planId: a.mensal.id },
    ]);

    await expect(
      a.caller.plans.delete({ id: a.mensal.id }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(await matriculasDe(data.id)).toHaveLength(1);
  });
});
