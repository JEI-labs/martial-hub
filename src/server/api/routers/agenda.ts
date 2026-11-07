import { agendaProcedure, createTRPCRouter } from '@/server/api/trpc';
import {
  EAppointmentRecurrence,
  EAppointmentStatus,
  ECategoryStatus,
  EFinanceEntryStatus,
  EFinanceEntryType,
  EPaymentMethod,
  EUserRole,
  type Prisma,
} from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { prisma as clientePrisma } from '@/server/db';
import { diaDe, expandirSerie } from '@/server/agenda/ocorrencias';

/** O cliente de verdade, para os helpers não inventarem a forma dele. */
type Banco = typeof clientePrisma;

/** O pedaço do contexto que os helpers precisam. */
interface Contexto {
  prisma: Banco;
  tenantId: string;
  session: { user: { id: string; role: EUserRole } };
}

/** Nome da categoria fixa por onde a aula particular entra no caixa. */
const CATEGORIA_AULAS = 'Aulas particulares';

const dadosDoAgendamento = z.object({
  title: z.string().max(80).nullable(),
  notes: z.string().max(500).nullable(),
  startsAt: z.date(),
  endsAt: z.date(),
  recurrence: z.nativeEnum(EAppointmentRecurrence),
  repeatUntil: z.date().nullable(),
  lessonTypeId: z.string().uuid().nullable(),
  price: z.number().min(0).nullable(),
  studentIds: z.array(z.string().uuid()).max(30),
});

