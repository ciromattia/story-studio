import { useEffect, useRef } from 'react';
import { Toggle } from '../common/Toggle';
import { Tooltip } from '../common/Tooltip';
import { Wrench } from '../icons/LucideLocal';
import {
  formatPackAudioEdgeSilence,
  getPackAudioEdgeSilenceSettings,
} from '../../config/audioProcessing';
import { useTranslation } from '../../i18n/I18nContext';
import './PackOptionsPopover.css';

function silenceModePresentation(t, leadingSeconds, trailingSeconds) {
  const leadingLabel = formatPackAudioEdgeSilence(leadingSeconds);
  const trailingLabel = formatPackAudioEdgeSilence(trailingSeconds);
  const durationSummary = leadingSeconds === trailingSeconds
    ? t('layout.packOptionsPopover.silence.durationSame', { leading: leadingLabel })
    : t('layout.packOptionsPopover.silence.durationDiff', { leading: leadingLabel, trailing: trailingLabel });

  return {
    durationSummary,
    options: [
      ['normalize', t('layout.packOptionsPopover.silence.normalize.label'), t('layout.packOptionsPopover.silence.normalize.aria'), t('layout.packOptionsPopover.silence.normalize.help', { leading: leadingLabel, trailing: trailingLabel })],
      ['add', t('layout.packOptionsPopover.silence.add.label'), t('layout.packOptionsPopover.silence.add.aria', { leading: leadingLabel, trailing: trailingLabel }), t('layout.packOptionsPopover.silence.add.help', { leading: leadingLabel, trailing: trailingLabel })],
      ['off', t('layout.packOptionsPopover.silence.off.label'), t('layout.packOptionsPopover.silence.off.aria'), t('layout.packOptionsPopover.silence.off.help')],
    ],
  };
}

export function PackOptionsPopover({
  open,
  trigger,
  projectType,
  globalOptions = {},
  onOpenChange,
  onUpdateOption,
  onOpenPreferences,
  preferencesShortcut = '',
}) {
  const { t } = useTranslation();
  const wrapRef = useRef(null);
  const closeTimerRef = useRef(null);
  const isSimpleProject = projectType === 'simple';
  const { leading, trailing } = getPackAudioEdgeSilenceSettings();
  const { durationSummary: silenceDurationSummary, options: silenceOptions } = silenceModePresentation(t, leading, trailing);
  const harmonizeLoudnessHelp = t('layout.packOptionsPopover.harmonize.help');
  // 'normalize' est le défaut appliqué par le schéma quand le mode n'est pas défini.
  const activeSilenceMode = globalOptions.silenceMode ?? 'normalize';
  const activeSilenceHelp = (silenceOptions.find(([mode]) => mode === activeSilenceMode) ?? silenceOptions[0])[3];

  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    function onPointerDown(event) {
      if (!wrapRef.current?.contains(event.target)) onOpenChange?.(false);
    }

    function onKeyDown(event) {
      if (event.key === 'Escape') onOpenChange?.(false);
    }

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onOpenChange]);

  function updateOption(key, value) {
    onUpdateOption?.(key, value);
  }

  function openPopover() {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    onOpenChange?.(true);
  }

  function scheduleClose() {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => onOpenChange?.(false), 140);
  }

  function handleOpenPreferences() {
    onOpenChange?.(false);
    onOpenPreferences?.();
  }

  return (
    <div
      className={`pack-options-wrap ${open ? 'is-open' : ''}`}
      ref={wrapRef}
      onPointerEnter={openPopover}
      onPointerLeave={scheduleClose}
      onMouseEnter={openPopover}
      onMouseLeave={scheduleClose}
      onFocus={openPopover}
    >
      {trigger}

      {open ? (
        <>
          <div className="pack-options-hover-bridge" aria-hidden="true" />
          <div className="pack-options-popover" role="dialog" aria-label={t('layout.packOptionsPopover.dialogAria')}>
            <div className="pack-options-well">
              <div className="pack-options-well-title">{t('layout.packOptionsPopover.audioTitle')}</div>
              <Tooltip text={harmonizeLoudnessHelp} wrap className="pack-options-row-tip">
                <div className="pack-options-control-row">
                  <span className="pack-options-control-copy">
                    <span className="pack-options-control-title">{t('layout.packOptionsPopover.harmonize.label')}</span>
                  </span>
                  <span className="pack-options-control-end">
                    <Toggle
                      on={globalOptions.harmonizeLoudness !== false}
                      onChange={(value) => updateOption('harmonizeLoudness', value)}
                      ariaLabel={t('layout.packOptionsPopover.harmonize.toggleAria')}
                    />
                  </span>
                </div>
              </Tooltip>
              <div className="pack-options-control-row pack-options-control-row--stack">
                <span className="pack-options-control-copy">
                  <span className="pack-options-control-title">{t('layout.packOptionsPopover.silence.title')}</span>
                  <span className="pack-options-silence-duration">{silenceDurationSummary}</span>
                </span>
                <div className="pack-options-segmented" role="group" aria-label={t('layout.packOptionsPopover.silence.groupAria')}>
                  {silenceOptions.map(([mode, label, ariaLabel, help]) => (
                    <Tooltip key={mode} text={help} wrap>
                      <button
                        type="button"
                        className={`pack-options-segment ${activeSilenceMode === mode ? 'is-active' : ''}`}
                        aria-pressed={activeSilenceMode === mode}
                        aria-label={ariaLabel}
                        onClick={() => updateOption('silenceMode', mode)}
                      >
                        {label}
                      </button>
                    </Tooltip>
                  ))}
                </div>
                <span className="pack-options-control-hint pack-options-silence-hint">{activeSilenceHelp}</span>
              </div>

              <div className="pack-options-well-sep" />

              <div className="pack-options-well-title">{t('layout.packOptionsPopover.playback.title')} <span>{t('layout.packOptionsPopover.playback.scopeTag')}</span></div>
              <Tooltip
                text={t('layout.packOptionsPopover.autoNext.help')}
                wrap
                className="pack-options-row-tip"
              >
                <div className={`pack-options-control-row ${isSimpleProject ? 'is-disabled' : ''}`}>
                  <span className="pack-options-control-copy">
                    <span className="pack-options-control-title">{t('layout.packOptionsPopover.autoNext.label')}</span>
                    <span className="pack-options-control-hint">{t('layout.packOptionsPopover.autoNext.hint')}</span>
                  </span>
                  <span className="pack-options-control-end">
                    <Toggle
                      on={!!globalOptions.autoNext}
                      onChange={(value) => updateOption('autoNext', value)}
                      disabled={isSimpleProject}
                      ariaLabel={t('layout.packOptionsPopover.autoNext.toggleAria')}
                    />
                  </span>
                </div>
              </Tooltip>
            </div>

            {onOpenPreferences ? (
              <>
                <div className="pack-options-rule" />
                <button
                  type="button"
                  className="pack-options-gateway pack-options-gateway--app"
                  onClick={handleOpenPreferences}
                >
                  <span className="pack-options-gateway-icon pack-options-gateway-icon--app">
                    <Wrench strokeWidth={2} absoluteStrokeWidth />
                  </span>
                  <span className="pack-options-gateway-copy">
                    <span className="pack-options-gateway-title">{t('layout.packOptionsPopover.preferences.title')}</span>
                    <span className="pack-options-gateway-subtitle">{t('layout.packOptionsPopover.preferences.subtitle')}</span>
                  </span>
                  <span className="pack-options-gateway-end">
                    {preferencesShortcut ? <span className="pack-options-shortcut">{preferencesShortcut}</span> : null}
                  </span>
                </button>
              </>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
