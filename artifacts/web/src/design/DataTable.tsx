/**
 * DataTable — controlled-density data view. Mono font for IDs/DOTs.
 * Intentionally minimal; rich rendering composes from primitives in cells.
 */
import type { ReactNode } from 'react';
import { cn } from './cn.js';

export type Column<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  mono?: boolean;
  width?: string;
};

type Props<T> = {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  empty?: ReactNode;
  className?: string;
};

export function DataTable<T>({ rows, columns, rowKey, empty, className }: Props<T>) {
  if (rows.length === 0 && empty) {
    return (
      <div className="rounded-[var(--rb-radius-lg)] border border-dashed border-[var(--rb-border)] p-12 text-center text-[var(--rb-fg-muted)]">
        {empty}
      </div>
    );
  }
  return (
    <div
      className={cn(
        'overflow-x-auto rounded-[var(--rb-radius-lg)] border border-[var(--rb-border)] bg-[var(--rb-bg-elev)]',
        className,
      )}
    >
      <table className="w-full text-sm">
        <thead className="border-b border-[var(--rb-border)] bg-[var(--rb-bg-sunk)]">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                style={c.width ? { width: c.width } : undefined}
                className={cn(
                  'px-4 py-3 text-xs font-medium uppercase tracking-wider text-[var(--rb-fg-muted)]',
                  c.align === 'right' && 'text-right',
                  c.align === 'center' && 'text-center',
                  (!c.align || c.align === 'left') && 'text-left',
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={rowKey(row)}
              className={cn(
                'border-b border-[var(--rb-border)] last:border-0',
                i % 2 === 1 && 'bg-[color-mix(in_oklch,var(--rb-bg-sunk)_50%,transparent)]',
              )}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={cn(
                    'px-4 py-3 text-[var(--rb-fg)]',
                    c.align === 'right' && 'text-right',
                    c.align === 'center' && 'text-center',
                    c.mono && 'font-[family-name:var(--rb-font-mono)] tabular-nums tracking-wider',
                  )}
                >
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
