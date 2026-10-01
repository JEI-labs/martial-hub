import { Prisma } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { createTRPCRouter, protectedProcedure } from '../trpc';
import {
  createPromotionSchema,
  updatePromotionSchema,
} from '@/server/validations/promotions';

export const promotionsRouter = createTRPCRouter({
  getAll: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(10),
        search: z.string().optional(),
        onlyActive: z.boolean().default(false),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { tenantId } = ctx;
      if (!userId) throw new TRPCError({ code: 'UNAUTHORIZED' });

      const where: Prisma.PromotionWhereInput = {
        tenantId,
        ...(input.search?.trim()
          ? { name: { contains: input.search.trim(), mode: 'insensitive' } }
          : {}),
        ...(input.onlyActive ? { isActive: true } : {}),
      };

      const [data, total] = await Promise.all([
        ctx.prisma.promotion.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
        }),
        ctx.prisma.promotion.count({ where }),
      ]);

      return {
        data,
        pagination: {
          page: input.page,
          limit: input.limit,
          total,
          totalPages: Math.ceil(total / input.limit),
        },
      };
    }),

  /** Promoções válidas hoje, para o momento de registrar um pagamento. */
  getAvailable: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const { tenantId } = ctx;
    if (!userId) throw new TRPCError({ code: 'UNAUTHORIZED' });

    const now = new Date();

    return ctx.prisma.promotion.findMany({
      where: {
        tenantId,
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: { name: 'asc' },
    });
  }),

  create: protectedProcedure
    .input(createPromotionSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { tenantId } = ctx;
      if (!userId) throw new TRPCError({ code: 'UNAUTHORIZED' });

      const promotion = await ctx.prisma.promotion.create({
        data: {
          name: input.name,
          description: input.description ?? null,
          discountType: input.discountType,
          discountValue: input.discountValue,
          startsAt: input.startsAt ? new Date(input.startsAt) : null,
          endsAt: input.endsAt ? new Date(input.endsAt) : null,
          isActive: input.isActive,
          userId,
          tenantId,
        },
      });

      return { message: 'Promoção criada', data: promotion };
    }),

  update: protectedProcedure
    .input(updatePromotionSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { tenantId } = ctx;
      if (!userId) throw new TRPCError({ code: 'UNAUTHORIZED' });

      const result = await ctx.prisma.promotion.updateMany({
        where: { id: input.id, tenantId },
        data: {
          name: input.name,
          description: input.description ?? null,
          discountType: input.discountType,
          discountValue: input.discountValue,
          startsAt: input.startsAt ? new Date(input.startsAt) : null,
          endsAt: input.endsAt ? new Date(input.endsAt) : null,
          isActive: input.isActive,
        },
      });

      if (result.count === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Promoção não encontrada.',
        });
      }

      return { message: 'Promoção atualizada' };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { tenantId } = ctx;
      if (!userId) throw new TRPCError({ code: 'UNAUTHORIZED' });

      const result = await ctx.prisma.promotion.deleteMany({
        where: { id: input.id, tenantId },
      });

      if (result.count === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Promoção não encontrada.',
        });
      }

      return { message: 'Promoção excluída' };
    }),
});
