import {
  createTRPCRouter,
  ownerProcedure,
  agendaProcedure,
} from '@/server/api/trpc';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

/**
 * Tipos de aula particular: o que a academia cobra fora da mensalidade.
 *
 * Quem configura é o dono; quem lê é a agenda, para preencher preço e duração
 * ao marcar — por isso a leitura também vale para o professor.
 */
export const lessonTypesRouter = createTRPCRouter({
  list: agendaProcedure.query(async ({ ctx }) => {
    return ctx.prisma.lessonType.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }),

  create: ownerProcedure
    .input(
      z.object({
        name: z.string().min(2, 'Nome muito curto').max(60),
        price: z.number().min(0),
        durationMinutes: z.number().int().min(10).max(480),
        isDefault: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const repetido = await ctx.prisma.lessonType.findFirst({
        where: { tenantId: ctx.tenantId, name: input.name },
      });

      if (repetido) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Já existe um tipo de aula com este nome.',
        });
      }

      /* Um padrão só: dois marcados deixariam a agenda escolhendo sozinha. */
      await ctx.prisma.$transaction(async (tx) => {
        if (input.isDefault) {
          await tx.lessonType.updateMany({
            where: { tenantId: ctx.tenantId },
            data: { isDefault: false },
          });
        }

        await tx.lessonType.create({
          data: { ...input, tenantId: ctx.tenantId },
        });
      });

      return { ok: true };
    }),

  update: ownerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(2).max(60),
        price: z.number().min(0),
        durationMinutes: z.number().int().min(10).max(480),
        isDefault: z.boolean(),
        isActive: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...dados } = input;

      const existe = await ctx.prisma.lessonType.findFirst({
        where: { id, tenantId: ctx.tenantId },
      });

      if (!existe) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Tipo não encontrado',
        });
      }

      await ctx.prisma.$transaction(async (tx) => {
        if (dados.isDefault) {
          await tx.lessonType.updateMany({
            where: { tenantId: ctx.tenantId, id: { not: id } },
            data: { isDefault: false },
          });
        }

        await tx.lessonType.update({ where: { id }, data: dados });
      });

      return { ok: true };
    }),

  remove: ownerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existe = await ctx.prisma.lessonType.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
        select: { id: true, _count: { select: { appointments: true } } },
      });

      if (!existe) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Tipo não encontrado',
        });
      }

      /* Tipo já usado não some: o agendamento guarda o preço, mas o nome dele
         some da ficha e a aula vira "aula particular" sem contexto. */
      if (existe._count.appointments > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            'Este tipo já foi usado em agendamentos. Desative em vez de apagar.',
        });
      }

      await ctx.prisma.lessonType.delete({ where: { id: input.id } });
      return { ok: true };
    }),
});
