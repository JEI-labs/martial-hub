'use client';

import { MoreHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface RowAction {
  label: string;
  icon?: React.ElementType;
  onSelect: () => void;
  /** Destaca em vermelho e separa do resto do menu. */
  destructive?: boolean;
  disabled?: boolean;
}

interface RowActionsProps {
  actions: Array<RowAction>;
  /** Lido por leitores de tela, já que o gatilho é só um ícone. */
  srLabel?: string;
}

/**
 * Coluna de ações das tabelas: um gatilho só, com as ações da linha dentro.
 */
export function RowActions({
  actions,
  srLabel = 'Abrir ações',
}: RowActionsProps) {
  const regular = actions.filter((action) => !action.destructive);
  const destructive = actions.filter((action) => action.destructive);

  if (actions.length === 0) return null;

  const renderItem = (action: RowAction) => {
    const Icon = action.icon;

    return (
      <DropdownMenuItem
        key={action.label}
        disabled={action.disabled}
        onSelect={action.onSelect}
        className={
          action.destructive
            ? 'text-destructive-text focus:text-destructive-text'
            : undefined
        }
      >
        {Icon ? <Icon className="mr-2 h-4 w-4" /> : null}
        {action.label}
      </DropdownMenuItem>
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">{srLabel}</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-48">
        {regular.map(renderItem)}
        {destructive.length > 0 && regular.length > 0 ? (
          <DropdownMenuSeparator />
        ) : null}
        {destructive.map(renderItem)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
