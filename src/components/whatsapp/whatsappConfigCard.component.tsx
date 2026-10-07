'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import {
  CheckCircle2,
  Loader2,
  Plus,
  QrCode,
  Smartphone,
  Trash2,
  TriangleAlert,
} from 'lucide-react';

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
import ConfirmDeleteDialog from '@/components/confirmDeleteDialog/confirmDeleteDialog.component';
import { EmptyState } from '@/components/emptyState/emptyState.component';
import { LoadingContent } from '@/components/LoadingContent';
import { ProviderMark } from '@/components/whatsapp/providerMark.component';
import {
  formatPhone,
  maskCellphone,
  unmaskCellphone,
} from '@/utils/masksUtils';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/trpc/react';
import { MAX_CONNECTIONS_PER_USER } from '@/common/constants/whatsapp';

/** O que o dono da academia vê: nome, número e um QR. Nada de token. */
interface QrSession {
  id: string;
  qr: string | null;
  pairingCode: string | null;
}

const STATE_LABEL: Record<
  string,
  { label: string; variant: 'success' | 'alert' | 'secondary' }
> = {
  open: { label: 'Conectado', variant: 'success' },
  connecting: { label: 'Aguardando leitura', variant: 'alert' },
  close: { label: 'Desconectado', variant: 'secondary' },
  unknown: { label: 'Sem resposta', variant: 'secondary' },
};

