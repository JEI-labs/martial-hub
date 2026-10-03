'use client';

import * as React from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useSession } from 'next-auth/react';

import { sairDaConta } from '@/utils/sair';
import { LogOut, UserPen, Settings, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/trpc/react';

export function UserProfileContainer(): React.JSX.Element {
  const { data: session } = useSession();
  const getMeApi = api.users.getMe.useQuery();
  const userData = getMeApi.data;
  /* O estado da segunda etapa fica no próprio menu porque é a pergunta que
     leva a pessoa a procurá-lo: "a minha está de pé?". Sem isto, a única
     resposta era abrir a tela e olhar. */
  const { data: seguranca } = api.security.status.useQuery();

  if (!session) return <Skeleton className="w-32 rounded-lg py-5" />;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-fit gap-4 px-3 py-2 focus-visible:ring-0 focus-visible:ring-offset-0"
        >
          <div className="max-sm:hidden">{userData?.name?.split(' ')[0]}</div>
          <Avatar className="ring-primary ring-offset-muted h-8 w-8 ring-2 ring-offset-2">
            <AvatarImage src={''} className="ring-0" />
            <AvatarFallback className="bg-primary/40">
              {userData?.name?.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-fit">
        <Link href="/perfil">
          <DropdownMenuItem className="cursor-pointer gap-2 py-2 pr-4 pl-3">
            <UserPen className="h-4 w-4" />
            Editar perfil
          </DropdownMenuItem>
        </Link>
        <Link href="/configuracoes">
          <DropdownMenuItem className="cursor-pointer gap-2 py-2 pr-4 pl-3">
            <Settings className="h-4 w-4" />
            Configurações
          </DropdownMenuItem>
        </Link>
        <Link href="/seguranca">
          <DropdownMenuItem className="cursor-pointer gap-2 py-2 pr-4 pl-3">
            <ShieldCheck className="h-4 w-4" />
            Segurança
            {seguranca &&
              (seguranca.ativo ? (
                <Badge variant="success" className="ml-auto">
                  Ativa
                </Badge>
              ) : seguranca.recomendado ? (
                <Badge variant="alert" className="ml-auto">
                  Recomendado
                </Badge>
              ) : (
                <Badge variant="secondary" className="ml-auto">
                  Desligada
                </Badge>
              ))}
          </DropdownMenuItem>
        </Link>

        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer gap-2 py-2 pr-4 pl-3"
          /* Com destino explícito: sem ele o NextAuth devolve a pessoa para o
             host configurado no servidor, e quem saía de uma academia caía na
             tela de login de outra — com a marca da outra. */
          onClick={() => sairDaConta()}
        >
          <LogOut className="h-4 w-4" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
