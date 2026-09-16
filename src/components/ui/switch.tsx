'use client';

import { cn } from '@/utils/cn';
import { forwardRef } from 'react';

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  onCheckedChange?: (checked: boolean) => void;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, onCheckedChange, ...props }, ref) => (
    <input
      type="checkbox"
      role="switch"
      className={cn(
        'peer h-6 w-11 shrink-0 rounded-full border border-input bg-input transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:border-primary after:pointer-events-none after:h-5 after:w-5 after:rounded-full after:border after:bg-background after:transition-all after:translate-x-0 data-[state=checked]:after:translate-x-full',
        className
      )}
      ref={ref}
      onChange={e => onCheckedChange?.(e.target.checked)}
      {...props}
    />
  )
);

Switch.displayName = 'Switch';
