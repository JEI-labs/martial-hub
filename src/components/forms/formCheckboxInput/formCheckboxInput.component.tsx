import React from 'react';

import {
  Controller,
  FieldPath,
  FieldValues,
  UseControllerProps,
} from 'react-hook-form';

import { FormCheckboxComponentProps } from './formCheckboxInput.types';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';

export const FormCheckboxComponent = <T extends FieldValues, TTransformed = T>({
  control,
  name,
  rules,
  ...props
}: UseControllerProps<T, FieldPath<T>, TTransformed> &
  FormCheckboxComponentProps): React.JSX.Element => {
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
            render={() => (
              <FormItem>
                {props.topDescription?.length || props.title?.length ? (
                  <div className="mb-4">
                    {props.title?.length ? (
                      <FormLabel className="text-base">{props.title}</FormLabel>
                    ) : null}
                    {props.topDescription?.length ? (
                      <FormDescription>{props.topDescription}</FormDescription>
                    ) : null}
                  </div>
                ) : null}

                <FormField
                  control={control}
                  name={name}
                  render={({ field }) => {
                    return (
                      <FormItem className="flex flex-row items-start space-y-0 space-x-3">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={props.disabled}
                          />
                        </FormControl>

                        {props.label?.length ? (
                          <FormLabel className="font-normal hover:cursor-pointer">
                            {props.label}
                          </FormLabel>
                        ) : null}

                        {props.bottomDescription?.length ? (
                          <FormDescription>
                            {props.bottomDescription}
                          </FormDescription>
                        ) : null}
                      </FormItem>
                    );
                  }}
                />
                <FormMessage />
              </FormItem>
            )}
          />
        );
      }}
    />
  );
};
