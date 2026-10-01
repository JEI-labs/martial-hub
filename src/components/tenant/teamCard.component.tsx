'use client';

import { useState } from 'react';
import { EUserRole } from '@prisma/client';
import { Loader2, Plus, UserMinus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { Skeleton } from '@/components/ui/skeleton';
import ConfirmDeleteDialog from '@/components/confirmDeleteDialog/confirmDeleteDialog.component';
import { ASSIGNABLE_ROLES, ROLE_INFO } from '@/common/constants/roles';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/trpc/react';

export function TeamCard({ currentUserId }: { currentUserId: string }) {
  const { toast } = useToast();
  const utils = api.useUtils();

  const { data: membros, isLoading } = api.tenant.listMembers.useQuery();
  const [novoAberto, setNovoAberto] = useState(false);
  const [removerId, setRemoverId] = useState<string | null>(null);
  /* Qual pessoa está salvando: um isPending só travava o select de todas. */
  const [salvando, setSalvando] = useState<string | null>(null);

  const invalidar = () => utils.tenant.listMembers.invalidate();
  const erro = (titulo: string) => (error: { message: string }) =>
    toast({
      title: titulo,
      description: error.message,
      variant: 'destructive',
    });

  const trocarPapel = api.tenant.updateMemberRole.useMutation({
    onSuccess: () => {
      setSalvando(null);
      invalidar();
    },
    onError: (error) => {
      setSalvando(null);
      erro('Não deu para trocar o acesso')(error);
    },
  });

  const remover = api.tenant.removeMember.useMutation({
    onSuccess: () => {
      toast({ title: 'Acesso removido' });
      invalidar();
    },
    onError: erro('Não deu para remover'),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Equipe</CardTitle>
          <CardDescription>
            Cada pessoa entra com o próprio login, e o papel decide o que ela
            pode fazer.
          </CardDescription>
        </div>

        <Button onClick={() => setNovoAberto(true)}>
          <Plus className="mr-2 size-4" />
          Adicionar pessoa
        </Button>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {isLoading
          ? [0, 1].map((i) => <Skeleton key={i} className="h-16 w-full" />)
          : membros?.map((membro) => {
              const souEu = membro.id === currentUserId;

              return (
                <div
                  key={membro.id}
                  className="bg-muted/60 flex flex-wrap items-center gap-3 rounded-xl p-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {membro.name}
                      {souEu && (
                        <span className="text-muted-foreground ml-2 text-xs">
                          (você)
                        </span>
                      )}
                    </p>
                    <p className="text-muted-foreground truncate text-sm">
                      {membro.email}
                    </p>
                  </div>

                  <Select
                    value={membro.role}
                    disabled={souEu || salvando === membro.id}
                    onValueChange={(value) => {
                      setSalvando(membro.id);
                      trocarPapel.mutate({
                        id: membro.id,
                        role: value as EUserRole,
                      });
                    }}
                  >
                    <SelectTrigger className="w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSIGNABLE_ROLES.map((papel) => (
                        <SelectItem key={papel} value={papel}>
                          {ROLE_INFO[papel].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive-text"
                    disabled={souEu}
                    title={
                      souEu ? 'Não dá para remover o próprio acesso' : 'Remover'
                    }
                    onClick={() => setRemoverId(membro.id)}
                  >
                    <UserMinus className="size-4" />
                  </Button>
                </div>
              );
            })}

        {/* O que cada papel faz, para a escolha acima não ser adivinhação. */}
        <div className="text-muted-foreground mt-2 space-y-1 text-xs">
          {ASSIGNABLE_ROLES.map((papel) => (
            <p key={papel}>
              <strong className="text-foreground font-medium">
                {ROLE_INFO[papel].label}:
              </strong>{' '}
              {ROLE_INFO[papel].description}
            </p>
          ))}
        </div>
      </CardContent>

      <NovaPessoa
        open={novoAberto}
        onOpenChange={setNovoAberto}
        onCreated={invalidar}
      />

      {removerId && (
        <ConfirmDeleteDialog
          item={removerId}
          open={Boolean(removerId)}
          onOpenChange={(open) => !open && setRemoverId(null)}
          onConfirm={async (id) => {
            await remover.mutateAsync({ id });
            setRemoverId(null);
          }}
        />
      )}
    </Card>
  );
}

function NovaPessoa({
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<EUserRole>(EUserRole.STAFF);

  const criar = api.tenant.createMember.useMutation({
    onSuccess: () => {
      toast({
        title: 'Acesso criado',
        description: 'Passe o e-mail e a senha para a pessoa.',
      });
      setName('');
      setEmail('');
      setPassword('');
      setRole(EUserRole.STAFF);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar pessoa</DialogTitle>
          <DialogDescription>
            O sistema não envia e-mail: a senha é definida aqui e você entrega a
            ela, que troca depois no perfil.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor="membro-nome">Nome</Label>
            <Input
              id="membro-nome"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nome de quem vai usar"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="membro-email">E-mail</Label>
            <Input
              id="membro-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="pessoa@exemplo.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="membro-senha">Senha</Label>
            <Input
              id="membro-senha"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="pelo menos 6 letras"
            />
          </div>

          <div className="space-y-2">
            <Label>Acesso</Label>
            <Select
              value={role}
              onValueChange={(value) => setRole(value as EUserRole)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSIGNABLE_ROLES.map((papel) => (
                  <SelectItem key={papel} value={papel}>
                    {ROLE_INFO[papel].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              {ROLE_INFO[role].description}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={
              criar.isPending ||
              name.trim().length < 2 ||
              !email.includes('@') ||
              password.length < 6
            }
            onClick={() =>
              criar.mutate({
                name: name.trim(),
                email: email.trim(),
                password,
                role,
              })
            }
          >
            {criar.isPending && (
              <Loader2 className="mr-2 size-4 animate-spin" />
            )}
            Criar acesso
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
