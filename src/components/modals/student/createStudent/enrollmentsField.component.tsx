'use client';

import { useEffect } from 'react';
import { useWatch, type Control, type UseFormSetValue } from 'react-hook-form';

import { PLAN_BILLING_LABEL } from '@/common/constants/planBilling';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type {
  IEnrollmentRequest,
  IStudentCreateTypes,
} from '@/server/validations/students';
import { PlanOptionLabel } from '@/components/plans/planOptionLabel.component';
import { Skeleton } from '@/components/ui/skeleton';

type Modalidade = { id: string; name: string };
type Plano = {
  id: string;
  name: string;
  price: number;
  duration: number;
  billing: keyof typeof PLAN_BILLING_LABEL;
};

interface EnrollmentsFieldProps {
  control: Control<IStudentCreateTypes>;
  setValue: UseFormSetValue<IStudentCreateTypes>;
  modalidades: Array<Modalidade>;
  /** As modalidades ainda não chegaram: lista vazia não quer dizer nada. */
  carregando?: boolean;
  /** A consulta das modalidades falhou; `tentarDeNovo` refaz. */
  erro?: boolean;
  tentarDeNovo?: () => void;
  planos: Array<Plano>;
  defaultPlanId?: string;
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
  carregando = false,
  erro = false,
  tentarDeNovo,
  planos,
  defaultPlanId,
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

  /* "A academia não tem modalidades" só depois de saber: enquanto carrega,
     ou se a consulta falhou, a lista vazia não diz isso. */
  if (carregando) return <Skeleton className="h-24 w-full rounded-xl" />;

  if (erro) {
    return (
      <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed p-4 text-sm">
        <span>Não deu para carregar as modalidades da academia.</span>
        {tentarDeNovo && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={tentarDeNovo}
          >
            Tentar de novo
          </Button>
        )}
      </div>
    );
  }

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
                        <PlanOptionLabel plan={plano} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-muted-foreground text-xs">
        Cada modalidade marcada vira uma matrícula, com o plano e as parcelas
        dela.
      </p>
      {error && <p className="text-destructive-text text-sm">{error}</p>}
    </div>
  );
}
