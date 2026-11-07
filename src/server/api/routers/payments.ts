import {
  EFinanceEntryStatus,
  EFinanceEntryType,
  EPaymentMethod,
  PaymentStatus,
} from '@prisma/client';
import { createTRPCRouter, protectedProcedure, staffProcedure } from '../trpc';
import { calculateDiscount } from '@/utils/discountUtils';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { capitalize } from 'lodash';

export const paymentsRouter = createTRPCRouter({
  getPaymentsByStudent: protectedProcedure
    .input(z.object({ studentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { tenantId } = ctx;
      if (!userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      const entries = await ctx.prisma.payment.findMany({
        where: {
          studentId: input.studentId,
          // sem isto qualquer sessão lia as parcelas de qualquer aluno
          student: { tenantId },
        },
        include: {
          enrollment: {
            select: { modality: { select: { id: true, name: true } } },
          },
        },
      });

      const paid = entries.filter((e) => e.status === PaymentStatus.PAID);
      const pending = entries.filter((e) => e.status === PaymentStatus.PENDING);

      return {
        entries,
        paid,
        pending,
      };
    }),

  /** Parcelas do aluno paginadas, para a tela dedicada. */
  getPaymentsByStudentPaginated: protectedProcedure
    .input(
      z.object({
        studentId: z.string(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(10),
        status: z.enum(['ALL', 'PAID', 'PENDING']).default('ALL'),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { tenantId } = ctx;
      if (!userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      const student = await ctx.prisma.student.findFirst({
        where: { id: input.studentId, tenantId },
        select: { id: true, name: true },
      });

      if (!student) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Aluno não encontrado.',
        });
      }

      const where = {
        studentId: input.studentId,
        student: { tenantId },
        ...(input.status === 'ALL' ? {} : { status: input.status }),
      };

      const [data, total] = await Promise.all([
        ctx.prisma.payment.findMany({
          where,
          include: {
            enrollment: {
              select: { modality: { select: { id: true, name: true } } },
            },
          },
          orderBy: { dueDate: 'desc' },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
        }),
        ctx.prisma.payment.count({ where }),
      ]);

      return {
        student,
        data,
        pagination: {
          page: input.page,
          limit: input.limit,
          total,
          totalPages: Math.ceil(total / input.limit),
        },
      };
    }),

  updatePayment: staffProcedure
    .input(
      z.object({
        /* Pelo id, e não por aluno + vencimento: com uma matrícula por
           modalidade, duas parcelas do mesmo aluno podem vencer no mesmo
           dia, e a data sozinha não diz qual foi paga. */
        paymentId: z.string(),
        /** Promoção aplicada nesta parcela, se houver. */
        promotionId: z.string().uuid().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { tenantId } = ctx;
      if (!userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      try {
        const payment = await ctx.prisma.payment.findFirst({
          where: {
            id: input.paymentId,
            status: PaymentStatus.PENDING,
            /* Sem isto, qualquer sessão dava baixa em parcela de outra
               academia. */
            student: { tenantId },
          },
          include: {
            student: { select: { id: true, name: true } },
            enrollment: { select: { modality: { select: { name: true } } } },
          },
        });

        if (!payment) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Parcela pendente não encontrada.',
          });
        }

        const { student } = payment;

        let promotion = null;
        if (input.promotionId) {
          promotion = await ctx.prisma.promotion.findFirst({
            where: { id: input.promotionId, tenantId, isActive: true },
          });
          if (!promotion) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Promoção não encontrada ou inativa.',
            });
          }
        }

        const category = await ctx.prisma.category.findFirst({
          where: {
            tenantId,
            isFixed: true,
            name: { equals: 'Alunos', mode: 'insensitive' },
          },
        });

        if (!category?.id) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Categoria "Alunos" não encontrada',
          });
        }

        /* O valor é o da parcela, não o preço de hoje do plano: uma
           mensalidade reajustada não pode reescrever o que já estava
           combinado nas parcelas em aberto.
           Payment.amount fica em reais; FinanceEntry.amount, em centavos. */
        const fullAmount = Number(payment.amount);

        const discount = promotion
          ? calculateDiscount(
              fullAmount,
              promotion.discountType,
              promotion.discountValue,
            )
          : 0;

        // a receita entra pelo que foi de fato recebido
        const amount = (fullAmount - discount) * 100;

        /* O número da parcela conta dentro da matrícula dela: a 3ª do boxe
           não é a 7ª do aluno. Parcela antiga sem matrícula conta entre as
           do aluno, como antes. */
        const allPayments = await ctx.prisma.payment.findMany({
          where: payment.enrollmentId
            ? { enrollmentId: payment.enrollmentId }
            : { studentId: student.id },
          orderBy: { dueDate: 'asc' },
          select: { id: true },
        });
        const modalidade = payment.enrollment?.modality.name;
        const em = modalidade ? ` em ${modalidade}` : '';

        const parcelNumber =
          allPayments.findIndex((p) => p.id === payment.id) + 1;
        const monthYear = format(payment.dueDate, 'MMMM/yyyy', {
          locale: ptBR,
        });

        await ctx.prisma.$transaction([
          ctx.prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: PaymentStatus.PAID,
              paymentDate: new Date(),
              discountAmount: discount,
              promotionId: promotion?.id ?? null,
            },
          }),
          ctx.prisma.financeEntry.create({
            data: {
              date: new Date(),
              amount,
              paymentMethod: EPaymentMethod.CREDIT_CARD,
              description: promotion
                ? `Parcela ${parcelNumber} de ${student.name}${em} com vencimento em ${capitalize(monthYear)} (promoção: ${promotion.name}).`
                : `Parcela ${parcelNumber} de ${student.name}${em} com vencimento em ${capitalize(monthYear)}.`,
              type: EFinanceEntryType.STUDENTS,
              status: EFinanceEntryStatus.PAID,
              currency: 'BRL',
              userId,
              tenantId,
              categoryId: category.id,
              studentId: student.id,
            },
          }),
        ]);

        return { ok: true };
      } catch (err) {
        console.error(err);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erro ao atualizar pagamento.',
        });
      }
    }),
});
