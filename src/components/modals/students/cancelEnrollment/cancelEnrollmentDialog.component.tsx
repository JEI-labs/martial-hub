'use client';

import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/trpc/react';

interface CancelEnrollmentDialogProps {
  studentId: string;
  studentName: string;
  planName?: string | null;
  open: boolean;
  onOpenChange: (_open: boolean) => void;
  onCancelled?: () => void;
}

/**
 * Cancelamento da matrícula. Não é o diálogo de exclusão genérico porque o que
 * acontece aqui é específico e precisa estar escrito: o aluno fica, as
 * parcelas futuras somem, as atrasadas continuam.
 */
export function CancelEnrollmentDialog({
  studentId,
  studentName,
  planName,
  open,
  onOpenChange,
  onCancelled,
}: CancelEnrollmentDialogProps) {
  const { toast } = useToast();
  const utils = api.useUtils();

  const cancel = api.student.cancelEnrollment.useMutation({
    onSuccess: (result) => {
      toast({
        title: 'Matrícula cancelada',
        description:
          result.cancelled > 0
            ? `${result.cancelled} parcela(s) ainda não vencida(s) foram canceladas.`
            : 'Não havia parcelas futuras para cancelar.',
      });

      utils.student.invalidate();
      utils.payment.invalidate();
      utils.dashboard.invalidate();
      onCancelled?.();
      onOpenChange(false);
    },
    onError: (error) =>
      toast({
        title: 'Não deu para cancelar',
        description: error.message,
        variant: 'destructive',
      }),
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar matrícula</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                {studentName}
                {planName ? ` está no plano ${planName}.` : '.'} A matrícula
                encerra hoje.
              </p>

              <ul className="space-y-1">
                <li>
                  O aluno continua cadastrado, com o histórico de pagamentos.
                </li>
                <li>
                  Parcelas ainda não vencidas são canceladas; as atrasadas
                  continuam a ser cobradas.
                </li>
                <li>
                  Nada é devolvido automaticamente — se houver reembolso, lance
                  como despesa no financeiro.
                </li>
                <li>Para voltar a treinar, é só matriculá-lo de novo.</li>
              </ul>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={cancel.isPending}>
            Voltar
          </AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={cancel.isPending}
            onClick={() => cancel.mutate({ studentId })}
          >
            {cancel.isPending && (
              <Loader2 className="mr-2 size-4 animate-spin" />
            )}
            Cancelar matrícula
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
