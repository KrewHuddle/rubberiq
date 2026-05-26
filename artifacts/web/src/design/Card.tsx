import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from './cn.js';

type CardProps = HTMLAttributes<HTMLDivElement> & {
  elev?: 'flat' | 'raised';
};

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, elev = 'flat', ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'bg-[var(--rb-bg-elev)] border border-[var(--rb-border)] rounded-[var(--rb-radius-lg)] p-6',
        elev === 'raised' && 'shadow-[var(--rb-shadow-md)]',
        className,
      )}
      {...rest}
    />
  );
});
