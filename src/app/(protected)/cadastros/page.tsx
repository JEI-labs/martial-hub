'use client';

import { SectionIndex } from '@/components/sectionTabs/sectionTabs.component';

/**
 * A raiz da seção é a lista do que há nela.
 *
 * Antes mandava direto para a primeira aba, o que no celular jogava a pessoa
 * dentro de um assunto sem ela ter visto os outros.
 */
export default function CadastrosIndexPage() {
  return <SectionIndex section="registrations" />;
}
