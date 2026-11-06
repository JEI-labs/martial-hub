'use client';

import { useState } from 'react';
import { Loader2, TriangleAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
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
import { NOME_DO_SISTEMA } from '@/common/constants/sistema';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/trpc/react';

type Criado = { email: string; senhaTemporaria: string; endereco: string };

/**
 * Nova conta master, em dois tempos: os dados de quem vai entrar, e depois a
 * senha temporária — que aparece só aqui, uma vez.
 *
 * O sistema não manda e-mail, então quem cria é quem entrega. Por isso o
 * "Copiar mensagem" junta endereço, e-mail e senha num texto pronto para
 * colar no mensageiro.
 */
export function NewMasterDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (_open: boolean) => void;
}) {
  const { toast } = useToast();
  const utils = api.useUtils();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [criado, setCriado] = useState<Criado | null>(null);

  const criar = api.master.createMaster.useMutation({
    onSuccess: (resultado) => {
      setCriado({
        email: resultado.email,
        senhaTemporaria: resultado.senhaTemporaria,
        /* Sem domínio configurado (desenvolvimento), o endereço é este. */
        endereco: resultado.endereco ?? `${window.location.origin}/auth/entrar`,
      });
      void utils.master.listMasters.invalidate();
    },
    onError: (error) =>
      toast({
        title: 'Não deu para criar',
        description: error.message,
        variant: 'destructive',
      }),
  });

  /* Fechar apaga tudo, inclusive a senha: ela não volta, e abrir de novo
     tem de começar uma conta nova, não mostrar a anterior. */
  const fechar = (aberto: boolean) => {
    if (!aberto) {
      setName('');
      setEmail('');
      setCriado(null);
      criar.reset();
    }
    onOpenChange(aberto);
  };

  const podeSalvar = name.trim().length >= 2 && email.includes('@');

  const mensagem = criado
    ? [
        `Seu acesso master ao ${NOME_DO_SISTEMA}:`,
        '',
        `Endereço: ${criado.endereco}`,
        `E-mail: ${criado.email}`,
        `Senha temporária: ${criado.senhaTemporaria}`,
        '',
        'No primeiro acesso você define a sua senha e configura a verificação em duas etapas — tenha um aplicativo autenticador no celular.',
      ].join('\n')
    : '';

  return (
    <Dialog open={open} onOpenChange={fechar}>
      <DialogContent
        className="sm:max-w-lg"
        /* Com a senha na tela, só fecha pelo botão: um clique fora ou um Esc
           por engano jogaria fora a única cópia dela. */
        onInteractOutside={(event) => {
          if (criado) event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          if (criado) event.preventDefault();
        }}
      >
        {criado ? (
          <>
            <DialogHeader>
              <DialogTitle>Conta criada</DialogTitle>
              <DialogDescription>
                Passe estes dados para a pessoa. No primeiro acesso ela troca a
                senha e configura a verificação em duas etapas — antes disso a
                conta não abre nada.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-3">
              <div className="bg-muted/60 flex flex-col gap-3 rounded-xl p-4">
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs">E-mail</p>
                  <p className="font-medium break-all">{criado.email}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs">
                    Senha temporária
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="bg-background rounded-lg px-2 py-1 text-base tracking-wider">
                      {criado.senhaTemporaria}
                    </code>
                    <CopyButton
                      value={criado.senhaTemporaria}
                      label=""
                      aria-label="Copiar senha temporária"
                    />
                  </div>
                </div>
              </div>

              <p className="text-alert flex items-start gap-2 text-sm">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                A senha não aparece de novo. Copie antes de fechar.
              </p>
            </div>

            <DialogFooter>
              <CopyButton
                value={mensagem}
                label="Copiar mensagem"
                size="default"
              />
              <Button onClick={() => fechar(false)}>Já entreguei</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Nova conta master</DialogTitle>
              <DialogDescription>
                Ela enxerga o mesmo que você: todas as academias, as faturas e a
                entrada de suporte. A senha temporária é gerada pelo sistema.
              </DialogDescription>
            </DialogHeader>

            <form
              id="novo-master"
              className="grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (podeSalvar) {
                  criar.mutate({ name: name.trim(), email: email.trim() });
                }
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="m-nome">Nome</Label>
                <Input
                  id="m-nome"
                  autoFocus
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="m-email">E-mail</Label>
                <Input
                  id="m-email"
                  type="email"
                  autoComplete="off"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
            </form>

            <DialogFooter>
              <Button variant="outline" onClick={() => fechar(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                form="novo-master"
                disabled={!podeSalvar || criar.isPending}
              >
                {criar.isPending && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}
                Criar conta
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
