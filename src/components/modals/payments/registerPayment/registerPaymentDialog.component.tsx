'use client';

import { useMemo, useState } from 'react';
import { differenceInCalendarDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle2, Loader2 } from 'lucide-react';

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
import { EmptyState } from '@/components/emptyState/emptyState.component';
import { useResetOnChange } from '@/hooks/useResetOnChange/useResetOnChange.hook';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { api } from '@/trpc/react';
import { calculateDiscount } from '@/utils/discountUtils';
import { maskBRL } from '@/utils/masksUtils';

interface RegisterPaymentDialogProps {
  studentId: string;
  studentName: string;
  open: boolean;
  onOpenChange: (_open: boolean) => void;
}

const NO_PROMOTION = 'nenhuma';

/** "vence em 3 dias", "venceu há 12 dias" — o que decide a urgência da linha. */
function describeDueDate(dueDate: Date): { text: string; late: boolean } {
  const days = differenceInCalendarDays(dueDate, new Date());

  if (days === 0) return { text: 'vence hoje', late: false };
  if (days > 0)
    return {
      text: `vence em ${days} ${days === 1 ? 'dia' : 'dias'}`,
      late: false,
    };

  const late = Math.abs(days);
  return {
    text: `venceu há ${late} ${late === 1 ? 'dia' : 'dias'}`,
    late: true,
  };
}

/**
 * Baixa de parcela sem sair da lista de alunos. A tela dedicada continua
 * existindo para o histórico; aqui é só o caso do dia a dia: o aluno chegou,
 * pagou a mensalidade, e quem está na recepção precisa registrar isso em dois
 * cliques.
 */
export function RegisterPaymentDialog({
  studentId,
  studentName,
  open,
  onOpenChange,
}: RegisterPaymentDialogProps) {
  const { toast } = useToast();
  const utils = api.useUtils();

  const [selectedDueDate, setSelectedDueDate] = useState<string | null>(null);
  const [promotionId, setPromotionId] = useState<string>(NO_PROMOTION);

  const { data, isLoading } = api.payment.getPaymentsByStudent.useQuery(
    { studentId },
    { enabled: open },
  );

  const { data: promotions } = api.promotion.getAll.useQuery(
    { page: 1, limit: 50, onlyActive: true },
    { enabled: open },
  );

  /** Da mais antiga para a mais nova: quem paga, paga a que está vencendo. */
  const pending = useMemo(
    () =>
      [...(data?.pending ?? [])].sort(
        (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
      ),
    [data?.pending],
  );

  // troca de aluno ou reabertura: volta para a parcela mais antiga
  useResetOnChange([studentId, open], () => {
    setSelectedDueDate(null);
    setPromotionId(NO_PROMOTION);
  });

  const selected =
    pending.find(
      (payment) => new Date(payment.dueDate).toISOString() === selectedDueDate,
    ) ?? pending[0];

  const promotion = promotions?.data.find((item) => item.id === promotionId);

  const fullAmount = Number(selected?.amount ?? 0);
  const discount = promotion
    ? calculateDiscount(
        fullAmount,
        promotion.discountType,
        promotion.discountValue,
      )
    : 0;

  const register = api.payment.updatePayment.useMutation({
    onSuccess: () => {
      toast({
        title: 'Pagamento registrado',
        description: `A parcela de ${studentName} virou receita no financeiro.`,
      });

      utils.payment.invalidate();
      utils.student.invalidate();
      utils.finance.invalidate();
      utils.dashboard.invalidate();
      onOpenChange(false);
    },
    onError: (error) =>
      toast({
        title: 'Não deu para registrar',
        description: error.message,
        variant: 'destructive',
      }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar pagamento</DialogTitle>
          <DialogDescription>
            {studentName} · escolha a parcela que foi paga.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} className="h-16 w-full" />
            ))}
          </div>
        ) : pending.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="Nenhuma parcela em aberto"
            description="Todas as parcelas deste aluno já estão quitadas."
          />
        ) : (
          <div className="flex flex-col gap-4">
            {/* p-0.5 dá folga para o anel da opção escolhida: sem isso o
                overflow corta a borda nas laterais. */}
            <div className="flex max-h-56 flex-col gap-2 overflow-y-auto p-0.5">
              {pending.map((payment) => {
                const dueDate = new Date(payment.dueDate);
                const key = dueDate.toISOString();
                const isSelected = selected?.id === payment.id;
                const due = describeDueDate(dueDate);

                return (
                  <button
                    key={payment.id}
                    type="button"
                    onClick={() => setSelectedDueDate(key)}
                    className={cn(
                      'focus-visible:ring-primary flex items-center justify-between gap-3 rounded-xl p-3 text-left transition-colors outline-none focus-visible:ring-2',
                      isSelected
                        ? 'bg-primary/10 ring-primary ring-2'
                        : 'bg-muted/60 hover:bg-muted',
                    )}
                  >
                    <div className="min-w-0">
                      <p className="font-medium">
                        {format(dueDate, "dd 'de' MMMM 'de' yyyy", {
                          locale: ptBR,
                        })}
                      </p>
                      <p
                        className={cn(
                          'text-xs',
                          due.late
                            ? 'text-destructive-text'
                            : 'text-muted-foreground',
                        )}
                      >
                        {due.text}
                      </p>
                    </div>

                    <span className="font-semibold whitespace-nowrap">
                      {maskBRL(Number(payment.amount), true)}
                    </span>
                  </button>
                );
              })}
            </div>

            {(promotions?.data.length ?? 0) > 0 && (
              <div className="space-y-2">
                <Label className="text-xs">Promoção (opcional)</Label>
                <Select value={promotionId} onValueChange={setPromotionId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sem promoção" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_PROMOTION}>Sem promoção</SelectItem>
                    {promotions?.data.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} ·{' '}
                        {item.discountType === 'PERCENTAGE'
                          ? `${item.discountValue}%`
                          : maskBRL(item.discountValue, true)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* O valor que vai virar receita, já com o desconto aplicado —
                a mesma conta que o servidor refaz ao salvar. */}
            <div className="bg-muted/60 flex items-center justify-between rounded-xl px-3 py-2 text-sm">
              <span className="text-muted-foreground">
                {discount > 0
                  ? `${maskBRL(fullAmount, true)} − ${maskBRL(discount, true)}`
                  : 'Valor a receber'}
              </span>
              <span className="text-base font-semibold">
                {maskBRL(fullAmount - discount, true)}
              </span>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!selected || register.isPending}
            onClick={() =>
              selected &&
              register.mutate({
                studentId,
                dueDate: new Date(selected.dueDate).toISOString(),
                promotionId: promotionId === NO_PROMOTION ? null : promotionId,
              })
            }
          >
            {register.isPending && (
              <Loader2 className="mr-2 size-4 animate-spin" />
            )}
            Registrar pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
