import { Prisma } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { slugify } from '@/common/utils/string';
import {
  createTRPCRouter,
  ownerProcedure,
  teacherProcedure,
} from '@/server/api/trpc';
import {
  createModalitySchema,
  reorderModalitiesSchema,
  updateModalitySchema,
} from '@/server/validations/modalities';

/** O slug é o que decide se dois nomes são o mesmo; vazio não é nome. */
const slugDoNome = (name: string) => {
  const slug = slugify(name);

  if (!slug) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'O nome precisa ter ao menos uma letra ou número.',
    });
  }

  return slug;
};

const nomeRepetido = (name: string) =>
  new TRPCError({
    code: 'CONFLICT',
    message: `Já existe a modalidade ${name}.`,
  });

export const modalitiesRouter = createTRPCRouter({
  /* Quem configura é o dono, mas quem lê é todo mundo: a recepção escolhe a
     modalidade na matrícula, e o professor, na graduação. */
  list: teacherProcedure.query(async ({ ctx }) => {
    return ctx.prisma.modality.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
    });
  }),

  create: ownerProcedure
    .input(createModalitySchema)
    .mutation(async ({ ctx, input }) => {
      const { tenantId } = ctx;
      const slug = slugDoNome(input.name);

      const existente = await ctx.prisma.modality.findUnique({
        where: { tenantId_slug: { tenantId, slug } },
      });

      if (existente) throw nomeRepetido(existente.name);

      /* Entra no fim da lista; quem quiser outra posição arrasta depois. */
      const ultima = await ctx.prisma.modality.aggregate({
        where: { tenantId },
        _max: { position: true },
      });

      try {
        return await ctx.prisma.modality.create({
          data: {
            name: input.name,
            slug,
            position: (ultima._max.position ?? -1) + 1,
            tenantId,
          },
        });
      } catch (err) {
        /* Dois cadastros iguais ao mesmo tempo: o unique do banco desempata. */
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          throw nomeRepetido(input.name);
        }
        throw err;
      }
    }),

  update: ownerProcedure
    .input(updateModalitySchema)
    .mutation(async ({ ctx, input }) => {
      const { tenantId } = ctx;

      const atual = await ctx.prisma.modality.findFirst({
        where: { id: input.id, tenantId },
      });

      if (!atual) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Modalidade não encontrada',
        });
      }

      const slug = slugDoNome(input.name);

      if (slug !== atual.slug) {
        const outra = await ctx.prisma.modality.findUnique({
          where: { tenantId_slug: { tenantId, slug } },
        });

        if (outra) throw nomeRepetido(outra.name);
      }

      if (atual.isActive && !input.isActive) {
        await garantirOutraAtiva(ctx.prisma, tenantId, atual.id);
      }

      return ctx.prisma.modality.update({
        where: { id: atual.id, tenantId },
        data: { name: input.name, slug, isActive: input.isActive },
      });
    }),

  /**
   * Recebe a lista inteira na ordem nova, e não "sobe esta uma posição": assim
   * duas telas abertas não deixam duas modalidades na mesma posição.
   */
  reorder: ownerProcedure
    .input(reorderModalitiesSchema)
    .mutation(async ({ ctx, input }) => {
      const { tenantId } = ctx;

      const daAcademia = await ctx.prisma.modality.findMany({
        where: { tenantId },
        select: { id: true },
      });

      const ids = new Set(daAcademia.map((m) => m.id));
      const recebidos = new Set(input.ids);

      /* Mesmo conjunto, sem faltar nem sobrar: id de outra academia cai aqui. */
      if (
        recebidos.size !== input.ids.length ||
        recebidos.size !== ids.size ||
        input.ids.some((id) => !ids.has(id))
      ) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'A lista mudou enquanto você ordenava. Recarregue a página.',
        });
      }

      await ctx.prisma.$transaction(
        input.ids.map((id, position) =>
          ctx.prisma.modality.update({
            where: { id, tenantId },
            data: { position },
          }),
        ),
      );

      return { ok: true };
    }),

  remove: ownerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { tenantId } = ctx;

      const alvo = await ctx.prisma.modality.findFirst({
        where: { id: input.id, tenantId },
      });

      if (!alvo) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Modalidade não encontrada',
        });
      }

      /* Por enquanto nada aponta para modalidade. Quando matrícula (#35) e
         graduação (#34) apontarem, a que estiver em uso só pode ser
         desativada — a trava entra aqui, com elas. */
      if (alvo.isActive) {
        await garantirOutraAtiva(ctx.prisma, tenantId, alvo.id);
      }

      await ctx.prisma.modality.delete({ where: { id: alvo.id, tenantId } });
      return { ok: true };
    }),
});

/**
 * Academia sem modalidade ativa não tem o que matricular — a mesma ideia de
 * "pelo menos um dono" em `tenant.removeMember`.
 */
async function garantirOutraAtiva(
  prisma: Prisma.TransactionClient,
  tenantId: string,
  saindoId: string,
) {
  const outras = await prisma.modality.count({
    where: { tenantId, isActive: true, id: { not: saindoId } },
  });

  if (outras === 0) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'A academia precisa de pelo menos uma modalidade ativa.',
    });
  }
}
