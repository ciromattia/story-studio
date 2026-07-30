import { Toggle } from '../../components/common/Toggle';
import {
  PACK_AUDIO_EDGE_SILENCE_MIN_SECONDS,
  PACK_AUDIO_EDGE_SILENCE_SECONDS,
  normalizePackAudioEdgeSilence,
} from '../../config/audioProcessing.js';
import { usePersistentState } from '../../hooks/usePersistentState';
import { KEYS } from '../../store/persistentSettings';
import { useTranslation } from '../../i18n/I18nContext';

const BOOL_CODEC = {
  decode: (raw) => raw === 'true',
  encode: (value) => String(!!value),
};

const SILENCE_CODEC = {
  decode: (raw) => normalizePackAudioEdgeSilence(raw),
  encode: (value) => String(normalizePackAudioEdgeSilence(value)),
};

function SilenceDurationRow({ value, onChange, label }) {
  const { t } = useTranslation();

  return (
    <div className="opts-row">
      <div className="opts-row-info">
        <div className="opts-row-label">{label}</div>
        <div className="opts-row-sub">
          {t('options.advanced.silenceSub', { min: PACK_AUDIO_EDGE_SILENCE_MIN_SECONDS })}
        </div>
      </div>
      <input
        className="xtts-input opts-number"
        type="number"
        min={PACK_AUDIO_EDGE_SILENCE_MIN_SECONDS}
        step="0.1"
        value={value}
        onChange={(event) => onChange(normalizePackAudioEdgeSilence(event.target.value))}
      />
    </div>
  );
}

export function AdvancedSection({ className, sectionRef }) {
  const { t } = useTranslation();
  const [allowUnsupportedPackExtraction, setAllowUnsupportedPackExtraction] = usePersistentState(
    KEYS.ALLOW_UNSUPPORTED_PACK_EXTRACTION,
    false,
    BOOL_CODEC,
  );
  const [leadingSilenceSeconds, setLeadingSilenceSeconds] = usePersistentState(
    KEYS.PACK_LEADING_SILENCE_SECONDS,
    PACK_AUDIO_EDGE_SILENCE_SECONDS,
    SILENCE_CODEC,
  );
  const [trailingSilenceSeconds, setTrailingSilenceSeconds] = usePersistentState(
    KEYS.PACK_TRAILING_SILENCE_SECONDS,
    PACK_AUDIO_EDGE_SILENCE_SECONDS,
    SILENCE_CODEC,
  );

  return (
    <section id="advanced" className={className} ref={sectionRef}>
      <div className="opts-card-title">{t('options.advanced.title')}</div>
      <div className="opts-row">
        <div className="opts-row-info">
          <div className="opts-row-label">{t('options.advanced.allowUnsupportedLabel')}</div>
          <div className="opts-row-sub">
            {t('options.advanced.allowUnsupportedSub')}
          </div>
        </div>
        <Toggle on={allowUnsupportedPackExtraction} onChange={setAllowUnsupportedPackExtraction} />
      </div>
      {allowUnsupportedPackExtraction && (
        <div className="info-box info-box--spaced warn">
          {t('options.advanced.riskModeWarning')}
        </div>
      )}
      <SilenceDurationRow
        label={t('options.advanced.leadingSilenceLabel')}
        value={leadingSilenceSeconds}
        onChange={setLeadingSilenceSeconds}
      />
      <SilenceDurationRow
        label={t('options.advanced.trailingSilenceLabel')}
        value={trailingSilenceSeconds}
        onChange={setTrailingSilenceSeconds}
      />
    </section>
  );
}
