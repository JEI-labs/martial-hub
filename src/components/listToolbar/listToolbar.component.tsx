'use client';

import Search from '@/components/Search';
import { cn } from '@/lib/utils';

interface ListToolbarProps {
  searchPlaceholder: string;
  onSearch: (_value: string) => void;
  /** Chips de filtro da tela. */
  filters?: React.ReactNode;
  /** Ação principal, normalmente o botão de criar. */
  action?: React.ReactNode;
  /** Total de registros, mostrado discretamente. */
  total?: number;
  /** Rótulo no singular e plural, ex.: ['aluno', 'alunos']. */
  totalLabel?: [string, string];
  className?: string;
}

/**
 * Barra única de busca + filtros + ação, repetida em todas as listagens.
 * O título saía sobrando porque o breadcrumb já diz onde se está.
 */
export function ListToolbar({
  searchPlaceholder,
  onSearch,
  filters,
  action,
  total,
  totalLabel = ['registro', 'registros'],
  className,
}: ListToolbarProps) {
  const hasTotal = typeof total === 'number';

  return (
    <div className={cn('mt-4 flex flex-col gap-3', className)}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Search
          className="w-full lg:max-w-xs"
          placeholder={searchPlaceholder}
          onSearch={onSearch}
        />

        {filters && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground text-sm font-medium">
              Filtros
            </span>
            {filters}
          </div>
        )}

        {/* empurra total e ação para a direita a partir de lg; abaixo disso
            a ação ocupa a linha inteira */}
        <div className="flex items-center justify-between gap-3 lg:ml-auto lg:justify-end">
          {hasTotal && (
            <span className="text-muted-foreground text-sm whitespace-nowrap">
              {total} {total === 1 ? totalLabel[0] : totalLabel[1]}
            </span>
          )}
          {action}
        </div>
      </div>
    </div>
  );
}
