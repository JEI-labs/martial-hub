'use client';

import { useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';

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
import { api } from '@/trpc/react';

/** Trocar a própria senha, pedindo a atual. */
export function PasswordCard() {
  const { toast } = useToast();
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirma, setConfirma] = useState('');

  const trocar = api.security.changePassword.useMutation({
    onSuccess: () => {
      setAtual('');
      setNova('');
      setConfirma('');
      toast({
        title: 'Senha trocada',
        description: 'A próxima entrada já usa a senha nova.',
      });
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
    <Card>
      <CardHeader className="flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>Senha</CardTitle>
          <CardDescription>
            Pelo menos oito letras. A senha atual é pedida para que uma sessão
            esquecida aberta não vire uma conta perdida.
          </CardDescription>
        </div>

        <span className="text-muted-foreground">
          <KeyRound className="size-8" aria-hidden />
        </span>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="senha-atual">Senha atual</Label>
            <Input
              id="senha-atual"
              type="password"
              autoComplete="current-password"
              value={atual}
              onChange={(event) => setAtual(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="senha-nova">Senha nova</Label>
            <Input
              id="senha-nova"
              type="password"
              autoComplete="new-password"
              value={nova}
              onChange={(event) => setNova(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="senha-confirma">Repita a nova</Label>
            <Input
              id="senha-confirma"
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
            disabled={trocar.isPending || atual.length === 0 || !confere}
            onClick={() => trocar.mutate({ atual, nova })}
          >
            {trocar.isPending && (
              <Loader2 className="mr-2 size-4 animate-spin" />
            )}
            Trocar senha
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
