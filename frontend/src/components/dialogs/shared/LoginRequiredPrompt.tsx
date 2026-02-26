import { useCallback, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { LogIn, type LucideIcon } from 'lucide-react';
import { OAuthDialog } from '@/components/dialogs/global/OAuthDialog';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface LoginRequiredPromptProps {
  readonly className?: string;
  readonly buttonVariant?: ComponentProps<typeof Button>['variant'];
  readonly buttonSize?: ComponentProps<typeof Button>['size'];
  readonly buttonClassName?: string;
  readonly title?: string;
  readonly description?: string;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
  readonly icon?: LucideIcon;
}

export function LoginRequiredPrompt({
  className,
  buttonVariant = 'outline',
  buttonSize = 'sm',
  buttonClassName,
  title,
  description,
  actionLabel,
  onAction,
  icon,
}: Readonly<LoginRequiredPromptProps>) {
  const { t } = useTranslation('tasks');

  const handleRedirect = useCallback(() => {
    if (onAction) {
      onAction();
      return;
    }
    OAuthDialog.show().catch(() => { /* login dialog dismissed */ });
  }, [onAction]);

  const Icon = icon ?? LogIn;

  return (
    <Alert
      variant="default"
      className={cn('flex items-start gap-3', className)}
    >
      <Icon className="h-5 w-5 mt-0.5 text-muted-foreground" />
      <div className="space-y-2">
        <div className="font-medium">
          {title ?? t('shareDialog.loginRequired.title')}
        </div>
        <p className="text-sm text-muted-foreground">
          {description ?? t('shareDialog.loginRequired.description')}
        </p>
        <Button
          variant={buttonVariant}
          size={buttonSize}
          onClick={handleRedirect}
          className={cn('gap-2', buttonClassName)}
        >
          <Icon className="h-4 w-4" />
          {actionLabel ?? t('shareDialog.loginRequired.action')}
        </Button>
      </div>
    </Alert>
  );
}
