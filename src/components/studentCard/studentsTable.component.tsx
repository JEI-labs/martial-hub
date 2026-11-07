'use client';

import { SendMessageDialog } from '@/components/whatsapp/sendMessageDialog.component';
import { GraduationBadge } from '@/components/graduationBadge/graduationBadge.component';
import { EmptyState } from '@/components/emptyState/emptyState.component';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import {
  CreditCard,
  Edit2,
  MessageCircle,
  Plus,
  Repeat,
  Trash2,
  UserMinus,
} from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { RowActions } from '@/components/dataTable/rowActions.component';
import { Button } from '@/components/ui/button';
import { RegisterPaymentDialog } from '@/components/modals/payments/registerPayment/registerPaymentDialog.component';
import { ChangePlanDialog } from '@/components/modals/students/changePlan/changePlanDialog.component';
import { CancelEnrollmentDialog } from '@/components/modals/students/cancelEnrollment/cancelEnrollmentDialog.component';
import ConfirmDeleteDialog from '@/components/confirmDeleteDialog/confirmDeleteDialog.component';
import { cn } from '@/lib/utils';
import { getInitials } from '@/utils/masksUtils';
import type {
  ActiveEnrollmentRow,
  StudentRow,
  StudentsTableProps,
} from './studentCard.types';

