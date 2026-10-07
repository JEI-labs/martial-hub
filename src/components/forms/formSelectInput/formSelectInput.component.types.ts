import type { SelectItemProps } from '@radix-ui/react-select';

export interface ExtendedSelectItemProps extends SelectItemProps {
  icon?: React.JSX.Element;
}

export interface FormSelectComponentProps {
  label?: string;
  hideErrors?: boolean;
  defaultValue?: string;
  onValueChange?(_value: string): void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?(_open: boolean): void;
  dir?: 'ltr' | 'rtl';
  autoComplete?: string;
  disabled?: boolean;
  required?: boolean;
  options?: Array<ExtendedSelectItemProps>;
  placeholder?: string;
  hasEmptyOption?: boolean;
  className?: string;
  description?: string;
  /** Texto de ajuda mostrado num tooltip ao lado do rótulo. */
  tooltip?: string;
}
