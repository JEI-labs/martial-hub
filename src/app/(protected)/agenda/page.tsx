'use client';

import { CalendarClock } from 'lucide-react';

import { BreadcrumbUpdater } from '@/contexts/breadcrumb';
import { PageIntro } from '@/components/pageIntro/pageIntro.component';
import { AgendaView } from '@/components/agenda/agendaView.component';

const breadcrumbItems = [
  { label: 'Home', href: '/painel' },
  { label: 'Agenda', href: '/agenda' },
];

export default function AgendaPage() {
  return (
    <div className="w-full">
      <BreadcrumbUpdater items={breadcrumbItems} />

      <main className="flex flex-col gap-4">
        <PageIntro
          icon={CalendarClock}
          title="Os seus horários"
          example={
            <>
              Clique num espaço vazio da grade para marcar. Aula que se repete
              toda semana é uma marcação só — e dá para desmarcar uma semana sem
              derrubar as outras.
            </>
          }
        >
          Aula particular, avaliação, horário bloqueado. O valor de cada aula
          entra no caixa da academia por uma categoria separada da mensalidade.
        </PageIntro>

        <AgendaView />
      </main>
    </div>
  );
}
