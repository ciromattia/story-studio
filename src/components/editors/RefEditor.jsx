import { memo } from 'react';
import { Trash2 } from '../icons/LucideLocal';
import { NavigationTargetSelect } from './story/storyUtils';
import { refTargetEntryId } from '../../store/navigationTargets';
import { useTranslation } from '../../i18n/I18nContext';
import './EditorPanel.css';

// Éditeur d'un nœud `ref` (« → nœud existant ») : change la cible, la présentation
// (↪ continuer / ↩ revenir) ou supprime le lien. La cible n'est jamais affectée.
export const RefEditor = memo(function RefEditor({ node, allMenus = [], allStories = [], onUpdate, onDelete }) {
  const { t } = useTranslation();
  const targetId = refTargetEntryId(node.target);
  const targetEntry = allStories.find((s) => s.id === targetId)
    ?? allMenus.find((m) => m.id === targetId)
    ?? null;
  const targetName = targetEntry?.name || (node.target
    ? t('editorsCore.refEditor.targetMissing')
    : t('editorsCore.refEditor.targetNone'));

  return (
    <>
      <div className="card">
        <div className="card-title-row">
          <div className="card-title">{t('editorsCore.refEditor.title')}</div>
          <div className="card-copy card-copy--inline">
            {t('editorsCore.refEditor.description')}
          </div>
        </div>

        <div className="field-row">
          <span className="field-label" style={{ flex: 1 }}>{t('editorsCore.refEditor.targetLabel')}</span>
          <NavigationTargetSelect
            value={node.target ?? ''}
            onChange={(target) => onUpdate({ target: target || null })}
            allMenus={allMenus}
            allStories={allStories}
            currentStoryId={null}
            includeNextStory={false}
            emptyLabel={t('editorsCore.refEditor.targetEmptyOption')}
            style={{ minWidth: 240, maxWidth: 360 }}
          />
        </div>

        <div className="field-row">
          <span className="field-label" style={{ flex: 1 }}>{t('editorsCore.refEditor.presentationLabel')}</span>
          <select
            className="field-input"
            value={node.refKind === 'return' ? 'return' : 'continue'}
            onChange={(e) => onUpdate({ refKind: e.target.value })}
            style={{ maxWidth: 360 }}
          >
            <option value="continue">{t('editorsCore.refEditor.continueOption')}</option>
            <option value="return">{t('editorsCore.refEditor.returnOption')}</option>
          </select>
        </div>
      </div>

      <div className="card card--danger card--danger-compact">
        <div className="card-danger-row">
          <button
            className="card-danger-trash"
            type="button"
            onClick={onDelete}
            aria-label={t('editorsCore.refEditor.deleteAriaLabel')}
            title={t('editorsCore.refEditor.deleteTitle')}
          >
            <Trash2 className="card-danger-icon" />
          </button>
          <span className="card-danger-title">{t('editorsCore.refEditor.deleteTitle')}</span>
          <p className="card-danger-desc">
            {t('editorsCore.refEditor.deleteDesc', { targetName })}
          </p>
        </div>
      </div>
    </>
  );
});
