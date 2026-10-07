import { FieldHint } from '@/components/forms/fieldHint/fieldHint.component';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { cn } from '@/lib/utils';
import React from 'react';

import type {
  FieldPath,
  FieldValues,
  UseControllerProps,
} from 'react-hook-form';
import { Controller } from 'react-hook-form';
import { FormTextAreaComponentProps } from './formTextArea.types';
import { Textarea } from './TextArea';

export const FormTextAreaComponent = <T extends FieldValues, TTransformed = T>({
  control,
  name,
  description,
  rules,
  mask,
  unmask,
  hideErrors,
  ...props
}: UseControllerProps<T, FieldPath<T>, TTransformed> &
  FormTextAreaComponentProps): React.JSX.Element => {
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
              <FormItem className={cn(props.generalclassname ?? '')}>
                <FormLabel>
                  {props.label}
                  {props.tooltip && <FieldHint text={props.tooltip} />}
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    {props.icon}
                    <Textarea
                      {...field}
                      {...props}
                      className={cn(props.className, props.icon ? 'pl-11' : '')}
                      value={mask ? mask(field.value) : field.value}
                      placeholder={props.placeholder}
                      onInput={(
                        event: React.InputEvent<HTMLTextAreaElement>,
                      ): void => {
                        const formattedValue = handleChangeText(
                          event.currentTarget.value,
                        );
                        field.onChange(formattedValue);
                      }}
                    />
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
