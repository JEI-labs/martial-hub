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
        <PageIntro
          icon={Users}
          title="Quem trabalha na academia"
          example={
            <>
              O{' '}
              <strong className="text-foreground font-medium">professor</strong>{' '}
              entra para ver os alunos, registrar graduação e cuidar da agenda
              dele. A{' '}
              <strong className="text-foreground font-medium">recepção</strong>{' '}
              matricula e recebe. O{' '}
              <strong className="text-foreground font-medium">dono</strong> faz
              tudo.
            </>
          }
        >
          Cada pessoa entra com o próprio login, e o papel decide o que ela
          alcança. O sistema não manda e-mail: a senha é definida aqui e você
          entrega a ela.
        </PageIntro>

        <TeamCard currentUserId={session?.user.id ?? ''} />
      </main>
    </div>
  );
}
