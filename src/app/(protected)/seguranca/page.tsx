'use client';

import { ShieldCheck } from 'lucide-react';

import { BreadcrumbUpdater } from '@/contexts/breadcrumb';
import { PageIntro } from '@/components/pageIntro/pageIntro.component';
import { TwoFactorCard } from '@/components/security/twoFactorCard.component';

const breadcrumbItems = [
  { label: 'Home', href: '/painel' },
  { label: 'Segurança', href: '/seguranca' },
];

export default function SegurancaPage() {
  return (
    <div className="w-full">
      <BreadcrumbUpdater items={breadcrumbItems} />

      <main className="flex flex-col gap-4">
        <PageIntro icon={ShieldCheck} title="Segurança">
          Uma segunda chave além da senha.
        </PageIntro>

        <TwoFactorCard />
      </main>
    </div>
  );
}
