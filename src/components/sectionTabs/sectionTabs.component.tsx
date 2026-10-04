'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart2,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
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
    {
      label: 'Resumo',
      href: '/financeiro/resumo',
      icon: BarChart2,
      hint: 'Entrou, saiu e sobrou.',
    },
    {
      label: 'Receitas',
      href: '/financeiro/receitas',
      icon: DollarSign,
      hint: 'Mensalidades e outras entradas.',
    },
    {
      label: 'Despesas',
      href: '/financeiro/despesas',
      icon: ReceiptCentIcon,
      hint: 'O que a academia paga.',
    },
  ],
  registrations: [
    {
      label: 'Planos',
      href: '/cadastros/planos',
      icon: Package,
      hint: 'Valor e duração da mensalidade.',
    },
    {
      label: 'Aulas',
      href: '/cadastros/aulas',
      icon: CalendarClock,
      hint: 'Preço das aulas avulsas.',
    },
    {
      label: 'Categorias',
      href: '/cadastros/categorias',
      icon: Layers3,
      hint: 'A gaveta de cada lançamento.',
    },
    {
      label: 'Promoções',
      href: '/cadastros/promocoes',
      icon: Tag,
      hint: 'Descontos com prazo.',
    },
    {
      label: 'Fornecedores',
      href: '/cadastros/fornecedores',
      icon: UserSquare,
      hint: 'Quem vende para a academia.',
    },
    {
      label: 'Equipe',
      href: '/cadastros/equipe',
      icon: Users,
      hint: 'Quem entra no sistema.',
    },
  ],
  whatsapp: [
    {
      label: 'Modelos',
      href: '/whatsapp/modelos',
      icon: MessageSquareText,
      hint: 'O texto de cada situação.',
    },
    {
      label: 'Automáticas',
      href: '/whatsapp/automacoes',
      icon: Bot,
      hint: 'Envios que o sistema faz sozinho.',
    },
    {
      label: 'Conexão',
      href: '/whatsapp/conexao',
      icon: Plug,
      hint: 'O número por onde as mensagens saem.',
    },
    {
      label: 'Histórico',
      href: '/whatsapp/historico',
      icon: History,
      hint: 'O que já foi enviado.',
    },
  ],
} as const;

export type SectionName = keyof typeof SECTIONS;

/** A raiz de cada seção, para onde o "voltar" do celular aponta. */
const ROOTS: Record<SectionName, { href: string; label: string }> = {
  financial: { href: '/financeiro', label: 'Financeiro' },
  registrations: { href: '/cadastros', label: 'Cadastros' },
  whatsapp: { href: '/whatsapp', label: 'WhatsApp' },
};

/**
 * A navegação de dentro de uma subseção.
 *
 * No computador, as abas de sempre. No celular elas sumiram: seis abas viram
 * um bloco de três fileiras antes de qualquer conteúdo, e nenhuma arrumação
 * de grade conserta isso. Lá a seção abre num índice, e aqui fica só o
 * caminho de volta — o mesmo gesto dos Ajustes do celular.
 */
export function SectionTabs({ section }: { section: SectionName }) {
  const path = usePathname();
  const router = useRouter();

  const tabs = SECTIONS[section];
  const raiz = ROOTS[section];

  /* Na própria raiz não há o que navegar — a página já é a lista —, mas o
     nome da seção continua sendo dela. */
  if (path === raiz.href) {
    return <h1 className="text-2xl font-semibold">{raiz.label}</h1>;
  }

  const active =
    tabs.find((tab) => path === tab.href || path.startsWith(`${tab.href}/`))
      ?.href ?? tabs[0]?.href;

  return (
    <>
      {/* No celular o caminho de volta substitui o título da seção: os dois
          juntos diziam "Cadastros" duas vezes, uma embaixo da outra. */}
      <Link
        href={raiz.href}
        className="text-muted-foreground hover:text-foreground -mb-2 flex items-center gap-1 text-sm sm:hidden"
      >
        <ChevronLeft className="size-4" />
        {raiz.label}
      </Link>

      <h1 className="hidden text-2xl font-semibold sm:block">{raiz.label}</h1>

      <Tabs
        value={active}
        onValueChange={(href) => router.push(href)}
        className="hidden sm:block"
      >
        <TabsList className="h-auto max-w-full flex-wrap justify-start rounded-3xl">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.href} value={tab.href}>
              <tab.icon />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </>
  );
}

/**
 * O que existe numa seção, como lista.
 *
 * É a raiz da seção, e é o que o celular mostra no lugar das abas: cada
 * assunto com uma linha dizendo para que serve. Quem abre "Cadastros" pela
 * primeira vez descobre o que há ali sem precisar entrar em cada um.
 */
export function SectionIndex({ section }: { section: SectionName }) {
  const itens = SECTIONS[section];

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {itens.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="bg-card shadow-card hover:bg-muted flex items-center gap-3 rounded-2xl p-4 transition-colors"
        >
          <span className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-xl">
            <item.icon className="size-5" />
          </span>

          <div className="min-w-0 flex-1">
            <p className="font-medium">{item.label}</p>
            <p className="text-muted-foreground truncate text-sm">
              {item.hint}
            </p>
          </div>

          <ChevronRight className="text-muted-foreground size-4 shrink-0" />
        </Link>
      ))}
    </div>
  );
}
