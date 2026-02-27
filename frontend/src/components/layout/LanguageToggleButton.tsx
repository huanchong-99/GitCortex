import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { UiLanguage } from 'shared/types';
import { useUserSystem } from '@/components/ConfigProvider';
import { uiLanguageToI18nCode } from '@/i18n/languages';
import { cn } from '@/lib/utils';

interface LanguageToggleButtonProps {
  className?: string;
}

export function LanguageToggleButton({ className }: Readonly<LanguageToggleButtonProps>) {
  const { t, i18n } = useTranslation('common');
  const { config, updateAndSaveConfig } = useUserSystem();
  const [isSaving, setIsSaving] = useState(false);

  const currentLanguage = (i18n.resolvedLanguage || i18n.language || '').toLowerCase();
  const isEnglish = currentLanguage.startsWith('en');

  const targetUiLanguage: UiLanguage = isEnglish ? 'ZH_HANS' : 'EN';
  const targetI18nLanguage =
    uiLanguageToI18nCode(targetUiLanguage) || (targetUiLanguage === 'EN' ? 'en' : 'zh-Hans');

  const label = isEnglish
    ? t('navbar.languageToggle.zh')
    : t('navbar.languageToggle.en');
  const title = isEnglish
    ? t('navbar.languageToggle.switchToChinese')
    : t('navbar.languageToggle.switchToEnglish');

  const handleToggleLanguage = async () => {
    if (isSaving) {
      return;
    }

    const previousI18nLanguage = i18n.resolvedLanguage || i18n.language;
    setIsSaving(true);

    await i18n.changeLanguage(targetI18nLanguage);
    const saved = await updateAndSaveConfig({ language: targetUiLanguage });

    if (!saved) {
      const rollbackLanguage = config?.language
        ? uiLanguageToI18nCode(config.language)
        : previousI18nLanguage;
      if (rollbackLanguage) {
        await i18n.changeLanguage(rollbackLanguage);
      }
    }

    setIsSaving(false);
  };

  return (
    <button
      type="button"
      onClick={handleToggleLanguage}
      disabled={isSaving}
      className={cn(
        'h-9 min-w-9 px-2 rounded text-xs font-medium text-low hover:text-high hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed',
        className
      )}
      aria-label={title}
      title={title}
    >
      {label}
    </button>
  );
}
