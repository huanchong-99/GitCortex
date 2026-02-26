import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

const statusPillVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border font-medium transition-colors duration-200',
  {
    variants: {
      tone: {
        success: 'bg-success/10 text-success border-success/30',
        warning: 'bg-warning/10 text-warning border-warning/30',
        info: 'bg-info/10 text-info border-info/30',
        neutral: 'bg-neutral text-normal border-border',
        danger: 'bg-error/10 text-error border-error/30',
        brand: 'bg-brand/10 text-brand border-brand/30',
      },
      size: {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-2.5 py-1 text-sm',
      },
    },
    defaultVariants: {
      tone: 'neutral',
      size: 'sm',
    },
  }
);

export interface StatusPillProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusPillVariants> {
  readonly icon?: LucideIcon;
  readonly label?: React.ReactNode;
}

export function StatusPill({
  icon: Icon,
  label,
  children,
  tone,
  size,
  className,
  onClick,
  ...props
}: StatusPillProps) {
  const content = label ?? children;
  const isInteractive = typeof onClick === 'function';

  const sharedClassName = cn(
    statusPillVariants({ tone, size }),
    isInteractive && 'cursor-pointer hover:opacity-90',
    className
  );

  const inner = (
    <>
      {Icon ? (
        <Icon className={cn(size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5')} />
      ) : null}
      {content}
    </>
  );

  if (isInteractive) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={sharedClassName}
        {...props}
      >
        {inner}
      </button>
    );
  }

  return (
    <span
      className={sharedClassName}
      {...props}
    >
      {inner}
    </span>
  );
}
