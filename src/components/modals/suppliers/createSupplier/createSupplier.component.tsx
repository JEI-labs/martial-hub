'use client';

import { FormModal } from '@/components/formModal/formModal.component';
import React, { useState, useEffect, useMemo } from 'react';
import { Form } from '@/components/ui/form';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/trpc/react';
import {
  createSupplierSchema,
  ICreateSupplier,
} from '@/server/validations/suppliers';
import { FormInputComponent } from '@/components/forms/formInput/formInput.component';
import { FormSelectComponent } from '@/components/forms/formSelectInput/formSelectInput.component';
import { ICreateSheetSupplier } from './createSupplier.types';
import { maskCellphone, unmaskCellphone } from '@/utils/masksUtils';
import { fetchStates, fetchCities, IBGEState } from '@/utils/api/ibge';

export const SheetCreateSupplier: React.FC<ICreateSheetSupplier> = ({
  isOpen,
  setIsOpen,
  refetch,
}) => {
  const { toast } = useToast();
  const createSupplier = api.supplier.create.useMutation();

  const form = useForm<ICreateSupplier>({
    resolver: zodResolver(createSupplierSchema),
    defaultValues: {
      name: '',
      phone: '',
      street: '',
      city: '',
      state: '',
    },
  });

  // cache em memória: estado.sigla → opções de cidades. Fica em state (e não
  // num ref) para que `citiesOptions` e `loadingCities` possam ser derivados.
  const [citiesCache, setCitiesCache] = useState<
    Record<string, Array<{ value: string; textValue: string }>>
  >({});
  const [statesLoaded, setStatesLoaded] = useState(false);

  const [rawStates, setRawStates] = useState<Array<IBGEState>>([]);
  const selectedState = useWatch({ control: form.control, name: 'state' });

  // Derivados em vez de guardados, para nenhum efeito precisar ligar uma flag
  // de forma síncrona (o que dispara render em cascata).
  const loadingStates = !statesLoaded;
  const citiesOptions = selectedState ? (citiesCache[selectedState] ?? []) : [];
  // ternário em vez de `Boolean(...) &&`, que não estreita o tipo
  const loadingCities = selectedState ? !(selectedState in citiesCache) : false;

  useEffect(() => {
    let cancelled = false;

    fetchStates()
      .then((data) => {
        if (!cancelled) setRawStates(data);
      })
      .catch(() => {
        if (!cancelled)
          toast({ title: 'Erro ao carregar estados', variant: 'destructive' });
      })
      .finally(() => {
        if (!cancelled) setStatesLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [toast]);

  const statesOptions = useMemo(
    () =>
      rawStates.map((st) => ({
        value: st.sigla,
        textValue: st.nome,
      })),
    [rawStates],
  );

  // limpa a cidade sempre que o estado muda
  useEffect(() => {
    form.setValue('city', '');
  }, [selectedState, form]);

  useEffect(() => {
    // já cacheado (ou nada a buscar): `citiesOptions` já reflete isso
    if (!selectedState || selectedState in citiesCache) return;

    let cancelled = false;

    fetchCities(selectedState)
      .then((data) => {
        if (cancelled) return;
        const opts = data.map((ct) => ({
          value: ct.nome,
          textValue: ct.nome,
        }));
        setCitiesCache((prev) => ({ ...prev, [selectedState]: opts }));
      })
      .catch(() => {
        if (cancelled) return;
        toast({ title: 'Erro ao carregar cidades', variant: 'destructive' });
        // grava vazio para não deixar o select preso em "carregando"
        setCitiesCache((prev) => ({ ...prev, [selectedState]: [] }));
      });

    return () => {
      cancelled = true;
    };
  }, [selectedState, citiesCache, toast]);

  const onSubmit = async (vals: ICreateSupplier) => {
    try {
      await createSupplier.mutateAsync(vals);
      toast({ title: 'Sucesso', description: 'Fornecedor criado' });
      form.reset();
      setIsOpen(false);
      refetch();
    } catch (err) {
      toast({
        title: 'Erro',
        variant: 'destructive',
        description:
          err instanceof Error ? err.message : 'Erro ao criar fornecedor',
      });
    }
  };

  return (
    <Form {...form}>
      <FormModal
        open={isOpen}
        onOpenChange={setIsOpen}
        title="Novo fornecedor"
        description="Preencha os dados do fornecedor"
        onSubmit={form.handleSubmit(onSubmit)}
        submitLabel="Salvar"
        submitPendingLabel="Salvando..."
        isSubmitting={form.formState.isSubmitting}
      >
        <FormInputComponent
          control={form.control}
          name="name"
          label="Nome"
          placeholder="Nome do fornecedor"
        />
        <FormInputComponent
          control={form.control}
          name="phone"
          label="Telefone"
          placeholder="(xx) xxxxx-xxxx"
          mask={maskCellphone}
          unmask={unmaskCellphone}
          maxLength={15}
        />
        <FormInputComponent
          control={form.control}
          name="street"
          label="Rua"
          placeholder="Rua do fornecedor"
          maxLength={100}
        />

        <FormSelectComponent
          control={form.control}
          name="state"
          label="Estado"
          placeholder={
            loadingStates ? 'Carregando estados...' : 'Selecione o estado'
          }
          options={statesOptions}
          disabled={loadingStates}
        />

        <FormSelectComponent
          control={form.control}
          name="city"
          label="Cidade"
          placeholder={
            !selectedState
              ? 'Selecione um estado primeiro'
              : loadingCities
                ? 'Carregando cidades...'
                : 'Selecione a cidade'
          }
          options={citiesOptions}
          disabled={!selectedState || loadingCities}
        />
      </FormModal>
    </Form>
  );
};
