import { Button } from '../../components/common/Button';
import { Toggle } from '../../components/common/Toggle';
import { useTranslation } from '../../i18n/I18nContext';

const LANGUAGE_OPTIONS = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'de', label: 'Deutsch' },
  { value: 'it', label: 'Italiano' },
  { value: 'pt', label: 'Português' },
];

export function XttsVoiceSettings({
  xttsSettings,
  xttsProbe,
  xttsVoices,
  xttsVoicesLoaded,
  xttsLogs,
  favoriteVoices,
  testXtts,
  toggleXttsFavorite,
  clearXttsFavorites,
  updateServerUrl,
  updateXttsDir,
  updateLanguage,
  updateAutoStart,
  updateForceCpu,
}) {
  const { t } = useTranslation();

  return (
    <div className="xtts-settings">
      <div className="xtts-grid">
        <label className="xtts-label">
          {t('options.voice.xtts.serverUrlLabel')}
          <input
            className="xtts-input"
            value={xttsSettings.serverUrl}
            onChange={(e) => updateServerUrl(e.target.value)}
            placeholder={t('options.voice.xtts.serverUrlPlaceholder')}
          />
        </label>

        <label className="xtts-label">
          {t('options.voice.xtts.dirLabel')}
          <input
            className="xtts-input"
            value={xttsSettings.xttsDir}
            onChange={(e) => updateXttsDir(e.target.value)}
            placeholder={t('options.voice.xtts.dirPlaceholder')}
          />
        </label>

        <label className="xtts-label">
          {t('options.voice.xtts.defaultLanguageLabel')}
          <select
            className="xtts-input"
            value={xttsSettings.language}
            onChange={(e) => updateLanguage(e.target.value)}
          >
            {LANGUAGE_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="opts-row opts-row--pt">
        <div className="opts-row-info">
          <div className="opts-row-label">{t('options.voice.xtts.autoStartLabel')}</div>
          <div className="opts-row-sub">
            {t('options.voice.xtts.autoStartSub')}
          </div>
        </div>
        <Toggle on={xttsSettings.autoStart} onChange={updateAutoStart} />
      </div>

      <div className="opts-row opts-row--pt">
        <div className="opts-row-info">
          <div className="opts-row-label">{t('options.voice.xtts.forceCpuLabel')}</div>
          <div className="opts-row-sub">
            {t('options.voice.xtts.forceCpuSub')}
          </div>
        </div>
        <Toggle on={xttsSettings.forceCpu} onChange={updateForceCpu} />
      </div>

      <div className="xtts-actions">
        <Button onClick={testXtts} disabled={xttsProbe.state === 'loading'}>
          {xttsProbe.state === 'loading' ? t('options.voice.xtts.testingButton') : t('options.voice.xtts.testButton')}
        </Button>
        <span className="opts-row-sub">
          {favoriteVoices.length > 0
            ? t(
              favoriteVoices.length === 1
                ? 'options.voice.xtts.favoriteCountOne'
                : 'options.voice.xtts.favoriteCountOther',
              { count: favoriteVoices.length },
            )
            : t('options.voice.xtts.noFavorites')}
        </span>
      </div>

      {xttsProbe.state !== 'idle' && (
        <div className={`info-box ${xttsProbe.state === 'error' ? 'warn' : ''}`}>
          {xttsProbe.message}
        </div>
      )}

      {xttsLogs.length > 0 && (
        <div className="xtts-log-panel" aria-label={t('options.voice.xtts.logsAriaLabel')}>
          {xttsLogs.map((line, index) => (
            <div key={`${index}-${line}`} className="xtts-log-line">{line}</div>
          ))}
        </div>
      )}

      <div className="xtts-voices-panel">
        <div className="xtts-voices-header">
          <div>
            <div className="opts-row-label">{t('options.voice.xtts.favoritesTitle')}</div>
            <div className="opts-row-sub">
              {t('options.voice.xtts.favoritesSub')}
            </div>
          </div>
          <Button onClick={clearXttsFavorites} disabled={favoriteVoices.length === 0}>
            {t('options.voice.xtts.showAllButton')}
          </Button>
        </div>

        {!xttsVoicesLoaded ? (
          <div className="xtts-voices-empty">
            {t('options.voice.xtts.refreshHint')}
          </div>
        ) : xttsVoices.length === 0 ? (
          <div className="xtts-voices-empty">
            {t('options.voice.xtts.noVoicesReturned')}
          </div>
        ) : (
          <div className="xtts-voice-list">
            {xttsVoices.map((voiceName) => (
              <label key={voiceName} className="xtts-voice-item">
                <input
                  type="checkbox"
                  checked={favoriteVoices.includes(voiceName)}
                  onChange={() => toggleXttsFavorite(voiceName)}
                />
                <span>{voiceName}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
