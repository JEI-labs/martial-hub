import { ShieldAlert, ShieldCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';

/** O que o servidor responde sobre a segunda etapa de alguém. */
export type EstadoDoisFatores = 'ativo' | 'pendente' | 'opcional';

/**
 * A situação da verificação em duas etapas de uma pessoa, em uma etiqueta.
 *
 * "Pendente" é vermelho porque quem é obrigado e não configurou está parado
 * na parede, sem usar o sistema. "Sem 2FA" é cinza: para recepção e
 * professor a etapa é opcional, e pintar isso de vermelho seria alarme falso.
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
        ativo ? 'success' : estado === 'pendente' ? 'destructive' : 'secondary'
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
      {ativo ? '2FA ativo' : estado === 'pendente' ? '2FA pendente' : 'sem 2FA'}
    </Badge>
  );
}
