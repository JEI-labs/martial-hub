import { ShieldAlert } from 'lucide-react';

import { TwoFactorCard } from '@/components/security/twoFactorCard.component';

/**
 * A parede: quem é obrigado a ter verificação em duas etapas e ainda não
 * configurou não passa daqui.
 *
 * É uma tela e não um redirecionamento porque o layout não sabe em que rota a
 * pessoa está — e porque bloquear no lugar onde ela já está, com a
 * configuração logo abaixo, é mais curto do que mandá-la para outro endereço.
 */
export function TwoFactorRequired({ nome }: { nome: string }) {
  return (
    <div className="bg-background flex min-h-screen w-full justify-center p-6">
      <div className="flex w-full max-w-2xl flex-col gap-6 py-10">
        <div className="flex items-start gap-4">
          <span className="bg-muted text-destructive-text flex size-12 shrink-0 items-center justify-center rounded-full">
            <ShieldAlert className="size-6" aria-hidden />
          </span>

          <div>
            <h1 className="text-xl font-semibold">
              Configure a verificação em duas etapas
            </h1>
            <p className="text-muted-foreground text-sm">
              {nome}, o seu acesso abre os dados de todo mundo — alunos,
              pagamentos, mensagens. Por isso ele exige uma segunda etapa além
              da senha. Leva um minuto, e depois o sistema segue normal.
            </p>
          </div>
        </div>

        <TwoFactorCard />
      </div>
    </div>
  );
}
