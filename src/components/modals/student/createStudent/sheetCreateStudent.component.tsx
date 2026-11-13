'use client';

import { useFaixasDisponiveis } from '@/components/graduationBadge/useFaixasDisponiveis';
import { FormModal } from '@/components/formModal/formModal.component';

import { zodResolver } from '@hookform/resolvers/zod';
import { TRPCClientError } from '@trpc/client';
import { useForm, useWatch } from 'react-hook-form';
import { Form } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { FormInputComponent } from '@/components/forms/formInput/formInput.component';
import {
  maskCellphone,
  maskDate,
  maskOnlyText,
  unmaskCellphone,
} from '@/utils/masksUtils';
import { Separator } from '@/components/ui/separator';
import { api } from '@/trpc/react';
import { SheetCreateStudentProps } from './sheetCreateStudent.types';
import { EnrollmentsField } from './enrollmentsField.component';
import {
  createStudentSchema,
  defaultCreateStudentValues,
  IStudentCreateTypes,
} from '@/server/validations/students';
import { blobUrlToBase64 } from '@/common/utils/files';
import { AvatarField } from '@/components/forms/avatarField/avatarField.component';
import { getInitials } from '@/utils/masksUtils';

export const SheetCreateStudent: React.FC<SheetCreateStudentProps> = ({
  isOpen,
  setIsOpen,
  refetch,
}) => {
  const { toast } = useToast();

  /* Só os ativos: plano desativado não aceita matrícula nova. */
  const plansApi = api.plans.getAll.useQuery({
    page: 1,
    limit: 100,
    apenasAtivos: true,
  });
  const { data: pricing } = api.plans.getPricingSettings.useQuery();
  const { data: plansData } = plansApi;
  const defaultPlanId = plansData?.data.find((plan) => plan.isDefault)?.id;

  /* O catálogo de faixas de cada modalidade ativa que tem faixa: a faixa
     com que o aluno chega é escolhida na linha da modalidade. */
  const { modalidades: comFaixas } = useFaixasDisponiveis();

  const createUser = api.student.create.useMutation();
  const updateUser = api.student.updateAvatar.useMutation();
  const { mutateAsync: uploadFile } = api.files.upload.useMutation();

  const form = useForm<IStudentCreateTypes>({
    resolver: zodResolver(createStudentSchema),
    defaultValues: defaultCreateStudentValues,
    mode: 'onChange',
  });

  /* As modalidades ativas, na ordem da academia: cada uma pode virar uma
     matrícula, tenha faixa ou não (boxe também se matricula), e leva junto
     o catálogo de faixas dela, quando tem. */
  const modalidadesApi = api.modalities.list.useQuery(undefined, {
    staleTime: 60_000,
  });
  const modalidadesAtivas = (modalidadesApi.data ?? [])
    .filter((m) => m.isActive)
    .map(({ id, name }) => ({
      id,
      name,
      graduations: comFaixas.find((m) => m.id === id)?.graduations ?? [],
    }));
  const enrollmentsError =
    form.formState.errors.enrollments?.message ??
    form.formState.errors.enrollments?.root?.message ??
    (Array.isArray(form.formState.errors.enrollments)
      ? form.formState.errors.enrollments.find(Boolean)?.planId?.message
      : undefined);

  const onSubmit = async (data: IStudentCreateTypes) => {
    try {
      const userCreated = await createUser.mutateAsync(data);

      let avatarRealUrl = '';
      if (data.avatarUrl) {
        const base64 = await blobUrlToBase64(data.avatarUrl);

        const result = await uploadFile({
          filename: `avatar_${data.name}`,
          file: base64,
        });

        avatarRealUrl = result.url;
      }

      await updateUser.mutateAsync({
        avatarUrl: avatarRealUrl,
        studentId: userCreated.data.id,
      });

      form.reset(defaultCreateStudentValues);
      setIsOpen(false);
      if (refetch) refetch();

      toast({
        title: 'Aluno criado',
        description: 'O aluno foi matriculado com sucesso.',
        variant: 'default',
      });
    } catch (error) {
      /* A mensagem do servidor diz o que houve ("Email já cadastrado",
         "Graduação não encontrada nesta academia"); o genérico fica para o
         erro que não tem uma. */
      toast({
        title: 'Erro',
        description:
          error instanceof TRPCClientError && error.message
            ? error.message
            : 'Não foi possível criar o aluno.',
        variant: 'destructive',
      });
      console.error(error);
    }
  };

  // useWatch e não form.watch: este é analisável pelo React Compiler
  const watchedName = useWatch({ control: form.control, name: 'name' });
  const isSubmitting = createUser.isPending || form.formState.isSubmitting;

  return (
    <Form {...form}>
      <FormModal
        open={isOpen}
        onOpenChange={setIsOpen}
        title="Criar novo aluno"
        description="Preencha os dados abaixo para matricular um aluno."
        onSubmit={form.handleSubmit(onSubmit)}
        submitLabel="Criar aluno"
        submitPendingLabel="Criando aluno..."
        isSubmitting={isSubmitting}
      >
        <AvatarField
          control={form.control}
          name="avatarUrl"
          fallback={watchedName ? getInitials(watchedName) : undefined}
        />

        <Separator />

        <section className="space-y-4">
          <h3 className="text-muted-foreground text-xs font-medium uppercase">
            Dados pessoais
          </h3>

          {/* Dois a dois: em uma coluna só o formulário passava da altura da
              janela e obrigava a rolar para chegar no botão. */}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormInputComponent
              control={form.control}
              name="name"
              label="Nome do aluno"
              type="text"
              mask={maskOnlyText}
              placeholder="Nome completo"
              maxLength={50}
            />

            <FormInputComponent
              control={form.control}
              name="email"
              label="E-mail"
              type="email"
              placeholder="exemplo@exemplo.com"
              maxLength={50}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormInputComponent
              control={form.control}
              name="birthDate"
              label="Data de nascimento"
              type="text"
              mask={maskDate}
              placeholder="DD/MM/AAAA"
              maxLength={10}
            />

            <FormInputComponent
              control={form.control}
              name="phone"
              label="Telefone"
              mask={maskCellphone}
              unmask={unmaskCellphone}
              placeholder="(XX) XXXXX-XXXX"
              maxLength={15}
            />
          </div>
        </section>

        <Separator />

        <section className="space-y-4">
          <h3 className="text-muted-foreground text-xs font-medium uppercase">
            Matrícula
          </h3>

          <EnrollmentsField
            control={form.control}
            setValue={form.setValue}
            modalidades={modalidadesAtivas}
            carregando={modalidadesApi.isLoading}
            erro={modalidadesApi.isError && !modalidadesApi.data}
            tentarDeNovo={() => void modalidadesApi.refetch()}
            planos={(plansData?.data ?? []).map((plan) => ({
              ...plan,
              price: Number(plan.price),
            }))}
            defaultPlanId={defaultPlanId}
            desconto={pricing?.multiModalityDiscount ?? 0}
            open={isOpen}
            error={enrollmentsError}
          />
        </section>
      </FormModal>
    </Form>
  );
};
