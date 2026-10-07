import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { SelectWithSearchProps } from './selectWithSearch.types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

export const SelectWithSearch: React.FC<SelectWithSearchProps> = ({
  label,
  options = [],
  placeholder = 'Selecione uma opção',
  onValueChange,
  value,
  disabled,
  hasEmptyOption = false,
  ...props
}) => {
  const [open, setOpen] = useState(false);

  const extendedOptions = hasEmptyOption
    ? [{ value: null, textValue: placeholder }, ...options]
    : options;

  const selectedOption = extendedOptions.find(
    (option) => option.value === value,
  );

  const handleSelect = (selectedValue: string | null) => {
    if (onValueChange) {
      onValueChange(selectedValue);
    }
    setOpen(false);
  };

  return (
    <div className={cn(props.className)}>
      {label && (
        <label className="mb-2 block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between py-6"
            disabled={disabled}
            {...props}
          >
            {selectedOption?.textValue || placeholder}
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          <Command>
            <CommandInput placeholder="Buscar..." />
            <CommandList>
              <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
              <CommandGroup>
                {extendedOptions.map((option) => (
                  <CommandItem
                    key={`${option.value}_${option.textValue}`}
                    onSelect={() => handleSelect(option.value)}
                  >
                    {option.textValue}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};
