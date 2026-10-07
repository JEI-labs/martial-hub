// components/sheetCreatePlan.tsx
'use client';

import { FormModal } from '@/components/formModal/formModal.component';
import React from 'react';
import { Form } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormInputComponent } from '@/components/forms/formInput/formInput.component';
import { FormSelectComponent } from '@/components/forms/formSelectInput/formSelectInput.component';
import { FormSwitchComponent } from '@/components/forms/formSwitchInput/formSwitchInput.component';
import { PLAN_BILLING_OPTIONS } from '@/common/constants/planBilling';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/trpc/react';
import { ICreateSheetPlan } from './sheetCreatePlan.types';
import { maskDecimalWithAcronym, unmaskDecimal } from '@/utils/masksUtils';
import {
  createPlanSchema,
  ICreatePlanSchema,
} from '@/server/validations/plans';
import { maskOnlyNumbersV2 } from '@/common/utils/mask';
import { EPlanBilling } from '@prisma/client';

export const SheetCreatePlan: React.FC<ICreateSheetPlan> = ({
  isOpen,
  setIsOpen,
  refetch,
}) => {
  const { toast } = useToast();
  const createPlan = api.plans.create.useMutation();

  const form = useForm<ICreatePlanSchema>({
    resolver: zodResolver(createPlanSchema),
    defaultValues: {
      name: '',
      price: '0',
      duration: '1',
      billing: EPlanBilling.MONTHLY,
      isDefault: false,
      description: '',
    },
    mode: 'onChange',
  });

  const onSubmit = async (values: ICreatePlanSchema) => {
    try {
      await createPlan.mutateAsync(values);
      toast({
        title: 'Sucesso',
        description: 'Plano criado com sucesso',
      });
      form.reset();
      setIsOpen(false);
      refetch?.();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Erro ao criar plano';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
    }
  };

  return (
    <Form {...form}>
      <FormModal
        open={isOpen}
        onOpenChange={setIsOpen}
        title="Novo plano"
        description="Preencha os dados do plano"
        onSubmit={form.handleSubmit(onSubmit)}
        submitLabel="Criar plano"
        submitPendingLabel="Salvando..."
        isSubmitting={createPlan.isPending || form.formState.isSubmitting}
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
          placeholder="Descreva o plano"
          maxLength={100}
        />

        <FormInputComponent
          control={form.control}
          name="price"
          label="Preço do período (R$)"
          tooltip="Valor cheio do período, não o da parcela. Um trimestral de R$ 350,50 custa isso pelos três meses — na cobrança mensal o sistema divide em três."
          placeholder="0.00"
          mask={maskDecimalWithAcronym}
          unmask={unmaskDecimal}
        />

        <FormInputComponent
          control={form.control}
          name="duration"
          label="Duração (meses)"
          tooltip="Por quantos meses a matrícula vale."
          placeholder="1"
          maxLength={2}
          mask={maskOnlyNumbersV2}
        />

        <FormSelectComponent
          control={form.control}
          name="billing"
          label="Cobrança"
          tooltip="Mensal gera uma parcela por mês. À vista gera uma parcela só, paga na matrícula: o aluno não tem mensalidade vencendo no meio do período, e a próxima cobrança é a renovação."
          placeholder="Como o aluno paga"
          options={PLAN_BILLING_OPTIONS}
        />

        <FormSwitchComponent
          control={form.control}
          name="isDefault"
          title="Plano padrão"
          bottomDescription="Vem escolhido sozinho ao matricular um aluno. Só um plano pode ser o padrão: marcar este tira o anterior."
        />
      </FormModal>
    </Form>
  );
};
