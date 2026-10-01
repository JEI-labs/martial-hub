'use client';

import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  LoaderCircle,
  Mail,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signIn } from 'next-auth/react';
import { Form } from '@/components/ui/form';
import { FormInputComponent } from '@/components/forms/formInput/formInput.component';

interface LoginFormProps {
  /** Vem da página, que é quem sabe de qual academia é o endereço. */
  title: string;
  subtitle: string;
}

export function LoginForm({
  title,
  subtitle,
}: LoginFormProps): React.JSX.Element {
  const [seePass, setSeePass] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const PasswordIcon = seePass ? EyeOff : Eye;

  const formSchema = z.object({
    username: z
      .string()
      .email('Por favor, insira um endereço de e-mail válido.'),
    password: z
      .string()
      .min(6, { message: 'A senha deve ter pelo menos 6 caracteres.' })
      .max(20, { message: 'A senha pode ter no máximo 20 caracteres.' }),
  });

  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  });

  async function onSubmit(data: z.infer<typeof formSchema>) {
    setDisabled(true);
    const result = await signIn('credentials', { ...data, redirect: false });
    if (result && result.status === 401) {
      setErrorMessage('E-mail ou senha incorreto.');
    } else if (result && result.status === 200) {
      setErrorMessage('');
      form.reset();
      // client-side nav keeps the SPA transition; refresh re-runs server
      // components so they see the session cookie signIn just set.
      router.push('/financeiro/resumo');
      router.refresh();
    } else {
      setErrorMessage('Houve um erro inexperado, tente novamente mais tarde.');
    }
    setDisabled(false);
  }

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid w-full gap-6 pb-6">
            <div>
              <h1 className="text-foreground text-xl font-bold">{title}</h1>
              <p className="text-muted-foreground text-sm">{subtitle}</p>
            </div>
            <div className="grid gap-4">
              <FormInputComponent
                control={form.control}
                label="E-mail"
                name="username"
                type="text"
                placeholder="Digite seu e-mail"
                maxLength={100}
                required
                className="py-6 pl-11"
                disabled={disabled}
                icon={
                  <Mail
                    size={18}
                    className="text-muted-foreground pointer-events-none absolute top-4 left-4 flex items-center"
                  />
                }
              />
              <FormInputComponent
                control={form.control}
                name="password"
                label="Senha"
                type={seePass ? 'text' : 'password'}
                placeholder="Digite sua senha"
                required
                disabled={disabled}
                className="py-6 pl-11"
                icon={
                  <PasswordIcon
                    size={18}
                    className="text-muted-foreground absolute top-4 left-4 flex cursor-pointer items-center"
                    onClick={() => setSeePass(!seePass)}
                  />
                }
              />
              <Link
                href="/auth/forgotpassword"
                className="text-primary text-xs hover:underline"
              >
                Esqueceu sua senha?
              </Link>
              {errorMessage && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Não foi possivel fazer login</AlertTitle>
                  <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
              )}
            </div>

            <Button
              className="bg-primary w-full py-6 font-medium"
              type="submit"
              disabled={disabled}
            >
              {disabled && <LoaderCircle className="mr-1 h-5 animate-spin" />}
              Entrar
              <ArrowRight size={18} className="ml-1" />
            </Button>
          </div>
        </form>
      </Form>
    </>
  );
}
