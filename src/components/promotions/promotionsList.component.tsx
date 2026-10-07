'use client';

import React from 'react';
import type { Promotion } from '@prisma/client';

import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/emptyState/emptyState.component';
import { ListSkeleton } from '@/components/skeletons/listSkeleton.component';

interface PromotionsListProps {
  promotions: Array<Promotion>;
  isLoading: boolean;
  onEdit: (_id: string) => void;
}

const formatDate = (value: Date | string | null) =>
  value ? new Date(value).toLocaleDateString('pt-BR') : '—';

export function formatDiscount(promotion: Promotion): string {
  return promotion.discountType === 'PERCENTAGE'
    ? `${promotion.discountValue}%`
    : Number(promotion.discountValue).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      });
}

export function PromotionsList({
  promotions,
  isLoading,
  onEdit,
}: PromotionsListProps) {
  if (isLoading) {
    return <ListSkeleton columns={5} />;
  }

  if (promotions.length === 0) {
    return (
      <EmptyState
        title="Nenhuma promoção encontrada"
        description="Crie uma promoção para aplicar desconto no registro de pagamentos."
      />
    );
  }

  return (
    <>
      <div className="bg-card shadow-card overflow-hidden rounded-2xl">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Promoção</TableHead>
              <TableHead>Desconto</TableHead>
              <TableHead>Início</TableHead>
              <TableHead>Fim</TableHead>
              <TableHead>Situação</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {promotions.map((promotion) => (
              <TableRow
                key={promotion.id}
                className="cursor-pointer"
                onClick={() => onEdit(promotion.id)}
              >
                <TableCell>
                  <p className="font-medium">{promotion.name}</p>
                  {promotion.description && (
                    <p className="text-muted-foreground max-w-xs truncate text-xs">
                      {promotion.description}
                    </p>
                  )}
                </TableCell>

                <TableCell>
                  <Badge variant="secondary">{formatDiscount(promotion)}</Badge>
                </TableCell>

                <TableCell className="text-muted-foreground">
                  {formatDate(promotion.startsAt)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(promotion.endsAt)}
                </TableCell>

                <TableCell>
                  <Badge variant={promotion.isActive ? 'success' : 'secondary'}>
                    {promotion.isActive ? 'Ativa' : 'Inativa'}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
