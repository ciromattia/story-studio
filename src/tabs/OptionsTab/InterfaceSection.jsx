import { Button } from '../../components/common/Button';
import { THEME_OPTIONS } from '../../store/themePreference';
import { LANGUAGE_OPTIONS } from '../../store/languagePreference';
import { useTranslation } from '../../i18n/I18nContext';

export function InterfaceSection({
  className,
  sectionRef,
  themePreference,
  onThemePreferenceChange,
  languagePreference,
  onLanguagePreferenceChange,
  onOpenShortcuts,
}) {
  const { t } = useTranslation();

  return (
    <section id="interface" className={className} ref={sectionRef}>
      <div className="opts-card-title">{t('options.interface.title')}</div>
      <div className="opts-row">
        <div className="opts-row-info">
          <div className="opts-row-label">{t('options.interface.themeLabel')}</div>
          <div className="opts-row-sub">{t('options.interface.themeSub')}</div>
        </div>
        <select
          className="xtts-input opts-select"
          value={themePreference}
          onChange={(event) => onThemePreferenceChange?.(event.target.value)}
        >
          {THEME_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
      <div className="opts-row">
        <div className="opts-row-info">
          <div className="opts-row-label">{t('options.interface.languageLabel')}</div>
          <div className="opts-row-sub">{t('options.interface.languageSub')}</div>
        </div>
        <select
          className="xtts-input opts-select"
          value={languagePreference}
          onChange={(event) => onLanguagePreferenceChange?.(event.target.value)}
        >
          {LANGUAGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
      <div className="opts-row">
        <div className="opts-row-info">
          <div className="opts-row-label">{t('options.interface.shortcutsLabel')}</div>
          <div className="opts-row-sub">{t('options.interface.shortcutsSub')}</div>
        </div>
        <Button onClick={onOpenShortcuts}>
          {t('options.interface.shortcutsButton')}
        </Button>
      </div>
    </section>
  );
}
