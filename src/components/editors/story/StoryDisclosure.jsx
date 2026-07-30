import { ChevronRight } from '../../icons/LucideLocal';
import { useTranslation } from '../../../i18n/I18nContext';

export function StoryDisclosure({ open, onToggle, label, children }) {
  const { t } = useTranslation();
  const resolvedLabel = label ?? t('editorsCore.storyDisclosure.defaultLabel');
  return (
    <div className={`story-disclosure ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        className="story-disclosure-trigger"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className="story-disclosure-chevron" aria-hidden="true">
          <ChevronRight strokeWidth={2} absoluteStrokeWidth />
        </span>
        <span className="story-disclosure-label">{resolvedLabel}</span>
      </button>
      {open ? <div className="story-disclosure-body">{children}</div> : null}
    </div>
  );
}
