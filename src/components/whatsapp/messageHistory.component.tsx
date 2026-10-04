'use client';

import { useState } from 'react';
import { EMessageStatus } from '@prisma/client';
import { format } from 'date-fns';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { AppPagination } from '@/components/appPagination/appPagination.component';
import { MESSAGE_EVENTS } from '@/common/constants/messageEvents';
import { api } from '@/trpc/react';
import { formatPhone } from '@/utils/masksUtils';

export function MessageHistory() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const { data, isLoading } = api.whatsapp.listLogs.useQuery({ page, limit });

  if (isLoading) {
    return <ListSkeleton columns={4} />;
  }

  if (!data || data.pagination.total === 0) {
    return (
      <EmptyState
        title="Nenhuma mensagem enviada"
        description="O histórico mostra cada disparo feito pelo sistema, com o erro quando o envio falha."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {data.pagination.total} envio(s)
            {data.failed > 0 && (
              <span className="text-destructive-text ml-2 text-sm font-normal">
                · {data.failed} com falha
              </span>
            )}
          </CardTitle>
        </CardHeader>

        {/* No celular, uma lista. Três colunas em 390px espremiam o telefone
            a ponto de ele quebrar dígito a dígito, e a situação — que é o que
            se vem olhar aqui — ficava cortada fora da tela. */}
        <CardContent className="flex flex-col gap-2 p-4 md:hidden">
          {data.data.map((log) => (
            <div
              key={log.id}
              className="bg-muted/60 flex flex-col gap-1 rounded-xl p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 font-medium">
                  {log.student?.name ?? 'Contato avulso'}
                </p>
                <Situacao log={log} />
              </div>

              <p className="text-muted-foreground text-sm">
                {formatPhone(log.toNumber)}
              </p>

              <p className="text-muted-foreground text-xs">
                {format(new Date(log.createdAt), 'dd/MM/yyyy HH:mm')} ·{' '}
                {MESSAGE_EVENTS[log.event].label}
              </p>

              {log.status !== EMessageStatus.SENT && log.error && (
                <p className="text-destructive-text text-xs">{log.error}</p>
              )}
            </div>
          ))}
        </CardContent>

        <CardContent className="hidden p-0 md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Para</TableHead>
                <TableHead className="hidden md:table-cell">Motivo</TableHead>
                <TableHead>Situação</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {data.data.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {format(new Date(log.createdAt), 'dd/MM/yyyy HH:mm')}
                  </TableCell>

                  <TableCell>
                    <p className="font-medium">
                      {log.student?.name ?? 'Contato avulso'}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {formatPhone(log.toNumber)}
                    </p>
                  </TableCell>

                  <TableCell className="hidden md:table-cell">
                    {MESSAGE_EVENTS[log.event].label}
                  </TableCell>

                  <TableCell>
                    {/* items-start: sem isto a etiqueta estica e vira uma
                        barra da largura da coluna. */}
                    <div className="flex flex-col items-start gap-1">
                      <Situacao log={log} />
                      {log.status !== EMessageStatus.SENT && log.error && (
                        <span className="text-muted-foreground max-w-xs truncate text-xs">
                          {log.error}
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AppPagination
        totalItems={data.pagination.total}
        itemsPerPage={limit}
        currentPage={page}
        onPageChange={setPage}
        onItemsPerPageChange={setLimit}
      />
    </div>
  );
}

/** Enviada ou falhou — a etiqueta é a mesma nas duas apresentações. */
function Situacao({ log }: { log: { status: EMessageStatus } }) {
  return log.status === EMessageStatus.SENT ? (
    <Badge variant="success">Enviada</Badge>
  ) : (
    <Badge variant="destructive">Falhou</Badge>
  );
}
