'use client';

import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { cn } from '@/lib/utils';
import type { Aula } from '@/components/agenda/agenda.types';

/** Quantas aulas cabem numa célula antes de virar "e mais N". */
const CABEM = 3;

interface Props {
  mes: Date;
  aulas: Array<Aula>;
  onAbrir: (_aula: Aula) => void;
  onDia: (_dia: Date) => void;
}

/**
 * O mês inteiro, para enxergar carga e buracos.
 *
 * Sem horário nas células de propósito: num mês não cabe grade de horas, e
 * tentar seria ilegível. Quem quer o horário clica no dia e cai na visão dele.
 */
export function GradeMes({ mes, aulas, onAbrir, onDia }: Props) {
  const dias = eachDayOfInterval({
    start: startOfWeek(startOfMonth(mes), { locale: ptBR }),
    end: endOfWeek(endOfMonth(mes), { locale: ptBR }),
  });

  return (
    <div className="flex flex-col">
      <div className="grid grid-cols-7 border-b">
        {dias.slice(0, 7).map((dia) => (
          <div
            key={dia.toISOString()}
            className="text-muted-foreground px-2 py-2 text-center text-xs capitalize"
          >
            {format(dia, 'EEE', { locale: ptBR })}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {dias.map((dia) => {
          const doDia = aulas
            .filter((a) => isSameDay(new Date(a.inicio), dia))
            .sort(
              (a, b) =>
                new Date(a.inicio).getTime() - new Date(b.inicio).getTime(),
            );

          return (
            <div
              key={dia.toISOString()}
              className={cn(
                'min-h-28 border-r border-b p-1',
                !isSameMonth(dia, mes) && 'bg-muted/30',
              )}
            >
              <button
                type="button"
                onClick={() => onDia(dia)}
                className={cn(
                  'mb-1 flex size-6 items-center justify-center rounded-full text-xs transition-colors',
                  isToday(dia)
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'hover:bg-muted text-muted-foreground',
                )}
              >
                {format(dia, 'd')}
              </button>

              <div className="flex flex-col gap-0.5">
                {doDia.slice(0, CABEM).map((aula) => (
                  <button
                    key={`${aula.appointmentId}-${new Date(aula.inicio).toISOString()}`}
                    type="button"
                    onClick={() => onAbrir(aula)}
                    className={cn(
                      'truncate rounded px-1 py-0.5 text-left text-[11px] transition-colors',
                      aula.pagoEm
                        ? 'bg-green-500/15 hover:bg-green-500/25'
                        : 'bg-primary/15 hover:bg-primary/25',
                    )}
                  >
                    {format(new Date(aula.inicio), 'HH:mm')}{' '}
                    {aula.alunos[0]?.name ??
                      aula.title ??
                      aula.tipo?.name ??
                      'Aula'}
                  </button>
                ))}

                {doDia.length > CABEM && (
                  <button
                    type="button"
                    onClick={() => onDia(dia)}
                    className="text-muted-foreground hover:text-foreground px-1 text-left text-[11px]"
                  >
                    e mais {doDia.length - CABEM}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
