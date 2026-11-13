import { createTRPCRouter, teacherProcedure } from '@/server/api/trpc';

export const graduationsRouter = createTRPCRouter({
  /**
   * As faixas que dá para escolher, por modalidade, na ordem da academia.
   *
   * Só modalidades ativas e que têm faixa: desativada some das escolhas
   * novas (o aluno que já tem faixa dela continua vendo a sua, que vem junto
   * do aluno), e boxe não tem o que escolher. Lista vazia quer dizer que a
   * academia não tem graduação para dar, e a tela esconde o campo.
   */
  list: teacherProcedure.query(async ({ ctx }) => {
    return ctx.prisma.modality.findMany({
      where: {
        tenantId: ctx.tenantId,
        isActive: true,
        graduations: { some: {} },
      },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        /* Decide se a faixa se diz em grau ("4º grau") ou só pelo nome. */
        slug: true,
        graduations: {
          orderBy: { position: 'asc' },
          select: {
            id: true,
            name: true,
            level: true,
            colors: true,
            position: true,
          },
        },
      },
    });
  }),
});
