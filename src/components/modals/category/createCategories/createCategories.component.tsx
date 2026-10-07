// components/sheetCreateCategory.tsx
import { FormModal } from '@/components/formModal/formModal.component';
import React from 'react';
import { Form } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormInputComponent } from '@/components/forms/formInput/formInput.component';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/trpc/react';
import {
  createCategorySchema,
  ICreateCategory,
  ICreateCategoryInput,
} from '@/server/validations/categories';
import { ICreateSheetCategory } from './createCategories.types';

export const SheetCreateCategory: React.FC<ICreateSheetCategory> = ({
  isOpen,
  setIsOpen,
  refetch,
}) => {
  const { toast } = useToast();
  const createCategory = api.category.create.useMutation();

  const form = useForm<ICreateCategoryInput, unknown, ICreateCategory>({
    resolver: zodResolver(createCategorySchema),
    defaultValues: { name: '', status: 'ACTIVE', description: '' },
    mode: 'onChange',
  });

  const onSubmit = async (values: ICreateCategory) => {
    try {
      await createCategory.mutateAsync(values);
      toast({
        title: 'Sucesso',
        description: 'Categoria criada com sucesso',
      });
      form.reset();
      setIsOpen(false);
      refetch?.();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Erro ao criar categoria';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
    }
  };

  return (
    <Form {...form}>
      <FormModal
        open={isOpen}
        onOpenChange={setIsOpen}
        title="Nova categoria"
        description="Preencha os dados da categoria"
        onSubmit={form.handleSubmit(onSubmit)}
        submitLabel="Criar categoria"
        submitPendingLabel="Salvando..."
        isSubmitting={createCategory.isPending || form.formState.isSubmitting}
      >
        <FormInputComponent
          control={form.control}
          name="name"
          label="Nome"
          type="text"
          placeholder="Ex: Mensalidade"
          maxLength={50}
        />

        <FormInputComponent
          control={form.control}
          name="description"
          label="Descrição"
          type="text"
          placeholder="Descreva a categoria"
          maxLength={50}
        />
      </FormModal>
    </Form>
  );
};
