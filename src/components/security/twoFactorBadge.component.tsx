import { ShieldAlert, ShieldCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';

/** O que o servidor responde sobre a segunda etapa de alguém. */
export type EstadoDoisFatores =
  'ativo' | 'pendente' | 'recomendado' | 'opcional';

/**
 * A situação da verificação em duas etapas de uma pessoa, em uma etiqueta.
 *
 * A cor segue o que está em jogo, não o quanto queremos insistir. Vermelho só
 * em "pendente", que é o único estado que de fato trava alguém — conta master
 * sem segunda etapa não entra no painel. Dono de academia fica em amarelo,
 * porque é recomendação forte e nada está bloqueado; recepção e professor em
 * cinza. Vermelho no que não bloqueia ensina a ignorar vermelho.
 */
export function TwoFactorBadge({
  estado,
  desde,
}: {
  estado: EstadoDoisFatores;
  desde?: Date | string | null;
}) {
  const ativo = estado === 'ativo';

  return (
    <Badge
      variant={
        ativo
          ? 'success'
          : estado === 'pendente'
            ? 'destructive'
            : estado === 'recomendado'
              ? 'alert'
              : 'secondary'
      }
      title={
        desde
          ? `Ativa desde ${new Date(desde).toLocaleDateString('pt-BR')}`
          : undefined
      }
      className="gap-1"
    >
      {ativo ? (
        <ShieldCheck className="size-3" aria-hidden />
      ) : (
        <ShieldAlert className="size-3" aria-hidden />
      )}
      {ativo
        ? '2FA ativo'
        : estado === 'pendente'
          ? '2FA pendente'
          : estado === 'recomendado'
            ? '2FA recomendado'
            : 'sem 2FA'}
    </Badge>
  );
}
