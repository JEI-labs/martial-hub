'use client';

import { Layers3 } from 'lucide-react';
import { Plus } from 'lucide-react';
import { PageIntro } from '@/components/pageIntro/pageIntro.component';

import { useResetOnChange } from '@/hooks/useResetOnChange/useResetOnChange.hook';
import { useState } from 'react';
import { BreadcrumbUpdater } from '@/contexts/breadcrumb';
import CategoriesList from '@/components/categories/categoriesList.component';
import { Button } from '@/components/ui/button';
import { SheetCreateCategory } from '@/components/modals/category/createCategories/createCategories.component';
import { api } from '@/trpc/react';
import { ListToolbar } from '@/components/listToolbar/listToolbar.component';
import { AppPagination } from '@/components/appPagination/appPagination.component';
import { useDebounce } from '@/hooks/useDebounce/useDebounce';
import { SheetEditCategory } from '@/components/modals/category/editCategory/editCategory.component';
import { AdvancedFilterDatePicker } from '@/components/forms/advancedFilterDatePicker/advancedFilterDatePicker.component';
import { Calendar } from 'lucide-react';
import { AdvancedFilterCheckbox } from '@/components/forms/advancedFilterCheckbox/advancedFilterCheckbox.component';
import { AdvancedFilterCheckboxType } from '@/components/forms/advancedFilterCheckbox/advancedFilterCheckbox.types';
import { ECategoryStatus } from '@prisma/client';

const breadcrumbItems = [
  { label: 'Home', href: '/painel' },
  { label: 'Cadastros', href: '/cadastros' },
  { label: 'Categorias', href: '/cadastros/categorias' },
];

const STATUS_OPTIONS: Array<AdvancedFilterCheckboxType> = [
  { id: 'ACTIVE', label: 'Ativas' },
  { id: 'INACTIVE', label: 'Inativas' },
];

export default function CategoriesPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  /* Cadastro não é movimento: a lista abre com tudo o que existe, e a data
     só entra na busca quando alguém escolher um período. */
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const [selectedStatuses, setSelectedStatuses] = useState<
    Array<ECategoryStatus>
  >([]);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 500);

  // paginação
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const { data, isLoading, refetch } = api.category.getAll.useQuery({
    page,
    limit,
    search: debouncedSearch,
    // só envia status se não for 'ALL'
    status: selectedStatuses.length > 0 ? selectedStatuses : undefined,
    // somente envie as datas se preenchidas
    from: dateFrom || undefined,
    to: dateTo || undefined,
  });

  const deleteMutation = api.category.delete.useMutation();

  const categories = data?.data ?? [];
  const totalItems = data?.pagination.total ?? 0;

  // sempre volta à página 1 ao mudar busca ou limite
  useResetOnChange([debouncedSearch, limit], () => setPage(1));

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync({ id });
    setEditId(null);
    await refetch();
  };

  return (
    <div className="w-full">
      <BreadcrumbUpdater items={breadcrumbItems} />

      <main className="flex flex-col gap-4">
        <PageIntro
          icon={Layers3}
          title="O que é uma categoria?"
          example={
            <>
              <strong className="text-foreground font-medium">Aluguel</strong>,{' '}
              <strong className="text-foreground font-medium">Energia</strong>{' '}
              ou{' '}
              <strong className="text-foreground font-medium">
                Equipamentos
              </strong>{' '}
              para as despesas. A categoria <em>Alunos</em> já vem pronta e é do
              sistema: as mensalidades caem nela sozinhas, e por isso ela não
              pode ser editada nem excluída.
            </>
          }
        >
          É a gaveta onde cada lançamento do financeiro é guardado. Todo
          lançamento precisa de uma, e é por ela que o resumo consegue dizer
          para onde o dinheiro da academia foi.
        </PageIntro>

        <ListToolbar
          searchPlaceholder="Buscar categorias..."
          onSearch={(value) => setSearchTerm(value)}
          total={totalItems}
          totalLabel={['categoria', 'categorias']}
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 size-4" />
              Criar categoria
            </Button>
          }
          filters={
            <>
              <AdvancedFilterDatePicker
                title="Buscar datas"
                onChange={({ from, to }) => {
                  setDateFrom(from ? from.toISOString() : '');
                  setDateTo(to ? to.toISOString() : '');
                }}
                description="Data de criação das categorias"
                numberOfMonths={1}
                showDeleteButton={false}
                rightIcon={<Calendar />}
              />

              <AdvancedFilterCheckbox
                title="Status"
                description="Filtrar por status da categoria"
                defaultValue={selectedStatuses.map((status) => ({
                  id: status,
                  label:
                    STATUS_OPTIONS.find((option) => option.id === status)
                      ?.label || status,
                }))}
                options={STATUS_OPTIONS}
                onDelete={() => {
                  setSelectedStatuses([]);
                }}
                onChange={(next: Array<AdvancedFilterCheckboxType>) => {
                  setSelectedStatuses(
                    next.map((item) => item.id as ECategoryStatus),
                  );
                }}
                showCounterIndicator
                showDeleteButton={false}
              />
            </>
          }
        />

        <CategoriesList
          categories={categories}
          isLoading={isLoading}
          onEdit={(id) => {
            setEditId(id);
            setEditOpen(true);
          }}
        />

        {totalItems > 0 && (
          <div className="w-full">
            <AppPagination
              totalItems={totalItems}
              itemsPerPage={limit}
              currentPage={page}
              onPageChange={(p) => setPage(p)}
              onItemsPerPageChange={(newLimit) => setLimit(newLimit)}
            />
          </div>
        )}

        {editOpen && (
          <SheetEditCategory
            isOpen={editOpen}
            setIsOpen={setEditOpen}
            refetch={refetch}
            categoryId={editId ?? ''}
            onDelete={() => handleDelete(editId ?? '')}
          />
        )}

        {createOpen && (
          <SheetCreateCategory
            isOpen={createOpen}
            setIsOpen={setCreateOpen}
            refetch={refetch}
          />
        )}
      </main>
    </div>
  );
}
