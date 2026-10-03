'use client';

import { useMemo, useState } from 'react';
import { EUserRole } from '@prisma/client';
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useSession } from 'next-auth/react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/trpc/react';
import { AulaModal } from '@/components/agenda/aulaModal.component';
import { GradeMes } from '@/components/agenda/gradeMes.component';
import {
  GradeSemana,
  diasDaSemana,
} from '@/components/agenda/gradeSemana.component';
import type { Aula, Visao } from '@/components/agenda/agenda.types';

/** Valor do select que quer dizer "sem filtro". */
const TODOS = 'todos';

export function AgendaView() {
  const { data: session } = useSession();
  const souDono = session?.user.role !== EUserRole.TEACHER;

  const [visao, setVisao] = useState<Visao>('semana');
  const [referencia, setReferencia] = useState(() => startOfDay(new Date()));
  const [professor, setProfessor] = useState<string>(TODOS);

  const [aulaAberta, setAulaAberta] = useState<Aula | null>(null);
  const [horarioNovo, setHorarioNovo] = useState<Date | null>(null);
  const [modalAberto, setModalAberto] = useState(false);

  /* A janela pedida ao servidor é a da visão atual. O mês pega semanas
     inteiras nas pontas porque a grade mostra os dias vizinhos. */
  const { de, ate, dias } = useMemo(() => {
    if (visao === 'dia') {
      return {
        de: startOfDay(referencia),
        ate: addDays(startOfDay(referencia), 1),
        dias: [startOfDay(referencia)],
      };
    }

    if (visao === 'semana') {
      const inicio = startOfWeek(referencia, { locale: ptBR });
      return {
        de: inicio,
        ate: addDays(inicio, 7),
        dias: diasDaSemana(inicio),
      };
    }

    return {
      de: startOfWeek(startOfMonth(referencia), { locale: ptBR }),
      ate: addDays(endOfWeek(endOfMonth(referencia), { locale: ptBR }), 1),
      dias: [],
    };
  }, [visao, referencia]);

  const { data: aulas, isLoading } = api.agenda.list.useQuery({
    de,
    ate,
    teacherId: souDono && professor !== TODOS ? professor : undefined,
  });

  const { data: professores } = api.agenda.teachers.useQuery(undefined, {
    enabled: souDono,
  });

  const utils = api.useUtils();
  const recarregar = () => utils.agenda.list.invalidate();

  const andar = (passo: number) => {
    if (visao === 'mes') setReferencia((d) => addMonths(d, passo));
    else setReferencia((d) => addDays(d, visao === 'dia' ? passo : passo * 7));
  };

  const abrirAula = (aula: Aula) => {
    setAulaAberta(aula);
    setHorarioNovo(null);
    setModalAberto(true);
  };

  const abrirNovo = (quando: Date) => {
    setAulaAberta(null);
    setHorarioNovo(quando);
    setModalAberto(true);
  };

  const titulo =
    visao === 'mes'
      ? format(referencia, "MMMM 'de' yyyy", { locale: ptBR })
      : visao === 'dia'
        ? format(referencia, "EEEE, d 'de' MMMM", { locale: ptBR })
        : `${format(dias[0]!, 'd MMM', { locale: ptBR })} – ${format(dias[6]!, "d MMM 'de' yyyy", { locale: ptBR })}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Anterior"
            onClick={() => andar(-1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Próximo"
            onClick={() => andar(1)}
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button
            variant="outline"
            onClick={() => setReferencia(startOfDay(new Date()))}
          >
            Hoje
          </Button>

          {/* first-letter e não capitalize: "27 set – 3 out de 2026" vira
              "De 2026" com capitalize, que maiusculiza toda palavra. */}
          <h2 className="ml-2 text-lg font-semibold first-letter:uppercase">
            {titulo}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {souDono && (
            <Select value={professor} onValueChange={setProfessor}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos os professores</SelectItem>
                {professores?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Tabs value={visao} onValueChange={(v) => setVisao(v as Visao)}>
            <TabsList>
              <TabsTrigger value="dia">Dia</TabsTrigger>
              <TabsTrigger value="semana">Semana</TabsTrigger>
              <TabsTrigger value="mes">Mês</TabsTrigger>
            </TabsList>
          </Tabs>

          <Button onClick={() => abrirNovo(proximaHoraCheia())}>
            <Plus className="mr-2 size-4" />
            Marcar
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        {isLoading ? (
          <Skeleton className="h-[600px] w-full" />
        ) : visao === 'mes' ? (
          <GradeMes
            mes={referencia}
            aulas={aulas ?? []}
            onAbrir={abrirAula}
            onDia={(dia) => {
              setReferencia(dia);
              setVisao('dia');
            }}
          />
        ) : (
          /* A grade rola dentro do cartão: a página inteira rolando faria o
             cabeçalho dos dias sumir junto. */
          <div className="max-h-[70vh] overflow-y-auto">
            <GradeSemana
              dias={dias}
              aulas={aulas ?? []}
              onAbrir={abrirAula}
              onNovo={abrirNovo}
            />
          </div>
        )}
      </Card>

      {!isLoading && (aulas?.length ?? 0) === 0 && (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <CalendarDays className="size-4" aria-hidden />
          Nenhum horário neste período. Clique em um espaço da grade para
          marcar.
        </p>
      )}

      <AulaModal
        aberto={modalAberto}
        onOpenChange={setModalAberto}
        aula={aulaAberta}
        quando={horarioNovo}
        podeEscolherProfessor={souDono}
        onMudou={recarregar}
      />
    </div>
  );
}

/** A próxima hora cheia, que é onde quase todo agendamento começa. */
function proximaHoraCheia(): Date {
  const agora = new Date();
  agora.setHours(agora.getHours() + 1, 0, 0, 0);
  return agora;
}
