'use client';

import { useState } from 'react';
import type {
  FieldValues,
  Path,
  PathValue,
  UseFormSetValue,
} from 'react-hook-form';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useResetOnChange } from '@/hooks/useResetOnChange/useResetOnChange.hook';
import type { IModalityPriceInput } from '@/server/validations/plans';
import { api } from '@/trpc/react';
import { maskDecimalWithAcronym, unmaskDecimal } from '@/utils/masksUtils';

interface ModalityPricesFieldProps<T extends FieldValues> {
  setValue: UseFormSetValue<T>;
  open: boolean;
  /** Os valores que o plano já tem, em reais. Vazio para plano novo. */
  existentes?: Array<{ modalityId: string; price: number }>;
}

const emCentavos = (reais: number) => String(Math.round(reais * 100));

/**
 * O valor do plano em cada modalidade. Em branco, a modalidade usa o preço
 * padrão do plano — o campo de cima. Só aparece com duas modalidades ou
 * mais: com uma, o preço padrão já é o dela.
 *
 * Guarda o que está na tela por conta própria e só escreve no formulário
 * quando alguém muda um valor. Assim, salvar sem mexer aqui não reescreve os
 * valores do plano, e o reset que o formulário de edição faz ao carregar não
 * apaga o que este campo mostra.
 */
export function ModalityPricesField<T extends FieldValues>({
  setValue,
  open,
  existentes,
}: ModalityPricesFieldProps<T>) {
  const { data: modalidades } = api.modalities.list.useQuery(undefined, {
    enabled: open,
  });
  const ativas = (modalidades ?? []).filter((m) => m.isActive);

  /* Centavos em texto, como o preço padrão do formulário; vazio é "usa o
     padrão". */
  const inicial = () =>
    Object.fromEntries(
      (existentes ?? []).map((e) => [e.modalityId, emCentavos(e.price)]),
    );
  const [valores, setValores] = useState<Record<string, string>>(inicial);
  useResetOnChange([open, JSON.stringify(existentes ?? [])], () =>
    setValores(inicial()),
  );

  if (ativas.length < 2) return null;

  const mudar = (modalityId: string, centavos: string) => {
    const proximos = {
      ...valores,
      [modalityId]: centavos === '0' ? '' : centavos,
    };
    setValores(proximos);

    const lista: Array<IModalityPriceInput> = ativas.map((m) => ({
      modalityId: m.id,
      price: proximos[m.id] ?? '',
    }));
    setValue('modalityPrices' as Path<T>, lista as PathValue<T, Path<T>>, {
      shouldDirty: true,
    });
  };

  return (
    <div className="space-y-3 rounded-xl border p-4">
      <div>
        <p className="text-sm font-medium">Valor por modalidade</p>
        <p className="text-muted-foreground text-xs">
          Em branco, a modalidade usa o preço do período acima. O valor é do
          período inteiro, como o preço padrão.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {ativas.map((modalidade) => {
          const id = `preco-${modalidade.id}`;
          const valor = valores[modalidade.id] ?? '';

          return (
            <div key={modalidade.id} className="space-y-2">
              <Label htmlFor={id}>{modalidade.name}</Label>
              <Input
                id={id}
                inputMode="numeric"
                placeholder="Preço padrão"
                value={valor ? maskDecimalWithAcronym(valor) : ''}
                onChange={(event) =>
                  mudar(
                    modalidade.id,
                    String(unmaskDecimal(event.target.value)),
                  )
                }
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
