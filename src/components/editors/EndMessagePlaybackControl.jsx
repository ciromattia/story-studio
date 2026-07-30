import { Toggle } from '../common/Toggle';
import { useTranslation } from '../../i18n/I18nContext';

function playbackSummaryText(t, summary) {
  if (summary.total === 0) {
    return t('editorsCore.endMessagePlayback.fallbackSummary');
  }
  if (summary.mode === 'mixed') {
    const stays = summary.stays
      ? t('editorsCore.endMessagePlayback.mixedStaysSuffix', { count: summary.stays })
      : '';
    return t('editorsCore.endMessagePlayback.mixedSummary', {
      waitingOk: summary.waitingOk,
      autoPlay: summary.autoPlay,
      stays,
    });
  }
  if (summary.mode === 'wait') {
    return t(summary.total > 1
      ? 'editorsCore.endMessagePlayback.waitSummaryOther'
      : 'editorsCore.endMessagePlayback.waitSummaryOne', { count: summary.total });
  }
  return t(summary.total > 1
    ? 'editorsCore.endMessagePlayback.autoSummaryOther'
    : 'editorsCore.endMessagePlayback.autoSummaryOne', { count: summary.total });
}

function playbackExplanationText(t, mode) {
  if (mode === 'mixed') {
    return t('editorsCore.endMessagePlayback.explanationMixed');
  }
  if (mode === 'wait') {
    return t('editorsCore.endMessagePlayback.explanationWait');
  }
  return t('editorsCore.endMessagePlayback.explanationAuto');
}

export function EndMessagePlaybackControl({ summary, onChange }) {
  const { t } = useTranslation();
  const waitForOk = summary.mode === 'wait';
  const mixed = summary.mode === 'mixed';

  return (
    <div className="end-message-playback-control">
      <div className="end-message-playback-choice">
        <button
          type="button"
          className={`end-message-playback-label${summary.mode === 'auto' ? ' is-active' : ''}`}
          onClick={() => onChange?.(true)}
        >
          {t('editorsCore.endMessagePlayback.automaticallyLabel')}
        </button>
        <Toggle
          on={waitForOk}
          mixed={mixed}
          onChange={(nextWaitForOk) => onChange?.(!nextWaitForOk)}
          ariaLabel={mixed
            ? t('editorsCore.endMessagePlayback.ariaMixed')
            : t('editorsCore.endMessagePlayback.ariaWait')}
        />
        <button
          type="button"
          className={`end-message-playback-label${summary.mode === 'wait' ? ' is-active' : ''}`}
          onClick={() => onChange?.(false)}
        >
          {t('editorsCore.endMessagePlayback.afterOkLabel')}
        </button>
      </div>
      <div className="end-message-playback-explanation">
        {playbackExplanationText(t, summary.mode)}
      </div>
      <div className={`end-message-playback-summary${mixed ? ' is-mixed' : ''}`}>
        {mixed ? <strong>{t('editorsCore.endMessagePlayback.mixedBadge')}</strong> : null}
        <span>{playbackSummaryText(t, summary)}</span>
      </div>
    </div>
  );
}
