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
        <PageIntro
          icon={MessageSquareText}
          title="O que é um modelo?"
          example={
            <>
              Para <em>Pagamento atrasado</em>: &ldquo;Oi {'{{primeiro_nome}}'},
              sua parcela venceu. Consegue acertar hoje?&rdquo; — o sistema
              troca o {'{{primeiro_nome}}'} pelo nome de cada aluno na hora do
              envio.
            </>
          }
        >
          É o texto pronto de cada situação. Você escreve uma vez, marca para
          qual evento serve, e o sistema usa esse texto sempre que precisar
          falar com um aluno naquela situação.
        </PageIntro>

        <MessageTemplatesCard />
      </div>
    </>
  );
}
