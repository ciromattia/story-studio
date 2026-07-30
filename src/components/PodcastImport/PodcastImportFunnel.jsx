import { useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  FunnelDoneState,
  FunnelFooter,
  FunnelGenerationState,
  FunnelSectionHeader,
  FunnelShell,
  FunnelStepper,
} from '../funnels';
import { Check, Loader2, Rss, Search, TriangleAlert } from '../icons/LucideLocal';
import { useTranslation } from '../../i18n/I18nContext';
import './PodcastImportFunnel.css';

function buildSteps(t) {
  return [
    { key: 'feed', label: t('importFunnels.podcast.stepFeed') },
    { key: 'episodes', label: t('importFunnels.podcast.stepEpisodes') },
  ];
}

function formatBytes(bytes, t) {
  if (!bytes || bytes <= 0) return '';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(mb >= 10 ? 0 : 1)} ${t('importFunnels.podcast.unitMb')}`;
  return `${Math.max(1, Math.round(bytes / 1024))} ${t('importFunnels.podcast.unitKb')}`;
}

function formatDate(pubDate, locale) {
  if (!pubDate) return '';
  const date = new Date(pubDate);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
}

function episodeMeta(ep, t, locale) {
  return [formatDate(ep.pubDate, locale), ep.duration, formatBytes(ep.sizeBytes, t)]
    .map((value) => (value || '').trim())
    .filter(Boolean)
    .join(' · ');
}

/**
 * Funnel accueil « Pack depuis un podcast ».
 * Réutilise les commandes podcast et délègue l'import réel à App/useImportSession,
 * qui crée les histoires dans l'éditeur après préparation de session.
 */
export function PodcastImportFunnel({ onClose, onImport }) {
  const { t, locale } = useTranslation();
  const [step, setStep] = useState(0);
  const [url, setUrl] = useState('');
  const [loadingFeed, setLoadingFeed] = useState(false);
  // collect (saisie) | importing (téléchargement) | error (échec total → accueil)
  const [importPhase, setImportPhase] = useState('collect');
  const [progress, setProgress] = useState(null);
  const [importError, setImportError] = useState('');
  const [error, setError] = useState('');
  const [feed, setFeed] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [query, setQuery] = useState('');

  const importing = importPhase === 'importing';

  const episodes = feed?.episodes ?? [];
  const normalizedQuery = query.trim().toLowerCase();
  const visibleEpisodes = useMemo(
    () => (normalizedQuery
      ? episodes.filter((ep) => ep.title.toLowerCase().includes(normalizedQuery))
      : episodes),
    [episodes, normalizedQuery],
  );

  async function handleLoadFeed(event) {
    event?.preventDefault();
    const trimmed = url.trim();
    if (!trimmed || loadingFeed) return;
    setLoadingFeed(true);
    setError('');
    try {
      const result = await invoke('fetch_podcast_feed', { url: trimmed });
      setFeed(result);
      setSelected(new Set());
      setQuery('');
      setStep(1);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoadingFeed(false);
    }
  }

  function toggleEpisode(id) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setSelected((current) => {
      const next = new Set(current);
      for (const ep of visibleEpisodes) next.add(ep.id);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function handleImport() {
    if (selected.size === 0 || importing) return;
    const chosen = episodes.filter((ep) => selected.has(ep.id));
    setError('');
    setImportError('');
    setProgress({
      name: feed?.title || t('importFunnels.podcast.defaultPodcastTitle'),
      index: 0,
      total: chosen.length,
      phase: t('importFunnels.podcast.preparingImport'),
    });
    setImportPhase('importing');
    try {
      // onImport route la progression dans cet écran (et non dans la modale
      // globale d'import) ; il lève en cas d'échec total → écran d'erreur.
      await onImport(chosen, feed, setProgress);
      onClose();
    } catch (err) {
      setImportError(String(err?.message ?? err));
      setImportPhase('error');
    }
  }

  const canOpenEpisodes = !!feed;
  const canUseStepper = !loadingFeed && !importing;
  const primaryDisabled = step === 0
    ? loadingFeed || !url.trim()
    : selected.size === 0 || importing;
  const primaryLabel = step === 0
    ? (loadingFeed ? t('importFunnels.podcast.loadingButton') : t('importFunnels.podcast.loadEpisodesButton'))
    : (selected.size > 0
      ? t(selected.size === 1 ? 'importFunnels.podcast.importOne' : 'importFunnels.podcast.importOther', { count: selected.size })
      : t('importFunnels.podcast.importDefault'));
  const STEPS = buildSteps(t);

  return (
    <FunnelShell
      icon={<Rss />}
      title={t('importFunnels.podcast.shellTitle')}
      subtitle={t('importFunnels.podcast.shellSubtitle')}
      onClose={importing ? () => {} : onClose}
      showChrome={importPhase === 'collect'}
      ariaLabel={t('importFunnels.podcast.ariaLabel')}
      stepper={(
        <FunnelStepper
          steps={STEPS}
          current={step}
          onStepClick={(index) => {
            if (index === 1 && !canOpenEpisodes) return;
            setStep(index);
          }}
          disabled={!canUseStepper}
        />
      )}
      footer={(
        <FunnelFooter
          onBack={() => setStep(0)}
          backDisabled={step === 0 || !canUseStepper}
          stepLabel={t('importFunnels.podcast.stepLabel', { current: step + 1, total: STEPS.length })}
          onPrimary={step === 0 ? handleLoadFeed : handleImport}
          primaryLabel={primaryLabel}
          primaryIcon={loadingFeed ? <Loader2 className="podcast-funnel-spin" /> : null}
          primaryDisabled={primaryDisabled}
        />
      )}
    >
      {importPhase === 'importing' ? (
        <FunnelGenerationState
          title={t('importFunnels.podcast.importingTitle')}
          hint={progress?.phase
            ? (progress.name ? `${progress.name} — ${progress.phase}` : progress.phase)
            : t('importFunnels.podcast.importingHint')}
          progress={progress && progress.total ? progress.index / progress.total : null}
        />
      ) : importPhase === 'error' ? (
        <FunnelDoneState
          tone="error"
          icon={<TriangleAlert />}
          title={t('importFunnels.podcast.importFailedTitle')}
          meta={importError}
        >
          <button type="button" className="funnel-btn funnel-btn-primary" onClick={onClose}>
            {t('importFunnels.podcast.backToHome')}
          </button>
        </FunnelDoneState>
      ) : step === 0 ? (
        <div className="funnel-step-content podcast-funnel-step">
          <FunnelSectionHeader
            icon={<Rss />}
            title={t('importFunnels.podcast.urlStepTitle')}
            description={t('importFunnels.podcast.urlStepDescription')}
          />
          <form className="podcast-funnel-form" onSubmit={handleLoadFeed}>
            <label className="podcast-funnel-field" htmlFor="podcast-funnel-url">
              <Rss />
              <input
                id="podcast-funnel-url"
                type="url"
                inputMode="url"
                placeholder={t('importFunnels.podcast.urlPlaceholder')}
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                disabled={loadingFeed}
                autoFocus
              />
            </label>
          </form>
          <p className="podcast-funnel-hint">
            {t('importFunnels.podcast.urlHint')}
          </p>
          {error && <div className="funnel-error" role="alert">{error}</div>}
        </div>
      ) : (
        <div className="funnel-step-content podcast-funnel-step podcast-funnel-step--episodes">
          <FunnelSectionHeader
            icon={<Rss />}
            title={feed?.title || t('importFunnels.podcast.defaultPodcastTitle')}
            description={t('importFunnels.podcast.episodesStepDescription')}
            trailing={(
              <span className="funnel-badge">
                {t(episodes.length === 1 ? 'importFunnels.podcast.episodeCountOne' : 'importFunnels.podcast.episodeCountOther', { count: episodes.length })}
              </span>
            )}
          />
          <div className="podcast-funnel-toolbar">
            <label className="podcast-funnel-field podcast-funnel-field--filter">
              <Search />
              <input
                type="text"
                placeholder={t('importFunnels.podcast.filterPlaceholder')}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <div className="podcast-funnel-bulk">
              <button type="button" className="podcast-funnel-seg" onClick={selectAllVisible}>
                {t('importFunnels.podcast.selectAll')}
              </button>
              <button type="button" className="podcast-funnel-seg" onClick={clearSelection} disabled={selected.size === 0}>
                {t('importFunnels.podcast.deselectAll')}
              </button>
            </div>
          </div>
          <div className="podcast-funnel-list">
            {visibleEpisodes.length === 0 ? (
              <div className="podcast-funnel-empty">
                <Search />
                <span>{t('importFunnels.podcast.noEpisodesMatch')}</span>
              </div>
            ) : (
              visibleEpisodes.map((ep) => {
                const checked = selected.has(ep.id);
                const meta = episodeMeta(ep, t, locale);
                return (
                  <button
                    type="button"
                    key={ep.id}
                    className={`podcast-funnel-row${checked ? ' is-selected' : ''}`}
                    aria-pressed={checked}
                    onClick={() => toggleEpisode(ep.id)}
                  >
                    <span className="podcast-funnel-check">{checked ? <Check /> : null}</span>
                    <span className="podcast-funnel-row-main">
                      <span className="podcast-funnel-row-name" title={ep.title}>{ep.title}</span>
                      {meta && <span className="podcast-funnel-row-meta">{meta}</span>}
                    </span>
                  </button>
                );
              })
            )}
          </div>
          {error && <div className="funnel-error" role="alert">{error}</div>}
        </div>
      )}
    </FunnelShell>
  );
}
