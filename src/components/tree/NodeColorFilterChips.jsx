import './NodeColorFilterChips.css';
import { useTranslation } from '../../i18n/I18nContext';

export function NodeColorFilterChips({ colors, selectedColors, onToggle }) {
  const { t } = useTranslation();
  if (!colors?.length) return null;

  return (
    <div className="node-color-filter-row" role="group" aria-label={t('tree.colorFilter.groupAriaLabel')}>
      {colors.map(({ color, count, label }) => (
        <button
          key={color}
          type="button"
          className={`node-color-filter-chip${selectedColors.has(color) ? ' is-active' : ''}`}
          style={{ '--node-filter-color': color }}
          aria-label={t(count > 1 ? 'tree.colorFilter.chipAriaLabelOther' : 'tree.colorFilter.chipAriaLabelOne', { label, count })}
          aria-pressed={selectedColors.has(color)}
          title={t(count > 1 ? 'tree.colorFilter.chipTitleOther' : 'tree.colorFilter.chipTitleOne', { label, count })}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onToggle(color)}
        />
      ))}
    </div>
  );
}
