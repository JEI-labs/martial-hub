import type { Enrollment, Payment, Plan } from '@prisma/client';

export type StudentStatus =
  'EM DIA' | 'PENDENTE' | 'ATRASADO' | 'SEM MATRÍCULA';

type EnrollmentWithPlan = Enrollment & { plan?: Plan | null };

/**
 * Status de matrícula derivado dos pagamentos dentro da vigência da matrícula
 * ativa. Extraído de `students.getAll` para o detalhe do aluno usar exatamente
 * a mesma regra — duas implementações divergiriam com o tempo.
 */
export function deriveStudentStatus(
  payments: Array<Payment>,
  activeEnrollment: EnrollmentWithPlan | null | undefined,
  now: Date = new Date(),
): StudentStatus {
  /* Matrícula cancelada não é aluno em dia: sem contrato em vigor não há o
     que estar em dia com. */
  if (!activeEnrollment) return 'SEM MATRÍCULA';

  const enrollmentStart = activeEnrollment?.startDate ?? null;
  const enrollmentEnd = activeEnrollment?.endDate ?? null;

  const paymentsWithinEnrollment = payments.filter(
    (p) =>
      (!enrollmentStart || p.dueDate >= enrollmentStart) &&
      (!enrollmentEnd || p.dueDate <= enrollmentEnd),
  );

  const hasOverduePayment = paymentsWithinEnrollment.some(
    (p) => p.status === 'PENDING' && p.dueDate < now,
  );

  const hasUpcomingPayment = paymentsWithinEnrollment.some((p) => {
    const diffDays = Math.floor(
      (p.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
    return p.status === 'PENDING' && diffDays <= 3 && diffDays >= 0;
  });

  if (hasOverduePayment) return 'ATRASADO';
  if (hasUpcomingPayment) return 'PENDENTE';

  if (enrollmentEnd) {
    const diffDays = Math.ceil(
      (enrollmentEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (diffDays < 0) return 'ATRASADO';
    if (diffDays <= 3) return 'PENDENTE';
  }

  return 'EM DIA';
}
