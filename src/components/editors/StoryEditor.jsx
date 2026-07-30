import { memo, useState } from 'react';
import { AudioField } from './AudioField';
import { ImageField } from './ImageField';
import { TextImagePromptModal } from '../TextImageGenerator/TextImagePromptModal';
import { useProjectContext } from '../../store/ProjectContext';
import { basename } from '../../utils/fileUtils';
import {
  NAV_TARGET_NEXT_STORY,
  decodeNavigationMenuId,
  isCurrentMenuNavigationTarget,
  isNextStoryNavigationTarget,
  isRootNavigationTarget,
  isStoryHomeStepNavigationTarget,
  isStoryNavigationTarget,
  isStoryPlayNavigationTarget,
  normalizeNavigationTarget,
  decodeNavigationStoryId,
} from '../../store/navigationTargets';
import { AfterPlaySection } from './story/AfterPlaySection';
import { DuringPlaySection } from './story/DuringPlaySection';
import { NAV_ROOT_LABEL } from './story/storyUtils';
import { Trash2 } from '../icons/LucideLocal';
import {
  createStorySelectionAudioUpdate,
  isExplicitSilentStoryTitle,
  isStorySelectionAudioRequired,
} from '../../store/storyTitleStage';
import { useTranslation } from '../../i18n/I18nContext';
import './EditorPanel.css';

// ─── Navigation helpers (used for computed props only) ────────────────────────

function resolveNavigationTargetId(target, currentMenuId = null) {
  const normalized = normalizeNavigationTarget(target);
  if (!normalized) return null;
  if (isRootNavigationTarget(normalized)) return 'root';
  if (isCurrentMenuNavigationTarget(normalized)) return currentMenuId ?? null;
  if (isNextStoryNavigationTarget(normalized)) return NAV_TARGET_NEXT_STORY;
  if (isStoryNavigationTarget(normalized)) return normalized;
  return decodeNavigationMenuId(normalized);
}

function targetNameById(t, allMenus, allStories, targetId, fallback = t('editorsCore.storyEditor.targetNameMissing')) {
  if (targetId === 'root') return NAV_ROOT_LABEL;
  if (targetId === NAV_TARGET_NEXT_STORY) return t('editorsCore.storyEditor.targetNameNextStory');
  if (!targetId) return fallback;
  if (isStoryNavigationTarget(targetId)) {
    const storyId = decodeNavigationStoryId(targetId);
    const storyName = allStories.find((s) => s.id === storyId)?.name || fallback;
    return isStoryHomeStepNavigationTarget(targetId)
      ? t('editorsCore.storyEditor.targetNameHome', { name: storyName })
      : isStoryPlayNavigationTarget(targetId)
      ? t('editorsCore.storyEditor.targetNamePlay', { name: storyName })
      : t('editorsCore.storyEditor.targetNameTitle', { name: storyName });
  }
  return allMenus.find((menu) => menu.id === targetId)?.name || fallback;
}

function buildInheritedReturnLabel(t, parentMenu, allMenus, allStories, autoNextEffective) {
  if (!parentMenu) return null;
  if (autoNextEffective) return t('editorsCore.storyEditor.inheritedReturnAutoNext');
  const inheritedTargetId = parentMenu.returnAfterPlay ?? null;
  if (!inheritedTargetId || isCurrentMenuNavigationTarget(inheritedTargetId)) {
    return t('editorsCore.storyEditor.inheritedReturnTo', {
      name: parentMenu.name || t('editorsCore.storyEditor.inheritedReturnDefaultMenu'),
    });
  }
  if (isRootNavigationTarget(inheritedTargetId)) {
    return t('editorsCore.storyEditor.inheritedReturnTo', { name: NAV_ROOT_LABEL });
  }
  const name = targetNameById(t, allMenus, allStories, resolveNavigationTargetId(inheritedTargetId, parentMenu.id));
  return t('editorsCore.storyEditor.inheritedReturnTo', { name });
}

// ─── Component ────────────────────────────────────────────────────────────────

