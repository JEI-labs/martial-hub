'use client';

import { BreadcrumbUpdater } from '@/contexts/breadcrumb';
import { MessageHistory } from '@/components/whatsapp/messageHistory.component';

const breadcrumbItems = [
  { label: 'Home', href: '/painel' },
  { label: 'WhatsApp', href: '/whatsapp' },
  { label: 'Histórico', href: '/whatsapp/historico' },
];

export default function WhatsappHistoryPage() {
  return (
    <>
      <BreadcrumbUpdater items={breadcrumbItems} />
      <MessageHistory />
    </>
  );
}
