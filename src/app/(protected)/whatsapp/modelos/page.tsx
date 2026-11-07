'use client';

import { BreadcrumbUpdater } from '@/contexts/breadcrumb';
import { MessageTemplatesCard } from '@/components/whatsapp/messageTemplatesCard.component';
import { PageIntro } from '@/components/pageIntro/pageIntro.component';
import { MessageSquareText } from 'lucide-react';

const breadcrumbItems = [
  { label: 'Home', href: '/painel' },
  { label: 'WhatsApp', href: '/whatsapp' },
  { label: 'Modelos', href: '/whatsapp/modelos' },
];

export default function WhatsappTemplatesPage() {
  return (
    <>
      <BreadcrumbUpdater items={breadcrumbItems} />

      <div className="flex flex-col gap-4">
        <PageIntro icon={MessageSquareText} title="Modelos">
          O texto pronto de cada situação.
        </PageIntro>

        <MessageTemplatesCard />
      </div>
    </>
  );
}
