'use client';

import { useState } from 'react';
import {
  Award,
  ChevronDown,
  ChevronUp,
  Loader2,
  RotateCw,
  Trash2,
} from 'lucide-react';

import {
  GraduationBadge,
  descreverGraduacao,
  type GraduationView,
} from './graduationBadge.component';
import { useFaixasDisponiveis } from './useFaixasDisponiveis';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { diaDe, formatarDia } from '@/common/utils/dia';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/trpc/react';
import { maskDate } from '@/utils/masksUtils';

type Faixa = GraduationView & {
  id: string;
  modality: { id: string; name: string; slug?: string };
};

/** Um registro do histórico de graduação do aluno. */
export interface GraduationRecord {
  id: string;
  awardedAt: Date | string;
  note: string | null;
  user: { name: string } | null;
  graduation: Faixa;
}

interface GraduationCardProps {
  studentId: string;
  studentName: string;
  /** Modalidades em que o aluno está matriculado hoje: só nelas se gradua. */
  activeModalityIds: Array<string>;
  /** Todo o histórico, do mais recente para o mais antigo. */
  history: Array<GraduationRecord>;
}

/* Datas de graduação são dias do calendário (`@db.Date`): "hoje" é o de São
   Paulo, e a leitura é em UTC, para não voltar um dia no Brasil. */
const hoje = () => formatarDia(diaDe());

/**
 * A graduação do aluno, modalidade a modalidade: a faixa atual de cada uma,
 * o botão de graduar e a linha do tempo da evolução. Cada graduação é um
 * registro novo; desfazer a última corrige um lançamento errado.
 */
