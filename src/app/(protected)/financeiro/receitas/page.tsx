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
import { SheetCreateFinanceEntry } from '@/components/modals/revenues/createRevenues/createRevenues.component';
import { SheetEditFinanceEntry } from '@/components/modals/revenues/editRevenues/editRevenues.component';
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

const breadcrumbItems = [
  { label: 'Home', href: '/painel' },
  { label: 'Financeiro', href: '/financeiro' },
  { label: 'Receitas', href: '/financeiro/receitas' },
];

const STATUS_OPTIONS = [
  { id: 'PENDING' as EFinanceEntryStatus, label: 'Pendente' },
  { id: 'PAID' as EFinanceEntryStatus, label: 'Pago' },
  { id: 'CANCELLED' as EFinanceEntryStatus, label: 'Cancelado' },
];

/**
 * As duas receitas que a academia tem: a mensalidade, que nasce sozinha
 * quando o aluno paga, e o lançamento avulso, digitado à mão.
 */
const TYPE_OPTIONS = [
  { id: EFinanceEntryType.STUDENTS as string, label: 'Mensalidade de aluno' },
  { id: EFinanceEntryType.INCOME as string, label: 'Receita avulsa' },
];

const ALL_REVENUE_TYPES = [
  EFinanceEntryType.INCOME,
  EFinanceEntryType.STUDENTS,
];

const defaultRange = getDefaultDateRange();

export default function RevenuesPage() {
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

  const [selectedTypes, setSelectedTypes] = useState<Array<EFinanceEntryType>>(
    [],
  );

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const financeQuery = api.finance.getAll.useQuery({
    page,
    limit,
    search: debouncedSearch,
    // Mensalidade também é receita: deixá-la só no Resumo fazia a soma de lá
    // não bater com a lista daqui.
    type: selectedTypes.length > 0 ? selectedTypes : ALL_REVENUE_TYPES,
    status: selectedStatuses.length > 0 ? selectedStatuses : undefined,
    from: debouncedFrom || undefined,
    to: debouncedTo || undefined,
  });

  const deleteMutation = api.finance.delete.useMutation();

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync({ id });
      toast({ title: 'Sucesso', description: 'Lançamento excluído' });
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
    [
      debouncedSearch,
      debouncedFrom,
      debouncedTo,
      selectedStatuses,
      selectedTypes,
      limit,
    ],
    () => setPage(1),
  );

  const entries = financeQuery.data?.data ?? [];
  const totalItems = financeQuery.data?.pagination.total ?? 0;
  const isLoading = financeQuery.isLoading;

  return (
    <Suspense fallback={<div>Carregando receitas…</div>}>
      <div className="w-full gap-6 py-6">
        <BreadcrumbUpdater items={breadcrumbItems} />

        <ListToolbar
          searchPlaceholder="Buscar receitas..."
          onSearch={setSearchTerm}
          total={totalItems}
          totalLabel={['receita', 'receitas']}
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 size-4" />
              Criar lançamento
            </Button>
          }
          filters={
            <>
              <AdvancedFilterDatePicker
                defaultValue={defaultRange}
                title="Filtrar por data"
                description="Intervalo de datas"
                numberOfMonths={1}
                showDeleteButton={false}
                rightIcon={<Calendar />}
                onChange={({ from, to }) => {
                  setDateFrom(from ? from.toISOString() : '');
                  setDateTo(to ? to.toISOString() : '');
                }}
              />

              <AdvancedFilterCheckbox
                title="Tipo"
                description="Filtrar por tipo de receita"
                options={TYPE_OPTIONS}
                defaultValue={selectedTypes.map((type) => ({
                  id: type,
                  label: TYPE_OPTIONS.find((o) => o.id === type)!.label,
                }))}
                onChange={(next) => {
                  setSelectedTypes(next.map((o) => o.id as EFinanceEntryType));
                }}
                onDelete={() => setSelectedTypes([])}
                showCounterIndicator
                showDeleteButton={false}
              />

              <AdvancedFilterCheckbox
                title="Status"
                description="Filtrar por status"
                options={STATUS_OPTIONS}
                defaultValue={selectedStatuses.map((s) => ({
                  id: s,
                  label: STATUS_OPTIONS.find((o) => o.id === s)!.label,
                }))}
                onChange={(next) => {
                  setSelectedStatuses(
                    next.map((o) => o.id as EFinanceEntryStatus),
                  );
                }}
                onDelete={() => setSelectedStatuses([])}
                showCounterIndicator
                showDeleteButton={false}
              />
            </>
          }
        />

        <FinanceEntriesList
          entries={entries}
          isLoading={isLoading}
          onEdit={(id) => {
            const entry = entries.find((e) => e.id === id);
            if (entry) handleEdit(entry);
          }}
          onDelete={handleDelete}
        />

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

        {editEntry && (
          <SheetEditFinanceEntry
            isOpen={editOpen}
            setIsOpen={(open) => {
              setEditOpen(open);
              if (!open) setEditEntry(null);
            }}
            entry={{
              ...editEntry,
              type: EFinanceEntryType.INCOME,
              category: editEntry.categoryId,
              status: editEntry.status as EFinanceEntryStatus,
              paymentMethod: editEntry.paymentMethod as EPaymentMethod,
              currency: editEntry.currency || 'BRL',
              date: editEntry.date.toISOString(),
              amount: editEntry.amount.toString(),
              description: editEntry.description ?? undefined,
              referenceId: editEntry.referenceId ?? undefined,
            }}
            refetch={financeQuery.refetch}
          />
        )}

        {createOpen && (
          <SheetCreateFinanceEntry
            isOpen={createOpen}
            setIsOpen={setCreateOpen}
            refetch={financeQuery.refetch}
          />
        )}
      </div>
    </Suspense>
  );
}
