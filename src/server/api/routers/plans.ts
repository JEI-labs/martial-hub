import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc';
import { createPlanSchema, updatePlanSchema } from '@/server/validations/plans';
import { Prisma } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

export const plansRouter = createTRPCRouter({
  create: protectedProcedure
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

        return tx.plan.create({
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

  delete: protectedProcedure
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

      await ctx.prisma.plan.delete({
        where: { id: input.id, tenantId },
      });

      return { ok: true };
    }),

  update: protectedProcedure
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

      const { id, duration, price, ...rest } = input;

      const updatedPlan = await ctx.prisma.$transaction(async (tx) => {
        if (rest.isDefault) {
          await tx.plan.updateMany({
            where: { tenantId, isDefault: true, id: { not: id } },
            data: { isDefault: false },
          });
        }

        return tx.plan.update({
          where: { id, tenantId },
          data: {
            ...rest,
            price: parseFloat(price) / 100,
            duration: Number(duration),
          },
        });
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
      });

      if (!plan) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Plano não encontrado',
        });
      }

      return { data: plan };
    }),
});
