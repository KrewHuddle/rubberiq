/**
 * GradeStamp — the tire's grade rendered like a stamped mark. Hero data.
 * Sizes: sm (tables), md (cards), hero (intake reveal).
 */
import type { CSSProperties, HTMLAttributes } from 'react';
import { cn } from './cn.js';
import { tokens } from './tokens.js';

export type Grade = 'A' | 'B' | 'C' | 'D' | 'FAIL';

const sizeMap = {
  sm: 'w-9 h-9 text-base',
  md: 'w-14 h-14 text-2xl',
  hero: 'w-32 h-32 text-7xl',
} as const;

type Props = HTMLAttributes<HTMLDivElement> & {
  grade: Grade;
  size?: keyof typeof sizeMap;
};

export function GradeStamp({ grade, size = 'md', className, style, ...rest }: Props) {
  const color = tokens.grade[grade];
  const stamped: CSSProperties = {
    color,
    borderColor: color,
    boxShadow: 'var(--rb-shadow-stamp)',
    transform: 'rotate(-3deg)',
    ...style,
  };
  return (
    <div
      className={cn(
        'inline-flex items-center justify-center font-[family-name:var(--rb-font-display)] font-bold uppercase tracking-tight',
        'border-[3px] rounded-[var(--rb-radius-stamp)] select-none',
        sizeMap[size],
        className,
      )}
      style={stamped}
      aria-label={`Grade ${grade}`}
      {...rest}
    >
      {grade === 'FAIL' ? '!' : grade}
    </div>
  );
}
