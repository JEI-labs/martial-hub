'use client';

import { useState } from 'react';
import { Award, Loader2, Pencil, RotateCw } from 'lucide-react';

import {
  GraduationBadge,
  descreverGraduacao,
  type GraduationView,
} from './graduationBadge.component';
import { useFaixasDisponiveis } from './useFaixasDisponiveis';
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
import { Skeleton } from '@/components/ui/skeleton';
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

  const {
    modalidades: comFaixas,
    variasModalidades,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useFaixasDisponiveis();

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

  /* Carregando, o cartão guarda o lugar em vez de sumir e voltar: a
     graduação do aluno é informação, não enfeite. */
  if (isLoading) return <Skeleton className="h-36 w-full lg:w-72" />;

  /* Academia sem nenhuma modalidade com faixa (só boxe, ou modalidades ainda
     pendentes) não tem graduação para dar: o cartão some em vez de oferecer
     uma lista vazia. Quem já tem faixa continua vendo a sua — e com a
     consulta falhando o cartão fica, com o erro, porque aí não dá para
     saber se há faixas. */
  if (!isError && comFaixas.length === 0 && !graduation) return null;

  /* Faixa de modalidade que não está mais na lista (desativada): o nome dela
     é o que diz de onde a faixa veio. */
  const modalidadeForaDaLista =
    !!graduation?.modality &&
    !comFaixas.some((m) => m.name === graduation.modality?.name);

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
              {graduation?.modality &&
              (variasModalidades || modalidadeForaDaLista)
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

          {isError ? (
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs">
                Não deu para carregar as faixas da academia.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                disabled={isFetching}
                onClick={() => void refetch()}
              >
                {isFetching ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RotateCw className="mr-2 h-4 w-4" />
                )}
                Tentar de novo
              </Button>
            </div>
          ) : (
            /* Com faixa, o botão aparece mesmo sem nenhuma modalidade ativa
               com faixas: é por ele que se remove a faixa de uma modalidade
               desativada — e só sem ela a modalidade pode ser apagada. */
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
              {comFaixas.length === 0
                ? 'Nenhuma modalidade ativa tem faixas para escolher. Dá para remover a graduação atual, ou reativar a modalidade dela em Cadastros › Modalidades.'
                : variasModalidades
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
                      {descreverGraduacao(faixa) && (
                        <span className="text-muted-foreground block text-xs">
                          {descreverGraduacao(faixa)}
                        </span>
                      )}
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
