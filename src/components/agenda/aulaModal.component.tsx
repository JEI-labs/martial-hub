'use client';

import { useState } from 'react';
import { EAppointmentRecurrence, EPaymentMethod } from '@prisma/client';
import { format } from 'date-fns';
import { Check, Loader2, Repeat, Trash2, Users } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import ConfirmDeleteDialog from '@/components/confirmDeleteDialog/confirmDeleteDialog.component';
import { useToast } from '@/hooks/use-toast';
import { maskBRL } from '@/utils/masksUtils';
import { api, type RouterOutputs } from '@/trpc/react';
import type { Aula } from '@/components/agenda/agenda.types';

const FORMAS: Array<{ valor: EPaymentMethod; label: string }> = [
  { valor: EPaymentMethod.PIX, label: 'Pix' },
  { valor: EPaymentMethod.CASH, label: 'Dinheiro' },
  { valor: EPaymentMethod.DEBIT_CARD, label: 'Débito' },
  { valor: EPaymentMethod.CREDIT_CARD, label: 'Crédito' },
  { valor: EPaymentMethod.TRANSFER, label: 'Transferência' },
];

/** `Date` → o que um `<input type="datetime-local">` entende. */
function paraCampo(data: Date): string {
  return format(data, "yyyy-MM-dd'T'HH:mm");
}

interface Props {
  aberto: boolean;
  onOpenChange: (_aberto: boolean) => void;
  /** Aula clicada na grade. Nulo quando é um horário novo. */
  aula: Aula | null;
  /** Horário clicado na grade vazia. */
  quando: Date | null;
  podeEscolherProfessor: boolean;
  onMudou: () => void;
}

/**
 * A moldura. Ela carrega as listas e só então monta o formulário — que nasce
 * com os valores certos em vez de nascer vazio e ser corrigido por um efeito.
 */
