import { Prisma } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { graduacoesDoCatalogo } from '@/common/constants/graduations';
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
            /* Nasce com as faixas do catálogo, quando ele conhece a
               modalidade; boxe e nomes livres nascem sem. Um INSERT só para
               todas, em vez de um por faixa. */
            graduations: {
              createMany: { data: graduacoesDoCatalogo(slug) },
            },
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

      /* Renomear para um nome do catálogo ("Jiu Jitsu Kids" → "Jiu-Jitsu",
         "Karate do" → "Karatê") dá a ela as faixas que teria se tivesse
         nascido com esse nome. Só a quem não tem nenhuma: as faixas que ela
         já tem podem estar em uso, e trocar uma lista pela outra tiraria a
         graduação dos alunos. */
      const faixasDoNomeNovo =
        slug !== atual.slug &&
        (await ctx.prisma.graduation.count({
          where: { modalityId: atual.id },
        })) === 0
          ? graduacoesDoCatalogo(slug)
          : [];

      return ctx.prisma.modality.update({
        where: { id: atual.id, tenantId },
        data: {
          name: input.name,
          slug,
          isActive: input.isActive,
          ...(faixasDoNomeNovo.length > 0
            ? { graduations: { createMany: { data: faixasDoNomeNovo } } }
            : {}),
        },
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

      /* Modalidade em uso só pode ser desativada: apagar levaria junto as
         faixas (e com elas a graduação dos alunos) e o histórico de
         matrícula de quem a fez — inclusive de quem já saiu. */
      const [alunosComFaixa, matriculas] = await Promise.all([
        ctx.prisma.student.count({
          where: { tenantId, graduation: { modalityId: alvo.id } },
        }),
        ctx.prisma.enrollment.count({ where: { modalityId: alvo.id } }),
      ]);

      if (alunosComFaixa > 0 || matriculas > 0) {
        const motivo =
          matriculas > 0
            ? `${matriculas} ${matriculas === 1 ? 'matrícula' : 'matrículas'} em ${alvo.name}, contando as encerradas`
            : `${alunosComFaixa} ${alunosComFaixa === 1 ? 'aluno com faixa' : 'alunos com faixa'} de ${alvo.name}`;

        throw emUso(alvo.name, motivo);
      }

      if (alvo.isActive) {
        await garantirOutraAtiva(ctx.prisma, tenantId, alvo.id);
      }

      try {
        await ctx.prisma.modality.delete({ where: { id: alvo.id, tenantId } });
      } catch (err) {
        /* Alguém deu uma faixa dela (ou matriculou nela) entre a contagem
           acima e o delete: o FK barra. É a mesma recusa, só que pelo banco. */
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2003'
        ) {
          throw emUso(alvo.name);
        }
        throw err;
      }

      return { ok: true };
    }),
});

/** `motivo` é o que a contagem achou; sem ele, a recusa veio do banco. */
const emUso = (nome: string, motivo?: string) =>
  new TRPCError({
    code: 'BAD_REQUEST',
    message: `Há ${motivo ?? `alunos com faixa ou matrícula de ${nome}`}. Desative a modalidade em vez de apagar.`,
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
