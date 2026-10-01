'use client';

import { MastersCard } from '@/components/master/mastersCard.component';

export default function MasterEquipe() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Equipe do sistema</h1>
        <p className="text-muted-foreground text-sm">
          Quem administra o MartialHub. Cada uma destas contas abre todas as
          academias de uma vez.
        </p>
      </div>

      <MastersCard />
    </div>
  );
}
