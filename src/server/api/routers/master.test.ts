import { randomUUID } from 'node:crypto';

import { EUserRole } from '@prisma/client';
import { hash, verify } from 'argon2';
import { afterAll, describe, expect, it, vi } from 'vitest';

/* A sessão vem pronta no contexto de cada chamada; o next-auth não tem o que
   fazer aqui, e carregá-lo fora do Next só atrapalha. */
vi.mock('@/server/auth', () => ({ getServerAuthSession: vi.fn() }));
/* O roteador do master puxa módulos marcados como só-de-servidor. Fora do
   Next a marca não tem com quem conversar e só derrubaria o import. */
vi.mock('server-only', () => ({}));
/* Criar academia põe o endereço no ar. Num teste isso nunca pode chegar à
   Vercel nem ao DNS de verdade, esteja o .env como estiver. */
vi.mock('@/server/vercel/domains', () => ({
  vercelEnabled: () => false,
  addDomain: vi.fn(),
  domainStatus: vi.fn(),
  removeDomain: vi.fn(),
}));
vi.mock('@/server/dns/hostinger', () => ({
  dnsEnabled: () => false,
  nomeNaZona: () => null,
  apontarSubdominio: vi.fn(),
  removerSubdominio: vi.fn(),
}));

const { prisma } = await import('@/server/db');
const { createCallerFactory, createTRPCRouter } =
  await import('@/server/api/trpc');
const { masterRouter } = await import('./master');
const { securityRouter } = await import('./security');

const createCaller = createCallerFactory(
  createTRPCRouter({ master: masterRouter, security: securityRouter }),
);

const criados: Array<string> = [];
const academiasCriadas: Array<string> = [];

/** Uma conta master no banco, do jeito que o teste precisar. */
const novoMaster = async (
  dados: {
    mustChangePassword?: boolean;
    twoFactorEnabledAt?: Date | null;
    role?: EUserRole;
    password?: string;
  } = {},
) => {
  const user = await prisma.user.create({
    data: {
      name: 'Master de teste',
      email: `m-${randomUUID().slice(0, 8)}@teste.com`,
      password: dados.password ?? 'nao-usada',
      role: dados.role ?? EUserRole.MASTER,
      mustChangePassword: dados.mustChangePassword ?? false,
      twoFactorEnabledAt:
        dados.twoFactorEnabledAt === undefined
          ? new Date()
          : dados.twoFactorEnabledAt,
    },
  });
  criados.push(user.id);
  return user;
};

/** Quem chama: a sessão diz MASTER, o banco diz o resto. */
const como = (user: { id: string; email: string }) =>
  createCaller({
    prisma,
    headers: new Headers(),
    session: {
      expires: new Date(Date.now() + 60_000).toISOString(),
      user: {
        id: user.id,
        name: 'Teste',
        email: user.email,
        tenantId: null,
        role: EUserRole.MASTER,
      },
    },
  });

afterAll(async () => {
  /* A academia leva junto dono, modalidades e o resto, em cascata. */
  await prisma.tenant.deleteMany({ where: { slug: { in: academiasCriadas } } });
  await prisma.user.deleteMany({ where: { id: { in: criados } } });
  await prisma.user.deleteMany({
    where: { tenantId: null, email: { endsWith: '@novo-master.com' } },
  });
  await prisma.$disconnect();
});

describe('createTenant escolhe as modalidades', () => {
  /** Cria uma academia com o que o teste disser de modalidade. */
  const criarAcademia = async (modalities?: Array<string>) => {
    const eu = await novoMaster();
    const slug = `t-${randomUUID().slice(0, 8)}`;
    academiasCriadas.push(slug);

    const resultado = await como(eu).master.createTenant({
      name: 'Academia de teste',
      slug,
      priceCents: 14900,
      billingDay: 10,
      ownerName: 'Dono de teste',
      ownerEmail: `dono-${slug}@teste.com`,
      ownerPassword: 'segredo-123',
      ...(modalities ? { modalities } : {}),
    });

    const modalidades = await prisma.modality.findMany({
      where: { tenantId: resultado.id },
      orderBy: { position: 'asc' },
      select: { name: true, slug: true, isActive: true, position: true },
    });

    return { slug, modalidades };
  };

  it('cria as escolhidas, ativas e na ordem mostrada', async () => {
    const { modalidades } = await criarAcademia([
      'Muay Thai',
      'Jiu-Jitsu',
      'Karatê',
    ]);

    expect(modalidades).toEqual([
      { name: 'Muay Thai', slug: 'muay-thai', isActive: true, position: 0 },
      { name: 'Jiu-Jitsu', slug: 'jiu-jitsu', isActive: true, position: 1 },
      { name: 'Karatê', slug: 'karate', isActive: true, position: 2 },
    ]);
  });

  it('cada modalidade nasce com as faixas do catálogo, boxe sem', async () => {
    const { slug } = await criarAcademia(['Muay Thai', 'Jiu-Jitsu', 'Boxe']);

    const faixas = await prisma.modality.findMany({
      where: { tenant: { slug } },
      orderBy: { position: 'asc' },
      select: { slug: true, _count: { select: { graduations: true } } },
    });

    expect(faixas.map((m) => [m.slug, m._count.graduations])).toEqual([
      ['muay-thai', 11],
      ['jiu-jitsu', 20],
      ['boxe', 0],
    ]);
  });

  it('sem nenhuma escolhida, nasce com as modalidades pendentes', async () => {
    for (const escolha of [undefined, []]) {
      const { modalidades } = await criarAcademia(escolha);

      expect(modalidades).toEqual([]);
    }
  });

  it('nome repetido vira um só, em vez de derrubar a criação', async () => {
    const { modalidades } = await criarAcademia(['Boxe', ' boxe ', 'MMA']);

    expect(modalidades.map((m) => [m.name, m.position])).toEqual([
      ['Boxe', 0],
      ['MMA', 1],
    ]);
  });

  it('modalidade inválida não deixa academia pela metade', async () => {
    const eu = await novoMaster();
    const slug = `t-${randomUUID().slice(0, 8)}`;
    academiasCriadas.push(slug);

    await expect(
      como(eu).master.createTenant({
        name: 'Academia de teste',
        slug,
        priceCents: 14900,
        billingDay: 10,
        ownerName: 'Dono de teste',
        ownerEmail: `dono-${slug}@teste.com`,
        ownerPassword: 'segredo-123',
        modalities: ['Boxe', 'x'.repeat(51)],
      }),
    ).rejects.toThrow();

    expect(await prisma.tenant.findUnique({ where: { slug } })).toBeNull();
  });
});

