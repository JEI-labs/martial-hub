'use client';

import { EmptyState } from '@/components/emptyState/emptyState.component';
import { ListSkeleton } from '@/components/skeletons/listSkeleton.component';
import { PLAN_BILLING_LABEL } from '@/common/constants/planBilling';
import { monthlyValue } from '@/utils/planUtils';
import { maskBRL } from '@/utils/masksUtils';
import { EPlanBilling } from '@prisma/client';
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
import type { IPlanList } from './plansList.types';

const formatDate = (value: string | Date) =>
  new Date(value).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

const PlansList: React.FC<IPlanList> = ({ plans, isLoading, onEdit }) => {
  return (
    <div className="w-full">
      <div className="mt-4">
        {isLoading ? (
          <ListSkeleton columns={5} />
        ) : plans.length === 0 ? (
          <EmptyState
            title="Nenhum plano encontrado"
            description="Ajuste a busca, ou crie o primeiro plano de matrícula."
          />
        ) : (
          <div className="bg-card shadow-card overflow-hidden rounded-2xl">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plano</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Cobrança</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                  <TableHead>Criado em</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {plans.map((plan) => (
                  <TableRow
                    key={plan.id}
                    className="cursor-pointer"
                    onClick={() => onEdit(plan.id)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {plan.name}
                        {plan.isDefault && (
                          <Badge variant="outline" className="font-normal">
                            Padrão
                          </Badge>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="text-muted-foreground max-w-xs truncate">
                      {plan.description || '—'}
                    </TableCell>

                    <TableCell className="text-muted-foreground">
                      {plan.duration} {plan.duration === 1 ? 'mês' : 'meses'}
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant={
                          plan.billing === EPlanBilling.UPFRONT
                            ? 'default'
                            : 'outline'
                        }
                      >
                        {PLAN_BILLING_LABEL[plan.billing]}
                      </Badge>
                    </TableCell>

                    {/* O preço é o do período; embaixo, o que isso dá por mês,
                        que é como o professor compara um plano com o outro. */}
                    <TableCell className="text-right whitespace-nowrap">
                      <span className="font-medium">
                        {maskBRL(Number(plan.price), true)}
                      </span>
                      {plan.duration > 1 && (
                        <span className="text-muted-foreground block text-xs">
                          {maskBRL(
                            monthlyValue(Number(plan.price), plan.duration),
                            true,
                          )}
                          /mês
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="text-muted-foreground">
                      {formatDate(plan.createdAt)}
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

export default PlansList;
