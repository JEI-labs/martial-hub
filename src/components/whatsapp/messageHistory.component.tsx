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

        <CardContent className="p-0">
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
                    {log.status === EMessageStatus.SENT ? (
                      <Badge variant="success">Enviada</Badge>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <Badge variant="destructive">Falhou</Badge>
                        {log.error && (
                          <span className="text-muted-foreground max-w-xs truncate text-xs">
                            {log.error}
                          </span>
                        )}
                      </div>
                    )}
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
