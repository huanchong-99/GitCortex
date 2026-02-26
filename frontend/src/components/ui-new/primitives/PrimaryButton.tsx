import { cn } from '@/lib/utils';
import { SpinnerIcon, type Icon } from '@phosphor-icons/react';

interface PrimaryButtonProps {
  readonly variant?: 'default' | 'secondary' | 'tertiary';
  readonly actionIcon?: Icon | 'spinner';
  readonly value?: string;
  readonly onClick?: () => void;
  readonly disabled?: boolean;
  readonly children?: React.ReactNode;
}

export function PrimaryButton({
  variant = 'default',
  actionIcon: ActionIcon,
  value,
  onClick,
  disabled,
  children,
}: Readonly<PrimaryButtonProps>) {
  const getVariantStyles = () => {
    if (disabled) return 'cursor-not-allowed bg-panel';
    if (variant === 'default') return 'bg-brand hover:bg-brand-hover text-on-brand';
    if (variant === 'secondary') return 'bg-brand-secondary hover:bg-brand-hover text-on-brand';
    return 'bg-panel hover:bg-secondary text-normal';
  };
  const variantStyles = getVariantStyles();

  return (
    <button
      className={cn(
        'rounded-sm px-base py-half text-cta h-cta flex gap-half items-center',
        variantStyles
      )}
      onClick={onClick}
      disabled={disabled}
    >
      {value}
      {children}
      {(() => {
        if (!ActionIcon) return null;
        if (ActionIcon === 'spinner') {
          return <SpinnerIcon className={'size-icon-sm animate-spin'} weight="bold" />;
        }
        return <ActionIcon className={'size-icon-xs'} weight="bold" />;
      })()}
    </button>
  );
}
