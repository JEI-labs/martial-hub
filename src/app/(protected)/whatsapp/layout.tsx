import { SectionTabs } from '@/components/sectionTabs/sectionTabs.component';

export default function WhatsappLayout({ children }: LayoutProps<'/whatsapp'>) {
  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">WhatsApp</h1>
        <p className="text-muted-foreground text-sm">
          As mensagens que a academia manda para os alunos: o texto padrão de
          cada situação, a conexão com o provedor e o que já foi enviado.
        </p>
      </div>

      <SectionTabs section="whatsapp" />

      {children}
    </div>
  );
}
