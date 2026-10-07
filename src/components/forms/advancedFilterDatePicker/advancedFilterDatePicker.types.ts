import * as React from 'react';

import { ButtonProps } from '@/components/ui/button';
import { DateRange } from 'react-day-picker';

export interface AdvancedFilterDatePickerProps {
  open?: boolean;
  defaultValue?: AdvancedFilterDatePickerType;
  title: string;
  description?: string;
  onChange?: (_values: AdvancedFilterDatePickerType) => void;
  buttonProps?: ButtonProps;
  leftIcon?: React.JSX.Element;
  rightIcon?: React.JSX.Element;
  onDelete?: () => void;
  showDeleteButton?: boolean;
  numberOfMonths?: number;
}

export interface AdvancedFilterDatePickerType extends DateRange {
  label?: string;
}
