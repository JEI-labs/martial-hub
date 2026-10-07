import 'server-only';

import { ETenantInvoiceStatus, ETenantStatus } from '@prisma/client';

import { prisma } from '@/server/db';

/**
 * A régua de inadimplência, em um lugar só.
 *
 * Antes do vencimento o sistema avisa; passado ele, cobra; passada uma
 * semana, anuncia a data do bloqueio; passadas duas, bloqueia. Os prazos
 * ficam aqui porque mudá-los é decisão de negócio, não de tela — e porque
 * três componentes diferentes contam os mesmos dias.
 */

/** A partir daqui a fatura já aparece como "vence em breve". */
export const DIAS_DE_AVISO = 7;

/** Atraso em que o aviso passa a anunciar o bloqueio. */
export const DIAS_PARA_AVISO_FINAL = 7;

/** Atraso em que a academia perde o acesso. */
export const DIAS_PARA_BLOQUEIO = 14;

/** Quantos dias faltam (negativo quando já venceu). */
export function diasAte(data: Date, agora: Date = new Date()): number {
  const dia = 24 * 60 * 60 * 1000;
  const alvo = new Date(data).setHours(0, 0, 0, 0);
  const hoje = new Date(agora).setHours(0, 0, 0, 0);

  return Math.round((alvo - hoje) / dia);
}

function diasAtras(quantidade: number, agora: Date = new Date()): Date {
  const data = new Date(agora);
  data.setDate(data.getDate() - quantidade);
  data.setHours(23, 59, 59, 999);
  return data;
}

/**
 * Passa para atrasada toda fatura em aberto que já venceu e bloqueia quem
 * cruzou o prazo.
 *
 * Roda na leitura, não só num cron: a conta é barata e quem abre a tela é
 * quem precisa do número certo. Deixar isso só num botão fazia a lista
 * mostrar "em aberto" para coisa vencida havia uma semana.
 */
export async function aplicarRegraDeCobranca(agora: Date = new Date()) {
  const { count: vencidas } = await prisma.tenantInvoice.updateMany({
    where: { status: ETenantInvoiceStatus.OPEN, dueDate: { lt: agora } },
    data: { status: ETenantInvoiceStatus.OVERDUE },
  });

  /* Bloqueio é por fatura vencida há duas semanas — e só atinge quem está
     usando o sistema: cancelada já não tem acesso, e suspensa já está. */
  const paraBloquear = await prisma.tenant.findMany({
    where: {
      status: { in: [ETenantStatus.ACTIVE, ETenantStatus.TRIAL] },
      invoices: {
        some: {
          status: ETenantInvoiceStatus.OVERDUE,
          dueDate: { lte: diasAtras(DIAS_PARA_BLOQUEIO, agora) },
        },
      },
    },
    select: { id: true, name: true },
  });

  if (paraBloquear.length > 0) {
    await prisma.tenant.updateMany({
      where: { id: { in: paraBloquear.map((tenant) => tenant.id) } },
      data: { status: ETenantStatus.SUSPENDED },
    });
  }

  return { vencidas, bloqueadas: paraBloquear };
}

/**
 * Devolve o acesso quando não há mais nada vencido. Chamada quando uma fatura
 * é baixada: quem pagou não pode continuar bloqueado esperando alguém lembrar
 * de reativar na mão.
 */
export async function reativarSePago(tenantId: string): Promise<boolean> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { status: true },
  });

  if (tenant?.status !== ETenantStatus.SUSPENDED) return false;

  const aindaDevendo = await prisma.tenantInvoice.count({
    where: { tenantId, status: ETenantInvoiceStatus.OVERDUE },
  });

  if (aindaDevendo > 0) return false;

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { status: ETenantStatus.ACTIVE },
  });

  return true;
}

/** Em que ponto da régua a academia está. */
export type FaseDaCobranca =
  'em_dia' | 'vencendo' | 'atrasado' | 'bloqueio_proximo';

export function faseDaCobranca(
  dueDate: Date,
  agora: Date = new Date(),
): { fase: FaseDaCobranca; dias: number; diasParaBloqueio: number } {
  const dias = diasAte(dueDate, agora);
  const atraso = -dias;
  const diasParaBloqueio = DIAS_PARA_BLOQUEIO - atraso;

  if (dias > DIAS_DE_AVISO) {
    return { fase: 'em_dia', dias, diasParaBloqueio };
  }
  if (dias >= 0) {
    return { fase: 'vencendo', dias, diasParaBloqueio };
  }
  if (atraso < DIAS_PARA_AVISO_FINAL) {
    return { fase: 'atrasado', dias, diasParaBloqueio };
  }

  return { fase: 'bloqueio_proximo', dias, diasParaBloqueio };
}

/** Se o bloqueio desta academia tem fatura vencida por trás. */
export async function temFaturaVencida(tenantId: string): Promise<boolean> {
  const quantas = await prisma.tenantInvoice.count({
    where: { tenantId, status: ETenantInvoiceStatus.OVERDUE },
  });

  return quantas > 0;
}
