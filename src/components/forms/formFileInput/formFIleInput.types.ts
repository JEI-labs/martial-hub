import { InputProps } from '@/components/ui/input';
import { FormEventHandler } from 'react';

export interface FormInputFileComponentProps extends Omit<
  InputProps,
  'onInput'
> {
  label?: string;
  labelClassName?: string;
  description?: string;
  hideErrors?: boolean;
  icon?: React.JSX.Element;
  onInput?: FormEventHandler<HTMLInputElement>;
  generalclassname?: string;
  cardClassname?: string;
  defaultImageUrl?: string;
  showPreview?: boolean;
}
