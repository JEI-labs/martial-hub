import { createTRPCRouter, teacherProcedure } from '@/server/api/trpc';

export const graduationsRouter = createTRPCRouter({
  /**
   * As faixas que dá para escolher, por modalidade, na ordem da academia.
   *
   * Só modalidades ativas: desativada some das escolhas novas, mas o aluno
   * que já tem faixa dela continua vendo a sua — essa vem junto do aluno, não
   * daqui. Modalidade sem faixa (boxe) vem com a lista vazia, e a tela decide
   * se mostra ou não o campo.
   */
  list: teacherProcedure.query(async ({ ctx }) => {
    return ctx.prisma.modality.findMany({
      where: { tenantId: ctx.tenantId, isActive: true },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
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
