import { cn } from '@/lib/utils';
import { Upload } from 'lucide-react';
import Image from 'next/image';
import React, { useState } from 'react';
import type {
  FieldPath,
  FieldValues,
  Path,
  UseControllerProps,
} from 'react-hook-form';
import { Controller } from 'react-hook-form';
import { FormInputFileComponentProps } from './formFIleInput.types';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export const FormFileInputComponent = <
  T extends FieldValues,
  TTransformed = T,
>({
  control,
  name,
  rules,
  hideErrors,
  accept = '*',
  showPreview = false,
  cardClassname,
  generalclassname,
  label,
}: UseControllerProps<T, FieldPath<T>, TTransformed> &
  FormInputFileComponentProps): React.JSX.Element => {
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  return (
    <Controller
      control={control}
      name={name as Path<T>}
      rules={rules}
      render={({ field }) => {
        // se já houver um valor inicial no field.value, use-o como preview
        const previewSrc =
          showPreview &&
          (previewUrl ??
            (typeof field.value === 'string' ? field.value : null));

        return (
          <FormField
            control={control}
            name={name as Path<T>}
            render={() => (
              <FormItem className={cn(generalclassname)}>
                <div className="text-muted-foreground grid gap-2">
                  <FormLabel className="text-muted-foreground grid gap-1">
                    <div className="flex items-center">
                      <p className="text-sm md:text-base">{label}</p>
                      {rules?.required && (
                        <span className="ml-1 text-red-400">*</span>
                      )}
                    </div>

                    <div
                      className={cn(
                        'flex w-full flex-col items-center gap-4 overflow-auto rounded-md border p-2 wrap-break-word whitespace-normal sm:flex-row sm:p-4',
                        cardClassname,
                      )}
                    >
                      {/* 1) Preview da imagem (inicial ou selecionada) */}
                      {previewSrc && (
                        <Image
                          src={previewSrc}
                          alt="Preview do arquivo"
                          width={80}
                          height={80}
                          className="h-20 w-20 rounded-md object-cover sm:h-24 sm:w-24"
                        />
                      )}

                      {/* 2) Botão para escolher arquivo */}
                      <label
                        className={cn(
                          buttonVariants({ variant: 'default' }),
                          'flex cursor-pointer items-center gap-2 text-center sm:w-auto',
                        )}
                      >
                        <Upload className="h-4 w-4" />
                        {fileName ? 'Trocar Arquivo' : 'Escolher Arquivo'}
                        <Input
                          type="file"
                          accept={accept}
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const url = URL.createObjectURL(file);
                            setFileName(file.name);
                            setPreviewUrl(url);
                            field.onChange(url);
                          }}
                        />
                      </label>

                      {/* 3) Nome do arquivo e botão de remover */}
                      {fileName && (
                        <div className="flex w-full max-w-full items-center">
                          <p
                            className="w-full max-w-full overflow-hidden text-center text-sm wrap-break-word whitespace-normal sm:text-left sm:text-base"
                            title={fileName}
                          >
                            Anexado: {fileName}
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setFileName(null);
                              setPreviewUrl(null);
                              field.onChange(null);
                            }}
                            className="text-destructive-text hover:text-destructive-text/70 ml-2 flex"
                          >
                            Remover
                          </button>
                        </div>
                      )}
                    </div>
                  </FormLabel>

                  <FormControl />

                  <div className="flex flex-col justify-between sm:flex-row">
                    {!hideErrors && <FormMessage />}
                    <FormDescription className="text-muted-foreground/50 mt-1 text-right sm:mt-0">
                      * arquivos aceitos: {accept}
                    </FormDescription>
                  </div>
                </div>
              </FormItem>
            )}
          />
        );
      }}
    />
  );
};
