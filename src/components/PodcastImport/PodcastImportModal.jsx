import { useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AppModalPortal } from '../common/AppModalPortal';
import { Check, Loader2, Rss, Search, X } from '../icons/LucideLocal';
import { useTranslation } from '../../i18n/I18nContext';
import './PodcastImportModal.css';

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

export function PodcastImportModal({ onImport, onClose }) {
  const { t, locale } = useTranslation();
  const [phase, setPhase] = useState('url');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [feed, setFeed] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [query, setQuery] = useState('');

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
    if (!trimmed || loading) return;
    setLoading(true);
    setError('');
    try {
      const result = await invoke('fetch_podcast_feed', { url: trimmed });
      setFeed(result);
      setSelected(new Set());
      setQuery('');
      setPhase('episodes');
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
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

  function handleImport() {
    if (selected.size === 0) return;
    const chosen = episodes.filter((ep) => selected.has(ep.id));
    onImport(chosen, feed);
    onClose();
  }

  return (
    <AppModalPortal>
      <div
        className="podcast-modal"
        role="dialog"
        aria-label={t('importFunnels.podcast.modalTitle')}
        onClick={(event) => event.stopPropagation()}
      >
        {phase === 'url' ? (
          <>
            <header className="podcast-head">
              <span className="podcast-head-icon"><Rss /></span>
              <span className="podcast-head-title">{t('importFunnels.podcast.modalTitle')}</span>
              <span className="podcast-spacer" />
              <button type="button" className="podcast-icon-btn" aria-label={t('importFunnels.podcast.close')} onClick={onClose} disabled={loading}>
                <X />
              </button>
            </header>

            <div className="podcast-body">
              <form onSubmit={handleLoadFeed}>
                <label className="podcast-field-label" htmlFor="podcast-url-input">{t('importFunnels.podcast.urlFieldLabel')}</label>
                <label className="podcast-search">
                  <Rss />
                  <input
                    id="podcast-url-input"
                    type="url"
                    inputMode="url"
                    placeholder={t('importFunnels.podcast.urlPlaceholder')}
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    autoFocus
                  />
                </label>
              </form>
              <p className="podcast-hint">
                {t('importFunnels.podcast.urlHint')}
              </p>
              {error && <div className="podcast-error" role="alert">{error}</div>}
            </div>

            <footer className="podcast-foot">
              <button type="button" className="podcast-btn podcast-btn-ghost" onClick={onClose} disabled={loading}>
                {t('importFunnels.podcast.cancel')}
              </button>
              <span className="podcast-spacer" />
              <button
                type="button"
                className="podcast-btn podcast-btn-primary"
                onClick={handleLoadFeed}
                disabled={loading || !url.trim()}
              >
                {loading && <Loader2 className="podcast-spin" />}
                {loading ? t('importFunnels.podcast.loadingButton') : t('importFunnels.podcast.loadEpisodesButton')}
              </button>
            </footer>
          </>
        ) : (
          <>
            <header className="podcast-head">
              <span className="podcast-head-icon"><Rss /></span>
              <span className="podcast-head-title" title={feed?.title}>{feed?.title || t('importFunnels.podcast.defaultPodcastTitle')}</span>
              <span className="podcast-head-count">
                {t(episodes.length === 1 ? 'importFunnels.podcast.episodeCountOne' : 'importFunnels.podcast.episodeCountOther', { count: episodes.length })}
              </span>
              <span className="podcast-spacer" />
              <button type="button" className="podcast-icon-btn" aria-label={t('importFunnels.podcast.close')} onClick={onClose}>
                <X />
              </button>
            </header>

            <div className="podcast-subhead">
              <div className="podcast-toolbar">
                <label className="podcast-search">
                  <Search />
                  <input
                    type="text"
                    placeholder={t('importFunnels.podcast.filterPlaceholder')}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>
                <div className="podcast-bulk">
                  <button type="button" className="podcast-seg" onClick={selectAllVisible}>{t('importFunnels.podcast.selectAll')}</button>
                  <button type="button" className="podcast-seg" onClick={clearSelection} disabled={selected.size === 0}>
                    {t('importFunnels.podcast.deselectAll')}
                  </button>
                </div>
              </div>
            </div>

            <div className="podcast-scroll">
              {visibleEpisodes.length === 0 ? (
                <div className="podcast-empty">
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
                      className={`podcast-row${checked ? ' is-selected' : ''}`}
                      aria-pressed={checked}
                      onClick={() => toggleEpisode(ep.id)}
                    >
                      <span className="podcast-row-check">{checked ? <Check /> : null}</span>
                      <div className="podcast-row-main">
                        <div className="podcast-row-name" title={ep.title}>{ep.title}</div>
                        {meta && <div className="podcast-row-meta">{meta}</div>}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <footer className="podcast-foot">
              <button type="button" className="podcast-btn podcast-btn-ghost" onClick={() => setPhase('url')}>
                {t('importFunnels.podcast.back')}
              </button>
              <span className="podcast-spacer" />
              <span className="podcast-foot-status">
                <b>{selected.size}</b> {t(selected.size === 1 ? 'importFunnels.podcast.selectedSuffixOne' : 'importFunnels.podcast.selectedSuffixOther')}
              </span>
              <button
                type="button"
                className="podcast-btn podcast-btn-primary"
                onClick={handleImport}
                disabled={selected.size === 0}
              >
                {selected.size > 0
                  ? t(selected.size === 1 ? 'importFunnels.podcast.importOne' : 'importFunnels.podcast.importOther', { count: selected.size })
                  : t('importFunnels.podcast.importDefault')}
              </button>
            </footer>
          </>
        )}
      </div>
    </AppModalPortal>
  );
}
