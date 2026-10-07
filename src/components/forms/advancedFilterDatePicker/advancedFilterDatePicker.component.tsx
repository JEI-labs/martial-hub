'use client';

import { useResetOnChange } from '@/hooks/useResetOnChange/useResetOnChange.hook';
import * as React from 'react';

import { CalendarDays, Check, Trash2 } from 'lucide-react';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import {
  DropdownMenuLabel,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type {
  AdvancedFilterDatePickerProps,
  AdvancedFilterDatePickerType,
} from './advancedFilterDatePicker.types';
import { useBoolean } from '@/hooks/useBooleanState/useBooleanState.hook';
import moment from 'moment-timezone';
import { DefaultCalendar } from '@/components/ui/default-calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

moment.locale('pt-br');

/**
 * Atalhos de período. Devolvem datas cruas — `handleFormatDate` normaliza
 * início/fim do dia no fuso de São Paulo, igual à seleção pelo calendário.
 */
export const DATE_PRESETS: Array<{
  label: string;
  getRange: () => { from: Date; to: Date };
}> = [
  {
    label: 'Hoje',
    getRange: () => ({ from: moment().toDate(), to: moment().toDate() }),
  },
  {
    label: 'Ontem',
    getRange: () => ({
      from: moment().subtract(1, 'day').toDate(),
      to: moment().subtract(1, 'day').toDate(),
    }),
  },
  {
    label: 'Últimos 7 dias',
    getRange: () => ({
      from: moment().subtract(6, 'days').toDate(),
      to: moment().toDate(),
    }),
  },
  {
    label: 'Últimos 30 dias',
    getRange: () => ({
      from: moment().subtract(29, 'days').toDate(),
      to: moment().toDate(),
    }),
  },
  {
    label: 'Este mês',
    getRange: () => ({
      from: moment().startOf('month').toDate(),
      to: moment().endOf('month').toDate(),
    }),
  },
  { label: 'Últimos 3 meses', getRange: () => lastMonths(3) },
  { label: 'Últimos 6 meses', getRange: () => lastMonths(6) },
  { label: 'Últimos 12 meses', getRange: () => lastMonths(12) },
];

/**
 * Conta o mês corrente: "últimos 12 meses" vai do dia 1 de onze meses atrás
 * até hoje, o que dá doze meses fechados no gráfico. Sem o `startOf`, sobrava
 * um mês pela metade na ponta e o painel desenhava treze colunas.
 */
function lastMonths(months: number): { from: Date; to: Date } {
  return {
    from: moment()
      .subtract(months - 1, 'months')
      .startOf('month')
      .toDate(),
    to: moment().toDate(),
  };
}

/** Um ano até hoje — o padrão do painel. */
export function getLastYearRange(): { from: Date; to: Date } {
  return lastMonths(12);
}

/** Período padrão das telas com filtro de data. */
export const getDefaultDateRange = (): { from: Date; to: Date } => ({
  from: moment().subtract(29, 'days').startOf('day').toDate(),
  to: moment().endOf('day').toDate(),
});

const toKey = (date?: Date) => (date ? moment(date).format('YYYY-MM-DD') : '');

/** Sem intervalo escolhido, o filtro não está filtrando nada. */
export const ALL_DATES_LABEL = 'Todas as datas';

/**
 * Rótulo do botão: nome do atalho quando o intervalo bate com um deles,
 * senão as datas mesmo — assim dá para saber o que está sendo puxado sem
 * abrir o menu. Sem intervalo, diz "Todas as datas" em vez do título da
 * tela: o botão mostra o estado do filtro, não o nome dele.
 */
const describeRange = (
  range: AdvancedFilterDatePickerType | undefined,
  fallback: string,
): string => {
  if (!range?.from && !range?.to) return ALL_DATES_LABEL;

  const preset = DATE_PRESETS.find((item) => {
    const candidate = item.getRange();
    return (
      toKey(candidate.from) === toKey(range?.from) &&
      toKey(candidate.to) === toKey(range?.to)
    );
  });
  if (preset) return preset.label;

  const from = range?.from ? moment(range.from).format('DD/MM/YY') : '';
  const to = range?.to ? moment(range.to).format('DD/MM/YY') : '';
  if (from && to) return from === to ? from : `${from} – ${to}`;
  return from || to || fallback;
};

/**
 * Texto da prévia dentro do diálogo: sozinho, o calendário não diz o que já
 * foi clicado — quem escolhe o primeiro dia e rola o mês se perde.
 */
const describeDraft = (range: AdvancedFilterDatePickerType | undefined) => {
  const from = range?.from ? moment(range.from).format('DD/MM/YYYY') : null;
  const to = range?.to ? moment(range.to).format('DD/MM/YYYY') : null;

  if (!from) return 'Clique no primeiro dia do período';
  if (!to || from === to) return `De ${from} — agora escolha o último dia`;

  const days = moment(range?.to).diff(moment(range?.from), 'days') + 1;
  return `${from} até ${to} · ${days} ${days === 1 ? 'dia' : 'dias'}`;
};

export function AdvancedFilterDatePicker({
  showDeleteButton = true,
  ...props
}: Readonly<AdvancedFilterDatePickerProps>): React.JSX.Element {
  const open = useBoolean(props.open);
  const [date, setDate] = React.useState<
    AdvancedFilterDatePickerType | undefined
  >(
    props.defaultValue ?? {
      from: undefined,
      to: undefined,
    },
  );

  const handleFormatDate = (
    date?: AdvancedFilterDatePickerType,
  ): AdvancedFilterDatePickerType => {
    const formattedDate: AdvancedFilterDatePickerType = {
      from: date?.from,
      to: date?.to,
    };

    if (date?.from && date.to) {
      formattedDate.from = moment(date.from)
        .tz('America/Sao_Paulo')
        .startOf('day')
        .toDate();
      formattedDate.to = moment(date.to)
        .tz('America/Sao_Paulo')
        .endOf('day')
        .toDate();
    } else if (date?.from) {
      formattedDate.from = moment(date.from)
        .tz('America/Sao_Paulo')
        .startOf('day')
        .toDate();
      formattedDate.to = moment(date.from)
        .tz('America/Sao_Paulo')
        .endOf('day')
        .toDate();
    }

    return formattedDate;
  };

  const handleChangeDate = (date: AdvancedFilterDatePickerType | undefined) => {
    const formattedDate = handleFormatDate(date);
    setDate(formattedDate);

    if (props.onChange) {
      props.onChange(formattedDate);
    }
  };

  // Sincroniza com a prop durante o render em vez de num efeito, que
  // confirmaria a data velha na tela antes de corrigi-la.
  useResetOnChange([props.defaultValue], () => {
    const formattedDate = handleFormatDate(props.defaultValue);

    setDate({
      from: formattedDate.from ? formattedDate.from : undefined,
      to: formattedDate.to ? formattedDate.to : undefined,
    });
  });

  /* O calendário sai do menu e vai para um diálogo: dentro do dropdown ele
     disputava largura com a lista e ficava cortado. */
  const [customOpen, setCustomOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<
    AdvancedFilterDatePickerType | undefined
  >(date);

  const apply = (range: AdvancedFilterDatePickerType | undefined) => {
    handleChangeDate(range);
    open.actions.setValue(false);
  };

  const currentLabel = describeRange(date, props.title);

  return (
    <>
      <DropdownMenu open={open.value} onOpenChange={open.actions.setValue}>
        <DropdownMenuTrigger asChild>
          <Button className="gap-2" variant="outline" {...props.buttonProps}>
            {props.leftIcon}
            {currentLabel}
            {props.rightIcon}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-64">
          <div className="flex items-center justify-between">
            <DropdownMenuLabel>
              {props?.description ?? props.title}
            </DropdownMenuLabel>
            {showDeleteButton && (
              <Button variant="ghost" size="icon" onClick={props.onDelete}>
                <Trash2 size={16} />
              </Button>
            )}
          </div>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onSelect={() => apply({ from: undefined, to: undefined })}
          >
            <span className="flex-1">{ALL_DATES_LABEL}</span>
            {currentLabel === ALL_DATES_LABEL && (
              <Check className="size-4" aria-hidden />
            )}
          </DropdownMenuItem>

          {DATE_PRESETS.map((preset) => (
            <DropdownMenuItem
              key={preset.label}
              onSelect={() => apply(preset.getRange())}
            >
              <span className="flex-1">{preset.label}</span>
              {currentLabel === preset.label && (
                <Check className="size-4" aria-hidden />
              )}
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onSelect={() => {
              // o menu fecha e o diálogo assume
              setDraft(date);
              setCustomOpen(true);
            }}
          >
            <span className="flex-1">Personalizado…</span>
            <CalendarDays className="size-4" aria-hidden />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={customOpen} onOpenChange={setCustomOpen}>
        <DialogContent className="w-auto max-w-fit">
          <DialogHeader>
            <DialogTitle>Escolher período</DialogTitle>
            <DialogDescription>
              Clique no primeiro dia e depois no último.
            </DialogDescription>
          </DialogHeader>

          <DefaultCalendar
            mode="range"
            selected={draft}
            onSelect={setDraft}
            numberOfMonths={props.numberOfMonths ?? 2}
            locale={ptBR}
          />

          <div className="bg-muted rounded-xl px-3 py-2 text-center text-sm">
            {describeDraft(draft)}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomOpen(false)}>
              Cancelar
            </Button>
            <Button
              /* só com as duas pontas escolhidas o intervalo faz sentido */
              disabled={!draft?.from || !draft?.to}
              onClick={() => {
                apply(draft);
                setCustomOpen(false);
              }}
            >
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
