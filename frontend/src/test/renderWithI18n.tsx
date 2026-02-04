import { I18nextProvider } from 'react-i18next';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n';
import { ToastProvider } from '@/components/ui/toast';
import type { ReactElement } from 'react';

export const setTestLanguage = async (language = 'en') => {
  await i18n.changeLanguage(language);
};

/**
 * Render with all common providers: I18n, Toast, and Router
 */
export const renderWithI18n = (ui: ReactElement) =>
  render(
    <I18nextProvider i18n={i18n}>
      <ToastProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </ToastProvider>
    </I18nextProvider>
  );

export { i18n };
