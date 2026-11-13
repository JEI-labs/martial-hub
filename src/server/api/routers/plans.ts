import {
  createTRPCRouter,
  protectedProcedure,
  ownerProcedure,
} from '@/server/api/trpc';
import {
  createPlanSchema,
  pricingSettingsSchema,
  updatePlanSchema,
  type IModalityPriceInput,
} from '@/server/validations/plans';
import { Prisma } from '@prisma/client';
import { descontoDaAcademia } from '@/server/enrollments';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

/** Valor de modalidade para mostrar e editar o plano. */
const modalityPricesInclude = {
  modalityPrices: {
    select: {
      modalityId: true,
      price: true,
      modality: { select: { name: true } },
    },
  },
} satisfies Prisma.PlanInclude;

/**
 * Regrava os valores por modalidade do plano, só das modalidades que vieram
 * na lista: com valor, ficam; vazias, voltam ao preço padrão. As que não
 * vieram não mudam — o formulário não mostra, por exemplo, modalidade
 * desativada sem valor, e apagar tudo que não veio levava junto o valor
 * dela. Confere que as modalidades são desta academia: o id chega do
 * navegador.
 */
async function gravarPrecosPorModalidade(
  tx: Prisma.TransactionClient,
  tenantId: string,
  planId: string,
  lista: Array<IModalityPriceInput>,
) {
  if (lista.length === 0) return;

  const ids = lista.map((item) => item.modalityId);
  const daAcademia = await tx.modality.count({
    where: { tenantId, id: { in: ids } },
  });
  if (daAcademia !== ids.length) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Modalidade não encontrada nesta academia.',
    });
  }

  const comValor = lista
    .map((item) => ({
      modalityId: item.modalityId,
      price: Number(item.price || '0') / 100,
    }))
    .filter((item) => item.price > 0);

  await tx.planModalityPrice.deleteMany({
    where: { planId, modalityId: { in: ids } },
  });
  await tx.planModalityPrice.createMany({
    data: comValor.map((item) => ({ ...item, planId })),
  });
}

