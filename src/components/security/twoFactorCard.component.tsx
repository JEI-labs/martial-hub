'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Check, Copy, Loader2, ShieldAlert, ShieldCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { CopyButton } from '@/components/ui/copy-button';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/trpc/react';

/**
 * Verificação em duas etapas da própria conta.
 *
 * A ordem dos passos não é enfeite: o segredo nasce desligado e só passa a
 * valer quando a pessoa digita um código que o aplicativo gerou. Ligar antes
 * disso trancaria para fora quem errou a leitura do QR.
 */
export function TwoFactorCard() {
  const { toast } = useToast();
  const utils = api.useUtils();

  const { data: status, isLoading } = api.security.status.useQuery();
  const [segredo, setSegredo] = useState<{
    qr: string;
    segredo: string;
  } | null>(null);
  const [codigo, setCodigo] = useState('');
  const [recuperacao, setRecuperacao] = useState<Array<string> | null>(null);
  /* Campo separado do de cima: desligar e gerar novos códigos ficam na mesma
     tela, e um só valor faria o código digitado para um disparar o outro. */
  const [codigoParaDesligar, setCodigoParaDesligar] = useState('');

  const comecar = api.security.startTwoFactor.useMutation({
    onSuccess: (dados) => {
      setSegredo({ qr: dados.qr, segredo: dados.segredo });
      setRecuperacao(null);
      setCodigo('');
    },
    onError: (error) =>
      toast({
        title: 'Não deu para começar',
        description: error.message,
        variant: 'destructive',
      }),
  });

  const confirmar = api.security.confirmTwoFactor.useMutation({
    onSuccess: (dados) => {
      setRecuperacao(dados.codigos);
      setSegredo(null);
      setCodigo('');
      utils.security.status.invalidate();
      toast({
        title: 'Verificação ativada',
        description: 'Guarde os códigos de recuperação antes de fechar.',
      });
    },
    onError: (error) =>
      toast({
        title: 'Código recusado',
        description: error.message,
        variant: 'destructive',
      }),
  });

  const novosCodigos = api.security.regenerateRecoveryCodes.useMutation({
    onSuccess: (dados) => {
      setRecuperacao(dados.codigos);
      setCodigo('');
      utils.security.status.invalidate();
    },
    onError: (error) =>
      toast({
        title: 'Não deu para gerar',
        description: error.message,
        variant: 'destructive',
      }),
  });

  const desligar = api.security.disableTwoFactor.useMutation({
    onSuccess: () => {
      setCodigoParaDesligar('');
      setRecuperacao(null);
      utils.security.status.invalidate();
      toast({
        title: 'Verificação desligada',
        description: 'A entrada volta a pedir só a senha.',
      });
    },
    onError: (error) =>
      toast({
        title: 'Não deu para desligar',
        description: error.message,
        variant: 'destructive',
      }),
  });

  if (isLoading || !status) return <Skeleton className="h-64 w-full" />;

  const ativo = status.ativo;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex flex-wrap items-center gap-2">
            Verificação em duas etapas
            {ativo ? (
              <Badge variant="success">Ativa</Badge>
            ) : status.obrigatorio ? (
              <Badge variant="destructive">Obrigatória</Badge>
            ) : status.recomendado ? (
              <Badge variant="alert">Recomendada</Badge>
            ) : (
              <Badge variant="secondary">Desligada</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Além da senha, o sistema pede um código de seis dígitos que muda a
            cada 30 segundos no seu celular.
            {status.obrigatorio &&
              ' Para conta de dono do sistema ela é obrigatória: é a conta que abre todas as academias de uma vez.'}
            {status.recomendado &&
              ' O seu acesso abre os dados de todo mundo — alunos, pagamentos, dinheiro. Se a sua senha vazar, é esta etapa que impede o estrago.'}
          </CardDescription>
        </div>

        <span
          className={
            ativo
              ? 'text-green-600'
              : status.obrigatorio
                ? 'text-destructive-text'
                : status.recomendado
                  ? 'text-alert'
                  : 'text-muted-foreground'
          }
        >
          {ativo ? (
            <ShieldCheck className="size-8" aria-hidden />
          ) : (
            <ShieldAlert className="size-8" aria-hidden />
          )}
        </span>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {recuperacao && (
          <div className="border-alert/40 bg-alert/10 flex flex-col gap-3 rounded-xl border p-4">
            <p className="font-medium">Códigos de recuperação</p>
            <p className="text-muted-foreground text-sm">
              Guarde fora do celular. Cada um serve uma vez e é a única entrada
              se você perder o aparelho — eles não aparecem de novo.
            </p>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {recuperacao.map((item) => (
                <code
                  key={item}
                  className="bg-background rounded-lg px-2 py-1 text-center text-sm"
                >
                  {item}
                </code>
              ))}
            </div>

            <div className="flex gap-2">
              <CopyButton value={recuperacao.join('\n')} label="Copiar todos" />
              <Button variant="ghost" onClick={() => setRecuperacao(null)}>
                Já guardei
              </Button>
            </div>
          </div>
        )}

        {!ativo && !segredo && (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              disabled={comecar.isPending}
              onClick={() => comecar.mutate()}
            >
              {comecar.isPending && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              Ativar agora
            </Button>
            <span className="text-muted-foreground text-sm">
              Precisa de um aplicativo autenticador: Google Authenticator,
              Authy, 1Password, o que preferir.
            </span>
          </div>
        )}

        {segredo && (
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="bg-background shrink-0 self-start rounded-xl p-3">
              {/* QR gerado no servidor como data URL: nenhum host externo vê o
                  segredo. */}
              <Image
                src={segredo.qr}
                alt="QR code da verificação em duas etapas"
                width={200}
                height={200}
                unoptimized
              />
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <div>
                <p className="font-medium">1. Leia o QR no aplicativo</p>
                <p className="text-muted-foreground text-sm">
                  Sem câmera? Digite este código no aplicativo:
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <code className="bg-background rounded-lg px-2 py-1 text-sm break-all">
                    {segredo.segredo}
                  </code>
                  <CopyButton value={segredo.segredo} label="Copiar" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="codigo-2fa">
                  2. Digite o código que apareceu
                </Label>
                <div className="flex flex-wrap gap-2">
                  <Input
                    id="codigo-2fa"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    className="w-32 text-center tracking-widest"
                    value={codigo}
                    onChange={(event) =>
                      setCodigo(event.target.value.replace(/\D/g, ''))
                    }
                  />
                  <Button
                    disabled={codigo.length !== 6 || confirmar.isPending}
                    onClick={() => confirmar.mutate({ codigo })}
                  >
                    {confirmar.isPending ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <Check className="mr-2 size-4" />
                    )}
                    Confirmar
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {ativo && (
          <div className="flex flex-col gap-3">
            <p className="text-muted-foreground text-sm">
              Ativa desde{' '}
              {status.desde
                ? new Date(status.desde).toLocaleDateString('pt-BR')
                : '—'}
              . Restam {status.codigosRestantes} código(s) de recuperação.
            </p>

            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-2">
                <Label htmlFor="codigo-novo">
                  Gerar novos códigos de recuperação
                </Label>
                <Input
                  id="codigo-novo"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="código atual"
                  className="w-40 text-center tracking-widest"
                  value={codigo}
                  onChange={(event) =>
                    setCodigo(event.target.value.replace(/\D/g, ''))
                  }
                />
              </div>

              <Button
                variant="outline"
                disabled={codigo.length !== 6 || novosCodigos.isPending}
                onClick={() => novosCodigos.mutate({ codigo })}
              >
                {novosCodigos.isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Copy className="mr-2 size-4" />
                )}
                Gerar novos
              </Button>
            </div>

            <p className="text-muted-foreground text-xs">
              Os códigos antigos param de valer assim que os novos aparecem.
            </p>

            {/* Desligar existe porque a etapa é uma escolha — e para a conta
                master ela não é, então o botão nem aparece. Pede o código
                atual: se bastasse estar logado, uma sessão esquecida aberta
                derrubaria justamente a proteção contra sessão esquecida. */}
            {!status.obrigatorio && (
              <div className="border-border mt-2 flex flex-col gap-2 border-t pt-4">
                <Label htmlFor="codigo-desligar">
                  Desligar a verificação em duas etapas
                </Label>

                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    id="codigo-desligar"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="código atual"
                    className="w-40 text-center tracking-widest"
                    value={codigoParaDesligar}
                    onChange={(event) =>
                      setCodigoParaDesligar(
                        event.target.value.replace(/\D/g, ''),
                      )
                    }
                  />

                  <Button
                    variant="ghost"
                    className="text-destructive-text"
                    disabled={
                      codigoParaDesligar.length !== 6 || desligar.isPending
                    }
                    onClick={() =>
                      desligar.mutate({ codigo: codigoParaDesligar })
                    }
                  >
                    {desligar.isPending && (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    )}
                    Desligar
                  </Button>
                </div>

                <p className="text-muted-foreground text-xs">
                  {status.recomendado
                    ? 'A sua conta abre os dados de todo mundo. Desligando, só a senha separa alguém de tudo isso.'
                    : 'A entrada volta a pedir só a senha.'}
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
