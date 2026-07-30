import { PiperVoiceSettings } from './PiperVoiceSettings';
import { XttsVoiceSettings } from './XttsVoiceSettings';
import { usePiperVoiceOptions } from './usePiperVoiceOptions';
import { useXttsVoiceOptions } from './useXttsVoiceOptions';
import { useTranslation } from '../../i18n/I18nContext';

export function VoiceSection({ className, sectionRef, xttsSettings, onUpdateXttsSettings }) {
  const { t } = useTranslation();
  const ttsBackend = xttsSettings.backend || 'piper';
  const piperOptions = usePiperVoiceOptions({ xttsSettings, onUpdateXttsSettings });
  const xttsOptions = useXttsVoiceOptions({ xttsSettings, onUpdateXttsSettings });

  function handleTtsBackendChange(backend) {
    // Sélectionner XTTS l'active (le moteur remplace l'ancien toggle d'activation).
    onUpdateXttsSettings(backend === 'xtts' ? { backend, enabled: true } : { backend });
  }

  return (
    <section id="xtts" className={className} ref={sectionRef}>
      <div className="opts-card-title">{t('options.voice.title')}</div>
      <div className="opts-row">
        <div className="opts-row-info">
          <div className="opts-row-label">{t('options.voice.engineLabel')}</div>
          <div className="opts-row-sub">
            <strong>Piper</strong> {t('options.voice.enginePiperDesc')} <strong>XTTS</strong> {t('options.voice.engineXttsDesc')}
          </div>
        </div>
        <select
          className="xtts-input opts-select"
          value={ttsBackend}
          onChange={(e) => handleTtsBackendChange(e.target.value)}
        >
          <option value="piper">{t('options.voice.enginePiperOption')}</option>
          <option value="xtts">{t('options.voice.engineXttsOption')}</option>
        </select>
      </div>

      {ttsBackend === 'piper' && (
        <PiperVoiceSettings {...piperOptions} />
      )}

      {ttsBackend === 'xtts' && (
        <XttsVoiceSettings
          xttsSettings={xttsSettings}
          {...xttsOptions}
        />
      )}
    </section>
  );
}
