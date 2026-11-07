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
const { graduationsRouter } = await import('./graduations');
const { studentRouter } = await import('./students');

const createCaller = createCallerFactory(
  createTRPCRouter({
    modalities: modalitiesRouter,
    graduations: graduationsRouter,
    student: studentRouter,
  }),
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
  });

const novaAcademia = async () => {
  const slug = `t-${randomUUID().slice(0, 8)}`;
  const tenant = await prisma.tenant.create({ data: { name: slug, slug } });
  return tenant.id;
};

/** Um aluno, com a faixa (no histórico) se o teste pedir. */
const novoAluno = async (
  tenantId: string,
  graduationId: string | null = null,
) => {
  const aluno = await prisma.student.create({
    data: {
      name: 'Aluno de teste',
      email: `a-${randomUUID().slice(0, 8)}@teste.com`,
      phone: '11999999999',
      tenantId,
    },
  });
  if (graduationId) {
    await prisma.studentGraduation.create({
      data: { studentId: aluno.id, graduationId },
    });
  }
  return aluno;
};

const faixasDe = (modalityId: string) =>
  prisma.graduation.findMany({
    where: { modalityId },
    orderBy: { position: 'asc' },
    select: { name: true, level: true, colors: true, position: true },
  });

const academias: Array<string> = [];

let a: string;
let b: string;

beforeEach(async () => {
  a = await novaAcademia();
  b = await novaAcademia();
  academias.push(a, b);
});

afterAll(async () => {
  /* Cascade: a academia leva modalidades, faixas e alunos junto — e isso
     precisa funcionar mesmo com aluno apontando para faixa (NO ACTION). */
  await prisma.tenant.deleteMany({ where: { id: { in: academias } } });
  await prisma.$disconnect();
});

describe('catálogo pré-cadastrado', () => {
  it('Muay Thai nasce com as 11 faixas de sempre: nome, nível e cores', async () => {
    const mt = await como(a).modalities.create({ name: 'Muay Thai' });

    /* As faixas como eram no enum EGraduation, antes de virarem dado. Se o
       catálogo mudar por engano, é aqui que quebra. */
    expect(await faixasDe(mt.id)).toEqual(
      [
        ['Branco', 'Iniciante', ['#ffffff']],
        ['Vermelho e Branco', 'Iniciante', ['#ffffff', '#e11d1d']],
        ['Vermelho', 'Iniciante', ['#e11d1d']],
        ['Vermelho e Azul Claro', 'Intermediário', ['#e11d1d', '#22a3e0']],
        ['Azul Claro', 'Intermediário', ['#22a3e0']],
        ['Azul Claro e Azul Escuro', 'Intermediário', ['#22a3e0', '#1414c8']],
        ['Azul Escuro', 'Instrutor Auxiliar', ['#1414c8']],
        ['Azul Escuro e Preto', 'Instrutor', ['#1414c8', '#111111']],
        ['Preto', 'Professor', ['#111111']],
        ['Preto e Branco', 'Mestre', ['#111111', '#ffffff']],
        [
          'Preto, Branco e Vermelho',
          'Grão-Mestre',
          ['#111111', '#ffffff', '#e11d1d'],
        ],
      ].map(([name, level, colors], position) => ({
        name,
        level,
        colors,
        position,
      })),
    );
  });

  it('acha o catálogo pelo slug: "KARATÊ" recebe as faixas do karatê', async () => {
    const karate = await como(a).modalities.create({ name: 'KARATÊ' });
    const faixas = await faixasDe(karate.id);

    expect(faixas.map((f) => f.name)).toEqual([
      'Branca',
      'Amarela',
      'Vermelha',
      'Laranja',
      'Verde',
      'Roxa',
      'Marrom',
      'Preta',
    ]);
  });

  it('jiu-jitsu tem infantil e adulto, em ordem', async () => {
    const jj = await como(a).modalities.create({ name: 'Jiu-Jitsu' });
    const faixas = await faixasDe(jj.id);

    expect(faixas).toHaveLength(20);
    expect(faixas.map((f) => f.position)).toEqual(
      Array.from({ length: 20 }, (_, i) => i),
    );
    expect(faixas.find((f) => f.name === 'Cinza')?.level).toBe('Infantil');
    expect(faixas.find((f) => f.name === 'Roxa')?.level).toBe('Adulto');
  });

  it('boxe e nomes livres nascem sem faixa', async () => {
    for (const name of ['Boxe', 'Muay Thai Kids']) {
      const modalidade = await como(a).modalities.create({ name });
      expect(await faixasDe(modalidade.id)).toEqual([]);
    }
  });
});

describe('graduations.list', () => {
  it('só modalidades ativas, na ordem da academia, faixas em ordem', async () => {
    await como(a).modalities.create({ name: 'Boxe' });
    const judo = await como(a).modalities.create({ name: 'Judô' });
    const mt = await como(a).modalities.create({ name: 'Muay Thai' });
    await como(a).modalities.update({
      id: mt.id,
      name: 'Muay Thai',
      isActive: false,
    });

    const lista = await como(a, EUserRole.TEACHER).graduations.list();

    expect(lista.map((m) => [m.name, m.graduations.length])).toEqual([
      ['Boxe', 0],
      ['Judô', 9],
    ]);
    expect(lista[1]?.id).toBe(judo.id);
    expect(lista[1]?.graduations[0]?.name).toBe('Branca');
  });

  it('não mostra a modalidade de outra academia', async () => {
    await como(b).modalities.create({ name: 'Muay Thai' });
    expect(await como(a).graduations.list()).toEqual([]);
  });
});

describe('a faixa do aluno', () => {
  it('editar o aluno não mexe no histórico de graduação', async () => {
    const mt = await como(a).modalities.create({ name: 'Muay Thai' });
    const faixa = await prisma.graduation.findFirst({
      where: { modalityId: mt.id, position: 3 },
    });
    const aluno = await novoAluno(a, faixa!.id);

    /* É o que o formulário de edição manda: os dados da pessoa. */
    await como(a).student.updateByID({
      id: aluno.id,
      name: 'Nome novo',
      email: aluno.email,
      phone: aluno.phone,
      avatarUrl: null,
      birthDate: '01/01/2000',
    });

    const historico = await prisma.studentGraduation.findMany({
      where: { studentId: aluno.id },
    });
    expect(historico.map((r) => r.graduationId)).toEqual([faixa!.id]);
  });
});

describe('apagar modalidade com faixa em uso', () => {
  it('é recusado enquanto algum aluno tem faixa dela', async () => {
    const mt = await como(a).modalities.create({ name: 'Muay Thai' });
    await como(a).modalities.create({ name: 'Boxe' });
    const faixa = await prisma.graduation.findFirst({
      where: { modalityId: mt.id },
    });
    const aluno = await novoAluno(a, faixa!.id);

    await expect(
      como(a).modalities.remove({ id: mt.id }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    /* Sem ninguém graduado nela, apaga — e as faixas vão junto. */
    await prisma.studentGraduation.deleteMany({
      where: { studentId: aluno.id },
    });
    await como(a).modalities.remove({ id: mt.id });

    expect(
      await prisma.graduation.count({ where: { modalityId: mt.id } }),
    ).toBe(0);
  });

  it('o banco também recusa apagar faixa em uso por fora do sistema', async () => {
    const mt = await como(a).modalities.create({ name: 'Muay Thai' });
    const faixa = await prisma.graduation.findFirst({
      where: { modalityId: mt.id },
    });
    await novoAluno(a, faixa!.id);

    await expect(
      prisma.graduation.delete({ where: { id: faixa!.id } }),
    ).rejects.toThrow();
  });
});
