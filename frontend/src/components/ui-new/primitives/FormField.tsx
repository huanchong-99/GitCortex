import * as React from 'react';

import { cn } from '@/lib/utils';

interface FormFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  readonly label?: React.ReactNode;
  readonly description?: React.ReactNode;
  readonly error?: React.ReactNode;
  readonly required?: boolean;
  readonly id?: string;
  readonly labelClassName?: string;
  readonly descriptionClassName?: string;
  readonly errorClassName?: string;
  readonly contentClassName?: string;
  readonly children: React.ReactNode;
}

export function FormField({
  label,
  description,
  error,
  required,
  id,
  className,
  labelClassName,
  descriptionClassName,
  errorClassName,
  contentClassName,
  children,
  ...props
}: FormFieldProps) {
  const autoId = React.useId();
  const fieldId = id ?? autoId;

  const descriptionId = description ? `${fieldId}-description` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy =
    [descriptionId, errorId].filter(Boolean).join(' ') || undefined;

  const control = React.isValidElement(children)
    ? React.cloneElement(children, {
        id: children.props.id ?? fieldId,
        'aria-describedby':
          children.props['aria-describedby'] ?? describedBy,
        'aria-invalid': error ? true : undefined,
        required: required ?? children.props.required,
      })
    : children;

  return (
    <div
      className={cn('flex flex-col gap-2', className)}
      data-invalid={Boolean(error)}
      {...props}
    >
      {label && (
        <label
          htmlFor={fieldId}
          className={cn(
            'text-sm font-medium text-high cursor-pointer',
            labelClassName
          )}
        >
          {label}
          {required && (
            <span className="text-error ml-1" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      <div className={cn('flex flex-col gap-1.5', contentClassName)}>
        {control}
        {description && (
          <p id={descriptionId} className={cn('text-xs text-low', descriptionClassName)}>
            {description}
          </p>
        )}
        {error && (
          <p id={errorId} className={cn('text-xs text-error', errorClassName)}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
