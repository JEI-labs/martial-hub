'use client';

import type { Modality } from '@prisma/client';
import { Dumbbell, Plus } from 'lucide-react';
import { useState } from 'react';

import ModalitiesList from '@/components/modalities/modalitiesList.component';
import { ModalityFormModal } from '@/components/modals/modalities/modalityFormModal.component';
import { PageIntro } from '@/components/pageIntro/pageIntro.component';
import { Button } from '@/components/ui/button';
import { BreadcrumbUpdater } from '@/contexts/breadcrumb';
import { toast } from '@/hooks/use-toast';
import { api } from '@/trpc/react';

const breadcrumbItems = [
  { label: 'Home', href: '/painel' },
  { label: 'Cadastros', href: '/cadastros' },
  { label: 'Modalidades', href: '/cadastros/modalidades' },
];

const mostrarErro = (err: unknown) =>
  toast({
    title: 'Erro',
    description:
      err instanceof Error ? err.message : 'Ocorreu um erro inesperado',
    variant: 'destructive',
  });

export default function ModalitiesPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Modality | null>(null);

  const utils = api.useUtils();
  const { data, isLoading } = api.modalities.list.useQuery();
  const modalities = data ?? [];

  const onSuccess = () => utils.modalities.list.invalidate();
  const reorder = api.modalities.reorder.useMutation({ onSuccess });
  const remove = api.modalities.remove.useMutation({ onSuccess });

  const handleMove = (index: number, direction: -1 | 1) => {
    const ids = modalities.map((m) => m.id);
    const alvo = index + direction;
    [ids[index], ids[alvo]] = [ids[alvo]!, ids[index]!];
    reorder.mutate({ ids }, { onError: mostrarErro });
  };

  /* Recusa (a última ativa, por exemplo) vira aviso, e não exceção: o diálogo
     de confirmação não trata erro, e ele estouraria no console. */
  const handleDelete = async () => {
    if (!editing) return;
    try {
      await remove.mutateAsync({ id: editing.id });
      toast({
        title: 'Sucesso',
        description: 'Modalidade excluída com sucesso',
      });
    } catch (err) {
      mostrarErro(err);
    }
  };

  return (
    <div className="w-full">
      <BreadcrumbUpdater items={breadcrumbItems} />

      <main className="flex flex-col gap-4">
        <PageIntro
          icon={Dumbbell}
          title="O que é uma modalidade?"
          example={
            <>
              <strong className="text-foreground font-medium">Muay Thai</strong>
              , <strong className="text-foreground font-medium">Boxe</strong> ou{' '}
              <strong className="text-foreground font-medium">Jiu-Jitsu</strong>
              . A ordem aqui é a ordem em que elas aparecem no resto do sistema.
            </>
          }
        >
          É o que a academia ensina. Desativar tira a modalidade das escolhas
          novas sem apagar o que já existe; a academia precisa de pelo menos uma
          ativa.
        </PageIntro>

        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground text-sm">
            {modalities.length}{' '}
            {modalities.length === 1 ? 'modalidade' : 'modalidades'}
          </span>
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-2 size-4" />
            Nova modalidade
          </Button>
        </div>

        <ModalitiesList
          modalities={modalities}
          isLoading={isLoading}
          onEdit={(modality) => {
            setEditing(modality);
            setFormOpen(true);
          }}
          onMove={handleMove}
          isMoving={reorder.isPending}
        />

        {formOpen && (
          <ModalityFormModal
            isOpen={formOpen}
            setIsOpen={setFormOpen}
            modality={editing}
            existing={modalities}
            onDelete={editing ? handleDelete : undefined}
          />
        )}
      </main>
    </div>
  );
}
