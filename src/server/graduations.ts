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
  /* O slug decide se a faixa se diz em grau ("4º grau") ou só pelo nome;
     a posição ordena as modalidades. */
  modality: { select: { id: true, name: true, slug: true, position: true } },
} satisfies Prisma.GraduationSelect;

/** Um registro do histórico de graduação, como as telas mostram. */
export const studentGraduationSelect = {
  id: true,
  awardedAt: true,
  note: true,
  createdAt: true,
  graduation: { select: graduationSelect },
  user: { select: { name: true } },
} satisfies Prisma.StudentGraduationSelect;

type Registro = {
  awardedAt: Date;
  createdAt: Date;
  graduation: { modality: { id: string; position: number } };
};

/**
 * O histórico do mais recente para o mais antigo. Dois registros no mesmo
 * dia desempatam pela ordem em que foram lançados.
 */
export function maisRecentesPrimeiro<T extends Registro>(historico: Array<T>) {
  return [...historico].sort(
    (a, b) =>
      b.awardedAt.getTime() - a.awardedAt.getTime() ||
      b.createdAt.getTime() - a.createdAt.getTime(),
  );
}

/**
 * A faixa atual do aluno em cada modalidade: o registro mais recente de cada
 * uma, na ordem das modalidades da academia.
 */
export function faixasAtuais<T extends Registro>(historico: Array<T>) {
  const porModalidade = new Map<string, T>();

  for (const registro of maisRecentesPrimeiro(historico)) {
    const modalidade = registro.graduation.modality.id;
    if (!porModalidade.has(modalidade)) porModalidade.set(modalidade, registro);
  }

  return Array.from(porModalidade.values()).sort(
    (a, b) => a.graduation.modality.position - b.graduation.modality.position,
  );
}

/**
 * Confere que a faixa pode ser dada: é desta academia, da modalidade certa
 * (quando dito) e de modalidade ativa.
 *
 * O id chega do navegador: sem esta conferência, uma academia gravaria no
 * aluno dela a faixa cadastrada por outra — ou a faixa do jiu-jitsu na linha
 * do muay thai. E um cache velho (ou uma chamada direta) daria faixa de
 * modalidade desativada, que a tela já não oferece.
 */
export async function conferirFaixa(
  db: Db,
  tenantId: string,
  graduationId: string,
  modalityId?: string,
) {
  const faixa = await db.graduation.findFirst({
    where: {
      id: graduationId,
      modality: { tenantId, ...(modalityId ? { id: modalityId } : {}) },
    },
    select: {
      id: true,
      name: true,
      modality: { select: { id: true, name: true, isActive: true } },
    },
  });

  if (!faixa) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: modalityId
        ? 'Esta faixa não é da modalidade escolhida.'
        : 'Graduação não encontrada nesta academia.',
    });
  }

  if (!faixa.modality.isActive) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `A modalidade ${faixa.modality.name} está desativada. Reative-a para dar faixas dela.`,
    });
  }

  return faixa;
}

/**
 * A faixa conferida pode sumir antes da gravação: a modalidade é apagada
 * entre o `conferirFaixa` e o insert do histórico. O banco recusa (o FK do
 * registro), e isto troca o erro cru (P2003, que viraria um 500) pela
 * mensagem de faixa não encontrada. Qualquer outro erro passa adiante.
 */
export function traduzirFaixaSumida(err: unknown): unknown {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2003' &&
    String(
      err.meta?.field_name ?? err.meta?.constraint ?? err.message,
    ).includes('graduationId')
  ) {
    return new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Graduação não encontrada nesta academia.',
    });
  }
  return err;
}
