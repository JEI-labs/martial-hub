import { FieldHint } from '@/components/forms/fieldHint/fieldHint.component';
import React from 'react';
import type {
  FieldPath,
  FieldValues,
  UseControllerProps,
} from 'react-hook-form';
import { Controller } from 'react-hook-form';
import type { FormSelectComponentProps } from './formSelectInput.component.types';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * Valor da opção "em branco". O Radix não aceita SelectItem com value vazio,
 * então a ausência vira um valor sentinela aqui dentro e volta a ser `null`
 * no formulário — quem usa o componente não precisa saber disso.
 */
const NONE_VALUE = '__none__';

export const FormSelectComponent = <T extends FieldValues, TTransformed = T>({
  control,
  name,
  rules,
  hideErrors,
  options = [],
  hasEmptyOption = false,
  description,
  ...props
}: UseControllerProps<T, FieldPath<T>, TTransformed> &
  FormSelectComponentProps): React.JSX.Element => {
  const extendedOptions = hasEmptyOption
    ? [
        { value: NONE_VALUE, textValue: props.placeholder ?? '-', icon: null },
        ...options,
      ]
    : options;

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
                className={cn(props.label && 'space-y-3', props.className)}
              >
                {/* Sem rótulo o bloco não é renderizado: como filtro de
                    barra, um label vazio ocupava altura e desalinhava o
                    campo em relação à busca ao lado. */}
                {(props.label || description) && (
                  <div className="flex flex-col">
                    {props.label && (
                      <FormLabel>
                        {props.label}
                        {props.tooltip && <FieldHint text={props.tooltip} />}
                      </FormLabel>
                    )}
                    {description && (
                      <FormLabel className="text-muted-foreground text-xs">
                        {description}
                      </FormLabel>
                    )}
                  </div>
                )}
                <Select
                  {...props}
                  onValueChange={(value) => {
                    const parsed = value === NONE_VALUE ? null : value;
                    field.onChange(parsed);
                    if (props.onValueChange) {
                      props.onValueChange(value);
                    }
                  }}
                  value={
                    field.value === null || field.value === undefined
                      ? hasEmptyOption
                        ? NONE_VALUE
                        : undefined
                      : field.value
                  }
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={props.placeholder} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {extendedOptions.map((item) => (
                      <SelectItem
                        {...item}
                        value={item.value as string}
                        key={`${item.value}_${item.textValue}`}
                      >
                        <div className="flex items-center gap-2">
                          {item.icon}
                          {item.textValue}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!hideErrors && <FormMessage />}
              </FormItem>
            )}
          />
        );
      }}
    />
  );
};
