import * as React from 'react';

import { cn } from '@/lib/utils';

interface ViewHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  readonly title?: React.ReactNode;
  readonly description?: React.ReactNode;
  readonly eyebrow?: React.ReactNode;
  readonly actions?: React.ReactNode;
  readonly meta?: React.ReactNode;
}

export function ViewHeader({
  title,
  description,
  eyebrow,
  actions,
  meta,
  children,
  className,
  ...props
}: Readonly<ViewHeaderProps>) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between animate-float-in',
        className
      )}
      {...props}
    >
      {children ?? (
        <>
          <div className="flex min-w-0 flex-col gap-2">
            {eyebrow && (
              <span className="text-xs uppercase tracking-[0.2em] text-low">
                {eyebrow}
              </span>
            )}
            <div className="flex flex-wrap items-center gap-3">
              {title && (
                <h1 className="text-2xl font-semibold tracking-tight text-high font-space-grotesk">
                  {title}
                </h1>
              )}
              {meta}
            </div>
            {description && (
              <p className="text-sm text-normal max-w-2xl">{description}</p>
            )}
          </div>
          {actions && (
            <div className="flex flex-wrap items-center gap-2">{actions}</div>
          )}
        </>
      )}
    </div>
  );
}
