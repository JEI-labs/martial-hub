import {
  createTRPCRouter,
  protectedProcedure,
  staffProcedure,
  teacherProcedure,
} from '@/server/api/trpc';

import {
  createStudentSchema,
  enrollmentRequestSchema,
  updateAvatarSchema,
  updateStudentSchema,
} from '@/server/validations/students';
import { convertToDate } from '@/utils/converterUtils';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { del } from '@vercel/blob';
import { Prisma } from '@prisma/client';
import { getAllStudentInputSchema } from '@/server/validations/pagination';
import { conferirGraduacao, graduationSelect } from '@/server/graduations';
import {
  descontosDasMatriculas,
  precoNaModalidade,
} from '@/common/utils/pricing';
import {
  categoriaDeAlunos,
  conferirModalidadeEPlano,
  descontoDaAcademia,
  encerrarMatricula,
  enrollmentInclude,
  matricular,
} from '@/server/enrollments';
import { deriveStudentStatus } from '@/server/utils/studentStatus';

export const studentRouter = createTRPCRouter({
  create: staffProcedure
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

      await conferirGraduacao(ctx.prisma, tenantId, input.graduationId);

      // 2) Cada matrícula pedida: modalidade e plano desta academia
      const pedidas = await Promise.all(
        input.enrollments.map((pedido) =>
          conferirModalidadeEPlano(ctx.prisma, tenantId, pedido),
        ),
      );
      const category = await categoriaDeAlunos(ctx.prisma, tenantId);

      /* Desconto da 2ª modalidade em diante: aluno novo paga cheio na mais
         cara e ganha desconto nas outras. */
      const descontos = descontosDasMatriculas(
        pedidas.map(({ modality, plan }) =>
          precoNaModalidade(plan, modality.id),
        ),
        0,
        await descontoDaAcademia(ctx.prisma, tenantId),
      );

      try {
        const createdStudent = await ctx.prisma.$transaction(async (tx) => {
          const student = await tx.student.create({
            data: {
              email: input.email,
              name: input.name,
              phone: input.phone,
              birthDate: birthDateFormatted,
              graduationId: input.graduationId ?? null,
              avatar: input.avatarUrl,
              userId,
              tenantId,
            },
          });

          /* 3) Uma matrícula por modalidade, cada uma com o seu plano e as
                suas parcelas. */
          for (const [index, { modality, plan }] of pedidas.entries()) {
            await matricular(tx, {
              student,
              modality,
              plan,
              startDate,
              userId,
              tenantId,
              categoryId: category.id,
              discountPercent: descontos[index] ?? 0,
            });
          }

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

  /**
   * Matricula um aluno que já existe em mais uma modalidade — ou de volta
   * numa que ele tinha cancelado. Uma matrícula ativa por modalidade: para
   * mudar o plano da que já existe, é a troca de plano.
   */
  addEnrollment: staffProcedure
    .input(enrollmentRequestSchema.extend({ studentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { tenantId } = ctx;

      const student = await ctx.prisma.student.findFirst({
        where: { id: input.studentId, tenantId },
        select: { id: true, name: true },
      });

      if (!student) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Aluno não encontrado',
        });
      }

      const { modality, plan } = await conferirModalidadeEPlano(
        ctx.prisma,
        tenantId,
        input,
      );
      const category = await categoriaDeAlunos(ctx.prisma, tenantId);

      return ctx.prisma.$transaction(async (tx) => {
        /* Dentro da transação: dois cliques seguidos não podem abrir duas
           matrículas ativas na mesma modalidade. */
        const jaTem = await tx.enrollment.findFirst({
          where: {
            studentId: student.id,
            modalityId: modality.id,
            isActive: true,
          },
          select: { id: true },
        });

        if (jaTem) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `${student.name} já está matriculado em ${modality.name}. Para mudar o plano, use a troca de plano.`,
          });
        }

        /* Quem já faz outra modalidade ganha o desconto nesta. */
        const ativas = await tx.enrollment.count({
          where: { studentId: student.id, isActive: true },
        });
        const [discountPercent = 0] = descontosDasMatriculas(
          [precoNaModalidade(plan, modality.id)],
          ativas,
          await descontoDaAcademia(tx, tenantId),
        );

        const { enrollment, installments } = await matricular(tx, {
          student,
          modality,
          plan,
          startDate: new Date(),
          userId,
          tenantId,
          categoryId: category.id,
          discountPercent,
        });

        return { ok: true, enrollmentId: enrollment.id, installments };
      });
    }),

  updateAvatar: staffProcedure
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

  updateByID: staffProcedure
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

      await conferirGraduacao(ctx.prisma, tenantId, input.graduationId);

      const updated = await ctx.prisma.student.update({
        where: { id: input.id, tenantId },
        data: {
          name: input.name,
          email: input.email,
          phone: input.phone,
          birthDate: birthDateFormatted,
          /* Só quando veio: o formulário de edição não manda a graduação, e
             gravar nulo nesse caso apagava a faixa de quem era editado. */
          ...(input.graduationId !== undefined
            ? { graduationId: input.graduationId }
            : {}),
        },
      });

      return {
        message: 'Aluno atualizado com sucesso',
        data: updated,
      };
    }),

  /** Só a graduação: a tela do aluno edita isso num modal à parte. */
  updateGraduation: teacherProcedure
    .input(
      z.object({
        id: z.string(),
        graduationId: z.string().uuid().nullable(),
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

      await conferirGraduacao(ctx.prisma, tenantId, input.graduationId);

      // updateMany para o filtro por tenant entrar no WHERE: um update
      // simples por id deixaria alterar aluno de outra academia
      const result = await ctx.prisma.student.updateMany({
        where: { id: input.id, tenantId },
        data: { graduationId: input.graduationId },
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
                include: enrollmentInclude,
                orderBy: { modality: { position: 'asc' } },
              },
              graduation: { select: graduationSelect },
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
          const status = deriveStudentStatus(
            student.payments,
            student.enrollments,
            now,
          );

          return {
            ...student,
            status,
            /* O que o aluno faz, modalidade a modalidade: a lista mostra e
               oferece a troca de plano de cada uma. */
            activeEnrollments: student.enrollments.map((e) => ({
              id: e.id,
              modality: e.modality,
              planId: e.planId,
              planName: e.plan.name,
              price: e.price,
              discountPercent: e.discountPercent,
              endDate: e.endDate,
            })),
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
            include: enrollmentInclude,
            orderBy: { startDate: 'desc' },
          },
          payments: {
            orderBy: { dueDate: 'asc' },
            include: {
              enrollment: {
                select: { modality: { select: { id: true, name: true } } },
              },
            },
          },
          FinanceEntry: {
            include: { category: true },
            orderBy: { date: 'desc' },
          },
          graduation: { select: graduationSelect },
        },
      });

      if (!student) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Aluno não encontrado.',
        });
      }

      /* As ativas na ordem das modalidades da academia: é a ordem em que a
         ficha mostra. */
      const activeEnrollments = student.enrollments
        .filter((e) => e.isActive)
        .sort((x, y) => x.modality.position - y.modality.position);

      const paid = student.payments.filter((p) => p.status === 'PAID');
      const pending = student.payments.filter((p) => p.status === 'PENDING');
      const overdue = pending.filter((p) => p.dueDate < new Date());

      const sum = (items: Array<{ amount: Prisma.Decimal }>) =>
        items.reduce((acc, item) => acc + Number(item.amount), 0);

      return {
        data: {
          ...student,
          status: deriveStudentStatus(student.payments, activeEnrollments),
          activeEnrollments,
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
   * Troca o plano de uma matrícula valendo de hoje, sem mexer nas outras
   * modalidades do aluno.
   *
   * A matrícula atual é encerrada na data de hoje e uma nova começa na mesma
   * modalidade, no plano escolhido — o histórico guarda as duas, então dá
   * para ver quando o aluno mudou. As parcelas ainda por vencer da matrícula
   * velha somem; as vencidas ficam (ver `encerrarMatricula`).
   */
  changePlan: staffProcedure
    .input(z.object({ enrollmentId: z.string(), planId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { tenantId } = ctx;
      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Não autorizado',
        });
      }

      const current = await ctx.prisma.enrollment.findFirst({
        where: {
          id: input.enrollmentId,
          isActive: true,
          student: { tenantId },
        },
        include: {
          student: { select: { id: true, name: true } },
          modality: { select: { id: true, name: true, isActive: true } },
        },
      });

      if (!current) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Matrícula ativa não encontrada',
        });
      }

      if (current.planId === input.planId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'O aluno já está neste plano.',
        });
      }

      const plan = await ctx.prisma.plan.findFirst({
        where: { id: input.planId, tenantId },
        include: { modalityPrices: true },
      });
      if (!plan) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Plano não encontrado',
        });
      }

      const category = await categoriaDeAlunos(ctx.prisma, tenantId);
      const startDate = new Date();

      /* A troca continua o contrato daquela modalidade: se ela era a que
         tinha desconto de 2ª modalidade, a nova também tem, no desconto de
         hoje da academia. Recalcular pelas outras ativas daria desconto às
         duas quando o aluno troca o plano da que paga cheio. */
      const discountPercent =
        current.discountPercent > 0
          ? await descontoDaAcademia(ctx.prisma, tenantId)
          : 0;

      try {
        const result = await ctx.prisma.$transaction(async (tx) => {
          const cancelled = await encerrarMatricula(tx, current.id, startDate);

          /* Mesma modalidade, mesmo que ela tenha sido desativada depois: a
             troca de plano continua o contrato, não é matrícula nova. */
          const { installments } = await matricular(tx, {
            student: current.student,
            modality: current.modality,
            plan,
            startDate,
            userId,
            tenantId,
            categoryId: category.id,
            motivo: 'na troca de plano',
            discountPercent,
          });

          return { cancelled, installments };
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
   * Cancela uma matrícula valendo de hoje — só aquela modalidade. O aluno
   * continua cadastrado, com todo o histórico, e as outras modalidades
   * seguem: parar o jiu-jitsu não derruba o boxe. Sem nenhuma matrícula
   * ativa, o status vira "SEM MATRÍCULA".
   */
  cancelEnrollment: staffProcedure
    .input(z.object({ enrollmentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { tenantId } = ctx;

      const enrollment = await ctx.prisma.enrollment.findFirst({
        where: { id: input.enrollmentId, student: { tenantId } },
        select: { id: true, isActive: true },
      });

      if (!enrollment) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Matrícula não encontrada',
        });
      }

      if (!enrollment.isActive) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Esta matrícula já está encerrada.',
        });
      }

      try {
        const cancelled = await ctx.prisma.$transaction((tx) =>
          encerrarMatricula(tx, enrollment.id, new Date()),
        );

        return { ok: true, cancelled };
      } catch (error) {
        console.error('Erro ao cancelar a matrícula:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Não foi possível cancelar a matrícula',
        });
      }
    }),

  delete: staffProcedure
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
