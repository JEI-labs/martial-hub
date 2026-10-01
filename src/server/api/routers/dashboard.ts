// server/api/routers/painel.ts
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc';
import { deriveStudentStatus } from '@/server/utils/studentStatus';
import { monthlyValue } from '@/utils/planUtils';
import type { StudentStatus } from '@/server/utils/studentStatus';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  EFinanceEntryStatus,
  EFinanceEntryType,
  EMessageStatus,
  PaymentStatus,
} from '@prisma/client';
import type { EGraduation, EPaymentMethod } from '@prisma/client';
import {
  addDays,
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  format,
  startOfDay,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Métricas do dashboard.
 *
 * Duas unidades convivem no banco e é fácil errar: `Payment.amount` está em
 * reais e `FinanceEntry.amount`, em centavos. Tudo que sai daqui já está em
 * reais.
 *
 * `Plan.price` é o valor fechado do PERÍODO, não o da parcela. O MRR mede
 * receita por mês, então cada matrícula entra por `price / duration` —
 * inclusive a de um plano pago à vista: quem paga o trimestre adiantado
 * continua valendo um terço disso por mês.
 */

const CENTS = 100;

/** Até aqui a série sai em dias; passando disso, em meses. */
const DAY_SCALE_LIMIT = 62;

/** Teto de colunas do gráfico: além disso vira uma cerca ilegível. */
const MAX_MONTH_BUCKETS = 36;

type Bucket = { key: string; label: string; start: Date; end: Date };

/**
 * Fatia o período escolhido. Um intervalo de duas semanas em colunas mensais
 * seria um ponto só, e dois anos em colunas diárias seriam 700 barras — a
 * escala acompanha o que foi pedido.
 */
function periodBuckets(from: Date, to: Date): Array<Bucket> {
  const days = differenceInCalendarDays(to, from);

  if (days <= DAY_SCALE_LIMIT) {
    return Array.from({ length: Math.max(days, 0) + 1 }).map((_, index) => {
      const reference = addDays(startOfDay(from), index);
      return {
        key: format(reference, 'yyyy-MM-dd'),
        label: format(reference, 'dd/MM', { locale: ptBR }),
        start: reference,
        end: endOfDay(reference),
      };
    });
  }

  const last = startOfMonth(to);
  const first = startOfMonth(from);
  const span =
    (last.getFullYear() - first.getFullYear()) * 12 +
    (last.getMonth() - first.getMonth()) +
    1;
  const months = Math.min(span, MAX_MONTH_BUCKETS);

  return Array.from({ length: months }).map((_, index) => {
    const reference = startOfMonth(subMonths(last, months - 1 - index));
    return {
      key: format(reference, 'yyyy-MM'),
      label: format(reference, 'MMM/yy', { locale: ptBR }),
      start: reference,
      end: endOfMonth(reference),
    };
  });
}

export const dashboardRouter = createTRPCRouter({
  /**
   * Um round-trip só: os números do topo, as séries, as distribuições e as
   * listas de acompanhamento saem da mesma leitura.
   */
  getOverview: protectedProcedure
    .input(
      z
        .object({
          /* O mesmo filtro das outras telas manda aqui. Sem `from`, é a
             academia inteira desde o primeiro registro. */
          from: z.string().optional(),
          to: z.string().optional(),
        })
        .default({}),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { tenantId } = ctx;
      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Usuário não autenticado',
        });
      }

      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);
      const previousMonthStart = startOfMonth(subMonths(now, 1));
      const previousMonthEnd = endOfMonth(subMonths(now, 1));
      const rangeEnd = input.to ? endOfDay(new Date(input.to)) : now;
      const rangeStart = input.from ? startOfDay(new Date(input.from)) : null;
      /* Sem `from` a busca é aberta; com ele, começa no menor entre o
         período escolhido e o mês corrente. */
      const fetchStart = rangeStart
        ? new Date(Math.min(rangeStart.getTime(), monthStart.getTime()))
        : null;

      try {
        const [students, financeEntries, categories, messageLogs] =
          await Promise.all([
            ctx.prisma.student.findMany({
              where: { tenantId },
              include: {
                enrollments: {
                  include: { plan: true },
                  orderBy: { startDate: 'desc' },
                },
                payments: { orderBy: { dueDate: 'asc' } },
              },
            }),
            ctx.prisma.financeEntry.findMany({
              /* Os cards de cima falam sempre do mês corrente, mesmo com
                 o filtro num período antigo — então a busca desce até o
                 primeiro dos dois, senão "Resultado do mês" viria cortado. */
              where: {
                tenantId,
                ...(fetchStart ? { date: { gte: fetchStart } } : {}),
              },
              select: {
                amount: true,
                date: true,
                type: true,
                status: true,
                categoryId: true,
                paymentMethod: true,
              },
            }),
            ctx.prisma.category.findMany({
              where: { tenantId },
              select: { id: true, name: true },
            }),
            ctx.prisma.messageLog.findMany({
              where: { tenantId, createdAt: { gte: subMonths(now, 1) } },
              select: { status: true, event: true },
            }),
          ]);

        const categoryName = new Map(categories.map((c) => [c.id, c.name]));

        /* ---------------------------------------------------------------- */
        /* Alunos, matrículas e MRR                                          */
        /* ---------------------------------------------------------------- */

        type StudentRecord = (typeof students)[number];

        /** Vigente = marcada como ativa e ainda dentro do prazo. */
        const currentEnrollment = (student: StudentRecord) =>
          student.enrollments.find((e) => e.isActive && e.endDate >= now) ??
          null;

        const byStatus: Record<StudentStatus, number> = {
          'EM DIA': 0,
          'PENDENTE': 0,
          'ATRASADO': 0,
          'SEM MATRÍCULA': 0,
        };
        const byGraduation = new Map<EGraduation | 'SEM_GRADUACAO', number>();
        const byPlan = new Map<string, { students: number; mrr: number }>();

        let mrr = 0;
        let activeStudents = 0;

        for (const student of students) {
          const enrollment = currentEnrollment(student);

          const graduationKey = student.graduation ?? 'SEM_GRADUACAO';
          byGraduation.set(
            graduationKey,
            (byGraduation.get(graduationKey) ?? 0) + 1,
          );

          if (!enrollment?.plan) continue;

          activeStudents += 1;
          const monthly = monthlyValue(
            enrollment.plan.price,
            enrollment.plan.duration,
          );
          mrr += monthly;

          const plan = byPlan.get(enrollment.plan.name) ?? {
            students: 0,
            mrr: 0,
          };
          plan.students += 1;
          plan.mrr += monthly;
          byPlan.set(enrollment.plan.name, plan);

          byStatus[
            deriveStudentStatus(
              student.payments,
              student.enrollments.find((e) => e.isActive) ?? null,
              now,
            )
          ] += 1;
        }

        const newStudentsThisMonth = students.filter(
          (s) => s.createdAt >= monthStart && s.createdAt <= monthEnd,
        ).length;
        const newStudentsPreviousMonth = students.filter(
          (s) =>
            s.createdAt >= previousMonthStart &&
            s.createdAt <= previousMonthEnd,
        ).length;

        /* Saída = matrícula que venceu no mês sem nenhuma outra começar
           depois dela para o mesmo aluno. */
        const churnedThisMonth = students.filter((student) => {
          const endedNow = student.enrollments.some(
            (e) => e.endDate >= monthStart && e.endDate <= monthEnd,
          );
          if (!endedNow) return false;
          return !currentEnrollment(student);
        }).length;

        const activeAtMonthStart = students.filter((student) =>
          student.enrollments.some(
            (e) => e.startDate < monthStart && e.endDate >= monthStart,
          ),
        ).length;

        /* ---------------------------------------------------------------- */
        /* Parcelas: recebido, a receber e inadimplência                     */
        /* ---------------------------------------------------------------- */

        const allPayments = students.flatMap((student) =>
          student.payments.map((payment) => ({ ...payment, student })),
        );

        const received = (payment: {
          amount: unknown;
          discountAmount: unknown;
        }) => Number(payment.amount) - Number(payment.discountAmount);

        const receivedThisMonth = allPayments
          .filter(
            (p) =>
              p.status === PaymentStatus.PAID &&
              p.paymentDate >= monthStart &&
              p.paymentDate <= monthEnd,
          )
          .reduce((total, p) => total + received(p), 0);

        const overduePayments = allPayments.filter(
          (p) => p.status === PaymentStatus.PENDING && p.dueDate < now,
        );
        const overdueAmount = overduePayments.reduce(
          (total, p) => total + received(p),
          0,
        );
        const overdueStudents = new Set(
          overduePayments.map((p) => p.student.id),
        ).size;

        const upcoming30Days = allPayments
          .filter(
            (p) =>
              p.status === PaymentStatus.PENDING &&
              p.dueDate >= now &&
              p.dueDate <= addDays(now, 30),
          )
          .reduce((total, p) => total + received(p), 0);

        /** Faixas de atraso: o que passou de 60 dias raramente volta. */
        const agingBuckets = [
          { label: '1 a 30 dias', min: 1, max: 30, amount: 0, count: 0 },
          { label: '31 a 60 dias', min: 31, max: 60, amount: 0, count: 0 },
          { label: '61 a 90 dias', min: 61, max: 90, amount: 0, count: 0 },
          {
            label: 'mais de 90 dias',
            min: 91,
            max: Number.POSITIVE_INFINITY,
            amount: 0,
            count: 0,
          },
        ];

        for (const payment of overduePayments) {
          const daysLate = differenceInCalendarDays(now, payment.dueDate);
          const bucket = agingBuckets.find(
            (b) => daysLate >= b.min && daysLate <= b.max,
          );
          if (bucket) {
            bucket.amount += received(payment);
            bucket.count += 1;
          }
        }

        /* ---------------------------------------------------------------- */
        /* Financeiro (centavos no banco)                                    */
        /* ---------------------------------------------------------------- */

        const paidEntries = financeEntries.filter(
          (entry) => entry.status === EFinanceEntryStatus.PAID,
        );

        const isIncome = (type: EFinanceEntryType) =>
          type === EFinanceEntryType.INCOME ||
          type === EFinanceEntryType.STUDENTS;

        const monthEntries = paidEntries.filter(
          (entry) => entry.date >= monthStart && entry.date <= monthEnd,
        );

        /* As distribuições acompanham o filtro; os KPIs acima, não. */
        const rangeEntries = paidEntries.filter(
          (entry) =>
            (!rangeStart || entry.date >= rangeStart) && entry.date <= rangeEnd,
        );
        const incomeThisMonth = monthEntries
          .filter((entry) => isIncome(entry.type))
          .reduce((total, entry) => total + entry.amount / CENTS, 0);
        const expenseThisMonth = monthEntries
          .filter((entry) => entry.type === EFinanceEntryType.EXPENSE)
          .reduce((total, entry) => total + entry.amount / CENTS, 0);

        const expensesByCategory = Array.from(
          rangeEntries
            .filter((entry) => entry.type === EFinanceEntryType.EXPENSE)
            .reduce((map, entry) => {
              const name =
                categoryName.get(entry.categoryId) ?? 'Sem categoria';
              return map.set(name, (map.get(name) ?? 0) + entry.amount / CENTS);
            }, new Map<string, number>())
            .entries(),
        )
          .map(([name, amount]) => ({ name, amount }))
          .sort((a, b) => b.amount - a.amount);

        const incomeByMethod = Array.from(
          rangeEntries
            .filter((entry) => isIncome(entry.type))
            .reduce((map, entry) => {
              const method = entry.paymentMethod ?? 'NAO_INFORMADO';
              return map.set(
                method,
                (map.get(method) ?? 0) + entry.amount / CENTS,
              );
            }, new Map<EPaymentMethod | 'NAO_INFORMADO', number>())
            .entries(),
        )
          .map(([method, amount]) => ({ method, amount }))
          .sort((a, b) => b.amount - a.amount);

        /* ---------------------------------------------------------------- */
        /* Séries do período                                                 */
        /* ---------------------------------------------------------------- */

        /* Em "todas as datas" o começo é o primeiro movimento da academia:
           abrir em janeiro de 1970 daria um gráfico de linha reta. */
        const firstActivity = [
          ...financeEntries.map((entry) => entry.date),
          ...students.map((student) => student.createdAt),
        ].reduce<Date | null>(
          (earliest, date) => (!earliest || date < earliest ? date : earliest),
          null,
        );

        const seriesStart =
          rangeStart ?? firstActivity ?? startOfMonth(subMonths(rangeEnd, 11));
        const buckets = periodBuckets(seriesStart, rangeEnd);

        const series = buckets.map((bucket) => {
          /* MRR do período = matrículas que estavam vigentes no fim dele. */
          const monthlyRecurring = students.reduce((total, student) => {
            const enrollment = student.enrollments.find(
              (e) => e.startDate <= bucket.end && e.endDate >= bucket.end,
            );
            return (
              total +
              (enrollment?.plan
                ? monthlyValue(enrollment.plan.price, enrollment.plan.duration)
                : 0)
            );
          }, 0);

          const entriesOfBucket = paidEntries.filter(
            (entry) => entry.date >= bucket.start && entry.date <= bucket.end,
          );
          const income = entriesOfBucket
            .filter((entry) => isIncome(entry.type))
            .reduce((total, entry) => total + entry.amount / CENTS, 0);
          const expense = entriesOfBucket
            .filter((entry) => entry.type === EFinanceEntryType.EXPENSE)
            .reduce((total, entry) => total + entry.amount / CENTS, 0);

          return {
            month: bucket.key,
            label: bucket.label,
            mrr: monthlyRecurring,
            income,
            expense,
            net: income - expense,
            newStudents: students.filter(
              (s) => s.createdAt >= bucket.start && s.createdAt <= bucket.end,
            ).length,
            churned: students.filter((student) =>
              student.enrollments.some(
                (e) => e.endDate >= bucket.start && e.endDate <= bucket.end,
              ),
            ).length,
            received: allPayments
              .filter(
                (p) =>
                  p.status === PaymentStatus.PAID &&
                  p.paymentDate >= bucket.start &&
                  p.paymentDate <= bucket.end,
              )
              .reduce((total, p) => total + received(p), 0),
          };
        });

        /* ---------------------------------------------------------------- */
        /* Listas de acompanhamento                                          */
        /* ---------------------------------------------------------------- */

        const topOverdue = Array.from(
          overduePayments
            .reduce((map, payment) => {
              const current = map.get(payment.student.id) ?? {
                id: payment.student.id,
                name: payment.student.name,
                amount: 0,
                installments: 0,
                daysLate: 0,
              };
              current.amount += received(payment);
              current.installments += 1;
              current.daysLate = Math.max(
                current.daysLate,
                differenceInCalendarDays(now, payment.dueDate),
              );
              return map.set(payment.student.id, current);
            }, new Map<string, { id: string; name: string; amount: number; installments: number; daysLate: number }>())
            .values(),
        )
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 8);

        const expiringEnrollments = students
          .flatMap((student) =>
            student.enrollments
              .filter(
                (e) =>
                  e.isActive &&
                  e.endDate >= now &&
                  e.endDate <= addDays(now, 30),
              )
              .map((e) => ({
                id: e.id,
                studentId: student.id,
                studentName: student.name,
                planName: e.plan?.name ?? 'Sem plano',
                endDate: e.endDate,
                daysLeft: differenceInCalendarDays(e.endDate, now),
              })),
          )
          .sort((a, b) => a.daysLeft - b.daysLeft)
          .slice(0, 8);

        const currentMonthNumber = now.getMonth();
        const birthdays = students
          .filter(
            (s) => s.birthDate && s.birthDate.getMonth() === currentMonthNumber,
          )
          .map((s) => ({
            id: s.id,
            name: s.name,
            day: s.birthDate?.getDate() ?? 0,
          }))
          .sort((a, b) => a.day - b.day);

        const messagesSent = messageLogs.filter(
          (log) => log.status === EMessageStatus.SENT,
        ).length;

        return {
          ok: true,
          generatedAt: now,
          kpis: {
            mrr,
            arr: mrr * 12,
            arpu: activeStudents > 0 ? mrr / activeStudents : 0,
            activeStudents,
            totalStudents: students.length,
            newStudentsThisMonth,
            newStudentsPreviousMonth,
            churnedThisMonth,
            churnRate:
              activeAtMonthStart > 0
                ? (churnedThisMonth / activeAtMonthStart) * 100
                : 0,
            receivedThisMonth,
            overdueAmount,
            overdueStudents,
            upcoming30Days,
            incomeThisMonth,
            expenseThisMonth,
            netThisMonth: incomeThisMonth - expenseThisMonth,
          },
          series,
          breakdowns: {
            byStatus: (Object.keys(byStatus) as Array<StudentStatus>).map(
              (status) => ({ status, students: byStatus[status] }),
            ),
            byPlan: Array.from(byPlan.entries())
              .map(([name, value]) => ({ name, ...value }))
              .sort((a, b) => b.mrr - a.mrr),
            byGraduation: Array.from(byGraduation.entries())
              .map(([graduation, students]) => ({ graduation, students }))
              .sort((a, b) =>
                String(a.graduation).localeCompare(String(b.graduation)),
              ),
            expensesByCategory,
            incomeByMethod,
            aging: agingBuckets.map(({ label, amount, count }) => ({
              label,
              amount,
              count,
            })),
          },
          alerts: {
            topOverdue,
            expiringEnrollments,
            birthdays,
            messages: {
              sent: messagesSent,
              failed: messageLogs.length - messagesSent,
            },
          },
        };
      } catch (error) {
        console.error('Erro ao montar o dashboard:', error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Não foi possível carregar as métricas do dashboard',
        });
      }
    }),
});
