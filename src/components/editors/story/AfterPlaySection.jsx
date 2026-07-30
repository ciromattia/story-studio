import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../../i18n/I18nContext';
import { AudioField } from '../AudioField';
import { Toggle } from '../../common/Toggle';
import { Tooltip } from '../../common/Tooltip';
import { Button } from '../../common/Button';
import {
  encodeStoryNavigationTarget,
  decodeNavigationStoryId,
  isCurrentMenuNavigationTarget,
  isNextStoryNavigationTarget,
  isRootNavigationTarget,
  isStoryHomeStepNavigationTarget,
  isStoryNavigationTarget,
  isStoryPlayNavigationTarget,
} from '../../../store/navigationTargets';
import {
  getDefaultPackEntryDestination,
  getEffectiveEndBehavior,
} from '../../../store/generatedNavigation';
import {
  getControlDefs,
  SEQUENCE_CONTROL_DEFAULTS,
  NavigationTargetSelect,
  generatedTargetIdToSelectValue,
  getNavigationSelectHint,
  normalizeSequenceStep,
} from './storyUtils';
import { EndSequenceEditor } from './EndSequenceEditor';
import { StoryDisclosure } from './StoryDisclosure';
import { ChevronDown, ChevronUp, CircleStop, Pause, Trash2 } from '../../icons/LucideLocal';
import { IconArchive, IconFolderOpen, IconHouse, IconMoon, IconStop, IconStory } from '../../TreePanel/TreeIcons';
import { useErrorDialog } from '../../common/Dialog';
import { useProjectActions } from '../../../store/ProjectActionsContext';
import { useProjectContext } from '../../../store/ProjectContext';
import { pickAudio } from '../../../hooks/useFileDialog';
import { basename } from '../../../utils/fileUtils';
import {
  createLocalEndDraft,
  getLocalEndDraftApplicability,
  materializeLocalEndDraftFields,
  selectLocalEndDraftAudio,
} from '../../../store/localEndDraft';

function destinationHintLabel(label, t) {
  if (!label) return null;
  return String(label)
    .replace(new RegExp(`^${t('editorsStory.afterPlay.destinationHintReturnPrefix')}`), '')
    .replace(new RegExp(`^${t('editorsStory.afterPlay.destinationHintPlayPrefix')}`), '')
    .trim();
}

function RouteChip({ icon = null, children, destination = false }) {
  return (
    <span className={`after-play-route-chip${destination ? ' is-destination' : ''}`}>
      {icon ? <span className="after-play-route-icon">{icon}</span> : null}
      <span>{children}</span>
    </span>
  );
}

function RouteArrow() {
  return <span className="after-play-route-arrow" aria-hidden="true">→</span>;
}

function RouteTargetIcon({ type, nightMode = false }) {
  if (type === 'story') return <IconStory />;
  if (type === 'zip') return <IconArchive />;
  if (type === 'root') return <IconHouse />;
  if (type === 'end-node') return nightMode ? <IconMoon /> : <IconStop />;
  return <IconFolderOpen />;
}

function routeTypeFromTarget(target, project) {
  if (!target) return 'menu';
  if (isStoryNavigationTarget(target) || isNextStoryNavigationTarget(target)) return 'story';
  if (isRootNavigationTarget(target)) {
    return getDefaultPackEntryDestination(project)?.type || 'root';
  }
  return 'menu';
}

function routeDestinationFromTarget(targetId, project, allMenus, allStories, t) {
  if (!targetId) return null;
  if (targetId === 'root') {
    const defaultDest = getDefaultPackEntryDestination(project);
    if (!defaultDest) return { name: t('editorsStory.navSelect.rootMenuLabel'), type: 'menu' };
    return { name: defaultDest.name, type: defaultDest.type };
  }
  if (isStoryNavigationTarget(targetId)) {
    const storyId = decodeNavigationStoryId(targetId);
    const story = allStories.find((s) => s.id === storyId);
    const storyName = story?.name ?? t('editorsStory.navSelect.unnamedLabel');
    const name = isStoryPlayNavigationTarget(targetId)
      ? t('editorsStory.navSelect.directPlaybackPrefix', { name: storyName })
      : isStoryHomeStepNavigationTarget(targetId)
        ? t('editorsStory.navSelect.endReturnPrefix', { name: storyName })
        : storyName;
    return { name, type: 'story' };
  }
  const menu = allMenus.find((m) => m.id === targetId);
  return menu ? { name: menu.name, type: 'menu' } : null;
}