export function AulaModal(props: Props) {
  const { aberto, onOpenChange, aula, quando } = props;

  const { data: tipos } = api.lessonTypes.list.useQuery(undefined, {
    enabled: aberto,
  });

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        {!aberto || !tipos ? (
          <div className="flex flex-col gap-3 py-6">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          /* A `key` troca quando muda a aula ou o horário clicado, e o React
             remonta o formulário do zero. É o que mantém os campos honestos
             sem um efeito limpando estado atrás do outro. */
          <Formulario
            key={
              aula
                ? `${aula.appointmentId}-${new Date(aula.data).toISOString()}`
                : `novo-${quando?.toISOString() ?? ''}`
            }
            {...props}
            tipos={tipos}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

type Tipos = RouterOutputs['lessonTypes']['list'];

function Formulario({
  onOpenChange,
  aula,
  quando,
  podeEscolherProfessor,
  onMudou,
  tipos,
}: Props & { tipos: Tipos }) {
  const { toast } = useToast();

  const { data: alunos } = api.agenda.students.useQuery();
  const { data: professores } = api.agenda.teachers.useQuery(undefined, {
    enabled: podeEscolherProfessor,
  });

  /* Os valores de partida: da aula clicada, ou do tipo padrão da academia. */
  const padrao = tipos.find((t) => t.isDefault) ?? tipos[0];
  const base = quando ?? new Date();

  const [title, setTitle] = useState(aula?.title ?? '');
  const [notes, setNotes] = useState(aula?.notes ?? '');
  const [inicio, setInicio] = useState(
    paraCampo(aula ? new Date(aula.inicio) : base),
  );
  const [fim, setFim] = useState(
    paraCampo(
      aula
        ? new Date(aula.fim)
        : new Date(base.getTime() + (padrao?.durationMinutes ?? 60) * 60000),
    ),
  );
  const [tipoId, setTipoId] = useState<string | null>(
    aula?.tipo?.id ?? padrao?.id ?? null,
  );
  const [preco, setPreco] = useState(
    aula
      ? aula.price != null
        ? String(aula.price)
        : ''
      : String(padrao?.price ?? ''),
  );
  const [selecionados, setSelecionados] = useState<Array<string>>(
    aula?.alunos.map((a) => a.id) ?? [],
  );
  const [semanal, setSemanal] = useState(aula?.recorrente ?? false);
  const [ate, setAte] = useState('');
  const [professorId, setProfessorId] = useState<string | null>(
    aula?.teacherId ?? null,
  );
  const [forma, setForma] = useState<EPaymentMethod>(EPaymentMethod.PIX);
  const [confirmarSerie, setConfirmarSerie] = useState(false);

  const editando = Boolean(aula);

  const invalidar = () => {
    onMudou();
    onOpenChange(false);
  };

  const erro = (titulo: string) => (e: { message: string }) =>
    toast({ title: titulo, description: e.message, variant: 'destructive' });

  const criar = api.agenda.create.useMutation({
    onSuccess: () => {
      toast({ title: 'Horário marcado' });
      invalidar();
    },
    onError: erro('Não deu para marcar'),
  });

  const atualizar = api.agenda.update.useMutation({
    onSuccess: () => {
      toast({ title: 'Horário atualizado' });
      invalidar();
    },
    onError: erro('Não deu para salvar'),
  });

  const desmarcarUma = api.agenda.cancelOccurrence.useMutation({
    onSuccess: () => {
      toast({ title: 'Aula desmarcada' });
      invalidar();
    },
    onError: erro('Não deu para desmarcar'),
  });

  const desmarcarSerie = api.agenda.cancelSeries.useMutation({
    onSuccess: () => {
      toast({ title: 'Série desmarcada' });
      invalidar();
    },
    onError: erro('Não deu para desmarcar'),
  });

  const pagar = api.agenda.markPaid.useMutation({
    onSuccess: () => {
      toast({
        title: 'Pagamento registrado',
        description: 'O valor entrou no caixa em Aulas particulares.',
      });
      invalidar();
    },
    onError: erro('Não deu para registrar'),
  });

  const desfazerPagamento = api.agenda.unmarkPaid.useMutation({
    onSuccess: () => {
      toast({ title: 'Pagamento desfeito' });
      invalidar();
    },
    onError: erro('Não deu para desfazer'),
  });

  const escolherTipo = (id: string) => {
    setTipoId(id);
    const tipo = tipos?.find((t) => t.id === id);
    if (!tipo) return;

    setPreco(String(tipo.price));
    /* O fim acompanha a duração do tipo escolhido — ninguém quer recalcular
       "mais cinquenta minutos" de cabeça. */
    if (inicio) {
      setFim(
        paraCampo(
          new Date(new Date(inicio).getTime() + tipo.durationMinutes * 60000),
        ),
      );
    }
  };

  const salvar = () => {
    const dados = {
      title: title.trim() || null,
      notes: notes.trim() || null,
      startsAt: new Date(inicio),
      endsAt: new Date(fim),
      recurrence: semanal
        ? EAppointmentRecurrence.WEEKLY
        : EAppointmentRecurrence.NONE,
      repeatUntil: semanal && ate ? new Date(`${ate}T23:59:59`) : null,
      lessonTypeId: tipoId,
      price: preco ? Number(preco.replace(',', '.')) : null,
      studentIds: selecionados,
    };

    if (aula) atualizar.mutate({ id: aula.appointmentId, ...dados });
    else criar.mutate({ ...dados, teacherId: professorId ?? undefined });
  };

  const salvando = criar.isPending || atualizar.isPending;
  const nomesEscolhidos =
    alunos?.filter((a) => selecionados.includes(a.id)).map((a) => a.name) ?? [];

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex flex-wrap items-center gap-2">
          {editando ? 'Horário' : 'Novo horário'}
          {aula?.recorrente && (
            <Badge variant="secondary" className="gap-1">
              <Repeat className="size-3" aria-hidden />
              toda semana
            </Badge>
          )}
          {aula?.pagoEm && <Badge variant="success">paga</Badge>}
        </DialogTitle>
        <DialogDescription>
          {editando
            ? 'Alterar aqui vale para a série inteira. Para mexer em um dia só, desmarque essa aula e marque outra.'
            : 'Aula particular, avaliação, ou qualquer compromisso que ocupe o seu horário.'}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="aula-inicio">Começa</Label>
            <Input
              id="aula-inicio"
              type="datetime-local"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="aula-fim">Termina</Label>
            <Input
              id="aula-fim"
              type="datetime-local"
              value={fim}
              onChange={(e) => setFim(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Tipo de aula</Label>
            <Select value={tipoId ?? ''} onValueChange={escolherTipo}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha" />
              </SelectTrigger>
              <SelectContent>
                {tipos
                  ?.filter((t) => t.isActive || t.id === tipoId)
                  .map((tipo) => (
                    <SelectItem key={tipo.id} value={tipo.id}>
                      {tipo.name} · {maskBRL(tipo.price, true)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="aula-preco">Valor desta aula (R$)</Label>
            <Input
              id="aula-preco"
              inputMode="decimal"
              placeholder="0,00"
              value={preco}
              onChange={(e) => setPreco(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Alunos</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start font-normal"
              >
                <Users className="mr-2 size-4" />
                {nomesEscolhidos.length
                  ? nomesEscolhidos.join(', ')
                  : 'Ninguém escolhido'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
              <Command>
                <CommandInput placeholder="Buscar aluno…" />
                <CommandList>
                  <CommandEmpty>Nenhum aluno encontrado.</CommandEmpty>
                  <CommandGroup>
                    {alunos?.map((aluno) => (
                      <CommandItem
                        key={aluno.id}
                        value={aluno.name}
                        onSelect={() =>
                          setSelecionados((atual) =>
                            atual.includes(aluno.id)
                              ? atual.filter((i) => i !== aluno.id)
                              : [...atual, aluno.id],
                          )
                        }
                      >
                        <Checkbox
                          checked={selecionados.includes(aluno.id)}
                          className="mr-2"
                        />
                        {aluno.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <p className="text-muted-foreground text-xs">
            Aula particular costuma ter um; turma pequena, mais de um. Sem
            ninguém, o horário só fica bloqueado na sua agenda.
          </p>
        </div>

        {podeEscolherProfessor && !editando && (
          <div className="space-y-2">
            <Label>Professor</Label>
            <Select value={professorId ?? ''} onValueChange={setProfessorId}>
              <SelectTrigger>
                <SelectValue placeholder="Você" />
              </SelectTrigger>
              <SelectContent>
                {professores?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="aula-titulo">Título (opcional)</Label>
          <Input
            id="aula-titulo"
            maxLength={80}
            placeholder="Sem título, aparece o nome do aluno"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="aula-notas">Observações</Label>
          <textarea
            id="aula-notas"
            maxLength={500}
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="border-input shadow-soft placeholder:text-muted-foreground focus-visible:ring-ring flex w-full resize-none rounded-2xl border bg-transparent px-3 py-2 text-sm transition-colors focus-visible:ring-1 focus-visible:outline-hidden"
          />
        </div>

        <div className="bg-muted/60 flex flex-wrap items-center gap-3 rounded-xl p-3">
          <Switch
            id="aula-semanal"
            checked={semanal}
            onCheckedChange={setSemanal}
          />
          <Label htmlFor="aula-semanal" className="cursor-pointer">
            Repete toda semana
          </Label>

          {semanal && (
            <div className="flex items-center gap-2">
              <Label htmlFor="aula-ate" className="text-xs">
                até
              </Label>
              <Input
                id="aula-ate"
                type="date"
                className="h-9 w-40"
                value={ate}
                onChange={(e) => setAte(e.target.value)}
              />
              <span className="text-muted-foreground text-xs">
                vazio = sem fim
              </span>
            </div>
          )}
        </div>

        {/* Pagamento é de uma aula, não da série: cada semana se paga. */}
        {editando && (
          <div className="border-border flex flex-col gap-2 border-t pt-4">
            <Label>Pagamento desta aula</Label>

            {aula?.pagoEm ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm">
                  Paga em{' '}
                  {format(new Date(aula.pagoEm), "dd/MM/yyyy 'às' HH:mm")}. Já
                  está no caixa.
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive-text"
                  disabled={desfazerPagamento.isPending}
                  onClick={() =>
                    desfazerPagamento.mutate({
                      id: aula.appointmentId,
                      data: new Date(aula.data),
                    })
                  }
                >
                  Desfazer
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={forma}
                  onValueChange={(v) => setForma(v as EPaymentMethod)}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMAS.map((f) => (
                      <SelectItem key={f.valor} value={f.valor}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  disabled={pagar.isPending || !aula}
                  onClick={() =>
                    aula &&
                    pagar.mutate({
                      id: aula.appointmentId,
                      data: new Date(aula.data),
                      paymentMethod: forma,
                    })
                  }
                >
                  {pagar.isPending ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 size-4" />
                  )}
                  Registrar {preco ? maskBRL(Number(preco), true) : ''}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <DialogFooter className="flex-wrap gap-2 sm:justify-between">
        {editando ? (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              className="text-destructive-text"
              disabled={desmarcarUma.isPending}
              onClick={() =>
                aula &&
                desmarcarUma.mutate({
                  id: aula.appointmentId,
                  data: new Date(aula.data),
                })
              }
            >
              <Trash2 className="mr-2 size-4" />
              {aula?.recorrente ? 'Desmarcar só esta' : 'Desmarcar'}
            </Button>

            {aula?.recorrente && (
              <Button
                variant="ghost"
                className="text-destructive-text"
                onClick={() => setConfirmarSerie(true)}
              >
                Desmarcar a série
              </Button>
            )}
          </div>
        ) : (
          <span />
        )}

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button disabled={salvando || !inicio || !fim} onClick={salvar}>
            {salvando && <Loader2 className="mr-2 size-4 animate-spin" />}
            Salvar
          </Button>
        </div>
      </DialogFooter>

      {confirmarSerie && aula && (
        <ConfirmDeleteDialog
          item={aula.appointmentId}
          open={confirmarSerie}
          onOpenChange={(aberto) => !aberto && setConfirmarSerie(false)}
          onConfirm={async (id) => {
            await desmarcarSerie.mutateAsync({ id });
            setConfirmarSerie(false);
          }}
        />
      )}
    </>
  );
}
