import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalFile } from '../../hooks/useLocalFile';
import { createAudioPlayer, disposeAudioPlayerRef } from '../../utils/audioPlayer';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useTranslation } from '../../i18n/I18nContext';
import { Tooltip } from '../common/Tooltip';
import { Button } from '../common/Button';
import { basename } from '../../utils/fileUtils';
import { mediaDrag } from '../../store/dragState';
import { Image as ImageIcon, Music, Pause, Play, RotateCcw, X } from '../icons/LucideLocal';
import { QUEUE_COLUMNS, resolveQueueGrid, useQueueColumnWidths } from './useQueueColumnWidths';
import './SDQueuePanel.css';

let activeQueueAudioStopper = null;

function formatCreatedAt(ts) {
  if (!ts) return '-';
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return '-';
  const day = date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `${day} ${time}`;
}

function progressPercent(progress) {
  if (typeof progress !== 'number' || !Number.isFinite(progress)) return null;
  return Math.max(0, Math.min(100, Math.round(progress * 100)));
}

function isActiveJob(job) {
  return job.status === 'pending' || job.status === 'submitting' || job.status === 'running';
}

function startQueueMediaDrag(event, { kind, path, label, onDragStart = null }) {
  if (!path || (kind !== 'audio' && kind !== 'image') || event.button !== 0) return;
  if (event.target?.closest?.('input, textarea, [role="slider"], .sd-queue-row-actions, .sd-result-play')) return;

  const startX = event.clientX;
  const startY = event.clientY;
  let dragging = false;
  let ghost = null;
  let currentTarget = null;

  function findTarget(x, y) {
    return document.elementsFromPoint(x, y).find((el) => el.dataset.dropKind === kind) ?? null;
  }

  function onMove(ev) {
    if (!dragging) {
      if (Math.abs(ev.clientX - startX) < 6 && Math.abs(ev.clientY - startY) < 6) return;
      dragging = true;
      onDragStart?.();
      mediaDrag.start(kind, path);
      ghost = document.createElement('div');
      ghost.className = 'sd-queue-drag-ghost';
      ghost.textContent = label || basename(path);
      document.body.appendChild(ghost);
    }

    ghost.style.left = `${ev.clientX + 14}px`;
    ghost.style.top = `${ev.clientY - 14}px`;

    const nextTarget = findTarget(ev.clientX, ev.clientY);
    if (nextTarget !== currentTarget) {
      currentTarget?.classList.remove('is-drop-over');
      nextTarget?.classList.add('is-drop-over');
      currentTarget = nextTarget;
      ghost.classList.toggle('is-over-target', !!nextTarget);
    }
  }

  function onUp() {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    if (ghost) {
      document.body.removeChild(ghost);
      ghost = null;
    }
    currentTarget?.classList.remove('is-drop-over');

    if (dragging && currentTarget) {
      currentTarget.dispatchEvent(new CustomEvent('media-drop', {
        bubbles: false,
        detail: { path, kind },
      }));
    }
    mediaDrag.end();
  }

  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
}

function ProgressRing({ progress }) {
  const { t } = useTranslation();
  const percent = progressPercent(progress);

  if (percent == null) {
    return <span className="sd-progress-ring sd-progress-ring-spin" aria-hidden="true" />;
  }

  const progressText = t('generation.sdQueue.progressTooltip', { percent });

  return (
    <Tooltip text={progressText}>
      <span
        className="sd-progress-ring"
        style={{ '--progress': `${percent}%` }}
        aria-label={progressText}
      />
    </Tooltip>
  );
}

function UsageBadge({ usage }) {
  if (!usage) return <span className="sd-cell-muted">-</span>;
  return (
    <Tooltip text={usage.detail} wrap>
      <span className={`sd-usage-badge sd-usage-${usage.state}`}>
        {usage.label}
      </span>
    </Tooltip>
  );
}

function StatusBadge({ job }) {
  const { t } = useTranslation();
  const percent = progressPercent(job.progress);
  const active = isActiveJob(job);
  const label = active && percent != null ? `${percent}%` : (t(`generation.sdQueue.status.${job.status}`) ?? job.status);

  return (
    <span className={`sd-job-badge sd-badge-${job.status}`}>
      {active && <ProgressRing progress={job.progress} />}
      {label}
    </span>
  );
}

