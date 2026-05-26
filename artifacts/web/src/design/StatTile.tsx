/**
 * StatTile — KPI tile for shop dashboards & super-admin. Hero number on top,
 * label underneath, optional delta. Display font + tabular nums.
 */
import type { ReactNode } from 'react';
import { cn } from './cn.js';

type Props = {
  label: string;
  value: ReactNode;
  delta?: { value: string; tone: 'up' | 'down' | 'flat' };
  className?: string;
};

export function StatTile({ label, value, delta, className }: Props) {
  return (
    <div
      className={cn(
        'rounded-[var(--rb-radius-lg)] border border-[var(--rb-border)] bg-[var(--rb-bg-elev)] p-5',
        className,
      )}
    >
      <div className="text-xs font-medium uppercase tracking-wider text-[var(--rb-fg-muted)]">
        {label}
      </div>
      <div className="mt-2 font-[family-name:var(--rb-font-display)] text-3xl font-semibold tabular-nums text-[var(--rb-fg)]">
        {value}
      </div>
      {delta && (
        <div
          className={cn(
            'mt-1 text-sm font-medium',
            delta.tone === 'up' && 'text-[var(--rb-alert-green)]',
            delta.tone === 'down' && 'text-[var(--rb-alert-red)]',
            delta.tone === 'flat' && 'text-[var(--rb-fg-muted)]',
          )}
        >
          {delta.tone === 'up' && '↑ '}
          {delta.tone === 'down' && '↓ '}
          {delta.value}
        </div>
      )}
    </div>
  );
}
