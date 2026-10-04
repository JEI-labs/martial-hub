'use client';

import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart2,
  CalendarClock,
  DollarSign,
  Bot,
  History,
  Layers3,
  MessageSquareText,
  Package,
  Plug,
  ReceiptCentIcon,
  Tag,
  Users,
  UserSquare,
} from 'lucide-react';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

/**
 * As abas moram aqui, e não no layout, porque o layout é Server Component:
 * ícone é função, e função não atravessa a fronteira servidor → cliente
 * ("Only plain objects can be passed to Client Components"). O layout manda
 * só o nome da seção.
 */
const SECTIONS = {
  financial: [
    { label: 'Resumo', href: '/financeiro/resumo', icon: BarChart2 },
    { label: 'Receitas', href: '/financeiro/receitas', icon: DollarSign },
    { label: 'Despesas', href: '/financeiro/despesas', icon: ReceiptCentIcon },
  ],
  registrations: [
    { label: 'Planos', href: '/cadastros/planos', icon: Package },
    { label: 'Aulas', href: '/cadastros/aulas', icon: CalendarClock },
    { label: 'Categorias', href: '/cadastros/categorias', icon: Layers3 },
    { label: 'Promoções', href: '/cadastros/promocoes', icon: Tag },
    {
      label: 'Fornecedores',
      href: '/cadastros/fornecedores',
      icon: UserSquare,
    },
    { label: 'Equipe', href: '/cadastros/equipe', icon: Users },
  ],
  whatsapp: [
    { label: 'Modelos', href: '/whatsapp/modelos', icon: MessageSquareText },
    { label: 'Automáticas', href: '/whatsapp/automacoes', icon: Bot },
    { label: 'Conexão', href: '/whatsapp/conexao', icon: Plug },
    { label: 'Histórico', href: '/whatsapp/historico', icon: History },
  ],
} as const;

export type SectionName = keyof typeof SECTIONS;

/** A primeira aba é a padrão: rota da seção sem aba nenhuma cai nela. */
export function SectionTabs({ section }: { section: SectionName }) {
  const path = usePathname();
  const router = useRouter();

  const tabs = SECTIONS[section];
  const active =
    tabs.find((tab) => path === tab.href || path.startsWith(`${tab.href}/`))
      ?.href ?? tabs[0]?.href;

  return (
    <Tabs value={active} onValueChange={(href) => router.push(href)}>
      {/* Quebra a linha no celular em vez de rolar de lado: aba que só
          aparece ao arrastar é aba que ninguém encontra, e depois que a seção
          passou de quatro itens metade delas vivia fora da tela. */}
      <TabsList className="h-auto max-w-full flex-wrap justify-start rounded-3xl">
        {tabs.map((tab) => (
          <TabsTrigger key={tab.href} value={tab.href}>
            <tab.icon />
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
