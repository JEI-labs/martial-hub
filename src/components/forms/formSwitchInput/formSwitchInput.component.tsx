import React from 'react';
import { Controller } from 'react-hook-form';
import type {
  FieldPath,
  FieldValues,
  UseControllerProps,
} from 'react-hook-form';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import type { FormSwitchComponentProps } from './formSwitchInput.types';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';

export const FormSwitchComponent = <T extends FieldValues, TTransformed = T>({
  control,
  name,
  rules,
  ...props
}: UseControllerProps<T, FieldPath<T>, TTransformed> &
  FormSwitchComponentProps): React.JSX.Element => {
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
              <FormItem
                className={cn(
                  'flex flex-col',
                  props.asCard &&
                    'bg-muted/40 flex w-full flex-row items-center justify-between rounded-xl p-4',
                  props.className,
                )}
              >
                <div className={cn('flex flex-col')}>
                  {props.title?.length && (
                    <FormLabel className="text-sm">{props.title}</FormLabel>
                  )}
                  {props.topDescription && (
                    <FormDescription>{props.topDescription}</FormDescription>
                  )}
                </div>
                <div className="flex flex-col">
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={props.disabled}
                    />
                  </FormControl>
                  {props.bottomDescription && (
                    <FormDescription className="text-xs">
                      {props.bottomDescription}
                    </FormDescription>
                  )}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        );
      }}
    />
  );
};
