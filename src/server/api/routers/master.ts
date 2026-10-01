import { createTRPCRouter, masterProcedure } from '@/server/api/trpc';
import {
  ECategoryStatus,
  ETenantInvoiceStatus,
  ETenantStatus,
  EUserRole,
  Prisma,
} from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { hash } from 'argon2';
import { z } from 'zod';

import { env } from '@/env';
import {
  addDomain,
  domainStatus,
  removeDomain,
  vercelEnabled,
} from '@/server/vercel/domains';
import { criarBilheteDeSuporte } from '@/server/support/handoff';

const CENTS = 100;

/** Slug vira subdomínio, então o alfabeto é o da URL. */
const slugSchema = z
  .string()
  .min(2)
  .max(40)
  .regex(
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/,
    'Use letras minúsculas, números e hífen',
  );

const hostnameSchema = z
  .string()
  .min(4)
  .max(190)
  .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, 'Domínio inválido')
  .transform((valor) =>
    valor
      .trim()
      .toLowerCase()
      .replace(/^www\./, ''),
  );

/** Quanto cada academia paga por mês, somando só quem está valendo. */
const ASSINATURAS_ATIVAS: Prisma.TenantSubscriptionWhereInput = {
  canceledAt: null,
  tenant: { status: { in: [ETenantStatus.ACTIVE, ETenantStatus.TRIAL] } },
};

