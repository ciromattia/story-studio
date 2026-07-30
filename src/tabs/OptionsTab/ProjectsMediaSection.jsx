import { useState } from 'react';
import { Button } from '../../components/common/Button';
import { Toggle } from '../../components/common/Toggle';
import { useTranslation } from '../../i18n/I18nContext';

export function ProjectsMediaSection({
  className,
  sectionRef,
  useWorkspaceForNewProjects,
  onUseWorkspaceForNewProjectsChange,
  displayedWorkspaceDir,
  onPickWorkspaceDir,
  copyFilesEnabled,
  onCopyFilesChange,
  onConsolidateProject,
  project,
}) {
  const { t } = useTranslation();
  const [consolidating, setConsolidating] = useState(false);
  const [consolidationResult, setConsolidationResult] = useState(null);

  async function handleConsolidate() {
    setConsolidating(true);
    setConsolidationResult(null);
    try {
      const result = await onConsolidateProject?.();
      if (result) setConsolidationResult(result);
    } finally {
      setConsolidating(false);
    }
  }

  return (
    <section id="projects-media" className={className} ref={sectionRef}>
      <div className="opts-card-title">{t('options.projectsMedia.title')}</div>
      <div className="opts-row">
        <div className="opts-row-info">
          <div className="opts-row-label">{t('options.projectsMedia.useWorkspaceLabel')}</div>
          <div className="opts-row-sub">
            {t('options.projectsMedia.useWorkspaceSub')}
          </div>
        </div>
        <Toggle on={!!useWorkspaceForNewProjects} onChange={onUseWorkspaceForNewProjectsChange} />
      </div>
      <div className="opts-row">
        <div className="opts-row-info">
          <div className="opts-row-label">{t('options.projectsMedia.workspaceDirLabel')}</div>
          <div className="opts-row-sub">
            {t('options.projectsMedia.workspaceDirSub')}
          </div>
          <div className="opts-path-value" title={displayedWorkspaceDir || ''}>
            {displayedWorkspaceDir || t('options.projectsMedia.workspaceResolving')}
          </div>
        </div>
        <Button onClick={onPickWorkspaceDir}>
          {t('options.projectsMedia.chooseButton')}
        </Button>
      </div>
      <div className="opts-row">
        <div className="opts-row-info">
          <div className="opts-row-label">{t('options.projectsMedia.copyFilesLabel')}</div>
          <div className="opts-row-sub">
            {t('options.projectsMedia.copyFilesSubPrefix')} <strong>Workspace/fichiers-importes/</strong>{t('options.projectsMedia.copyFilesSubSuffix')}
          </div>
        </div>
        <Toggle on={copyFilesEnabled} onChange={(v) => onCopyFilesChange?.(v)} />
      </div>
      <div className="opts-row">
        <div className="opts-row-info">
          <div className="opts-row-label">{t('options.projectsMedia.consolidateLabel')}</div>
          <div className="opts-row-sub">
            {t('options.projectsMedia.consolidateSub')}
          </div>
        </div>
        <Button onClick={handleConsolidate} disabled={consolidating || !project}>
          {consolidating ? t('options.projectsMedia.consolidatingButton') : t('options.projectsMedia.consolidateButton')}
        </Button>
      </div>
      {consolidationResult && (
        <div className={`info-box info-box--spaced ${consolidationResult.errors?.length ? 'warn' : ''}`}>
          {t(
            consolidationResult.copiedCount === 1
              ? 'options.projectsMedia.consolidatedResultOne'
              : 'options.projectsMedia.consolidatedResultOther',
            { count: consolidationResult.copiedCount },
          )}
          {consolidationResult.errors?.length
            ? t(
              consolidationResult.errors.length === 1
                ? 'options.projectsMedia.missingFilesOne'
                : 'options.projectsMedia.missingFilesOther',
              { count: consolidationResult.errors.length },
            )
            : '.'}
        </div>
      )}
    </section>
  );
}
