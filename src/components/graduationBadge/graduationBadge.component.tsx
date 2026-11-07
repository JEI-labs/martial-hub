import { cn } from '@/lib/utils';

/** O que é preciso de uma faixa para desenhá-la, venha de onde vier. */
export interface GraduationView {
  name: string;
  level: string | null;
  /** Cores de cima para baixo, em hex — vêm do banco. */
  colors: Array<string>;
  /** Ordem dentro da modalidade, a partir de 0. */
  position: number;
  modality?: { name: string } | null;
}

/** "4º grau · Intermediário": a ordem da faixa e o nível, quando houver. */
export function descreverGraduacao(graduation: GraduationView): string {
  const grau = `${graduation.position + 1}º grau`;
  return graduation.level ? `${grau} · ${graduation.level}` : grau;
}

interface GraduationBadgeProps {
  graduation?: GraduationView | null;
  /** Mostra o nome ao lado da fita. */
  showLabel?: boolean;
  className?: string;
}

/**
 * A faixa desenhada: as cores empilhadas, como na tabela de graduações. Uma
 * bolinha colorida não daria conta das faixas de duas ou três cores, que são
 * a maioria.
 */
export function GraduationBadge({
  graduation,
  showLabel = true,
  className,
}: GraduationBadgeProps) {
  if (!graduation) {
    return <span className="text-muted-foreground text-sm">—</span>;
  }

  const descricao = descreverGraduacao(graduation);
  const titulo = [graduation.modality?.name, descricao, graduation.name]
    .filter(Boolean)
    .join(' · ');

  return (
    <span className={cn('flex items-center gap-2', className)}>
      <span
        className="border-border flex h-5 w-10 shrink-0 flex-col overflow-hidden rounded-sm border"
        title={titulo}
        aria-hidden
      >
        {graduation.colors.map((color, index) => (
          <span
            key={`${color}-${index}`}
            className="w-full flex-1"
            style={{ backgroundColor: color }}
          />
        ))}
      </span>

      {showLabel && (
        <span className="min-w-0">
          <span className="block truncate text-sm">{graduation.name}</span>
          <span className="text-muted-foreground block text-xs">
            {descricao}
          </span>
        </span>
      )}
    </span>
  );
}
