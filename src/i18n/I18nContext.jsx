import { createContext, useContext, useMemo } from 'react';
import { DEFAULT_LOCALE, translate } from './index';

const I18nContext = createContext({ locale: DEFAULT_LOCALE, t: (key) => key });

export function I18nProvider({ locale, children }) {
  const value = useMemo(() => ({
    locale,
    t: (key, vars) => translate(locale, key, vars),
  }), [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation() {
  return useContext(I18nContext);
}
