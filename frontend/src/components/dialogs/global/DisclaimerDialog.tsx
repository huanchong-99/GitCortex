import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import NiceModal, { useModal } from '@ebay/nice-modal-react';
import { defineModal, type NoProps } from '@/lib/modals';
import { useTranslation, Trans } from 'react-i18next';

const DisclaimerDialogImpl = NiceModal.create<NoProps>(() => {
  const modal = useModal();
  const { t } = useTranslation('common');

  const handleAccept = () => {
    modal.resolve('accepted');
  };

  return (
    <Dialog open={modal.visible} uncloseable={true}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <DialogTitle>{t('disclaimer.title')}</DialogTitle>
          </div>
          <DialogDescription className="text-left space-y-4 pt-4">
            <p>
              <Trans
                i18nKey="disclaimer.description1"
                ns="common"
                components={{ code: <code /> }}
              />
            </p>
            <p>
              <Trans
                i18nKey="disclaimer.description2"
                ns="common"
                components={{ strong: <strong /> }}
              />
            </p>
            <p>
              {t('disclaimer.learnMore')}{' '}
              <a
                href="https://www.vibekanban.com/docs/getting-started#safety-notice"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 underline hover:no-underline"
              >
                https://www.vibekanban.com/docs/getting-started#safety-notice
              </a>
            </p>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={handleAccept} variant="default">
            {t('disclaimer.accept')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

export const DisclaimerDialog = defineModal<void, 'accepted' | void>(
  DisclaimerDialogImpl
);
