import type { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './cn.js';

const badge = cva(
  'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium font-[family-name:var(--rb-font-body)]',
  {
    variants: {
      tone: {
        neutral: 'bg-[var(--rb-bg-sunk)] text-[var(--rb-fg-muted)] border border-[var(--rb-border)]',
        green: 'bg-[color-mix(in_oklch,var(--rb-alert-green)_18%,transparent)] text-[var(--rb-alert-green)]',
        yellow:
          'bg-[color-mix(in_oklch,var(--rb-alert-yellow)_22%,transparent)] text-[oklch(28%_0.08_85)]',
        red: 'bg-[color-mix(in_oklch,var(--rb-alert-red)_18%,transparent)] text-[var(--rb-alert-red)]',
        accent:
          'bg-[color-mix(in_oklch,var(--rb-accent)_18%,transparent)] text-[var(--rb-accent)]',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>;

export function Badge({ className, tone, ...rest }: BadgeProps) {
  return <span className={cn(badge({ tone }), className)} {...rest} />;
}
