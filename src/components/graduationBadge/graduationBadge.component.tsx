import type { EGraduation } from '@prisma/client';

import { GRADUATIONS } from '@/common/constants/graduations';
import { cn } from '@/lib/utils';

interface GraduationBadgeProps {
  graduation?: EGraduation | null;
  /** Mostra o nome ao lado da fita. */
  showLabel?: boolean;
  className?: string;
}

/**
 * Fita do Kruang-Prajied: as faixas de cor empilhadas, como na tabela de
 * graduações. Uma bolinha colorida não daria conta dos graus de duas ou três
 * cores, que são a maioria.
 */
export function GraduationBadge({
  graduation,
  showLabel = true,
  className,
}: GraduationBadgeProps) {
  if (!graduation) {
    return <span className="text-muted-foreground text-sm">—</span>;
  }

  const info = GRADUATIONS[graduation];

  return (
    <span className={cn('flex items-center gap-2', className)}>
      <span
        className="border-border flex h-5 w-10 shrink-0 flex-col overflow-hidden rounded-sm border"
        title={`${info.degree}º grau · ${info.label}`}
        aria-hidden
      >
        {info.colors.map((color) => (
          <span
            key={color}
            className="w-full flex-1"
            style={{ backgroundColor: color }}
          />
        ))}
      </span>

      {showLabel && (
        <span className="min-w-0">
          <span className="block truncate text-sm">{info.label}</span>
          <span className="text-muted-foreground block text-xs">
            {info.degree}º grau · {info.level}
          </span>
        </span>
      )}
    </span>
  );
}
