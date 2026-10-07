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
        <PageIntro
          icon={Plug}
          title="O que é uma conexão?"
          example="Celular da recepção — (44) 99999-9999, em uso."
        >
          É o número de WhatsApp por onde as mensagens saem. Conecte lendo o QR
          code com o celular da academia, como no WhatsApp Web. Dá para ter mais
          de um, mas só o ativo envia.
        </PageIntro>

        <WhatsappConfigCard />
      </div>
    </>
  );
}
