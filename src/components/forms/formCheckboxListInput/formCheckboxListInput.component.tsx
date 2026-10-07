import React from 'react';

import {
  Controller,
  FieldPath,
  FieldValues,
  UseControllerProps,
} from 'react-hook-form';

import { FormCheckboxListComponentProps } from './formCheckboxListInput.types';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';

export const FormCheckboxListComponent = <
  T extends FieldValues,
  TTransformed = T,
>({
  control,
  name,
  rules,
  options = [],
  ...props
}: UseControllerProps<T, FieldPath<T>, TTransformed> &
  FormCheckboxListComponentProps): React.JSX.Element => {
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
                {props.description?.length || props.title?.length ? (
                  <div className="mb-4">
                    {props.title?.length ? (
                      <FormLabel className="text-base">{props.title}</FormLabel>
                    ) : null}
                    {props.description?.length ? (
                      <FormDescription>{props.description}</FormDescription>
                    ) : null}
                  </div>
                ) : null}

                {options.map((item) => (
                  <FormField
                    key={item.id}
                    control={control}
                    name={name}
                    render={({ field }) => {
                      return (
                        <FormItem
                          key={item.id}
                          className="flex flex-row items-start space-y-0 space-x-3"
                        >
                          <FormControl>
                            <Checkbox
                              checked={field.value?.includes(item.id)}
                              onCheckedChange={(checked) => {
                                return checked
                                  ? field.onChange([...field.value, item.id])
                                  : field.onChange(
                                      field.value?.filter(
                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                        (value: any) => value !== item.id,
                                      ),
                                    );
                              }}
                            />
                          </FormControl>
                          <FormLabel className="font-normal hover:cursor-pointer">
                            {item.label}
                          </FormLabel>
                        </FormItem>
                      );
                    }}
                  />
                ))}
                <FormMessage />
              </FormItem>
            )}
          />
        );
      }}
    />
  );
};
