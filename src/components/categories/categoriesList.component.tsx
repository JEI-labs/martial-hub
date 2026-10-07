'use client';

import { EmptyState } from '@/components/emptyState/emptyState.component';
import { ListSkeleton } from '@/components/skeletons/listSkeleton.component';
import React from 'react';

import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ICategoryList } from './categoryList.types';

const formatDate = (value: string | Date) =>
  new Date(value).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

export const CategoriesList: React.FC<ICategoryList> = ({
  categories,
  isLoading,
  onEdit,
}) => {
  return (
    <div className="w-full">
      <div className="mt-4">
        {isLoading ? (
          <ListSkeleton columns={5} />
        ) : categories.length === 0 ? (
          <EmptyState
            title="Nenhuma categoria encontrada"
            description="Ajuste a busca e os filtros, ou crie a primeira categoria."
          />
        ) : (
          <div className="bg-card shadow-card overflow-hidden rounded-2xl">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criada em</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {categories.map((cat) => (
                  /* A fixa do sistema não abre: ela não pode ser alterada nem
                     excluída, e um drawer que não deixa mudar nada é pior do
                     que não abrir. */
                  <TableRow
                    key={cat.id}
                    className={cat.isFixed ? undefined : 'cursor-pointer'}
                    onClick={cat.isFixed ? undefined : () => onEdit(cat.id)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {cat.name}
                        {cat.isFixed && (
                          <Badge variant="outline" className="font-normal">
                            Fixa do sistema
                          </Badge>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="text-muted-foreground max-w-xs truncate">
                      {cat.description || '—'}
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant={
                          cat.status === 'ACTIVE' ? 'success' : 'destructive'
                        }
                      >
                        {cat.status === 'ACTIVE' ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-muted-foreground">
                      {formatDate(cat.createdAt)}
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

export default CategoriesList;