export function GraduationCard({
  studentId,
  studentName,
  activeModalityIds,
  history,
}: GraduationCardProps) {
  const { toast } = useToast();
  const utils = api.useUtils();
  const [aberta, setAberta] = useState<string | null>(null);
  const [graduarEm, setGraduarEm] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [awardedAt, setAwardedAt] = useState(hoje);
  const [note, setNote] = useState('');
  const [removendo, setRemovendo] = useState<GraduationRecord | null>(null);

  const {
    modalidades: catalogo,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useFaixasDisponiveis();

  /* Só a ficha deste aluno e o painel: invalidar todo `student` refazia
     também cada página da lista em cache, e um refetch à parte do detalhe
     buscava a ficha duas vezes. */
  const depois = () => {
    void utils.student.getDetailsByID.invalidate({ id: studentId });
    void utils.dashboard.invalidate();
  };

  const award = api.student.awardGraduation.useMutation({
    onSuccess: () => {
      toast({ title: 'Graduação registrada' });
      setGraduarEm(null);
      depois();
    },
    onError: (error) =>
      toast({
        title: 'Não deu para registrar',
        description: error.message,
        variant: 'destructive',
      }),
  });

  const remove = api.student.removeGraduation.useMutation({
    onSuccess: () => {
      toast({ title: 'Graduação removida do histórico' });
      setRemovendo(null);
      depois();
    },
    onError: (error) =>
      toast({
        title: 'Não deu para remover',
        description: error.message,
        variant: 'destructive',
      }),
  });

  /* Carregando, o cartão guarda o lugar em vez de sumir e voltar: a
     graduação do aluno é informação, não enfeite. */
  if (isLoading) return <Skeleton className="h-36 w-full lg:w-80" />;

  /* Sem o catálogo não dá para graduar, mas a faixa atual vem com o aluno e
     continua aparecendo — com o erro e um jeito de tentar de novo. */
  const erroDoCatalogo = isError && (
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
  );

  /* As linhas: as modalidades com faixa que o aluno faz hoje, mais as que
     ele já teve faixa (mesmo que tenha saído delas), na ordem da academia. */
  const historicoDe = (modalityId: string) =>
    history.filter((r) => r.graduation.modality.id === modalityId);
  const linhas = [
    ...catalogo.filter(
      (m) =>
        m.graduations.length > 0 &&
        (activeModalityIds.includes(m.id) || historicoDe(m.id).length > 0),
    ),
    /* Modalidade desativada não vem no catálogo, mas a faixa dela fica. */
    ...Array.from(
      new Map(
        history
          .filter(
            (r) => !catalogo.some((m) => m.id === r.graduation.modality.id),
          )
          .map((r) => [
            r.graduation.modality.id,
            { ...r.graduation.modality, graduations: [] },
          ]),
      ).values(),
    ),
  ];

  if (linhas.length === 0 && !isError) return null;

  const modalidadeDoDialogo = catalogo.find((m) => m.id === graduarEm);
  const atualDoDialogo = graduarEm ? historicoDe(graduarEm)[0] : undefined;

  const abrirGraduar = (modalityId: string) => {
    const modalidade = catalogo.find((m) => m.id === modalityId);
    const atual = historicoDe(modalityId)[0];
    /* Já vem escolhida a faixa seguinte à atual: é o caso mais comum. */
    const proxima = atual
      ? modalidade?.graduations.find(
          (f) => f.position === atual.graduation.position + 1,
        )
      : modalidade?.graduations[0];
    setSelected(proxima?.id ?? null);
    setAwardedAt(hoje());
    setNote('');
    setGraduarEm(modalityId);
  };

  return (
    <>
      <Card className="lg:w-80">
        <CardHeader className="pb-2">
          <CardTitle className="text-muted-foreground text-xs font-normal uppercase">
            Graduação
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 p-5 pt-0">
          {erroDoCatalogo}
          {linhas.map((modalidade) => {
            const registros = historicoDe(modalidade.id);
            const atual = registros[0];
            const podeGraduar =
              modalidade.graduations.length > 0 &&
              activeModalityIds.includes(modalidade.id);
            const expandida = aberta === modalidade.id;

            return (
              <div key={modalidade.id} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    {linhas.length > 1 && (
                      <p className="text-muted-foreground text-xs font-medium">
                        {modalidade.name}
                      </p>
                    )}
                    {atual ? (
                      <GraduationBadge graduation={atual.graduation} />
                    ) : (
                      <p className="text-muted-foreground text-sm">
                        Sem faixa{linhas.length > 1 ? '' : ' ainda'}.
                      </p>
                    )}
                  </div>

                  {podeGraduar && (
                    <Button
                      size="sm"
                      variant={atual ? 'outline' : 'default'}
                      onClick={() => abrirGraduar(modalidade.id)}
                    >
                      <Award className="mr-2 h-4 w-4" />
                      Graduar
                    </Button>
                  )}
                </div>

                {registros.length > 0 && (
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs"
                    aria-expanded={expandida}
                    onClick={() => setAberta(expandida ? null : modalidade.id)}
                  >
                    {expandida ? (
                      <ChevronUp className="size-3" />
                    ) : (
                      <ChevronDown className="size-3" />
                    )}
                    Histórico ({registros.length})
                  </button>
                )}

                {expandida && (
                  <ol className="border-border ml-1 space-y-2 border-l pl-3">
                    {registros.map((registro) => (
                      <li key={registro.id} className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <GraduationBadge
                            graduation={registro.graduation}
                            showLabel={false}
                          />
                          <span className="text-sm">
                            {registro.graduation.name}
                          </span>
                        </div>
                        <p className="text-muted-foreground text-xs">
                          {formatarDia(registro.awardedAt)}
                          {registro.user ? ` · por ${registro.user.name}` : ''}
                          {registro.note ? ` · ${registro.note}` : ''}
                        </p>
                        {/* Qualquer registro, não só o mais recente: um
                            exame lançado com o ano errado fica no fundo da
                            lista. Só onde o aluno ainda está matriculado —
                            quem cancelou mantém o histórico, e o que se
                            apagasse ali não teria como voltar. */}
                        {activeModalityIds.includes(modalidade.id) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-muted-foreground h-7 px-2 text-xs"
                            disabled={remove.isPending}
                            onClick={() => setRemovendo(registro)}
                          >
                            <Trash2 className="mr-1 size-3" />
                            Remover do histórico
                          </Button>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(graduarEm)}
        onOpenChange={(open) => !open && setGraduarEm(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Graduar em {modalidadeDoDialogo?.name ?? 'modalidade'}
            </DialogTitle>
            <DialogDescription>
              {studentName}
              {atualDoDialogo
                ? ` · hoje na faixa ${atualDoDialogo.graduation.name}`
                : ' · ainda sem faixa nesta modalidade'}
              . A faixa anterior fica no histórico.
            </DialogDescription>
          </DialogHeader>

          <div className="-mx-2 max-h-64 space-y-1 overflow-y-auto px-2">
            {modalidadeDoDialogo?.graduations.map((faixa) => {
              const ehAtual = atualDoDialogo?.graduation.id === faixa.id;
              return (
                <button
                  key={faixa.id}
                  type="button"
                  disabled={ehAtual}
                  onClick={() => setSelected(faixa.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md border p-2 text-left disabled:opacity-60',
                    selected === faixa.id
                      ? 'border-primary bg-accent'
                      : 'hover:bg-muted border-transparent',
                  )}
                >
                  <GraduationBadge graduation={faixa} showLabel={false} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm">
                      {faixa.name}
                      {ehAtual ? ' (atual)' : ''}
                    </span>
                    {descreverGraduacao(faixa) && (
                      <span className="text-muted-foreground block text-xs">
                        {descreverGraduacao(faixa)}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="grad-data">Data da graduação</Label>
              <Input
                id="grad-data"
                inputMode="numeric"
                placeholder="DD/MM/AAAA"
                maxLength={10}
                value={awardedAt}
                onChange={(event) => setAwardedAt(maskDate(event.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="grad-obs">Observação</Label>
              <Input
                id="grad-obs"
                placeholder="Ex.: exame de março"
                maxLength={120}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={award.isPending}
              onClick={() => setGraduarEm(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={award.isPending || !selected || awardedAt.length !== 10}
              onClick={() =>
                selected &&
                award.mutate({
                  studentId,
                  graduationId: selected,
                  awardedAt,
                  note: note.trim() || undefined,
                })
              }
            >
              {award.isPending ? 'Salvando...' : 'Registrar graduação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(removendo)}
        onOpenChange={(open) =>
          !open && !remove.isPending && setRemovendo(null)
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover esta graduação?</AlertDialogTitle>
            <AlertDialogDescription>
              {removendo
                ? `${removendo.graduation.name} em ${removendo.graduation.modality.name}, de ${formatarDia(removendo.awardedAt)}, sai do histórico de ${studentName}. `
                : ''}
              Se era a faixa atual, a anterior volta a ser. Não dá para
              desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={remove.isPending}
              onClick={(event) => {
                /* Fecha só quando o servidor responder. */
                event.preventDefault();
                if (removendo) remove.mutate({ id: removendo.id });
              }}
            >
              {remove.isPending ? 'Removendo...' : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
