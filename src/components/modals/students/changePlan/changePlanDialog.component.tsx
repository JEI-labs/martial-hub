'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { PLAN_BILLING_LABEL } from '@/common/constants/planBilling';
import { useResetOnChange } from '@/hooks/useResetOnChange/useResetOnChange.hook';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/trpc/react';
import { maskBRL } from '@/utils/masksUtils';
import { installmentCount, splitIntoInstallments } from '@/utils/planUtils';
import {
  comDesconto,
  descontosDasMatriculas,
  precoNaModalidade,
} from '@/common/utils/pricing';

/** A matrícula cujo plano vai trocar. */
export interface EnrollmentToChange {
  id: string;
  planId: string;
  planName: string;
  modality: { id: string; name: string };
  /** Se a matrícula é a que tem desconto de 2ª modalidade. */
  discountPercent: number;
}

interface ChangePlanDialogProps {
  studentId: string;
  studentName: string;
  /**
   * Com matrícula, troca o plano dela. Sem, matricula o aluno numa
   * modalidade que ele ainda não faz.
   */
  enrollment?: EnrollmentToChange | null;
  /** Modalidades em que o aluno já está matriculado: não são oferecidas. */
  enrolledModalityIds?: Array<string>;
  open: boolean;
  onOpenChange: (_open: boolean) => void;
  onChanged?: () => void;
}

/**
 * Troca de plano de uma matrícula, ou matrícula numa modalidade nova. Vale de
 * hoje: na troca, a matrícula daquela modalidade encerra e a nova começa no
 * plano escolhido; as outras modalidades do aluno não mudam. O texto de
 * prévia existe porque isso mexe em parcela e em dinheiro — quem clica
 * precisa saber o que vai acontecer antes de confirmar, não depois.
 */
