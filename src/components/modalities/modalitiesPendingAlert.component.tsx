'use client';

import Link from 'next/link';
import { Layers } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { api } from '@/trpc/react';

/**
 * Aviso de modalidades pendentes, no painel da academia.
 *
 * Academia criada sem modalidade escolhida nasce assim de propósito — melhor
 * do que chutar uma que ela talvez nem ensine. O aviso fica no lugar que o
 * dono abre todo dia e some sozinho na primeira modalidade cadastrada.
 */
export function ModalitiesPendingAlert({
  podeCadastrar,
}: {
  /** Só o dono cadastra; os outros ficam sabendo a quem pedir. */
  podeCadastrar: boolean;
}) {
  const { data } = api.modalities.list.useQuery(undefined, {
    staleTime: 60_000,
  });

  /* Enquanto carrega não há o que dizer: avisar antes de saber faria o
     cartão piscar para quem já tem modalidade. */
  if (!data || data.length > 0) return null;

  return (
    <div className="border-alert/40 bg-alert/10 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border px-5 py-4">
      <span className="bg-alert/20 text-alert flex size-10 shrink-0 items-center justify-center rounded-full">
        <Layers className="size-5" aria-hidden />
      </span>

      <div className="min-w-0 flex-1">
        <p className="font-medium">Modalidades pendentes</p>
        <p className="text-muted-foreground text-sm">
          {podeCadastrar
            ? 'Cadastre o que a academia ensina — Muay Thai, Jiu-Jitsu, Boxe ou outra. É o primeiro passo para matricular alunos.'
            : 'A academia ainda não cadastrou o que ensina. Peça ao dono para cadastrar as modalidades.'}
        </p>
      </div>

      {podeCadastrar && (
        <Button asChild>
          <Link href="/cadastros/modalidades">Cadastrar modalidades</Link>
        </Button>
      )}
    </div>
  );
}
