'use client';

import { Palette } from 'lucide-react';

import { BreadcrumbUpdater } from '@/contexts/breadcrumb';
import { PageIntro } from '@/components/pageIntro/pageIntro.component';
import { BrandingForm } from '@/components/tenant/brandingForm.component';
import { TeamCard } from '@/components/tenant/teamCard.component';
import { BillingCard } from '@/components/tenant/billingCard.component';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';

const breadcrumbItems = [
  { label: 'Home', href: '/painel' },
  { label: 'Configurações', href: '/configuracoes' },
];

export default function ConfiguracoesPage() {
  const { data: session } = useSession();
  /* A tarja de cobrança aponta para cá com ?aba=assinatura. */
  const abaInicial = useSearchParams().get('aba') ?? 'aparencia';

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

        <Tabs defaultValue={abaInicial} className="w-full">
          <TabsList>
            <TabsTrigger value="aparencia">Aparência</TabsTrigger>
            <TabsTrigger value="equipe">Equipe</TabsTrigger>
            <TabsTrigger value="assinatura">Assinatura</TabsTrigger>
          </TabsList>

          <TabsContent value="aparencia" className="mt-4">
            <BrandingForm />
          </TabsContent>

          <TabsContent value="equipe" className="mt-4">
            <TeamCard currentUserId={session?.user.id ?? ''} />
          </TabsContent>

          <TabsContent value="assinatura" className="mt-4">
            <BillingCard />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
