// components/modals/expenses/editExpenses.component.tsx
import { FormModal } from '@/components/formModal/formModal.component';
import React, { useEffect } from 'react';
import { Form } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormInputComponent } from '@/components/forms/formInput/formInput.component';
import { FormSelectComponent } from '@/components/forms/formSelectInput/formSelectInput.component';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/trpc/react';
import {
  createFinanceEntrySchema,
  ICreateFinanceEntry,
  ICreateFinanceEntryInput,
} from '@/server/validations/finance';
import {
  maskDate,
  maskDecimalWithAcronym,
  unmaskDecimal,
} from '@/utils/masksUtils';
import { format } from 'date-fns';
import {
  EFinanceEntryStatus,
  EFinanceEntryType,
  EPaymentMethod,
} from '@prisma/client';
import { IEditExpenses } from './editExpenses.types';

export const SheetEditExpenseEntry: React.FC<IEditExpenses> = ({
  isOpen,
  setIsOpen,
  entry,
  refetch,
}) => {
  const { toast } = useToast();
  const updateEntry = api.finance.update.useMutation();
  const { data: categoriesQuery } = api.category.getAll.useQuery({
    page: 1,
    limit: 100,
  });

  const categories = categoriesQuery?.data ?? [];

  const form = useForm<ICreateFinanceEntryInput, unknown, ICreateFinanceEntry>({
    resolver: zodResolver(createFinanceEntrySchema),
    defaultValues: {
      date: format(new Date(entry.date), 'dd/MM/yyyy'),
      amount: entry.amount.toString(),
      category: entry.category,
      status: entry.status,
      type: EFinanceEntryType.EXPENSE,
      paymentMethod: entry.paymentMethod ?? undefined,
      referenceId: entry.referenceId ?? '',
      description: entry.description ?? '',
      currency: entry.currency ?? 'BRL',
    },
    mode: 'onChange',
  });

  useEffect(() => {
    form.reset({
      date: format(new Date(entry.date), 'dd/MM/yyyy'),
      amount: entry.amount.toString(),
      category: entry.category,
      status: entry.status,
      type: 'EXPENSE',
      paymentMethod: entry.paymentMethod ?? undefined,
      referenceId: entry.referenceId ?? '',
      description: entry.description ?? '',
      currency: entry.currency ?? 'BRL',
    });
  }, [entry, form]);

  const onSubmit = async (values: ICreateFinanceEntry) => {
    try {
      await updateEntry.mutateAsync({ id: entry.id, ...values });
      toast({ title: 'Sucesso', description: 'Despesa atualizada!' });
      setIsOpen(false);
      form.reset();
      refetch?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao atualizar';
      toast({ title: 'Erro', description: msg, variant: 'destructive' });
    }
  };

  return (
    <Form {...form}>
      <FormModal
        open={isOpen}
        onOpenChange={setIsOpen}
        title="Editar despesa"
        description="Altere os dados da despesa"
        onSubmit={form.handleSubmit(onSubmit)}
        submitLabel="Salvar alterações"
        submitPendingLabel="Salvando..."
        isSubmitting={updateEntry.isPending || form.formState.isSubmitting}
      >
        <div className="grid grid-cols-2 gap-4">
          <FormInputComponent
            control={form.control}
            name="date"
            label="Data"
            type="text"
            mask={maskDate}
            placeholder="DD/MM/AAAA"
          />
          <FormInputComponent
            control={form.control}
            name="amount"
            label="Valor (R$)"
            type="text"
            mask={maskDecimalWithAcronym}
            unmask={unmaskDecimal}
            placeholder="R$ 0,00"
            maxLength={10}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormSelectComponent
            control={form.control}
            name="status"
            label="Status"
            tooltip="Pago já saiu/entrou no caixa. Pendente ainda vai acontecer. Cancelado não conta no total."
            placeholder="Selecione"
            options={[
              { value: EFinanceEntryStatus.PAID, textValue: 'Pago' },
              { value: EFinanceEntryStatus.PENDING, textValue: 'Pendente' },
              {
                value: EFinanceEntryStatus.CANCELLED,
                textValue: 'Cancelado',
              },
            ]}
          />
          <FormSelectComponent
            control={form.control}
            name="paymentMethod"
            label="Forma de Pagamento"
            tooltip="Como o valor foi ou será pago. Usado nos relatórios financeiros."
            placeholder="Selecione"
            options={[
              { value: EPaymentMethod.CASH, textValue: 'Dinheiro' },
              { value: EPaymentMethod.PIX, textValue: 'Pix' },
              {
                value: EPaymentMethod.CREDIT_CARD,
                textValue: 'Cartão de Crédito',
              },
              { value: EPaymentMethod.BOLETO, textValue: 'Boleto' },
              {
                value: EPaymentMethod.DEBIT_CARD,
                textValue: 'Cartão de Débito',
              },
            ]}
          />
        </div>

        <FormSelectComponent
          control={form.control}
          name="category"
          label="Categoria"
          tooltip="Agrupa o lançamento nos relatórios. Cadastre em Cadastros › Categorias."
          placeholder="Selecione"
          options={
            categories.map((category) => ({
              value: category.id,
              textValue: category.name,
            })) ?? []
          }
        />

        <FormInputComponent
          control={form.control}
          name="referenceId"
          label="Referência"
          tooltip="Número de nota fiscal, recibo ou contrato para localizar o lançamento depois."
          type="text"
          placeholder="Ex: NF12345"
          mask={(v) => v.toUpperCase()}
          maxLength={20}
        />

        <FormInputComponent
          control={form.control}
          name="description"
          label="Descrição"
          type="text"
          placeholder="Observações"
          maxLength={200}
        />
      </FormModal>
    </Form>
  );
};
