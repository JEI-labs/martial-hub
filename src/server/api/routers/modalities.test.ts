import { randomUUID } from 'node:crypto';

import { EUserRole } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

/* A sessão vem pronta no contexto de cada chamada; o next-auth não tem o que
   fazer aqui, e carregá-lo fora do Next só atrapalha. */
vi.mock('@/server/auth', () => ({ getServerAuthSession: vi.fn() }));

const { prisma } = await import('@/server/db');
const { createCallerFactory, createTRPCRouter } =
  await import('@/server/api/trpc');
const { modalitiesRouter } = await import('./modalities');

const createCaller = createCallerFactory(
  createTRPCRouter({ modalities: modalitiesRouter }),
);

/** Quem chama: um papel dentro de uma academia. */
const como = (tenantId: string, role: EUserRole = EUserRole.OWNER) =>
  createCaller({
    prisma,
    headers: new Headers(),
    session: {
      expires: new Date(Date.now() + 60_000).toISOString(),
      user: {
        id: randomUUID(),
        name: 'Teste',
        email: 'teste@teste.com',
        tenantId,
        role,
      },
    },
  }).modalities;

const novaAcademia = async () => {
  const slug = `t-${randomUUID().slice(0, 8)}`;
  const tenant = await prisma.tenant.create({
    data: { name: slug, slug },
  });
  return tenant.id;
};

const academias: Array<string> = [];

let a: string;
let b: string;

beforeEach(async () => {
  a = await novaAcademia();
  b = await novaAcademia();
  academias.push(a, b);
});

afterAll(async () => {
  /* Cascade: apagar a academia leva as modalidades junto. */
  await prisma.tenant.deleteMany({ where: { id: { in: academias } } });
  await prisma.$disconnect();
});

describe('isolamento entre academias', () => {
  it('a lista só traz as modalidades da própria academia', async () => {
    await como(a).create({ name: 'Boxe' });
    await como(b).create({ name: 'Judô' });

    const daA = await como(a).list();
    const daB = await como(b).list();

    expect(daA.map((m) => m.name)).toEqual(['Boxe']);
    expect(daB.map((m) => m.name)).toEqual(['Judô']);
    expect(daA.every((m) => m.tenantId === a)).toBe(true);
  });

  it('não edita modalidade de outra academia', async () => {
    const deB = await como(b).create({ name: 'Judô' });

    await expect(
      como(a).update({ id: deB.id, name: 'Invadido', isActive: true }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    const intacta = await prisma.modality.findUniqueOrThrow({
      where: { id: deB.id },
    });
    expect(intacta.name).toBe('Judô');
  });

  it('não apaga modalidade de outra academia', async () => {
    await como(b).create({ name: 'Judô' });
    const deB = await como(b).create({ name: 'Boxe' });

    await expect(como(a).remove({ id: deB.id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });

    expect(await prisma.modality.count({ where: { id: deB.id } })).toBe(1);
  });

  it('não reordena usando id de outra academia', async () => {
    const deA = await como(a).create({ name: 'Boxe' });
    const deB = await como(b).create({ name: 'Judô' });

    await expect(
      como(a).reorder({ ids: [deB.id, deA.id] }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    const intacta = await prisma.modality.findUniqueOrThrow({
      where: { id: deB.id },
    });
    expect(intacta.position).toBe(0);
  });

  it('o mesmo nome pode existir em academias diferentes', async () => {
    await como(a).create({ name: 'Boxe' });
    await expect(como(b).create({ name: 'Boxe' })).resolves.toBeDefined();
  });
});

describe('nome único', () => {
  it('maiúscula e acento não fazem outra modalidade', async () => {
    await como(a).create({ name: 'Karatê' });

    await expect(como(a).create({ name: 'karate' })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    await expect(como(a).create({ name: ' KARATÊ ' })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('renomear para o nome de outra é recusado', async () => {
    await como(a).create({ name: 'Boxe' });
    const judo = await como(a).create({ name: 'Judô' });

    await expect(
      como(a).update({ id: judo.id, name: 'boxe', isActive: true }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('renomear mudando só a grafia é permitido', async () => {
    const jj = await como(a).create({ name: 'jiu jitsu' });

    const renomeada = await como(a).update({
      id: jj.id,
      name: 'Jiu Jitsu',
      isActive: true,
    });
    expect(renomeada.name).toBe('Jiu Jitsu');
  });
});

describe('pelo menos uma ativa', () => {
  it('não desativa a última ativa', async () => {
    const boxe = await como(a).create({ name: 'Boxe' });

    await expect(
      como(a).update({ id: boxe.id, name: 'Boxe', isActive: false }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('não apaga a última ativa, mas apaga com outra ativa', async () => {
    const boxe = await como(a).create({ name: 'Boxe' });

    await expect(como(a).remove({ id: boxe.id })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });

    await como(a).create({ name: 'Judô' });
    await expect(como(a).remove({ id: boxe.id })).resolves.toEqual({
      ok: true,
    });
  });

  it('a ativa de outra academia não conta', async () => {
    const boxe = await como(a).create({ name: 'Boxe' });
    await como(b).create({ name: 'Judô' });

    await expect(
      como(a).update({ id: boxe.id, name: 'Boxe', isActive: false }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

describe('ordem', () => {
  it('a nova entra no fim, e reordenar grava a ordem recebida', async () => {
    const boxe = await como(a).create({ name: 'Boxe' });
    const judo = await como(a).create({ name: 'Judô' });
    const mma = await como(a).create({ name: 'MMA' });

    expect([boxe.position, judo.position, mma.position]).toEqual([0, 1, 2]);

    await como(a).reorder({ ids: [mma.id, boxe.id, judo.id] });

    const lista = await como(a).list();
    expect(lista.map((m) => m.name)).toEqual(['MMA', 'Boxe', 'Judô']);
  });

  it('lista incompleta é recusada', async () => {
    const boxe = await como(a).create({ name: 'Boxe' });
    await como(a).create({ name: 'Judô' });

    await expect(como(a).reorder({ ids: [boxe.id] })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });
});

describe('quem pode', () => {
  it('professor e recepção listam, mas não configuram', async () => {
    await como(a).create({ name: 'Boxe' });

    for (const role of [EUserRole.TEACHER, EUserRole.STAFF]) {
      await expect(como(a, role).list()).resolves.toHaveLength(1);
      await expect(
        como(a, role).create({ name: 'Judô' }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    }
  });
});
