'use client';

import { useResetOnChange } from '@/hooks/useResetOnChange/useResetOnChange.hook';
import { useState, Suspense } from 'react';
import { BreadcrumbUpdater } from '@/contexts/breadcrumb';
import { ListToolbar } from '@/components/listToolbar/listToolbar.component';
import { Button } from '@/components/ui/button';
import { AppPagination } from '@/components/appPagination/appPagination.component';
import { useDebounce } from '@/hooks/useDebounce/useDebounce';
import { api } from '@/trpc/react';
import { useToast } from '@/hooks/use-toast';
import { FinanceEntriesList } from '@/components/finance/financeList.component';
import {
  AdvancedFilterDatePicker,
  getDefaultDateRange,
} from '@/components/forms/advancedFilterDatePicker/advancedFilterDatePicker.component';
import { AdvancedFilterCheckbox } from '@/components/forms/advancedFilterCheckbox/advancedFilterCheckbox.component';
import { Calendar } from 'lucide-react';
import { Plus } from 'lucide-react';
import {
  EFinanceEntryStatus,
  EFinanceEntryType,
  EPaymentMethod,
  FinanceEntry,
} from '@prisma/client';
import { startOfDay, endOfDay } from 'date-fns';
import { SheetEditExpenseEntry } from '@/components/modals/expenses/editExpenses/editExpenses.component';
import { SheetCreateExpenseEntry } from '@/components/modals/expenses/createExpenses/createExpenses.component';

const breadcrumbItems = [
  { label: 'Home', href: '/painel' },
  { label: 'Financeiro', href: '/financeiro' },
  { label: 'Despesas', href: '/financeiro/despesas' },
];

const STATUS_OPTIONS = [
  { id: EFinanceEntryStatus.PENDING, label: 'Pendente' },
  { id: EFinanceEntryStatus.PAID, label: 'Pago' },
  { id: EFinanceEntryStatus.CANCELLED, label: 'Cancelado' },
];

const defaultRange = getDefaultDateRange();

export default function ExpensesPage() {
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<FinanceEntry | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 500);

  const [dateFrom, setDateFrom] = useState<string>(
    defaultRange.from.toISOString(),
  );
  const [dateTo, setDateTo] = useState<string>(defaultRange.to.toISOString());
  const debouncedFrom = useDebounce(dateFrom, 500);
  const debouncedTo = useDebounce(dateTo, 500);

  const [selectedStatuses, setSelectedStatuses] = useState<
    Array<EFinanceEntryStatus>
  >([]);

  // paginação
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // query TRPC
  const financeQuery = api.finance.getAll.useQuery({
    page,
    limit,
    search: debouncedSearch || undefined,
    type: EFinanceEntryType.EXPENSE,
    status: selectedStatuses.length > 0 ? selectedStatuses : undefined,
    from: debouncedFrom || undefined,
    to: debouncedTo || undefined,
  });

  const deleteMutation = api.finance.delete.useMutation();

  // handlers
  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync({ id });
      toast({ title: 'Sucesso', description: 'Despesa excluída' });
      financeQuery.refetch();
    } catch {
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (entry: FinanceEntry) => {
    setEditEntry(entry);
    setEditOpen(true);
  };

  // reset página ao mudar filtros
  useResetOnChange(
    [debouncedSearch, debouncedFrom, debouncedTo, selectedStatuses, limit],
    () => setPage(1),
  );

  const entries = financeQuery.data?.data ?? [];
  const totalItems = financeQuery.data?.pagination.total ?? 0;
  const isLoading = financeQuery.isLoading;

  return (
    <Suspense fallback={<div>Carregando despesas…</div>}>
      <div className="w-full gap-6 py-6">
        <BreadcrumbUpdater items={breadcrumbItems} />

        <ListToolbar
          searchPlaceholder="Buscar despesas..."
          onSearch={setSearchTerm}
          total={totalItems}
          totalLabel={['despesa', 'despesas']}
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 size-4" />
              Criar despesa
            </Button>
          }
          filters={
            <>
              <AdvancedFilterDatePicker
                defaultValue={defaultRange}
                title="Intervalo de datas"
                description="Filtrar por data"
                numberOfMonths={1}
                showDeleteButton={false}
                rightIcon={<Calendar />}
                onChange={({ from, to }) => {
                  setDateFrom(from ? startOfDay(from).toISOString() : '');
                  setDateTo(to ? endOfDay(to).toISOString() : '');
                }}
              />

              <AdvancedFilterCheckbox
                title="Status"
                description="Filtrar por status"
                options={STATUS_OPTIONS}
                defaultValue={selectedStatuses.map((s) => ({
                  id: s,
                  label: STATUS_OPTIONS.find((o) => o.id === s)!.label,
                }))}
                onChange={(next) =>
                  setSelectedStatuses(
                    next.map((o) => o.id as EFinanceEntryStatus),
                  )
                }
                onDelete={() => setSelectedStatuses([])}
                showCounterIndicator
                showDeleteButton={false}
              />
            </>
          }
        />

        {/* listagem */}
        <FinanceEntriesList
          entries={entries}
          isLoading={isLoading}
          onEdit={(id) => {
            const e = entries.find((x) => x.id === id);
            if (e) handleEdit(e);
          }}
          onDelete={handleDelete}
        />

        {/* paginação */}
        {totalItems > 0 && (
          <div className="mt-4">
            <AppPagination
              totalItems={totalItems}
              itemsPerPage={limit}
              currentPage={page}
              onPageChange={setPage}
              onItemsPerPageChange={setLimit}
            />
          </div>
        )}

        {/* sheets */}
        {editEntry && (
          <SheetEditExpenseEntry
            isOpen={editOpen}
            setIsOpen={(open) => {
              setEditOpen(open);
              if (!open) setEditEntry(null);
            }}
            entry={{
              ...editEntry,
              type: EFinanceEntryType.EXPENSE,
              category: editEntry.categoryId,
              status: editEntry.status as EFinanceEntryStatus,
              paymentMethod: editEntry.paymentMethod as EPaymentMethod,
              currency: editEntry.currency ?? 'BRL',
              date: editEntry.date.toISOString(),
              amount: editEntry.amount.toString(),
              description: editEntry.description ?? undefined,
              referenceId: editEntry.referenceId ?? undefined,
            }}
            refetch={financeQuery.refetch}
          />
        )}

        {createOpen && (
          <SheetCreateExpenseEntry
            isOpen={createOpen}
            setIsOpen={setCreateOpen}
            refetch={financeQuery.refetch}
          />
        )}
      </div>
    </Suspense>
  );
}
