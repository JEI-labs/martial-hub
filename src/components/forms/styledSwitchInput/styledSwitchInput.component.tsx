import React from 'react';
import type { StyledSwitchComponentProps } from './styledSwitchInput.types';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';

export const StyledSwitchComponent = ({
  ...props
}: StyledSwitchComponentProps): React.JSX.Element => {
  return (
    <div
      className={cn(
        'bg-muted/40 flex w-full items-center justify-between rounded-xl p-4',
        props.className,
      )}
    >
      <div className={cn('flex flex-col')}>
        {props.title && (
          <span className="text-sm font-semibold">{props.title}</span>
        )}
        {props.topDescription && (
          <span className="text-muted-foreground max-w-[90%] text-sm">
            {props.topDescription}
          </span>
        )}
      </div>
      <div className="flex flex-col">
        <Switch
          checked={props.value}
          onCheckedChange={props.onChange}
          disabled={props.disabled}
        />
        {props.bottomDescription && (
          <div className="text-xs">{props.bottomDescription}</div>
        )}
      </div>
    </div>
  );
};
