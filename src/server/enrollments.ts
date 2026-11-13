import {
  EFinanceEntryStatus,
  EFinanceEntryType,
  EPaymentMethod,
  EPlanBilling,
  PaymentStatus,
  Prisma,
  type Plan,
  type PlanModalityPrice,
  type PrismaClient,
} from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { addMonths, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { comDesconto, precoNaModalidade } from '@/common/utils/pricing';
import { installmentCount, splitIntoInstallments } from '@/utils/planUtils';

type Db = PrismaClient | Prisma.TransactionClient;

/** O que as telas precisam de uma matrícula: modalidade e plano. */
export const enrollmentInclude = {
  plan: true,
  modality: { select: { id: true, name: true, position: true } },
} satisfies Prisma.EnrollmentInclude;

/**
 * A modalidade de uma matrícula, para quem só precisa dizer de qual
 * modalidade é uma parcela. Um lugar só, para um campo novo chegar a todas
 * as telas que mostram parcela.
 */
export const enrollmentModalitySelect = {
  modality: { select: { id: true, name: true } },
} satisfies Prisma.EnrollmentSelect;

/**
 * Confere modalidade e plano antes de matricular: os ids chegam do navegador,
 * e sem isto uma academia matricularia aluno na modalidade ou no plano de
 * outra. Modalidade desativada também não serve para matrícula nova.
 */
export async function conferirModalidadeEPlano(
  db: Db,
  tenantId: string,
  { modalityId, planId }: { modalityId: string; planId: string },
) {
  const [modality, plan] = await Promise.all([
    db.modality.findFirst({
      where: { id: modalityId, tenantId },
      select: { id: true, name: true, isActive: true },
    }),
    db.plan.findFirst({
      where: { id: planId, tenantId },
      include: { modalityPrices: true },
    }),
  ]);

  if (!modality) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Modalidade não encontrada nesta academia.',
    });
  }

  if (!modality.isActive) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `${modality.name} está desativada e não aceita matrícula nova.`,
    });
  }

  if (!plan) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Plano não encontrado nesta academia.',
    });
  }

  return { modality, plan };
}

/** O desconto da academia da 2ª modalidade em diante, em %. */
export async function descontoDaAcademia(db: Db, tenantId: string) {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { multiModalityDiscount: true },
  });
  return tenant?.multiModalityDiscount ?? 0;
}

/** A categoria fixa que recebe as mensalidades. Sem ela não há matrícula. */
export async function categoriaDeAlunos(db: Db, tenantId: string) {
  const category = await db.category.findFirst({
    where: {
      tenantId,
      isFixed: true,
      name: { equals: 'Alunos', mode: 'insensitive' },
    },
    select: { id: true },
  });

  if (!category) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Categoria "Alunos" não encontrada',
    });
  }

  return category;
}

/**
 * Matricula o aluno numa modalidade, valendo de `startDate`.
 *
 * Cria a matrícula, as parcelas dela (ligadas a ela) e o lançamento no caixa
 * da primeira, que é paga na hora. Plano mensal: uma parcela por mês de
 * duração. Plano à vista: uma parcela só, com o período inteiro — quem paga o
 * trimestre adiantado não tem mensalidade vencendo no meio dele, e a próxima
 * cobrança é a renovação.
 *
 * O valor é o do plano nesta modalidade (o próprio dela, ou o padrão do
 * plano), menos o desconto — e fica guardado na matrícula: mudar o preço do
 * plano depois não reescreve este contrato.
 */
