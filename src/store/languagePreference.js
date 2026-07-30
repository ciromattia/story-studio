import { KEYS, read as readSetting, write as writeSetting } from './persistentSettings';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, detectSystemLocale } from '../i18n';

export const LANGUAGE_OPTIONS = [
  { value: 'system', label: 'Système / System / Sistema' },
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English' },
  { value: 'it', label: 'Italiano' },
];

export function loadLanguagePreference() {
  try {
    const value = readSetting(KEYS.LANGUAGE);
    return value === 'system' || SUPPORTED_LOCALES.includes(value) ? value : 'system';
  } catch {
    return 'system';
  }
}

export function saveLanguagePreference(value) {
  try {
    writeSetting(KEYS.LANGUAGE, value);
  } catch {}
}

// Résout la préférence stockée ('system' | code de locale) vers une locale
// effective supportée. Repli français si la locale système n'est pas gérée.
export function resolveLocale(preference) {
  if (SUPPORTED_LOCALES.includes(preference)) return preference;
  return detectSystemLocale();
}

export function applyLocaleToDocument(locale) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale || DEFAULT_LOCALE;
}
