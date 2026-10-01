'use client';

import { Bell, LayoutDashboard, Users, Wallet } from 'lucide-react';

import { cn } from '@/lib/utils';
import { buildTenantPalette, paletteToStyle } from '@/utils/tenantPalette';

/**
 * Como o sistema fica com a cor escolhida, nos dois temas, lado a lado.
 *
 * É uma miniatura do layout de verdade — barra lateral com item ativo,
 * cabeçalho, cartão de número e tabela — usando as mesmas classes do sistema.
 * As variáveis vão no `style` do bloco, então a prévia muda sem mexer no tema
 * de quem está olhando.
 */
export function ThemePreview({
  primaryColor,
}: {
  primaryColor?: string | null;
}) {
  const paleta = buildTenantPalette(primaryColor);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Miniatura
        titulo="Tema claro"
        style={paleta ? paletteToStyle(paleta.light) : undefined}
      />
      <Miniatura
        titulo="Tema escuro"
        style={paleta ? paletteToStyle(paleta.dark) : undefined}
        escuro
      />
    </div>
  );
}

function Miniatura({
  titulo,
  style,
  escuro,
}: {
  titulo: string;
  style?: React.CSSProperties;
  escuro?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-muted-foreground text-xs">{titulo}</span>

      {/* `dark` na miniatura e não no documento: o bloco inteiro é desenhado
          com as variáveis do tema escuro mesmo que a pessoa esteja no claro. */}
      <div
        style={style}
        className={cn(
          'border-border overflow-hidden rounded-2xl border',
          escuro && 'dark',
        )}
      >
        <div className="bg-background flex h-56">
          <aside className="bg-sidebar flex w-28 shrink-0 flex-col gap-1 p-2">
            <div className="bg-sidebar-accent mb-2 h-6 rounded-md" />

            <ItemMenu icone={LayoutDashboard} rotulo="Painel" ativo />
            <ItemMenu icone={Users} rotulo="Alunos" />
            <ItemMenu icone={Wallet} rotulo="Financeiro" />
          </aside>

          <div className="flex min-w-0 flex-1 flex-col gap-2 p-2">
            <header className="bg-card flex items-center justify-between rounded-lg px-2 py-1.5">
              <div className="bg-muted h-2 w-16 rounded-full" />
              <Bell className="text-muted-foreground size-3" />
            </header>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-card flex flex-col gap-1 rounded-lg p-2">
                <span className="text-muted-foreground text-[8px]">MRR</span>
                <span className="text-foreground text-xs font-semibold">
                  R$ 4.350
                </span>
              </div>
              <div className="bg-card flex flex-col gap-1 rounded-lg p-2">
                <span className="text-muted-foreground text-[8px]">Alunos</span>
                <span className="text-foreground text-xs font-semibold">
                  29
                </span>
              </div>
            </div>

            <div className="bg-card flex flex-1 flex-col gap-1.5 rounded-lg p-2">
              <div className="flex items-center justify-between">
                <div className="bg-muted h-1.5 w-12 rounded-full" />
                <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-[8px] font-medium">
                  Novo
                </span>
              </div>

              {[0, 1, 2].map((linha) => (
                <div key={linha} className="flex items-center gap-2">
                  <div className="bg-muted size-3 rounded-full" />
                  <div className="bg-muted h-1.5 flex-1 rounded-full" />
                  <div className="bg-primary/20 h-1.5 w-6 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ItemMenu({
  icone: Icone,
  rotulo,
  ativo,
}: {
  icone: React.ElementType;
  rotulo: string;
  ativo?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-full px-2 py-1 text-[9px]',
        ativo
          ? 'bg-sidebar-primary/80 text-sidebar-primary-foreground'
          : 'text-sidebar-foreground',
      )}
    >
      <Icone className="size-2.5" />
      {rotulo}
    </div>
  );
}
