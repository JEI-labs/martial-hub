'use client';

import { useState } from 'react';
import { Clock, Loader2, Plus, Star } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { Switch } from '@/components/ui/switch';
import ConfirmDeleteDialog from '@/components/confirmDeleteDialog/confirmDeleteDialog.component';
import { useToast } from '@/hooks/use-toast';
import { maskBRL } from '@/utils/masksUtils';
import { api, type RouterOutputs } from '@/trpc/react';

type Tipo = RouterOutputs['lessonTypes']['list'][number];

export function LessonTypesCard() {
  const { toast } = useToast();
  const utils = api.useUtils();
  const { data: tipos, isLoading } = api.lessonTypes.list.useQuery();

  const [editando, setEditando] = useState<Tipo | null>(null);
  const [criando, setCriando] = useState(false);
  const [apagando, setApagando] = useState<string | null>(null);

  const invalidar = () => utils.lessonTypes.list.invalidate();

  const apagar = api.lessonTypes.remove.useMutation({
    onSuccess: () => {
      toast({ title: 'Tipo apagado' });
      setApagando(null);
      invalidar();
    },
    onError: (e) =>
      toast({
        title: 'Não deu para apagar',
        description: e.message,
        variant: 'destructive',
      }),
  });

  return (
    <Card>
      <CardHeader className="flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>Tipos de aula</CardTitle>
          <CardDescription>
            O que a academia cobra fora da mensalidade. A agenda usa o preço e a
            duração daqui ao marcar, e o valor cai no caixa em Aulas
            particulares.
          </CardDescription>
        </div>

        <Button onClick={() => setCriando(true)}>
          <Plus className="mr-2 size-4" />
          Novo tipo
        </Button>
      </CardHeader>

      <CardContent className="flex flex-col gap-2">
        {isLoading ? (
          [0, 1].map((i) => <Skeleton key={i} className="h-16 w-full" />)
        ) : tipos?.length ? (
          tipos.map((tipo) => (
            <button
              key={tipo.id}
              type="button"
              onClick={() => setEditando(tipo)}
              className="bg-muted/60 hover:bg-muted flex flex-wrap items-center gap-3 rounded-xl p-4 text-left transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {tipo.name}
                  {tipo.isDefault && (
                    <Badge variant="secondary" className="gap-1">
                      <Star className="size-3" aria-hidden />
                      padrão
                    </Badge>
                  )}
                  {!tipo.isActive && (
                    <Badge variant="outline">desativado</Badge>
                  )}
                </p>
                <p className="text-muted-foreground flex items-center gap-2 text-sm">
                  <Clock className="size-3" aria-hidden />
                  {tipo.durationMinutes} min
                </p>
              </div>

              <span className="font-medium">{maskBRL(tipo.price, true)}</span>
            </button>
          ))
        ) : (
          <p className="text-muted-foreground text-sm">
            Nenhum tipo cadastrado. Sem eles, a agenda ainda marca horário — só
            não sugere preço nem duração.
          </p>
        )}
      </CardContent>

      <FormularioTipo
        aberto={criando || Boolean(editando)}
        tipo={editando}
        onOpenChange={(aberto) => {
          if (!aberto) {
            setCriando(false);
            setEditando(null);
          }
        }}
        onSalvou={invalidar}
        onApagar={(id) => setApagando(id)}
      />

      {apagando && (
        <ConfirmDeleteDialog
          item={apagando}
          open={Boolean(apagando)}
          onOpenChange={(aberto) => !aberto && setApagando(null)}
          onConfirm={async (id) => {
            await apagar.mutateAsync({ id });
          }}
        />
      )}
    </Card>
  );
}

function FormularioTipo({
  aberto,
  tipo,
  onOpenChange,
  onSalvou,
  onApagar,
}: {
  aberto: boolean;
  tipo: Tipo | null;
  onOpenChange: (_aberto: boolean) => void;
  onSalvou: () => void;
  onApagar: (_id: string) => void;
}) {
  if (!aberto) return null;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Remontado a cada abertura pela `key`: os campos nascem com o tipo
            clicado em vez de serem corrigidos depois. */}
        <Campos
          key={tipo?.id ?? 'novo'}
          tipo={tipo}
          onPronto={() => {
            onSalvou();
            onOpenChange(false);
          }}
          onFechar={() => onOpenChange(false)}
          onApagar={onApagar}
        />
      </DialogContent>
    </Dialog>
  );
}

