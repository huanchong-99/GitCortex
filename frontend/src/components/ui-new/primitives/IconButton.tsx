import { cn } from '@/lib/utils';
import type { Icon } from '@phosphor-icons/react';

interface IconButtonProps {
  readonly icon: Icon;
  readonly onClick?: () => void;
  readonly disabled?: boolean;
  readonly variant?: 'default' | 'tertiary';
  readonly 'aria-label': string;
  readonly title?: string;
  readonly className?: string;
}

export function IconButton({
  icon: IconComponent,
  onClick,
  disabled,
  variant = 'default',
  'aria-label': ariaLabel,
  title,
  className,
}: Readonly<IconButtonProps>) {
  const getVariantStyles = () => {
    if (disabled) return 'opacity-40 cursor-not-allowed';
    if (variant === 'default') return 'text-low hover:text-normal hover:bg-secondary/50';
    return 'bg-panel hover:bg-secondary text-normal';
  };
  const variantStyles = getVariantStyles();

  return (
    <button
      type="button"
      className={cn(
        'flex items-center justify-center p-half rounded-sm transition-colors',
        variantStyles,
        className
      )}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      title={title}
    >
      <IconComponent className="size-icon-sm" weight="bold" />
    </button>
  );
}
