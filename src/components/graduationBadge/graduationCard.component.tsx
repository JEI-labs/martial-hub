'use client';

import { useState } from 'react';
import { Award, Pencil } from 'lucide-react';

import {
  GraduationBadge,
  descreverGraduacao,
  type GraduationView,
} from './graduationBadge.component';
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
  graduation?: (GraduationView & { id: string }) | null;
  onUpdated?: () => void;
}

export function GraduationCard({
  studentId,
  graduation,
  onUpdated,
}: GraduationCardProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(
    graduation?.id ?? null,
  );

  const { data: modalidades } = api.graduations.list.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  /* Só as modalidades que têm faixa: boxe não tem o que escolher. */
  const comFaixas = (modalidades ?? []).filter(
    (modalidade) => modalidade.graduations.length > 0,
  );
  const variasModalidades = comFaixas.length > 1;

  const { mutate, isPending } = api.student.updateGraduation.useMutation({
    onSuccess: () => {
      toast({ title: 'Graduação atualizada' });
      setOpen(false);
      onUpdated?.();
    },
    onError: (error) =>
      toast({
        title: 'Erro ao atualizar graduação',
        description: error.message,
        variant: 'destructive',
      }),
  });

  /* Academia sem nenhuma modalidade com faixa (só boxe, ou modalidades ainda
     pendentes) não tem graduação para dar: o cartão some em vez de oferecer
     uma lista vazia. Quem já tem faixa continua vendo a sua. */
  if (!modalidades || (comFaixas.length === 0 && !graduation)) return null;

  // reabrir depois de cancelar deve mostrar a graduação salva, não a escolha
  // abandonada da vez anterior
  const openDialog = () => {
    setSelected(graduation?.id ?? null);
    setOpen(true);
  };

  return (
    <>
      <Card className="lg:w-72">
        <CardContent className="flex h-full flex-col justify-between gap-3 p-5">
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs uppercase">
              Graduação
              {graduation?.modality && variasModalidades
                ? ` · ${graduation.modality.name}`
                : ''}
            </p>

            {graduation ? (
              <GraduationBadge graduation={graduation} />
            ) : (
              <p className="text-muted-foreground text-sm">
                Este aluno ainda não tem graduação.
              </p>
            )}
          </div>

          {comFaixas.length > 0 && (
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
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Graduação do aluno</DialogTitle>
            <DialogDescription>
              {variasModalidades
                ? 'Selecione a faixa, na modalidade correspondente.'
                : `Selecione a faixa de ${comFaixas[0]?.name ?? 'graduação'}.`}
            </DialogDescription>
          </DialogHeader>

          <div className="-mx-2 max-h-80 space-y-3 overflow-y-auto px-2">
            {comFaixas.map((modalidade) => (
              <div key={modalidade.id} className="space-y-1">
                {variasModalidades && (
                  <p className="text-muted-foreground px-2 pt-1 text-xs font-medium uppercase">
                    {modalidade.name}
                  </p>
                )}

                {modalidade.graduations.map((faixa) => (
                  <button
                    key={faixa.id}
                    type="button"
                    onClick={() => setSelected(faixa.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-md border p-2 text-left',
                      selected === faixa.id
                        ? 'border-primary bg-accent'
                        : 'hover:bg-muted border-transparent',
                    )}
                  >
                    <GraduationBadge graduation={faixa} showLabel={false} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm">
                        {faixa.name}
                      </span>
                      <span className="text-muted-foreground block text-xs">
                        {descreverGraduacao(faixa)}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            {graduation && (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive-text hover:text-destructive-text"
                disabled={isPending}
                onClick={() => mutate({ id: studentId, graduationId: null })}
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
                disabled={isPending || !selected || selected === graduation?.id}
                onClick={() =>
                  selected && mutate({ id: studentId, graduationId: selected })
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
