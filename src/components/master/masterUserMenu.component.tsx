'use client';

import Link from 'next/link';
import { LogOut, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { sairDaConta } from '@/utils/sair';

/**
 * Conta do master no cabeçalho.
 *
 * O "Sair" tem que ser client-side: a página de signout do NextAuth confirma
 * o logout contra `NEXTAUTH_URL`, que aponta para o endereço de uma academia —
 * o master clicava, era levado para outro host e voltava ainda logado, porque
 * o cookie do host dele nunca era apagado. Ver `sairDaConta`.
 */
export function MasterUserMenu({ nome }: { nome: string }) {
  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/master/seguranca">
          <ShieldCheck className="mr-2 size-4" />
          Segurança
        </Link>
      </Button>

      <span className="text-muted-foreground hidden text-sm sm:inline">
        {nome}
      </span>

      <Button variant="ghost" size="sm" onClick={() => sairDaConta()}>
        <LogOut className="mr-2 size-4" />
        Sair
      </Button>
    </div>
  );
}
