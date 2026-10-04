import { SectionTabs } from '@/components/sectionTabs/sectionTabs.component';

export default function WhatsappLayout({ children }: LayoutProps<'/whatsapp'>) {
  return (
    <div className="flex w-full flex-col gap-6">
      <SectionTabs section="whatsapp" />

      {children}
    </div>
  );
}
