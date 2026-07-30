import { useTranslation } from '../../i18n/I18nContext';

function useOptionGroups(t) {
  return [
    {
      label: t('options.nav.groupGeneral'),
      items: [
        { id: 'save', label: t('options.nav.save') },
        { id: 'interface', label: t('options.nav.interface') },
        { id: 'projects-media', label: t('options.nav.projectsMedia') },
      ],
    },
    {
      label: t('options.nav.groupAi'),
      items: [
        { id: 'xtts', label: t('options.nav.voice') },
        { id: 'comfyui', label: t('options.nav.aiImages') },
      ],
    },
    {
      label: t('options.nav.groupAdvanced'),
      items: [
        { id: 'advanced', label: t('options.nav.advanced') },
        { id: 'youtube', label: t('options.nav.youtube') },
        { id: 'diagnostic', label: t('options.nav.diagnostic') },
      ],
    },
  ];
}

export const OPTION_SECTION_IDS = ['save', 'interface', 'projects-media', 'xtts', 'comfyui', 'advanced', 'youtube', 'diagnostic'];

export function OptionsSectionNav({ activeSectionId, onNavigate }) {
  const { t } = useTranslation();
  const optionGroups = useOptionGroups(t);

  return (
    <nav className="opts-nav" aria-label={t('options.nav.ariaLabel')}>
      {optionGroups.map((group) => (
        <div className="opts-nav-group" key={group.label}>
          <div className="opts-nav-group-title">{group.label}</div>
          <div className="opts-nav-items">
            {group.items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`opts-nav-item${activeSectionId === item.id ? ' is-active' : ''}`}
                onClick={() => onNavigate(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}
