'use client';

import { FormModal } from '@/components/formModal/formModal.component';
import React, { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { Form } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { FormInputComponent } from '@/components/forms/formInput/formInput.component';
import { AvatarField } from '@/components/forms/avatarField/avatarField.component';
import {
  maskCellphone,
  maskDate,
  maskOnlyText,
  unmaskCellphone,
  getInitials,
} from '@/utils/masksUtils';
import { Separator } from '@/components/ui/separator';
import { api } from '@/trpc/react';
import {
  IUpdateStudentTypes,
  updateStudentSchema,
} from '@/server/validations/students';
import { blobUrlToBase64 } from '@/common/utils/files';
import { ISheetEditStudent } from './sheetEditStudent.types';

export const SheetEditStudent: React.FC<ISheetEditStudent> = ({
  isOpen,
  setIsOpen,
  studentId,
  refetch,
}) => {
  const { toast } = useToast();
  const studentEdit = api.student.getByID.useQuery({ id: studentId });
  const updateStudent = api.student.updateByID.useMutation();
  const updateUserAvatar = api.student.updateAvatar.useMutation();
  const { mutateAsync: uploadFile } = api.files.upload.useMutation();

  const form = useForm<IUpdateStudentTypes>({
    resolver: zodResolver(updateStudentSchema),
    defaultValues: {
      id: '',
      name: '',
      email: '',
      phone: '',
      avatarUrl: '',
      birthDate: '',
    },
    mode: 'onChange',
  });

  useEffect(() => {
    const user = studentEdit.data?.data;
    if (user) {
      form.reset({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatarUrl: user.avatar ?? '',
        birthDate: user.birthDate
          ? maskDate(new Date(user.birthDate).toLocaleDateString('pt-BR'))
          : '',
      });
    }
  }, [studentEdit.data, form]);

  const watchedName = useWatch({ control: form.control, name: 'name' });

  const onSubmit = async (data: IUpdateStudentTypes) => {
    try {
      const updated = await updateStudent.mutateAsync(data);

      if (data.avatarUrl && data.avatarUrl !== studentEdit.data?.data.avatar) {
        const base64 = await blobUrlToBase64(data.avatarUrl);
        const safeFilename = `avatar_${updated.data.id}`;
        const uploadResult = await uploadFile({
          filename: safeFilename,
          file: base64,
        });
        if (!uploadResult.url) throw new Error('Falha no upload do avatar');

        await updateUserAvatar.mutateAsync({
          avatarUrl: uploadResult.url,
          studentId: updated.data.id,
        });
      }

      setIsOpen(false);
      refetch?.();

      toast({
        title: 'Sucesso',
        description: 'Dados atualizados com sucesso',
        variant: 'default',
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Ocorreu um erro inesperado';
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
      console.error(err);
    }
  };

  return (
    <Form {...form}>
      <FormModal
        open={isOpen}
        onOpenChange={setIsOpen}
        title="Editar aluno"
        description="Altere os dados do aluno"
        onSubmit={form.handleSubmit(onSubmit)}
        submitLabel="Salvar alterações"
        submitPendingLabel="Salvando..."
        isSubmitting={updateStudent.isPending || form.formState.isSubmitting}
      >
        <AvatarField
          control={form.control}
          name="avatarUrl"
          fallback={watchedName ? getInitials(watchedName) : undefined}
        />

        <Separator />

        <div className="grid grid-cols-4 gap-6">
          <div className="col-span-2">
            <FormInputComponent
              control={form.control}
              name="name"
              label="Nome do aluno"
              type="text"
              mask={maskOnlyText}
              placeholder="Nome completo"
              maxLength={50}
            />
          </div>
          <div className="col-span-2">
            <FormInputComponent
              control={form.control}
              name="email"
              label="Email do aluno"
              type="email"
              placeholder="exemplo@exemplo.com"
              maxLength={50}
            />
          </div>
          <div className="col-span-2">
            <FormInputComponent
              control={form.control}
              name="birthDate"
              label="Data de nascimento"
              type="text"
              mask={maskDate}
              placeholder="DD/MM/AAAA"
              maxLength={10}
            />
          </div>
          <div className="col-span-2">
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
        </div>
      </FormModal>
    </Form>
  );
};