function JobKind({ isImageJob }) {
  const { t } = useTranslation();
  const Icon = isImageJob ? ImageIcon : Music;
  return (
    <span className={`sd-kind-pill${isImageJob ? ' is-image' : ' is-audio'}`}>
      <Icon className="sd-kind-icon" strokeWidth={2} absoluteStrokeWidth />
      {isImageJob ? t('generation.sdQueue.kind.image') : t('generation.sdQueue.kind.audio')}
    </span>
  );
}

function JobResultThumb({ path, onPreview }) {
  const { t } = useTranslation();
  const url = useLocalFile(path);
  const draggedRef = useRef(false);

  function handleClick(event) {
    if (draggedRef.current) {
      event.preventDefault();
      draggedRef.current = false;
      return;
    }
    onPreview(path);
  }

  return (
    <Tooltip text={t('generation.sdQueue.previewTooltip')}>
      <button
        className="sd-result-thumb"
        onPointerDown={(event) => startQueueMediaDrag(event, {
          kind: 'image',
          path,
          label: basename(path),
          onDragStart: () => { draggedRef.current = true; },
        })}
        onClick={handleClick}
        aria-label={t('generation.sdQueue.previewAria', { filename: basename(path) })}
      >
        {url ? (
          <img src={url} alt="" className="sd-result-img" />
        ) : (
          <div className="sd-result-placeholder" />
        )}
      </button>
    </Tooltip>
  );
}

function ImagePreviewModal({ path, onClose }) {
  const { t } = useTranslation();
  const url = useLocalFile(path);
  const filename = basename(path);
  useEscapeKey(true, () => onClose?.());
  return (
    <div className="modal-overlay sd-preview-overlay" onMouseDown={onClose}>
      <div className="modal-box sd-preview-box" onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <span>{filename || t('generation.sdQueue.previewFallbackTitle')}</span>
          <Button variant="icon" className="modal-close" onClick={onClose} aria-label={t('generation.sdQueue.closeAria')}>
            <X className="sd-modal-close-icon" strokeWidth={2} absoluteStrokeWidth />
          </Button>
        </div>
        <div className="sd-preview-body">
          {url ? <img src={url} alt={filename} className="sd-preview-img" /> : <div className="sd-result-placeholder" />}
        </div>
      </div>
    </div>
  );
}

function QueueAudioButton({ path, filename }) {
  const { t } = useTranslation();
  const url = useLocalFile(path);
  const audioRef = useRef(null);
  const stopRef = useRef(null);
  const [playing, setPlaying] = useState(false);

  if (!stopRef.current) {
    stopRef.current = () => {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
      setPlaying(false);
      if (activeQueueAudioStopper === stopRef.current) activeQueueAudioStopper = null;
    };
  }

  useEffect(() => {
    setPlaying(false);
    if (url) {
      const audio = createAudioPlayer(url);
      audioRef.current = audio;
      audio.addEventListener('play', () => setPlaying(true));
      audio.addEventListener('pause', () => setPlaying(false));
      audio.addEventListener('ended', () => stopRef.current?.());
    }
    return () => {
      if (activeQueueAudioStopper === stopRef.current) activeQueueAudioStopper = null;
      disposeAudioPlayerRef(audioRef);
    };
  }, [url]);

  async function togglePlayback(event) {
    event.stopPropagation();
    const audio = audioRef.current;
    if (!audio || !url) return;

    if (!audio.paused) {
      stopRef.current?.();
      return;
    }

    activeQueueAudioStopper?.();
    activeQueueAudioStopper = stopRef.current;
    try {
      await audio.play();
      setPlaying(true);
    } catch {
      if (activeQueueAudioStopper === stopRef.current) activeQueueAudioStopper = null;
      setPlaying(false);
    }
  }

  const Icon = playing ? Pause : Play;
  const actionLabel = playing ? t('generation.sdQueue.stopAction') : t('generation.sdQueue.playAction');

  return (
    <>
      <Button
        variant="icon"
        size="sm"
        className={`sd-result-play${playing ? ' is-playing' : ''}`}
        onClick={togglePlayback}
        aria-label={t('generation.sdQueue.playAria', { action: actionLabel, filename })}
        title={actionLabel}
        disabled={!url}
      >
        <Icon className="sd-row-icon" strokeWidth={2} absoluteStrokeWidth />
      </Button>
    </>
  );
}