describe('createMaster', () => {
  it('cria master com senha temporária que precisa ser trocada', async () => {
    const eu = await novoMaster();
    const email = `Fulano-${randomUUID().slice(0, 6)}@Novo-Master.com`;

    const resultado = await como(eu).master.createMaster({
      name: 'Fulano',
      email,
    });

    expect(resultado.email).toBe(email.toLowerCase());
    expect(resultado.senhaTemporaria).toMatch(
      /^[A-Za-z2-9]{4}-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/,
    );

    const criado = await prisma.user.findFirstOrThrow({
      where: { email: email.toLowerCase(), tenantId: null },
    });

    expect(criado.role).toBe(EUserRole.MASTER);
    expect(criado.mustChangePassword).toBe(true);
    expect(criado.twoFactorEnabledAt).toBeNull();
    /* No banco só o hash, e é o hash da senha que foi devolvida. */
    expect(criado.password).not.toBe(resultado.senhaTemporaria);
    expect(await verify(criado.password, resultado.senhaTemporaria)).toBe(true);
  });

  it('recusa e-mail que já é de outro master, sem olhar maiúsculas', async () => {
    const eu = await novoMaster();
    const email = `dup-${randomUUID().slice(0, 6)}@novo-master.com`;

    await como(eu).master.createMaster({ name: 'Primeiro', email });

    await expect(
      como(eu).master.createMaster({
        name: 'Segundo',
        email: email.toUpperCase(),
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('aparece na lista como aguardando o primeiro acesso', async () => {
    const eu = await novoMaster();
    const email = `lista-${randomUUID().slice(0, 6)}@novo-master.com`;

    await como(eu).master.createMaster({ name: 'Na lista', email });

    const lista = await como(eu).master.listMasters();
    const novo = lista.find((m) => m.email === email);

    expect(novo?.primeiroAcessoPendente).toBe(true);
    expect(novo?.doisFatores).toBe('pendente');
    expect(lista.find((m) => m.id === eu.id)?.primeiroAcessoPendente).toBe(
      false,
    );
  });
});

describe('o master só usa o painel depois de trocar a senha e ligar o 2FA', () => {
  it('barra quem ainda está com a senha temporária', async () => {
    const pendente = await novoMaster({
      mustChangePassword: true,
      twoFactorEnabledAt: null,
    });

    await expect(como(pendente).master.listMasters()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(
      como(pendente).master.createMaster({
        name: 'Escalada',
        email: `esc-${randomUUID().slice(0, 6)}@novo-master.com`,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('barra quem trocou a senha mas não ligou a segunda etapa', async () => {
    const sem2fa = await novoMaster({ twoFactorEnabledAt: null });

    await expect(como(sem2fa).master.listMasters()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('barra sessão de master cuja conta deixou de ser master', async () => {
    const rebaixado = await novoMaster({ role: EUserRole.OWNER });

    await expect(como(rebaixado).master.listMasters()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('a tela de segurança continua aberta para quem está pendente', async () => {
    const pendente = await novoMaster({
      mustChangePassword: true,
      twoFactorEnabledAt: null,
    });

    const status = await como(pendente).security.status();

    expect(status.trocarSenha).toBe(true);
    expect(status.ativo).toBe(false);
    expect(status.obrigatorio).toBe(true);
  });
});

describe('setInitialPassword', () => {
  it('troca a temporária e libera a trava', async () => {
    const pendente = await novoMaster({
      mustChangePassword: true,
      password: await hash('Temp-0000-0000'),
    });

    await como(pendente).security.setInitialPassword({
      nova: 'uma senha so minha',
    });

    const depois = await prisma.user.findUniqueOrThrow({
      where: { id: pendente.id },
    });

    expect(depois.mustChangePassword).toBe(false);
    expect(await verify(depois.password, 'uma senha so minha')).toBe(true);
  });

  it('não aceita manter a senha temporária', async () => {
    const pendente = await novoMaster({
      mustChangePassword: true,
      password: await hash('Temp-1111-1111'),
    });

    await expect(
      como(pendente).security.setInitialPassword({ nova: 'Temp-1111-1111' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    const depois = await prisma.user.findUniqueOrThrow({
      where: { id: pendente.id },
    });
    expect(depois.mustChangePassword).toBe(true);
  });

  it('não serve para trocar senha sem a atual depois do primeiro acesso', async () => {
    const normal = await novoMaster({ password: await hash('senha-antiga') });

    await expect(
      como(normal).security.setInitialPassword({ nova: 'senha-nova-123' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    const depois = await prisma.user.findUniqueOrThrow({
      where: { id: normal.id },
    });
    expect(await verify(depois.password, 'senha-antiga')).toBe(true);
  });
});