function Campos({
  tipo,
  onPronto,
  onFechar,
  onApagar,
}: {
  tipo: Tipo | null;
  onPronto: () => void;
  onFechar: () => void;
  onApagar: (_id: string) => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(tipo?.name ?? '');
  const [price, setPrice] = useState(tipo ? String(tipo.price) : '');
  const [duracao, setDuracao] = useState(String(tipo?.durationMinutes ?? 60));
  const [isDefault, setIsDefault] = useState(tipo?.isDefault ?? false);
  const [isActive, setIsActive] = useState(tipo?.isActive ?? true);

  const erro = (titulo: string) => (e: { message: string }) =>
    toast({ title: titulo, description: e.message, variant: 'destructive' });

  const criar = api.lessonTypes.create.useMutation({
    onSuccess: () => {
      toast({ title: 'Tipo criado' });
      onPronto();
    },
    onError: erro('Não deu para criar'),
  });

  const atualizar = api.lessonTypes.update.useMutation({
    onSuccess: () => {
      toast({ title: 'Tipo salvo' });
      onPronto();
    },
    onError: erro('Não deu para salvar'),
  });

  const salvando = criar.isPending || atualizar.isPending;
  const valor = Number(price.replace(',', '.'));
  const minutos = Number(duracao);
  const podeSalvar =
    name.trim().length >= 2 &&
    Number.isFinite(valor) &&
    valor >= 0 &&
    minutos >= 10;

  const salvar = () => {
    const dados = {
      name: name.trim(),
      price: valor,
      durationMinutes: minutos,
      isDefault,
    };

    if (tipo) atualizar.mutate({ id: tipo.id, ...dados, isActive });
    else criar.mutate(dados);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{tipo ? 'Tipo de aula' : 'Novo tipo de aula'}</DialogTitle>
        <DialogDescription>
          O preço vem para a agenda ao marcar, e de lá para o caixa quando a
          aula for paga. Mudar aqui não mexe no que já foi cobrado.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <div className="space-y-2">
          <Label htmlFor="tipo-nome">Nome</Label>
          <Input
            id="tipo-nome"
            maxLength={60}
            placeholder="Aula particular, avaliação…"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="tipo-preco">Preço (R$)</Label>
            <Input
              id="tipo-preco"
              inputMode="decimal"
              placeholder="0,00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipo-duracao">Duração (min)</Label>
            <Input
              id="tipo-duracao"
              inputMode="numeric"
              value={duracao}
              onChange={(e) => setDuracao(e.target.value.replace(/\D/g, ''))}
            />
          </div>
        </div>

        <div className="bg-muted/60 flex items-center gap-3 rounded-xl p-3">
          <Switch
            id="tipo-padrao"
            checked={isDefault}
            onCheckedChange={setIsDefault}
          />
          <Label htmlFor="tipo-padrao" className="cursor-pointer">
            Já vem escolhido ao marcar
          </Label>
        </div>

        {tipo && (
          <div className="bg-muted/60 flex items-center gap-3 rounded-xl p-3">
            <Switch
              id="tipo-ativo"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
            <Label htmlFor="tipo-ativo" className="cursor-pointer">
              Disponível para novos agendamentos
            </Label>
          </div>
        )}
      </div>

      <DialogFooter className="flex-wrap gap-2 sm:justify-between">
        {tipo ? (
          <Button
            variant="ghost"
            className="text-destructive-text"
            onClick={() => {
              onFechar();
              onApagar(tipo.id);
            }}
          >
            Apagar
          </Button>
        ) : (
          <span />
        )}

        <div className="flex gap-2">
          <Button variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button disabled={salvando || !podeSalvar} onClick={salvar}>
            {salvando && <Loader2 className="mr-2 size-4 animate-spin" />}
            Salvar
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}
