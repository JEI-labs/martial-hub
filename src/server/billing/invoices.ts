import 'server-only';

import { ETenantInvoiceStatus } from '@prisma/client';

import { prisma } from '@/server/db';

/** A partir daqui a fatura já aparece como "vence em breve". */
export const DIAS_DE_AVISO = 7;

/**
 * Passa para atrasada toda fatura em aberto que já venceu.
 *
 * Roda na leitura, não num cron: a conta é um `updateMany` por data e quem
 * abre a tela é quem precisa do número certo. Deixar isso só num botão fazia
 * a lista mostrar "em aberto" para coisa vencida há uma semana.
 */
export async function marcarVencidas(): Promise<number> {
  const { count } = await prisma.tenantInvoice.updateMany({
    where: { status: ETenantInvoiceStatus.OPEN, dueDate: { lt: new Date() } },
    data: { status: ETenantInvoiceStatus.OVERDUE },
  });

  return count;
}

/** Quantos dias faltam (negativo quando já venceu). */
export function diasAte(data: Date, agora: Date = new Date()): number {
  const dia = 24 * 60 * 60 * 1000;
  const alvo = new Date(data).setHours(0, 0, 0, 0);
  const hoje = new Date(agora).setHours(0, 0, 0, 0);

  return Math.round((alvo - hoje) / dia);
}
