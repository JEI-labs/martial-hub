'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ETenantInvoiceStatus } from '@prisma/client';
import { Check, Loader2, RefreshCw, Receipt } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/emptyState/emptyState.component';
import { ListSkeleton } from '@/components/skeletons/listSkeleton.component';
import { useToast } from '@/hooks/use-toast';
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

const mesAtual = () => new Date().toISOString().slice(0, 7);

export function InvoicesPanel({ tenantId }: { tenantId?: string }) {
  const { toast } = useToast();
  const utils = api.useUtils();
  const [mes, setMes] = useState(mesAtual);
  /* Qual linha está salvando, e não "alguma está": com um isPending só, marcar
     uma fatura desabilitava o botão de todas as outras. */
  const [pagando, setPagando] = useState<string | null>(null);

  const { data, isLoading } = api.master.listInvoices.useQuery({ tenantId });

  const invalidar = () => {
    utils.master.listInvoices.invalidate();
    utils.master.overview.invalidate();
    utils.master.listTenants.invalidate();
  };

  const gerar = api.master.generateInvoices.useMutation({
    onSuccess: (r) => {
      toast({
        title: 'Faturas geradas',
        description:
          r.criadas > 0
            ? `${r.criadas} nova(s). ${r.puladas} academia(s) já tinham a do mês.`
            : 'Todas as academias já tinham a fatura deste mês.',
      });
      invalidar();
    },
    onError: (error) =>
      toast({
        title: 'Não deu para gerar',
        description: error.message,
        variant: 'destructive',
      }),
  });

  const atualizar = api.master.refreshOverdue.useMutation({
    onSuccess: (r) => {
      toast({
        title: 'Vencimentos conferidos',
        description: `${r.atualizadas} fatura(s) viraram atrasadas.`,
      });
      invalidar();
    },
  });

  const mudarStatus = api.master.updateInvoice.useMutation({
    onSuccess: invalidar,
    onError: (error) =>
      toast({
        title: 'Não deu para atualizar',
        description: error.message,
        variant: 'destructive',
      }),
  });

  return (
    <div className="flex flex-col gap-4">
      {!tenantId && (
        <div className="bg-card shadow-card flex flex-wrap items-end gap-3 rounded-2xl p-4">
          <div className="space-y-1">
            <label className="text-muted-foreground text-xs" htmlFor="mes">
              Mês
            </label>
            <Input
              id="mes"
              type="month"
              value={mes}
              onChange={(event) => setMes(event.target.value)}
              className="w-44"
            />
          </div>

          <Button
            disabled={gerar.isPending}
            onClick={() => gerar.mutate({ month: mes })}
          >
            {gerar.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Receipt className="mr-2 size-4" />
            )}
            Gerar faturas do mês
          </Button>

          <Button
            variant="outline"
            disabled={atualizar.isPending}
            onClick={() => atualizar.mutate()}
          >
            <RefreshCw className="mr-2 size-4" />
            Marcar vencidas
          </Button>

          <p className="text-muted-foreground w-full text-xs">
            Gerar duas vezes não cobra duas vezes: quem já tem a fatura do mês é
            pulado.
          </p>
        </div>
      )}

      {isLoading ? (
        <ListSkeleton columns={5} />
      ) : !data?.length ? (
        <EmptyState
          icon={Receipt}
          title="Nenhuma fatura"
          description="Gere as faturas do mês para começar a acompanhar."
        />
      ) : (
        <div className="bg-card shadow-card overflow-hidden rounded-2xl">
          <Table>
            <TableHeader>
              <TableRow>
                {!tenantId && <TableHead>Academia</TableHead>}
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {data.map((fatura) => (
                <TableRow key={fatura.id}>
                  {!tenantId && (
                    <TableCell className="font-medium">
                      <Link href={`/master/clientes/${fatura.tenant.id}`}>
                        {fatura.tenant.name}
                      </Link>
                    </TableCell>
                  )}

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

                  <TableCell className="text-right">
                    {fatura.status === 'PAID' ? (
                      <span className="text-muted-foreground text-xs">
                        {fatura.paidAt
                          ? new Date(fatura.paidAt).toLocaleDateString('pt-BR')
                          : '—'}
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pagando === fatura.id}
                        onClick={() => {
                          setPagando(fatura.id);
                          mudarStatus.mutate({
                            id: fatura.id,
                            status: ETenantInvoiceStatus.PAID,
                          });
                        }}
                      >
                        {pagando === fatura.id ? (
                          <Loader2 className="mr-2 size-4 animate-spin" />
                        ) : (
                          <Check className="mr-2 size-4" />
                        )}
                        Marcar paga
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
