'use client';

import { Bot } from 'lucide-react';

import { BreadcrumbUpdater } from '@/contexts/breadcrumb';
import { AutomationsCard } from '@/components/whatsapp/automationsCard.component';
import { PageIntro } from '@/components/pageIntro/pageIntro.component';

const breadcrumbItems = [
  { label: 'Home', href: '/painel' },
  { label: 'WhatsApp', href: '/whatsapp' },
  { label: 'Automáticas', href: '/whatsapp/automacoes' },
];

export default function WhatsappAutomationsPage() {
  return (
    <>
      <BreadcrumbUpdater items={breadcrumbItems} />

      <div className="flex flex-col gap-4">
        <PageIntro icon={Bot} title="Mensagens automáticas">
          Envios que o sistema faz sozinho, sem ninguém clicar.
        </PageIntro>

        <AutomationsCard />
      </div>
    </>
  );
}
