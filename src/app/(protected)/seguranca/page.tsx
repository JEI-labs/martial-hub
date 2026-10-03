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
          Senha é o que você sabe; o código é o que você tem na mão. Não é
          obrigatório, mas se você é dono da academia vale a pena: a sua conta
          abre os dados de todos os alunos e todo o financeiro.
        </PageIntro>

        <TwoFactorCard />
      </main>
    </div>
  );
}
