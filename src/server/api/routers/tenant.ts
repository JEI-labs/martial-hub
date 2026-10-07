import {
  createTRPCRouter,
  ownerProcedure,
  protectedProcedure,
} from '@/server/api/trpc';
import { EUserRole } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { hash } from 'argon2';
import { z } from 'zod';

import { exigeDoisFatores } from '@/server/auth/twoFactor';
import {
  aplicarRegraDeCobranca,
  faseDaCobranca,
} from '@/server/billing/invoices';
import { ETenantInvoiceStatus } from '@prisma/client';

/** HSL cru, que é o formato das variáveis do tema: "9 60% 50%". */
const hslTriple = z
  .string()
  .regex(/^\d{1,3} \d{1,3}% \d{1,3}%$/, 'Cor inválida')
  .nullable();

export const tenantRouter = createTRPCRouter({
  /** A academia atual, com a marca e os endereços que levam até ela. */
  getCurrent: protectedProcedure.query(async ({ ctx }) => {
    const tenant = await ctx.prisma.tenant.findUnique({
      where: { id: ctx.tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        branding: {
          select: { logoUrl: true, loginImageUrl: true, primaryColor: true },
        },
        domains: {
          select: { hostname: true, isPrimary: true, verifiedAt: true },
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

    return tenant;
  }),

  /**
   * Nome e marca. Guardar null apaga o que havia: é assim que se volta ao
   * visual padrão do sistema sem precisar de um botão à parte.
   */
  saveBranding: ownerProcedure
    .input(
      z.object({
        name: z.string().min(2, 'Nome muito curto').max(80),
        logoUrl: z.string().url().nullable(),
        loginImageUrl: z.string().url().nullable(),
        primaryColor: hslTriple,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { tenantId } = ctx;

      await ctx.prisma.$transaction([
        ctx.prisma.tenant.update({
          where: { id: tenantId },
          data: { name: input.name },
        }),
        ctx.prisma.tenantBranding.upsert({
          where: { tenantId },
          create: {
            tenantId,
            logoUrl: input.logoUrl,
            loginImageUrl: input.loginImageUrl,
            primaryColor: input.primaryColor,
          },
          update: {
            logoUrl: input.logoUrl,
            loginImageUrl: input.loginImageUrl,
            primaryColor: input.primaryColor,
          },
        }),
      ]);

      return { ok: true };
    }),

  /** Quem tem acesso a esta academia. */
  listMembers: ownerProcedure.query(async ({ ctx }) => {
    const membros = await ctx.prisma.user.findMany({
      where: { tenantId: ctx.tenantId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        /* Só a data em que ligou: o segredo e os códigos de recuperação são
           de cada um, nem o dono da academia os vê. */
        twoFactorEnabledAt: true,
      },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });

    /* Qual é a situação de cada um sai daqui, não da tela: a regra de quem é
       obrigado a ter a segunda etapa é desta camada. */
    return membros.map(({ twoFactorEnabledAt, ...membro }) => ({
      ...membro,
      doisFatores: twoFactorEnabledAt
        ? ('ativo' as const)
        : exigeDoisFatores(membro.role)
          ? ('pendente' as const)
          : ('opcional' as const),
      doisFatoresDesde: twoFactorEnabledAt,
    }));
  }),

  /**
   * Cria o acesso de alguém da equipe. A senha é definida aqui e entregue à
   * pessoa — não há e-mail configurado no sistema, e inventar um fluxo de
   * convite por e-mail que ninguém recebe seria pior do que dizer a senha.
   */
  createMember: ownerProcedure
    .input(
      z.object({
        name: z.string().min(2, 'Nome muito curto').max(80),
        email: z.string().email('E-mail inválido'),
        password: z
          .string()
          .min(6, 'A senha precisa de pelo menos 6 letras')
          .max(72),
        role: z.nativeEnum(EUserRole).refine((r) => r !== EUserRole.MASTER, {
          message: 'Papel inválido',
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const email = input.email.toLowerCase();

      const jaExiste = await ctx.prisma.user.findFirst({
        where: { tenantId: ctx.tenantId, email },
      });

      if (jaExiste) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Já existe alguém com este e-mail na academia.',
        });
      }

      await ctx.prisma.user.create({
        data: {
          name: input.name,
          email,
          password: await hash(input.password),
          role: input.role,
          tenantId: ctx.tenantId,
        },
      });

      return { ok: true };
    }),

  /** Troca o papel de alguém. O dono não consegue rebaixar a si mesmo. */
  updateMemberRole: ownerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        role: z.nativeEnum(EUserRole).refine((r) => r !== EUserRole.MASTER, {
          message: 'Papel inválido',
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.id === ctx.session.user.id) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Você não pode mudar o seu próprio acesso.',
        });
      }

      const alvo = await ctx.prisma.user.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
      });

      if (!alvo) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Pessoa não encontrada',
        });
      }

      await ctx.prisma.user.update({
        where: { id: input.id },
        data: { role: input.role },
      });

      return { ok: true };
    }),

  /**
   * Tira o acesso. O que a pessoa cadastrou fica: `userId` é SET NULL, então
   * o aluno dela continua sendo aluno da academia.
   */
  removeMember: ownerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (input.id === ctx.session.user.id) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Você não pode remover o seu próprio acesso.',
        });
      }

      const alvo = await ctx.prisma.user.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
      });

      if (!alvo) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Pessoa não encontrada',
        });
      }

      /* Academia sem dono fica sem quem mexa em plano, marca e equipe. */
      if (alvo.role === EUserRole.OWNER) {
        const donos = await ctx.prisma.user.count({
          where: { tenantId: ctx.tenantId, role: EUserRole.OWNER },
        });

        if (donos <= 1) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'A academia precisa de pelo menos um dono.',
          });
        }
      }

      await ctx.prisma.user.delete({ where: { id: input.id } });
      return { ok: true };
    }),

  /**
   * A assinatura da academia com o dono do sistema: o que ela paga, o que
   * está em aberto e o que vence logo.
   *
   * Fica do lado do cliente de propósito. Cobrança que só existe no painel de
   * quem cobra vira surpresa de corte de acesso — e quem paga tem direito de
   * ver a própria conta.
   */
  getBilling: protectedProcedure.query(async ({ ctx }) => {
    await aplicarRegraDeCobranca();

    const [assinatura, faturas] = await Promise.all([
      ctx.prisma.tenantSubscription.findUnique({
        where: { tenantId: ctx.tenantId },
        select: { priceCents: true, billingDay: true, canceledAt: true },
      }),
      ctx.prisma.tenantInvoice.findMany({
        where: {
          tenantId: ctx.tenantId,
          status: { not: ETenantInvoiceStatus.CANCELED },
        },
        select: {
          id: true,
          amountCents: true,
          dueDate: true,
          paidAt: true,
          status: true,
        },
        orderBy: { dueDate: 'desc' },
        take: 12,
      }),
    ]);

    const emAberto = faturas.filter(
      (fatura) =>
        fatura.status === ETenantInvoiceStatus.OPEN ||
        fatura.status === ETenantInvoiceStatus.OVERDUE,
    );

    /* A mais urgente manda no aviso: a que já venceu há mais tempo, ou, se
       estiver tudo em dia, a próxima a vencer. */
    const maisUrgente = [...emAberto].sort(
      (a, b) => a.dueDate.getTime() - b.dueDate.getTime(),
    )[0];

    const regua = maisUrgente ? faseDaCobranca(maisUrgente.dueDate) : null;

    return {
      assinatura,
      faturas,
      aberto: {
        quantidade: emAberto.length,
        valor: emAberto.reduce((total, f) => total + f.amountCents, 0) / 100,
      },
      /* Fora da janela de aviso não há o que mostrar: fatura que vence daqui a
         vinte dias não precisa de tarja. */
      aviso:
        maisUrgente && regua && regua.fase !== 'em_dia'
          ? {
              fase: regua.fase,
              diasRestantes: regua.dias,
              diasParaBloqueio: regua.diasParaBloqueio,
              valor: maisUrgente.amountCents / 100,
              dueDate: maisUrgente.dueDate,
              atrasada: regua.dias < 0,
            }
          : null,
    };
  }),
});
