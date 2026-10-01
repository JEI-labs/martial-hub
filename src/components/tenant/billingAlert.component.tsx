'use client';

import Link from 'next/link';
import { AlertTriangle, CalendarClock, CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { api } from '@/trpc/react';
import { maskBRL } from '@/utils/masksUtils';

/**
 * A mensalidade do sistema, no painel da academia.
 *
 * A tarja do topo avisa quando o vencimento está perto; aqui o dono vê a
 * situação mesmo quando ainda falta tempo — é o lugar onde ele abre todo dia,
 * e conta a pagar que ninguém vê é conta que atrasa.
 */
export function BillingAlert() {
  const { data } = api.tenant.getBilling.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  if (!data) return null;

  const emAberto = data.faturas.filter(
    (fatura) => fatura.status === 'OPEN' || fatura.status === 'OVERDUE',
  );

  /* Nada em aberto é uma boa notícia curta: uma linha, sem cartão de alerta
     ocupando o topo do painel. */
  if (emAberto.length === 0) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <CheckCircle2 className="size-4 text-green-600" aria-hidden />
        Mensalidade do sistema em dia.
      </div>
    );
  }

  const proxima = [...emAberto].sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
  )[0]!;

  const atrasada = proxima.status === 'OVERDUE';
  const dias = Math.round(
    (new Date(proxima.dueDate).setHours(0, 0, 0, 0) -
      new Date().setHours(0, 0, 0, 0)) /
      86400000,
  );

  const total = emAberto.reduce((soma, f) => soma + f.amountCents, 0) / 100;

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border px-5 py-4',
        atrasada
          ? 'border-destructive/40 bg-destructive/10'
          : 'border-alert/40 bg-alert/10',
      )}
    >
      <span
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-full',
          atrasada
            ? 'bg-destructive/15 text-destructive-text'
            : 'bg-alert/20 text-alert',
        )}
      >
        {atrasada ? (
          <AlertTriangle className="size-5" aria-hidden />
        ) : (
          <CalendarClock className="size-5" aria-hidden />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {atrasada
            ? `Mensalidade do sistema atrasada há ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'dia' : 'dias'}`
            : dias === 0
              ? 'Mensalidade do sistema vence hoje'
              : `Mensalidade do sistema vence em ${dias} ${dias === 1 ? 'dia' : 'dias'}`}
        </p>
        <p className="text-muted-foreground text-sm">
          {emAberto.length > 1
            ? `${emAberto.length} faturas em aberto, somando ${maskBRL(total, true)}.`
            : `${maskBRL(proxima.amountCents / 100, true)} · vencimento em ${new Date(proxima.dueDate).toLocaleDateString('pt-BR')}.`}
          {atrasada && ' O acesso ao sistema pode ser suspenso.'}
        </p>
      </div>

      <Button variant={atrasada ? 'default' : 'outline'} asChild>
        <Link href="/configuracoes?aba=assinatura">Ver fatura</Link>
      </Button>
    </div>
  );
}
