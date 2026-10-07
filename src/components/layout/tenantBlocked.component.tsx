import { ShieldAlert } from 'lucide-react';

/**
 * Academia sem acesso. Não é erro de senha nem tela quebrada, então diz o que
 * é e para quem falar — quem está na recepção não tem como adivinhar que o
 * problema é de contrato.
 */
export function TenantBlocked({
  tenantName,
  porFatura,
}: {
  tenantName: string;
  /** Bloqueio por fatura em atraso tem conserto conhecido; diga qual. */
  porFatura?: boolean;
}) {
  return (
    <div className="bg-background flex min-h-screen w-full items-center justify-center p-6">
      <div className="bg-card shadow-card flex max-w-md flex-col items-center gap-4 rounded-2xl px-8 py-10 text-center">
        <span className="bg-muted text-muted-foreground flex size-14 items-center justify-center rounded-full">
          <ShieldAlert className="size-7" aria-hidden />
        </span>

        <div className="space-y-2">
          <h1 className="text-xl font-semibold">Acesso suspenso</h1>
          <p className="text-muted-foreground text-sm">
            {porFatura
              ? `O acesso da ${tenantName} foi bloqueado por mensalidade em atraso. Os dados continuam guardados: assim que o pagamento for confirmado, tudo volta como estava, no mesmo lugar.`
              : `O sistema da ${tenantName} está temporariamente sem acesso. Os dados continuam guardados — assim que a situação for regularizada, tudo volta como estava.`}
          </p>
        </div>

        <p className="text-muted-foreground text-xs">
          {porFatura
            ? 'Combine o pagamento com quem cuida do sistema para liberar.'
            : 'Fale com quem cuida do sistema para liberar.'}
        </p>
      </div>
    </div>
  );
}