export const StoryEditor = memo(function StoryEditor({
  node,
  project = null,
  allMenus = [],
  allStories = [],
  parentMenu = null,
  onUpdate,
  onDelete,
  afterPlayFocus = null,
  onAfterPlayFocusConsumed,
}) {
  const { t } = useTranslation();
  const { onExtractAudioEmbeddedImage } = useProjectContext();

  const autoNext = project?.globalOptions?.autoNext ?? false;
  const autoNextEffective = autoNext && node?.type === 'story';
  const parentChildren = parentMenu?.children ?? [];
  const nodeIndexInParent = parentChildren.findIndex((c) => c.id === node?.id);
  const isLastInMenu = autoNextEffective && (
    nodeIndexInParent < 0 ||
    !parentChildren.slice(nodeIndexInParent + 1).some((c) => c.type === 'story')
  );

  const inheritedReturnLabel = buildInheritedReturnLabel(
    t, parentMenu, allMenus, allStories, autoNextEffective && !isLastInMenu,
  );
  const explicitSilentSelection = isExplicitSilentStoryTitle(node);
  const selectionAudioRequired = isStorySelectionAudioRequired(node);
  const [textImgModal, setTextImgModal] = useState(null);

  function handleRegenerate() {
    setTextImgModal({
      defaultText: node.name || '',
      onConfirm: (path) => { onUpdate({ itemImage: path, autoGenerateImage: false }); },
    });
  }

  async function handleStoryAudioPick(path) {
    const autoName = basename(path)
      .replace(/\.(mp3|ogg|wav|m4a|webm)$/i, '')
      .replace(/[-_]/g, ' ')
      .trim();
    const embeddedImage = await onExtractAudioEmbeddedImage?.(path);
    onUpdate({
      audio: path,
      ...((!node.name || node.name === 'Nouvelle histoire') ? { name: autoName } : {}),
      ...(!node.itemImage && embeddedImage ? { itemImage: embeddedImage } : {}),
    });
  }

  return (
    <>
      {/* Card : L'histoire (nom intégré) */}
      <div className="card">
        <div className="card-title-row">
          <div className="card-title">{t('editorsCore.storyEditor.title')}</div>
          <div className="card-copy card-copy--inline">{t('editorsCore.storyEditor.description')}</div>
        </div>

        <div className="field-row" style={{ marginBottom: 0 }}>
          <span className="field-label">{t('editorsCore.storyEditor.nameLabel')}</span>
          <input
            className="field-input"
            value={node.name || ''}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder={t('editorsCore.storyEditor.namePlaceholder')}
          />
        </div>
        <div className="card-sep" />

        <div className="media-split">
          <div className="media-split-left">
            <div className="media-col-header">
              {t('editorsCore.storyEditor.imageColHeader')}
              <span className="media-col-subtitle">{t('editorsCore.storyEditor.imageColSubtitle')}</span>
            </div>
            <ImageField
              fieldId={`${node.id}:itemImage`}
              file={node.itemImage}
              extraActions={[
                {
                  key: 'generate-text',
                  label: t('editorsCore.storyEditor.generateTitleImageLabel'),
                  icon: '✦',
                  onClick: handleRegenerate,
                  title: t('editorsCore.storyEditor.generateTitleImageTitle'),
                },
              ]}
              onPick={(f) => onUpdate({ itemImage: f, autoGenerateImage: false })}
              onClear={() => onUpdate({ itemImage: null, autoGenerateImage: false })}
            />
          </div>
          <div className="media-split-divider" />
          <div className="media-split-right">
            <div className="media-col-header">
              {t('editorsCore.storyEditor.soundColHeader')}
              <span className="media-col-subtitle">{t('editorsCore.storyEditor.soundColSubtitle')}</span>
            </div>
            <AudioField
              label={t('editorsCore.storyEditor.selectionAudioLabel')}
              description={explicitSilentSelection
                ? t('editorsCore.storyEditor.selectionAudioDescSilent')
                : t('editorsCore.storyEditor.selectionAudioDescDefault')}
              file={node.itemAudio}
              required={selectionAudioRequired}
              emptyBadge={explicitSilentSelection ? t('editorsCore.storyEditor.selectionAudioSilentBadge') : null}
              ttsTextSuggestion={node.name || ''}
              ttsFilenameHint={`selection-${node.name || 'histoire'}`}
              xttsTarget={{ kind: 'story', entryId: node.id, field: 'itemAudio' }}
              onPick={(f) => onUpdate(createStorySelectionAudioUpdate(f))}
              onClear={() => onUpdate(createStorySelectionAudioUpdate(null))}
            />
            <AudioField
              label={t('editorsCore.storyEditor.fullStoryAudioLabel')}
              description={t('editorsCore.storyEditor.fullStoryAudioDesc')}
              file={node.audio}
              ttsFilenameHint={`histoire-complete-${node.name || 'histoire'}`}
              xttsTarget={{ kind: 'story', entryId: node.id, field: 'audio' }}
              onPick={handleStoryAudioPick}
              onClear={() => onUpdate({ audio: null })}
            />
          </div>
        </div>

      </div>

      {/* Card : Pendant l'histoire */}
      <DuringPlaySection
        node={node}
        project={project}
        allMenus={allMenus}
        allStories={allStories}
        parentMenu={parentMenu}
        onUpdate={onUpdate}
      />

      {/* Card : A la fin de l'histoire */}
      <AfterPlaySection
        node={node}
        parentMenu={parentMenu}
        allMenus={allMenus}
        allStories={allStories}
        project={project}
        inheritedReturnLabel={inheritedReturnLabel}
        onUpdate={onUpdate}
        afterPlayFocus={afterPlayFocus}
        onAfterPlayFocusConsumed={onAfterPlayFocusConsumed}
      />

      <div className="card card--danger card--danger-compact">
        <div className="card-danger-row">
          <button
            className="card-danger-trash"
            type="button"
            onClick={onDelete}
            aria-label={t('editorsCore.storyEditor.deleteAriaLabel')}
            title={t('editorsCore.storyEditor.deleteTitle')}
          >
            <Trash2 className="card-danger-icon" />
          </button>
          <span className="card-danger-title">{t('editorsCore.storyEditor.deleteTitle')}</span>
          <p className="card-danger-desc">
            {t('editorsCore.storyEditor.deleteDesc')}
          </p>
        </div>
      </div>

      {textImgModal && (
        <TextImagePromptModal
          defaultText={textImgModal.defaultText}
          onConfirm={(path) => { textImgModal.onConfirm(path); setTextImgModal(null); }}
          onCancel={() => setTextImgModal(null)}
        />
      )}
    </>
  );
});
