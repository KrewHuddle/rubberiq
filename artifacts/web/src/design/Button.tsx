import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './cn.js';

const button = cva(
  [
    'inline-flex items-center justify-center gap-2',
    'font-[family-name:var(--rb-font-display)] font-medium tracking-tight',
    'rounded-[var(--rb-radius-md)] transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rb-ring)]',
    'disabled:opacity-50 disabled:pointer-events-none',
  ].join(' '),
  {
    variants: {
      tone: {
        primary:
          'bg-[var(--rb-accent)] text-[var(--rb-accent-fg)] hover:bg-[var(--rb-accent-hover)] shadow-[var(--rb-shadow-sm)]',
        secondary:
          'bg-[var(--rb-bg-elev)] text-[var(--rb-fg)] border border-[var(--rb-border)] hover:border-[var(--rb-border-strong)]',
        ghost: 'bg-transparent text-[var(--rb-fg)] hover:bg-[var(--rb-bg-sunk)]',
        danger:
          'bg-[var(--rb-alert-red)] text-[var(--rb-accent-fg)] hover:opacity-90 shadow-[var(--rb-shadow-sm)]',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-base',
        lg: 'h-12 px-6 text-lg', // bay-friendly tap target
        tap: 'h-14 px-7 text-lg', // POS / counter — biggest target
      },
    },
    defaultVariants: { tone: 'primary', size: 'md' },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof button>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, tone, size, ...rest },
  ref,
) {
  return <button ref={ref} className={cn(button({ tone, size }), className)} {...rest} />;
});
