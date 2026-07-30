import { memo, useMemo, useState } from 'react';
import { Toggle } from '../common/Toggle';
import { Tooltip } from '../common/Tooltip';
import { findEntryById } from '../../store/projectModel';
import { useProjectContext } from '../../store/ProjectContext';
import { KEYS, read } from '../../store/persistentSettings';
import { isTtsAvailable, PIPER_DEFAULT_VOICE } from '../../store/xttsSettings';
import { useErrorDialog } from '../common/Dialog';
import { generateTextImage } from '../TextImageGenerator/generateTextImage';
import { CircleStop, Moon, Pause, Sparkles, Speech, Trash2 } from '../icons/LucideLocal';
import { useTranslation } from '../../i18n/I18nContext';
import {
  generatedTargetIdToSelectValue,
  NavigationTargetSelect,
} from './story/storyUtils';
import {
  getDefaultPackEntryDestination,
  getGeneratedNavigationTargetName,
  getGeneratedStoryNavigation,
  summarizeEffectiveStoryEnds,
} from '../../store/generatedNavigation';
import { isStoryNavigationTarget } from '../../store/navigationTargets';
import {
  canShowTextImageBatchAction,
  getTextImageBatchTargets,
} from './multiEditorBatchTargets';
import { TREE_COLOR_PALETTE } from '../tree/treeOperations';

const STORY_DEFAULTS = { autoplay: false, pause: true, wheel: false, home: true };
const MENU_DEFAULTS = { autoplay: false, pause: false, wheel: true };

function getSharedDuringControlKeys(t) {
  return [
    { key: 'pause', label: t('editorsStory.multiEditor.pauseButtonLabel'), desc: t('editorsStory.multiEditor.pauseButtonDesc') },
  ];
}

function getMenuControlKeys(t) {
  return [
    { key: 'wheel',    label: t('editorsStory.multiEditor.selectionWheelLabel'), desc: t('editorsStory.multiEditor.selectionWheelDesc') },
    { key: 'autoplay', label: t('editorsStory.multiEditor.autoplayLabel'),       desc: t('editorsStory.multiEditor.autoplayDesc') },
    { key: 'pause',    label: t('editorsStory.multiEditor.pauseMenuLabel'),      desc: t('editorsStory.multiEditor.pauseMenuDesc') },
  ];
}

function getDefaults(type) {
  return type === 'menu' ? MENU_DEFAULTS : STORY_DEFAULTS;
}

