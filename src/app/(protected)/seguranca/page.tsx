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
        <PageIntro
          icon={ShieldCheck}
          title="A segunda chave da sua conta"
          example={
            <>
              Mesmo que alguém descubra a sua senha, sem o código de seis
              dígitos do seu celular não entra. É o mesmo mecanismo do banco e
              do e-mail.
            </>
          }
        >
          Senha é o que você sabe; o código é o que você tem na mão. Para quem é
          dono da academia ou do sistema, essa segunda etapa é obrigatória.
        </PageIntro>

        <TwoFactorCard />
      </main>
    </div>
  );
}