export async function matricular(
  tx: Prisma.TransactionClient,
  {
    student,
    modality,
    plan,
    startDate,
    userId,
    tenantId,
    categoryId,
    motivo,
    discountPercent,
  }: {
    student: { id: string; name: string };
    modality: { id: string; name: string };
    plan: Plan & { modalityPrices: Array<PlanModalityPrice> };
    startDate: Date;
    /** Desconto da 2ª modalidade em diante, em %. 0 é valor cheio. */
    discountPercent: number;
    userId: string;
    tenantId: string;
    categoryId: string;
    /** Entra na descrição do lançamento: "na troca de plano", por exemplo. */
    motivo?: string;
  },
) {
  const price = comDesconto(
    precoNaModalidade(plan, modality.id),
    discountPercent,
  );

  /* `addMonths` e não `setMonth`: começar em 31/01 dava vencimento em 03/03
     (o 31/02 transborda), fevereiro sem parcela e março com duas. O
     date-fns para no último dia do mês: 31/01, 28/02, 31/03. */
  const enrollment = await tx.enrollment
    .create({
      data: {
        studentId: student.id,
        modalityId: modality.id,
        planId: plan.id,
        price,
        discountPercent,
        startDate,
        endDate: addMonths(startDate, plan.duration),
      },
    })
    .catch((err: unknown) => {
      /* O índice único parcial (uma matrícula ativa por aluno e modalidade)
         desempata dois pedidos simultâneos: o segundo cai aqui. */
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `${student.name} já está matriculado em ${modality.name}. Para mudar o plano, use a troca de plano.`,
        });
      }
      throw err;
    });

  const amounts = splitIntoInstallments(
    price,
    installmentCount(plan.duration, plan.billing),
  );

  await tx.payment.createMany({
    data: amounts.map((cents, index) => {
      const dueDate = addMonths(startDate, index);
      return {
        studentId: student.id,
        enrollmentId: enrollment.id,
        amount: cents / 100,
        dueDate,
        status: index === 0 ? PaymentStatus.PAID : PaymentStatus.PENDING,
      };
    }),
  });

  const mes = format(startDate, 'MMMM/yyyy', { locale: ptBR });
  const quando = motivo ? ` ${motivo}` : '';
  const desconto = discountPercent
    ? ` com ${discountPercent}% de desconto de 2ª modalidade`
    : '';
  const isUpfront = plan.billing === EPlanBilling.UPFRONT;

  await tx.financeEntry.create({
    data: {
      amount: amounts[0] ?? 0,
      date: startDate,
      type: EFinanceEntryType.STUDENTS,
      description: isUpfront
        ? `${plan.name} de ${modality.name} de ${student.name} pago à vista${quando}${desconto} (${plan.duration} ${plan.duration === 1 ? 'mês' : 'meses'} a partir de ${mes}).`
        : `Parcela 1 de ${student.name} em ${modality.name}, plano ${plan.name}${quando}${desconto}, com vencimento em ${mes}.`,
      status: EFinanceEntryStatus.PAID,
      currency: 'BRL',
      paymentMethod: EPaymentMethod.CREDIT_CARD,
      userId,
      tenantId,
      categoryId,
      studentId: student.id,
    },
  });

  return { enrollment, installments: amounts.length };
}

/**
 * Encerra uma matrícula valendo de `quando`, sem tocar nas outras do aluno.
 *
 * As parcelas dela ainda por vencer somem: eram a cobrança de um contrato que
 * acabou. As vencidas ficam, porque são aula que o aluno já teve e não pagou,
 * e sumir com elas seria a academia perdoar uma dívida sem ninguém pedir.
 */
export async function encerrarMatricula(
  tx: Prisma.TransactionClient,
  enrollmentId: string,
  quando: Date,
) {
  /* Só encerra o que ainda está ativo. Dois "trocar plano" (ou troca e
     cancelamento) ao mesmo tempo leram a matrícula ativa fora da transação;
     o segundo espera o primeiro no lock da linha, não acha mais nada ativo e
     desiste — em vez de encerrar de novo e abrir uma segunda matrícula. */
  const encerrada = await tx.enrollment.updateMany({
    where: { id: enrollmentId, isActive: true },
    data: { isActive: false, endDate: quando },
  });

  if (encerrada.count === 0) {
    throw new TRPCError({
      code: 'CONFLICT',
      message:
        'Esta matrícula acabou de ser alterada por outra pessoa. Recarregue a página.',
    });
  }

  const removidas = await tx.payment.deleteMany({
    where: {
      enrollmentId,
      status: PaymentStatus.PENDING,
      dueDate: { gte: quando },
    },
  });

  return removidas.count;
}
