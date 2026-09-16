'use client';

import { cn } from '@/utils/cn';
import { forwardRef } from 'react';

export interface ColorPickerProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const ColorPicker = forwardRef<HTMLInputElement, ColorPickerProps>(
  ({ className, ...props }, ref) => (
    <input
      type="color"
      ref={ref}
      className={cn('h-10 w-10 rounded-lg border border-input cursor-pointer', className)}
      {...props}
    />
  )
);

ColorPicker.displayName = 'ColorPicker';

// Also export a more advanced color picker component
export interface ColorPickerAdvancedProps {
  value: string;
  onChange: (color: string) => void;
  presetColors?: string[];
}

export function ColorPickerAdvanced({
  value,
  onChange,
  presetColors = [
    '#00BFA6',
    '#3B82F6',
    '#F59E0B',
    '#EF4444',
    '#8B5CF6',
    '#EC4899',
    '#06B6D4',
    '#10B981',
  ],
}: ColorPickerAdvancedProps) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-10 w-10 rounded-lg border border-input cursor-pointer"
      />
      <div className="flex flex-wrap gap-1">
        {presetColors.map(color => (
          <button
            key={color}
            onClick={() => onChange(color)}
            className={cn(
              'w-6 h-6 rounded border-2 transition-transform hover:scale-110',
              value === color && 'scale-110 border-primary'
            )}
            style={{ backgroundColor: color }}
            aria-label={color}
          />
        ))}
      </div>
    </div>
  );
}
