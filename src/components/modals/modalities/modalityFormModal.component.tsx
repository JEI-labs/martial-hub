'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { MODALITY_CATALOG } from '@/common/constants/modalities';
import { slugify } from '@/common/utils/string';
import { FormModal } from '@/components/formModal/formModal.component';
import { FormInputComponent } from '@/components/forms/formInput/formInput.component';
import { FormSwitchComponent } from '@/components/forms/formSwitchInput/formSwitchInput.component';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import {
  IModalityFormSchema,
  modalityFormSchema,
} from '@/server/validations/modalities';
import { api } from '@/trpc/react';
import { IModalityFormModal } from './modalityFormModal.types';

export const ModalityFormModal: React.FC<IModalityFormModal> = ({
  isOpen,
  setIsOpen,
  modality,
  existing,
  onDelete,
}) => {
  const { toast } = useToast();
  const utils = api.useUtils();
  const isEditing = !!modality;

  const onSuccess = () => utils.modalities.list.invalidate();
  const create = api.modalities.create.useMutation({ onSuccess });
  const update = api.modalities.update.useMutation({ onSuccess });

  const form = useForm<IModalityFormSchema>({
    resolver: zodResolver(modalityFormSchema),
    defaultValues: { name: '', isActive: true },
    mode: 'onChange',
  });

  useEffect(() => {
    form.reset({
      name: modality?.name ?? '',
      isActive: modality?.isActive ?? true,
    });
  }, [modality, form]);

  /* Só o que a academia ainda não tem: sugerir "Boxe" para quem já tem boxe
     só daria erro de nome repetido. */
  const cadastradas = new Set(existing.map((m) => m.slug));
  const sugestoes = MODALITY_CATALOG.filter(
    (nome) => !cadastradas.has(slugify(nome)),
  );

  const onSubmit = async (data: IModalityFormSchema) => {
    try {
      if (modality) {
        await update.mutateAsync({ id: modality.id, ...data });
      } else {
        await create.mutateAsync({ name: data.name });
      }
      toast({
        title: 'Sucesso',
        description: isEditing
          ? 'Modalidade atualizada com sucesso'
          : 'Modalidade cadastrada com sucesso',
      });
      setIsOpen(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Ocorreu um erro inesperado';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
    }
  };

  return (
    <Form {...form}>
      <FormModal
        open={isOpen}
        onOpenChange={setIsOpen}
        title={isEditing ? 'Editar modalidade' : 'Nova modalidade'}
        description={
          isEditing
            ? 'Altere o nome ou desative a modalidade'
            : 'Escolha uma sugestão ou escreva o nome que a academia usa'
        }
        onSubmit={form.handleSubmit(onSubmit)}
        onDelete={onDelete}
        submitLabel={isEditing ? 'Salvar alterações' : 'Cadastrar'}
        submitPendingLabel="Salvando..."
        isSubmitting={
          create.isPending || update.isPending || form.formState.isSubmitting
        }
        sheetOnMobile
      >
        <div className="grid gap-6">
          <FormInputComponent
            control={form.control}
            name="name"
            label="Nome"
            type="text"
            placeholder="Ex.: Jiu-Jitsu"
            maxLength={50}
          />

          {!isEditing && sugestoes.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {sugestoes.map((nome) => (
                <Button
                  key={nome}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full font-normal"
                  onClick={() =>
                    form.setValue('name', nome, { shouldValidate: true })
                  }
                >
                  {nome}
                </Button>
              ))}
            </div>
          )}

          {isEditing && (
            <FormSwitchComponent
              control={form.control}
              name="isActive"
              title="Ativa"
              bottomDescription="Desativada, some das matrículas novas, mas quem já faz continua fazendo. A academia precisa de pelo menos uma ativa."
            />
          )}
        </div>
      </FormModal>
    </Form>
  );
};
