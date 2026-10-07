'use client';

import { Package } from 'lucide-react';
import { Plus } from 'lucide-react';
import { PageIntro } from '@/components/pageIntro/pageIntro.component';

import { useResetOnChange } from '@/hooks/useResetOnChange/useResetOnChange.hook';
import { useState } from 'react';
import { BreadcrumbUpdater } from '@/contexts/breadcrumb';
import { Button } from '@/components/ui/button';
import { api } from '@/trpc/react';
import { ListToolbar } from '@/components/listToolbar/listToolbar.component';
import { AppPagination } from '@/components/appPagination/appPagination.component';
import { useDebounce } from '@/hooks/useDebounce/useDebounce';
import PlansList from '@/components/plans/plansList.component';
import { SheetEditPlan } from '@/components/modals/plans/editPlan/sheetEditPlan.component';
import { SheetCreatePlan } from '@/components/modals/plans/createPlan/sheetCreatePlan.component';
import { toast } from '@/hooks/use-toast';

const breadcrumbItems = [
  { label: 'Home', href: '/painel' },
  { label: 'Cadastros', href: '/cadastros' },
  { label: 'Planos', href: '/cadastros/planos' },
];

export default function PlansPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 500);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const { data, isLoading, refetch } = api.plans.getAll.useQuery({
    page,
    limit,
    search: debouncedSearch,
  });

  const deleteMutation = api.plans.delete.useMutation();

  const plans = data?.data ?? [];
  const totalItems = data?.pagination.total ?? 0;

  // sempre volta à página 1 ao mudar busca ou limite
  useResetOnChange([debouncedSearch, limit], () => setPage(1));

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync({ id });
    setEditId(null);
    await refetch();
    toast({
      title: 'Sucesso',
      description: 'Plano deletado com sucesso',
    });
  };

  return (
    <div className="w-full">
      <BreadcrumbUpdater items={breadcrumbItems} />

      <main className="flex flex-col gap-4">
        <PageIntro
          icon={Package}
          title="O que é um plano?"
          example={
            <>
              <strong className="text-foreground font-medium">
                Trimestral
              </strong>{' '}
              — R$ 450 por 3 meses. Na cobrança{' '}
              <strong className="text-foreground font-medium">mensal</strong>, a
              matrícula gera três parcelas de R$ 150. Na{' '}
              <strong className="text-foreground font-medium">à vista</strong>,
              gera uma só de R$ 450, já paga, e o aluno fica sem nada vencendo
              até a renovação.
            </>
          }
        >
          É o contrato que o aluno assina: quanto custa e por quantos meses
          vale. O preço é o do período inteiro; quem divide em parcelas é a
          forma de cobrança escolhida no plano.
        </PageIntro>

        <ListToolbar
          searchPlaceholder="Buscar planos..."
          onSearch={(value) => setSearchTerm(value)}
          total={totalItems}
          totalLabel={['plano', 'planos']}
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 size-4" />
              Criar plano
            </Button>
          }
        />

        <PlansList
          plans={plans}
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
          <SheetEditPlan
            isOpen={editOpen}
            setIsOpen={setEditOpen}
            refetch={refetch}
            planId={editId ?? ''}
            onDelete={() => handleDelete(editId ?? '')}
          />
        )}

        {createOpen && (
          <SheetCreatePlan
            isOpen={createOpen}
            setIsOpen={setCreateOpen}
            refetch={refetch}
          />
        )}
      </main>
    </div>
  );
}
