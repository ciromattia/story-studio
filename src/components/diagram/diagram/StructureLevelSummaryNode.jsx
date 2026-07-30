import { SquareStack } from '../../icons/LucideLocal';
import { useTranslation } from '../../../i18n/I18nContext';

export function StructureLevelSummaryNode({ entry, onExpand }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className="fd-complete-node fd-structure-summary-node"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onExpand?.(entry.id);
      }}
      title={t('diagram.structure.unfoldTitle', { count: entry.storyCount })}
    >
      <span className="fd-structure-summary-visual" aria-hidden="true">
        <SquareStack className="fd-structure-summary-icon" />
        <span className="fd-structure-summary-meta">
          <span className="fd-structure-summary-count">{entry.storyCount}</span>
          <span className="fd-structure-summary-label">{t('diagram.structure.storiesLabel')}</span>
        </span>
      </span>
      <span className="fd-structure-summary-action">{t('diagram.structure.unfoldAction')}</span>
    </button>
  );
}