function ResultCell({ job, isImageJob, onPreviewImage }) {
  const { t } = useTranslation();
  if (job.status === 'error') {
    const errorText = job.errorMessage || t('generation.sdQueue.genericError');
    return (
      <Tooltip text={errorText} wrap className="sd-result-error-wrap">
        <span className="sd-result-error">{errorText}</span>
      </Tooltip>
    );
  }

  if (job.status !== 'done') {
    return <span className="sd-cell-muted">-</span>;
  }

  if (isImageJob) {
    const paths = job.resultPaths ?? [];
    if (paths.length === 0) return <span className="sd-cell-muted">{t('generation.sdQueue.noFile')}</span>;
    const visiblePaths = paths.slice(0, 2);
    return (
      <div className="sd-image-result-cell">
        <div className="sd-result-thumbs">
          {visiblePaths.map(path => (
            <JobResultThumb key={path} path={path} onPreview={onPreviewImage} />
          ))}
          {paths.length > visiblePaths.length && (
            <span className="sd-result-count">+{paths.length - visiblePaths.length}</span>
          )}
        </div>
        <Tooltip text={paths[0]} wrap className="sd-result-name-wrap">
          <span className="sd-result-name">{basename(paths[0])}</span>
        </Tooltip>
      </div>
    );
  }

  if (!job.resultPath) return <span className="sd-cell-muted">{t('generation.sdQueue.noFile')}</span>;
  const filename = basename(job.resultPath);
  return (
    <div
      className="sd-audio-result-cell"
      onPointerDown={(event) => startQueueMediaDrag(event, {
        kind: 'audio',
        path: job.resultPath,
        label: filename,
      })}
    >
      <QueueAudioButton path={job.resultPath} filename={filename} />
      <Tooltip text={job.resultPath} wrap className="sd-result-name-wrap">
        <span className="sd-result-name">{filename}</span>
      </Tooltip>
    </div>
  );
}

function QueueRow({ job, onRemove, onPreviewImage, onRegenerateImage, getAudioUsage, getImageUsage }) {
  const { t } = useTranslation();
  const isImageJob = job.kind !== 'audio';
  const title = isImageJob
    ? (job.workflowName || t('generation.sdQueue.fallbackImageTitle'))
    : (job.label || t('generation.sdQueue.fallbackAudioTitle'));
  const subtitle = isImageJob ? 'ComfyUI' : (job.voiceLabel || 'XTTS');
  const usage = job.status === 'done'
    ? (isImageJob ? getImageUsage?.(job) : getAudioUsage?.(job))
    : null;
  const target = job.targetLabel || '-';

  return (
    <div className={`sd-queue-row sd-job-${job.status}`}>
      <div className="sd-queue-cell">
        <JobKind isImageJob={isImageJob} />
      </div>
      <div className="sd-queue-cell sd-title-cell">
        <span className="sd-cell-main" title={title}>{title}</span>
        <span className="sd-cell-sub" title={subtitle}>{subtitle}</span>
      </div>
      <div className="sd-queue-cell">
        <span className="sd-cell-text" title={target}>{target}</span>
      </div>
      <div className="sd-queue-cell sd-result-cell">
        <ResultCell
          job={job}
          isImageJob={isImageJob}
          onPreviewImage={onPreviewImage}
        />
      </div>
      <div className="sd-queue-cell">
        <StatusBadge job={job} />
      </div>
      <div className="sd-queue-cell">
        <UsageBadge usage={usage} />
      </div>
      <div className="sd-queue-cell">
        <span className="sd-cell-date">{formatCreatedAt(job.createdAt)}</span>
      </div>
      <div className="sd-queue-row-actions">
        {job.status === 'done' && isImageJob && (
          <Button
            variant="icon"
            size="sm"
            className="sd-row-action"
            onClick={() => onRegenerateImage?.(job)}
            aria-label={t('generation.sdQueue.regenerateAria')}
            title={t('generation.sdQueue.regenerateTitle')}
          >
            <RotateCcw className="sd-row-icon" strokeWidth={2} absoluteStrokeWidth />
          </Button>
        )}
        {(job.status === 'done' || job.status === 'error') && (
          <Button
            variant="icon"
            size="sm"
            className="sd-row-action"
            onClick={() => onRemove(job.id)}
            aria-label={t('generation.sdQueue.removeAria')}
            title={t('generation.sdQueue.removeTitle')}
          >
            <X className="sd-row-icon" strokeWidth={2} absoluteStrokeWidth />
          </Button>
        )}
      </div>
    </div>
  );
}

