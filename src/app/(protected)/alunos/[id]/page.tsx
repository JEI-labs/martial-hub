'use client';

import { GraduationCard } from '@/components/graduationBadge/graduationCard.component';
import { GRADUATIONS } from '@/common/constants/graduations';
import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import {
  ArrowLeft,
  CreditCard,
  Edit2,
  Mail,
  Phone,
  Repeat,
  UserMinus,
  Wallet,
} from 'lucide-react';

import { BreadcrumbUpdater } from '@/contexts/breadcrumb';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { LoadingContent } from '@/components/LoadingContent';
import { SheetEditStudent } from '@/components/modals/student/EditStudent/sheetEditStudent.component';
import { RowActions } from '@/components/dataTable/rowActions.component';
import { RegisterPaymentDialog } from '@/components/modals/payments/registerPayment/registerPaymentDialog.component';
import { ChangePlanDialog } from '@/components/modals/students/changePlan/changePlanDialog.component';
import { CancelEnrollmentDialog } from '@/components/modals/students/cancelEnrollment/cancelEnrollmentDialog.component';
import { api } from '@/trpc/react';
import { cn } from '@/lib/utils';
import {
  getInitials,
  maskCellphone,
  maskDecimalWithAcronym,
} from '@/utils/masksUtils';
import { formatPaymentMoment } from '@/utils/dateUtils';

const formatDate = (value: Date | string | null | undefined) =>
  value ? format(new Date(value), 'dd/MM/yyyy') : '—';

const formatMoney = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const PAYMENT_STATUS = {
  PAID: { label: 'Paga', variant: 'success' as const },
  PENDING: { label: 'Pendente', variant: 'alert' as const },
  OVERDUE: { label: 'Atrasada', variant: 'destructive' as const },
};

