import type { ExecutorProfileId } from 'shared/types';
import { cn } from '@/lib/utils';

interface ProfileVariantBadgeProps {
  readonly profileVariant: ExecutorProfileId | null;
  readonly className?: string;
}

export function ProfileVariantBadge({
  profileVariant,
  className,
}: Readonly<ProfileVariantBadgeProps>) {
  if (!profileVariant) {
    return null;
  }

  return (
    <span className={cn('text-xs text-muted-foreground', className)}>
      {profileVariant.executor}
      {profileVariant.variant && (
        <>
          <span className="mx-1">/</span>
          <span className="font-medium">{profileVariant.variant}</span>
        </>
      )}
    </span>
  );
}
