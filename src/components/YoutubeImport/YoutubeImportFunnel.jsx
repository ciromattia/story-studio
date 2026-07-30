import { useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import {
  FunnelDoneState,
  FunnelFooter,
  FunnelGenerationState,
  FunnelSectionHeader,
  FunnelShell,
  FunnelStepper,
} from '../funnels';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Info,
  Search,
  TriangleAlert,
  Youtube,
} from '../icons/LucideLocal';
import { KEYS, read as readSetting, write as writeSetting } from '../../store/persistentSettings';
import { useTranslation } from '../../i18n/I18nContext';
import './YoutubeImportFunnel.css';

function buildSteps(t) {
  return [
    { key: 'url', label: t('importFunnels.youtube.stepUrl') },
    { key: 'videos', label: t('importFunnels.youtube.stepVideos') },
  ];
}

// Garde-fou de sélection : au-delà, on avertit (ton friendly, non bloquant).
const SELECTION_SOFT_CAP = 50;

function videoMeta(video) {
  return [video.duration].filter(Boolean).join(' · ');
}

/**
 * Funnel « Pack depuis YouTube » — jumeau du funnel podcast, source
 * yt-dlp. Sert l'entrée accueil (`mode="home"`, session éphémère créée par le
 * parent) **et** l'import dans l'éditeur libre (`mode="editor"`, projet courant) :
 * le composant est identique, seul `onImport` change côté parent.
 *
 * Premier usage : avertissement CGU (accepté une fois) puis téléchargement
 * automatique de yt-dlp, reflété par l'écran « Préparation… ».
 */
