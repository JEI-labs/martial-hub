'use client';

import { Children, useState } from 'react';

import Link from 'next/link';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Cake,
  CalendarClock,
  MessageCircle,
  TriangleAlert,
} from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { maskBRL } from '@/utils/masksUtils';
import { cn } from '@/lib/utils';
import type { RouterOutputs } from '@/trpc/react';

type Alerts = RouterOutputs['dashboard']['getOverview']['alerts'];

/** Quantos itens aparecem antes do "ver todas". */
const PREVIEW_SIZE = 3;

function ListCard({
  title,
  description,
  icon: Icon,
  empty,
  children,
  isEmpty,
}: {
  title: string;
  description: string;
  icon: typeof Cake;
  empty: string;
  isEmpty: boolean;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);

  /* Expande no próprio card em vez de mandar para outra tela: o destino
     seria a lista de alunos sem o filtro que trouxe estas pessoas para cá. */
  const items = Children.toArray(children);
  const visible = expanded ? items : items.slice(0, PREVIEW_SIZE);
  const hidden = items.length - visible.length;

  return (
    <Card className="min-w-0">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Icon className="text-muted-foreground size-4" />
              {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>

          {items.length > PREVIEW_SIZE && (
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0"
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? 'Ver menos' : `Ver todas (${items.length})`}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {isEmpty ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            {empty}
          </p>
        ) : (
          <>
            <ul className="flex flex-col gap-2">{visible}</ul>
            {hidden > 0 && (
              <p className="text-muted-foreground mt-2 text-center text-xs">
                e mais {hidden}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function TopOverdueList({
  students,
}: {
  students: Alerts['topOverdue'];
}) {
  return (
    <ListCard
      title="Maiores inadimplências"
      description="Quem concentra o valor vencido"
      icon={TriangleAlert}
      isEmpty={students.length === 0}
      empty="Ninguém com parcela vencida."
    >
      {students.map((student) => (
        <li
          key={student.id}
          className="bg-muted/60 flex items-center justify-between gap-3 rounded-xl p-3"
        >
          <div className="min-w-0">
            <Link
              href={`/alunos/${student.id}`}
              className="hover:text-primary block truncate text-sm font-medium transition-colors"
            >
              {student.name}
            </Link>
            <p className="text-muted-foreground text-xs">
              {student.installments} parcela(s) · {student.daysLate} dias de
              atraso
            </p>
          </div>
          <span className="text-sm font-semibold whitespace-nowrap text-rose-600 dark:text-rose-400">
            {maskBRL(student.amount, true)}
          </span>
        </li>
      ))}
    </ListCard>
  );
}

export function ExpiringEnrollmentsList({
  enrollments,
}: {
  enrollments: Alerts['expiringEnrollments'];
}) {
  return (
    <ListCard
      title="Matrículas vencendo"
      description="Próximos 30 dias — hora de puxar a renovação"
      icon={CalendarClock}
      isEmpty={enrollments.length === 0}
      empty="Nenhuma matrícula vence nos próximos 30 dias."
    >
      {enrollments.map((enrollment) => (
        <li
          key={enrollment.id}
          className="bg-muted/60 flex items-center justify-between gap-3 rounded-xl p-3"
        >
          <div className="min-w-0">
            <Link
              href={`/alunos/${enrollment.studentId}`}
              className="hover:text-primary block truncate text-sm font-medium transition-colors"
            >
              {enrollment.studentName}
            </Link>
            <p className="text-muted-foreground text-xs">
              {enrollment.planName}
            </p>
          </div>
          <Badge
            variant={enrollment.daysLeft <= 7 ? 'destructive' : 'secondary'}
          >
            {enrollment.daysLeft === 0
              ? 'vence hoje'
              : `${enrollment.daysLeft} dia(s)`}
          </Badge>
        </li>
      ))}
    </ListCard>
  );
}

export function BirthdaysList({
  birthdays,
}: {
  birthdays: Alerts['birthdays'];
}) {
  const today = new Date();
  const currentDay = today.getDate();
  const month = format(today, 'MMM', { locale: ptBR }).replace('.', '');

  return (
    <ListCard
      title="Aniversariantes do mês"
      description="Boa desculpa para uma mensagem no WhatsApp"
      icon={Cake}
      isEmpty={birthdays.length === 0}
      empty="Nenhum aniversário neste mês."
    >
      {birthdays.map((student) => {
        const isToday = student.day === currentDay;
        const passed = student.day < currentDay;

        return (
          <li
            key={student.id}
            className="bg-muted/60 flex items-center gap-3 rounded-xl p-3"
          >
            {/* o dia vira uma folhinha de calendário: bate o olho e acha */}
            <span
              className={cn(
                'flex size-10 shrink-0 flex-col items-center justify-center rounded-xl leading-none',
                isToday
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground',
                passed && 'opacity-50',
              )}
            >
              <span className="text-sm font-semibold">
                {String(student.day).padStart(2, '0')}
              </span>
              <span className="mt-0.5 text-[10px] uppercase">{month}</span>
            </span>

            <Link
              href={`/alunos/${student.id}`}
              className={cn(
                'hover:text-primary min-w-0 flex-1 truncate text-sm font-medium transition-colors',
                passed && 'text-muted-foreground',
              )}
            >
              {student.name}
            </Link>

            {isToday && <Badge variant="success">hoje</Badge>}
          </li>
        );
      })}
    </ListCard>
  );
}

export function MessagesCard({ messages }: { messages: Alerts['messages'] }) {
  const total = messages.sent + messages.failed;
  const rate = total > 0 ? (messages.sent / total) * 100 : 0;

  return (
    <Card className="min-w-0">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageCircle className="text-muted-foreground size-4" />
          WhatsApp
        </CardTitle>
        <CardDescription>Envios dos últimos 30 dias</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-6">
        <div>
          <p className="text-2xl font-semibold">{messages.sent}</p>
          <p className="text-muted-foreground text-xs">entregues</p>
        </div>
        <div>
          <p className="text-2xl font-semibold text-rose-600 dark:text-rose-400">
            {messages.failed}
          </p>
          <p className="text-muted-foreground text-xs">falhas</p>
        </div>
        <div>
          <p className="text-2xl font-semibold">
            {total > 0 ? `${rate.toFixed(0)}%` : '—'}
          </p>
          <p className="text-muted-foreground text-xs">taxa de entrega</p>
        </div>
      </CardContent>
    </Card>
  );
}
