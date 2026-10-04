'use client';

import { Palette, Receipt } from 'lucide-react';

import { BreadcrumbUpdater } from '@/contexts/breadcrumb';
import { PageIntro } from '@/components/pageIntro/pageIntro.component';
import { BrandingForm } from '@/components/tenant/brandingForm.component';
import { BillingCard } from '@/components/tenant/billingCard.component';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSearchParams } from 'next/navigation';

const breadcrumbItems = [
  { label: 'Home', href: '/painel' },
  { label: 'Configurações', href: '/configuracoes' },
];

export default function ConfiguracoesPage() {
  /* A tarja de cobrança aponta para cá com ?aba=assinatura. */
  const abaInicial = useSearchParams().get('aba') ?? 'aparencia';

  return (
    <div className="w-full">
      <BreadcrumbUpdater items={breadcrumbItems} />

      <main className="flex flex-col gap-4">
        <PageIntro icon={Palette} title="Aparência">
          Logo, imagem do login e cor do sistema.
        </PageIntro>

        <Tabs defaultValue={abaInicial} className="w-full">
          {/* Com ícone, as abas do sistema ficam todas iguais: as de
              Financeiro, Cadastros e WhatsApp já vinham assim. */}
          <TabsList>
            <TabsTrigger value="aparencia" className="gap-2">
              <Palette className="size-4" aria-hidden />
              Aparência
            </TabsTrigger>
            <TabsTrigger value="assinatura" className="gap-2">
              <Receipt className="size-4" aria-hidden />
              Assinatura
            </TabsTrigger>
          </TabsList>

          <TabsContent value="aparencia" className="mt-4">
            <BrandingForm />
          </TabsContent>

          <TabsContent value="assinatura" className="mt-4">
            <BillingCard />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
