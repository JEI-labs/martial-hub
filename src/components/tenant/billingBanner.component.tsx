'use client';

import Link from 'next/link';
import { AlertTriangle, CalendarClock } from 'lucide-react';

import { cn } from '@/lib/utils';
import { api } from '@/trpc/react';
import { maskBRL } from '@/utils/masksUtils';

/**
 * Aviso da mensalidade do sistema, dentro do sistema.
 *
 * Cobrança que só existe no painel de quem cobra vira corte de acesso sem
 * aviso. Aqui o dono da academia vê o vencimento chegando no lugar onde ele
 * já está todo dia — e some sozinho assim que a fatura é baixada.
 */
export function BillingBanner() {
  const { data } = api.tenant.getBilling.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  const aviso = data?.aviso;
  if (!aviso) return null;

  const dias = aviso.diasRestantes;
  const atrasada = aviso.atrasada;
  const bloqueioProximo = aviso.fase === 'bloqueio_proximo';

  /* Três recados, em ordem de gravidade. O último é o único que fala em
     bloqueio, e fala com data: "vai ser bloqueado" sem prazo não muda o
     comportamento de ninguém. */
  const texto = bloqueioProximo
    ? aviso.diasParaBloqueio > 0
      ? `Mensalidade atrasada há ${Math.abs(dias)} dias. O acesso ao sistema será bloqueado em ${aviso.diasParaBloqueio} ${aviso.diasParaBloqueio === 1 ? 'dia' : 'dias'}.`
      : 'Mensalidade atrasada. O acesso ao sistema será bloqueado hoje.'
    : atrasada
      ? `Sua mensalidade do sistema venceu ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'dia' : 'dias'} atrás.`
      : dias === 0
        ? 'Sua mensalidade do sistema vence hoje.'
        : `Sua mensalidade do sistema vence em ${dias} ${dias === 1 ? 'dia' : 'dias'}.`;

  const Icone = atrasada ? AlertTriangle : CalendarClock;

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-sm',
        '-mx-4 md:-mx-8',
        atrasada
          ? 'bg-destructive text-destructive-foreground'
          : 'bg-alert text-alert-foreground',
        /* Na véspera do bloqueio a tarja pulsa: é o último aviso antes de a
           academia perder o acesso. */
        bloqueioProximo && 'animate-pulse font-medium',
      )}
    >
      <Icone className="size-4 shrink-0" aria-hidden />
      <span>
        {texto} {maskBRL(aviso.valor, true)}
        {' · '}
        {new Date(aviso.dueDate).toLocaleDateString('pt-BR')}
      </span>
      <Link
        href="/configuracoes?aba=assinatura"
        className="font-semibold underline"
      >
        Ver fatura
      </Link>
    </div>
  );
}
