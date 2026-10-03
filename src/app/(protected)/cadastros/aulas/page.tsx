'use client';

import { CalendarClock } from 'lucide-react';

import { BreadcrumbUpdater } from '@/contexts/breadcrumb';
import { PageIntro } from '@/components/pageIntro/pageIntro.component';
import { LessonTypesCard } from '@/components/lessonTypes/lessonTypesCard.component';

const breadcrumbItems = [
  { label: 'Home', href: '/painel' },
  { label: 'Cadastros', href: '/cadastros' },
  { label: 'Aulas', href: '/cadastros/aulas' },
];

export default function LessonTypesPage() {
  return (
    <div className="w-full">
      <BreadcrumbUpdater items={breadcrumbItems} />

      <main className="flex flex-col gap-4">
        <PageIntro
          icon={CalendarClock}
          title="Quanto custa cada aula"
          example={
            <>
              Uma aula particular de uma hora por R$ 120, uma avaliação de
              trinta minutos por R$ 80 — a agenda preenche sozinha quando você
              escolher o tipo.
            </>
          }
        >
          Aula avulsa não é mensalidade: tem preço próprio e entra no caixa por
          uma categoria separada, para você enxergar quanto cada coisa rende.
        </PageIntro>

        <LessonTypesCard />
      </main>
    </div>
  );
}
