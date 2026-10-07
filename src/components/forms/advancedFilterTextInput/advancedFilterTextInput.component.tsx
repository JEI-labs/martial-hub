'use client';

import * as React from 'react';

import { Trash2 } from 'lucide-react';
import type { DefaultValues, FieldValues, Resolver } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import lodash from 'lodash';
import { Button } from '@/components/ui/button';
import {
  DropdownMenuLabel,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { AdvancedFilterTextInputProps } from './advancedFilterTextInput.types';
import { useBoolean } from '@/hooks/useBooleanState/useBooleanState.hook';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FormInputComponent } from '../formInput/formInput.component';
import { Form } from '@/components/ui/form';

export function AdvancedFilterTextInput<T extends FieldValues>({
  showDeleteButton = true,
  defaultValue,
  onChange,
  rightIcon,
  leftIcon,
  title,
  onDelete,
  validationMode,
  buttonProps,
  ...props
}: Readonly<AdvancedFilterTextInputProps<T>>): React.JSX.Element {
  const open = useBoolean(props.open);

  const inputProps = lodash.omit(props, ['zodResolver', 'description']);

  const form = useForm<T, unknown, T>({
    // The schema arrives as an opaque `ZodType` prop, so its relationship to the
    // caller's `T` is a runtime contract TypeScript cannot verify.
    resolver: props.zodResolver
      ? (zodResolver(props.zodResolver as never) as Resolver<T, unknown, T>)
      : undefined,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    defaultValues: defaultValue ?? ({ [props.name]: '' } as DefaultValues<T>),
    mode: validationMode ?? 'onSubmit',
  });

  const onSubmit = (data: T): void => {
    if (onChange) {
      onChange(data[props.name]);
    }
  };

  React.useEffect(() => {
    if (!open.value) {
      const submit = form.handleSubmit(onSubmit);
      submit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open?.value]);

  return (
    <DropdownMenu open={open.value} onOpenChange={open.actions.setValue}>
      <DropdownMenuTrigger asChild>
        <Button className="gap-2" variant="outline" {...buttonProps}>
          {leftIcon}
          {title}
          {rightIcon}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <div className="flex items-center justify-between">
          <DropdownMenuLabel>
            {props?.description ?? 'Informe os dados abaixo'}
          </DropdownMenuLabel>
          {showDeleteButton && (
            <Button variant="ghost" onClick={onDelete}>
              <Trash2 size={16} />
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        <ScrollArea className="max-h-[250px] w-[350px] overflow-y-auto">
          <Form {...form}>
            <form
              className="flex flex-col gap-3 p-3"
              onSubmit={(e) => {
                e.preventDefault();
              }}
            >
              <FormInputComponent
                {...inputProps}
                control={form.control}
                name={props.name}
                label={props.label}
                placeholder={props.placeholder}
                description={props.inputDescription}
              />
            </form>
          </Form>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
