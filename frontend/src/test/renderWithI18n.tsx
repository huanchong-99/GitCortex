import { I18nextProvider } from 'react-i18next';
import { render } from '@testing-library/react';
import i18n from '@/i18n';
import type { ReactElement } from 'react';

export const setTestLanguage = async (language = 'en') => {
  await i18n.changeLanguage(language);
};

export const renderWithI18n = (ui: ReactElement) =>
  render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);

export { i18n };