export function YoutubeImportFunnel({ onClose, onImport, mode = 'home' }) {
  const { t } = useTranslation();
  const ytDlpPath = useMemo(() => readSetting(KEYS.YTDLP_CUSTOM_PATH, { defaultValue: '' }), []);
  const cguAccepted = useMemo(() => readSetting(KEYS.YOUTUBE_CGU_ACCEPTED) === 'true', []);

  const [step, setStep] = useState(0);
  const [url, setUrl] = useState('');
  // cgu | collect | loading (provisioning + listing) | importing | error
  const [phase, setPhase] = useState(cguAccepted ? 'collect' : 'cgu');
  const [list, setList] = useState(null);
  // La valeur complète est conservée afin que l'import couvre toutes les
  // pages sélectionnées, pas seulement celle qui est affichée.
  const [selected, setSelected] = useState(() => new Map());
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [importError, setImportError] = useState('');
  const [progress, setProgress] = useState(null);
  const [logMessage, setLogMessage] = useState('');
  const pageCacheRef = useRef(new Map());
  const listingBusyRef = useRef(false);

  const busy = phase === 'loading' || phase === 'importing';

  // Progression de provisionnement/téléchargement émise par le backend.
  useEffect(() => {
    let unlisten = null;
    listen('youtube-log', (event) => setLogMessage(String(event.payload ?? ''))).then((fn) => {
      unlisten = fn;
    });
    return () => { unlisten?.(); };
  }, []);

  const videos = list?.videos ?? [];
  const normalizedQuery = query.trim().toLowerCase();
  const visibleVideos = useMemo(
    () => (normalizedQuery
      ? videos.filter((video) => video.title.toLowerCase().includes(normalizedQuery))
      : videos),
    [videos, normalizedQuery],
  );

  function handleAcceptCgu() {
    writeSetting(KEYS.YOUTUBE_CGU_ACCEPTED, 'true');
    setPhase('collect');
  }

  async function loadPage(targetPage, { initial = false } = {}) {
    const trimmed = url.trim();
    if (!trimmed || busy || listingBusyRef.current || targetPage < 1) return;
    const cached = initial ? null : pageCacheRef.current.get(targetPage);
    if (cached) {
      setError('');
      setLogMessage('');
      setList(cached);
      setQuery('');
      setStep(1);
      return;
    }
    listingBusyRef.current = true;
    setError('');
    setLogMessage('');
    setPhase('loading');
    try {
      const result = await invoke('fetch_youtube_list', {
        url: trimmed,
        ytdlpPath: ytDlpPath,
        page: targetPage,
      });
      pageCacheRef.current.set(targetPage, result);
      setList(result);
      setQuery('');
      setStep(1);
      setPhase('collect');
    } catch (err) {
      setError(String(err?.message ?? err));
      setPhase('collect');
      setStep(initial ? 0 : 1);
    } finally {
      listingBusyRef.current = false;
    }
  }

  async function handleLoadList(event) {
    event?.preventDefault();
    if (!url.trim() || busy) return;
    pageCacheRef.current.clear();
    setList(null);
    setSelected(new Map());
    await loadPage(1, { initial: true });
  }

  function toggleVideo(video) {
    const key = video.selectionKey || video.id || video.audioUrl;
    setSelected((current) => {
      const next = new Map(current);
      if (next.has(key)) next.delete(key);
      else next.set(key, video);
      return next;
    });
  }

  function selectAllVisible() {
    setSelected((current) => {
      const next = new Map(current);
      for (const video of visibleVideos) {
        next.set(video.selectionKey || video.id || video.audioUrl, video);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Map());
  }

  async function handleImport() {
    if (selected.size === 0 || busy) return;
    const chosen = [...selected.values()].sort(
      (left, right) => (left.sourceIndex ?? 0) - (right.sourceIndex ?? 0),
    );
    setError('');
    setImportError('');
    setLogMessage('');
    setProgress({
      name: list?.title || t('importFunnels.youtube.defaultYoutubeTitle'),
      index: 0,
      total: chosen.length,
      phase: t('importFunnels.youtube.preparingImport'),
    });
    setPhase('importing');
    try {
      // onImport route la progression dans cet écran et lève en cas d'échec total.
      await onImport(chosen, list, setProgress);
      onClose();
    } catch (err) {
      setImportError(String(err?.message ?? err));
      setPhase('error');
    }
  }

  const canOpenVideos = !!list;
  const currentPage = list?.page ?? 1;
  const pageSize = list?.pageSize ?? 400;
  const firstVisibleIndex = ((currentPage - 1) * pageSize) + 1;
  const lastVisibleIndex = firstVisibleIndex + Math.max(videos.length - 1, 0);
  const overCap = selected.size > SELECTION_SOFT_CAP;
  const primaryDisabled = step === 0 ? !url.trim() : selected.size === 0;
  const primaryLabel = step === 0
    ? t('importFunnels.youtube.loadVideosButton')
    : (selected.size > 0
      ? t(selected.size === 1 ? 'importFunnels.youtube.importOne' : 'importFunnels.youtube.importOther', { count: selected.size })
      : t('importFunnels.youtube.importDefault'));

  const subtitle = mode === 'editor'
    ? t('importFunnels.youtube.shellSubtitleEditor')
    : t('importFunnels.youtube.shellSubtitleHome');
  const STEPS = buildSteps(t);

  return (
    <FunnelShell
      icon={<Youtube />}
      title={t('importFunnels.youtube.shellTitle')}
      subtitle={subtitle}
      onClose={busy ? () => {} : onClose}
      showChrome={phase === 'collect'}
      ariaLabel={t('importFunnels.youtube.ariaLabel')}
      stepper={(
        <FunnelStepper
          steps={STEPS}
          current={step}
          onStepClick={(index) => {
            if (index === 1 && !canOpenVideos) return;
            setStep(index);
          }}
        />
      )}
      footer={(
        <FunnelFooter
          onBack={() => setStep(0)}
          backDisabled={step === 0}
          stepLabel={t('importFunnels.youtube.stepLabel', { current: step + 1, total: STEPS.length })}
          onPrimary={step === 0 ? handleLoadList : handleImport}
          primaryLabel={primaryLabel}
          primaryDisabled={primaryDisabled}
        />
      )}
    >
      {phase === 'cgu' ? (
        <div className="funnel-step-content youtube-funnel-step youtube-funnel-cgu">
          <FunnelSectionHeader
            icon={<Info />}
            title={t('importFunnels.youtube.cguTitle')}
            description={t('importFunnels.youtube.cguSubtitle')}
          />
          <p className="youtube-funnel-cgu-text">
            {t('importFunnels.youtube.cguBodyPrefix')}<strong>{t('importFunnels.youtube.cguBodyStrong')}</strong>{t('importFunnels.youtube.cguBodySuffix')}
          </p>
          <p className="youtube-funnel-hint">
            {t('importFunnels.youtube.cguHint')}
          </p>
          <div className="youtube-funnel-cgu-actions">
            <button type="button" className="funnel-btn funnel-btn-primary" onClick={handleAcceptCgu}>
              {t('importFunnels.youtube.cguAccept')}
            </button>
          </div>
        </div>
      ) : phase === 'loading' ? (
        <FunnelGenerationState
          title={t('importFunnels.youtube.preparingTitle')}
          hint={logMessage || t('importFunnels.youtube.preparingHint')}
        />
      ) : phase === 'importing' ? (
        <FunnelGenerationState
          title={t('importFunnels.youtube.importingTitle')}
          hint={progress?.phase
            ? (progress.name ? `${progress.name} — ${progress.phase}` : progress.phase)
            : (logMessage || t('importFunnels.youtube.importingHint'))}
          progress={progress && progress.total ? progress.index / progress.total : null}
        />
      ) : phase === 'error' ? (
        <FunnelDoneState
          tone="error"
          icon={<TriangleAlert />}
          title={t('importFunnels.youtube.importFailedTitle')}
          meta={importError}
        >
          <button type="button" className="funnel-btn funnel-btn-primary" onClick={onClose}>
            {t('importFunnels.youtube.close')}
          </button>
        </FunnelDoneState>
      ) : step === 0 ? (
        <div className="funnel-step-content youtube-funnel-step">
          <FunnelSectionHeader
            icon={<Youtube />}
            title={t('importFunnels.youtube.urlStepTitle')}
            description={t('importFunnels.youtube.urlStepDescription')}
          />
          <form className="youtube-funnel-form" onSubmit={handleLoadList}>
            <label className="youtube-funnel-field" htmlFor="youtube-funnel-url">
              <Youtube />
              <input
                id="youtube-funnel-url"
                type="url"
                inputMode="url"
                placeholder={t('importFunnels.youtube.urlPlaceholder')}
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                autoFocus
              />
            </label>
          </form>
          <p className="youtube-funnel-hint">
            {t('importFunnels.youtube.urlHint')}
          </p>
          {error && <div className="funnel-error" role="alert">{error}</div>}
        </div>
      ) : (
        <div className="funnel-step-content youtube-funnel-step youtube-funnel-step--videos">
          <FunnelSectionHeader
            icon={<Youtube />}
            title={list?.title || t('importFunnels.youtube.defaultYoutubeTitle')}
            description={t('importFunnels.youtube.videosStepDescription')}
            trailing={(
              <span className="funnel-badge">
                {videos.length > 0
                  ? t('importFunnels.youtube.videoRangeBadge', { first: firstVisibleIndex, last: lastVisibleIndex })
                  : t('importFunnels.youtube.noVideosBadge')}
              </span>
            )}
          />
          <div className="youtube-funnel-toolbar">
            <label className="youtube-funnel-field youtube-funnel-field--filter">
              <Search />
              <input
                type="text"
                placeholder={t('importFunnels.youtube.filterPlaceholder')}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              </label>
            <div className="youtube-funnel-bulk">
              <button type="button" className="youtube-funnel-seg" onClick={selectAllVisible}>
                {t('importFunnels.youtube.selectAll')}
              </button>
              <button type="button" className="youtube-funnel-seg" onClick={clearSelection} disabled={selected.size === 0}>
                {t('importFunnels.youtube.deselectAll')}
              </button>
            </div>
          </div>
          {overCap && (
            <div className="youtube-funnel-notice" role="status">
              <Info />
              <span>{t('importFunnels.youtube.overCapNotice', { count: selected.size })}</span>
            </div>
          )}
          <div className="youtube-funnel-list">
            {visibleVideos.length === 0 ? (
              <div className="youtube-funnel-empty">
                <Search />
                <span>{t('importFunnels.youtube.noVideosMatch')}</span>
              </div>
            ) : (
              visibleVideos.map((video) => {
                const videoKey = video.selectionKey || video.id || video.audioUrl;
                const checked = selected.has(videoKey);
                const meta = videoMeta(video);
                return (
                  <button
                    type="button"
                    key={videoKey}
                    className={`youtube-funnel-row${checked ? ' is-selected' : ''}`}
                    aria-pressed={checked}
                    onClick={() => toggleVideo(video)}
                  >
                    <span className="youtube-funnel-check">{checked ? <Check /> : null}</span>
                    <span className="youtube-funnel-row-main">
                      <span className="youtube-funnel-row-name" title={video.title}>{video.title}</span>
                      {meta && <span className="youtube-funnel-row-meta">{meta}</span>}
                    </span>
                  </button>
                );
              })
            )}
          </div>
          <nav className="youtube-funnel-pagination" aria-label={t('importFunnels.youtube.paginationAriaLabel')}>
            <button
              type="button"
              className="youtube-funnel-page-btn"
              onClick={() => loadPage(currentPage - 1)}
              disabled={currentPage <= 1 || busy}
            >
              <ChevronLeft />
              <span>{t('importFunnels.youtube.previousPage')}</span>
            </button>
            <span className="youtube-funnel-page-label">{t('importFunnels.youtube.pageLabel', { page: currentPage })}</span>
            <button
              type="button"
              className="youtube-funnel-page-btn"
              onClick={() => loadPage(currentPage + 1)}
              disabled={!list?.hasNext || busy}
            >
              <span>{t('importFunnels.youtube.nextPage')}</span>
              <ChevronRight />
            </button>
          </nav>
          {error && <div className="funnel-error" role="alert">{error}</div>}
        </div>
      )}
    </FunnelShell>
  );
}
