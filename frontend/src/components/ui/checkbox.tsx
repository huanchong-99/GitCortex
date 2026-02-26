import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CheckboxProps {
  id?: string;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  className?: string;
  disabled?: boolean;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  (
    { className, checked = false, onCheckedChange, disabled, ...props },
    ref
  ) => {
    return (
      <div className="relative inline-flex">
        <input
          type="checkbox"
          ref={ref}
          checked={checked}
          disabled={disabled}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
          className="sr-only peer"
          {...props}
        />
        <div
          className={cn(
            'h-4 w-4 shrink-0 rounded-sm border border-primary-foreground ring-offset-background peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 flex items-center justify-center',
            checked && 'bg-primary text-primary-foreground',
            className
          )}
        >
          {checked && <Check className="h-4 w-4" />}
        </div>
      </div>
    );
  }
);
Checkbox.displayName = 'Checkbox';

export { Checkbox };
