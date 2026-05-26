/**
 * PriceTag — hero data. Display font, tabular nums, optional benchmark strike-through.
 */
import type { HTMLAttributes } from 'react';
import { cn } from './cn.js';

type Props = HTMLAttributes<HTMLDivElement> & {
  cents: number;
  benchmarkCents?: number;
  currency?: string; // ISO 4217 — default USD
  locale?: string;
  size?: 'sm' | 'md' | 'lg' | 'hero';
};

const sizeMap = {
  sm: 'text-base',
  md: 'text-2xl',
  lg: 'text-4xl',
  hero: 'text-[5rem] leading-none',
} as const;

function fmt(cents: number, locale: string, currency: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function PriceTag({
  cents,
  benchmarkCents,
  currency = 'USD',
  locale = 'en-US',
  size = 'md',
  className,
  ...rest
}: Props) {
  return (
    <div className={cn('inline-flex items-baseline gap-3', className)} {...rest}>
      <span
        className={cn(
          'font-[family-name:var(--rb-font-display)] font-semibold tabular-nums text-[var(--rb-fg)]',
          sizeMap[size],
        )}
      >
        {fmt(cents, locale, currency)}
      </span>
      {benchmarkCents !== undefined && benchmarkCents > cents && (
        <span className="font-[family-name:var(--rb-font-body)] text-[var(--rb-fg-subtle)] line-through tabular-nums text-sm">
          {fmt(benchmarkCents, locale, currency)}
        </span>
      )}
    </div>
  );
}
