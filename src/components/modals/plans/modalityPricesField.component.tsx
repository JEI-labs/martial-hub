'use client';

import {
  useWatch,
  type Control,
  type FieldValues,
  type Path,
  type PathValue,
  type UseFormSetValue,
} from 'react-hook-form';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { IModalityPriceInput } from '@/server/validations/plans';
import { api } from '@/trpc/react';
import { maskDecimalWithAcronym, unmaskDecimal } from '@/utils/masksUtils';

interface ModalityPricesFieldProps<T extends FieldValues> {
  control: Control<T>;
  setValue: UseFormSetValue<T>;
  open: boolean;
}

/**
 * O valor do plano em cada modalidade. Em branco, a modalidade usa o preço
 * padrão do plano — o campo de cima.
 *
 * O que aparece na tela é o `modalityPrices` do formulário, e só ele: não há
 * cópia à parte que possa mostrar um valor que não vai ser enviado. Na
 * edição, o formulário já chega com os valores do plano (o reset do sheet os
 * inclui), e o servidor só mexe nas modalidades que vierem na lista.
 *
 * Aparece com duas modalidades ativas ou mais — com uma, o preço padrão já é
 * o dela — e também sempre que o plano tiver algum valor por modalidade, para
 * que ele possa ser visto e limpo. Modalidade desativada com valor aparece
 * marcada: o valor dela continua valendo na troca de plano de quem já a faz.
 */
export function ModalityPricesField<T extends FieldValues>({
  control,
  setValue,
  open,
}: ModalityPricesFieldProps<T>) {
  const { data: modalidades } = api.modalities.list.useQuery(undefined, {
    enabled: open,
  });

  const lista: Array<IModalityPriceInput> =
    (useWatch({ control, name: 'modalityPrices' as Path<T> }) as
      Array<IModalityPriceInput> | undefined) ?? [];
  const valorDe = (modalityId: string) =>
    lista.find((item) => item.modalityId === modalityId)?.price ?? '';

  const comValor = (id: string) => {
    const valor = valorDe(id);
    return valor !== '' && valor !== '0';
  };
  const visiveis = (modalidades ?? []).filter(
    (m) => m.isActive || comValor(m.id),
  );
  const algumValor = visiveis.some((m) => comValor(m.id));
  const ativas = visiveis.filter((m) => m.isActive);

  if (ativas.length < 2 && !algumValor) return null;

  const mudar = (modalityId: string, centavos: string) => {
    const price = centavos === '0' ? '' : centavos;
    const proxima = lista.some((item) => item.modalityId === modalityId)
      ? lista.map((item) =>
          item.modalityId === modalityId ? { ...item, price } : item,
        )
      : [...lista, { modalityId, price }];

    setValue('modalityPrices' as Path<T>, proxima as PathValue<T, Path<T>>, {
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
        {visiveis.map((modalidade) => {
          const id = `preco-${modalidade.id}`;
          const valor = valorDe(modalidade.id);

          return (
            <div key={modalidade.id} className="space-y-2">
              <Label htmlFor={id}>
                {modalidade.name}
                {!modalidade.isActive && (
                  <span className="text-muted-foreground font-normal">
                    {' '}
                    (desativada)
                  </span>
                )}
              </Label>
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
