'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import React from 'react';

import { EmptyState } from '@/components/emptyState/emptyState.component';
import { ListSkeleton } from '@/components/skeletons/listSkeleton.component';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { IModalitiesList } from './modalitiesList.types';

const ModalitiesList: React.FC<IModalitiesList> = ({
  modalities,
  isLoading,
  onEdit,
  onMove,
  isMoving,
}) => {
  return (
    <div className="w-full">
      <div className="mt-4">
        {isLoading ? (
          <ListSkeleton columns={3} />
        ) : modalities.length === 0 ? (
          <EmptyState
            title="Nenhuma modalidade cadastrada"
            description="Cadastre o que a academia ensina para poder matricular alunos."
          />
        ) : (
          <div className="bg-card shadow-card overflow-hidden rounded-2xl">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Modalidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ordem</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {modalities.map((modality, index) => (
                  <TableRow
                    key={modality.id}
                    className="cursor-pointer"
                    onClick={() => onEdit(modality)}
                  >
                    <TableCell className="font-medium">
                      {modality.name}
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant={modality.isActive ? 'success' : 'destructive'}
                      >
                        {modality.isActive ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </TableCell>

                    {/* Os botões vivem dentro da linha clicável: sem parar o
                        clique aqui, mover também abriria o modal. */}
                    <TableCell
                      className="text-right whitespace-nowrap"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Subir ${modality.name}`}
                        disabled={isMoving || index === 0}
                        onClick={() => onMove(index, -1)}
                      >
                        <ChevronUp className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Descer ${modality.name}`}
                        disabled={isMoving || index === modalities.length - 1}
                        onClick={() => onMove(index, 1)}
                      >
                        <ChevronDown className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModalitiesList;
