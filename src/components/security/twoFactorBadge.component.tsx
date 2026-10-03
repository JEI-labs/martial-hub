import { ShieldAlert, ShieldCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';

/** O que o servidor responde sobre a segunda etapa de alguém. */
export type EstadoDoisFatores = 'ativo' | 'recomendado' | 'opcional';

/**
 * A situação da verificação em duas etapas de uma pessoa, em uma etiqueta.
 *
 * "Recomendada" é amarelo, não vermelho: ninguém está impedido de trabalhar
 * por causa disso, e pintar de vermelho o que não bloqueia ensina a ignorar
 * vermelho. Para recepção e professor fica cinza, que é o tom de quem pode
 * decidir sem pressa.
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
        ativo ? 'success' : estado === 'recomendado' ? 'alert' : 'secondary'
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
        : estado === 'recomendado'
          ? '2FA recomendado'
          : 'sem 2FA'}
    </Badge>
  );
}
