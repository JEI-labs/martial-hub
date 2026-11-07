import { EAppointmentRecurrence } from '@prisma/client';

/**
 * Uma aula de verdade, com data e hora, tirada de uma série.
 *
 * Série semanal não vira linha no banco por semana: a linha é a série, e as
 * aulas saem daqui na hora de listar. Materializar obrigaria a escolher até
 * quando o futuro vai, e a reescrever tudo quando o horário mudasse.
 */
export interface Ocorrencia {
  appointmentId: string;
  inicio: Date;
  fim: Date;
  /** O dia da aula à meia-noite: é a chave que liga à decisão daquela data. */
  data: Date;
}

export interface SerieParaExpandir {
  id: string;
  startsAt: Date;
  endsAt: Date;
  recurrence: EAppointmentRecurrence;
  repeatUntil: Date | null;
}

const UMA_SEMANA = 7 * 24 * 60 * 60 * 1000;

/** Meia-noite do dia, no mesmo fuso em que a data foi construída. */
export function diaDe(data: Date): Date {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate());
}

/**
 * As aulas de uma série dentro de uma janela.
 *
 * `de` e `ate` são inclusivos nas pontas: uma aula que começa antes de `ate` e
 * termina depois entra, senão a aula das 23h sumiria da semana.
 */
export function expandirSerie(
  serie: SerieParaExpandir,
  de: Date,
  ate: Date,
): Array<Ocorrencia> {
  const duracao = serie.endsAt.getTime() - serie.startsAt.getTime();

  const montar = (inicio: Date): Ocorrencia => ({
    appointmentId: serie.id,
    inicio,
    fim: new Date(inicio.getTime() + duracao),
    data: diaDe(inicio),
  });

  if (serie.recurrence === EAppointmentRecurrence.NONE) {
    const dentro =
      serie.startsAt < ate && serie.startsAt.getTime() + duracao > de.getTime();
    return dentro ? [montar(serie.startsAt)] : [];
  }

  /* O fim da série pode ser antes do fim da janela pedida. */
  const limite =
    serie.repeatUntil && serie.repeatUntil < ate ? serie.repeatUntil : ate;
  if (limite < serie.startsAt) return [];

  /* Pular direto para a primeira semana visível em vez de andar de sete em
     sete desde o começo: uma série de dois anos atrás custaria cem voltas
     para devolver as aulas desta semana. */
  const atraso = de.getTime() - (serie.startsAt.getTime() + duracao);
  const semanasPuladas = atraso > 0 ? Math.floor(atraso / UMA_SEMANA) : 0;

  const ocorrencias: Array<Ocorrencia> = [];
  /* Datas somadas em milissegundos: o Brasil não tem horário de verão desde
     2019, então a semana tem sempre 168 horas. */
  let inicio = new Date(serie.startsAt.getTime() + semanasPuladas * UMA_SEMANA);

  while (inicio <= limite) {
    if (inicio.getTime() + duracao > de.getTime())
      ocorrencias.push(montar(inicio));
    inicio = new Date(inicio.getTime() + UMA_SEMANA);
  }

  return ocorrencias;
}
