'use client';

import { TwoFactorCard } from '@/components/security/twoFactorCard.component';

export default function MasterSeguranca() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Segurança</h1>
        <p className="text-muted-foreground text-sm">
          A sua conta abre todas as academias do sistema. A segunda etapa é o
          que separa isso de uma senha vazada.
        </p>
      </div>

      <TwoFactorCard />
    </div>
  );
}
