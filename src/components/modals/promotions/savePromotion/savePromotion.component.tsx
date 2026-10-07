'use client';

import { useEffect } from 'react';
import { EDiscountType } from '@prisma/client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';

import { FormModal } from '@/components/formModal/formModal.component';
import { Form } from '@/components/ui/form';
import { FormInputComponent } from '@/components/forms/formInput/formInput.component';
import { FormSelectComponent } from '@/components/forms/formSelectInput/formSelectInput.component';
import { FormSwitchComponent } from '@/components/forms/formSwitchInput/formSwitchInput.component';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/trpc/react';
import { maskDate } from '@/utils/masksUtils';
import {
  createPromotionSchema,
  defaultPromotionValues,
  type ICreatePromotion,
  type ICreatePromotionInput,
} from '@/server/validations/promotions';

interface SavePromotionProps {
  isOpen: boolean;
  setIsOpen: (_open: boolean) => void;
  /** Ausente = criação. */
  promotionId?: string | null;
  /** Só na edição: exclusão mora no rodapé do próprio modal. */
  onDelete?: () => void | Promise<void>;
  refetch?: () => void;
}

/** dd/MM/yyyy -> Date, para o que o usuário digita virar data real. */
const parseDate = (value?: string | null): string | null => {
  if (!value) return null;
  const [day, month, year] = value.split('/');
  if (!day || !month || !year) return null;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const toInputDate = (value?: Date | string | null): string =>
  value ? new Date(value).toLocaleDateString('pt-BR') : '';

export function SavePromotion({
  isOpen,
  setIsOpen,
  promotionId,
  onDelete,
  refetch,
}: SavePromotionProps) {
  const { toast } = useToast();
  const isEditing = Boolean(promotionId);

  const listQuery = api.promotion.getAll.useQuery(
    { page: 1, limit: 100 },
    { enabled: isEditing && isOpen },
  );

  const form = useForm<ICreatePromotionInput, unknown, ICreatePromotion>({
    resolver: zodResolver(createPromotionSchema),
    defaultValues: defaultPromotionValues,
    mode: 'onChange',
  });

  const discountType = useWatch({
    control: form.control,
    name: 'discountType',
  });

  useEffect(() => {
    if (!isEditing || !isOpen) return;
    const current = listQuery.data?.data.find(
      (item) => item.id === promotionId,
    );
    if (!current) return;

    form.reset({
      name: current.name,
      description: current.description ?? '',
      discountType: current.discountType,
      discountValue: current.discountValue,
      startsAt: toInputDate(current.startsAt),
      endsAt: toInputDate(current.endsAt),
      isActive: current.isActive,
    });
  }, [isEditing, isOpen, listQuery.data, promotionId, form]);

  const create = api.promotion.create.useMutation();
  const update = api.promotion.update.useMutation();

  const onSubmit = async (values: ICreatePromotion) => {
    try {
      const payload = {
        ...values,
        startsAt: parseDate(values.startsAt),
        endsAt: parseDate(values.endsAt),
      };

      if (isEditing && promotionId) {
        await update.mutateAsync({ ...payload, id: promotionId });
      } else {
        await create.mutateAsync(payload);
      }

      toast({ title: isEditing ? 'Promoção atualizada' : 'Promoção criada' });
      form.reset(defaultPromotionValues);
      setIsOpen(false);
      refetch?.();
    } catch {
      toast({
        title: 'Erro ao salvar promoção',
        variant: 'destructive',
      });
    }
  };

  return (
    <Form {...form}>
      <FormModal
        open={isOpen}
        onOpenChange={setIsOpen}
        title={isEditing ? 'Editar promoção' : 'Nova promoção'}
        description="O desconto é aplicado ao registrar o pagamento de uma parcela."
        onSubmit={form.handleSubmit(onSubmit)}
        onDelete={isEditing ? onDelete : undefined}
        submitLabel={isEditing ? 'Salvar alterações' : 'Criar promoção'}
        submitPendingLabel="Salvando..."
        isSubmitting={
          create.isPending || update.isPending || form.formState.isSubmitting
        }
      >
        <FormInputComponent
          control={form.control}
          name="name"
          label="Nome"
          placeholder="Ex: Volta aí"
          maxLength={60}
        />

        <FormInputComponent
          control={form.control}
          name="description"
          label="Descrição"
          placeholder="Para que serve esta promoção"
          maxLength={200}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormSelectComponent
            control={form.control}
            name="discountType"
            label="Tipo de desconto"
            placeholder="Selecione"
            options={[
              { value: EDiscountType.PERCENTAGE, textValue: 'Percentual (%)' },
              { value: EDiscountType.FIXED, textValue: 'Valor fixo (R$)' },
            ]}
          />

          <FormInputComponent
            control={form.control}
            name="discountValue"
            label={
              discountType === EDiscountType.PERCENTAGE
                ? 'Desconto (%)'
                : 'Desconto (R$)'
            }
            tooltip="Percentual incide sobre o valor da parcela. Valor fixo nunca passa do valor dela."
            type="number"
            placeholder="0"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormInputComponent
            control={form.control}
            name="startsAt"
            label="Início"
            tooltip="Deixe em branco para valer desde já."
            mask={maskDate}
            placeholder="DD/MM/AAAA"
            maxLength={10}
          />

          <FormInputComponent
            control={form.control}
            name="endsAt"
            label="Fim"
            tooltip="Deixe em branco para não expirar."
            mask={maskDate}
            placeholder="DD/MM/AAAA"
            maxLength={10}
          />
        </div>

        <FormSwitchComponent
          control={form.control}
          name="isActive"
          title="Promoção ativa"
          bottomDescription="Promoções inativas não aparecem no registro de pagamento."
        />
      </FormModal>
    </Form>
  );
}
