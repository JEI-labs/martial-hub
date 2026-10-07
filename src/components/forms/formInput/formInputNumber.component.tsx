import React from 'react';

import type {
  FieldPath,
  FieldValues,
  UseControllerProps,
} from 'react-hook-form';
import { Controller } from 'react-hook-form';

import { Minus, Plus } from 'lucide-react';
import type { FormInputComponentProps } from './formInput.component.types';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export const FormInputNumberComponent = <
  T extends FieldValues,
  TTransformed = T,
>({
  control,
  name,
  description,
  rules,
  mask,
  unmask,
  hideErrors,
  ...props
}: UseControllerProps<T, FieldPath<T>, TTransformed> &
  FormInputComponentProps): React.JSX.Element => {
  const handleRemoveMask = (value: string): string => {
    if (unmask) {
      return unmask(value).toString();
    }

    return value;
  };

  const handleChangeText = (value: string): string => {
    if (!value.trim().length) {
      return '';
    }
    return handleRemoveMask(value);
  };

  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={(): React.JSX.Element => {
        return (
          <FormField
            control={control}
            name={name}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{props.label}</FormLabel>
                <FormControl>
                  <div className="flex w-full">
                    <Button
                      type="button"
                      variant="secondary"
                      className="rounded-se-none rounded-ee-none border"
                      onClick={() => {
                        field.onChange(
                          (parseInt(field.value, 10) - 1 >= 0
                            ? parseInt(field.value, 10) - 1
                            : 0
                          ).toString(),
                        );
                      }}
                    >
                      <Minus size={18} />
                    </Button>
                    <div className="relative w-full">
                      {props.icon}
                      <Input
                        {...field}
                        {...props}
                        className={cn(
                          props.className,
                          props.icon ? 'pl-11' : '',
                          'rounded-none text-center',
                        )}
                        value={mask ? mask(field.value) : field.value}
                        placeholder={props.placeholder}
                        onChange={(
                          event: React.ChangeEvent<HTMLInputElement>,
                        ): void => {
                          const formattedValue = handleChangeText(
                            event.currentTarget.value,
                          );
                          field.onChange(formattedValue);
                        }}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      className="rounded-ss-none rounded-es-none border"
                      onClick={() => {
                        field.onChange(
                          (parseInt(field.value, 10) + 1).toString(),
                        );
                      }}
                    >
                      <Plus size={18} />
                    </Button>
                  </div>
                </FormControl>
                {description && (
                  <FormDescription className="text-xs">
                    {description}
                  </FormDescription>
                )}
                {!hideErrors && <FormMessage />}
              </FormItem>
            )}
          />
        );
      }}
    />
  );
};