export default function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [editOpen, setEditOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [changePlanOpen, setChangePlanOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const { data, isLoading, isError, refetch } =
    api.student.getDetailsByID.useQuery({ id });

  if (isLoading) {
    return <LoadingContent textLoading="Carregando aluno..." />;
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <p className="text-muted-foreground">Aluno não encontrado.</p>
        <Button variant="outline" onClick={() => router.push('/alunos')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para alunos
        </Button>
      </div>
    );
  }

  const student = data.data;
  const { totals } = student;
  const latestPayments = [...student.payments]
    .sort(
      (a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime(),
    )
    .slice(0, 5);

  return (
    <div className="w-full">
      <BreadcrumbUpdater
        items={[
          { label: 'Home', href: '/painel' },
          { label: 'Alunos', href: '/alunos' },
          { label: student.name, href: `/alunos/${student.id}` },
        ]}
      />

      <Button
        variant="ghost"
        className="mb-4 -ml-2"
        onClick={() => router.push('/alunos')}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar
      </Button>

      {/* Cabeçalho + graduação, lado a lado a partir de lg */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row">
        <Card className="flex-1">
          <CardContent className="flex flex-col gap-5 p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <Avatar className="border-border h-20 w-20 shrink-0 border">
                  <AvatarImage
                    src={student.avatar || undefined}
                    className="h-full w-full rounded-full object-cover"
                  />
                  <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                    {getInitials(student.name)}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0">
                  <h1 className="truncate text-2xl font-semibold">
                    {student.name}
                  </h1>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        'rounded-full px-2 py-1 text-xs font-medium',
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
                    <Badge variant="secondary">{student.planName}</Badge>
                  </div>
                </div>
              </div>

              {/* Três ações à vista e o resto no menu: com cinco botões lado a
                  lado nenhum deles era o principal, e a linha quebrava. */}
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <Button onClick={() => setPayOpen(true)}>
                  <Wallet className="mr-2 h-4 w-4" />
                  Registrar pagamento
                </Button>

                <Button
                  variant="outline"
                  onClick={() => setChangePlanOpen(true)}
                >
                  <Repeat className="mr-2 h-4 w-4" />
                  {student.activeEnrollment ? 'Trocar plano' : 'Matricular'}
                </Button>

                <Button
                  variant="outline"
                  onClick={() =>
                    router.push(`/alunos/${student.id}/pagamentos`)
                  }
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  Pagamentos
                </Button>

                <RowActions
                  srLabel={`Mais ações de ${student.name}`}
                  actions={[
                    {
                      label: 'Editar dados',
                      icon: Edit2,
                      onSelect: () => setEditOpen(true),
                    },
                    ...(student.activeEnrollment
                      ? [
                          {
                            label: 'Cancelar matrícula',
                            icon: UserMinus,
                            destructive: true,
                            onSelect: () => setCancelOpen(true),
                          },
                        ]
                      : []),
                  ]}
                />
              </div>
            </div>

            {/* Contato em linha própria: espremido ao lado do nome, o telefone
                quebrava no meio do número. */}
            <div className="text-muted-foreground flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <Mail className="h-4 w-4 shrink-0" />
                <span className="truncate">{student.email}</span>
              </span>
              {student.phone && (
                <span className="flex items-center gap-2 whitespace-nowrap">
                  <Phone className="h-4 w-4 shrink-0" />
                  {maskCellphone(student.phone)}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <GraduationCard
          studentId={student.id}
          graduation={student.graduation}
          onUpdated={refetch}
        />
      </div>

      {/* Resumo financeiro */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile label="Parcelas pagas" value={String(totals.paidCount)} />
        <SummaryTile
          label="Total pago"
          value={formatMoney(totals.paidAmount)}
          tone="positive"
        />
        <SummaryTile
          label="Parcelas pendentes"
          value={String(totals.pendingCount)}
        />
        <SummaryTile
          label="Em atraso"
          value={String(totals.overdueCount)}
          tone={totals.overdueCount > 0 ? 'negative' : undefined}
        />
      </div>

      {/* Dados cadastrais */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Dados do aluno</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Nome" value={student.name} />
          <Field label="E-mail" value={student.email} />
          <Field
            label="Telefone"
            value={student.phone ? maskCellphone(student.phone) : '—'}
          />
          <Field label="Nascimento" value={formatDate(student.birthDate)} />
          <Field label="Matriculado em" value={formatDate(student.createdAt)} />
          <Field
            label="Graduação"
            value={
              student.graduation
                ? `${GRADUATIONS[student.graduation].degree}º grau · ${GRADUATIONS[student.graduation].label}`
                : 'Sem graduação'
            }
          />
          <Field
            label="Plano atual"
            value={student.activeEnrollment?.plan?.name ?? 'Sem plano'}
          />
          <Field
            label="Início da matrícula"
            value={formatDate(student.activeEnrollment?.startDate)}
          />
          <Field
            label="Fim da matrícula"
            value={formatDate(student.activeEnrollment?.endDate)}
          />
        </CardContent>
      </Card>

      {/* Matrículas */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Matrículas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {student.enrollments.length === 0 ? (
            <EmptyRow text="Nenhuma matrícula registrada." />
          ) : (
            <Table containerClassName="max-h-[22rem] overflow-y-auto">
              <TableHeader className="bg-card sticky top-0 z-10">
                <TableRow>
                  <TableHead>Plano</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Fim</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {student.enrollments.map((enrollment) => (
                  <TableRow key={enrollment.id}>
                    <TableCell className="font-medium">
                      {enrollment.plan?.name ?? '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(enrollment.startDate)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(enrollment.endDate)}
                    </TableCell>
                    <TableCell className="text-right">
                      {enrollment.plan
                        ? formatMoney(Number(enrollment.plan.price))
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={enrollment.isActive ? 'success' : 'secondary'}
                      >
                        {enrollment.isActive ? 'Ativa' : 'Encerrada'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Parcelas */}
      <Card className="mb-6">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Últimos pagamentos</CardTitle>
          {student.payments.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/alunos/${student.id}/pagamentos`)}
            >
              Ver todos ({student.payments.length})
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {student.payments.length === 0 ? (
            <EmptyRow text="Nenhuma parcela registrada." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pago em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {latestPayments.map((payment) => {
                  const isOverdue =
                    payment.status === 'PENDING' &&
                    new Date(payment.dueDate) < new Date();
                  const badge =
                    PAYMENT_STATUS[isOverdue ? 'OVERDUE' : payment.status] ??
                    PAYMENT_STATUS.PENDING;

                  return (
                    <TableRow key={payment.id}>
                      <TableCell>{formatDate(payment.dueDate)}</TableCell>
                      <TableCell className="text-right">
                        {formatMoney(Number(payment.amount))}
                      </TableCell>
                      <TableCell>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {payment.status === 'PAID'
                          ? formatPaymentMoment(payment.paymentDate)
                          : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Lançamentos financeiros gerados pelo aluno */}
      <Card>
        <CardHeader>
          <CardTitle>Lançamentos financeiros</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {student.FinanceEntry.length === 0 ? (
            <EmptyRow text="Nenhum lançamento vinculado a este aluno." />
          ) : (
            <Table containerClassName="max-h-[22rem] overflow-y-auto">
              <TableHeader className="bg-card sticky top-0 z-10">
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {student.FinanceEntry.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-muted-foreground">
                      {formatDate(entry.date)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {entry.category?.name ?? '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-xs truncate">
                      {entry.description ?? '—'}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-green-600">
                      {/* FinanceEntry.amount fica em centavos, ao contrário
                          de Payment.amount, que está em reais */}
                      {maskDecimalWithAcronym(Number(entry.amount))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <SheetEditStudent
        isOpen={editOpen}
        setIsOpen={setEditOpen}
        refetch={refetch}
        studentId={student.id}
      />

      <RegisterPaymentDialog
        studentId={student.id}
        studentName={student.name}
        open={payOpen}
        onOpenChange={setPayOpen}
      />

      <CancelEnrollmentDialog
        studentId={student.id}
        studentName={student.name}
        planName={student.planName}
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        onCancelled={refetch}
      />

      <ChangePlanDialog
        studentId={student.id}
        studentName={student.name}
        currentPlanId={student.activeEnrollment?.planId}
        currentPlanName={student.planName}
        open={changePlanOpen}
        onOpenChange={setChangePlanOpen}
        onChanged={refetch}
      />
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'positive' | 'negative';
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-muted-foreground text-xs uppercase">{label}</p>
        <p
          className={cn(
            'mt-1 text-2xl font-semibold',
            tone === 'positive' && 'text-green-600',
            tone === 'negative' && 'text-red-600',
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs uppercase">{label}</p>
      <p className="mt-1 text-sm font-medium break-words">{value}</p>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <>
      <Separator />
      <p className="text-muted-foreground py-6 text-center text-sm">{text}</p>
    </>
  );
}