export function WhatsappConfigCard() {
  const { toast } = useToast();
  const utils = api.useUtils();

  const { data: connections, isLoading } =
    api.whatsapp.listConnections.useQuery();

  const [form, setForm] = useState<{
    label: string;
    senderNumber: string;
  } | null>(null);
  const [session, setSession] = useState<QrSession | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const onError = (error: { message: string }) =>
    toast({
      title: 'Não deu certo',
      description: error.message,
      variant: 'destructive',
    });

  const refresh = () => {
    utils.whatsapp.listConnections.invalidate();
    utils.whatsapp.getConfig.invalidate();
  };

  // enquanto o QR está na tela, pergunta ao provedor se já leram
  const state = api.whatsapp.connectionState.useQuery(
    { id: session?.id ?? '' },
    { enabled: Boolean(session), refetchInterval: 3000 },
  );

  /* Derivado, não guardado em estado: setState dentro de efeito dispara
     renderização em cascata, e aqui o dado já vem do próprio polling. */
  const connected = Boolean(session) && state.data?.state === 'open';

  useEffect(() => {
    if (connected) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  const create = api.whatsapp.createConnection.useMutation({
    onSuccess: (result) => {
      setSession({
        id: result.id,
        qr: result.qr,
        pairingCode: result.pairingCode,
      });
      refresh();
    },
    onError,
  });

  const newQr = api.whatsapp.connectionQr.useMutation({
    onSuccess: (result, variables) =>
      setSession({
        id: variables.id,
        qr: result.qr,
        pairingCode: result.pairingCode,
      }),
    onError,
  });

  const activate = api.whatsapp.activateConnection.useMutation({
    onSuccess: () => {
      toast({ title: 'Conexão ativada' });
      refresh();
    },
    onError,
  });

  const remove = api.whatsapp.deleteConnection.useMutation({
    onSuccess: () => {
      toast({ title: 'Número removido' });
      setDeleteId(null);
      refresh();
    },
    onError,
  });

  if (isLoading) {
    return <LoadingContent textLoading="Carregando números..." />;
  }

  /* Um número por academia por enquanto. O servidor recusa de qualquer forma;
     aqui é só para não oferecer um botão que vai dar erro. */
  const atLimit = (connections?.length ?? 0) >= MAX_CONNECTIONS_PER_USER;

  const closeDialog = () => {
    setForm(null);
    setSession(null);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle>Números de WhatsApp</CardTitle>
            <CardDescription>
              Conecte o celular da academia lendo um QR code. Por enquanto é um
              número por academia.
            </CardDescription>
          </div>

          {/* No limite, some: oferecer o botão só para o servidor recusar
              depois é pior que não oferecer. */}
          {!atLimit && (
            <Button onClick={() => setForm({ label: '', senderNumber: '' })}>
              <Plus className="mr-2 size-4" />
              Conectar número
            </Button>
          )}
        </CardHeader>

        <CardContent>
          {!connections || connections.length === 0 ? (
            <EmptyState
              title="Nenhum número conectado"
              description="Sem um número conectado o sistema não manda cobrança, aniversário nem aviso."
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {connections.map((connection) => {
                const status = STATE_LABEL[connection.state ?? 'unknown'];

                return (
                  <li
                    key={connection.id}
                    className="bg-muted/60 flex flex-wrap items-center gap-3 rounded-xl p-3"
                  >
                    <ProviderMark provider={connection.provider} />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">
                          {connection.label || 'Número sem nome'}
                        </p>
                        {connection.isActive && (
                          <Badge variant="success">Em uso</Badge>
                        )}
                        {connection.state && status && (
                          <Badge variant={status.variant}>{status.label}</Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground truncate text-xs">
                        {connection.senderNumber
                          ? formatPhone(connection.senderNumber)
                          : 'sem número'}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      {!connection.isActive && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={activate.isPending}
                          onClick={() => activate.mutate({ id: connection.id })}
                        >
                          <CheckCircle2 className="mr-2 size-4" />
                          Usar este
                        </Button>
                      )}

                      {connection.managed && connection.state !== 'open' && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={newQr.isPending}
                          onClick={() => newQr.mutate({ id: connection.id })}
                        >
                          <QrCode className="mr-2 size-4" />
                          Reconectar
                        </Button>
                      )}

                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive-text"
                        aria-label={`Remover ${connection.label ?? 'número'}`}
                        onClick={() => setDeleteId(connection.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {atLimit && (
            <p className="text-muted-foreground mt-3 text-xs">
              Um número por academia por enquanto. Para trocar, remova o atual e
              conecte outro.
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(form) || Boolean(session)}
        onOpenChange={(open) => !open && closeDialog()}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="size-5" />
              Conectar número
            </DialogTitle>
            <DialogDescription>
              {connected
                ? 'Pronto: as mensagens vão sair por este número.'
                : session
                  ? 'Abra o WhatsApp no celular › Aparelhos conectados › Conectar um aparelho.'
                  : 'Dê um nome para reconhecer o número e informe qual é.'}
            </DialogDescription>
          </DialogHeader>

          {session && connected ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <span className="flex size-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                <CheckCircle2 className="size-7" />
              </span>
              <p className="font-medium">Número conectado</p>
              {state.data?.number && (
                <p className="text-muted-foreground text-sm">
                  {formatPhone(state.data.number)}
                </p>
              )}
            </div>
          ) : session ? (
            <div className="flex flex-col items-center gap-3">
              {session.qr ? (
                /* imagem em base64 do provedor, não de um domínio externo */
                <Image
                  src={session.qr}
                  alt="QR code para conectar o WhatsApp"
                  width={240}
                  height={240}
                  unoptimized
                  className="rounded-xl bg-white p-2"
                />
              ) : (
                <p className="text-muted-foreground text-sm">
                  O servidor não devolveu o código. Tente reconectar.
                </p>
              )}

              {session.pairingCode && (
                <p className="text-sm">
                  Ou digite o código{' '}
                  <span className="font-mono font-semibold">
                    {session.pairingCode}
                  </span>
                </p>
              )}

              <span className="text-muted-foreground flex items-center gap-2 text-xs">
                <Loader2 className="size-3 animate-spin" />
                Aguardando a leitura…
              </span>
            </div>
          ) : (
            form && (
              <div className="flex flex-col gap-4">
                {/* O envio não passa pela API oficial da Meta: é o WhatsApp
                    comum, via leitura de QR. Disparo em massa por aqui pode
                    custar o número, então o aviso vem antes de escolher qual. */}
                <div className="flex gap-3 rounded-xl bg-amber-500/10 p-3 text-amber-900 dark:text-amber-200">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                  <div className="text-xs leading-relaxed">
                    <p className="font-medium">Use um chip só para o sistema</p>
                    <p className="mt-1 text-amber-900/80 dark:text-amber-200/80">
                      Os envios saem pelo WhatsApp comum, não pela API oficial
                      da Meta. Número que dispara cobrança para muita gente pode
                      ser bloqueado pelo próprio WhatsApp — e recuperar não
                      depende de nós.{' '}
                      <strong className="font-medium">
                        Não use o seu número pessoal nem o número principal da
                        academia
                      </strong>
                      : se bloquear, você perde o contato dos alunos junto.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="connection-label">Nome</Label>
                  <Input
                    id="connection-label"
                    value={form.label}
                    onChange={(event) =>
                      setForm({ ...form, label: event.target.value })
                    }
                    placeholder="Ex.: Celular da recepção"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="connection-number">Número</Label>
                  <Input
                    id="connection-number"
                    value={maskCellphone(form.senderNumber)}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        senderNumber: String(
                          unmaskCellphone(event.target.value),
                        ),
                      })
                    }
                    placeholder="(44) 99999-9999"
                    maxLength={15}
                  />
                  <p className="text-muted-foreground text-xs">
                    É o número que vai aparecer para o aluno. Depois da leitura
                    o sistema confirma com o número que realmente conectou.
                  </p>
                </div>
              </div>
            )
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              {session ? 'Fechar' : 'Cancelar'}
            </Button>
            {!session && (
              <Button
                disabled={
                  create.isPending || !form?.label || !form?.senderNumber
                }
                onClick={() => form && create.mutate(form)}
              >
                {create.isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <QrCode className="mr-2 size-4" />
                )}
                Gerar QR code
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {deleteId && (
        <ConfirmDeleteDialog
          item={deleteId}
          open={Boolean(deleteId)}
          onOpenChange={(open) => !open && setDeleteId(null)}
          onConfirm={async (id) => remove.mutate({ id })}
        />
      )}
    </>
  );
}
