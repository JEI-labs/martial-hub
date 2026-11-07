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
        <PageIntro icon={CalendarClock} title="Tipos de aula">
          Preço e duração do que a academia cobra fora da mensalidade.
        </PageIntro>

        <LessonTypesCard />
      </main>
    </div>
  );
}
