'use client';

import { ETenantInvoiceStatus } from '@prisma/client';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/emptyState/emptyState.component';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/trpc/react';
import { maskBRL } from '@/utils/masksUtils';

const STATUS: Record<
  ETenantInvoiceStatus,
  { label: string; variant: 'success' | 'alert' | 'destructive' | 'secondary' }
> = {
  OPEN: { label: 'Em aberto', variant: 'alert' },
  PAID: { label: 'Paga', variant: 'success' },
  OVERDUE: { label: 'Atrasada', variant: 'destructive' },
  CANCELED: { label: 'Cancelada', variant: 'secondary' },
};

/** O que a academia paga pelo sistema, do lado de quem paga. */
export function BillingCard() {
  const { data, isLoading } = api.tenant.getBilling.useQuery();

  if (isLoading || !data) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Assinatura</CardTitle>
        <CardDescription>
          {data.assinatura
            ? `${maskBRL(data.assinatura.priceCents / 100, true)} por mês, vencendo todo dia ${data.assinatura.billingDay}.`
            : 'Nenhuma assinatura cadastrada para esta academia.'}
          {data.aberto.quantidade > 0 &&
            ` ${data.aberto.quantidade} fatura(s) em aberto, somando ${maskBRL(data.aberto.valor, true)}.`}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {data.faturas.length === 0 ? (
          <EmptyState
            title="Nenhuma fatura ainda"
            description="Quando a primeira for emitida, ela aparece aqui."
          />
        ) : (
          <div className="bg-card overflow-hidden rounded-xl">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Paga em</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {data.faturas.map((fatura) => (
                  <TableRow key={fatura.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(fatura.dueDate).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {maskBRL(fatura.amountCents / 100, true)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS[fatura.status].variant}>
                        {STATUS[fatura.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {fatura.paidAt
                        ? new Date(fatura.paidAt).toLocaleDateString('pt-BR')
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <p className="text-muted-foreground mt-4 text-xs">
          O pagamento é combinado direto com quem cuida do sistema. Em caso de
          dúvida sobre uma fatura, fale com essa pessoa.
        </p>
      </CardContent>
    </Card>
  );
}
