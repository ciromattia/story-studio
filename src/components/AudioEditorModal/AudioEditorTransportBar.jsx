import { Button } from '../common/Button';
import { Tooltip } from '../common/Tooltip';
import { Play, Pause, Square, SkipBack, SkipForward, Scissors, Crop } from '../icons/LucideLocal';
import { formatTime } from './audioEditorConstants';
import { useTranslation } from '../../i18n/I18nContext';

// Barre de transport de l'éditeur audio : chips de fondu entrée/sortie,
// marqueurs de sélection, lecture, navigation et actions garder/supprimer.
export function AudioEditorTransportBar({
  fadeInSec,
  fadeOutSec,
  fadeMax,
  isApplying,
  isLoading,
  isPlaying,
  canOperate,
  canCut,
  onOpenFadePopover,
  onMarkStart,
  onMarkEnd,
  onPlayPause,
  onStop,
  onSkipBack,
  onSkipForward,
  onGoToTrimStart,
  onGoToTrimEnd,
  onStageTrim,
  onStageCut,
}) {
  const { t } = useTranslation();
  return (
    <div className="audio-tb-row audio-editor-controls-row">
      <div className="audio-editor-fade-slot is-left">
        <Tooltip text={fadeInSec > 0 ? t('audioEditor.transport.fadeInActive', { time: formatTime(Math.min(fadeInSec, fadeMax)) }) : t('audioEditor.transport.fadeInAdd')}>
          <Button
            variant="icon"
            className={`audio-tb-btn audio-editor-fade-chip${fadeInSec > 0 ? ' is-active' : ''}`}
            onClick={(e) => onOpenFadePopover('in', e)}
            onContextMenu={(e) => onOpenFadePopover('in', e)}
            disabled={isApplying}
          >
            ↗
          </Button>
        </Tooltip>
      </div>
      <div className="audio-tb">
        <Tooltip text={t('audioEditor.transport.markIn')}>
          <Button variant="icon" className="audio-tb-btn audio-tb-btn-marker" onClick={onMarkStart} disabled={isLoading}>{`{`}</Button>
        </Tooltip>
        <Tooltip text={t('audioEditor.transport.markOut')}>
          <Button variant="icon" className="audio-tb-btn audio-tb-btn-marker" onClick={onMarkEnd} disabled={isLoading}>{`}`}</Button>
        </Tooltip>

        <div className="audio-tb-sep" />

        <Tooltip text={isPlaying ? t('audioEditor.transport.pause') : t('audioEditor.transport.playPause')}>
          <Button variant="icon" className={`audio-tb-btn${isPlaying ? ' is-active' : ''}`} onClick={onPlayPause} disabled={isLoading}>
            {isPlaying ? <Pause /> : <Play />}
          </Button>
        </Tooltip>
        <Tooltip text={t('audioEditor.transport.stop')}>
          <Button variant="icon" className="audio-tb-btn" onClick={onStop} disabled={isLoading}><Square /></Button>
        </Tooltip>
        <Tooltip text={t('audioEditor.transport.skipBack')}>
          <Button variant="icon" className="audio-tb-btn" onClick={onSkipBack} disabled={isLoading}><SkipBack /></Button>
        </Tooltip>
        <Tooltip text={t('audioEditor.transport.skipForward')}>
          <Button variant="icon" className="audio-tb-btn" onClick={onSkipForward} disabled={isLoading}><SkipForward /></Button>
        </Tooltip>

        <div className="audio-tb-sep" />

        <Tooltip text={t('audioEditor.transport.goToIn')}>
          <Button variant="icon" className="audio-tb-btn audio-tb-btn-text" onClick={onGoToTrimStart} disabled={isLoading}>|▶</Button>
        </Tooltip>
        <Tooltip text={t('audioEditor.transport.goToOut')}>
          <Button variant="icon" className="audio-tb-btn audio-tb-btn-text" onClick={onGoToTrimEnd} disabled={isLoading}>▶|</Button>
        </Tooltip>

        <div className="audio-tb-sep" />

        <Tooltip text={t('audioEditor.transport.keepSelection')}>
          <Button
            variant="icon"
            className="audio-tb-btn"
            onClick={onStageTrim}
            disabled={!canOperate}
          >
            <Crop />
          </Button>
        </Tooltip>
        <Tooltip text={t('audioEditor.transport.deleteSelection')}>
          <Button
            variant="icon"
            className="audio-tb-btn audio-tb-btn-danger"
            onClick={onStageCut}
            disabled={!canCut}
          >
            <Scissors />
          </Button>
        </Tooltip>
      </div>
      <div className="audio-editor-fade-slot is-right">
        <Tooltip text={fadeOutSec > 0 ? t('audioEditor.transport.fadeOutActive', { time: formatTime(Math.min(fadeOutSec, fadeMax)) }) : t('audioEditor.transport.fadeOutAdd')}>
          <Button
            variant="icon"
            className={`audio-tb-btn audio-editor-fade-chip${fadeOutSec > 0 ? ' is-active' : ''}`}
            onClick={(e) => onOpenFadePopover('out', e)}
            onContextMenu={(e) => onOpenFadePopover('out', e)}
            disabled={isApplying}
          >
            ↘
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}
