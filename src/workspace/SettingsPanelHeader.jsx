import { useTranslation } from '../i18n/I18nContext';
import { X } from '../components/icons/LucideLocal';
import {
  IconArchive,
  IconArrowRight,
  IconFolderOpen,
  IconHouse,
  IconMoon,
  IconStop,
  IconStory,
} from '../components/TreePanel/TreeIcons';
import { END_NODE_ID, getTypeLabels } from '../components/diagram/flowDiagramLayout';

function NodeTypeIcon({ type, icon }) {
  if (type === 'root') return <IconHouse />;
  if (type === 'menu') return <IconFolderOpen />;
  if (type === 'story') return <IconStory />;
  if (type === 'zip') return <IconArchive />;
  if (type === 'ref') return <IconArrowRight />;
  if (type === END_NODE_ID || type === 'end-node') return icon === 'moon' ? <IconMoon /> : <IconStop />;
  return <IconHouse />;
}

function getHeaderData({ node, selectedId, selectedIds, project, t }) {
  const typeLabels = getTypeLabels(t);
  if (selectedIds?.size > 1) {
    return {
      type: 'multi',
      title: t('workspace.settingsPanelHeader.multiSelectionTitle', { count: selectedIds.size }),
      badge: t('workspace.settingsPanelHeader.multiSelectionBadge'),
      icon: null,
    };
  }
  if (selectedId === END_NODE_ID) {
    return {
      type: END_NODE_ID,
      title: project?.endNodeName || t('workspace.settingsPanelHeader.endNodeTitle'),
      badge: typeLabels[END_NODE_ID],
      icon: project?.globalOptions?.nightMode ? 'moon' : 'stop',
    };
  }
  if (!node) {
    return {
      type: 'root',
      title: t('workspace.settingsPanelHeader.defaultTitle'),
      badge: t('workspace.settingsPanelHeader.noSelectionBadge'),
      icon: null,
    };
  }
  const type = node.type === 'root' ? 'root' : node.type;
  const rootTitle = project?.projectType === 'simple'
    ? (project?.projectName || t('workspace.settingsPanelHeader.simpleStoryFallback'))
    : (project?.rootName || project?.projectName || t('workspace.settingsPanelHeader.rootMenuFallback'));
  // Badge du root : dépend du type de projet — « Histoire simple » en `simple`
  // (le header est visible dans l'éditeur simple même sans diagramme),
  // « Pack » sinon. « Histoire » seul serait ambigu avec TYPE_LABELS.story.
  const rootBadge = project?.projectType === 'simple'
    ? t('workspace.settingsPanelHeader.simpleBadge')
    : t('workspace.settingsPanelHeader.packBadge');
  return {
    type,
    title: type === 'root' ? rootTitle : (node.name || typeLabels[type] || t('workspace.settingsPanelHeader.defaultTitle')),
    badge: type === 'root' ? rootBadge : (typeLabels[type] || t('workspace.settingsPanelHeader.defaultTitle')),
    icon: node.icon ?? null,
  };
}

export function SettingsPanelHeader({
  node,
  selectedId,
  selectedIds,
  project,
  onClose = null,
  dragHandleProps = {},
}) {
  const { t } = useTranslation();
  const data = getHeaderData({ node, selectedId, selectedIds, project, t });

  return (
    <div className="settings-panel-header" {...dragHandleProps}>
      <div className="settings-panel-header-icon" aria-hidden="true">
        {data.type === 'multi' ? <IconArrowRight /> : <NodeTypeIcon type={data.type} icon={data.icon} />}
      </div>
      <div className="settings-panel-header-main">
        <div className="settings-panel-header-title" title={data.title}>{data.title}</div>
        <div className="settings-panel-header-badge" title={data.badge}>{data.badge}</div>
      </div>
      {onClose ? (
        <button
          type="button"
          className="settings-panel-header-close"
          aria-label={t('workspace.settingsPanelHeader.closeAriaLabel')}
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
