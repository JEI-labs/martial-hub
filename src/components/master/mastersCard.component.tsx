'use client';

import { useState } from 'react';
import { UserPlus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TwoFactorBadge } from '@/components/security/twoFactorBadge.component';
import { NewMasterDialog } from '@/components/master/newMasterDialog.component';
import { api } from '@/trpc/react';

export function MastersCard() {
  const { data: masters, isLoading } = api.master.listMasters.useQuery();
  const [criando, setCriando] = useState(false);

  return (
    <Card>
      <CardHeader className="flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>Contas master</CardTitle>
          <CardDescription>
            Todas enxergam o mesmo: clientes, faturas e a entrada de suporte em
            qualquer academia. Não há nível intermediário.
          </CardDescription>
        </div>

        <Button className="shrink-0" onClick={() => setCriando(true)}>
          <UserPlus className="mr-2 size-4" />
          Adicionar master
        </Button>
      </CardHeader>

      <CardContent className="flex flex-col gap-2">
        {isLoading
          ? [0, 1].map((i) => <Skeleton key={i} className="h-16 w-full" />)
          : masters?.map((master) => (
              <div
                key={master.id}
                className="bg-muted/60 flex flex-wrap items-center gap-3 rounded-xl p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {master.name}
                    {master.souEu && (
                      <span className="text-muted-foreground ml-2 text-xs">
                        (você)
                      </span>
                    )}
                  </p>
                  <p className="text-muted-foreground truncate text-sm">
                    {master.email}
                  </p>
                </div>

                <span className="text-muted-foreground text-xs">
                  desde {new Date(master.createdAt).toLocaleDateString('pt-BR')}
                </span>

                {/* Enquanto não entra, a senha temporária segue valendo onde
                    quer que tenha sido mandada — vale a pena saber quem está
                    nessa situação. */}
                {master.primeiroAcessoPendente && (
                  <Badge
                    variant="alert"
                    title="Ainda está com a senha temporária"
                  >
                    Aguardando primeiro acesso
                  </Badge>
                )}

                <TwoFactorBadge
                  estado={master.doisFatores}
                  desde={master.doisFatoresDesde}
                />
              </div>
            ))}
      </CardContent>

      <NewMasterDialog open={criando} onOpenChange={setCriando} />
    </Card>
  );
}
