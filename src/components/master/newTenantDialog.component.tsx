'use client';

import { useState } from 'react';
import { ETenantStatus } from '@prisma/client';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TENANT_STATUS_LIST } from '@/common/constants/tenantStatus';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/trpc/react';

/** "Academia Muay Thai SP" -> "academia-muay-thai-sp" */
function slugificar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export function NewTenantDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (_open: boolean) => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTocado, setSlugTocado] = useState(false);
  const [preco, setPreco] = useState('149');
  const [billingDay, setBillingDay] = useState('10');
  const [status, setStatus] = useState<ETenantStatus>(ETenantStatus.TRIAL);
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');

  const criar = api.master.createTenant.useMutation({
    onSuccess: (resultado) => {
      toast({
        title: 'Academia criada',
        description: resultado.hostname
          ? `Já responde em ${resultado.hostname}.`
          : 'Cadastre um domínio para ela ser acessada.',
      });
      setName('');
      setSlug('');
      setSlugTocado(false);
      setOwnerName('');
      setOwnerEmail('');
      setOwnerPassword('');
      onCreated();
      onOpenChange(false);
    },
    onError: (error) =>
      toast({
        title: 'Não deu para criar',
        description: error.message,
        variant: 'destructive',
      }),
  });

  const podeSalvar =
    name.trim().length >= 2 &&
    slug.length >= 2 &&
    ownerName.trim().length >= 2 &&
    ownerEmail.includes('@') &&
    ownerPassword.length >= 6;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova academia</DialogTitle>
          <DialogDescription>
            Ela nasce com endereço, assinatura, o acesso do dono e a categoria
            que recebe as mensalidades.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="t-nome">Nome</Label>
            <Input
              id="t-nome"
              value={name}
              placeholder="Academia Muay Thai SP"
              onChange={(event) => {
                setName(event.target.value);
                if (!slugTocado) setSlug(slugificar(event.target.value));
              }}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="t-slug">Endereço</Label>
            <Input
              id="t-slug"
              value={slug}
              placeholder="muay-sp"
              onChange={(event) => {
                setSlugTocado(true);
                setSlug(slugificar(event.target.value));
              }}
            />
            <p className="text-muted-foreground text-xs">
              Vira o subdomínio da academia. Domínio próprio entra depois, na
              tela dela.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="t-preco">Mensalidade (R$)</Label>
            <Input
              id="t-preco"
              inputMode="numeric"
              value={preco}
              onChange={(event) =>
                setPreco(event.target.value.replace(/\D/g, ''))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="t-dia">Dia do vencimento</Label>
            <Input
              id="t-dia"
              inputMode="numeric"
              value={billingDay}
              onChange={(event) =>
                setBillingDay(event.target.value.replace(/\D/g, ''))
              }
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Situação</Label>
            <Select
              value={status}
              onValueChange={(value) => setStatus(value as ETenantStatus)}
            >
              <SelectTrigger>
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

          <div className="bg-muted/60 space-y-4 rounded-xl p-4 sm:col-span-2">
            <p className="text-muted-foreground text-xs">
              Acesso do dono da academia. O sistema não manda e-mail: passe
              estes dados para ele.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="t-dono">Nome do dono</Label>
                <Input
                  id="t-dono"
                  value={ownerName}
                  onChange={(event) => setOwnerName(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="t-email">E-mail</Label>
                <Input
                  id="t-email"
                  type="email"
                  value={ownerEmail}
                  onChange={(event) => setOwnerEmail(event.target.value)}
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="t-senha">Senha</Label>
                <Input
                  id="t-senha"
                  value={ownerPassword}
                  placeholder="pelo menos 6 letras"
                  onChange={(event) => setOwnerPassword(event.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!podeSalvar || criar.isPending}
            onClick={() =>
              criar.mutate({
                name: name.trim(),
                slug,
                priceCents: Number(preco || 0) * 100,
                billingDay: Math.min(28, Math.max(1, Number(billingDay || 10))),
                status,
                ownerName: ownerName.trim(),
                ownerEmail: ownerEmail.trim(),
                ownerPassword,
              })
            }
          >
            {criar.isPending && (
              <Loader2 className="mr-2 size-4 animate-spin" />
            )}
            Criar academia
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
