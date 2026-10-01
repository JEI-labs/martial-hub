import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc';

import {
  createStudentSchema,
  updateAvatarSchema,
  updateStudentSchema,
} from '@/server/validations/students';
import { convertToDate } from '@/utils/converterUtils';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { del } from '@vercel/blob';
import {
  EFinanceEntryStatus,
  EFinanceEntryType,
  EGraduation,
  EPaymentMethod,
  EPlanBilling,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { getAllStudentInputSchema } from '@/server/validations/pagination';
import { deriveStudentStatus } from '@/server/utils/studentStatus';
import { installmentCount, splitIntoInstallments } from '@/utils/planUtils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const studentRouter = createTRPCRouter({
  create: protectedProcedure
    .input(createStudentSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { tenantId } = ctx;
      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Não autorizado',
        });
      }

      // Formata datas e define início
      const birthDateFormatted = convertToDate(input.birthDate);
      const startDate = new Date();

      // 1) Verifica e-mail duplicado
      const emailExists = await ctx.prisma.student.findFirst({
        where: { email: input.email, tenantId },
      });

      if (emailExists) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Email já cadastrado',
        });
      }

      // 2) Carrega o plano
      const plan = await ctx.prisma.plan.findUnique({
        where: { id: input.planId },
      });
      if (!plan) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Plano não encontrado',
        });
      }

      try {
        const createdStudent = await ctx.prisma.$transaction(async (tx) => {
          // 3. Criação do aluno
          const student = await tx.student.create({
            data: {
              email: input.email,
              name: input.name,
              phone: input.phone,
              birthDate: birthDateFormatted,
              graduation: input.graduation ?? null,
              avatar: input.avatarUrl,
              userId,
              tenantId,
            },
          });

          // 4. Criação da matrícula
          await tx.enrollment.create({
            data: {
              studentId: student.id,
              planId: plan.id,
              startDate,
              endDate: new Date(
                new Date(startDate).setMonth(
                  startDate.getMonth() + plan.duration,
                ),
              ),
            },
          });

          /* 5. Geração dos pagamentos.

             Plano mensal: uma parcela por mês de duração, a primeira já paga
             na matrícula. Plano à vista: uma parcela só, com o período
             inteiro — quem paga o trimestre adiantado não tem mensalidade
             vencendo no meio dele, e a próxima cobrança é a renovação. */
          const amounts = splitIntoInstallments(
            plan.price,
            installmentCount(plan.duration, plan.billing),
          );

          const payments = amounts.map((cents, i) => {
            const dueDate = new Date(startDate);
            dueDate.setMonth(dueDate.getMonth() + i);
            return {
              studentId: student.id,
              amount: cents / 100,
              dueDate,
              status: i === 0 ? PaymentStatus.PAID : PaymentStatus.PENDING,
            };
          });
          await tx.payment.createMany({ data: payments });

          // 6. Busca da categoria fixa do usuário
          const category = await tx.category.findFirst({
            where: {
              tenantId,
              isFixed: true,
              name: { equals: 'Alunos', mode: 'insensitive' },
            },
          });
          if (!category?.id) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Categoria fixa não encontrada para criação do aluno',
            });
          }

          const firstDueDate = format(startDate, 'MMMM/yyyy', { locale: ptBR });
          const isUpfront = plan.billing === EPlanBilling.UPFRONT;

          // 7. Criação da entrada financeira (só o que foi pago agora)
          await tx.financeEntry.create({
            data: {
              amount: amounts[0] ?? 0,
              date: startDate,
              type: EFinanceEntryType.STUDENTS,
              description: isUpfront
                ? `${plan.name} de ${student.name} pago à vista (${plan.duration} ${plan.duration === 1 ? 'mês' : 'meses'} a partir de ${firstDueDate}).`
                : `Parcela 1 de ${student.name} com vencimento em ${firstDueDate}.`,
              status: PaymentStatus.PAID,
              currency: 'BRL',
              paymentMethod: EPaymentMethod.CREDIT_CARD,
              userId,
              tenantId,
              categoryId: category.id,
              studentId: student.id,
            },
          });

          return student;
        });

        return { ok: true, data: createdStudent };
      } catch (error) {
        console.error(error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Não foi possível cadastrar aluno',
        });
      }
    }),

  updateAvatar: protectedProcedure
    .input(updateAvatarSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { tenantId } = ctx;

      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Não autorizado',
        });
      }

      const studentExists = await ctx.prisma.student.findFirst({
        where: {
          id: input.studentId,
          tenantId,
        },
      });

      if (!studentExists) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Aluno não existe',
        });
      }

      await ctx.prisma.student.update({
        where: {
          id: input.studentId,
          tenantId,
        },
        data: {
          avatar: input.avatarUrl,
        },
      });

      return {
        ok: true,
        message: 'Avatar atualizado com sucesso!',
      };
    }),

  updateByID: protectedProcedure
    .input(updateStudentSchema)
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      const { tenantId } = ctx;

      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Não autorizado',
        });
      }

      const birthDateFormatted = convertToDate(input.birthDate);

      // 1) Procura por ALGUÉM que não seja o próprio ID mas já tenha este e-mail
      const conflict = await ctx.prisma.student.findFirst({
        where: {
          tenantId,
          email: input.email,
          NOT: { id: input.id },
        },
      });
      if (conflict) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Já existe um aluno com esse email',
        });
      }

      const updated = await ctx.prisma.student.update({
        where: { id: input.id, tenantId },
        data: {
          name: input.name,
          email: input.email,
          phone: input.phone,
          birthDate: birthDateFormatted,
          graduation: input.graduation ?? null,
        },
      });

      return {
        message: 'Aluno atualizado com sucesso',
        data: updated,
      };
    }),

  /** Só a graduação: a tela do aluno edita isso num modal à parte. */
  updateGraduation: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        graduation: z.nativeEnum(EGraduation).nullable(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      const { tenantId } = ctx;

      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Não autorizado',
        });
      }

      // updateMany para o filtro por userId entrar no WHERE: um update
      // simples por id deixaria alterar aluno de outro usuário
      const result = await ctx.prisma.student.updateMany({
        where: { id: input.id, tenantId },
        data: { graduation: input.graduation },
      });

      if (result.count === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Aluno não encontrado.',
        });
      }

      return { message: 'Graduação atualizada com sucesso' };
    }),

  getAll: protectedProcedure
    .input(getAllStudentInputSchema)
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { tenantId } = ctx;

      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Não autorizado',
        });
      }

      const { page, limit, search, status, from, to } = input;
      const skip = (page - 1) * limit;

      try {
        // Construir filtro dinâmico

        const whereConditions: Prisma.StudentWhereInput = {
          tenantId,
        };

        if (search && search.trim() !== '') {
          whereConditions.name = {
            contains: search.trim(),
            mode: 'insensitive',
          };
        }

        // Filtros de data (data de criação do aluno)
        if (from || to) {
          whereConditions.createdAt = {};
          if (from) whereConditions.createdAt.gte = new Date(from);
          if (to) whereConditions.createdAt.lte = new Date(to);
        }

        const [students, total] = await Promise.all([
          ctx.prisma.student.findMany({
            where: whereConditions,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
              payments: true,
              enrollments: {
                where: { isActive: true },
                include: { plan: true },
              },
            },
          }),
          // precisa dos mesmos filtros do findMany: contando só por tenantId,
          // o total ignorava busca e datas e a paginação inventava páginas
          ctx.prisma.student.count({
            where: whereConditions,
          }),
        ]);

        // Montar status calculado para cada aluno
        const now = new Date();
        const result = students.map((student) => {
          const activeEnrollment = student.enrollments.find((e) => e.isActive);

          const status = deriveStudentStatus(
            student.payments,
            activeEnrollment,
            now,
          );

          return {
            ...student,
            status,
            planName: activeEnrollment?.plan?.name ?? 'Sem plano',
            /* A lista oferece a troca de plano, e para isso precisa saber
               qual é o de agora — senão ele apareceria entre as opções. */
            planId: activeEnrollment?.planId ?? null,
          };
        });

        // Se filtro por status foi passado, filtra após o map
        const filteredResult =
          status && status.length > 0
            ? result.filter((student) => status.includes(student.status))
            : result;

        const filteredTotal =
          status && status.length > 0 ? filteredResult.length : total;
        const paginatedResult = filteredResult.slice(0, limit);

        return {
          ok: true,
          data: paginatedResult,
          pagination: {
            page,
            limit,
            total: filteredTotal,
            totalPages: Math.ceil(filteredTotal / limit),
          },
        };
      } catch (error) {
        console.log(error);
        if (error instanceof TRPCError) throw error;

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Não foi possível carregar alunos',
        });
      }
    }),

  /** Tudo que a tela de detalhe do aluno mostra, numa query só. */
  getDetailsByID: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      const { tenantId } = ctx;

      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Não autorizado',
        });
      }

      const student = await ctx.prisma.student.findFirst({
        where: { id: input.id, tenantId },
        include: {
          enrollments: {
            include: { plan: true },
            orderBy: { startDate: 'desc' },
          },
          payments: { orderBy: { dueDate: 'asc' } },
          FinanceEntry: {
            include: { category: true },
            orderBy: { date: 'desc' },
          },
        },
      });

      if (!student) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Aluno não encontrado.',
        });
      }

      const activeEnrollment =
        student.enrollments.find((e) => e.isActive) ?? null;

      const paid = student.payments.filter((p) => p.status === 'PAID');
      const pending = student.payments.filter((p) => p.status === 'PENDING');
      const overdue = pending.filter((p) => p.dueDate < new Date());

      const sum = (items: Array<{ amount: Prisma.Decimal }>) =>
        items.reduce((acc, item) => acc + Number(item.amount), 0);

      return {
        data: {
          ...student,
          status: deriveStudentStatus(student.payments, activeEnrollment),
          activeEnrollment,
          planName: activeEnrollment?.plan?.name ?? 'Sem plano',
          totals: {
            paidCount: paid.length,
            pendingCount: pending.length,
            overdueCount: overdue.length,
            paidAmount: sum(paid),
            pendingAmount: sum(pending),
          },
        },
      };
    }),

  getByID: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      const { tenantId } = ctx;

      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Não autorizado',
        });
      }

      const studentData = await ctx.prisma.student.findFirst({
        where: {
          id: input.id,
          tenantId,
        },
      });

      if (!studentData) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Categoria não encontrada.',
          cause: { id: input.id, userId: ctx.session.user.id },
        });
      }

      return {
        message: 'Aluno encontrado',
        data: studentData,
      };
    }),

  /**
   * Troca o plano do aluno valendo de hoje.
   *
   * A matrícula atual é encerrada na data de hoje e uma nova começa no plano
   * escolhido — o histórico guarda as duas, então dá para ver quando o aluno
   * mudou. As parcelas ainda por vencer do plano antigo somem: elas eram a
   * cobrança de um contrato que não existe mais. As vencidas ficam, porque são
   * aula que o aluno já teve e não pagou, e sumir com elas seria a academia
   * perdoar uma dívida sem ninguém pedir.
   */
  changePlan: protectedProcedure
    .input(z.object({ studentId: z.string(), planId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { tenantId } = ctx;
      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Não autorizado',
        });
      }

      const student = await ctx.prisma.student.findFirst({
        where: { id: input.studentId, tenantId },
        include: {
          enrollments: { where: { isActive: true }, include: { plan: true } },
        },
      });

      if (!student) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Aluno não encontrado',
        });
      }

      const plan = await ctx.prisma.plan.findFirst({
        where: { id: input.planId, tenantId },
      });

      if (!plan) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Plano não encontrado',
        });
      }

      const current = student.enrollments[0];
      if (current?.planId === plan.id) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'O aluno já está neste plano.',
        });
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

      const startDate = new Date();

      try {
        const result = await ctx.prisma.$transaction(async (tx) => {
          await tx.enrollment.updateMany({
            where: { studentId: student.id, isActive: true },
            data: { isActive: false, endDate: startDate },
          });

          const cancelled = await tx.payment.deleteMany({
            where: {
              studentId: student.id,
              status: PaymentStatus.PENDING,
              dueDate: { gte: startDate },
            },
          });

          await tx.enrollment.create({
            data: {
              studentId: student.id,
              planId: plan.id,
              startDate,
              endDate: new Date(
                new Date(startDate).setMonth(
                  startDate.getMonth() + plan.duration,
                ),
              ),
            },
          });

          const amounts = splitIntoInstallments(
            plan.price,
            installmentCount(plan.duration, plan.billing),
          );

          await tx.payment.createMany({
            data: amounts.map((cents, index) => {
              const dueDate = new Date(startDate);
              dueDate.setMonth(dueDate.getMonth() + index);
              return {
                studentId: student.id,
                amount: cents / 100,
                dueDate,
                status:
                  index === 0 ? PaymentStatus.PAID : PaymentStatus.PENDING,
              };
            }),
          });

          const firstDueDate = format(startDate, 'MMMM/yyyy', { locale: ptBR });
          const isUpfront = plan.billing === EPlanBilling.UPFRONT;

          await tx.financeEntry.create({
            data: {
              amount: amounts[0] ?? 0,
              date: startDate,
              type: EFinanceEntryType.STUDENTS,
              description: isUpfront
                ? `${plan.name} de ${student.name} pago à vista na troca de plano (${plan.duration} ${plan.duration === 1 ? 'mês' : 'meses'} a partir de ${firstDueDate}).`
                : `Parcela 1 de ${student.name} no plano ${plan.name} com vencimento em ${firstDueDate}.`,
              status: EFinanceEntryStatus.PAID,
              currency: 'BRL',
              paymentMethod: EPaymentMethod.CREDIT_CARD,
              userId,
              tenantId,
              categoryId: category.id,
              studentId: student.id,
            },
          });

          return { cancelled: cancelled.count, installments: amounts.length };
        });

        return { ok: true, ...result };
      } catch (error) {
        console.error('Erro ao trocar o plano do aluno:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Não foi possível trocar o plano',
        });
      }
    }),

  /**
   * Cancela a matrícula valendo de hoje. O aluno continua cadastrado, com todo
   * o histórico: cancelar não é excluir. Fica sem plano em vigor até alguém
   * matriculá-lo de novo, e é isso que o status "SEM MATRÍCULA" mostra.
   *
   * As parcelas ainda por vencer somem junto — cobrar mensalidade de quem não
   * treina mais seria erro de cobrança. As atrasadas ficam: é aula que já
   * aconteceu e não foi paga.
   */
  cancelEnrollment: protectedProcedure
    .input(z.object({ studentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { tenantId } = ctx;
      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Não autorizado',
        });
      }

      const student = await ctx.prisma.student.findFirst({
        where: { id: input.studentId, tenantId },
        include: { enrollments: { where: { isActive: true } } },
      });

      if (!student) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Aluno não encontrado',
        });
      }

      if (student.enrollments.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Este aluno não tem matrícula ativa.',
        });
      }

      const now = new Date();

      try {
        const cancelled = await ctx.prisma.$transaction(async (tx) => {
          await tx.enrollment.updateMany({
            where: { studentId: student.id, isActive: true },
            data: { isActive: false, endDate: now },
          });

          const removed = await tx.payment.deleteMany({
            where: {
              studentId: student.id,
              status: PaymentStatus.PENDING,
              dueDate: { gte: now },
            },
          });

          return removed.count;
        });

        return { ok: true, cancelled };
      } catch (error) {
        console.error('Erro ao cancelar a matrícula:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Não foi possível cancelar a matrícula',
        });
      }
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { tenantId } = ctx;

      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Não autorizado',
        });
      }

      try {
        const student = await ctx.prisma.student.findUnique({
          where: { id: input.id, tenantId },
        });

        if (!student) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Aluno nao encontrado',
          });
        }

        if (student.avatar) {
          try {
            await del(student.avatar);
          } catch (err) {
            console.error('Erro ao deletar avatar do Vercel Blob:', err);
          }
        }
        await ctx.prisma.financeEntry.deleteMany({
          where: {
            tenantId,
            studentId: student.id,
          },
        });

        await ctx.prisma.student.delete({
          where: { id: input.id, tenantId },
        });

        return {
          ok: true,
          message: 'Aluno deletado com sucesso',
        };
      } catch (error) {
        console.log(error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Não foi possível deletar aluno',
        });
      }
    }),
});
