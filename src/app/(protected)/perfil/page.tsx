'use client';

import { Suspense, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { BreadcrumbUpdater } from '@/contexts/breadcrumb';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Form } from '@/components/ui/form';
import * as z from 'zod';
import { FormInputComponent } from '@/components/forms/formInput/formInput.component';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { api } from '@/trpc/react';

const breadcrumbItems = [
  {
    label: 'Home',
    href: '/painel',
  },
  {
    label: 'Minha conta',
    href: '/perfil',
  },
];

const profileSchema = z
  .object({
    name: z.string().min(1, 'Nome é obrigatório'),
    email: z.string().email('Email inválido'),
    password: z
      .string()
      .min(6, 'Senha deve conter no mínimo 6 caracteres')
      .max(72, 'Senha deve ter no máximo 72 caracteres'),
    confirmPassword: z.string().min(6, 'Confirme sua senha'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não coincidem',
  });

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function Page() {
  const getMeApi = api.users.getMe.useQuery();
  const userData = getMeApi.data;

  const updateUser = api.users.update.useMutation();

  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    if (userData) {
      form.reset({
        name: userData.name ?? '',
        email: userData.email ?? '',
        password: '',
      });
    }
  }, [userData, form]);

  const onSubmit = (data: ProfileFormValues) => {
    updateUser.mutate(data, {
      onSuccess: () => {
        toast({
          title: 'Sucesso',
          description: 'Perfil atualizado com sucesso',
        });

        window.location.reload();
      },
      onError: (err) => {
        toast({
          title: 'Erro',
          description: err.message,
          variant: 'destructive',
        });
      },
    });
  };

  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <div className="w-full">
        <BreadcrumbUpdater items={breadcrumbItems} />

        <main className="flex flex-col gap-6 py-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Editar Perfil</h1>
          </div>

          <Card className="bg-muted/40">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)}>
                <div className="space-y-6 p-6">
                  <div className="flex items-center gap-4">
                    <Avatar className="ring-primary ring-offset-muted h-12 w-12 ring-2 ring-offset-2">
                      <AvatarImage src={''} className="ring-0" />
                      <AvatarFallback className="bg-primary/40">
                        {userData?.name?.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <Button variant="outline" type="button">
                      Alterar Imagem
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <FormInputComponent
                      control={form.control}
                      name="name"
                      label="Nome"
                      type="text"
                      placeholder="Digite seu nome completo"
                    />

                    <FormInputComponent
                      control={form.control}
                      name="email"
                      label="Email"
                      type="email"
                      placeholder="Digite seu email"
                    />

                    <div className="relative">
                      <FormInputComponent
                        control={form.control}
                        name="password"
                        label="Senha"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Digite sua senha"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowPassword((prev: boolean) => !prev)
                        }
                        className="text-muted-foreground hover:text-primary absolute right-3 bottom-2.5 z-10"
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>

                    <div className="relative">
                      <FormInputComponent
                        control={form.control}
                        name="confirmPassword"
                        label="Confirmar Senha"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Digite novamente sua senha"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowPassword((prev: boolean) => !prev)
                        }
                        className="text-muted-foreground hover:text-primary absolute right-3 bottom-2.5 z-10"
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="flex justify-end p-3">
                  <Button type="submit">
                    {updateUser.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Salvar Alterações
                  </Button>
                </div>
              </form>
            </Form>
          </Card>
        </main>
      </div>
    </Suspense>
  );
}