export const plansRouter = createTRPCRouter({
  create: ownerProcedure
    .input(createPlanSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { tenantId } = ctx;
      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Não autorizado',
        });
      }

      const planExists = await ctx.prisma.plan.findFirst({
        where: { name: input.name, tenantId },
      });

      if (planExists) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Já existe um plano com este nome',
        });
      }

      /* Padrão é um só: marcar um novo tira o anterior, na mesma transação,
         senão dois planos disputariam a pré-seleção da matrícula. */
      const createdPlan = await ctx.prisma.$transaction(async (tx) => {
        if (input.isDefault) {
          await tx.plan.updateMany({
            where: { tenantId, isDefault: true },
            data: { isDefault: false },
          });
        }

        const plan = await tx.plan.create({
          data: {
            name: input.name,
            description: input.description,
            price: parseFloat(input.price) / 100,
            duration: Number(input.duration),
            billing: input.billing,
            isDefault: input.isDefault,
            userId,
            tenantId,
          },
        });

        await gravarPrecosPorModalidade(
          tx,
          tenantId,
          plan.id,
          input.modalityPrices ?? [],
        );

        return plan;
      });

      return {
        ok: true,
        data: createdPlan,
      };
    }),

  getAll: protectedProcedure
    .input(
      z.object({
        page: z.number().default(1),
        limit: z.number().default(10),
        search: z.string().optional(),
        /** Para as escolhas de matrícula nova e troca de plano. */
        apenasAtivos: z.boolean().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { tenantId } = ctx;
      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Não autorizado',
        });
      }

      /* O filtro por academia não é opcional: sem ele a lista traria os
         planos de todas as academias do sistema. */
      const where: Prisma.PlanWhereInput = {
        tenantId,
        ...(input.apenasAtivos ? { isActive: true } : {}),
        ...(input.search
          ? {
              name: {
                contains: input.search,
                mode: Prisma.QueryMode.insensitive,
              },
            }
          : {}),
      };

      const [data, total] = await Promise.all([
        ctx.prisma.plan.findMany({
          where,
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          orderBy: { createdAt: 'desc' },
          include: modalityPricesInclude,
        }),
        ctx.prisma.plan.count({ where }),
      ]);

      // 🔁 Converte o price de Decimal para number
      const parsedData = data.map((plan) => ({
        ...plan,
        price: Number(plan.price),
      }));

      return {
        data: parsedData,
        pagination: {
          total,
          page: input.page,
          limit: input.limit,
          totalPages: Math.ceil(total / input.limit),
        },
      };
    }),

  delete: ownerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { tenantId } = ctx;

      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Não autorizado',
        });
      }

      /* A contagem dá a mensagem com o número; quem garante é o FK da
         matrícula (NO ACTION), que recusa no banco o que passar daqui —
         uma matrícula feita entre a contagem e o delete, por exemplo. */
      const emUso = await ctx.prisma.enrollment.count({
        where: { planId: input.id, plan: { tenantId } },
      });

      if (emUso > 0) throw planoEmUso(emUso);

      try {
        await ctx.prisma.plan.delete({
          where: { id: input.id, tenantId },
        });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2003'
        ) {
          throw planoEmUso();
        }
        throw err;
      }

      return { ok: true };
    }),

  update: ownerProcedure
    .input(updatePlanSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { tenantId } = ctx;

      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Não autorizado',
        });
      }

      const { id, duration, price, modalityPrices, ...rest } = input;

      /* O padrão vem escolhido na matrícula: plano desativado não pode ser
         ele. Desativar o padrão tira a marca; a academia escolhe outro. */
      if (rest.isActive === false) rest.isDefault = false;

      const updatedPlan = await ctx.prisma.$transaction(async (tx) => {
        if (rest.isDefault) {
          await tx.plan.updateMany({
            where: { tenantId, isDefault: true, id: { not: id } },
            data: { isDefault: false },
          });
        }

        /* Muda o preço das matrículas novas. As que já existem guardam o
           valor delas, e as parcelas já geradas não mudam. */
        const plan = await tx.plan.update({
          where: { id, tenantId },
          data: {
            ...rest,
            price: parseFloat(price) / 100,
            duration: Number(duration),
          },
        });

        if (plan.isDefault && !plan.isActive) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Um plano desativado não pode ser o padrão.',
          });
        }

        if (modalityPrices) {
          await gravarPrecosPorModalidade(
            tx,
            tenantId,
            plan.id,
            modalityPrices,
          );
        }

        return plan;
      });

      return {
        ok: true,
        data: updatedPlan,
      };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { tenantId } = ctx;

      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Não autorizado',
        });
      }

      const plan = await ctx.prisma.plan.findFirst({
        where: { id: input.id, tenantId },
        include: modalityPricesInclude,
      });

      if (!plan) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Plano não encontrado',
        });
      }

      return { data: plan };
    }),

  /** O desconto da academia da 2ª modalidade em diante. */
  getPricingSettings: protectedProcedure.query(async ({ ctx }) => ({
    multiModalityDiscount: await descontoDaAcademia(ctx.prisma, ctx.tenantId),
  })),

  /**
   * Vale para as matrículas feitas daqui em diante. As que já existem
   * guardam o valor delas — mudar o desconto não reescreve contrato.
   */
  updatePricingSettings: ownerProcedure
    .input(pricingSettingsSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.tenant.update({
        where: { id: ctx.tenantId },
        data: { multiModalityDiscount: input.multiModalityDiscount },
      });
      return { ok: true };
    }),
});

/** Plano com matrícula não sai: levaria o histórico de quem está nele. */
const planoEmUso = (matriculas?: number) =>
  new TRPCError({
    code: 'BAD_REQUEST',
    message: `Este plano está em ${
      matriculas === undefined
        ? 'matrículas de alunos'
        : `${matriculas} ${matriculas === 1 ? 'matrícula' : 'matrículas'}`
    }, contando as encerradas, e não pode ser apagado. Desative-o para tirá-lo das matrículas novas.`,
  });
