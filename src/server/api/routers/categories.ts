// server/api/routers/category.ts
import {
  createTRPCRouter,
  protectedProcedure,
  ownerProcedure,
} from '@/server/api/trpc';
import { paginationSchema } from '@/server/validations/pagination';
import {
  createCategorySchema,
  updateCategorySchema,
} from '@/server/validations/categories';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { ECategoryStatus, Prisma } from '@prisma/client';

export const categoryRouter = createTRPCRouter({
  // --- CREATE ---
  create: ownerProcedure
    .input(createCategorySchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { tenantId } = ctx;
      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Não autorizado',
        });
      }

      // 1) Verifica duplicata para este usuário
      const exists = await ctx.prisma.category.findFirst({
        where: {
          tenantId,
          name: {
            equals: input.name,
            mode: 'insensitive',
          },
        },
      });
      if (exists) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Você já tem uma categoria com esse nome',
        });
      }

      // 2) Cria categoria conectando ao user real
      const category = await ctx.prisma.category.create({
        data: {
          name: input.name,
          description: input.description,
          status: input.status,
          userId,
          tenantId,
        },
      });

      return { ok: true, data: category };
    }),

  // --- UPDATE ---
  update: ownerProcedure
    .input(updateCategorySchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { tenantId } = ctx;
      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Não autorizado',
        });
      }

      // 1) Checa se a categoria existe e pertence ao user
      const current = await ctx.prisma.category.findFirst({
        where: { id: input.id, tenantId: tenantId.toString() },
      });
      if (!current) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Categoria não encontrada',
        });
      }

      // 2) Evita conflito de nome com outra categoria do mesmo user
      const conflict = await ctx.prisma.category.findFirst({
        where: {
          tenantId,
          name: input.name,
          NOT: { id: input.id },
        },
      });
      if (conflict) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Outra categoria com esse nome já existe',
        });
      }

      // 3) Atualiza
      const updated = await ctx.prisma.category.update({
        where: { id: input.id, tenantId },
        data: {
          name: input.name,
          status: input.status,
          description: input.description,
        },
      });

      return { ok: true, data: updated };
    }),

  // --- LIST + PAGINATION ---
  getAll: protectedProcedure
    .input(
      paginationSchema.extend({
        search: z.string().optional(),
        status: z.array(z.nativeEnum(ECategoryStatus)).optional(),
        from: z.string().optional(), // espera YYYY-MM-DD
        to: z.string().optional(),
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

      const { page, limit, search, status, from, to } = input;
      const skip = (page - 1) * limit;

      // Monta filtros dinamicamente
      const where: Prisma.CategoryWhereInput = {
        tenantId,

        // filtro de busca por nome
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),

        // filtro de status
        ...(status ? { status: { in: status } } : {}),

        // filtro por intervalo de data de criação
        ...(from || to
          ? {
              createdAt: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      };

      const [data, total] = await Promise.all([
        ctx.prisma.category.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        ctx.prisma.category.count({ where }),
      ]);

      return {
        ok: true,
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }),

  // --- GET BY ID ---
  getByID: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { tenantId } = ctx;
      const category = await ctx.prisma.category.findFirst({
        where: { id: input.id, tenantId },
      });
      if (!category) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Categoria não encontrada',
        });
      }
      return { ok: true, data: category };
    }),

  // --- DELETE ---
  delete: ownerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { tenantId } = ctx;
      const toDelete = await ctx.prisma.category.findFirst({
        where: { id: input.id, tenantId },
      });

      if (!toDelete) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Categoria não encontrada',
        });
      }

      await ctx.prisma.category.delete({ where: { id: input.id, tenantId } });
      return { ok: true, message: 'Categoria excluída com sucesso' };
    }),
});
