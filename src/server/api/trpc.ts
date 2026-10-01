/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1).
 * 2. You want to create a new middleware or type of procedure (see Part 3).
 *
 * TL;DR - This is where all the tRPC server stuff is created and plugged in. The pieces you will
 * need to use are documented accordingly near the end.
 */

import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { ZodError } from 'zod';

import { EUserRole } from '@prisma/client';

import { getServerAuthSession } from '@/server/auth';
import { prisma } from '@/server/db';

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 *
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 */
export const createTRPCContext = async (opts: { headers: Headers }) => {
  const session = await getServerAuthSession();

  return {
    prisma,
    session,
    ...opts,
  };
};

/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer. We also parse
 * ZodErrors so that you get typesafety on the frontend if your procedure fails due to validation
 * errors on the backend.
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/**
 * Create a server-side caller.
 *
 * @see https://trpc.io/docs/server/server-side-calls
 */
export const createCallerFactory = t.createCallerFactory;

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these a lot in the
 * "/src/server/api/routers" directory.
 */

/**
 * This is how you create new routers and sub-routers in your tRPC API.
 *
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/**
 * Middleware for timing procedure execution and adding an artificial delay in development.
 *
 * You can remove this if you don't like it, but it can help catch unwanted waterfalls by simulating
 * network latency that would occur in production but not in local development.
 */
const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();

  if (t._config.isDev) {
    // artificial delay in dev
    const waitMs = Math.floor(Math.random() * 400) + 100;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  const result = await next();

  const end = Date.now();
  console.log(`[TRPC] ${path} took ${end - start}ms to execute`);

  return result;
});

/**
 * Public (unauthenticated) procedure
 *
 * This is the base piece you use to build new queries and mutations on your tRPC API. It does not
 * guarantee that a user querying is authorized, but you can still access user session data if they
 * are logged in.
 */
export const publicProcedure = t.procedure.use(timingMiddleware);

/**
 * Protected (authenticated) procedure
 *
 * If you want a query or mutation to ONLY be accessible to logged in users, use this. It verifies
 * the session is valid and guarantees `ctx.session.user` is not null.
 *
 * @see https://trpc.io/docs/procedures
 */
export const protectedProcedure = t.procedure
  .use(timingMiddleware)
  .use(({ ctx, next }) => {
    if (!ctx.session || !ctx.session.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }

    /* O master em suporte não tem academia própria: a que vale é a que ele
       está visitando, e ela veio assinada no bilhete de entrada. */
    const { tenantId: tenantDaConta, supportTenantId } = ctx.session.user;
    const tenantId = tenantDaConta ?? supportTenantId ?? null;

    /* Dado é da academia, não de quem está logado: o recepcionista enxerga os
       mesmos alunos que o dono. Sem tenant na sessão não há o que consultar —
       é o caso do MASTER, que tem as rotas dele. */
    if (!tenantId) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Esta conta não pertence a nenhuma academia.',
      });
    }

    return next({
      ctx: {
        // infers the `session` as non-nullable
        session: { ...ctx.session, user: ctx.session.user },
        tenantId,
      },
    });
  });

/**
 * Quem pode o quê.
 *
 * MASTER entra em tudo porque é quem dá suporte. OWNER manda na academia.
 * STAFF é a recepção: aluno e dinheiro do dia a dia, sem mexer no que define
 * a academia. TEACHER é o professor: aluno e graduação, e só.
 */
const exigirPapel = (papeis: ReadonlyArray<EUserRole>) =>
  protectedProcedure.use(({ ctx, next }) => {
    const { role } = ctx.session.user;

    if (role !== EUserRole.MASTER && !papeis.includes(role)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Seu acesso não permite esta ação.',
      });
    }

    return next({ ctx });
  });

/** Define a academia: planos, cadastros, marca, equipe, WhatsApp. */
export const ownerProcedure = exigirPapel([EUserRole.OWNER]);

/** O dia a dia da recepção: aluno, matrícula, pagamento, lançamento. */
export const staffProcedure = exigirPapel([EUserRole.OWNER, EUserRole.STAFF]);

/** Tudo que o professor também faz: olhar aluno e registrar graduação. */
export const teacherProcedure = exigirPapel([
  EUserRole.OWNER,
  EUserRole.STAFF,
  EUserRole.TEACHER,
]);

/**
 * Procedure do dono do sistema: enxerga todas as academias e não pertence a
 * nenhuma. É o que sustenta o menu master.
 */
export const masterProcedure = t.procedure
  .use(timingMiddleware)
  .use(({ ctx, next }) => {
    if (!ctx.session?.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }

    if (ctx.session.user.role !== EUserRole.MASTER) {
      throw new TRPCError({ code: 'FORBIDDEN' });
    }

    return next({
      ctx: { session: { ...ctx.session, user: ctx.session.user } },
    });
  });
