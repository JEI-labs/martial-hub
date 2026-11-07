'use client';

import { addDays, isSameDay, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { format } from 'date-fns';

import { cn } from '@/lib/utils';
import {
  ALTURA_HORA,
  HORA_FINAL,
  HORA_INICIAL,
  type Aula,
} from '@/components/agenda/agenda.types';

/** As horas desenhadas à esquerda, de HORA_INICIAL a HORA_FINAL. */
const HORAS = Array.from(
  { length: HORA_FINAL - HORA_INICIAL + 1 },
  (_, i) => HORA_INICIAL + i,
);

/** Onde a aula começa e quanto ocupa, em pixels, dentro da coluna do dia. */
function posicao(aula: Aula) {
  const inicio = new Date(aula.inicio);
  const fim = new Date(aula.fim);

  const minutosDoTopo =
    (inicio.getHours() - HORA_INICIAL) * 60 + inicio.getMinutes();
  const duracao = Math.max(
    (fim.getTime() - inicio.getTime()) / 60000,
    /* Aula de 15 minutos vira uma tira ilegível; o mínimo é o que cabe o
       horário e um nome. */
    30,
  );

  return {
    top: (minutosDoTopo / 60) * ALTURA_HORA,
    height: (duracao / 60) * ALTURA_HORA,
  };
}

/**
 * Aulas que se cruzam dividem a largura da coluna, como no Google Agenda.
 *
 * Sem isto, duas aulas no mesmo horário ficariam uma por cima da outra e a de
 * baixo sumiria — que é justamente o conflito que a pessoa precisa enxergar.
 */
function distribuir(aulas: Array<Aula>) {
  const ordenadas = [...aulas].sort(
    (a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime(),
  );

  const colunas: Array<Array<Aula>> = [];

  for (const aula of ordenadas) {
    const inicio = new Date(aula.inicio).getTime();
    const coluna = colunas.find(
      (c) => new Date(c[c.length - 1]!.fim).getTime() <= inicio,
    );

    if (coluna) coluna.push(aula);
    else colunas.push([aula]);
  }

  return ordenadas.map((aula) => {
    const indice = colunas.findIndex((c) => c.includes(aula));
    return { aula, indice, total: colunas.length };
  });
}

interface Props {
  dias: Array<Date>;
  aulas: Array<Aula>;
  onAbrir: (_aula: Aula) => void;
  onNovo: (_quando: Date) => void;
}

export function GradeSemana({ dias, aulas, onAbrir, onNovo }: Props) {
  const altura = HORAS.length * ALTURA_HORA;

  return (
    <div className="flex flex-col">
      {/* Cabeçalho dos dias, grudado no topo ao rolar */}
      <div
        className="bg-card sticky top-0 z-10 grid border-b"
        style={{ gridTemplateColumns: `3.5rem repeat(${dias.length}, 1fr)` }}
      >
        <div />
        {dias.map((dia) => (
          <div key={dia.toISOString()} className="px-2 py-2 text-center">
            <p className="text-muted-foreground text-xs capitalize">
              {format(dia, 'EEE', { locale: ptBR })}
            </p>
            <p
              className={cn(
                'mx-auto flex size-8 items-center justify-center rounded-full text-sm font-medium',
                isToday(dia) && 'bg-primary text-primary-foreground',
              )}
            >
              {format(dia, 'd')}
            </p>
          </div>
        ))}
      </div>

      <div
        className="grid"
        style={{ gridTemplateColumns: `3.5rem repeat(${dias.length}, 1fr)` }}
      >
        {/* Régua de horas */}
        <div className="relative" style={{ height: altura }}>
          {HORAS.map((hora, i) => (
            <span
              key={hora}
              className="text-muted-foreground absolute right-2 -translate-y-1/2 text-[11px]"
              style={{ top: i * ALTURA_HORA }}
            >
              {i === 0 ? '' : `${String(hora).padStart(2, '0')}:00`}
            </span>
          ))}
        </div>

        {dias.map((dia) => {
          const doDia = aulas.filter((a) => isSameDay(new Date(a.inicio), dia));

          return (
            <div
              key={dia.toISOString()}
              className="relative border-l"
              style={{ height: altura }}
            >
              {/* Faixas de hora: servem de linha-guia e de alvo de clique */}
              {HORAS.map((hora, i) => (
                <button
                  key={hora}
                  type="button"
                  aria-label={`Marcar às ${hora}:00`}
                  onClick={() => {
                    const quando = new Date(dia);
                    quando.setHours(hora, 0, 0, 0);
                    onNovo(quando);
                  }}
                  className="hover:bg-muted/50 absolute w-full border-t transition-colors"
                  style={{ top: i * ALTURA_HORA, height: ALTURA_HORA }}
                />
              ))}

              {distribuir(doDia).map(({ aula, indice, total }) => {
                const { top, height } = posicao(aula);
                const largura = 100 / total;

                return (
                  <button
                    key={`${aula.appointmentId}-${new Date(aula.inicio).toISOString()}`}
                    type="button"
                    onClick={() => onAbrir(aula)}
                    style={{
                      top,
                      height,
                      left: `${indice * largura}%`,
                      width: `calc(${largura}% - 4px)`,
                    }}
                    className={cn(
                      'absolute overflow-hidden rounded-lg border-l-4 px-2 py-1 text-left text-xs transition-colors',
                      aula.pagoEm
                        ? 'border-l-green-500 bg-green-500/15 hover:bg-green-500/25'
                        : 'border-l-primary bg-primary/15 hover:bg-primary/25',
                    )}
                  >
                    <span className="block truncate font-medium">
                      {format(new Date(aula.inicio), 'HH:mm')}{' '}
                      {aula.title ?? aula.tipo?.name ?? 'Aula'}
                    </span>
                    {aula.alunos.length > 0 && (
                      <span className="text-muted-foreground block truncate">
                        {aula.alunos.map((a) => a.name).join(', ')}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Os dias de uma semana a partir do domingo que contém `data`. */
export function diasDaSemana(inicio: Date): Array<Date> {
  return Array.from({ length: 7 }, (_, i) => addDays(inicio, i));
}
