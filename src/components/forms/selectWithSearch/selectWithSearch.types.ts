import { ButtonProps } from '@/components/ui/button';

export interface SelectWithSearchProps extends Omit<
  ButtonProps,
  'onChange' | 'value'
> {
  label?: string;
  options?: Array<{
    value: string | null;
    textValue: string;
  }>;
  placeholder?: string;
  value?: string | null;
  onValueChange?: (_value: string | null) => void;
  disabled?: boolean;
  hasEmptyOption?: boolean;
}
