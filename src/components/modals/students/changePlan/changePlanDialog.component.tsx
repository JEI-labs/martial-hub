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

interface ChangePlanDialogProps {
  studentId: string;
  studentName: string;
  /** Plano em vigor, para não oferecer a troca por ele mesmo. */
  currentPlanId?: string | null;
  currentPlanName?: string | null;
  open: boolean;
  onOpenChange: (_open: boolean) => void;
  onChanged?: () => void;
}

/**
 * Troca de plano do aluno. Vale de hoje: a matrícula atual encerra e a nova
 * começa no plano escolhido. O texto de prévia existe porque a troca mexe em
 * parcela e em dinheiro — quem clica precisa saber o que vai acontecer antes
 * de confirmar, não depois.
 */
export function ChangePlanDialog({
  studentId,
  studentName,
  currentPlanId,
  currentPlanName,
  open,
  onOpenChange,
  onChanged,
}: ChangePlanDialogProps) {
  const { toast } = useToast();
  const utils = api.useUtils();
  const [planId, setPlanId] = useState('');

  const { data: plansData, isLoading } = api.plans.getAll.useQuery(
    { page: 1, limit: 100 },
    { enabled: open },
  );

  useResetOnChange([studentId, open], () => setPlanId(''));

  /* Sem matrícula em vigor o diálogo é de matrícula, não de troca — mesma
     mecânica, outro texto. */
  const isEnrolling = !currentPlanId;

  const options = (plansData?.data ?? []).filter(
    (plan) => plan.id !== currentPlanId,
  );
  const selected = options.find((plan) => plan.id === planId);

  const amounts = selected
    ? splitIntoInstallments(
        Number(selected.price),
        installmentCount(selected.duration, selected.billing),
      )
    : [];

  const changePlan = api.student.changePlan.useMutation({
    onSuccess: (result) => {
      toast({
        title: 'Plano alterado',
        description:
          result.cancelled > 0
            ? `${result.cancelled} parcela(s) ainda não vencida(s) do plano anterior foram canceladas.`
            : 'A nova matrícula já está valendo.',
      });

      utils.student.invalidate();
      utils.payment.invalidate();
      utils.finance.invalidate();
      utils.dashboard.invalidate();
      onChanged?.();
      onOpenChange(false);
    },
    onError: (error) =>
      toast({
        title: 'Não deu para trocar o plano',
        description: error.message,
        variant: 'destructive',
      }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEnrolling ? 'Matricular aluno' : 'Trocar plano'}
          </DialogTitle>
          <DialogDescription>
            {studentName}
            {isEnrolling
              ? ' · sem matrícula em vigor'
              : currentPlanName
                ? ` · hoje no plano ${currentPlanName}`
                : ''}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Novo plano</Label>
              <Select value={planId} onValueChange={setPlanId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha o plano" />
                </SelectTrigger>
                <SelectContent>
                  {options.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} · {maskBRL(Number(plan.price), true)} ·{' '}
                      {plan.duration} {plan.duration === 1 ? 'mês' : 'meses'} ·{' '}
                      {PLAN_BILLING_LABEL[plan.billing]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* O que a confirmação faz, em português, antes de fazer. */}
            {selected && (
              <ul className="bg-muted/60 text-muted-foreground space-y-1 rounded-xl px-4 py-3 text-sm">
                {isEnrolling ? (
                  <li>A matrícula no {selected.name} começa hoje.</li>
                ) : (
                  <>
                    <li>
                      A matrícula{' '}
                      {currentPlanName ? `de ${currentPlanName} ` : ''}
                      encerra hoje e a do {selected.name} começa.
                    </li>
                    <li>
                      Parcelas ainda não vencidas do plano anterior são
                      canceladas; as atrasadas continuam a ser cobradas.
                    </li>
                  </>
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
            disabled={!selected || changePlan.isPending}
            onClick={() =>
              selected && changePlan.mutate({ studentId, planId: selected.id })
            }
          >
            {changePlan.isPending && (
              <Loader2 className="mr-2 size-4 animate-spin" />
            )}
            {isEnrolling ? 'Matricular' : 'Trocar plano'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
