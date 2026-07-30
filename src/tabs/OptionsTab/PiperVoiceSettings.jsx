import { Button } from '../../components/common/Button';
import { useTranslation } from '../../i18n/I18nContext';

export function PiperVoiceSettings({
  piperVoices,
  piperProvision,
  piperVoice,
  piperSpeed,
  updatePiperVoice,
  updatePiperSpeed,
  preparePiperVoice,
}) {
  const { t } = useTranslation();

  return (
    <div className="xtts-settings">
      <div className="opts-row-sub" style={{ marginBottom: 8 }}>
        {t('options.voice.piper.desc')}
      </div>
      <div className="xtts-grid">
        <label className="xtts-label">
          {t('options.voice.piper.voiceLabel')}
          <select
            className="xtts-input"
            value={piperVoice}
            onChange={(e) => updatePiperVoice(e.target.value)}
          >
            {(piperVoices.length > 0 ? piperVoices : [{ id: piperVoice, label: piperVoice, installed: false }]).map((voice) => (
              <option key={voice.id} value={voice.id}>
                {voice.label}{voice.installed ? '' : t('options.voice.piper.voiceDownloadSuffix')}
              </option>
            ))}
          </select>
        </label>

        <label className="xtts-label">
          {t('options.voice.piper.speedLabel', { speed: piperSpeed.toFixed(2) })}
          <input
            className="xtts-input"
            type="number"
            min="0.5"
            max="1.5"
            step="0.05"
            value={piperSpeed}
            onChange={(e) => updatePiperSpeed(e.target.value)}
          />
        </label>
      </div>

      <div className="xtts-actions">
        <Button onClick={preparePiperVoice} disabled={piperProvision.state === 'loading'}>
          {piperProvision.state === 'loading' ? t('options.voice.piper.preparingButton') : t('options.voice.piper.prepareButton')}
        </Button>
        <span className="opts-row-sub">
          {t('options.voice.piper.prepareHint')}
        </span>
      </div>

      {piperProvision.state !== 'idle' && (
        <div className={`info-box ${piperProvision.state === 'error' ? 'warn' : ''}`}>
          {piperProvision.message}
        </div>
      )}
    </div>
  );
}
