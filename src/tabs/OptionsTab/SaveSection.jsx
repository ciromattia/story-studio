import { Toggle } from '../../components/common/Toggle';
import { useTranslation } from '../../i18n/I18nContext';

export function SaveSection({
  className,
  sectionRef,
  autoSaveEnabled,
  onAutoSaveChange,
  autoSaveBackupLimit,
  onAutoSaveBackupLimitChange,
}) {
  const { t } = useTranslation();

  return (
    <section id="save" className={className} ref={sectionRef}>
      <div className="opts-card-title">{t('options.save.title')}</div>
      <div className="opts-row">
        <div className="opts-row-info">
          <div className="opts-row-label">{t('options.save.autoSaveLabel')}</div>
          <div className="opts-row-sub">{t('options.save.autoSaveSub')}</div>
        </div>
        <Toggle on={autoSaveEnabled} onChange={onAutoSaveChange} />
      </div>
      {autoSaveEnabled && (
        <div className="opts-row">
          <div className="opts-row-info">
            <div className="opts-row-label">{t('options.save.backupLimitLabel')}</div>
            <div className="opts-row-sub">{t('options.save.backupLimitSub')}</div>
          </div>
          <input
            className="xtts-input opts-number"
            type="number"
            min="0"
            max="50"
            value={autoSaveBackupLimit}
            onChange={(event) => onAutoSaveBackupLimitChange?.(Math.max(0, Math.min(50, Number(event.target.value) || 0)))}
          />
        </div>
      )}
      <div className="opts-help">
        {t('options.save.helpIntro')} <strong>Ctrl+S</strong> {t('options.save.helpSave')} <strong>Ctrl+Maj+S</strong> {t('options.save.helpSaveAs')}
      </div>
    </section>
  );
}
