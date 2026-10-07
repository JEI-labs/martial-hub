'use client';

import { useState } from 'react';
import { Trash2, Upload, User } from 'lucide-react';
import type { FieldPath, FieldValues, Path } from 'react-hook-form';
import { Controller, type Control } from 'react-hook-form';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button, buttonVariants } from '@/components/ui/button';
import { CameraCaptureButton } from '@/components/camera/camera.component';
import { cn } from '@/lib/utils';

interface AvatarFieldProps<T extends FieldValues, TTransformed = T> {
  control: Control<T, unknown, TTransformed>;
  name: FieldPath<T>;
  label?: string;
  accept?: string;
  /** Iniciais mostradas enquanto não há imagem. */
  fallback?: string;
}

/**
 * Campo de foto do aluno: preview circular com as ações ao lado, em vez do
 * cartão genérico de upload de arquivo — que é pensado para anexos e mostra
 * o nome do arquivo, não uma foto de perfil.
 */
export function AvatarField<T extends FieldValues, TTransformed = T>({
  control,
  name,
  label = 'Foto do aluno',
  accept = '.jpg,.jpeg,.png',
  fallback,
}: AvatarFieldProps<T, TTransformed>) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  return (
    <Controller
      control={control}
      name={name as Path<T>}
      render={({ field }) => {
        const preview =
          objectUrl ?? (typeof field.value === 'string' ? field.value : null);

        const clear = () => {
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          setObjectUrl(null);
          field.onChange('');
        };

        const setImage = (url: string) => {
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          setObjectUrl(url);
          field.onChange(url);
        };

        return (
          <div className="flex items-center gap-5">
            <Avatar className="border-border h-20 w-20 shrink-0 border">
              {preview ? (
                <AvatarImage
                  src={preview}
                  alt={label}
                  className="h-full w-full object-cover"
                />
              ) : null}
              <AvatarFallback className="bg-muted text-muted-foreground text-lg">
                {fallback?.trim() ? (
                  fallback
                ) : (
                  <User className="h-7 w-7" aria-hidden />
                )}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 space-y-2">
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-muted-foreground text-xs">
                  Opcional · JPG, JPEG ou PNG
                </p>
              </div>

              {/* uma linha só: antes o botão da câmera ocupava 100% e caía
                  para baixo, desalinhando a seção */}
              <div className="flex flex-wrap items-center gap-2">
                <label
                  className={cn(
                    buttonVariants({ variant: 'outline', size: 'sm' }),
                    'cursor-pointer',
                  )}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {preview ? 'Trocar' : 'Enviar foto'}
                  <input
                    type="file"
                    accept={accept}
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      setImage(URL.createObjectURL(file));
                      // permite reenviar o mesmo arquivo depois de remover
                      event.target.value = '';
                    }}
                  />
                </label>

                <CameraCaptureButton onCapture={setImage} />

                {preview && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive-text hover:text-destructive-text"
                    onClick={clear}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remover
                  </Button>
                )}
              </div>
            </div>
          </div>
        );
      }}
    />
  );
}