export const agendaRouter = createTRPCRouter({
  /**
   * As aulas de uma janela, já expandidas.
   *
   * O professor só enxerga a dele. O dono enxerga a de todo mundo, e pode
   * filtrar por professor — é como ele acompanha a academia sem precisar
   * perguntar.
   */
  list: agendaProcedure
    .input(
      z.object({
        de: z.date(),
        ate: z.date(),
        teacherId: z.string().uuid().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { role, id: meuId } = ctx.session.user;
      const soMinha = role === EUserRole.TEACHER;

      const where: Prisma.AppointmentWhereInput = {
        tenantId: ctx.tenantId,
        status: EAppointmentStatus.SCHEDULED,
        teacherId: soMinha ? meuId : input.teacherId,
        /* Série que começa depois da janela não interessa; série que termina
           antes dela, também não. O resto é decidido na expansão. */
        startsAt: { lt: input.ate },
        OR: [
          { recurrence: EAppointmentRecurrence.NONE },
          { repeatUntil: null },
          { repeatUntil: { gte: input.de } },
        ],
      };

      const series = await ctx.prisma.appointment.findMany({
        where,
        select: {
          id: true,
          title: true,
          notes: true,
          startsAt: true,
          endsAt: true,
          recurrence: true,
          repeatUntil: true,
          price: true,
          teacherId: true,
          teacher: { select: { name: true } },
          lessonType: { select: { id: true, name: true } },
          students: {
            select: { student: { select: { id: true, name: true } } },
          },
          occurrences: {
            where: { date: { gte: diaDe(input.de), lte: input.ate } },
            select: {
              date: true,
              status: true,
              paidAt: true,
              financeEntryId: true,
            },
          },
        },
      });

      return series.flatMap((serie) =>
        expandirSerie(serie, input.de, input.ate)
          .map((ocorrencia) => {
            /* O que foi decidido sobre aquele dia específico. Sem linha, vale
               o que a série diz: marcada e em aberto. */
            const decidido = serie.occurrences.find(
              (o) => o.date.getTime() === ocorrencia.data.getTime(),
            );

            if (decidido?.status === EAppointmentStatus.CANCELED) return null;

            return {
              appointmentId: serie.id,
              inicio: ocorrencia.inicio,
              fim: ocorrencia.fim,
              data: ocorrencia.data,
              title: serie.title,
              notes: serie.notes,
              price: serie.price,
              recorrente: serie.recurrence === EAppointmentRecurrence.WEEKLY,
              teacherId: serie.teacherId,
              professor: serie.teacher.name,
              tipo: serie.lessonType,
              alunos: serie.students.map((s) => s.student),
              pagoEm: decidido?.paidAt ?? null,
            };
          })
          .filter((o) => o !== null),
      );
    }),

  /**
   * Os alunos da academia, só nome e id.
   *
   * A listagem de alunos é paginada e traz plano, situação e pagamento — peso
   * que um seletor de nomes não precisa carregar.
   */
  students: agendaProcedure.query(async ({ ctx }) => {
    return ctx.prisma.student.findMany({
      where: { tenantId: ctx.tenantId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }),

  /** Quem tem agenda nesta academia, para o dono poder filtrar. */
  teachers: agendaProcedure.query(async ({ ctx }) => {
    return ctx.prisma.user.findMany({
      where: {
        tenantId: ctx.tenantId,
        role: { in: [EUserRole.OWNER, EUserRole.TEACHER] },
      },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    });
  }),

  create: agendaProcedure
    .input(
      dadosDoAgendamento.extend({ teacherId: z.string().uuid().optional() }),
    )
    .mutation(async ({ ctx, input }) => {
      const { studentIds, teacherId, ...dados } = input;

      if (dados.endsAt <= dados.startsAt) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'A aula precisa terminar depois de começar.',
        });
      }

      /* Professor agenda para si; o dono pode agendar para outro. */
      const dono =
        ctx.session.user.role === EUserRole.TEACHER
          ? ctx.session.user.id
          : (teacherId ?? ctx.session.user.id);

      await conferirConflito(ctx.prisma, ctx.tenantId, dono, dados, null);

      const criado = await ctx.prisma.appointment.create({
        data: {
          ...dados,
          tenantId: ctx.tenantId,
          teacherId: dono,
          students: { create: studentIds.map((id) => ({ studentId: id })) },
        },
        select: { id: true },
      });

      return criado;
    }),

  update: agendaProcedure
    .input(dadosDoAgendamento.extend({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { id, studentIds, ...dados } = input;
      const atual = await encontrar(ctx, id);

      if (dados.endsAt <= dados.startsAt) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'A aula precisa terminar depois de começar.',
        });
      }

      await conferirConflito(
        ctx.prisma,
        ctx.tenantId,
        atual.teacherId,
        dados,
        id,
      );

      await ctx.prisma.$transaction([
        ctx.prisma.appointmentStudent.deleteMany({
          where: { appointmentId: id },
        }),
        ctx.prisma.appointment.update({
          where: { id },
          data: {
            ...dados,
            students: { create: studentIds.map((s) => ({ studentId: s })) },
          },
        }),
      ]);

      return { ok: true };
    }),

  /** Desmarca uma aula só, sem mexer no resto da série. */
  cancelOccurrence: agendaProcedure
    .input(z.object({ id: z.string().uuid(), data: z.date() }))
    .mutation(async ({ ctx, input }) => {
      await encontrar(ctx, input.id);
      const dia = diaDe(input.data);

      await ctx.prisma.appointmentOccurrence.upsert({
        where: { appointmentId_date: { appointmentId: input.id, date: dia } },
        create: {
          appointmentId: input.id,
          date: dia,
          status: EAppointmentStatus.CANCELED,
        },
        update: { status: EAppointmentStatus.CANCELED },
      });

      return { ok: true };
    }),

  /** Desmarca a série inteira, daqui para a frente e para trás. */
  cancelSeries: agendaProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await encontrar(ctx, input.id);

      await ctx.prisma.appointment.update({
        where: { id: input.id },
        data: { status: EAppointmentStatus.CANCELED },
      });

      return { ok: true };
    }),

  /**
   * Registra o pagamento de **uma** aula e joga no caixa.
   *
   * O lançamento nasce aqui, na categoria de aulas particulares, separado da
   * mensalidade: misturar as duas esconderia quanto a academia ganha de cada
   * coisa, que é justamente o que o dono quer saber.
   */
  markPaid: agendaProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: z.date(),
        paymentMethod: z.nativeEnum(EPaymentMethod),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const agendamento = await encontrar(ctx, input.id);
      const dia = diaDe(input.data);

      const valor = agendamento.price ?? 0;
      if (valor <= 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Defina o valor da aula antes de registrar o pagamento.',
        });
      }

      const ja = await ctx.prisma.appointmentOccurrence.findUnique({
        where: { appointmentId_date: { appointmentId: input.id, date: dia } },
      });

      if (ja?.paidAt) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Esta aula já está paga.',
        });
      }

      const categoria = await categoriaDeAulas(ctx.prisma, ctx.tenantId);

      /* Um aluno só: o lançamento fica no nome dele e aparece na ficha. Vários
         alunos: fica da academia, porque dividir o valor seria invenção. */
      const alunoUnico =
        agendamento.students.length === 1
          ? agendamento.students[0]!.studentId
          : null;

      const quando = new Date();
      const nomes = agendamento.students.map((s) => s.student.name).join(', ');

      await ctx.prisma.$transaction(async (tx) => {
        const lancamento = await tx.financeEntry.create({
          data: {
            date: quando,
            amount: valor,
            paymentMethod: input.paymentMethod,
            description: `${agendamento.title ?? agendamento.lessonType?.name ?? 'Aula particular'}${nomes ? ` — ${nomes}` : ''} em ${dia.toLocaleDateString('pt-BR')}`,
            type: EFinanceEntryType.INCOME,
            status: EFinanceEntryStatus.PAID,
            categoryId: categoria,
            studentId: alunoUnico,
            tenantId: ctx.tenantId,
            userId: ctx.session.user.id,
            referenceId: `${input.id}:${dia.toISOString().slice(0, 10)}`,
          },
          select: { id: true },
        });

        await tx.appointmentOccurrence.upsert({
          where: { appointmentId_date: { appointmentId: input.id, date: dia } },
          create: {
            appointmentId: input.id,
            date: dia,
            paidAt: quando,
            financeEntryId: lancamento.id,
          },
          update: { paidAt: quando, financeEntryId: lancamento.id },
        });
      });

      return { ok: true };
    }),

  /** Desfaz o pagamento e apaga o lançamento que ele criou. */
  unmarkPaid: agendaProcedure
    .input(z.object({ id: z.string().uuid(), data: z.date() }))
    .mutation(async ({ ctx, input }) => {
      await encontrar(ctx, input.id);
      const dia = diaDe(input.data);

      const ocorrencia = await ctx.prisma.appointmentOccurrence.findUnique({
        where: { appointmentId_date: { appointmentId: input.id, date: dia } },
      });

      if (!ocorrencia?.paidAt) return { ok: true };

      await ctx.prisma.$transaction(async (tx) => {
        if (ocorrencia.financeEntryId) {
          /* deleteMany e não delete: lançamento apagado na tela do financeiro
             não pode impedir de desfazer o pagamento aqui. */
          await tx.financeEntry.deleteMany({
            where: { id: ocorrencia.financeEntryId, tenantId: ctx.tenantId },
          });
        }

        await tx.appointmentOccurrence.update({
          where: { id: ocorrencia.id },
          data: { paidAt: null, financeEntryId: null },
        });
      });

      return { ok: true };
    }),
});

