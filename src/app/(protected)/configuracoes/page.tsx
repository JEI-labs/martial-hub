'use client';

import { Palette } from 'lucide-react';

import { BreadcrumbUpdater } from '@/contexts/breadcrumb';
import { PageIntro } from '@/components/pageIntro/pageIntro.component';
import { BrandingForm } from '@/components/tenant/brandingForm.component';

const breadcrumbItems = [
  { label: 'Home', href: '/painel' },
  { label: 'Configurações', href: '/configuracoes' },
];

export default function ConfiguracoesPage() {
  return (
    <div className="w-full">
      <BreadcrumbUpdater items={breadcrumbItems} />

      <main className="flex flex-col gap-4">
        <PageIntro
          icon={Palette}
          title="A cara do seu sistema"
          example={
            <>
              A <strong className="text-foreground font-medium">logo</strong>{' '}
              aparece na barra lateral e na tela de entrada; a{' '}
              <strong className="text-foreground font-medium">
                imagem do login
              </strong>{' '}
              ocupa a lateral dessa tela; a{' '}
              <strong className="text-foreground font-medium">cor</strong> vale
              para botões, destaques e gráficos.
            </>
          }
        >
          É aqui que o sistema passa a ser da sua academia. Quem acessa pelo seu
          endereço vê essa marca já na tela de login, antes de digitar a senha.
        </PageIntro>

        <BrandingForm />
      </main>
    </div>
  );
}
