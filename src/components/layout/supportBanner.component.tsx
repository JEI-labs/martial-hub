import Link from 'next/link';
import { LifeBuoy } from 'lucide-react';

/**
 * Tarja do acesso de suporte. Existe para ninguém esquecer onde está: é o
 * sistema de um cliente, com os dados dele, e o que for mexido aqui é mexido
 * de verdade.
 */
export function SupportBanner({ tenantName }: { tenantName: string }) {
  return (
    <div className="bg-alert text-alert-foreground sticky top-0 z-20 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-sm md:-mx-8">
      <LifeBuoy className="size-4 shrink-0" aria-hidden />
      <span>
        Acesso de suporte · você está dentro de{' '}
        <strong className="font-semibold">{tenantName}</strong>
      </span>
      <Link href="/suporte/sair" className="font-semibold underline">
        Sair do suporte
      </Link>
    </div>
  );
}
