// server/api/routers/supplier.ts
import {
  createTRPCRouter,
  protectedProcedure,
  ownerProcedure,
} from '@/server/api/trpc';
import { paginationSchema } from '@/server/validations/pagination';
import {
  createSupplierSchema,
  updateSupplierSchema,
} from '@/server/validations/suppliers';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

export const supplierRouter = createTRPCRouter({
  // --- CREATE ---
  create: ownerProcedure
    .input(createSupplierSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { tenantId } = ctx;
      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Não autorizado',
        });
      }

      // Verifica duplicata de nome
      const exists = await ctx.prisma.supplier.findFirst({
        where: { tenantId, name: input.name },
      });
      if (exists) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Você já tem um fornecedor com esse nome',
        });
      }

      const supplier = await ctx.prisma.supplier.create({
        data: {
          ...input,
          userId,
          tenantId,
        },
      });

      return { ok: true, data: supplier };
    }),

  // --- UPDATE ---
  update: ownerProcedure
    .input(updateSupplierSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { tenantId } = ctx;
      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Não autorizado',
        });
      }

      // Checa existência e pertencimento
      const current = await ctx.prisma.supplier.findFirst({
        where: { id: input.id, tenantId },
      });
      if (!current) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Fornecedor não encontrado',
        });
      }

      // Evita conflito de nome com outro registro
      const conflict = await ctx.prisma.supplier.findFirst({
        where: {
          tenantId,
          name: input.name,
          NOT: { id: input.id },
        },
      });
      if (conflict) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Outro fornecedor com esse nome já existe',
        });
      }

      const updated = await ctx.prisma.supplier.update({
        where: { id: input.id, tenantId },
        data: {
          name: input.name,
          phone: input.phone,
          street: input.street,
          city: input.city,
          state: input.state,
        },
      });

      return { ok: true, data: updated };
    }),

  // --- LIST + PAGINATION ---
  getAll: protectedProcedure
    .input(
      paginationSchema.extend({
        search: z.string().optional(),
        state: z.string().optional(),
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

      const { page, limit, search, state } = input;
      const skip = (page - 1) * limit;

      const where: Prisma.SupplierWhereInput = {
        tenantId,
        ...(search
          ? {
              name: {
                contains: search,
                mode: 'insensitive',
              },
            }
          : {}),
        ...(state ? { state } : {}),
      };

      const [data, total, states] = await Promise.all([
        ctx.prisma.supplier.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        ctx.prisma.supplier.count({ where }),
        ctx.prisma.supplier.findMany({
          distinct: ['state'],
          select: { state: true },
        }),
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
        states: states.map((state) => state.state),
      };
    }),

  // --- GET BY ID ---
  getByID: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { tenantId } = ctx;

      const supplier = await ctx.prisma.supplier.findFirst({
        where: { id: input.id, tenantId },
      });
      if (!supplier) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Fornecedor não encontrado',
        });
      }
      return { ok: true, data: supplier };
    }),

  // --- DELETE ---
  delete: ownerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { tenantId } = ctx;

      const toDelete = await ctx.prisma.supplier.findFirst({
        where: { id: input.id, tenantId },
      });
      if (!toDelete) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Fornecedor não encontrado',
        });
      }

      await ctx.prisma.supplier.delete({ where: { id: input.id, tenantId } });
      return { ok: true, message: 'Fornecedor excluído com sucesso' };
    }),
});
