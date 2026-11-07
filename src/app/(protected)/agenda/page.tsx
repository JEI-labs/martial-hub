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
        <PageIntro icon={CalendarClock} title="Agenda">
          Aulas particulares e horários bloqueados. O que for pago entra no
          caixa.
        </PageIntro>

        <AgendaView />
      </main>
    </div>
  );
}
