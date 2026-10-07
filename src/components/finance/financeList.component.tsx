import { EmptyState } from '@/components/emptyState/emptyState.component';
import { ListSkeleton } from '@/components/skeletons/listSkeleton.component';
import React, { useState } from 'react';
import { Edit2, Trash2 } from 'lucide-react';
import { EFinanceEntryStatus, EFinanceEntryType } from '@prisma/client';

import { CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { RowActions } from '@/components/dataTable/rowActions.component';
import { IFinanceEntriesList } from './financeList.types';
import { api } from '@/trpc/react';
import { maskDecimalWithAcronym } from '@/utils/masksUtils';
import { formatPaymentMoment } from '@/utils/dateUtils';
import { cn } from '@/lib/utils';
import ConfirmDeleteDialog from '../confirmDeleteDialog/confirmDeleteDialog.component';

const TYPE_LABEL: Record<EFinanceEntryType, string> = {
  [EFinanceEntryType.INCOME]: 'Receita',
  [EFinanceEntryType.STUDENTS]: 'Receita de Aluno',
  [EFinanceEntryType.EXPENSE]: 'Despesa',
};

const STATUS_LABEL: Record<EFinanceEntryStatus, string> = {
  [EFinanceEntryStatus.PAID]: 'Pago',
  [EFinanceEntryStatus.PENDING]: 'Pendente',
  [EFinanceEntryStatus.CANCELLED]: 'Cancelado',
};

export const FinanceEntriesList: React.FC<IFinanceEntriesList> = ({
  entries,
  isLoading,
  onEdit,
  onDelete,
}) => {
  const { data: categoriesData, isLoading: isLoadingCategories } =
    api.category.getAll.useQuery({ page: 1, limit: 50 });

  const loading = isLoading || isLoadingCategories;

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleDeleteClick = (id: string) => {
    setSelectedId(id);
    setDeleteOpen(true);
  };

  const handleConfirmDelete = async (id: string) => {
    if (onDelete) await onDelete(id);
  };

  /* A coluna só existe se alguma linha da página puder ser mexida: numa
     página só de mensalidades ela seria uma fileira de traços. */
  const hasActions =
    Boolean(onEdit || onDelete) &&
    entries.some((entry) => entry.type !== EFinanceEntryType.STUDENTS);

  return (
    <div className="w-full">
      <CardHeader className="px-0">
        <CardTitle>Lançamentos</CardTitle>
      </CardHeader>

      {loading ? (
        <ListSkeleton columns={6} />
      ) : entries.length === 0 ? (
        <EmptyState
          title="Nenhum lançamento encontrado"
          description="Ajuste o período e os filtros, ou crie um lançamento."
        />
      ) : (
        <div className="bg-card shadow-card overflow-hidden rounded-2xl">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                {hasActions && (
                  <TableHead className="w-[70px] text-right">Ações</TableHead>
                )}
              </TableRow>
            </TableHeader>

            <TableBody>
              {entries.map((entry) => {
                const isExpense = entry.type === EFinanceEntryType.EXPENSE;
                /* A mensalidade nasce do pagamento do aluno; editar ou apagar
                   por aqui deixaria o financeiro dizendo uma coisa e a ficha
                   do aluno outra. */
                const isFromStudent = entry.type === EFinanceEntryType.STUDENTS;
                const categoryName =
                  categoriesData?.data.find((c) => c.id === entry.categoryId)
                    ?.name ?? '—';

                // o lançamento vindo de aluno traz o nome dele; senão, cai
                // para a referência ou a descrição livre
                const detail =
                  (entry.type === EFinanceEntryType.STUDENTS
                    ? entry.student?.name
                    : null) ??
                  entry.description ??
                  entry.referenceId ??
                  '—';

                return (
                  <TableRow key={entry.id}>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {formatPaymentMoment(entry.date)}
                    </TableCell>

                    <TableCell>
                      <Badge variant={isExpense ? 'destructive' : 'default'}>
                        {TYPE_LABEL[entry.type]}
                      </Badge>
                    </TableCell>

                    <TableCell className="font-medium">
                      {categoryName}
                    </TableCell>

                    <TableCell className="text-muted-foreground max-w-xs truncate">
                      {detail}
                    </TableCell>

                    <TableCell>
                      <Badge variant="outline">
                        {STATUS_LABEL[entry.status]}
                      </Badge>
                    </TableCell>

                    <TableCell
                      className={cn(
                        'text-right font-semibold whitespace-nowrap',
                        isExpense ? 'text-red-600' : 'text-green-600',
                      )}
                    >
                      {isExpense ? '- ' : '+ '}
                      {maskDecimalWithAcronym(entry.amount)}
                      {entry.paymentMethod && (
                        <span className="text-muted-foreground block text-xs font-normal uppercase">
                          {entry.paymentMethod.replace(/_/g, ' ')}
                        </span>
                      )}
                    </TableCell>

                    {hasActions && (
                      <TableCell className="text-right">
                        {isFromStudent ? (
                          <span
                            className="text-muted-foreground text-xs"
                            title="Mensalidade: altere pelo pagamento do aluno"
                          >
                            —
                          </span>
                        ) : (
                          <RowActions
                            srLabel={`Ações do lançamento de ${categoryName}`}
                            actions={[
                              ...(onEdit
                                ? [
                                    {
                                      label: 'Editar',
                                      icon: Edit2,
                                      onSelect: () => onEdit(entry.id),
                                    },
                                  ]
                                : []),
                              ...(onDelete
                                ? [
                                    {
                                      label: 'Excluir',
                                      icon: Trash2,
                                      destructive: true,
                                      onSelect: () =>
                                        handleDeleteClick(entry.id),
                                    },
                                  ]
                                : []),
                            ]}
                          />
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {onDelete && selectedId && (
        <ConfirmDeleteDialog
          item={selectedId}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  );
};
