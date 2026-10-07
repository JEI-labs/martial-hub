'use client';

import * as React from 'react';

import { Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useBoolean } from '@/hooks/useBooleanState/useBooleanState.hook';
import { useArrayState } from '@/hooks/useArrayState';
import {
  AdvancedFilterCheckboxProps,
  AdvancedFilterCheckboxType,
} from './advancedFilterCheckbox.types';
import { ScrollArea } from '@/components/ui/scroll-area';

export function AdvancedFilterCheckbox({
  showDeleteButton = true,
  ...props
}: Readonly<AdvancedFilterCheckboxProps>): React.JSX.Element {
  const open = useBoolean(props.open);
  const data = useArrayState<AdvancedFilterCheckboxType>(
    props.defaultValue ?? [],
  );

  const handleSelectOption = (
    event: Event,
    option: AdvancedFilterCheckboxType,
  ): void => {
    event.preventDefault();
    let newState: Array<AdvancedFilterCheckboxType>;

    const index = data.state.findIndex((item) => item.id === option.id);

    if (index >= 0) {
      newState = data.actions.remove(index);
    } else {
      newState = data.actions.add(option);
    }

    if (props?.onChange) props?.onChange(newState);
  };

  const handleEraseAll = (): void => {
    data.actions.setData([]);
    if (props?.onChange) props?.onChange([]);
  };

  React.useEffect(() => {
    data.actions.setData(props.defaultValue ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.defaultValue]);

  return (
    <DropdownMenu open={open.value} onOpenChange={open.actions.setValue}>
      <DropdownMenuTrigger asChild>
        <Button className="gap-2" variant="outline" {...props.buttonProps}>
          {props.leftIcon}
          {props.title}{' '}
          {props.showCounterIndicator ? `(${data.state.length})` : null}
          {props.rightIcon}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <div className="flex items-center justify-between">
          <DropdownMenuLabel>
            {props?.description ?? 'Selecione as opções abaixo'}
          </DropdownMenuLabel>
          {showDeleteButton && (
            <Button variant="ghost" onClick={props.onDelete}>
              <Trash2 size={16} />
            </Button>
          )}
        </div>

        <DropdownMenuSeparator />
        <ScrollArea className="max-h-[200px] overflow-y-auto">
          {props.options.map((item) => (
            <DropdownMenuCheckboxItem
              key={item.id}
              checked={Boolean(
                data.state.find((option) => option.id === item.id),
              )}
              onSelect={(event) => handleSelectOption(event, item)}
            >
              {item.label}
            </DropdownMenuCheckboxItem>
          ))}
        </ScrollArea>
        <DropdownMenuSeparator />

        <Button className="gap-2" variant="link" onClick={handleEraseAll}>
          <Trash2 size={16} /> Apagar seleção
        </Button>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
