import { type Prisma, type PrismaClient } from '@prisma/client';
import { TRPCError } from '@trpc/server';

type Db = PrismaClient | Prisma.TransactionClient;

/** O que as telas precisam de uma faixa para desenhá-la. */
export const graduationSelect = {
  id: true,
  name: true,
  level: true,
  colors: true,
  position: true,
  modality: { select: { id: true, name: true } },
} satisfies Prisma.GraduationSelect;

/**
 * Confere que a faixa é de uma modalidade desta academia.
 *
 * O id chega do navegador: sem esta conferência, uma academia gravaria no
 * aluno dela a faixa cadastrada por outra. `undefined` passa direto — é o
 * "não mexer" da edição do aluno.
 */
export async function conferirGraduacao(
  db: Db,
  tenantId: string,
  graduationId: string | null | undefined,
): Promise<void> {
  if (!graduationId) return;

  const faixa = await db.graduation.findFirst({
    where: { id: graduationId, modality: { tenantId } },
    select: { id: true },
  });

  if (!faixa) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Graduação não encontrada nesta academia.',
    });
  }
}
