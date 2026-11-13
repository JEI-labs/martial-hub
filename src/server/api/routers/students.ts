import {
  createTRPCRouter,
  protectedProcedure,
  staffProcedure,
  teacherProcedure,
} from '@/server/api/trpc';

import {
  awardGraduationSchema,
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
import {
  conferirFaixa,
  faixasAtuais,
  maisRecentesPrimeiro,
  faixaAtualSelect,
  studentGraduationSelect,
  traduzirFaixaSumida,
} from '@/server/graduations';
import { diaDe, diaDoTexto } from '@/common/utils/dia';
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
  enrollmentModalitySelect,
  matricular,
  planoDesativado,
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

      /* A faixa de cada modalidade, quando veio: tem de ser daquela
         modalidade, não de outra. */
      await Promise.all(
        input.enrollments.map((pedido) =>
          pedido.graduationId
            ? conferirFaixa(
                ctx.prisma,
                tenantId,
                pedido.graduationId,
                pedido.modalityId,
              )
            : null,
        ),
      );

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
        pedidas.map(({ modality, plan }) => ({
          preco: precoNaModalidade(plan, modality.id),
          duracao: plan.duration,
        })),
        [],
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

          /* A faixa com que ele já chega, em cada modalidade: o primeiro
             registro do histórico dele. */
          const faixas = input.enrollments.flatMap((pedido) =>
            pedido.graduationId ? [pedido.graduationId] : [],
          );
          if (faixas.length > 0) {
            await tx.studentGraduation.createMany({
              data: faixas.map((graduationId) => ({
                studentId: student.id,
                graduationId,
                awardedAt: diaDe(startDate),
                userId,
              })),
            });
          }

          return student;
        });

        return { ok: true, data: createdStudent };
      } catch (err) {
        const error = traduzirFaixaSumida(err);
        if (error instanceof TRPCError) throw error;
        console.error(error);
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
      /* A faixa com que ele chega nesta modalidade, quando veio — como no
         cadastro. Antes o campo era aceito e jogado fora em silêncio. */
      if (input.graduationId) {
        await conferirFaixa(
          ctx.prisma,
          tenantId,
          input.graduationId,
          modality.id,
        );
      }
      const category = await categoriaDeAlunos(ctx.prisma, tenantId);

      return ctx.prisma.$transaction(async (tx) => {
        /* A mensagem amigável para o caso comum. Quem garante de verdade é
           o índice único parcial em (studentId, modalityId) das ativas: no
           READ COMMITTED, dois pedidos simultâneos passam os dois por esta
           busca, e o segundo insert é recusado (ver `matricular`). */
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

        /* Desconto só se outra matrícula vigente do aluno paga cheio (ver
           `descontosDasMatriculas`): vencida não conta, e sem ninguém
           pagando cheio esta é que paga. */
        const outras = await tx.enrollment.findMany({
          where: {
            studentId: student.id,
            isActive: true,
            endDate: { gte: new Date() },
          },
          select: { discountPercent: true },
        });
        const [discountPercent = 0] = descontosDasMatriculas(
          [
            {
              preco: precoNaModalidade(plan, modality.id),
              duracao: plan.duration,
            },
          ],
          outras,
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

        if (input.graduationId) {
          await tx.studentGraduation
            .create({
              data: {
                studentId: student.id,
                graduationId: input.graduationId,
                awardedAt: diaDe(),
                userId,
              },
            })
            .catch((err: unknown) => {
              throw traduzirFaixaSumida(err);
            });
        }

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

      const updated = await ctx.prisma.student.update({
        where: { id: input.id, tenantId },
        data: {
          name: input.name,
          email: input.email,
          phone: input.phone,
          birthDate: birthDateFormatted,
        },
      });

      return {
        message: 'Aluno atualizado com sucesso',
        data: updated,
      };
    }),

  /**
   * Gradua o aluno numa modalidade: um registro novo no histórico, que passa
   * a ser a faixa atual dele ali. As anteriores ficam, como a linha do tempo.
   * Só em modalidade que ele faz — a matrícula ativa diz isso.
   */
  awardGraduation: teacherProcedure
    .input(awardGraduationSchema)
    .mutation(async ({ input, ctx }) => {
      const { tenantId } = ctx;

      const faixa = await conferirFaixa(
        ctx.prisma,
        tenantId,
        input.graduationId,
      );

      /* Um dia do calendário (`@db.Date`): o de hoje em São Paulo, ou o
         digitado. O schema já recusou data que não existe. */
      const awardedAt = input.awardedAt
        ? diaDoTexto(input.awardedAt)!
        : diaDe();

      if (awardedAt > diaDe()) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'A data da graduação não pode ser no futuro.',
        });
      }

      return ctx.prisma
        .$transaction(async (tx) => {
          /* Uma graduação por vez por aluno: o lock na linha dele faz a
             segunda chamada simultânea esperar a primeira e já enxergar a
             faixa nova — duas pessoas registrando a mesma faixa não deixam
             dois registros iguais no histórico. */
          await tx.$executeRaw`SELECT 1 FROM "Student" WHERE "id" = ${input.studentId} AND "tenantId" = ${tenantId} FOR UPDATE`;

          const student = await tx.student.findFirst({
            where: { id: input.studentId, tenantId },
            select: {
              id: true,
              name: true,
              enrollments: {
                where: { isActive: true },
                select: { modalityId: true },
              },
              graduations: {
                where: { graduation: { modalityId: faixa.modality.id } },
                select: faixaAtualSelect,
              },
            },
          });

          if (!student) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Aluno não encontrado.',
            });
          }

          if (
            !student.enrollments.some((e) => e.modalityId === faixa.modality.id)
          ) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `${student.name} não está matriculado em ${faixa.modality.name}.`,
            });
          }

          const [atual] = maisRecentesPrimeiro(student.graduations);
          if (atual?.graduation.id === faixa.id) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `${student.name} já está na faixa ${faixa.name}.`,
            });
          }

          await tx.studentGraduation.create({
            data: {
              studentId: student.id,
              graduationId: faixa.id,
              awardedAt,
              note: input.note || null,
              userId: ctx.session.user.id,
            },
          });

          return { message: 'Graduação registrada com sucesso' };
        })
        .catch((err: unknown) => {
          throw traduzirFaixaSumida(err);
        });
    }),

  /**
   * Remove um registro do histórico — qualquer um, não só o mais recente: um
   * exame lançado com o ano errado vai parar no fundo da lista e precisa sair
   * sem levar junto as graduações certas que vieram depois.
   *
   * Só em modalidade que o aluno faz hoje. Quem cancelou mantém o histórico,
   * e o que se apagasse ali não teria como voltar: graduar exige matrícula
   * ativa.
   */
  removeGraduation: teacherProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const registro = await ctx.prisma.studentGraduation.findFirst({
        where: { id: input.id, student: { tenantId: ctx.tenantId } },
        select: {
          id: true,
          graduation: {
            select: { modality: { select: { id: true, name: true } } },
          },
          student: {
            select: {
              enrollments: {
                where: { isActive: true },
                select: { modalityId: true },
              },
            },
          },
        },
      });

      if (!registro) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Esta graduação já não está no histórico.',
        });
      }

      const { modality } = registro.graduation;
      if (
        !registro.student.enrollments.some((e) => e.modalityId === modality.id)
      ) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `O aluno não faz mais ${modality.name}: o histórico dela fica como está.`,
        });
      }

      /* deleteMany e não delete: dois cliques (ou duas telas) removendo o
         mesmo registro não estouram P2025 no segundo — ele só não acha. */
      const { count } = await ctx.prisma.studentGraduation.deleteMany({
        where: { id: registro.id },
      });

      if (count === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Esta graduação já não está no histórico.',
        });
      }

      return { message: 'Graduação removida' };
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
              graduations: { select: faixaAtualSelect },
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

          const { graduations, ...dados } = student;

          return {
            ...dados,
            status,
            /* A faixa atual em cada modalidade; o histórico fica na ficha. */
            currentGraduations: faixasAtuais(graduations).map(
              (registro) => registro.graduation,
            ),
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
              enrollment: { select: enrollmentModalitySelect },
            },
          },
          FinanceEntry: {
            include: { category: true },
            orderBy: { date: 'desc' },
          },
          graduations: { select: studentGraduationSelect },
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

      /* O histórico cru sai do `...`: ele já vai, ordenado, em
         `graduationHistory`, e ia duas vezes. */
      const { graduations, ...dados } = student;

      return {
        data: {
          ...dados,
          status: deriveStudentStatus(student.payments, activeEnrollments),
          activeEnrollments,
          /* A faixa atual em cada modalidade e o histórico inteiro, do mais
             recente para o mais antigo. */
          currentGraduations: faixasAtuais(graduations),
          graduationHistory: maisRecentesPrimeiro(graduations),
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

      if (!plan.isActive) throw planoDesativado(plan.name);

      const category = await categoriaDeAlunos(ctx.prisma, tenantId);
      const startDate = new Date();

      const percent = await descontoDaAcademia(ctx.prisma, tenantId);

      try {
        const result = await ctx.prisma.$transaction(async (tx) => {
          const cancelled = await encerrarMatricula(tx, current.id, startDate);

          /* A mesma regra da matrícula nova, olhando as outras vigentes do
             aluno: se alguma paga cheio, esta tem desconto; se não (a que
             pagava cheio foi cancelada, ou é esta), esta paga cheio. Manter
             o desconto só porque a velha tinha deixava o aluno sem nenhuma
             modalidade a preço cheio. */
          const outras = await tx.enrollment.findMany({
            where: {
              studentId: current.student.id,
              isActive: true,
              endDate: { gte: startDate },
              id: { not: current.id },
            },
            select: { discountPercent: true },
          });
          const [discountPercent = 0] = descontosDasMatriculas(
            [
              {
                preco: precoNaModalidade(plan, current.modality.id),
                duracao: plan.duration,
              },
            ],
            outras,
            percent,
          );

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
        if (error instanceof TRPCError) throw error;
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
        if (error instanceof TRPCError) throw error;
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