export const masterRouter = createTRPCRouter({
  /** Os números do negócio: receita recorrente, clientes e inadimplência. */
  overview: masterProcedure.query(async ({ ctx }) => {
    const [tenants, assinaturas, faturas, alunos] = await Promise.all([
      ctx.prisma.tenant.groupBy({ by: ['status'], _count: true }),
      ctx.prisma.tenantSubscription.aggregate({
        where: ASSINATURAS_ATIVAS,
        _sum: { priceCents: true },
        _count: true,
      }),
      ctx.prisma.tenantInvoice.groupBy({
        by: ['status'],
        _count: true,
        _sum: { amountCents: true },
      }),
      ctx.prisma.student.count(),
    ]);

    const porStatus = Object.fromEntries(
      tenants.map((linha) => [linha.status, linha._count]),
    ) as Record<ETenantStatus, number | undefined>;

    const porFatura = Object.fromEntries(
      faturas.map((linha) => [
        linha.status,
        {
          quantidade: linha._count,
          valor: (linha._sum.amountCents ?? 0) / CENTS,
        },
      ]),
    ) as Record<
      ETenantInvoiceStatus,
      { quantidade: number; valor: number } | undefined
    >;

    const mrr = (assinaturas._sum.priceCents ?? 0) / CENTS;

    return {
      mrr,
      arr: mrr * 12,
      assinaturas: assinaturas._count,
      clientes: {
        ativos: porStatus.ACTIVE ?? 0,
        teste: porStatus.TRIAL ?? 0,
        suspensos: porStatus.SUSPENDED ?? 0,
        cancelados: porStatus.CANCELED ?? 0,
      },
      faturas: {
        abertas: porFatura.OPEN ?? { quantidade: 0, valor: 0 },
        atrasadas: porFatura.OVERDUE ?? { quantidade: 0, valor: 0 },
        pagas: porFatura.PAID ?? { quantidade: 0, valor: 0 },
      },
      alunosNoSistema: alunos,
    };
  }),

  listTenants: masterProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
          status: z.nativeEnum(ETenantStatus).optional(),
        })
        .default({}),
    )
    .query(async ({ ctx, input }) => {
      const tenants = await ctx.prisma.tenant.findMany({
        where: {
          ...(input.status ? { status: input.status } : {}),
          ...(input.search
            ? {
                OR: [
                  { name: { contains: input.search, mode: 'insensitive' } },
                  { slug: { contains: input.search, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          createdAt: true,
          subscription: { select: { priceCents: true, billingDay: true } },
          domains: {
            select: { hostname: true, isPrimary: true, verifiedAt: true },
          },
          _count: { select: { students: true, users: true } },
          invoices: {
            where: {
              status: {
                in: [ETenantInvoiceStatus.OPEN, ETenantInvoiceStatus.OVERDUE],
              },
            },
            select: {
              id: true,
              amountCents: true,
              dueDate: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return tenants.map((tenant) => ({
        ...tenant,
        mensalidade: (tenant.subscription?.priceCents ?? 0) / CENTS,
        emAberto:
          tenant.invoices.reduce(
            (total, fatura) => total + fatura.amountCents,
            0,
          ) / CENTS,
      }));
    }),

  getTenant: masterProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const tenant = await ctx.prisma.tenant.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          createdAt: true,
          subscription: true,
          branding: { select: { primaryColor: true, logoUrl: true } },
          domains: { orderBy: { isPrimary: 'desc' } },
          users: {
            select: { id: true, name: true, email: true, role: true },
            orderBy: { role: 'asc' },
          },
          invoices: { orderBy: { dueDate: 'desc' }, take: 24 },
          _count: { select: { students: true } },
        },
      });

      if (!tenant) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Academia não encontrada',
        });
      }

      return { ...tenant, vercelConfigurada: vercelEnabled() };
    }),

  /**
   * Nasce pronta para usar: academia, endereço, assinatura, dono e a
   * categoria fixa que recebe as mensalidades — sem ela, matricular aluno
   * quebra no primeiro pagamento.
   */
  createTenant: masterProcedure
    .input(
      z.object({
        name: z.string().min(2).max(80),
        slug: slugSchema,
        priceCents: z.number().int().min(0),
        billingDay: z.number().int().min(1).max(28),
        status: z.nativeEnum(ETenantStatus).default(ETenantStatus.TRIAL),
        ownerName: z.string().min(2).max(80),
        ownerEmail: z.string().email(),
        ownerPassword: z.string().min(6),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existe = await ctx.prisma.tenant.findUnique({
        where: { slug: input.slug },
      });
      if (existe) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Já existe uma academia com este endereço.',
        });
      }

      const senha = await hash(input.ownerPassword);
      const hostname = env.ROOT_DOMAIN
        ? `${input.slug}.${env.ROOT_DOMAIN}`
        : null;

      const tenant = await ctx.prisma.$transaction(async (tx) => {
        const criado = await tx.tenant.create({
          data: {
            name: input.name,
            slug: input.slug,
            status: input.status,
            subscription: {
              create: {
                priceCents: input.priceCents,
                billingDay: input.billingDay,
              },
            },
            users: {
              create: {
                name: input.ownerName,
                email: input.ownerEmail.toLowerCase(),
                password: senha,
                role: EUserRole.OWNER,
              },
            },
            categories: {
              create: {
                name: 'Alunos',
                description: 'Mensalidades dos alunos',
                status: ECategoryStatus.ACTIVE,
                isFixed: true,
              },
            },
            ...(hostname
              ? {
                  domains: {
                    create: {
                      hostname,
                      isPrimary: true,
                      verifiedAt: new Date(),
                    },
                  },
                }
              : {}),
          },
          select: { id: true, slug: true },
        });

        return criado;
      });

      return { ok: true, id: tenant.id, hostname };
    }),

  updateTenant: masterProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(2).max(80).optional(),
        status: z.nativeEnum(ETenantStatus).optional(),
        priceCents: z.number().int().min(0).optional(),
        billingDay: z.number().int().min(1).max(28).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, priceCents, billingDay, ...dados } = input;

      await ctx.prisma.tenant.update({ where: { id }, data: dados });

      if (priceCents !== undefined || billingDay !== undefined) {
        await ctx.prisma.tenantSubscription.upsert({
          where: { tenantId: id },
          create: {
            tenantId: id,
            priceCents: priceCents ?? 0,
            billingDay: billingDay ?? 10,
          },
          update: {
            ...(priceCents !== undefined ? { priceCents } : {}),
            ...(billingDay !== undefined ? { billingDay } : {}),
          },
        });
      }

      return { ok: true };
    }),

  /* ------------------------------------------------------------ domínios */

  addDomain: masterProcedure
    .input(z.object({ tenantId: z.string().uuid(), hostname: hostnameSchema }))
    .mutation(async ({ ctx, input }) => {
      const emUso = await ctx.prisma.tenantDomain.findUnique({
        where: { hostname: input.hostname },
      });

      if (emUso) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Este domínio já está apontando para alguma academia.',
        });
      }

      const naVercel = vercelEnabled() ? await addDomain(input.hostname) : null;

      await ctx.prisma.tenantDomain.create({
        data: { hostname: input.hostname, tenantId: input.tenantId },
      });

      return {
        ok: true,
        vercel: naVercel?.ok ?? false,
        erro: naVercel && !naVercel.ok ? naVercel.error : null,
      };
    }),

  /** Pergunta à Vercel em que pé está o DNS do cliente. */
  checkDomain: masterProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const dominio = await ctx.prisma.tenantDomain.findUnique({
        where: { id: input.id },
      });

      if (!dominio) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Domínio não encontrado',
        });
      }

      if (!vercelEnabled()) {
        return {
          registrado: false,
          dnsOk: false,
          instrucao: null,
          erro: 'Integração com a Vercel não configurada.',
        };
      }

      const estado = await domainStatus(dominio.hostname);

      await ctx.prisma.tenantDomain.update({
        where: { id: dominio.id },
        data: { verifiedAt: estado.dnsOk ? new Date() : null },
      });

      return estado;
    }),

  removeDomain: masterProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const dominio = await ctx.prisma.tenantDomain.findUnique({
        where: { id: input.id },
      });

      if (!dominio) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Domínio não encontrado',
        });
      }

      if (vercelEnabled()) await removeDomain(dominio.hostname);
      await ctx.prisma.tenantDomain.delete({ where: { id: input.id } });

      return { ok: true };
    }),

  /* -------------------------------------------------------------- faturas */

  listInvoices: masterProcedure
    .input(
      z
        .object({
          status: z.nativeEnum(ETenantInvoiceStatus).optional(),
          tenantId: z.string().uuid().optional(),
        })
        .default({}),
    )
    .query(async ({ ctx, input }) => {
      return ctx.prisma.tenantInvoice.findMany({
        where: {
          ...(input.status ? { status: input.status } : {}),
          ...(input.tenantId ? { tenantId: input.tenantId } : {}),
        },
        select: {
          id: true,
          amountCents: true,
          dueDate: true,
          paidAt: true,
          status: true,
          notes: true,
          tenant: { select: { id: true, name: true, slug: true } },
        },
        orderBy: [{ status: 'asc' }, { dueDate: 'desc' }],
        take: 200,
      });
    }),

  /**
   * Gera a fatura do mês para cada assinatura valendo. Pula quem já tem a
   * fatura daquele mês — rodar duas vezes não cobra duas vezes.
   */
  generateInvoices: masterProcedure
    .input(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }))
    .mutation(async ({ ctx, input }) => {
      const [ano, mes] = input.month.split('-').map(Number) as [number, number];

      const assinaturas = await ctx.prisma.tenantSubscription.findMany({
        where: ASSINATURAS_ATIVAS,
        select: { tenantId: true, priceCents: true, billingDay: true },
      });

      const inicio = new Date(ano, mes - 1, 1);
      const fim = new Date(ano, mes, 1);

      const existentes = await ctx.prisma.tenantInvoice.findMany({
        where: { dueDate: { gte: inicio, lt: fim } },
        select: { tenantId: true },
      });
      const jaTem = new Set(existentes.map((fatura) => fatura.tenantId));

      const novas = assinaturas
        .filter(
          (assinatura) =>
            !jaTem.has(assinatura.tenantId) && assinatura.priceCents > 0,
        )
        .map((assinatura) => ({
          tenantId: assinatura.tenantId,
          amountCents: assinatura.priceCents,
          dueDate: new Date(ano, mes - 1, assinatura.billingDay),
        }));

      if (novas.length > 0) {
        await ctx.prisma.tenantInvoice.createMany({ data: novas });
      }

      return { ok: true, criadas: novas.length, puladas: jaTem.size };
    }),

  updateInvoice: masterProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.nativeEnum(ETenantInvoiceStatus),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.tenantInvoice.update({
        where: { id: input.id },
        data: {
          status: input.status,
          paidAt:
            input.status === ETenantInvoiceStatus.PAID ? new Date() : null,
        },
      });

      return { ok: true };
    }),

  /** Marca como atrasada toda fatura em aberto que passou do vencimento. */
  refreshOverdue: masterProcedure.mutation(async ({ ctx }) => {
    const resultado = await ctx.prisma.tenantInvoice.updateMany({
      where: { status: ETenantInvoiceStatus.OPEN, dueDate: { lt: new Date() } },
      data: { status: ETenantInvoiceStatus.OVERDUE },
    });

    return { ok: true, atualizadas: resultado.count };
  }),

  /**
   * Entrada de suporte: devolve o endereço da academia já com o bilhete.
   *
   * O bilhete vale um minuto e a sessão que nasce dele continua sendo a do
   * master — ninguém vira o dono da academia. Quem entrou e quando fica
   * gravado do outro lado, quando o bilhete é trocado.
   */
  supportLink: masterProcedure
    .input(z.object({ tenantId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const tenant = await ctx.prisma.tenant.findUnique({
        where: { id: input.tenantId },
        select: {
          id: true,
          slug: true,
          domains: {
            select: { hostname: true, isPrimary: true },
            orderBy: { isPrimary: 'desc' },
          },
        },
      });

      if (!tenant) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Academia não encontrada',
        });
      }

      const host =
        tenant.domains[0]?.hostname ??
        (env.ROOT_DOMAIN ? `${tenant.slug}.${env.ROOT_DOMAIN}` : null);

      if (!host) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Esta academia ainda não tem endereço cadastrado.',
        });
      }

      const bilhete = await criarBilheteDeSuporte(
        ctx.session.user.id,
        tenant.id,
      );

      return {
        url: `/suporte/entrar?token=${encodeURIComponent(bilhete)}`,
        host,
      };
    }),
});