/** O agendamento, se ele for desta academia e esta pessoa puder mexer nele. */
async function encontrar(ctx: Contexto, id: string) {
  const agendamento = await ctx.prisma.appointment.findFirst({
    where: { id, tenantId: ctx.tenantId },
    select: {
      id: true,
      teacherId: true,
      price: true,
      title: true,
      lessonType: { select: { name: true } },
      students: {
        select: { studentId: true, student: { select: { name: true } } },
      },
    },
  });

  if (!agendamento) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Horário não encontrado',
    });
  }

  /* Professor mexe só na agenda dele; o dono, em qualquer uma. */
  if (
    ctx.session.user.role === EUserRole.TEACHER &&
    agendamento.teacherId !== ctx.session.user.id
  ) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Este horário é de outro professor.',
    });
  }

  return agendamento;
}

/**
 * Dois horários do mesmo professor no mesmo intervalo é quase sempre engano.
 *
 * A conferência olha só a primeira ocorrência de cada lado: cobrir todo o
 * cruzamento de duas séries infinitas seria caro e, na prática, o choque que
 * importa é o que a pessoa vê na tela ao marcar.
 */
async function conferirConflito(
  prisma: Banco,
  tenantId: string,
  teacherId: string,
  dados: { startsAt: Date; endsAt: Date },
  ignorar: string | null,
) {
  const choque = await prisma.appointment.findFirst({
    where: {
      tenantId,
      teacherId,
      status: EAppointmentStatus.SCHEDULED,
      id: ignorar ? { not: ignorar } : undefined,
      startsAt: { lt: dados.endsAt },
      endsAt: { gt: dados.startsAt },
    },
    select: { id: true, startsAt: true },
  });

  if (choque) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Já existe um horário seu às ${choque.startsAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} nesse dia.`,
    });
  }
}

/** A categoria fixa das aulas, criada se a academia ainda não tiver. */
async function categoriaDeAulas(
  prisma: Banco,
  tenantId: string,
): Promise<string> {
  const existente = await prisma.category.findFirst({
    where: { tenantId, name: CATEGORIA_AULAS },
    select: { id: true },
  });

  if (existente) return existente.id;

  const criada = await prisma.category.create({
    data: {
      name: CATEGORIA_AULAS,
      description: 'Aulas avulsas e particulares da agenda',
      status: ECategoryStatus.ACTIVE,
      isFixed: true,
      tenantId,
    },
    select: { id: true },
  });

  return criada.id;
}
