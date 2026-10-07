'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TwoFactorBadge } from '@/components/security/twoFactorBadge.component';
import { api } from '@/trpc/react';

export function MastersCard() {
  const { data: masters, isLoading } = api.master.listMasters.useQuery();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contas master</CardTitle>
        <CardDescription>
          Todas enxergam o mesmo: clientes, faturas e a entrada de suporte em
          qualquer academia. Não há nível intermediário.
        </CardDescription>
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

                <TwoFactorBadge
                  estado={master.doisFatores}
                  desde={master.doisFatoresDesde}
                />
              </div>
            ))}
      </CardContent>
    </Card>
  );
}
