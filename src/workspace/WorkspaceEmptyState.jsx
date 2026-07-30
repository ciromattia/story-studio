import { useTranslation } from '../i18n/I18nContext';

export function WorkspaceEmptyState({ onShowTree, onShowSettings, onShowDiagram }) {
  const { t } = useTranslation();
  return (
    <div className="workspace-empty-state">
      <p>{t('workspace.emptyState.title')}</p>
      <span>{t('workspace.emptyState.subtitle')}</span>
      <div className="workspace-empty-state-actions">
        <button type="button" onClick={onShowTree}>{t('workspace.emptyState.showTree')}</button>
        <button type="button" onClick={onShowSettings}>{t('workspace.emptyState.showSettings')}</button>
        <button type="button" onClick={onShowDiagram}>{t('workspace.emptyState.showDiagram')}</button>
      </div>
    </div>
  );
}
