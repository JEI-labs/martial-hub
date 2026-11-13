import type { Enrollment, Payment } from '@prisma/client';

export type StudentStatus =
  'EM DIA' | 'PENDENTE' | 'ATRASADO' | 'SEM MATRÍCULA';

type EnrollmentLike = Pick<Enrollment, 'id' | 'startDate' | 'endDate'>;
type PaymentLike = Pick<Payment, 'status' | 'dueDate'> & {
  enrollmentId?: string | null;
};

const GRAVIDADE: Record<StudentStatus, number> = {
  'SEM MATRÍCULA': 0,
  'EM DIA': 1,
  'PENDENTE': 2,
  'ATRASADO': 3,
};

/**
 * Status de uma matrícula, pelas parcelas dela.
 *
 * Parcela ligada à matrícula é dela. Parcela antiga sem matrícula (só existe
 * de antes de a parcela saber de qual matrícula é) conta pelo período, como
 * era a regra antes.
 */
function statusDaMatricula(
  payments: Array<PaymentLike>,
  enrollment: EnrollmentLike,
  now: Date,
): StudentStatus {
  const daMatricula = payments.filter((p) =>
    p.enrollmentId
      ? p.enrollmentId === enrollment.id
      : p.dueDate >= enrollment.startDate && p.dueDate <= enrollment.endDate,
  );

  const hasOverduePayment = daMatricula.some(
    (p) => p.status === 'PENDING' && p.dueDate < now,
  );

  const hasUpcomingPayment = daMatricula.some((p) => {
    const diffDays = Math.floor(
      (p.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
    return p.status === 'PENDING' && diffDays <= 3 && diffDays >= 0;
  });

  if (hasOverduePayment) return 'ATRASADO';
  if (hasUpcomingPayment) return 'PENDENTE';

  const diffDays = Math.ceil(
    (enrollment.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays < 0) return 'ATRASADO';
  if (diffDays <= 3) return 'PENDENTE';

  return 'EM DIA';
}

/**
 * Status do aluno: o pior entre as matrículas ativas dele. Quem está em dia
 * no muay thai e atrasado no boxe está atrasado — é a mesma pessoa devendo.
 *
 * Extraído de `students.getAll` para o detalhe do aluno e o painel usarem
 * exatamente a mesma regra — duas implementações divergiriam com o tempo.
 */
export function deriveStudentStatus(
  payments: Array<PaymentLike>,
  activeEnrollments: Array<EnrollmentLike>,
  now: Date = new Date(),
): StudentStatus {
  /* Matrícula cancelada não é aluno em dia: sem contrato em vigor não há o
     que estar em dia com. */
  if (activeEnrollments.length === 0) return 'SEM MATRÍCULA';

  /* Dívida não some com a matrícula: as parcelas vencidas de uma modalidade
     cancelada (ou de um plano trocado) "continuam a ser cobradas", como diz
     o diálogo de cancelamento. Quem segue matriculado em outra modalidade e
     deve essas parcelas está atrasado — é o que o painel já conta em
     inadimplência. */
  const devendo = payments.some(
    (p) => p.status === 'PENDING' && p.dueDate < now,
  );
  if (devendo) return 'ATRASADO';

  return activeEnrollments
    .map((enrollment) => statusDaMatricula(payments, enrollment, now))
    .reduce((pior, atual) =>
      GRAVIDADE[atual] > GRAVIDADE[pior] ? atual : pior,
    );
}
