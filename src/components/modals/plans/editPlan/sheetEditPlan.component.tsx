'use client';

import { FormModal } from '@/components/formModal/formModal.component';
import React, { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Form } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { FormInputComponent } from '@/components/forms/formInput/formInput.component';
import { FormSelectComponent } from '@/components/forms/formSelectInput/formSelectInput.component';
import { FormSwitchComponent } from '@/components/forms/formSwitchInput/formSwitchInput.component';
import { PLAN_BILLING_OPTIONS } from '@/common/constants/planBilling';
import { api } from '@/trpc/react';
import { ISheetEditPlan } from './sheetEditPlan.types';
import {
  IUpdatePlanSchema,
  updatePlanSchema,
} from '@/server/validations/plans';
import { maskDecimalWithAcronym, unmaskDecimal } from '@/utils/masksUtils';
import { maskOnlyNumbersV2 } from '@/common/utils/mask';
import { EPlanBilling } from '@prisma/client';

export const SheetEditPlan: React.FC<ISheetEditPlan> = ({
  isOpen,
  setIsOpen,
  planId,
  onDelete,
  refetch,
}) => {
  const { toast } = useToast();
  const utils = api.useUtils();

  const planQuery = api.plans.getById.useQuery({ id: planId });

  const updatePlan = api.plans.update.useMutation({
    onSuccess: async () => {
      await utils.plans.getById.invalidate({ id: planId });
      await utils.plans.getAll.invalidate();
    },
  });

  const form = useForm<IUpdatePlanSchema>({
    resolver: zodResolver(updatePlanSchema),
    defaultValues: {
      id: '',
      name: '',
      description: '',
      price: '0',
      duration: '1',
      billing: EPlanBilling.MONTHLY,
      isDefault: false,
    },
    mode: 'onChange',
  });

  useEffect(() => {
    const plan = planQuery.data?.data;
    if (plan) {
      form.reset({
        id: plan.id,
        name: plan.name,
        description: plan.description ?? '',
        price: (Number(plan.price) * 100).toString(),
        duration: plan.duration.toString(),
        billing: plan.billing,
        isDefault: plan.isDefault,
      });
    }
  }, [planQuery.data, form]);

  const onSubmit = async (data: IUpdatePlanSchema) => {
    try {
      await updatePlan.mutateAsync(data);
      toast({
        title: 'Sucesso',
        description: 'Plano atualizado com sucesso',
        variant: 'default',
      });
      setIsOpen(false);
      refetch?.();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Ocorreu um erro inesperado';
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
      console.error(err);
    }
  };

  return (
    <Form {...form}>
      <FormModal
        open={isOpen}
        onOpenChange={setIsOpen}
        title="Editar plano"
        description="Altere os dados do plano"
        onSubmit={form.handleSubmit(onSubmit)}
        onDelete={onDelete}
        submitLabel="Salvar alterações"
        submitPendingLabel="Salvando..."
        isSubmitting={updatePlan.isPending || form.formState.isSubmitting}
      >
        <div className="grid grid-cols-4 gap-6">
          <div className="col-span-4">
            <FormInputComponent
              control={form.control}
              name="name"
              label="Nome"
              type="text"
              placeholder="Nome do plano"
              maxLength={50}
            />
          </div>
          <div className="col-span-4">
            <FormInputComponent
              control={form.control}
              name="description"
              label="Descrição"
              type="text"
              placeholder="(opcional)"
              maxLength={50}
            />
          </div>
          <div className="col-span-2">
            <FormInputComponent
              control={form.control}
              name="price"
              label="Preço do período (R$)"
              tooltip="Valor cheio do período, não o da parcela. Um trimestral de R$ 350,50 custa isso pelos três meses — na cobrança mensal o sistema divide em três."
              placeholder="0.00"
              mask={maskDecimalWithAcronym}
              unmask={unmaskDecimal}
              maxLength={10}
            />
          </div>
          <div className="col-span-2">
            <FormInputComponent
              control={form.control}
              name="duration"
              label="Duração (meses)"
              tooltip="Por quantos meses a matrícula vale."
              placeholder="1"
              mask={maskOnlyNumbersV2}
              min={1}
            />
          </div>
          <div className="col-span-2">
            <FormSelectComponent
              control={form.control}
              name="billing"
              label="Cobrança"
              tooltip="Mensal gera uma parcela por mês. À vista gera uma parcela só, paga na matrícula. Vale para as próximas matrículas; as que já existem seguem como foram criadas."
              placeholder="Como o aluno paga"
              options={PLAN_BILLING_OPTIONS}
            />
          </div>
          <div className="col-span-2">
            <FormSwitchComponent
              control={form.control}
              name="isDefault"
              title="Plano padrão"
              bottomDescription="Vem escolhido sozinho ao matricular um aluno. Só um plano pode ser o padrão: marcar este tira o anterior."
            />
          </div>
        </div>
      </FormModal>
    </Form>
  );
};
