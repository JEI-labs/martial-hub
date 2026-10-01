'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LifeBuoy, Loader2, Plus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { NewTenantDialog } from '@/components/master/newTenantDialog.component';
import { CopyButton } from '@/components/ui/copy-button';
import { TENANT_STATUS } from '@/common/constants/tenantStatus';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/trpc/react';
import { maskBRL } from '@/utils/masksUtils';

export function TenantsTable() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [novo, setNovo] = useState(false);
  const [entrando, setEntrando] = useState<string | null>(null);

  /* A sessão é por host: o cookie do master não vale no endereço da academia.
     Por isso a entrada é um bilhete assinado, trocado por sessão lá dentro. */
  const suporte = api.master.supportLink.useMutation({
    onSuccess: (resultado) => {
      const porta = window.location.port ? `:${window.location.port}` : '';
      window.open(
        `${window.location.protocol}//${resultado.host}${porta}${resultado.url}`,
        '_blank',
        'noopener',
      );
      setEntrando(null);
    },
    onError: (error) => {
      setEntrando(null);
      toast({
        title: 'Não deu para entrar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const { data, isLoading, refetch } = api.master.listTenants.useQuery({
    search: search || undefined,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nome ou endereço..."
          className="max-w-xs"
        />

        <span className="text-muted-foreground text-sm">
          {data?.length ?? 0} cliente(s)
        </span>

        <Button className="ml-auto" onClick={() => setNovo(true)}>
          <Plus className="mr-2 size-4" />
          Nova academia
        </Button>
      </div>

      {isLoading ? (
        <ListSkeleton columns={6} />
      ) : !data?.length ? (
        <EmptyState
          icon={Plus}
          title="Nenhuma academia ainda"
          description="Crie a primeira e ela já nasce com endereço, dono e assinatura."
        />
      ) : (
        <div className="bg-card shadow-card overflow-hidden rounded-2xl">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Academia</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right">Mensalidade</TableHead>
                <TableHead className="text-right">Em aberto</TableHead>
                <TableHead className="text-right">Alunos</TableHead>
                <TableHead>Endereço</TableHead>
                <TableHead className="text-right">Suporte</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {data.map((tenant) => {
                const principal =
                  tenant.domains.find((d) => d.isPrimary) ?? tenant.domains[0];

                return (
                  <TableRow key={tenant.id} className="cursor-pointer">
                    <TableCell className="font-medium">
                      <Link href={`/master/clientes/${tenant.id}`}>
                        {tenant.name}
                        <span className="text-muted-foreground block text-xs">
                          /{tenant.slug}
                        </span>
                      </Link>
                    </TableCell>

                    <TableCell>
                      <Badge variant={TENANT_STATUS[tenant.status].variant}>
                        {TENANT_STATUS[tenant.status].label}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-right whitespace-nowrap">
                      {tenant.subscription
                        ? maskBRL(tenant.mensalidade, true)
                        : '—'}
                    </TableCell>

                    <TableCell className="text-right whitespace-nowrap">
                      {tenant.emAberto > 0 ? (
                        <span className="text-destructive-text font-medium">
                          {maskBRL(tenant.emAberto, true)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>

                    <TableCell className="text-right">
                      {tenant._count.students}
                    </TableCell>

                    <TableCell className="text-muted-foreground text-xs">
                      {principal ? (
                        <span className="flex items-center gap-2">
                          {principal.hostname}
                          {/* O endereço existe para ser mandado ao cliente:
                              copiá-lo é a ação seguinte a olhá-lo. */}
                          <CopyButton
                            value={`https://${principal.hostname}`}
                            label=""
                            variant="ghost"
                            size="icon"
                            className="[&>svg]:mr-0"
                            aria-label={`Copiar link de ${tenant.name}`}
                          />
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>

                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={entrando === tenant.id}
                        onClick={() => {
                          setEntrando(tenant.id);
                          suporte.mutate({ tenantId: tenant.id });
                        }}
                      >
                        {entrando === tenant.id ? (
                          <Loader2 className="mr-2 size-4 animate-spin" />
                        ) : (
                          <LifeBuoy className="mr-2 size-4" />
                        )}
                        Entrar
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <NewTenantDialog
        open={novo}
        onOpenChange={setNovo}
        onCreated={() => refetch()}
      />
    </div>
  );
}
