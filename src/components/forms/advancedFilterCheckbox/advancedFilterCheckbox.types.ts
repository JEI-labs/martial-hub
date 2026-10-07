import * as React from 'react';

import { SelectItemType } from '@/common/types/select';
import { ButtonProps } from '@/components/ui/button';

export interface AdvancedFilterCheckboxProps {
  open?: boolean;
  defaultValue?: Array<AdvancedFilterCheckboxType>;
  options: Array<AdvancedFilterCheckboxType>;
  title: string;
  showCounterIndicator?: boolean;
  description?: string;
  buttonProps?: ButtonProps;
  leftIcon?: React.JSX.Element;
  rightIcon?: React.JSX.Element;
  showDeleteButton?: boolean;
  onDelete?: () => void;
  onChange?: (_values: Array<AdvancedFilterCheckboxType>) => void;
}

export interface AdvancedFilterCheckboxType extends SelectItemType {
  checked?: boolean;
}
