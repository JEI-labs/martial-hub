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
import { Skeleton } from '@/components/ui/skeleton';
import { signOut, useSession } from 'next-auth/react';
import { LogOut, UserPen, Settings } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/trpc/react';

export function UserProfileContainer(): React.JSX.Element {
  const { data: session } = useSession();
  const getMeApi = api.users.getMe.useQuery();
  const userData = getMeApi.data;

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
        {/* <Link href="/seguranca">
          <DropdownMenuItem className="cursor-not-allowed gap-2 py-2 pl-3 pr-4">
            <ShieldCheck className="h-4 w-4" />
            Segurança
          </DropdownMenuItem>
        </Link> */}

        {/* <DropdownMenuSeparator /> */}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer gap-2 py-2 pr-4 pl-3"
          onClick={() => signOut()}
        >
          <LogOut className="h-4 w-4" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