export function SDQueuePanel({
  imageJobs = [],
  audioJobs = [],
  onRemoveImage,
  onRemoveAudio,
  getAudioUsage,
  getImageUsage,
  onRegenerateImage,
  onClearDone,
  onClose,
  embedded = false,
}) {
  const { t } = useTranslation();
  const jobs = [...imageJobs, ...audioJobs].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  const hasDone = jobs.some(j => j.status === 'done' || j.status === 'error');
  const [previewPath, setPreviewPath] = useState(null);
  const [tableWidth, setTableWidth] = useState(0);
  const tableRef = useRef(null);
  const headerRef = useRef(null);
  const scrollRef = useRef(null);
  const { colWidths, colWidthsRef, setColWidths, persistColWidths } = useQueueColumnWidths();
  const resolvedGrid = useMemo(() => resolveQueueGrid(colWidths, tableWidth), [colWidths, tableWidth]);
  useEscapeKey(!embedded && !previewPath, () => onClose?.());

  useEffect(() => {
    const table = tableRef.current;
    if (!table) return undefined;

    function syncWidth() {
      setTableWidth(table.clientWidth);
    }

    if (typeof ResizeObserver === 'undefined') {
      syncWidth();
      window.addEventListener('resize', syncWidth);
      return () => window.removeEventListener('resize', syncWidth);
    }

    const observer = new ResizeObserver(syncWidth);
    observer.observe(table);
    syncWidth();
    return () => observer.disconnect();
  }, [jobs.length]);

  useEffect(() => {
    const scroll = scrollRef.current;
    const header = headerRef.current;
    if (!scroll || !header) return undefined;

    function syncGutter() {
      const gutter = scroll.offsetWidth - scroll.clientWidth;
      header.style.paddingRight = `${9 + gutter}px`;
    }

    if (typeof ResizeObserver === 'undefined') {
      syncGutter();
      window.addEventListener('resize', syncGutter);
      return () => window.removeEventListener('resize', syncGutter);
    }

    const observer = new ResizeObserver(syncGutter);
    observer.observe(scroll);
    syncGutter();
    return () => observer.disconnect();
  }, [jobs.length, resolvedGrid.grid]);

  function startResize(event, col) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = resolvedGrid.widths?.[col.id] ?? colWidthsRef.current[col.id] ?? col.defaultWidth;
    document.body.style.cursor = 'col-resize';

    function onMove(moveEvent) {
      const delta = moveEvent.clientX - startX;
      const width = Math.max(col.minWidth, startWidth + delta);
      setColWidths({ ...colWidthsRef.current, [col.id]: width });
    }

    function onUp() {
      document.body.style.cursor = '';
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      persistColWidths();
    }

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }

  const tableStyle = {
    '--sd-queue-grid': resolvedGrid.grid,
    '--sd-queue-min-width': resolvedGrid.minWidth,
  };

  const content = (
    <>
      <div className={embedded ? 'sd-queue-embedded-header' : 'modal-header'}>
        <span>{t('generation.sdQueue.title')}</span>
        <div className="sd-queue-header-actions">
          {hasDone && (
            <Button size="sm" onClick={onClearDone}>
              {t('generation.sdQueue.clearDoneButton')}
            </Button>
          )}
          {!embedded && (
            <Button variant="icon" className="modal-close" onClick={onClose} aria-label={t('generation.sdQueue.closeAria')}>
              <X className="sd-modal-close-icon" strokeWidth={2} absoluteStrokeWidth />
            </Button>
          )}
        </div>
      </div>

      <div className="sd-queue-body">
        {jobs.length === 0 ? (
          <div className="sd-queue-empty">{t('generation.sdQueue.emptyState')}</div>
        ) : (
          <div className="sd-queue-table" ref={tableRef} style={tableStyle}>
            <div className="sd-queue-table-header" ref={headerRef}>
              {QUEUE_COLUMNS.map((col) => (
                <div key={col.id} className="sd-col-head">
                  <span className="sd-col-label">{t(`generation.sdQueue.columns.${col.id}`)}</span>
                  {col.id !== 'actions' && (
                    <span
                      className="sd-col-resize"
                      onPointerDown={(event) => startResize(event, col)}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="sd-queue-table-scroll" ref={scrollRef}>
              {jobs.map(job => (
                <QueueRow
                  key={job.id}
                  job={job}
                  onRemove={job.kind === 'audio' ? onRemoveAudio : onRemoveImage}
                  onPreviewImage={setPreviewPath}
                  onRegenerateImage={onRegenerateImage}
                  getAudioUsage={getAudioUsage}
                  getImageUsage={getImageUsage}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      {previewPath && (
        <ImagePreviewModal path={previewPath} onClose={() => setPreviewPath(null)} />
      )}
    </>
  );

  if (embedded) {
    return <div className="sd-queue-embedded">{content}</div>;
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box sd-queue-box">
        {content}
      </div>
    </div>
  );
}
