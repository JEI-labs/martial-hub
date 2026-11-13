import { Prisma, type PrismaClient } from '@prisma/client';
import { TRPCError } from '@trpc/server';

type Db = PrismaClient | Prisma.TransactionClient;

/** O que as telas precisam de uma faixa para desenhá-la. */
export const graduationSelect = {
  id: true,
  name: true,
  level: true,
  colors: true,
  position: true,
  /* O slug decide se a faixa se diz em grau ("4º grau") ou só pelo nome. */
  modality: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.GraduationSelect;

/**
 * Confere que a faixa pode ir para o aluno: é de uma modalidade desta
 * academia, e ativa.
 *
 * O id chega do navegador: sem esta conferência, uma academia gravaria no
 * aluno dela a faixa cadastrada por outra, e um cache velho (ou uma chamada
 * direta) daria faixa de modalidade desativada, que a tela já não oferece.
 * `undefined` passa direto — é o "não mexer" da edição do aluno.
 *
 * `atualId` é a faixa que o aluno já tem: regravar a mesma não é escolha
 * nova, e passa mesmo com a modalidade dela desativada.
 */
export async function conferirGraduacao(
  db: Db,
  tenantId: string,
  graduationId: string | null | undefined,
  atualId?: string | null,
): Promise<void> {
  if (!graduationId) return;

  const faixa = await db.graduation.findFirst({
    where: { id: graduationId, modality: { tenantId } },
    select: { id: true, modality: { select: { name: true, isActive: true } } },
  });

  if (!faixa) throw faixaNaoEncontrada();

  if (!faixa.modality.isActive && graduationId !== atualId) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `A modalidade ${faixa.modality.name} está desativada. Reative-a para dar faixas dela.`,
    });
  }
}

const faixaNaoEncontrada = () =>
  new TRPCError({
    code: 'BAD_REQUEST',
    message: 'Graduação não encontrada nesta academia.',
  });

/**
 * A faixa conferida pode sumir antes da gravação: a modalidade é apagada
 * entre o `conferirGraduacao` e o insert. O banco recusa (o FK do aluno), e
 * isto troca o erro cru (P2003, que viraria um 500) pela mensagem de faixa
 * não encontrada. Qualquer outro erro passa adiante.
 */
export function traduzirFaixaSumida(err: unknown): unknown {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2003' &&
    String(
      err.meta?.field_name ?? err.meta?.constraint ?? err.message,
    ).includes('graduationId')
  ) {
    return faixaNaoEncontrada();
  }
  return err;
}
