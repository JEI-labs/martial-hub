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
        <PageIntro
          icon={Bot}
          title="O que são mensagens automáticas?"
          example="Lembrete 3 dias antes do vencimento, a partir das 9h: todo aluno com parcela vencendo naquele dia recebe o texto do modelo escolhido."
        >
          São os envios que o sistema faz sozinho, sem ninguém clicar. Você liga
          a situação, escolhe o texto e a partir de quando pode disparar — cada
          aluno recebe no máximo uma mensagem por dia de cada tipo.
        </PageIntro>

        <AutomationsCard />
      </div>
    </>
  );
}
