'use client';

import { BreadcrumbUpdater } from '@/contexts/breadcrumb';
import { WhatsappConfigCard } from '@/components/whatsapp/whatsappConfigCard.component';
import { PageIntro } from '@/components/pageIntro/pageIntro.component';
import { Plug } from 'lucide-react';

const breadcrumbItems = [
  { label: 'Home', href: '/painel' },
  { label: 'WhatsApp', href: '/whatsapp' },
  { label: 'Conexão', href: '/whatsapp/conexao' },
];

export default function WhatsappConnectionPage() {
  return (
    <>
      <BreadcrumbUpdater items={breadcrumbItems} />

      <div className="flex flex-col gap-4">
        <PageIntro icon={Plug} title="Conexão">
          O número de WhatsApp por onde as mensagens saem.
        </PageIntro>

        <WhatsappConfigCard />
      </div>
    </>
  );
}