function resolvedReturnSelectValueFromTarget(targetId, project) {
  if (!targetId) return null;
  if (isRootNavigationTarget(targetId)) {
    const defaultDest = getDefaultPackEntryDestination(project);
    if (!defaultDest?.id) return null;
    if (defaultDest.type === 'story') return encodeStoryNavigationTarget(defaultDest.id);
    if (defaultDest.type === 'menu') return generatedTargetIdToSelectValue(defaultDest.id);
    return null;
  }
  return generatedTargetIdToSelectValue(targetId);
}

function getAutoNextContextText(autoNextResolution, t) {
  if (!autoNextResolution?.enabled) return null;
  if (autoNextResolution.applies) {
    return autoNextResolution.hasNextStory
      ? t('editorsStory.afterPlay.autoNextAppliesWithNext')
      : t('editorsStory.afterPlay.autoNextAppliesNoNext');
  }
  return null;
}

export function AfterPlaySection({
  node,
  parentMenu,
  allMenus,
  allStories,
  project,
  inheritedReturnLabel,
  onUpdate,
  afterPlayFocus = null,
  onAfterPlayFocusConsumed,
}) {
  const { t } = useTranslation();
  const { showConfirmDialog } = useErrorDialog();
  const { onAttachStoryEndToGlobal } = useProjectActions();
  const { onImportFile } = useProjectContext();
  const controlDefs = getControlDefs(t);
  const autoNextEnabled = !!project?.globalOptions?.autoNext;
  const hasEndNode = !!(!autoNextEnabled && (project?.nightModeAudio || project?.globalOptions?.nightMode || project?.globalOptions?.endNode));
  const rawHasPrompt = !!node?.afterPlaybackPromptAudio;
  const hasPrompt = rawHasPrompt && !autoNextEnabled;
  const afterPlaybackSequence = (node.afterPlaybackSequence ?? []).map((step, index) => normalizeSequenceStep(step, index, t));
  const afterPlaybackHomeStep = node.afterPlaybackHomeStep
    ? normalizeSequenceStep(node.afterPlaybackHomeStep, 0, t)
    : null;

  const rawHasSequence = afterPlaybackSequence.length > 0;
  const hasSequence = rawHasSequence && !autoNextEnabled;
  const effectiveEndBehavior = node?.type === 'story'
    ? getEffectiveEndBehavior(node, parentMenu, project, project?.rootEntries ?? [])
    : null;
  const storyNavigation = effectiveEndBehavior?.navigation ?? null;
  // Même audio ne suffit pas : une histoire peut réutiliser le son global tout
  // en envoyant vers une autre destination. Le moteur de navigation est la
  // source de vérité pour qualifier un message comme global importé.
  const endMessage = storyNavigation?.endMessage ?? { presentationKind: 'none' };
  const usesGlobalEndNodeAudio = endMessage.presentationKind === 'global';
  const hasGeneratedEndNode = usesGlobalEndNodeAudio;
  const usesStorySpecificEndReturn = hasGeneratedEndNode && !project?.nightModeReturn;
  const autoNextResolution = effectiveEndBehavior?.autoNext ?? null;
  const autoNextApplies = !!autoNextResolution?.applies;

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSequenceEditor, setShowSequenceEditor] = useState(false);
  const [showPromptField, setShowPromptField] = useState(false);
  const [localDraft, setLocalDraft] = useState(null);
  const afterPlayRef = useRef(null);
  const focusRequestId = afterPlayFocus?.requestId;

  useEffect(() => {
    if (!focusRequestId || afterPlayFocus?.storyId !== node.id) return;
    setShowAdvanced(true);
    setShowSequenceEditor(hasSequence);
    setShowPromptField(hasPrompt);
    requestAnimationFrame(() => {
      afterPlayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    onAfterPlayFocusConsumed?.();
  }, [afterPlayFocus?.storyId, focusRequestId, hasPrompt, hasSequence, node.id, onAfterPlayFocusConsumed]);

  const promptControls = node.afterPlaybackPromptControlSettings ?? {};
  const storyControls = node.controlSettings ?? {};
  const autoContinuationEnabled = !!effectiveEndBehavior?.autoContinuation;
  const routeFinalTargetId = effectiveEndBehavior?.finalTargetId ?? null;
  const routeFinalDestination = routeDestinationFromTarget(routeFinalTargetId, project, allMenus, allStories, t);
  const returnIsVirtualTarget = isRootNavigationTarget(node.returnAfterPlay)
    || isCurrentMenuNavigationTarget(node.returnAfterPlay);
  // On résout l'affichage vers la destination réelle dans deux cas : le retour par
  // défaut d'une histoire racine (elle atterrit sur sa propre vignette) et tout retour
  // « virtuel » (racine / dossier courant) qui n'a pas de ligne dédiée dans la liste.
  const resolvedReturnTargetId = ((!node.returnAfterPlay && !parentMenu) || returnIsVirtualTarget)
    ? (storyNavigation?.directReturn?.targetId ?? null)
    : null;
  const resolvedReturnDestination = resolvedReturnTargetId
    ? routeDestinationFromTarget(resolvedReturnTargetId, project, allMenus, allStories, t)
    : null;
  const resolvedReturnValue = resolvedReturnTargetId
    ? resolvedReturnSelectValueFromTarget(resolvedReturnTargetId, project)
    : null;
  const autoNextDestinationLabel = autoNextApplies
    ? (routeFinalDestination?.name || (autoNextResolution?.isLastStory ? (parentMenu?.name || t('editorsStory.afterPlay.thisFolder')) : t('editorsStory.afterPlay.nextStory')))
    : null;
  const returnEmptyResolvedLabel = autoNextApplies
    ? t('editorsStory.afterPlay.autoNextPrefix', { destination: autoNextDestinationLabel })
    : inheritedReturnLabel;
  const returnDestinationHint = getNavigationSelectHint({
    value: node.returnAfterPlay,
    emptyResolvedLabel: returnEmptyResolvedLabel,
    entry: node,
    parentMenu,
    project,
  });
  const promptHomeSelectValue = node.afterPlaybackPromptHomeNone
    ? '__none__'
    : (node.afterPlaybackPromptHomeTarget ?? '');
  const promptAudioLabel = usesGlobalEndNodeAudio
    ? t('editorsStory.afterPlay.promptAudioGlobalLabel')
    : hasEndNode
      ? t('editorsStory.afterPlay.promptAudioReplacementLabel')
      : t('editorsStory.afterPlay.promptAudioEndLabel');
  const promptAudioDescription = usesGlobalEndNodeAudio
    ? t('editorsStory.afterPlay.promptAudioGlobalDesc')
    : hasEndNode
      ? t('editorsStory.afterPlay.promptAudioReplacementDesc')
      : autoNextApplies
        ? t('editorsStory.afterPlay.promptAudioAutoNextDesc')
        : t('editorsStory.afterPlay.promptAudioDefaultDesc');
  const addPromptTooltip = hasEndNode
    ? t('editorsStory.afterPlay.addPromptTooltipReplacement')
    : t('editorsStory.afterPlay.addPromptTooltipDefault');
  const addSequenceTooltip = hasEndNode
    ? t('editorsStory.afterPlay.addSequenceTooltipReplacement')
    : t('editorsStory.afterPlay.addSequenceTooltipDefault');
  const advancedTitle = hasEndNode
    ? t('editorsStory.afterPlay.advancedTitleCustom')
    : t('editorsStory.afterPlay.advancedTitleDefault');
  const advancedDescription = hasEndNode
      ? t('editorsStory.afterPlay.advancedDescCustom')
      : t('editorsStory.afterPlay.advancedDescDefault');
  const localDraftApplicability = localDraft
    ? getLocalEndDraftApplicability({
      draft: localDraft,
      entry: node,
      parentMenu,
      project,
    })
    : null;

  useEffect(() => {
    setShowSequenceEditor(false);
    setShowPromptField(false);
    setLocalDraft(null);
    setShowAdvanced(false);
  }, [node?.id]);

  async function clearEndAfterPlayback() {
    if (rawHasPrompt || rawHasSequence) {
      const confirmed = await showConfirmDialog({
        title: t('editorsStory.afterPlay.confirmDeleteTitle'),
        message: t('editorsStory.afterPlay.confirmDeleteEndMessage'),
        okLabel: t('editorsStory.afterPlay.deleteButton'),
        okKind: 'danger',
      });
      if (!confirmed) return;
    }
    onUpdate({
      afterPlaybackPromptAudio: null,
      afterPlaybackPromptOkTarget: null,
      afterPlaybackPromptHomeTarget: null,
      afterPlaybackPromptHomeNone: false,
      afterPlaybackSequence: [],
      afterPlaybackHomeStep: null,
    });
    setShowSequenceEditor(false);
    setShowPromptField(false);
  }

  function startSequence() {
    const firstStep = normalizeSequenceStep({
      name: t('editorsStory.afterPlay.firstStepName'),
      controlSettings: { ...SEQUENCE_CONTROL_DEFAULTS, autoplay: true, ok: true },
    }, 0, t);
    onUpdate({
      afterPlaybackSequence: [firstStep],
      afterPlaybackPromptAudio: null,
      afterPlaybackPromptOkTarget: null,
      afterPlaybackPromptHomeTarget: null,
      afterPlaybackPromptHomeNone: false,
    });
    setShowSequenceEditor(true);
    setShowPromptField(false);
  }

  function startLocalDraft() {
    setLocalDraft(createLocalEndDraft(project));
  }

  async function pickLocalDraftAudio() {
    const source = await pickAudio();
    if (!source) return;
    setLocalDraft((draft) => selectLocalEndDraftAudio(draft, source));
  }

  async function applyLocalDraft() {
    if (!localDraft || !localDraftApplicability?.applicable) return;
    const fields = await materializeLocalEndDraftFields({
      draft: localDraft,
      entry: node,
      parentMenu,
      project,
      importFile: onImportFile,
    });
    if (!fields) return;
    onUpdate(fields);
    setLocalDraft(null);
  }

  function updateAutoContinuation(enabled) {
    onUpdate({
      controlSettings: {
        ...storyControls,
        autoplay: enabled,
        ok: !enabled,
      },
      ...(enabled ? {} : { returnAfterPlay: null }),
    });
  }

  const playbackEndMode = autoContinuationEnabled ? 'auto' : 'stay';
  const returnDestinationLabel = routeFinalDestination?.name
    || destinationHintLabel(returnDestinationHint, t)
    || inheritedReturnLabel
    || t('editorsStory.afterPlay.chosenDestinationFallback');
  const returnDestinationType = routeFinalDestination?.type || routeTypeFromTarget(node.returnAfterPlay, project);
  const nightModeActive = !!project?.globalOptions?.nightMode;
  const routeUsesEndStep = !!effectiveEndBehavior?.usesEndStep;
  const routeFinalLabel = routeFinalDestination?.name || returnDestinationLabel;
  const routeFinalType = routeFinalDestination?.type || returnDestinationType;
  const routeEndStepLabel = hasSequence
    ? t('editorsStory.afterPlay.endSequenceTitle')
    : hasPrompt && !usesGlobalEndNodeAudio
      ? t('editorsStory.afterPlay.advancedTitleCustom')
      : `${project?.endNodeName || t('editorsStory.multiEditor.endMessageNameFallback')}${nightModeActive ? t('editorsStory.afterPlay.nightModeSuffix') : ''}`;
  const routeContextText = autoNextApplies
    ? t('editorsStory.afterPlay.autoNextActiveContext')
    : usesStorySpecificEndReturn
      ? t('editorsStory.afterPlay.destinationSetContext')
      : null;
  const showEndModeControls = !hasGeneratedEndNode && !autoNextApplies;
  const showReturnDestinationRow = !autoNextApplies && (
    usesStorySpecificEndReturn
    || (!hasGeneratedEndNode && autoContinuationEnabled)
  );
  const autoNextContextText = getAutoNextContextText(autoNextResolution, t);
  const afterPlayNotes = [
    autoNextContextText,
    autoNextApplies
      ? t('editorsStory.afterPlay.autoNextOverrideNote')
      : null,
  ].filter(Boolean);
  const showAfterPlayIntro = afterPlayNotes.length > 0;
  const showAdvancedControls = !autoNextApplies;

  // ─── Contenu "Message de fin" ────────────────────────────────────────────────

  let endContent;
  if (endMessage.presentationKind === 'global') {
    endContent = localDraft ? (
      <div className="end-simple-settings">
        <div className="sequence-note sequence-note--spaced">{t('editorsStory.afterPlay.draftNotice')}</div>
        <div className="field-row end-local-audio-row">
          <div style={{ flex: 1 }}>
            <span className="field-label">{t('editorsStory.afterPlay.localEndAudioLabel')}</span>
            <div className="after-play-muted">{localDraft.audio ? basename(localDraft.audio) : t('editorsStory.afterPlay.noAudioChosen')}</div>
          </div>
          <Button size="sm" onClick={() => void pickLocalDraftAudio()}>{t('editorsStory.afterPlay.chooseAudioButton')}</Button>
          {localDraft.audio ? <Button size="sm" onClick={() => setLocalDraft((draft) => ({ ...draft, audio: null, audioSource: null }))}>{t('editorsStory.afterPlay.removeButton')}</Button> : null}
        </div>
        <div className="sequence-targets">
          <div className="field-row field-row--flush">
            <span className="field-label">{t('editorsStory.afterPlay.okButtonLabel')}</span>
            <NavigationTargetSelect
              value={localDraft.okTarget ?? ''}
              onChange={(okTarget) => setLocalDraft((draft) => ({ ...draft, okTarget: okTarget || null }))}
              allMenus={allMenus}
              allStories={allStories}
              currentStoryId={node.id}
              emptyLabel={t('editorsStory.endSequence.sameAsEndOfStory')}
            />
          </div>
          <div className="field-row field-row--flush">
            <span className="field-label">{t('editorsStory.afterPlay.homeButtonLabel')}</span>
            <NavigationTargetSelect
              value={localDraft.homeNone ? '__none__' : (localDraft.homeTarget ?? '')}
              onChange={(value) => setLocalDraft((draft) => value === '__none__'
                ? { ...draft, homeNone: true, homeTarget: null }
                : { ...draft, homeNone: false, homeTarget: value || null })}
              allMenus={allMenus}
              allStories={allStories}
              currentStoryId={node.id}
              includeNone
              includeStoryPlay={false}
              emptyLabel={t('editorsStory.afterPlay.sameAsOk')}
            />
          </div>
        </div>
        {!localDraftApplicability?.applicable ? (
          <div className="after-play-muted" role="status">
            {t('editorsStory.afterPlay.applicabilityWarning')}
          </div>
        ) : null}
        <div className="end-actions-end">
          <Button size="sm" onClick={() => setLocalDraft(null)}>{t('editorsStory.afterPlay.cancelButton')}</Button>
          <Button
            size="sm"
            onClick={applyLocalDraft}
            disabled={!localDraftApplicability?.applicable}
          >
            {t('editorsStory.afterPlay.applyLocalEndButton')}
          </Button>
        </div>
      </div>
    ) : (
      <div className="end-add-actions">
        <Tooltip text={addPromptTooltip} placement="above">
          <Button size="sm" onClick={startLocalDraft}>
            {t('editorsStory.afterPlay.addEndAudioButton')}
          </Button>
        </Tooltip>
        <Tooltip text={addSequenceTooltip} placement="above">
          <Button size="sm" onClick={startSequence}>
            {t('editorsStory.afterPlay.addEndSequenceButton')}
          </Button>
        </Tooltip>
      </div>
    );
  } else if (hasSequence) {
    endContent = (
      <>
        <div className="end-summary">
          <div>
            <div className="end-summary-title">
              <span>{t('editorsStory.afterPlay.endSequenceTitle')}</span>
              <span className="end-summary-badge">
                {afterPlaybackSequence.length === 1
                  ? t('editorsStory.afterPlay.stepsBadgeOne', { count: afterPlaybackSequence.length })
                  : t('editorsStory.afterPlay.stepsBadgeOther', { count: afterPlaybackSequence.length })}
              </span>
            </div>
            <div className="end-summary-copy">
              {t('editorsStory.afterPlay.endSequenceDesc')}
            </div>
          </div>
          <div className="end-summary-actions">
            {hasEndNode && (
              <Button size="sm" onClick={() => onAttachStoryEndToGlobal?.(node.id)}>
                {t('editorsStory.afterPlay.attachToPackMessageButton')}
              </Button>
            )}
            <Tooltip text={showSequenceEditor ? t('editorsStory.afterPlay.hideSequenceTooltip') : t('editorsStory.afterPlay.showSequenceTooltip')}>
              <button
                type="button"
                className="sequence-summary-icon-btn"
                onClick={() => setShowSequenceEditor((v) => !v)}
                aria-label={showSequenceEditor ? t('editorsStory.afterPlay.hideSequenceTooltip') : t('editorsStory.afterPlay.showSequenceTooltip')}
              >
                {showSequenceEditor
                  ? <ChevronUp className="sequence-icon" />
                  : <ChevronDown className="sequence-icon" />}
              </button>
            </Tooltip>
            <Tooltip text={t('editorsStory.afterPlay.removeSequenceTooltip')}>
              <button
                type="button"
                className="story-prompt-trash"
                onClick={clearEndAfterPlayback}
                aria-label={t('editorsStory.afterPlay.removeSequenceTooltip')}
              >
                <Trash2 className="card-danger-icon" />
              </button>
            </Tooltip>
          </div>
        </div>
        {showSequenceEditor && (
          <EndSequenceEditor
            node={node}
            parentMenuId={parentMenu?.id ?? null}
            steps={afterPlaybackSequence}
            homeStep={afterPlaybackHomeStep}
            allMenus={allMenus}
            allStories={allStories}
            onUpdate={onUpdate}
          />
        )}
      </>
    );
  } else if (hasPrompt || showPromptField) {
    endContent = (
      <>
        <div className="end-field-head">
          <span className="field-label">
            {t('editorsStory.afterPlay.endAudioMessageLabel')}
          </span>
          <Tooltip text={t('editorsStory.afterPlay.removeEndAudioTooltip')}>
            <button
              type="button"
              className="story-prompt-trash"
              onClick={clearEndAfterPlayback}
              aria-label={t('editorsStory.afterPlay.removeEndAudioTooltip')}
            >
              <Trash2 className="card-danger-icon" />
            </button>
          </Tooltip>
        </div>
        {hasEndNode && !usesGlobalEndNodeAudio && (
          <div className="sequence-note sequence-note--spaced">
            {t('editorsStory.afterPlay.replacesPackMessageNotePrefix')} <strong>{t('editorsStory.afterPlay.replacesPackMessageNoteStrong')}</strong> {t('editorsStory.afterPlay.replacesPackMessageNoteSuffix')}
          </div>
        )}
        <AudioField
          label={promptAudioLabel}
          description={promptAudioDescription}
          file={node.afterPlaybackPromptAudio}
          required={false}
          ttsFilenameHint={`fin-${node.name || t('editorsStory.endSequence.storyFallbackName')}`}
          xttsTarget={{ kind: 'story', entryId: node.id, field: 'afterPlaybackPromptAudio' }}
          onPick={(f) => onUpdate({ afterPlaybackPromptAudio: f })}
          onClear={() => onUpdate({
            afterPlaybackPromptAudio: null,
            afterPlaybackPromptOkTarget: null,
            afterPlaybackPromptHomeTarget: null,
            afterPlaybackPromptHomeNone: false,
          })}
        />
        {hasPrompt && (
          <div className="end-simple-settings">
            {hasEndNode && (
              <div className="sequence-note sequence-note--spaced">
                {t('editorsStory.afterPlay.localEndOverridesPackNote')}
              </div>
            )}
            <div className="sequence-controls">
              {controlDefs.map(({ key, label, def }) => (
                <label key={key} className="sequence-control">
                  <span>{label}</span>
                  <Toggle
                    on={promptControls?.[key] ?? def}
                    onChange={(v) => onUpdate({
                      afterPlaybackPromptControlSettings: {
                        autoplay: promptControls.autoplay ?? true,
                        ok: promptControls.ok ?? true,
                        home: promptControls.home ?? true,
                        pause: promptControls.pause ?? false,
                        wheel: promptControls.wheel ?? false,
                        [key]: v,
                      },
                    })}
                  />
                </label>
              ))}
            </div>
            <div className="sequence-targets">
              <div className="field-row field-row--flush">
                <div style={{ flex: 1 }}>
                  <span className="field-label">{t('editorsStory.afterPlay.okButtonLabel')}</span>
                </div>
                <NavigationTargetSelect
                  value={node.afterPlaybackPromptOkTarget ?? ''}
                  onChange={(value) => onUpdate({ afterPlaybackPromptOkTarget: value })}
                  allMenus={allMenus}
                  allStories={allStories}
                  currentStoryId={node.id}
                  emptyLabel={t('editorsStory.endSequence.sameAsEndOfStory')}
                />
              </div>
              <div className="field-row field-row--flush">
                <div style={{ flex: 1 }}>
                  <span className="field-label">{t('editorsStory.afterPlay.homeButtonLabel')}</span>
                </div>
                <NavigationTargetSelect
                  value={promptHomeSelectValue}
                  onChange={(value) => {
                    if (value === '__none__') {
                      onUpdate({ afterPlaybackPromptHomeNone: true, afterPlaybackPromptHomeTarget: null });
                    } else {
                      onUpdate({ afterPlaybackPromptHomeNone: false, afterPlaybackPromptHomeTarget: value });
                    }
                  }}
                  allMenus={allMenus}
                  allStories={allStories}
                  currentStoryId={node.id}
                  includeNone
                  emptyLabel={t('editorsStory.afterPlay.sameAsOk')}
                  includeStoryPlay={false}
                />
              </div>
            </div>
            <div className="end-actions-end">
              {hasEndNode && (
                <Button size="sm" onClick={() => onAttachStoryEndToGlobal?.(node.id)}>
                  {t('editorsStory.afterPlay.attachToPackMessageButton')}
                </Button>
              )}
              <Button size="sm" onClick={startSequence}>
                {t('editorsStory.afterPlay.convertToSequenceButton')}
              </Button>
            </div>
          </div>
        )}
      </>
    );
  } else {
    endContent = (
      <div className="end-add-actions">
        <Tooltip text={addPromptTooltip} placement="above">
          <Button size="sm" onClick={() => setShowPromptField(true)}>
            {t('editorsStory.afterPlay.addEndAudioButton')}
          </Button>
        </Tooltip>
        <Tooltip text={addSequenceTooltip} placement="above">
          <Button size="sm" onClick={startSequence}>
            {t('editorsStory.afterPlay.addEndSequenceButton')}
          </Button>
        </Tooltip>
      </div>
    );
  }

  // ─── Rendu principal ────────────────────────────────────────────────────────

  return (
    <div className="card">
      <div className="card-title-row">
        <div className="card-title">{t('editorsStory.afterPlay.sectionTitle')}</div>
        <div className="card-copy card-copy--inline">
          {t('editorsStory.afterPlay.sectionDesc')}
        </div>
      </div>

      {(showAfterPlayIntro || showEndModeControls) ? (
        <div className="after-play-main-row">
          {showAfterPlayIntro ? (
            <div className="after-play-intro">
              {afterPlayNotes.map((note) => (
                <div key={note} className="after-play-context-note">{note}</div>
              ))}
            </div>
          ) : null}

          {showEndModeControls && (
            <div className="after-play-end-row">
              <span className="after-play-end-label">{t('editorsStory.multiEditor.atEndLabel')}</span>
              <div className="story-end-mode" role="group" aria-label={t('editorsStory.afterPlay.endBehaviorAriaLabel')}>
                <button
                  type="button"
                  className={`story-end-mode-btn ${playbackEndMode === 'stay' ? 'is-active' : ''}`}
                  aria-pressed={playbackEndMode === 'stay'}
                  onClick={() => updateAutoContinuation(false)}
                >
                  {t('editorsStory.afterPlay.stayOnScreen')}
                </button>
                <button
                  type="button"
                  className={`story-end-mode-btn ${playbackEndMode === 'auto' ? 'is-active' : ''}`}
                  aria-pressed={playbackEndMode === 'auto'}
                  onClick={() => updateAutoContinuation(true)}
                >
                  {t('editorsStory.afterPlay.continueLabel')}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {showReturnDestinationRow && (
        <div className="after-play-destination-row">
          <div className="after-play-destination-copy">
            <span className="field-label">
              {usesStorySpecificEndReturn
                ? t('editorsStory.afterPlay.destinationAfterEndMessage')
                : autoNextApplies
                  ? t('editorsStory.afterPlay.autoNextException')
                  : t('editorsStory.afterPlay.destinationAfterStory')}
            </span>
            <div className="after-play-muted">
              {usesStorySpecificEndReturn
                ? t('editorsStory.afterPlay.specificDestinationUsedNote')
                : autoNextApplies
                ? t('editorsStory.afterPlay.autoNextFollowNote')
                : t('editorsStory.afterPlay.autoExitScreenNote')}
            </div>
          </div>
          <div className="after-play-destination-select">
            <NavigationTargetSelect
              value={node.returnAfterPlay ?? ''}
              onChange={(target) => onUpdate({ returnAfterPlay: target || null })}
              allMenus={allMenus}
              allStories={allStories}
              currentStoryId={node.id}
              allowCurrentStory={!parentMenu}
              emptyLabel={autoNextApplies ? t('editorsStory.afterPlay.followsAutoNext') : (inheritedReturnLabel || resolvedReturnDestination?.name || t('editorsStory.afterPlay.chooseDestination'))}
              resolvedDefaultValue={resolvedReturnValue}
              resolvedDefaultLabel={resolvedReturnDestination?.name}
              resolvedDefaultKind={resolvedReturnDestination?.type}
              hideDefaultWhenResolved
            />
          </div>
        </div>
      )}

      <div className="after-play-route" ref={afterPlayRef}>
        <div className="after-play-route-head">
          <div className="after-play-route-title">{t('editorsStory.afterPlay.routeSummaryTitle')}</div>
          {routeContextText ? (
            <div className="after-play-route-context">{routeContextText}</div>
          ) : null}
        </div>
        <div className="after-play-route-list">
          <RouteChip icon={<CircleStop />}>{t('editorsStory.afterPlay.storyFinishedChip')}</RouteChip>
          <RouteArrow />
          {routeUsesEndStep ? (
            <>
              <RouteChip icon={<RouteTargetIcon type="end-node" nightMode={nightModeActive} />}>
                {routeEndStepLabel}
              </RouteChip>
              {routeFinalLabel ? (
                <>
                  <RouteArrow />
                  <RouteChip icon={<RouteTargetIcon type={routeFinalType} />} destination>{routeFinalLabel}</RouteChip>
                </>
              ) : null}
            </>
          ) : autoContinuationEnabled ? (
            <RouteChip icon={<RouteTargetIcon type={returnDestinationType} />} destination>{returnDestinationLabel}</RouteChip>
          ) : (
            <RouteChip icon={<Pause />}>{t('editorsStory.multiEditor.waitingOnScreen')}</RouteChip>
          )}
        </div>
      </div>

      {showAdvancedControls ? (
        <StoryDisclosure
          open={showAdvanced}
          onToggle={() => setShowAdvanced((v) => !v)}
        >
          <div className="story-advanced-row">
            <div className="story-advanced-copy">
              <div className="story-advanced-title">{advancedTitle}</div>
              <div className="story-advanced-desc">{advancedDescription}</div>
            </div>
          </div>

          {showAdvanced && (
            <div className="story-advanced-controls">
              <div>
                {endContent}
              </div>
            </div>
          )}
        </StoryDisclosure>
      ) : null}
    </div>
  );
}
