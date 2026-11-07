'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, KeyRound, Loader2, LogOut } from 'lucide-react';

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
import { useToast } from '@/hooks/use-toast';
import { sairDaConta } from '@/utils/sair';
import { api } from '@/trpc/react';

/**
 * Primeiro acesso de uma conta criada por outra pessoa: a senha temporária
 * não passa daqui.
 *
 * Vem antes da parede do 2FA, no mesmo layout. Terminada a troca, o refresh
 * faz o servidor desenhar o passo seguinte — a configuração da segunda etapa
 * — sem a pessoa precisar sair e entrar de novo.
 */
export function PasswordChangeRequired({ nome }: { nome: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [nova, setNova] = useState('');
  const [confirma, setConfirma] = useState('');

  const definir = api.security.setInitialPassword.useMutation({
    onSuccess: () => {
      toast({
        title: 'Senha definida',
        description: 'Agora falta a verificação em duas etapas.',
      });
      router.refresh();
    },
    onError: (error) =>
      toast({
        title: 'Não deu para trocar',
        description: error.message,
        variant: 'destructive',
      }),
  });

  const confere = nova.length >= 8 && nova === confirma;

  return (
    <div className="bg-background flex min-h-screen w-full justify-center p-6">
      <div className="flex w-full max-w-2xl flex-col gap-6 py-10">
        <div className="flex items-start gap-4">
          <span className="bg-muted text-alert flex size-12 shrink-0 items-center justify-center rounded-full">
            <KeyRound className="size-6" aria-hidden />
          </span>

          <div>
            <h1 className="text-xl font-semibold">Defina a sua senha</h1>
            <p className="text-muted-foreground text-sm">
              {nome}, você entrou com uma senha temporária — quem criou a sua
              conta também a viu. Escolha uma só sua. Em seguida, o sistema pede
              a verificação em duas etapas.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Passo 1 de 2 · Senha nova</CardTitle>
            <CardDescription>
              Pelo menos oito letras, diferente da temporária.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (confere) definir.mutate({ nova });
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="senha-inicial">Senha nova</Label>
                  <Input
                    id="senha-inicial"
                    type="password"
                    autoComplete="new-password"
                    autoFocus
                    value={nova}
                    onChange={(event) => setNova(event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="senha-inicial-confirma">Repita a senha</Label>
                  <Input
                    id="senha-inicial-confirma"
                    type="password"
                    autoComplete="new-password"
                    value={confirma}
                    onChange={(event) => setConfirma(event.target.value)}
                  />
                </div>
              </div>

              {confirma.length > 0 && !confere && (
                <p className="text-destructive-text text-xs">
                  {nova.length < 8
                    ? 'A senha nova precisa de pelo menos oito letras.'
                    : 'As duas não batem.'}
                </p>
              )}

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={definir.isPending || definir.isSuccess || !confere}
                >
                  {definir.isPending || definir.isSuccess ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : null}
                  Continuar
                  <ArrowRight className="ml-2 size-4" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* A mesma saída da parede do 2FA: enquanto a senha não muda, não
            há tela do sistema para onde voltar. */}
        <div className="flex justify-end">
          <Button
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => sairDaConta()}
          >
            <LogOut className="mr-2 size-4" />
            Sair da conta
          </Button>
        </div>
      </div>
    </div>
  );
}
