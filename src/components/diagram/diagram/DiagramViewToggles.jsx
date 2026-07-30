import { Focus, IterationCcw, SquareStack } from '../../icons/LucideLocal';
import { useTranslation } from '../../../i18n/I18nContext';

export function DiagramViewToggles({
  showReturns,
  onShowReturnsChange,
  focusMode,
  onFocusModeToggle,
  canFocusBranch,
  hasExpandedStoryGroups,
  onCollapseAllStories,
}) {
  const { t } = useTranslation();
  const focusBranchLabel = canFocusBranch
    ? t('diagram.viewToggles.focusBranchEnabled')
    : t('diagram.viewToggles.focusBranchDisabled');
  return (
    <div className="fd-complete-viewbar" aria-label={t('diagram.viewToggles.ariaLabel')}>
      <button
        type="button"
        className={`fd-diagram-option ${showReturns ? 'is-active' : ''}`}
        aria-label={t('diagram.viewToggles.showReturns')}
        aria-pressed={showReturns}
        title={t('diagram.viewToggles.showReturns')}
        onClick={() => onShowReturnsChange(!showReturns)}
      >
        <IterationCcw />
        <span className="fd-ctrl-label">{t('diagram.viewToggles.returns')}</span>
      </button>
      <button
        type="button"
        className={`fd-diagram-option ${focusMode ? 'is-active' : ''}`}
        aria-label={focusBranchLabel}
        aria-pressed={focusMode}
        title={focusBranchLabel}
        disabled={!canFocusBranch}
        onClick={onFocusModeToggle}
      >
        <Focus />
        <span className="fd-ctrl-label fd-ctrl-label--full">{t('diagram.viewToggles.focusBranchFull')}</span>
        <span className="fd-ctrl-label fd-ctrl-label--short">{t('diagram.viewToggles.focusBranchShort')}</span>
      </button>
      {hasExpandedStoryGroups ? (
        <button
          type="button"
          className="fd-diagram-option"
          aria-label={t('diagram.viewToggles.collapseAllAriaLabel')}
          title={t('diagram.viewToggles.collapseAllTitle')}
          onClick={onCollapseAllStories}
        >
          <SquareStack />
          <span className="fd-ctrl-label fd-ctrl-label--full">{t('diagram.viewToggles.collapseAllFull')}</span>
          <span className="fd-ctrl-label fd-ctrl-label--short">{t('diagram.viewToggles.collapseAllShort')}</span>
        </button>
      ) : null}
    </div>
  );
}