export function ChangePlanDialog({
  studentId,
  studentName,
  enrollment,
  enrolledModalityIds = [],
  open,
  onOpenChange,
  onChanged,
}: ChangePlanDialogProps) {
  const { toast } = useToast();
  const utils = api.useUtils();
  const [planId, setPlanId] = useState('');
  const [modalityId, setModalityId] = useState('');

  const { data: plansData, isLoading } = api.plans.getAll.useQuery(
    { page: 1, limit: 100 },
    { enabled: open },
  );

  /* Sem matrícula o diálogo é de matrícula, não de troca — mesma mecânica,
     mais a escolha da modalidade. */
  const isEnrolling = !enrollment;
  const currentPlanId = enrollment?.planId ?? null;
  const currentPlanName = enrollment?.planName ?? null;

  const { data: modalidades } = api.modalities.list.useQuery(undefined, {
    enabled: open && isEnrolling,
  });
  const modalidadesLivres = (modalidades ?? []).filter(
    (m) => m.isActive && !enrolledModalityIds.includes(m.id),
  );
  const modalidadeEscolhida = isEnrolling
    ? modalidadesLivres.find((m) => m.id === modalityId)
    : null;

  useResetOnChange([studentId, enrollment?.id, open], () => {
    setPlanId('');
    setModalityId('');
  });

  /* Uma modalidade só para escolher já vem escolhida. */
  const unicaLivre =
    modalidadesLivres.length === 1 ? modalidadesLivres[0]?.id : undefined;
  if (isEnrolling && unicaLivre && !modalityId) setModalityId(unicaLivre);

  const options = (plansData?.data ?? []).filter(
    (plan) => plan.id !== currentPlanId,
  );
  const selected = options.find((plan) => plan.id === planId);

  const { data: pricing } = api.plans.getPricingSettings.useQuery(undefined, {
    enabled: open,
  });
  const descontoDaAcademia = pricing?.multiModalityDiscount ?? 0;

  /* A mesma conta do servidor. Na troca, a matrícula mantém o desconto se
     já tinha; matrícula nova ganha desconto se o aluno já faz outra. */
  const modalidadeDoPreco = enrollment?.modality.id ?? modalidadeEscolhida?.id;
  const precoCheio =
    selected && modalidadeDoPreco
      ? precoNaModalidade(selected, modalidadeDoPreco)
      : Number(selected?.price ?? 0);
  const percent = enrollment
    ? enrollment.discountPercent > 0
      ? descontoDaAcademia
      : 0
    : (descontosDasMatriculas(
        [precoCheio],
        enrolledModalityIds.length,
        descontoDaAcademia,
      )[0] ?? 0);
  const valor = comDesconto(precoCheio, percent);

  const amounts = selected
    ? splitIntoInstallments(
        valor,
        installmentCount(selected.duration, selected.billing),
      )
    : [];

  const depois = () => {
    utils.student.invalidate();
    utils.payment.invalidate();
    utils.finance.invalidate();
    utils.dashboard.invalidate();
    onChanged?.();
    onOpenChange(false);
  };

  const changePlan = api.student.changePlan.useMutation({
    onSuccess: (result) => {
      toast({
        title: 'Plano alterado',
        description:
          result.cancelled > 0
            ? `${result.cancelled} parcela(s) ainda não vencida(s) do plano anterior foram canceladas.`
            : 'A nova matrícula já está valendo.',
      });
      depois();
    },
    onError: (error) =>
      toast({
        title: 'Não deu para trocar o plano',
        description: error.message,
        variant: 'destructive',
      }),
  });

  const addEnrollment = api.student.addEnrollment.useMutation({
    onSuccess: () => {
      toast({
        title: 'Aluno matriculado',
        description: modalidadeEscolhida
          ? `A matrícula em ${modalidadeEscolhida.name} já está valendo.`
          : 'A matrícula já está valendo.',
      });
      depois();
    },
    onError: (error) =>
      toast({
        title: 'Não deu para matricular',
        description: error.message,
        variant: 'destructive',
      }),
  });

  const pending = changePlan.isPending || addEnrollment.isPending;
  const podeConfirmar =
    Boolean(selected) && (!isEnrolling || Boolean(modalidadeEscolhida));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEnrolling
              ? 'Matricular em uma modalidade'
              : `Trocar plano de ${enrollment.modality.name}`}
          </DialogTitle>
          <DialogDescription>
            {studentName}
            {isEnrolling
              ? enrolledModalityIds.length > 0
                ? ' · as matrículas que ele já tem continuam como estão'
                : ' · sem matrícula em vigor'
              : ` · hoje no plano ${currentPlanName}`}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <div className="flex flex-col gap-4">
            {isEnrolling && (
              <div className="space-y-2">
                <Label className="text-xs">Modalidade</Label>
                {modalidadesLivres.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    {modalidades && modalidades.length === 0
                      ? 'A academia ainda não cadastrou modalidades. Cadastre em Cadastros → Modalidades.'
                      : 'O aluno já está matriculado em todas as modalidades ativas.'}
                  </p>
                ) : (
                  <Select value={modalityId} onValueChange={setModalityId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha a modalidade" />
                    </SelectTrigger>
                    <SelectContent>
                      {modalidadesLivres.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs">
                {isEnrolling ? 'Plano' : 'Novo plano'}
              </Label>
              <Select value={planId} onValueChange={setPlanId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha o plano" />
                </SelectTrigger>
                <SelectContent>
                  {options.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} ·{' '}
                      {maskBRL(
                        modalidadeDoPreco
                          ? precoNaModalidade(plan, modalidadeDoPreco)
                          : Number(plan.price),
                        true,
                      )}{' '}
                      · {plan.duration} {plan.duration === 1 ? 'mês' : 'meses'}{' '}
                      · {PLAN_BILLING_LABEL[plan.billing]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* O que a confirmação faz, em português, antes de fazer. */}
            {selected && (
              <ul className="bg-muted/60 text-muted-foreground space-y-1 rounded-xl px-4 py-3 text-sm">
                {isEnrolling ? (
                  <li>
                    A matrícula
                    {modalidadeEscolhida
                      ? ` em ${modalidadeEscolhida.name}`
                      : ''}{' '}
                    no {selected.name} começa hoje.
                  </li>
                ) : (
                  <>
                    <li>
                      A matrícula de {enrollment.modality.name} no{' '}
                      {currentPlanName} encerra hoje e a do {selected.name}{' '}
                      começa.
                    </li>
                    <li>
                      Parcelas ainda não vencidas do plano anterior são
                      canceladas; as atrasadas continuam a ser cobradas. As
                      outras modalidades do aluno não mudam.
                    </li>
                  </>
                )}
                {percent > 0 && (
                  <li>
                    {percent}% de desconto de 2ª modalidade:{' '}
                    {maskBRL(valor, true)} em vez de {maskBRL(precoCheio, true)}
                    .
                  </li>
                )}
                <li>
                  {amounts.length === 1
                    ? `Gera 1 parcela de ${maskBRL((amounts[0] ?? 0) / 100, true)}, já paga.`
                    : `Gera ${amounts.length} parcelas de ${maskBRL((amounts[0] ?? 0) / 100, true)}, a primeira já paga.`}
                </li>
              </ul>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!podeConfirmar || pending}
            onClick={() => {
              if (!selected) return;
              if (enrollment) {
                changePlan.mutate({
                  enrollmentId: enrollment.id,
                  planId: selected.id,
                });
              } else if (modalidadeEscolhida) {
                addEnrollment.mutate({
                  studentId,
                  modalityId: modalidadeEscolhida.id,
                  planId: selected.id,
                });
              }
            }}
          >
            {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {isEnrolling ? 'Matricular' : 'Trocar plano'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
