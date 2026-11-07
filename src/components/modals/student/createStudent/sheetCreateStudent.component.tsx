'use client';

import {
  GraduationBadge,
  descreverGraduacao,
} from '@/components/graduationBadge/graduationBadge.component';
import { FormModal } from '@/components/formModal/formModal.component';

import { zodResolver } from '@hookform/resolvers/zod';
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
import { FormSelectComponent } from '@/components/forms/formSelectInput/formSelectInput.component';
import { getInitials } from '@/utils/masksUtils';

export const SheetCreateStudent: React.FC<SheetCreateStudentProps> = ({
  isOpen,
  setIsOpen,
  refetch,
}) => {
  const { toast } = useToast();

  const plansApi = api.plans.getAll.useQuery({ page: 1, limit: 100 });
  const { data: plansData } = plansApi;
  const defaultPlanId = plansData?.data.find((plan) => plan.isDefault)?.id;

  /* As faixas das modalidades ativas que têm faixa. Boxe e afins não entram,
     e academia sem nenhuma não mostra o campo. */
  const { data: modalidades } = api.graduations.list.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
  const comFaixas = (modalidades ?? []).filter(
    (modalidade) => modalidade.graduations.length > 0,
  );
  const variasModalidades = comFaixas.length > 1;
  const opcoesDeGraduacao = comFaixas.flatMap((modalidade) =>
    modalidade.graduations.map((faixa) => ({
      value: faixa.id,
      textValue: [
        variasModalidades ? modalidade.name : null,
        descreverGraduacao(faixa).split(' · ')[0],
        faixa.name,
      ]
        .filter(Boolean)
        .join(' · '),
      icon: <GraduationBadge graduation={faixa} showLabel={false} />,
    })),
  );

  const createUser = api.student.create.useMutation();
  const updateUser = api.student.updateAvatar.useMutation();
  const { mutateAsync: uploadFile } = api.files.upload.useMutation();

  const form = useForm<IStudentCreateTypes>({
    resolver: zodResolver(createStudentSchema),
    defaultValues: defaultCreateStudentValues,
    mode: 'onChange',
  });

  /* As modalidades ativas, na ordem da academia: cada uma pode virar uma
     matrícula. Vêm da lista de graduações, que já traz só as ativas. */
  const modalidadesAtivas = (modalidades ?? []).map(({ id, name }) => ({
    id,
    name,
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
      toast({
        title: 'Erro',
        description: 'Não foi possível criar o aluno.',
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
            planos={(plansData?.data ?? []).map((plan) => ({
              ...plan,
              price: Number(plan.price),
            }))}
            defaultPlanId={defaultPlanId}
            open={isOpen}
            error={enrollmentsError}
          />

          {opcoesDeGraduacao.length > 0 && (
            <FormSelectComponent
              control={form.control}
              name="graduationId"
              label="Graduação"
              tooltip="Faixa atual do aluno. Pode ficar em branco até a primeira graduação."
              placeholder="Sem graduação"
              /* aluno novo entra sem graduação, e dá para voltar a esse estado */
              hasEmptyOption
              options={opcoesDeGraduacao}
            />
          )}
        </section>
      </FormModal>
    </Form>
  );
};
