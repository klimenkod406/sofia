'use client';

import { cn } from '@/utils/cn';
import { forwardRef } from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = 'primary', size = 'md', isLoading, children, disabled, ...props },
    ref
  ) => {
    // Закругления 16px+, воздушные паддинги — ничего не прижато друг к другу.
    const baseStyles =
      'inline-flex items-center justify-center gap-2.5 rounded-2xl font-display font-semibold tracking-[0.005em] transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]';

    const variants = {
      primary:
        'shadow-[0_2px_12px_rgba(87,80,70,0.18),inset_0_1px_0_rgba(255,255,255,0.35)] hover:-translate-y-px hover:shadow-lg',
      secondary: 'glass-subtle hover:shadow-md hover:-translate-y-px',
      ghost: 'bg-transparent hover:bg-accent/70 active:bg-accent rounded-2xl',
      destructive: 'hover:brightness-95 active:brightness-90 shadow-sm',
      outline:
        'border border-input bg-card/60 hover:bg-accent/70 active:bg-accent backdrop-blur-xl',
    };

    const variantBg: Record<string, string> = {
      primary: 'hsl(var(--primary) / 0.92)',
      secondary: '',
      ghost: '',
      destructive: 'hsl(var(--destructive))',
      outline: '',
    };
    const variantFg: Record<string, string> = {
      primary: 'hsl(var(--primary-foreground))',
      secondary: 'hsl(var(--secondary-foreground))',
      ghost: 'hsl(var(--foreground))',
      destructive: 'hsl(var(--destructive-foreground))',
      outline: 'hsl(var(--foreground))',
    };

    const sizes = {
      sm: 'h-9 px-4 text-xs gap-2',
      md: 'h-11 px-5 py-2.5 text-sm',
      lg: 'h-[52px] px-7 text-[15px]',
      icon: 'h-11 w-11',
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        style={{
          ...(variantBg[variant] ? { background: variantBg[variant] } : {}),
          ...(variantFg[variant] ? { color: variantFg[variant] } : {}),
        }}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && (
          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
