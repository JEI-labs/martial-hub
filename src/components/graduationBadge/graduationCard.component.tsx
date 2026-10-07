'use client';

import { useState } from 'react';
import { Award, Pencil } from 'lucide-react';
import type { EGraduation } from '@prisma/client';

import { GRADUATIONS, GRADUATION_LIST } from '@/common/constants/graduations';
import { GraduationBadge } from './graduationBadge.component';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/trpc/react';

interface GraduationCardProps {
  studentId: string;
  graduation?: EGraduation | null;
  onUpdated?: () => void;
}

export function GraduationCard({
  studentId,
  graduation,
  onUpdated,
}: GraduationCardProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<EGraduation | null>(
    graduation ?? null,
  );

  const { mutate, isPending } = api.student.updateGraduation.useMutation({
    onSuccess: () => {
      toast({ title: 'Graduação atualizada' });
      setOpen(false);
      onUpdated?.();
    },
    onError: () =>
      toast({ title: 'Erro ao atualizar graduação', variant: 'destructive' }),
  });

  // reabrir depois de cancelar deve mostrar a graduação salva, não a escolha
  // abandonada da vez anterior
  const openDialog = () => {
    setSelected(graduation ?? null);
    setOpen(true);
  };

  return (
    <>
      <Card className="lg:w-72">
        <CardContent className="flex h-full flex-col justify-between gap-3 p-5">
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs uppercase">Graduação</p>

            {graduation ? (
              <GraduationBadge graduation={graduation} />
            ) : (
              <p className="text-muted-foreground text-sm">
                Este aluno ainda não tem graduação.
              </p>
            )}
          </div>

          <Button
            variant={graduation ? 'outline' : 'default'}
            size="sm"
            className="w-full"
            onClick={openDialog}
          >
            {graduation ? (
              <>
                <Pencil className="mr-2 h-4 w-4" />
                Editar graduação
              </>
            ) : (
              <>
                <Award className="mr-2 h-4 w-4" />
                Informar graduação
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Graduação do aluno</DialogTitle>
            <DialogDescription>
              Selecione o Kruang-Prajied correspondente.
            </DialogDescription>
          </DialogHeader>

          <div className="-mx-2 max-h-80 space-y-1 overflow-y-auto px-2">
            {GRADUATION_LIST.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setSelected(item.value)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-md border p-2 text-left',
                  selected === item.value
                    ? 'border-primary bg-accent'
                    : 'hover:bg-muted border-transparent',
                )}
              >
                <GraduationBadge graduation={item.value} showLabel={false} />
                <span className="min-w-0">
                  <span className="block truncate text-sm">{item.label}</span>
                  <span className="text-muted-foreground block text-xs">
                    {item.degree}º grau · {item.level}
                  </span>
                </span>
              </button>
            ))}
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            {graduation && (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive-text hover:text-destructive-text"
                disabled={isPending}
                onClick={() => mutate({ id: studentId, graduation: null })}
              >
                Remover graduação
              </Button>
            )}

            <div className="flex gap-2 sm:ml-auto">
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={isPending || !selected || selected === graduation}
                onClick={() =>
                  selected && mutate({ id: studentId, graduation: selected })
                }
              >
                {isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export { GRADUATIONS };
