'use client';

import { EmptyState } from '@/components/emptyState/emptyState.component';
import { ListSkeleton } from '@/components/skeletons/listSkeleton.component';
import React from 'react';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ISupplierList } from './supplierList.types';
import { maskCellphone } from '@/utils/masksUtils';

const SuppliersList: React.FC<ISupplierList> = ({
  suppliers,
  isLoading,
  onEdit,
}) => {
  if (isLoading) {
    return <ListSkeleton columns={5} />;
  }

  if (suppliers.length === 0) {
    return (
      <EmptyState
        title="Nenhum fornecedor encontrado"
        description="Ajuste a busca e o filtro de estado, ou cadastre um fornecedor."
      />
    );
  }

  return (
    <>
      <div className="bg-card mt-8 overflow-hidden rounded-2xl">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Localização</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Endereço</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {suppliers.map((sup) => (
              <TableRow
                key={sup.id}
                className="cursor-pointer"
                onClick={() => onEdit(sup.id)}
              >
                <TableCell className="font-medium">{sup.name}</TableCell>

                <TableCell className="text-muted-foreground">
                  {sup.city || sup.state
                    ? [sup.city, sup.state].filter(Boolean).join(', ')
                    : '—'}
                </TableCell>

                <TableCell className="text-muted-foreground">
                  {sup.phone ? maskCellphone(sup.phone) : '—'}
                </TableCell>

                <TableCell className="text-muted-foreground">
                  {sup.street || '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
};

export default SuppliersList;