export function StudentsTable({
  students,
  onEdit,
  onDelete,
}: StudentsTableProps) {
  const router = useRouter();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [messageTo, setMessageTo] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [payFor, setPayFor] = useState<{ id: string; name: string } | null>(
    null,
  );
  /* Matrícula é por modalidade: os diálogos guardam o aluno e qual
     matrícula (nenhuma = matricular numa modalidade nova). */
  const [changePlanFor, setChangePlanFor] = useState<{
    student: StudentRow;
    enrollment: ActiveEnrollmentRow | null;
  } | null>(null);
  const [cancelFor, setCancelFor] = useState<{
    student: StudentRow;
    enrollment: ActiveEnrollmentRow;
  } | null>(null);

  /* Com uma modalidade só o menu fica como era ("Trocar plano"); com
     várias, cada ação diz de qual modalidade é. */
  const acoesDeMatricula = (student: StudentRow) => {
    const ativas = student.activeEnrollments;
    const deQual = (e: ActiveEnrollmentRow) =>
      ativas.length > 1 ? ` de ${e.modality.name}` : '';

    return [
      ...ativas.map((enrollment) => ({
        label: `Trocar plano${deQual(enrollment)}`,
        icon: Repeat,
        onSelect: () => setChangePlanFor({ student, enrollment }),
      })),
      {
        label:
          ativas.length > 0 ? 'Matricular em outra modalidade' : 'Matricular',
        icon: Plus,
        onSelect: () => setChangePlanFor({ student, enrollment: null }),
      },
      ...ativas.map((enrollment) => ({
        label: `Cancelar matrícula${ativas.length > 1 ? ` em ${enrollment.modality.name}` : ''}`,
        icon: UserMinus,
        onSelect: () => setCancelFor({ student, enrollment }),
      })),
    ];
  };

  if (students.length === 0) {
    return (
      <EmptyState
        title="Nenhum aluno encontrado"
        description="Ajuste a busca e os filtros, ou adicione o primeiro aluno."
      />
    );
  }

  return (
    <>
      <div className="bg-card shadow-card overflow-hidden rounded-2xl">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Aluno</TableHead>
              <TableHead>Matrícula</TableHead>
              <TableHead>Modalidades</TableHead>
              <TableHead>Graduação</TableHead>
              <TableHead>Matriculado em</TableHead>
              <TableHead className="w-[150px]">Pagamento</TableHead>
              <TableHead className="w-[70px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {students.map((student) => (
              <TableRow
                key={student.id}
                className="cursor-pointer"
                onClick={() => router.push(`/alunos/${student.id}`)}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarImage
                        src={student.avatar || undefined}
                        className="h-full w-full rounded-full object-cover"
                      />
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                        {getInitials(student.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <Link
                        href={`/alunos/${student.id}`}
                        className="block truncate font-medium"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {student.name}
                      </Link>
                      <p className="text-muted-foreground truncate text-xs">
                        {student.email}
                      </p>
                    </div>
                  </div>
                </TableCell>

                <TableCell>
                  <span
                    className={cn(
                      'rounded-full px-2 py-1 text-xs font-medium whitespace-nowrap',
                      student.status === 'EM DIA' &&
                        'bg-green-100 text-green-800',
                      student.status === 'PENDENTE' &&
                        'bg-yellow-100 text-yellow-800',
                      student.status === 'ATRASADO' &&
                        'bg-red-100 text-red-800',
                      student.status === 'SEM MATRÍCULA' &&
                        'bg-muted text-muted-foreground',
                    )}
                  >
                    {student.status}
                  </span>
                </TableCell>

                <TableCell>
                  {/* O que o aluno faz, uma pílula por modalidade, com o
                      plano. Não é alerta: o vermelho fixo competia com o
                      status ao lado e ignorava a cor da academia. */}
                  <div className="flex flex-wrap gap-1">
                    {student.activeEnrollments.length === 0 ? (
                      <span className="text-muted-foreground text-xs">
                        Sem plano
                      </span>
                    ) : (
                      student.activeEnrollments.map((enrollment) => (
                        <span
                          key={enrollment.id}
                          className="bg-secondary text-secondary-foreground rounded-full px-2 py-1 text-xs font-medium whitespace-nowrap"
                        >
                          {enrollment.modality.name} · {enrollment.planName}
                        </span>
                      ))
                    )}
                  </div>
                </TableCell>

                <TableCell>
                  {/* Uma fita por modalidade; o nome de cada uma vem no
                      título da fita. */}
                  {student.currentGraduations.length === 0 ? (
                    <GraduationBadge graduation={null} />
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {student.currentGraduations.map((graduation) => (
                        <GraduationBadge
                          key={`${graduation.modality?.name}-${graduation.name}`}
                          graduation={graduation}
                          showLabel={false}
                        />
                      ))}
                    </div>
                  )}
                </TableCell>

                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {student.createdAt
                    ? format(new Date(student.createdAt), 'dd/MM/yyyy')
                    : '—'}
                </TableCell>

                {/* Dar baixa na mensalidade é o que mais se faz nesta tela,
                    então fica como botão na linha e não escondido no menu. */}
                <TableCell onClick={(event) => event.stopPropagation()}>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setPayFor({ id: student.id, name: student.name })
                    }
                  >
                    <CreditCard className="mr-2 size-4" />
                    Registrar
                  </Button>
                </TableCell>

                <TableCell
                  className="text-right"
                  onClick={(event) => event.stopPropagation()}
                >
                  <RowActions
                    srLabel={`Ações de ${student.name}`}
                    actions={[
                      {
                        label: 'Pagamentos',
                        icon: CreditCard,
                        onSelect: () =>
                          router.push(`/alunos/${student.id}/pagamentos`),
                      },
                      ...acoesDeMatricula(student),
                      {
                        label: 'Enviar mensagem',
                        icon: MessageCircle,
                        onSelect: () =>
                          setMessageTo({ id: student.id, name: student.name }),
                      },
                      {
                        label: 'Editar',
                        icon: Edit2,
                        onSelect: () => onEdit(student.id),
                      },
                      {
                        label: 'Excluir',
                        icon: Trash2,
                        destructive: true,
                        onSelect: () => setDeleteId(student.id),
                      },
                    ]}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {payFor && (
        <RegisterPaymentDialog
          studentId={payFor.id}
          studentName={payFor.name}
          open={Boolean(payFor)}
          onOpenChange={(open) => !open && setPayFor(null)}
        />
      )}

      {cancelFor && (
        <CancelEnrollmentDialog
          enrollmentId={cancelFor.enrollment.id}
          studentName={cancelFor.student.name}
          modalityName={cancelFor.enrollment.modality.name}
          planName={cancelFor.enrollment.planName}
          otherActive={cancelFor.student.activeEnrollments.length - 1}
          open={Boolean(cancelFor)}
          onOpenChange={(open) => !open && setCancelFor(null)}
        />
      )}

      {changePlanFor && (
        <ChangePlanDialog
          studentId={changePlanFor.student.id}
          studentName={changePlanFor.student.name}
          enrollment={changePlanFor.enrollment}
          enrolledModalityIds={changePlanFor.student.activeEnrollments.map(
            (e) => e.modality.id,
          )}
          open={Boolean(changePlanFor)}
          onOpenChange={(open) => !open && setChangePlanFor(null)}
        />
      )}

      {messageTo && (
        <SendMessageDialog
          studentId={messageTo.id}
          studentName={messageTo.name}
          open={Boolean(messageTo)}
          onOpenChange={(open) => !open && setMessageTo(null)}
        />
      )}

      {deleteId && (
        <ConfirmDeleteDialog
          item={deleteId}
          open={Boolean(deleteId)}
          onOpenChange={(open) => !open && setDeleteId(null)}
          onConfirm={async (id) => {
            await onDelete(id);
            setDeleteId(null);
          }}
        />
      )}
    </>
  );
}
