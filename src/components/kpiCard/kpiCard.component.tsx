import type { LucideIcon } from 'lucide-react';
import { TrendingDown, TrendingUp } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  /** Linha de apoio: a conta por trás do número, ou o recorte de tempo. */
  hint?: string;
  trend?: {
    value: number;
    label: string;
    /** Em churn e inadimplência, subir é ruim. */
    higherIsBetter?: boolean;
  };
  tone?: 'default' | 'positive' | 'negative';
}

const TONE = {
  default: 'text-foreground',
  positive: 'text-emerald-600 dark:text-emerald-400',
  negative: 'text-rose-600 dark:text-rose-400',
} as const;

export function KpiCard({
  label,
  value,
  icon: Icon,
  hint,
  trend,
  tone = 'default',
}: KpiCardProps) {
  const higherIsBetter = trend?.higherIsBetter ?? true;
  const isGood = trend ? trend.value >= 0 === higherIsBetter : true;
  const TrendIcon = (trend?.value ?? 0) >= 0 ? TrendingUp : TrendingDown;

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <span className="text-muted-foreground text-sm">{label}</span>
          {/* ícone num chip, como nos cartões da referência */}
          <span className="bg-muted/70 text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-xl">
            <Icon className="size-4" />
          </span>
        </div>

        <span
          className={cn('text-2xl font-semibold tracking-tight', TONE[tone])}
        >
          {value}
        </span>

        <div className="flex min-h-5 flex-wrap items-center gap-2">
          {trend && (
            <span
              className={cn(
                'inline-flex items-center gap-1 text-xs font-medium',
                isGood
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400',
              )}
            >
              <TrendIcon className="size-3.5" />
              {trend.value > 0 ? '+' : ''}
              {trend.value.toFixed(0)}% {trend.label}
            </span>
          )}
          {hint && (
            <span className="text-muted-foreground text-xs">{hint}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
