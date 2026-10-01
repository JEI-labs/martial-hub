'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ETenantStatus } from '@prisma/client';
import {
  ArrowLeft,
  Globe,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { InvoicesPanel } from '@/components/master/invoicesPanel.component';
import { ROLE_INFO } from '@/common/constants/roles';
import {
  TENANT_STATUS,
  TENANT_STATUS_LIST,
} from '@/common/constants/tenantStatus';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/trpc/react';

export function TenantDetail({ tenantId }: { tenantId: string }) {
  const { toast } = useToast();
  const utils = api.useUtils();

  const { data: tenant, isLoading } = api.master.getTenant.useQuery({
    id: tenantId,
  });

  const [novoDominio, setNovoDominio] = useState('');
  const [preco, setPreco] = useState<string | null>(null);
  const [dia, setDia] = useState<string | null>(null);
  /* Qual domínio está sendo conferido: com um isPending só, apertar Conferir
     num travava o botão de todos os outros. */
  const [conferindo, setConferindo] = useState<string | null>(null);

  const invalidar = () => {
    utils.master.getTenant.invalidate({ id: tenantId });
    utils.master.listTenants.invalidate();
    utils.master.overview.invalidate();
  };

  const erro = (titulo: string) => (e: { message: string }) =>
    toast({ title: titulo, description: e.message, variant: 'destructive' });

  const salvar = api.master.updateTenant.useMutation({
    onSuccess: () => {
      toast({ title: 'Cliente atualizado' });
      invalidar();
    },
    onError: erro('Não deu para salvar'),
  });

  const adicionarDominio = api.master.addDomain.useMutation({
    onSuccess: (r) => {
      toast({
        title: 'Domínio cadastrado',
        description: r.vercel
          ? 'Registrado na Vercel. Falta o cliente apontar o DNS.'
          : (r.erro ?? 'Cadastre-o também no projeto da Vercel.'),
      });
      setNovoDominio('');
      invalidar();
    },
    onError: erro('Não deu para cadastrar'),
  });

  const conferir = api.master.checkDomain.useMutation({
    onSettled: () => setConferindo(null),
    onSuccess: (estado) => {
      toast({
        title: estado.dnsOk ? 'DNS apontando certo' : 'Ainda não aponta',
        description: estado.erro ?? estado.instrucao ?? 'Certificado emitido.',
        variant: estado.dnsOk ? 'default' : 'destructive',
      });
      invalidar();
    },
    onError: erro('Não deu para conferir'),
  });

  const remover = api.master.removeDomain.useMutation({
    onSuccess: () => {
      toast({ title: 'Domínio removido' });
      invalidar();
    },
    onError: erro('Não deu para remover'),
  });

  if (isLoading || !tenant) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const valorPreco =
    preco ?? String((tenant.subscription?.priceCents ?? 0) / 100);
  const valorDia = dia ?? String(tenant.subscription?.billingDay ?? 10);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button variant="ghost" className="mb-2 -ml-2" asChild>
          <Link href="/master/clientes">
            <ArrowLeft className="mr-2 size-4" />
            Clientes
          </Link>
        </Button>

        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{tenant.name}</h1>
          <Badge variant={TENANT_STATUS[tenant.status].variant}>
            {TENANT_STATUS[tenant.status].label}
          </Badge>
          <span className="text-muted-foreground text-sm">
            {tenant._count.students} aluno(s) · desde{' '}
            {new Date(tenant.createdAt).toLocaleDateString('pt-BR')}
          </span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contrato</CardTitle>
          <CardDescription>
            Situação e quanto esta academia paga por mês.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label>Situação</Label>
            <Select
              value={tenant.status}
              onValueChange={(value) =>
                salvar.mutate({ id: tenantId, status: value as ETenantStatus })
              }
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TENANT_STATUS_LIST.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="preco">Mensalidade (R$)</Label>
            <Input
              id="preco"
              inputMode="numeric"
              className="w-32"
              value={valorPreco}
              onChange={(event) =>
                setPreco(event.target.value.replace(/\D/g, ''))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dia">Vence dia</Label>
            <Input
              id="dia"
              inputMode="numeric"
              className="w-24"
              value={valorDia}
              onChange={(event) =>
                setDia(event.target.value.replace(/\D/g, ''))
              }
            />
          </div>

          <Button
            disabled={salvar.isPending}
            onClick={() =>
              salvar.mutate({
                id: tenantId,
                priceCents: Number(valorPreco || 0) * 100,
                billingDay: Math.min(28, Math.max(1, Number(valorDia || 10))),
              })
            }
          >
            {salvar.isPending && (
              <Loader2 className="mr-2 size-4 animate-spin" />
            )}
            Salvar
          </Button>

          <p className="text-muted-foreground w-full text-xs">
            Suspensa tira o acesso de todo mundo da academia, mas não apaga
            nada: voltar para ativa devolve tudo como estava.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Endereços</CardTitle>
          <CardDescription>
            {tenant.vercelConfigurada
              ? 'Domínio próprio é cadastrado na Vercel na hora; o DNS é do lado do cliente.'
              : 'Sem as credenciais da Vercel no servidor, o domínio fica só guardado aqui — cadastre-o no projeto na mão.'}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-3">
          {tenant.domains.map((dominio) => (
            <div
              key={dominio.id}
              className="bg-muted/60 flex flex-wrap items-center gap-3 rounded-xl p-3"
            >
              <Globe className="text-muted-foreground size-4 shrink-0" />

              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{dominio.hostname}</p>
                <p className="text-muted-foreground text-xs">
                  {dominio.isPrimary ? 'principal · ' : ''}
                  {dominio.verifiedAt ? 'DNS conferido' : 'aguardando DNS'}
                </p>
              </div>

              <Button
                size="sm"
                variant="outline"
                disabled={conferindo === dominio.id}
                onClick={() => {
                  setConferindo(dominio.id);
                  conferir.mutate({ id: dominio.id });
                }}
              >
                <RefreshCw className="mr-2 size-4" />
                Conferir
              </Button>

              {!dominio.isPrimary && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive-text"
                  onClick={() => remover.mutate({ id: dominio.id })}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          ))}

          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="dominio">Domínio próprio do cliente</Label>
              <Input
                id="dominio"
                value={novoDominio}
                placeholder="sistema.academiadocliente.com.br"
                className="w-72"
                onChange={(event) => setNovoDominio(event.target.value)}
              />
            </div>

            <Button
              disabled={adicionarDominio.isPending || novoDominio.length < 4}
              onClick={() =>
                adicionarDominio.mutate({ tenantId, hostname: novoDominio })
              }
            >
              {adicionarDominio.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Plus className="mr-2 size-4" />
              )}
              Adicionar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quem tem acesso</CardTitle>
          <CardDescription>
            Equipe da academia. Quem muda isto é o dono dela, na tela dele.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-2">
          {tenant.users.map((usuario) => (
            <div
              key={usuario.id}
              className="bg-muted/60 flex flex-wrap items-center gap-3 rounded-xl p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">{usuario.name}</p>
                <p className="text-muted-foreground truncate text-sm">
                  {usuario.email}
                </p>
              </div>
              <Badge variant="outline">{ROLE_INFO[usuario.role].label}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Faturas</h2>
        <InvoicesPanel tenantId={tenantId} />
      </div>
    </div>
  );
}
