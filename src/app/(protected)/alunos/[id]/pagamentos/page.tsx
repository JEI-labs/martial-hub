'use client';

import { EmptyState } from '@/components/emptyState/emptyState.component';
import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ArrowLeft, CreditCard } from 'lucide-react';

import { BreadcrumbUpdater } from '@/contexts/breadcrumb';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AppPagination } from '@/components/appPagination/appPagination.component';
import { ListSkeleton } from '@/components/skeletons/listSkeleton.component';
import { useResetOnChange } from '@/hooks/useResetOnChange/useResetOnChange.hook';
import { useToast } from '@/hooks/use-toast';
import { formatPaymentMoment } from '@/utils/dateUtils';
import { api } from '@/trpc/react';

const STATUS_TABS = [
  { id: 'ALL', label: 'Todas' },
  { id: 'PAID', label: 'Pagas' },
  { id: 'PENDING', label: 'Pendentes' },
] as const;

type StatusFilter = (typeof STATUS_TABS)[number]['id'];

const formatDate = (value: Date | string | null | undefined) =>
  value ? format(new Date(value), 'dd/MM/yyyy') : '—';

const formatMoney = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function StudentPaymentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // trocar de filtro com a página 2 aberta deixaria a lista vazia
  useResetOnChange([status, limit], () => setPage(1));

  const { toast } = useToast();
  const utils = api.useUtils();

  const { data, isLoading } =
    api.payment.getPaymentsByStudentPaginated.useQuery({
      studentId: id,
      page,
      limit,
      status,
    });

  // registrar pagamento vivia num diálogo à parte; agora é ação desta tela
  const { mutate: registerPayment, isPending: isRegistering } =
    api.payment.updatePayment.useMutation({
      onSuccess: () => {
        toast({
          title: 'Pagamento registrado!',
          description: 'A parcela foi lançada nos lançamentos financeiros.',
        });
        utils.payment.getPaymentsByStudentPaginated.invalidate();
        utils.student.getDetailsByID.invalidate({ id });
      },
      onError: () =>
        toast({ title: 'Erro ao registrar pagamento', variant: 'destructive' }),
    });

  const studentName = data?.student.name ?? '';

  return (
    <div className="w-full">
      <BreadcrumbUpdater
        items={[
          { label: 'Home', href: '/painel' },
          { label: 'Alunos', href: '/alunos' },
          ...(studentName
            ? [{ label: studentName, href: `/alunos/${id}` }]
            : []),
          { label: 'Pagamentos', href: `/alunos/${id}/pagamentos` },
        ]}
      />

      <Button
        variant="ghost"
        className="mb-4 -ml-2"
        onClick={() => router.push(`/alunos/${id}`)}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar para o aluno
      </Button>

      <h1 className="text-2xl font-semibold">
        Pagamentos{studentName ? ` de ${studentName}` : ''}
      </h1>

      <div className="mt-4 flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <Button
            key={tab.id}
            size="sm"
            variant={status === tab.id ? 'default' : 'outline'}
            onClick={() => setStatus(tab.id)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="mt-6">
          <ListSkeleton columns={5} />
        </div>
      ) : (
        <>
          <Card className="mt-4">
            <CardContent className="p-0">
              {data && data.data.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vencimento</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Pago em</TableHead>
                      <TableHead className="w-[120px] text-right">
                        Ação
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.data.map((payment) => {
                      const isOverdue =
                        payment.status === 'PENDING' &&
                        new Date(payment.dueDate) < new Date();

                      return (
                        <TableRow key={payment.id}>
                          <TableCell>{formatDate(payment.dueDate)}</TableCell>
                          <TableCell className="text-right">
                            {formatMoney(Number(payment.amount))}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                payment.status === 'PAID'
                                  ? 'success'
                                  : isOverdue
                                    ? 'destructive'
                                    : 'alert'
                              }
                            >
                              {payment.status === 'PAID'
                                ? 'Paga'
                                : isOverdue
                                  ? 'Atrasada'
                                  : 'Pendente'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {payment.status === 'PAID'
                              ? formatPaymentMoment(payment.paymentDate)
                              : '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            {payment.status === 'PENDING' && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isRegistering}
                                onClick={() =>
                                  registerPayment({
                                    studentId: id,
                                    dueDate: new Date(
                                      payment.dueDate,
                                    ).toISOString(),
                                  })
                                }
                              >
                                <CreditCard className="mr-2 h-4 w-4" />
                                Registrar
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <EmptyState
                  className="border-0"
                  title="Nenhum pagamento encontrado"
                  description="Não há parcelas com esse status para este aluno."
                />
              )}
            </CardContent>
          </Card>

          {(data?.pagination.total ?? 0) > 0 && (
            <div className="mt-4 w-full">
              <AppPagination
                totalItems={data?.pagination.total ?? 0}
                itemsPerPage={limit}
                currentPage={page}
                onPageChange={setPage}
                onItemsPerPageChange={setLimit}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
