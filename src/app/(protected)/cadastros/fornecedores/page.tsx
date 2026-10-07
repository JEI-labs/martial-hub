'use client';

import { UserSquare } from 'lucide-react';
import { Plus } from 'lucide-react';
import { PageIntro } from '@/components/pageIntro/pageIntro.component';

import { useResetOnChange } from '@/hooks/useResetOnChange/useResetOnChange.hook';
import { useForm } from 'react-hook-form';
import { useState } from 'react';
import { BreadcrumbUpdater } from '@/contexts/breadcrumb';
import { Button } from '@/components/ui/button';
import { api } from '@/trpc/react';
import { ListToolbar } from '@/components/listToolbar/listToolbar.component';
import { AppPagination } from '@/components/appPagination/appPagination.component';
import SuppliersList from '@/components/suppliers/supplierList';
import { SheetCreateSupplier } from '@/components/modals/suppliers/createSupplier/createSupplier.component';
import { SheetEditSupplier } from '@/components/modals/suppliers/editSupplier/editSupplier.component';
import { useDebounce } from '@/hooks/useDebounce/useDebounce';
import { FormSelectComponent } from '@/components/forms/formSelectInput/formSelectInput.component';
import { Form } from '@/components/ui/form';

interface ISupplierForm {
  state: string | null;
}

const breadcrumbItems = [
  { label: 'Home', href: '/painel' },
  { label: 'Cadastros', href: '/cadastros' },
  { label: 'Fornecedores', href: '/cadastros/fornecedores' },
];

export default function SuppliersPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const debounced = useDebounce(searchTerm, 500);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const [selectedState, setSelectedState] = useState<string | null>(null);

  const { data, isLoading, refetch } = api.supplier.getAll.useQuery({
    page,
    limit,
    search: debounced,
    state: selectedState || undefined,
  });
  const statesOptions = data?.states ?? [];

  // sempre volta à página 1 ao mudar busca ou limite
  useResetOnChange([debounced, limit], () => setPage(1));

  const deleteMutation = api.supplier.delete.useMutation();

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync({ id });
    await refetch();
  };

  const form = useForm<ISupplierForm>({
    defaultValues: {
      state: selectedState,
    },
  });

  const handleStateChange = (value: string) => {
    setSelectedState(value);
    form.setValue('state', value);
    refetch();
  };

  return (
    <div className="w-full">
      <BreadcrumbUpdater items={breadcrumbItems} />

      <main className="flex flex-col gap-4">
        <PageIntro
          icon={UserSquare}
          title="O que é um fornecedor?"
          example={
            <>
              <strong className="text-foreground font-medium">
                Casa do Boxe
              </strong>{' '}
              — material de treino, (11) 99999-0000, São Paulo/SP.
            </>
          }
        >
          É quem vende ou presta serviço para a academia. A tela guarda o
          contato e o endereço de cada um, para ter à mão na hora de repor
          material ou chamar uma manutenção.
        </PageIntro>

        <ListToolbar
          searchPlaceholder="Buscar fornecedores..."
          onSearch={setSearchTerm}
          total={data?.pagination.total}
          totalLabel={['fornecedor', 'fornecedores']}
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 size-4" />
              Novo fornecedor
            </Button>
          }
          filters={
            <Form {...form}>
              <div className="w-56">
                <FormSelectComponent
                  name="state"
                  options={statesOptions
                    .filter(
                      (state): state is string => typeof state === 'string',
                    )
                    .map((state) => ({ value: state, textValue: state }))}
                  placeholder="Estado"
                  onValueChange={handleStateChange}
                  defaultValue={selectedState || ''}
                  disabled={isLoading}
                  control={form.control}
                />
              </div>
            </Form>
          }
        />

        <SuppliersList
          suppliers={data?.data ?? []}
          isLoading={isLoading}
          onEdit={(id) => {
            setEditId(id);
            setEditOpen(true);
          }}
        />

        <AppPagination
          totalItems={data?.pagination.total ?? 0}
          itemsPerPage={limit}
          currentPage={page}
          onPageChange={setPage}
          onItemsPerPageChange={setLimit}
        />

        {createOpen && (
          <SheetCreateSupplier
            isOpen={createOpen}
            setIsOpen={setCreateOpen}
            refetch={refetch}
          />
        )}
        {editOpen && editId && (
          <SheetEditSupplier
            isOpen={editOpen}
            setIsOpen={setEditOpen}
            supplierId={editId}
            refetch={refetch}
            onDelete={() => handleDelete(editId)}
          />
        )}
      </main>
    </div>
  );
}
