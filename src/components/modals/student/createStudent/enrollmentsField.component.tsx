'use client';

import { useEffect } from 'react';
import { useWatch, type Control, type UseFormSetValue } from 'react-hook-form';

import { PLAN_BILLING_LABEL } from '@/common/constants/planBilling';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  comDesconto,
  descontosDasMatriculas,
  precoNaModalidade,
  type ModalityPrice,
} from '@/common/utils/pricing';
import type {
  IEnrollmentRequest,
  IStudentCreateTypes,
} from '@/server/validations/students';
import { maskBRL } from '@/utils/masksUtils';

type Modalidade = { id: string; name: string };
type Plano = {
  id: string;
  name: string;
  price: number;
  duration: number;
  billing: keyof typeof PLAN_BILLING_LABEL;
  modalityPrices?: Array<ModalityPrice>;
};

interface EnrollmentsFieldProps {
  control: Control<IStudentCreateTypes>;
  setValue: UseFormSetValue<IStudentCreateTypes>;
  modalidades: Array<Modalidade>;
  planos: Array<Plano>;
  defaultPlanId?: string;
  /** Desconto da academia da 2ª modalidade em diante, em %. */
  desconto: number;
  open: boolean;
  error?: string;
}

/**
 * As matrículas do aluno novo: uma linha por modalidade ativa, que se marca
 * e ganha o seu plano. Cada modalidade marcada vira uma matrícula, com as
 * suas parcelas — quem faz duas paga as duas.
 */
export function EnrollmentsField({
  control,
  setValue,
  modalidades,
  planos,
  defaultPlanId,
  desconto,
  open,
  error,
}: EnrollmentsFieldProps) {
  const escolhidas: Array<IEnrollmentRequest> =
    useWatch({ control, name: 'enrollments' }) ?? [];

  const gravar = (lista: Array<IEnrollmentRequest>) =>
    setValue('enrollments', lista, {
      shouldValidate: true,
      shouldDirty: true,
    });

  /* Academia de uma modalidade só (o caso de hoje) não precisa de escolha:
     ela já vem marcada, com o plano padrão. O formulário volta limpo a cada
     abertura, daí depender de `open`. */
  const unica = modalidades.length === 1 ? modalidades[0] : undefined;
  useEffect(() => {
    if (open && unica && escolhidas.length === 0) {
      gravar([{ modalityId: unica.id, planId: defaultPlanId ?? '' }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, unica?.id, defaultPlanId]);

  /* O plano padrão chega depois: preenche quem ficou sem plano. */
  useEffect(() => {
    if (!defaultPlanId || !escolhidas.some((e) => !e.planId)) return;
    gravar(
      escolhidas.map((e) => (e.planId ? e : { ...e, planId: defaultPlanId })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultPlanId]);

  if (modalidades.length === 0) {
    return (
      <p className="text-muted-foreground rounded-xl border border-dashed p-4 text-sm">
        A academia ainda não cadastrou modalidades. Cadastre em Cadastros →
        Modalidades para poder matricular alunos.
      </p>
    );
  }

  const alternar = (modalityId: string, marcada: boolean) =>
    gravar(
      marcada
        ? /* Na ordem das modalidades, não na ordem dos cliques. */
          modalidades
            .map((m) => m.id)
            .filter(
              (id) =>
                id === modalityId ||
                escolhidas.some((e) => e.modalityId === id),
            )
            .map(
              (id) =>
                escolhidas.find((e) => e.modalityId === id) ?? {
                  modalityId: id,
                  planId: defaultPlanId ?? '',
                },
            )
        : escolhidas.filter((e) => e.modalityId !== modalityId),
    );

  /* A mesma conta do servidor: cheio na mais cara, desconto nas outras. */
  const cheios = escolhidas.map((e) => {
    const plano = planos.find((p) => p.id === e.planId);
    return plano ? precoNaModalidade(plano, e.modalityId) : 0;
  });
  const descontos = descontosDasMatriculas(cheios, 0, desconto);
  const valorDe = (modalityId: string) => {
    const index = escolhidas.findIndex((e) => e.modalityId === modalityId);
    const plano = planos.find((p) => p.id === escolhidas[index]?.planId);
    if (index < 0 || !plano) return null;
    const percent = descontos[index] ?? 0;
    return {
      valor: comDesconto(cheios[index] ?? 0, percent),
      percent,
      duration: plano.duration,
    };
  };

  const trocarPlano = (modalityId: string, planId: string) =>
    gravar(
      escolhidas.map((e) =>
        e.modalityId === modalityId ? { ...e, planId } : e,
      ),
    );

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Modalidades e planos</p>

      <div className="divide-border divide-y rounded-xl border">
        {modalidades.map((modalidade) => {
          const escolhida = escolhidas.find(
            (e) => e.modalityId === modalidade.id,
          );
          const inputId = `matricula-${modalidade.id}`;

          return (
            <div
              key={modalidade.id}
              className="flex flex-wrap items-center gap-3 px-3 py-2"
            >
              <Checkbox
                id={inputId}
                checked={Boolean(escolhida)}
                onCheckedChange={(valor) =>
                  alternar(modalidade.id, valor === true)
                }
              />
              <label
                htmlFor={inputId}
                className={cn(
                  'min-w-24 flex-1 text-sm',
                  !escolhida && 'text-muted-foreground',
                )}
              >
                {modalidade.name}
              </label>

              {escolhida && (
                <Select
                  value={escolhida.planId}
                  onValueChange={(planId) => trocarPlano(modalidade.id, planId)}
                >
                  <SelectTrigger
                    className="w-full sm:w-64"
                    aria-label={`Plano de ${modalidade.name}`}
                  >
                    <SelectValue placeholder="Selecione o plano" />
                  </SelectTrigger>
                  <SelectContent>
                    {planos.map((plano) => (
                      <SelectItem key={plano.id} value={plano.id}>
                        {plano.name} ·{' '}
                        {maskBRL(precoNaModalidade(plano, modalidade.id), true)}{' '}
                        · {plano.duration}{' '}
                        {plano.duration === 1 ? 'mês' : 'meses'} ·{' '}
                        {PLAN_BILLING_LABEL[plano.billing]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {(() => {
                const valor = escolhida ? valorDe(modalidade.id) : null;
                if (!valor) return null;
                return (
                  <p className="text-muted-foreground w-full pl-7 text-xs">
                    {maskBRL(valor.valor, true)}
                    {valor.duration > 1
                      ? ` pelos ${valor.duration} meses`
                      : ' por mês'}
                    {valor.percent > 0 &&
                      ` · ${valor.percent}% de desconto de 2ª modalidade`}
                  </p>
                );
              })()}
            </div>
          );
        })}
      </div>

      <p className="text-muted-foreground text-xs">
        Cada modalidade marcada vira uma matrícula, com o plano e as parcelas
        dela.
        {desconto > 0 &&
          ` Da 2ª modalidade em diante, ${desconto}% de desconto — a mais cara paga cheio.`}
      </p>
      {error && <p className="text-destructive-text text-sm">{error}</p>}
    </div>
  );
}
