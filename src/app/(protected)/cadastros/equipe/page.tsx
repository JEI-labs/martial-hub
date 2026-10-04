'use client';

import { Users } from 'lucide-react';
import { useSession } from 'next-auth/react';

import { BreadcrumbUpdater } from '@/contexts/breadcrumb';
import { PageIntro } from '@/components/pageIntro/pageIntro.component';
import { TeamCard } from '@/components/tenant/teamCard.component';

const breadcrumbItems = [
  { label: 'Home', href: '/painel' },
  { label: 'Cadastros', href: '/cadastros' },
  { label: 'Equipe', href: '/cadastros/equipe' },
];

export default function TeamPage() {
  const { data: session } = useSession();

  return (
    <div className="w-full">
      <BreadcrumbUpdater items={breadcrumbItems} />

      <main className="flex flex-col gap-4">
        <PageIntro icon={Users} title="Equipe">
          Quem entra no sistema, e o que cada papel alcança.
        </PageIntro>

        <TeamCard currentUserId={session?.user.id ?? ''} />
      </main>
    </div>
  );
}
