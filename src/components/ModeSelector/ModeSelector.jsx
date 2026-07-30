import { useEffect, useMemo, useState } from 'react';
import './ModeSelector.css';
import { FilePen, FolderOpen, Layers, Package, Rss, ShieldCheck, SlidersHorizontal, SwatchBook, X, Youtube } from '../icons/LucideLocal';
import { Tooltip } from '../common/Tooltip';
import { useLocalFile } from '../../hooks/useLocalFile';
import { loadProjectFromPath } from '../../store/projectIO';
import { useTranslation } from '../../i18n/I18nContext';

function formatRecentDate(updatedAt, t) {
  if (!updatedAt) return '';
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return t('shell.modeSelector.today');
  if (date.toDateString() === yesterday.toDateString()) return t('shell.modeSelector.yesterday');
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function projectTypeLabel(type, t) {
  return type === 'simple' ? t('shell.modeSelector.projectTypeStory') : t('shell.modeSelector.projectTypePack');
}

function ProjectThumb({ project, index, loadedThumbnail = null }) {
  const thumbnailPath = project.thumbnailImage || loadedThumbnail || null;
  const thumbnailUrl = useLocalFile(thumbnailPath);

  if (thumbnailUrl) {
    return (
      <span className="mode-proj-thumb">
        <img src={thumbnailUrl} alt="" />
      </span>
    );
  }

  return <span className={`mode-proj-dot mode-proj-dot--tone-${index % 5}`} />;
}

export function ModeSelector({
  onSelect,
  onEditPack,
  onPodcastFunnel,
  onYoutubeFunnel,
  onAggregatePacks,
  onCheckPack,
  onOpen,
  onOpenPreferences,
  recentProjects = [],
  onOpenRecent,
  sessionRecoveries = [],
  onRecoverSession,
  onIgnoreSessionRecovery,
}) {
  const { t } = useTranslation();
  const [loadedThumbnails, setLoadedThumbnails] = useState({});
  const visibleRecentProjects = useMemo(() => recentProjects.slice(0, 6), [recentProjects]);
  const visibleRecoveries = useMemo(() => sessionRecoveries.slice(0, 2), [sessionRecoveries]);
  const hasProjects = visibleRecentProjects.length > 0 || visibleRecoveries.length > 0;

  const editors = [
    {
      key: 'pack',
      Icon: SwatchBook,
      name: t('shell.modeSelector.editorFreeName'),
      desc: t('shell.modeSelector.editorFreeDesc'),
      onClick: () => onSelect('pack'),
    },
    {
      key: 'simple',
      Icon: FilePen,
      name: t('shell.modeSelector.editorSimpleName'),
      desc: t('shell.modeSelector.editorSimpleDesc'),
      onClick: () => onSelect('simple'),
    },
  ];

  const actions = [
    onEditPack && {
      key: 'edit',
      Icon: Package,
      name: t('shell.modeSelector.actionEditName'),
      desc: t('shell.modeSelector.actionEditDesc'),
      onClick: onEditPack,
    },
    onPodcastFunnel && {
      key: 'podcast',
      Icon: Rss,
      name: t('shell.modeSelector.actionPodcastName'),
      desc: t('shell.modeSelector.actionPodcastDesc'),
      onClick: onPodcastFunnel,
    },
    onYoutubeFunnel && {
      key: 'youtube',
      Icon: Youtube,
      name: t('shell.modeSelector.actionYoutubeName'),
      desc: t('shell.modeSelector.actionYoutubeDesc'),
      onClick: onYoutubeFunnel,
    },
    onAggregatePacks && {
      key: 'aggregate',
      Icon: Layers,
      name: t('shell.modeSelector.actionAggregateName'),
      desc: t('shell.modeSelector.actionAggregateDesc'),
      onClick: onAggregatePacks,
    },
    onCheckPack && {
      key: 'check',
      Icon: ShieldCheck,
      name: t('shell.modeSelector.actionCheckName'),
      desc: t('shell.modeSelector.actionCheckDesc'),
      onClick: onCheckPack,
    },
    {
      key: 'open',
      Icon: FolderOpen,
      name: t('shell.modeSelector.actionOpenName'),
      desc: t('shell.modeSelector.actionOpenDesc'),
      onClick: onOpen,
    },
  ].filter(Boolean);

  useEffect(() => {
    let cancelled = false;
    const projectsToLoad = visibleRecentProjects.filter((project) => (
      project?.path
      && !project.thumbnailImage
    ));
    if (!projectsToLoad.length) return undefined;

    Promise.all(projectsToLoad.map((project) => (
      loadProjectFromPath(project.path)
        .then((result) => [project.path, result?.data?.thumbnailImage || result?.data?.rootImage || null])
        .catch(() => [project.path, null])
    ))).then((entries) => {
      if (cancelled) return;
      setLoadedThumbnails((prev) => {
        const next = { ...prev };
        for (const [path, thumbnail] of entries) {
          if (next[path] === undefined) next[path] = thumbnail;
        }
        return next;
      });
    });

    return () => { cancelled = true; };
  }, [visibleRecentProjects]);

  return (
    <div className="mode-selector">
      <div className="mode-home">
        <header className="mode-home-header">
          <Tooltip text={t('shell.modeSelector.headerTooltip')} placement="below">
            <span className="mode-home-mark" role="img" aria-label="Story Studio" />
          </Tooltip>
          <div className="mode-home-brand">
            <div className="mode-home-wordmark">Story Studio</div>
            <div className="mode-home-tagline">
              {t('shell.modeSelector.tagline')}
            </div>
          </div>
        </header>

        <div className="mode-home-body">
          <div className="mode-home-create">
            <div className="mode-editor-grid">
              {editors.map((tile) => (
                <button
                  key={tile.key}
                  type="button"
                  className="mode-tile mode-tile--editor"
                  onClick={tile.onClick}
                >
                  <span className="mode-tile-icon"><tile.Icon className="mode-tile-icon-svg" strokeWidth={1.9} /></span>
                  <span className="mode-tile-name">{tile.name}</span>
                  <span className="mode-tile-desc">{tile.desc}</span>
                </button>
              ))}
            </div>

            <div className="mode-home-separator" />

            <div className="mode-action-grid">
              {actions.map((tile) => (
                <button
                  key={tile.key}
                  type="button"
                  className="mode-tile"
                  onClick={tile.onClick}
                >
                  <span className="mode-tile-icon"><tile.Icon className="mode-tile-icon-svg" strokeWidth={1.9} /></span>
                  <span className="mode-tile-name">{tile.name}</span>
                  <span className="mode-tile-desc">{tile.desc}</span>
                </button>
              ))}
            </div>

            <div className="mode-home-prefs">
              <button type="button" className="mode-ghost-button" onClick={onOpenPreferences}>
                <SlidersHorizontal className="mode-ghost-icon" strokeWidth={1.9} />
                <span>{t('shell.modeSelector.preferencesButton')}</span>
              </button>
            </div>
          </div>

          {hasProjects && (
            <aside className="mode-projects-pane">
              <div className="mode-projects-eyebrow">{t('shell.modeSelector.recentProjectsLabel')}</div>
              <div className="mode-projects-list">
                {visibleRecoveries.map((recovery, index) => (
                  <div
                    className="mode-proj-row mode-proj-row--recovery"
                    key={recovery.sessionDir || recovery.snapshotPath}
                  >
                    <button
                      type="button"
                      className="mode-proj-open"
                      onClick={() => onRecoverSession?.(recovery)}
                    >
                      <ProjectThumb
                        project={recovery}
                        index={index}
                      />
                      <span className="mode-proj-copy">
                        <span className="mode-proj-name">{recovery.projectName || t('shell.modeSelector.recoverableProjectName')}</span>
                        <span className="mode-proj-sub">{t('shell.modeSelector.unsavedProjectLabel', { date: formatRecentDate(recovery.modifiedAtMs, t) })}</span>
                      </span>
                    </button>
                    <Tooltip
                      text={t('shell.modeSelector.dismissRecoveryTooltip')}
                      placement="above"
                      className="mode-proj-dismiss-tooltip"
                    >
                      <button
                        type="button"
                        className="mode-proj-dismiss"
                        aria-label={t('shell.modeSelector.dismissRecoveryTooltip')}
                        onClick={() => onIgnoreSessionRecovery?.(recovery)}
                      >
                        <X className="mode-proj-dismiss-icon" strokeWidth={2} />
                      </button>
                    </Tooltip>
                  </div>
                ))}

                {visibleRecentProjects.map((project, index) => (
                  <Tooltip key={project.path} text={project.path} placement="above" multiline>
                    <button
                      type="button"
                      className="mode-proj-row"
                      onClick={() => onOpenRecent?.(project.path)}
                    >
                      <ProjectThumb
                        project={project}
                        index={visibleRecoveries.length + index}
                        loadedThumbnail={loadedThumbnails[project.path] ?? null}
                      />
                      <span className="mode-proj-copy">
                        <span className="mode-proj-name">{project.projectName || project.name}</span>
                        <span className="mode-proj-sub">{projectTypeLabel(project.projectType, t)}</span>
                      </span>
                      <span className="mode-proj-date">{formatRecentDate(project.updatedAt, t)}</span>
                    </button>
                  </Tooltip>
                ))}
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