export const MultiEditor = memo(function MultiEditor({
  selectedIds,
  project,
  projectIndex,
  allMenus,
  allStories,
  onBulkUpdateItems,
  onBulkDeleteItems,
}) {
  const { t } = useTranslation();
  const ids = useMemo(() => [...selectedIds], [selectedIds]);

  const nodes = useMemo(
    () => ids.map((id) => {
      if (id === 'root') {
        return {
          id: 'root',
          type: 'root',
          name: project?.rootName || project?.packMetadata?.title || project?.projectName || t('editorsStory.multiEditor.rootMenuNameFallback'),
        };
      }
      if (id === 'end-node') {
        return {
          id: 'end-node',
          type: 'end-node',
          name: project?.endNodeName || t('editorsStory.multiEditor.endMessageNameFallback'),
        };
      }
      return findEntryById(project, id, projectIndex);
    }).filter(Boolean),
    [ids, project, projectIndex, t],
  );

  const {
    xttsSettings,
    onQueueXttsGenerate,
    onMediaCreated,
    savePath,
    workspaceDir,
  } = useProjectContext();
  const { showErrorDialog } = useErrorDialog();
  const SHARED_DURING_CONTROL_KEYS = getSharedDuringControlKeys(t);
  const MENU_CONTROL_KEYS = getMenuControlKeys(t);
  const [batchImageGenerating, setBatchImageGenerating] = useState(false);
  const [batchAudioGenerating, setBatchAudioGenerating] = useState(false);
  const [batchError, setBatchError] = useState('');

  const editableNodes = nodes.filter((n) => n.type === 'story' || n.type === 'menu');
  const textImageNodes = getTextImageBatchTargets(nodes);
  const canGenerateTextImages = canShowTextImageBatchAction(nodes);
  const titleAudioNodes = nodes.filter((n) => (
    n.type === 'story'
    || n.type === 'menu'
    || n.type === 'root'
    || n.type === 'end-node'
  ));
  const editableIds = editableNodes.map((n) => n.id);
  const storyCount = nodes.filter((n) => n.type === 'story').length;
  const zipCount = nodes.filter((n) => n.type === 'zip').length;
  const menuCount = nodes.filter((n) => n.type === 'menu').length;
  const rootCount = nodes.filter((n) => n.type === 'root').length;
  const endNodeCount = nodes.filter((n) => n.type === 'end-node').length;
  const onlyStories = storyCount === nodes.length && storyCount > 0;
  const onlyMenus = menuCount === nodes.length && menuCount > 0;
  const allSameType = onlyStories || onlyMenus;
  const hasEndNode = !!project?.nightModeAudio || !!project?.globalOptions?.nightMode || !!project?.globalOptions?.endNode;

  const bannerParts = [];
  if (storyCount > 0) bannerParts.push(`${storyCount} ${storyCount > 1 ? t('editorsStory.multiEditor.storiesLabelOther') : t('editorsStory.multiEditor.storiesLabelOne')}`);
  if (zipCount > 0) bannerParts.push(`${zipCount} ZIP`);
  if (menuCount > 0) bannerParts.push(`${menuCount} ${menuCount > 1 ? t('editorsStory.multiEditor.foldersLabelOther') : t('editorsStory.multiEditor.foldersLabelOne')}`);
  if (rootCount > 0) bannerParts.push(t('editorsStory.multiEditor.rootMenuBanner'));
  if (endNodeCount > 0) bannerParts.push(project?.endNodeName || t('editorsStory.multiEditor.endMessageNameFallback'));

  function handleControlChange(key, value) {
    onBulkUpdateItems(editableIds, (entry) => ({
      controlSettings: { ...entry.controlSettings, [key]: value },
    }));
  }

  const colorableIds = nodes
    .filter((n) => n.type === 'story' || n.type === 'menu' || n.type === 'zip')
    .map((n) => n.id);

  function getMixedColor() {
    const colors = nodes
      .filter((n) => n.type === 'story' || n.type === 'menu' || n.type === 'zip')
      .map((n) => n.treeColor ?? null);
    const unique = [...new Set(colors)];
    if (unique.length === 0) return null;
    if (unique.length === 1) return unique[0];
    return '__mixed__';
  }

  function handleSetColor(color) {
    if (colorableIds.length === 0) return;
    onBulkUpdateItems(colorableIds, () => ({ treeColor: color }));
  }

  function handleAutoBlackImageChange(value) {
    onBulkUpdateItems(
      editableNodes.filter((n) => n.type === 'menu').map((n) => n.id),
      () => ({ autoBlackImage: value }),
    );
  }

  function handleStoryAutoContinuationChange(value) {
    onBulkUpdateItems(editableIds, (entry) => ({
      controlSettings: {
        ...entry.controlSettings,
        autoplay: value,
        ok: !value,
      },
      ...(value ? {} : { returnAfterPlay: null }),
    }));
  }

  function handleNavChange(field, rawValue) {
    onBulkUpdateItems(editableIds, () => ({ [field]: rawValue || null }));
  }

  function getMixedSelectValue(field) {
    const vals = nodes.map((n) => n[field] ?? '');
    const unique = [...new Set(vals)];
    return unique.length === 1 ? unique[0] : '__mixed__';
  }

  function getParentMenu(entry) {
    const parentId = projectIndex?.parentMenuById?.get(entry.id) ?? null;
    return parentId ? projectIndex?.entryById?.get(parentId) ?? null : null;
  }

  function getHomeSelectValue(entry) {
    if (entry.returnOnHome) return entry.returnOnHome;
    const navigation = getGeneratedStoryNavigation(entry, getParentMenu(entry), project, project?.rootEntries ?? []);
    return generatedTargetIdToSelectValue(navigation.storyHome.effectiveTargetId);
  }

  function getEffectiveDestinationInfo(targetId) {
    if (!targetId) return null;
    if (targetId === 'root') {
      const destination = getDefaultPackEntryDestination(project);
      if (!destination) return { label: t('editorsStory.multiEditor.rootMenuNameFallback'), selectValue: null, kind: 'menu' };
      const generatedTargetId = destination.type === 'story'
        ? `story:${destination.id}`
        : destination.type === 'menu'
          ? destination.id
          : null;
      return {
        label: destination.name,
        selectValue: generatedTargetIdToSelectValue(generatedTargetId),
        kind: destination.type === 'story' ? 'story' : 'menu',
      };
    }
    return {
      label: getGeneratedNavigationTargetName(targetId, projectIndex),
      selectValue: generatedTargetIdToSelectValue(targetId),
      kind: isStoryNavigationTarget(targetId) ? 'story' : 'menu',
    };
  }

  function getMixedBooleanValue(values) {
    const unique = [...new Set(values)];
    return {
      isMixed: unique.length > 1,
      value: unique.length > 1 ? false : !!unique[0],
    };
  }

  const storyAfterPlaySummary = onlyStories
    ? summarizeEffectiveStoryEnds(
      editableNodes,
      getParentMenu,
      project,
      project?.rootEntries ?? [],
    )
    : null;
  const storyAfterPlayDestination = getEffectiveDestinationInfo(
    storyAfterPlaySummary?.commonFinalTargetId,
  );
  const storyReturnAfterPlayValue = onlyStories
    ? getMixedSelectValue('returnAfterPlay')
    : '__mixed__';
  const storyReturnEmptyLabel = storyAfterPlayDestination?.label
    || (storyAfterPlaySummary?.hasDifferentDestinations
      ? t('editorsStory.multiEditor.ownDestinationEachStory')
      : t('editorsStory.multiEditor.defaultDestinationEachStory'));
  const usesStorySpecificEndReturn = onlyStories && hasEndNode && !project?.nightModeReturn;

  const batchBusy = batchImageGenerating || batchAudioGenerating;
  const playbackControlKeys = onlyMenus ? MENU_CONTROL_KEYS : SHARED_DURING_CONTROL_KEYS;
  const playbackControlTitle = onlyMenus ? t('editorsStory.multiEditor.folderBehaviorTitle') : t('editorsStory.multiEditor.duringPlayTitle');
  const batchGenerationDescription = canGenerateTextImages
    ? t('editorsStory.multiEditor.generateDescWithImages')
    : t('editorsStory.multiEditor.generateDescAudioOnly');

  function getSelectedVoice() {
    if ((xttsSettings?.backend || 'piper') === 'piper') {
      // Piper a toujours une voix par défaut : jamais vide, pas de pré-sélection requise.
      return xttsSettings?.piperVoice || read(KEYS.PIPER_LAST_VOICE) || PIPER_DEFAULT_VOICE;
    }
    const favoriteVoices = Array.isArray(xttsSettings?.favoriteVoices) ? xttsSettings.favoriteVoices : [];
    return (
      read(KEYS.XTTS_LAST_VOICE) ||
      read(KEYS.XTTS_LAST_SPEAKER) ||
      favoriteVoices[0] ||
      ''
    );
  }

  function getNodeTitle(node) {
    return (node.name && node.name.trim()) ? node.name.trim() : t('editorsStory.multiEditor.untitled');
  }

  async function handleGenerateTextImagesFromNames() {
    if (batchBusy) return;
    setBatchError('');
    setBatchImageGenerating(true);
    const imageUpdates = new Map();
    const errors = [];

    try {
      for (const node of textImageNodes) {
        const text = getNodeTitle(node);
        const isMenu = node.type === 'menu';

        try {
          const imagePath = await generateTextImage(text, workspaceDir);
          if (imagePath) {
            onMediaCreated?.(imagePath);
            imageUpdates.set(
              node.id,
              isMenu
                ? { image: imagePath, autoGenerateImage: false }
                : { itemImage: imagePath, autoGenerateImage: false },
            );
          }
        } catch {
          errors.push(t('editorsStory.multiEditor.imageGenerationFailed', { text }));
        }
      }

      if (imageUpdates.size > 0) {
        onBulkUpdateItems(
          [...imageUpdates.keys()],
          (entry) => imageUpdates.get(entry.id) || {},
        );
      }

      if (errors.length > 0) {
        setBatchError(errors.join(' · '));
      }
    } finally {
      setBatchImageGenerating(false);
    }
  }

  async function handleGenerateTitleAudiosFromNames() {
    if (batchBusy) return;
    setBatchError('');

    const voice = getSelectedVoice();
    if (!voice) {
      const msg = t('editorsStory.multiEditor.xttsVoiceMissing');
      setBatchError(msg);
      showErrorDialog({
        title: t('editorsStory.multiEditor.audioGenerationDialogTitle'),
        message: msg,
        variant: 'warning',
      });
      return;
    }

    setBatchAudioGenerating(true);
    const errors = [];

    try {
      for (const node of titleAudioNodes) {
        const text = getNodeTitle(node);
        const isMenu = node.type === 'menu';
        const target = (() => {
          if (node.type === 'root') return { kind: 'root', field: 'rootAudio' };
          if (node.type === 'end-node') return { kind: 'root', field: 'nightModeAudio' };
          if (isMenu) return { kind: 'menu', entryId: node.id, field: 'audio' };
          return { kind: 'story', entryId: node.id, field: 'itemAudio' };
        })();
        try {
          await onQueueXttsGenerate?.({
            target,
            targetLabel: t('editorsStory.multiEditor.titleAudioTargetLabel', { text }),
            voiceLabel: voice,
            request: {
              text,
              language: xttsSettings?.language || 'fr',
              speaker: null,
              voice,
              savePath,
              filenameHint: `selection-${text}`,
            },
          });
        } catch {
          errors.push(t('editorsStory.multiEditor.xttsJobFailed', { text }));
        }
      }

      if (errors.length > 0) {
        setBatchError(errors.join(' · '));
      }
    } finally {
      setBatchAudioGenerating(false);
    }
  }

  if (nodes.length === 0) return null;

  return (
    <>
      {(canGenerateTextImages || titleAudioNodes.length > 0) && (
        <div className="card">
          <div className="card-title-row">
            <div className="card-title">{t('editorsStory.multiEditor.batchGenerationTitle')}</div>
          </div>
          <div className="editor-setting-row is-action-row">
            <div className="editor-setting-copy">
              <div className="editor-setting-title">{t('editorsStory.multiEditor.generateFromNamesTitle')}</div>
              <div className="editor-setting-desc">
                {batchGenerationDescription}
              </div>
            </div>
            <div className="editor-setting-actions">
              {canGenerateTextImages ? (
                <button
                  type="button"
                  className="batch-generate-btn"
                  onClick={handleGenerateTextImagesFromNames}
                  disabled={batchBusy}
                >
                  <Sparkles className="batch-generate-btn-icon" strokeWidth={2} absoluteStrokeWidth />
                  {batchImageGenerating ? t('editorsStory.multiEditor.imagesGeneratingLabel') : t('editorsStory.multiEditor.imageTitlesLabel')}
                </button>
              ) : null}
              {isTtsAvailable(xttsSettings) && titleAudioNodes.length > 0 && (
                <button
                  type="button"
                  className="batch-generate-btn"
                  onClick={handleGenerateTitleAudiosFromNames}
                  disabled={batchBusy}
                >
                  <Speech className="batch-generate-btn-icon" strokeWidth={2} absoluteStrokeWidth />
                  {batchAudioGenerating ? t('editorsStory.multiEditor.audiosGeneratingLabel') : t('editorsStory.multiEditor.audioTitlesLabel')}
                </button>
              )}
            </div>
          </div>
          {batchError && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--danger)' }}>
              {batchError}
            </div>
          )}
        </div>
      )}

      {editableNodes.length > 0 && (
        onlyStories ? (() => {
          const pauseState = getMixedBooleanValue(
            editableNodes.map((n) => n.controlSettings?.pause ?? STORY_DEFAULTS.pause),
          );
          const homeState = getMixedBooleanValue(
            editableNodes.map((n) => n.controlSettings?.home ?? STORY_DEFAULTS.home),
          );
          const homeSelectValues = editableNodes.map(getHomeSelectValue);
          const homeSelectUnique = [...new Set(homeSelectValues)];
          const homeSelectValue = homeSelectUnique.length === 1 ? homeSelectUnique[0] : '__mixed__';
          const showHomeDestination = homeState.isMixed || homeState.value;

          return (
            <div className="card during-play-card">
              <div className="card-title-row">
                <div className="card-title">{t('editorsStory.multiEditor.duringPlayTitle')}</div>
                <div className="card-copy card-copy--inline">
                  {t('editorsStory.multiEditor.duringPlayDesc')}
                </div>
              </div>

              <div className="during-play-stack">
                <div className="sequence-controls during-play-toggles">
                  <label className="sequence-control">
                    <Toggle
                      on={pauseState.value}
                      mixed={pauseState.isMixed}
                      onChange={(v) => handleControlChange('pause', v)}
                      ariaLabel={t('editorsStory.multiEditor.pauseButtonLabel')}
                    />
                    <Tooltip
                      text={pauseState.isMixed
                        ? t('editorsStory.multiEditor.pauseMixedTooltip')
                        : pauseState.value
                          ? t('editorsStory.multiEditor.pauseOnTooltip')
                          : t('editorsStory.multiEditor.pauseOffTooltip')}
                      placement="above"
                      style={{ minWidth: 0 }}
                    >
                      <span className="during-play-control-title">{t('editorsStory.multiEditor.pauseButtonLabel')}</span>
                    </Tooltip>
                  </label>
                </div>

                <div className="during-play-home">
                  <div className="sequence-control during-play-home-head">
                    <Toggle
                      on={homeState.value}
                      mixed={homeState.isMixed}
                      onChange={(v) => {
                        onBulkUpdateItems(editableIds, (entry) => ({
                          controlSettings: { ...entry.controlSettings, home: v },
                          ...(v ? {} : { returnOnHome: null, returnOnHomeNone: true }),
                        }));
                      }}
                      ariaLabel={t('editorsStory.multiEditor.homeButtonAria')}
                    />
                    <Tooltip
                      text={homeState.isMixed
                        ? t('editorsStory.multiEditor.homeMixedTooltip')
                        : homeState.value
                          ? t('editorsStory.multiEditor.homeOnTooltip')
                          : t('editorsStory.multiEditor.homeOffTooltip')}
                      placement="above"
                      style={{ minWidth: 0 }}
                    >
                      <span className="during-play-control-title">{t('editorsStory.multiEditor.homeButtonAria')}</span>
                    </Tooltip>
                    {showHomeDestination ? (
                      <>
                        <span className="during-play-destination-label">{t('editorsStory.multiEditor.destinationLabel')}</span>
                        <div className="during-play-home-select">
                          <NavigationTargetSelect
                            value={homeSelectValue}
                            onChange={(target) => {
                              if (target === '__mixed__') return;
                              onBulkUpdateItems(editableIds, () => ({
                                returnOnHome: target || null,
                                returnOnHomeNone: false,
                              }));
                            }}
                            allMenus={allMenus}
                            allStories={allStories.filter((s) => !ids.includes(s.id))}
                            currentStoryId={null}
                            emptyLabel={t('editorsStory.multiEditor.returnDirectToParent')}
                            includeStoryPlay={false}
                            size="compact"
                          />
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          );
        })() : (
      <div className="card">
        <div className="card-title-row">
          <div className="card-title">{playbackControlTitle}</div>
        </div>
        <div className="editor-setting-stack">
        {onlyMenus && (() => {
          const vals = editableNodes.map((n) => !!n.autoBlackImage);
          const unique = [...new Set(vals)];
          const isMixed = unique.length > 1;
          const value = isMixed ? false : unique[0];
          return (
            <div className="editor-setting-row is-toggle-row">
              <div className="editor-setting-copy">
                <div className="editor-setting-title">{t('editorsStory.multiEditor.noBlackImageTitle')}</div>
                <div className="editor-setting-desc">
                  {t('editorsStory.multiEditor.noBlackImageDesc')}
                </div>
              </div>
              <div className="editor-setting-control">
                <Toggle
                  on={value}
                  mixed={isMixed}
                  onChange={(v) => handleAutoBlackImageChange(v)}
                />
              </div>
            </div>
          );
        })()}
        {playbackControlKeys.map(({ key, label, desc }) => {
          const vals = editableNodes.map((n) => n.controlSettings?.[key] ?? getDefaults(n.type)[key] ?? false);
          const unique = [...new Set(vals)];
          const isMixed = unique.length > 1;
          const value = isMixed ? false : unique[0];

          return (
            <div key={key} className="editor-setting-row is-toggle-row">
              <div className="editor-setting-copy">
                <div className="editor-setting-title">{label}</div>
                <div className="editor-setting-desc">{desc}</div>
              </div>
              <div className="editor-setting-control">
                <Toggle
                  on={value}
                  mixed={isMixed}
                  onChange={(v) => handleControlChange(key, v)}
                />
              </div>
            </div>
          );
        })}
        {onlyStories && (
          <div className="editor-setting-row">
            <div className="editor-setting-copy">
              <div className="editor-setting-title">{t('editorsStory.multiEditor.homeButtonRowTitle')}</div>
              <div className="editor-setting-desc">
                {t('editorsStory.multiEditor.homeButtonRowDesc')}
              </div>
            </div>
            <div className="editor-setting-control">
              <NavigationTargetSelect
                value={getMixedSelectValue('returnOnHome')}
                onChange={(target) => {
                  if (target === '__mixed__') return;
                  handleNavChange('returnOnHome', target);
                }}
                allMenus={allMenus}
                allStories={allStories.filter((s) => !ids.includes(s.id))}
                currentStoryId={null}
                emptyLabel={t('editorsStory.multiEditor.returnDirectToParent')}
                includeStoryPlay={false}
              />
            </div>
          </div>
        )}
        </div>
      </div>
        )
      )}

      {allSameType && hasEndNode && (onlyStories || onlyMenus) && (
        onlyStories ? (
          <div className="card">
            <div className="card-title-row">
              <div className="card-title">{t('editorsStory.multiEditor.afterPlayTitle')}</div>
              <div className="card-copy card-copy--inline">
                {t('editorsStory.multiEditor.afterPlayDescStories')}
              </div>
            </div>

            <div className="after-play-route">
              <div className="after-play-route-head">
                <div className="after-play-route-title">{t('editorsStory.multiEditor.routeSummaryTitle')}</div>
              </div>
              <div className="after-play-route-list">
                <span className="after-play-route-chip">
                  <span className="after-play-route-icon"><CircleStop strokeWidth={2} absoluteStrokeWidth /></span>
                  <span>{t('editorsStory.multiEditor.storiesFinishedChip')}</span>
                </span>
                <span className="after-play-route-arrow" aria-hidden="true">→</span>
                <span className="after-play-route-chip">
                  <span className="after-play-route-icon"><Moon strokeWidth={2} absoluteStrokeWidth /></span>
                  <span>{project?.endNodeName || t('editorsStory.multiEditor.endMessageNameFallback')}{project?.globalOptions?.nightMode ? t('editorsStory.multiEditor.nightModeSuffix') : ''}</span>
                </span>
                <span className="after-play-route-arrow" aria-hidden="true">→</span>
                <span className="after-play-route-chip is-destination">
                  <span>
                    {usesStorySpecificEndReturn
                      ? (storyAfterPlayDestination?.label
                        || (storyAfterPlaySummary?.hasDifferentDestinations
                          ? t('editorsStory.multiEditor.specificDestinationLabel')
                          : t('editorsStory.multiEditor.defaultDestinationEachStory')))
                      : t('editorsStory.multiEditor.endMessageDestination')}
                  </span>
                </span>
              </div>
            </div>

            <div className="after-play-destination-row">
              <div className="after-play-destination-copy">
                <span className="field-label">
                  {usesStorySpecificEndReturn
                    ? t('editorsStory.multiEditor.destinationAfterEndMessage')
                    : t('editorsStory.multiEditor.endMessageCommon')}
                </span>
                <div className="after-play-muted">
                  {usesStorySpecificEndReturn
                    ? t('editorsStory.multiEditor.specificDestinationDesc')
                    : t('editorsStory.multiEditor.endMessageCommonDesc')}
                </div>
              </div>
              {usesStorySpecificEndReturn ? (
                <div className="after-play-destination-select">
                  <NavigationTargetSelect
                    value={storyReturnAfterPlayValue}
                    onChange={(target) => {
                      if (target === '__mixed__') return;
                      handleNavChange('returnAfterPlay', target);
                    }}
                    allMenus={allMenus}
                    allStories={allStories.filter((story) => !ids.includes(story.id))}
                    currentStoryId={null}
                    emptyLabel={storyReturnEmptyLabel}
                    resolvedDefaultValue={storyAfterPlayDestination?.selectValue}
                    resolvedDefaultLabel={storyAfterPlayDestination?.label}
                    resolvedDefaultKind={storyAfterPlayDestination?.kind}
                    hideDefaultWhenResolved
                  />
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="card-title-row">
              <div className="card-title">{t('editorsStory.multiEditor.afterPlayTitle')}</div>
            </div>
            <div className="editor-setting-row is-note-row">
              <Moon className="editor-setting-icon" />
              <div className="editor-setting-copy">
                <div className="editor-setting-title">{t('editorsStory.multiEditor.destinationManagedTitle')}</div>
                <div className="editor-setting-desc">
                  {t('editorsStory.multiEditor.destinationManagedDesc')}
                </div>
              </div>
            </div>
          </div>
        )
      )}

      {allSameType && !hasEndNode && (allMenus.length > 0 || onlyStories) && (
        onlyStories ? (() => {
            const {
              isMixed,
              autoContinuation: value,
              showDestination,
              hasDifferentDestinations,
            } = storyAfterPlaySummary;

            return (
              <div className="card">
                <div className="card-title-row">
                  <div className="card-title">{t('editorsStory.multiEditor.afterPlayTitle')}</div>
                  <div className="card-copy card-copy--inline">
                    {t('editorsStory.multiEditor.afterPlayDescStories')}
                  </div>
                </div>

                <div className="after-play-main-row">
                  <div className="after-play-end-row">
                    <span className="after-play-end-label">{t('editorsStory.multiEditor.atEndLabel')}</span>
                    <div className="story-end-mode" role="group" aria-label={t('editorsStory.multiEditor.endBehaviorAriaLabelPlural')}>
                      <button
                        type="button"
                        className={`story-end-mode-btn ${!isMixed && !value ? 'is-active' : ''}`}
                        aria-pressed={!isMixed && !value}
                        onClick={() => handleStoryAutoContinuationChange(false)}
                      >
                        {t('editorsStory.multiEditor.stayOnScreen')}
                      </button>
                      <button
                        type="button"
                        className={`story-end-mode-btn ${!isMixed && value ? 'is-active' : ''}`}
                        aria-pressed={!isMixed && value}
                        onClick={() => handleStoryAutoContinuationChange(true)}
                      >
                        {t('editorsStory.multiEditor.continueLabel')}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="after-play-route">
                  <div className="after-play-route-head">
                    <div className="after-play-route-title">{t('editorsStory.multiEditor.routeSummaryTitle')}</div>
                    {isMixed ? <div className="after-play-route-context">{t('editorsStory.multiEditor.differentBehaviors')}</div> : null}
                  </div>
                  <div className="after-play-route-list">
                    <span className="after-play-route-chip">
                      <span className="after-play-route-icon"><CircleStop strokeWidth={2} absoluteStrokeWidth /></span>
                      <span>{t('editorsStory.multiEditor.storiesFinishedChip')}</span>
                    </span>
                    <span className="after-play-route-arrow" aria-hidden="true">→</span>
                    {isMixed ? (
                      <span className="after-play-route-chip is-destination">
                        <span>{t('editorsStory.multiEditor.specificDestinationLabel')}</span>
                      </span>
                    ) : value ? (
                      <span className="after-play-route-chip is-destination">
                        <span>
                          {storyAfterPlayDestination?.label
                            || (hasDifferentDestinations
                              ? t('editorsStory.multiEditor.ownDestinationEachStory')
                              : t('editorsStory.multiEditor.defaultDestinationEachStory'))}
                        </span>
                      </span>
                    ) : (
                      <span className="after-play-route-chip">
                        <span className="after-play-route-icon"><Pause strokeWidth={2} absoluteStrokeWidth /></span>
                        <span>{t('editorsStory.multiEditor.waitingOnScreen')}</span>
                      </span>
                    )}
                  </div>
                </div>

                {showDestination && (
                  <div className="after-play-destination-row">
                    <div className="after-play-destination-copy">
                      <span className="field-label">{t('editorsStory.multiEditor.destinationAfterStory')}</span>
                      <div className="after-play-muted">
                        {t('editorsStory.multiEditor.screenOrMenuAtExit')}
                      </div>
                    </div>
                    <div className="after-play-destination-select">
                      <NavigationTargetSelect
                        value={storyReturnAfterPlayValue}
                        onChange={(target) => {
                          if (target === '__mixed__') return;
                          handleNavChange('returnAfterPlay', target);
                        }}
                        allMenus={allMenus}
                        allStories={allStories.filter((s) => !ids.includes(s.id))}
                        currentStoryId={null}
                        emptyLabel={storyReturnEmptyLabel}
                        resolvedDefaultValue={storyAfterPlayDestination?.selectValue}
                        resolvedDefaultLabel={storyAfterPlayDestination?.label}
                        resolvedDefaultKind={storyAfterPlayDestination?.kind}
                        hideDefaultWhenResolved
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })() : (
          <div className="card">
            <div className="card-title-row">
              <div className="card-title">{t('editorsStory.multiEditor.afterPlayTitle')}</div>
            </div>
            <div className="editor-setting-row">
              <div className="editor-setting-copy">
                <div className="editor-setting-title">{t('editorsStory.multiEditor.endOfStoryDestinationTitle')}</div>
                <div className="editor-setting-desc">
                  {t('editorsStory.multiEditor.endOfStoryDestinationDesc')}
                </div>
              </div>
              <div className="editor-setting-control">
                <NavigationTargetSelect
                  value={getMixedSelectValue('returnAfterPlay')}
                  onChange={(target) => {
                    if (target === '__mixed__') return;
                    handleNavChange('returnAfterPlay', target);
                  }}
                  allMenus={allMenus}
                  allStories={allStories.filter((s) => !ids.includes(s.id))}
                  currentStoryId={null}
                  emptyLabel={t('editorsStory.multiEditor.followParentFolder')}
                />
              </div>
            </div>
          </div>
        )
      )}

      {!allSameType && (
        <div className="multiselect-mixed-note">
          {t('editorsStory.multiEditor.mixedSelectionNote')}
        </div>
      )}

      {colorableIds.length > 0 && (() => {
        const currentColor = getMixedColor();
        return (
          <div className="card">
            <div className="editor-setting-row is-action-row">
              <div className="editor-setting-copy">
                <div className="editor-setting-title">{t('editorsStory.multiEditor.colorLabel')}</div>
                <div className="editor-setting-desc">
                  {currentColor === '__mixed__'
                    ? t('editorsStory.multiEditor.colorMixedDesc', { count: colorableIds.length })
                    : t('editorsStory.multiEditor.colorUniformDesc', { count: colorableIds.length })}
                </div>
              </div>
              <div className="multiselect-color-dots">
                {TREE_COLOR_PALETTE.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`ctx-color-dot${currentColor === color ? ' is-active' : ''}`}
                    style={{ backgroundColor: color }}
                    title={color}
                    onClick={() => handleSetColor(color)}
                  />
                ))}
                <button
                  type="button"
                  className={`ctx-color-clear${currentColor === null ? ' is-active' : ''}`}
                  title={currentColor === '__mixed__' ? t('editorsStory.multiEditor.colorMixedClearTitle') : t('editorsStory.multiEditor.colorNoneTitle')}
                  onClick={() => handleSetColor(null)}
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <div className="card card--danger card--danger-compact">
        <div className="card-danger-row">
          <button
            className="card-danger-trash"
            type="button"
            onClick={() => onBulkDeleteItems?.(ids)}
            aria-label={t('editorsStory.multiEditor.deleteSelectionAria')}
            title={t('editorsStory.multiEditor.deleteSelectionTitle')}
          >
            <Trash2 className="card-danger-icon" />
          </button>
          <span className="card-danger-title">{t('editorsStory.multiEditor.deleteSelectionTitle')}</span>
          <p className="card-danger-desc">
            {nodes.length === 1
              ? t('editorsStory.multiEditor.deleteSelectionDescOne', { count: nodes.length, parts: bannerParts.join(', ') })
              : t('editorsStory.multiEditor.deleteSelectionDescOther', { count: nodes.length, parts: bannerParts.join(', ') })}
          </p>
        </div>
      </div>
    </>
  );
});
