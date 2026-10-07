import React, { useState } from 'react';
import { X, Search as SearchIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchProps {
  id?: string;
  placeholder: string;
  onSearch?: (_value: string) => void;
  defaultValue?: string;
  className?: string;
}

const Search: React.FC<SearchProps> = ({
  id = 'search',
  placeholder,
  onSearch,
  defaultValue = '',
  className = '',
}) => {
  const [value, setValue] = useState<string>(defaultValue);
  const [isFocused, setIsFocused] = useState<boolean>(false);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    setValue(newValue);
    onSearch?.(newValue);
  };

  const handleClear = () => {
    setValue('');
    onSearch?.('');
  };

  return (
    <div className={cn('relative flex w-full max-w-[350px]', className)}>
      <div
        className={cn(
          'bg-muted flex w-full items-center rounded-full border transition-all duration-200',
          isFocused
            ? 'border-primary/50 ring-primary/30 shadow-xs ring-1'
            : 'border-border',
        )}
      >
        <div className="text-muted-foreground flex items-center justify-center pl-3">
          <SearchIcon className="h-4 w-4" />
        </div>

        <input
          id={id}
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={cn(
            'h-10 grow bg-transparent px-2 py-2',
            'border-none outline-hidden focus:ring-0 focus:outline-hidden focus-visible:ring-0',
            'shadow-none focus:shadow-none',
          )}
        />

        {value.length > 0 && (
          <button
            onClick={handleClear}
            className="text-muted-foreground hover:bg-muted/30 mr-3 flex h-8 w-8 items-center justify-center rounded-full transition-colors"
            type="button"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default Search;
