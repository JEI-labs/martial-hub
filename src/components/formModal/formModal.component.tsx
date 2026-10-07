'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import ConfirmDeleteDialog from '@/components/confirmDeleteDialog/confirmDeleteDialog.component';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SheetContent } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface FormModalProps {
  open: boolean;
  onOpenChange: (_open: boolean) => void;
  title: string;
  description?: string;
  /** Já envolvido em form.handleSubmit pelo chamador. */
  onSubmit: (_event: React.FormEvent<HTMLFormElement>) => void;
  submitLabel: string;
  /** Rótulo enquanto envia, ex.: "Salvando...". */
  submitPendingLabel?: string;
  isSubmitting?: boolean;
  cancelLabel?: string;
  /**
   * Quando existe, o rodapé ganha "Excluir" à esquerda, com confirmação. É por
   * aqui que os cadastros apagam um registro: a linha da tabela abre este
   * modal, e alterar e excluir ficam no mesmo lugar.
   */
  onDelete?: () => void | Promise<void>;
  deleteLabel?: string;
  /**
   * No celular, abre como gaveta subindo de baixo em vez de modal no centro:
   * fica ao alcance do polegar e o teclado não esconde o botão de salvar.
   */
  sheetOnMobile?: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * Casca única dos formulários: modal no centro da tela, com cabeçalho e rodapé
 * fixos e só os campos rolando. Antes era uma gaveta lateral, e cada
 * formulário definia a própria largura (30vw, 40vw, …) com o botão de enviar
 * solto no fim do conteúdo, fora de alcance nos formulários longos.
 */
export function FormModal({
  open,
  onOpenChange,
  title,
  description,
  onSubmit,
  submitLabel,
  submitPendingLabel,
  isSubmitting = false,
  cancelLabel = 'Cancelar',
  onDelete,
  deleteLabel = 'Excluir',
  sheetOnMobile = false,
  children,
  className,
}: FormModalProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const isMobile = useIsMobile();

  /* Sheet e Dialog são o mesmo primitivo do Radix por baixo: título, descrição
     e fechar servem aos dois, e só a casca muda. */
  const asSheet = sheetOnMobile && isMobile;
  const Content = asSheet ? SheetContent : DialogContent;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* max-h + min-h-0: o modal para de crescer na altura da janela e quem
          rola é o miolo, não a página atrás dele. */}
      <Content
        {...(asSheet ? { side: 'bottom' as const } : {})}
        className={cn(
          asSheet
            ? 'flex max-h-[90dvh] flex-col gap-0 overflow-hidden rounded-t-2xl p-0'
            : 'flex max-h-[90vh] w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl',
          className,
        )}
      >
        <form onSubmit={onSubmit} className="flex min-h-0 flex-col">
          <DialogHeader className="space-y-1 border-b px-6 py-5 text-left">
            <DialogTitle className="text-xl">{title}</DialogTitle>
            {description && (
              <DialogDescription>{description}</DialogDescription>
            )}
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6">
            {children}
          </div>

          <DialogFooter className="flex-row items-center gap-2 border-t px-6 py-4">
            {onDelete && (
              /* Longe dos outros dois: apagar não é o irmão de salvar. */
              <Button
                type="button"
                variant="ghost"
                className="text-destructive-text hover:text-destructive-text mr-auto"
                disabled={isSubmitting}
                onClick={() => setConfirmingDelete(true)}
              >
                <Trash2 className="mr-2 size-4" />
                {deleteLabel}
              </Button>
            )}

            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isSubmitting}>
                {cancelLabel}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && submitPendingLabel
                ? submitPendingLabel
                : submitLabel}
            </Button>
          </DialogFooter>
        </form>

        {onDelete && (
          <ConfirmDeleteDialog
            item=""
            open={confirmingDelete}
            onOpenChange={setConfirmingDelete}
            onConfirm={async () => {
              await onDelete();
              onOpenChange(false);
            }}
          />
        )}
      </Content>
    </Dialog>
  );
}
