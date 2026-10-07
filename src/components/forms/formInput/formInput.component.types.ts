import * as React from 'react';

import { InputProps } from '@/components/ui/input';

export interface FormInputComponentProps extends InputProps {
  mask?: (_value: string) => string;
  unmask?: (_value: string) => string | number;
  label?: string | React.JSX.Element;
  description?: string;
  /** Texto de ajuda mostrado num tooltip ao lado do rótulo. */
  tooltip?: string;
  hideErrors?: boolean;
  icon?: React.JSX.Element;
  generalclassname?: string;
}
