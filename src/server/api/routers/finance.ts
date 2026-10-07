// server/api/routers/finance.ts
import {
  createTRPCRouter,
  protectedProcedure,
  staffProcedure,
} from '@/server/api/trpc';
import { createFinanceEntrySchema } from '@/server/validations/finance';
import { paginationSchema } from '@/server/validations/pagination';
import { convertToDate } from '@/utils/converterUtils';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { EFinanceEntryStatus, EFinanceEntryType, Prisma } from '@prisma/client';

/**
 * Filtro de tipo: aceita um valor só ou uma lista. Receitas precisa de dois
 * (lançamento avulso e mensalidade de aluno) no mesmo where.
 */
const typeFilter = z
  .union([
    z.nativeEnum(EFinanceEntryType),
    z.array(z.nativeEnum(EFinanceEntryType)).min(1),
  ])
  .optional();

const whereType = (
  type: z.infer<typeof typeFilter>,
): Prisma.FinanceEntryWhereInput['type'] =>
  Array.isArray(type) ? { in: type } : type;

export const financeRouter = createTRPCRouter({
  getAll: protectedProcedure
    .input(
      paginationSchema.extend({
        search: z.string().optional(),
        type: typeFilter,
        status: z.array(z.nativeEnum(EFinanceEntryStatus)).optional(),
        from: z.string().optional(),
        to: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { tenantId } = ctx;
      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Usuário não autenticado',
        });
      }

      const { page, limit, search, type, from, to, status } = input;
      const skip = (page - 1) * limit;

      const where: Prisma.FinanceEntryWhereInput = { tenantId };
      if (type) where.type = whereType(type);
      if (status) where.status = { in: status };
      if (search) {
        where.OR = [
          { description: { contains: search, mode: 'insensitive' } },
          { referenceId: { contains: search, mode: 'insensitive' } },
          // a mensalidade aparece na lista pelo nome do aluno, então é por ele
          // que alguém vai procurá-la
          { student: { name: { contains: search, mode: 'insensitive' } } },
        ];
      }
      if (from || to) {
        where.date = {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(to) } : {}),
        };
      }

      try {
        const [entries, total] = await Promise.all([
          ctx.prisma.financeEntry.findMany({
            where,
            orderBy: { date: 'desc' },
            skip,
            take: limit,
            include: {
              student: true,
            },
          }),
          ctx.prisma.financeEntry.count({ where }),
        ]);

        return {
          ok: true,
          data: entries,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        };
      } catch (error) {
        console.error('Erro ao carregar lançamentos financeiros:', error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Não foi possível carregar lançamentos financeiros',
        });
      }
    }),

  create: staffProcedure
    .input(createFinanceEntrySchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { tenantId } = ctx;
      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Usuário não autenticado',
        });
      }

      const dateObj = convertToDate(input.date);

      try {
        const entry = await ctx.prisma.financeEntry.create({
          data: {
            userId,
            tenantId,
            date: dateObj,
            amount: Number(input.amount),
            type: input.type,
            status: input.status,
            categoryId: input.category,
            paymentMethod: input.paymentMethod ?? undefined,
            referenceId: input.referenceId ?? undefined,
            description: input.description ?? undefined,
            currency: input.currency,
          },
        });
        return { ok: true, data: entry };
      } catch (error) {
        console.error('Erro ao criar lançamento financeiro:', error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Não foi possível adicionar lançamento financeiro',
        });
      }
    }),

  update: staffProcedure
    .input(z.object({ id: z.string() }).merge(createFinanceEntrySchema))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { tenantId } = ctx;

      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Usuário não autenticado',
        });
      }

      const existing = await ctx.prisma.financeEntry.findFirst({
        where: { id: input.id, tenantId },
      });
      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Lançamento não encontrado',
        });
      }

      const dateObj = convertToDate(input.date);
      const updated = await ctx.prisma.financeEntry.update({
        where: { id: input.id, tenantId },
        data: {
          date: dateObj,
          amount: Number(input.amount),
          type: input.type,
          status: input.status,
          categoryId: input.category,
          paymentMethod: input.paymentMethod ?? undefined,
          referenceId: input.referenceId ?? undefined,
          description: input.description ?? undefined,
          currency: input.currency,
        },
      });
      return { ok: true, data: updated };
    }),

  delete: staffProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { tenantId } = ctx;
      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Usuário não autenticado',
        });
      }

      const existing = await ctx.prisma.financeEntry.findFirst({
        where: { id: input.id, tenantId },
      });
      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Lançamento não encontrado',
        });
      }

      await ctx.prisma.financeEntry.delete({
        where: { id: input.id, tenantId },
      });

      return { ok: true };
    }),

  getAllMetrics: protectedProcedure
    .input(
      z.object({
        from: z.string().optional(),
        to: z.string().optional(),
        type: typeFilter,
        status: z.array(z.nativeEnum(EFinanceEntryStatus)).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { tenantId } = ctx;
      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Usuário não autenticado',
        });
      }

      const { from, to, type, status } = input;

      const where: Prisma.FinanceEntryWhereInput = { tenantId };
      if (type) where.type = whereType(type);
      if (status) where.status = { in: status };
      if (from || to) {
        where.date = {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(to) } : {}),
        };
      }

      const entries = await ctx.prisma.financeEntry.findMany({
        where,
        orderBy: { date: 'desc' },
      });

      return { ok: true, data: entries };
    }),
});
