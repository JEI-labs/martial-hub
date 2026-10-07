'use client';

import { useResetOnChange } from '@/hooks/useResetOnChange/useResetOnChange.hook';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { BreadcrumbUpdater } from '@/contexts/breadcrumb';
import { FinancialSummary } from '@/components/finance/financeSummary/financeSummary.component';
import { StatsSkeleton } from '@/components/skeletons/listSkeleton.component';
import { api } from '@/trpc/react';
import { FinanceEntriesList } from '@/components/finance/financeList.component';
import { useDebounce } from '@/hooks/useDebounce/useDebounce';
import {
  AdvancedFilterDatePicker,
  getDefaultDateRange,
} from '@/components/forms/advancedFilterDatePicker/advancedFilterDatePicker.component';
import { Calendar } from 'lucide-react';
import { AppPagination } from '@/components/appPagination/appPagination.component';
import { EFinanceEntryStatus, EFinanceEntryType } from '@prisma/client';
import { AdvancedFilterCheckbox } from '@/components/forms/advancedFilterCheckbox/advancedFilterCheckbox.component';
import { STATUS_OPTIONS, TYPE_OPTIONS } from './utils';

const breadcrumbItems = [
  { label: 'Home', href: '/painel' },
  { label: 'Financeiro', href: '/financeiro' },
  { label: 'Resumo', href: '/financeiro/resumo' },
];

const defaultRange = getDefaultDateRange();

export default function FinanceSummary() {
  const [dateFrom, setDateFrom] = useState<string>(
    defaultRange.from.toISOString(),
  );
  const [dateTo, setDateTo] = useState<string>(defaultRange.to.toISOString());
  const [page, setPage] = useState<number>(1);
  const [itensPerPage, setItensPerPage] = useState<number>(10);
  const [selectedTypes, setSelectedTypes] = useState<Array<EFinanceEntryType>>(
    [],
  );
  const [selectedStatuses, setSelectedStatuses] = useState<
    Array<EFinanceEntryStatus>
  >([]);

  const debouncedFrom = useDebounce(dateFrom, 500);
  const debouncedTo = useDebounce(dateTo, 500);

  const {
    data: entries,
    refetch,
    isLoading,
  } = api.finance.getAll.useQuery({
    page,
    limit: itensPerPage,
    from: debouncedFrom || undefined,
    to: debouncedTo || undefined,
    type: selectedTypes.length === 1 ? selectedTypes[0] : undefined,
    status: selectedStatuses.length > 0 ? selectedStatuses : undefined,
  });

  const {
    data: allEntries,
    isLoading: loadingAllEntries,
    refetch: refetchMetrics,
  } = api.finance.getAllMetrics.useQuery({
    from: debouncedFrom || undefined,
    to: debouncedTo || undefined,
    type: selectedTypes.length === 1 ? selectedTypes[0] : undefined,
    status: selectedStatuses.length > 0 ? selectedStatuses : undefined,
  });

  const totalItems = entries?.pagination.total ?? 0;

  const summary = useMemo(() => {
    let incomes = 0;
    let expenses = 0;
    let studentIncomes = 0;

    allEntries?.data.forEach((e) => {
      const isPaid = e.status === EFinanceEntryStatus.PAID;

      if (isPaid) {
        if (e.type === EFinanceEntryType.STUDENTS) {
          studentIncomes += e.amount / 100;
          incomes += e.amount / 100;
        } else if (e.type === EFinanceEntryType.INCOME) {
          incomes += e.amount / 100;
        } else if (e.type === EFinanceEntryType.EXPENSE) {
          expenses += e.amount / 100;
        }
      }
    });

    return { incomes, expenses, net: incomes - expenses, studentIncomes };
  }, [allEntries?.data]);

  // reset página ao mudar filtros
  useResetOnChange(
    [debouncedFrom, debouncedTo, selectedTypes, selectedStatuses],
    () => setPage(1),
  );

  useEffect(() => {
    refetch();
    refetchMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <div className="w-full">
        <BreadcrumbUpdater items={breadcrumbItems} />

        <main className="flex flex-col">
          <div className="my-4 flex flex-wrap items-center gap-2">
            <AdvancedFilterDatePicker
              defaultValue={defaultRange}
              title="Filtrar por data"
              description="Data dos lançamentos"
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
              description="Filtrar por tipo de lançamento"
              options={TYPE_OPTIONS}
              defaultValue={selectedTypes.map((type) => ({
                id: type,
                label:
                  TYPE_OPTIONS.find((opt) => opt.id === type)?.label || type,
              }))}
              onChange={(next) => {
                setSelectedTypes(
                  next.map((item) => item.id as EFinanceEntryType),
                );
              }}
              onDelete={() => setSelectedTypes([])}
              showCounterIndicator
              showDeleteButton={false}
            />

            <AdvancedFilterCheckbox
              title="Status"
              description="Filtrar por status de pagamento"
              options={STATUS_OPTIONS}
              defaultValue={selectedStatuses.map((status) => ({
                id: status,
                label:
                  STATUS_OPTIONS.find((opt) => opt.id === status)?.label ||
                  status,
              }))}
              onChange={(next) => {
                setSelectedStatuses(
                  next.map((item) => item.id as EFinanceEntryStatus),
                );
              }}
              onDelete={() => setSelectedStatuses([])}
              showCounterIndicator
              showDeleteButton={false}
            />
          </div>

          {loadingAllEntries ? (
            <StatsSkeleton />
          ) : (
            <FinancialSummary
              expenses={summary.expenses}
              incomes={summary.incomes}
              net={summary.net}
              studentIncomes={summary.studentIncomes}
            />
          )}

          {/* O respiro até a tabela é o padding do próprio cabeçalho
              "Lançamentos", igual em Receitas e Despesas. */}
          <FinanceEntriesList
            entries={(entries?.data || []).map((entry) => ({
              ...entry,
              referenceId: entry.referenceId ?? null,
              description: entry.description ?? null,
              paymentMethod: entry.paymentMethod ?? null,
            }))}
            isLoading={isLoading}
          />

          <div className="mt-4 w-full">
            <AppPagination
              totalItems={totalItems}
              itemsPerPage={itensPerPage}
              currentPage={page}
              onPageChange={(p) => setPage(p)}
              onItemsPerPageChange={(newLimit) => setItensPerPage(newLimit)}
            />
          </div>
        </main>
      </div>
    </Suspense>
  );
}
