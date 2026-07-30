import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from '../../../i18n/I18nContext';
import {
  NAV_TARGET_NEXT_STORY,
  decodeNavigationMenuId,
  encodeMenuNavigationTarget,
  encodeStoryHomeStepNavigationTarget,
  encodeStoryNavigationTarget,
  encodeStoryPlayNavigationTarget,
  isCurrentMenuNavigationTarget,
  isNextStoryNavigationTarget,
  isRootNavigationTarget,
  isStoryNavigationTarget,
  normalizeNavigationTarget,
} from '../../../store/navigationTargets';
import { CircleX, FolderOpen, Link2, Music, Play } from '../../icons/LucideLocal';

export const NAV_ROOT_LABEL = 'Menu racine';

export function generatedTargetIdToSelectValue(targetId) {
  if (!targetId || isRootNavigationTarget(targetId)) return '';
  if (isStoryNavigationTarget(targetId) || isNextStoryNavigationTarget(targetId)) return targetId;
  return encodeMenuNavigationTarget(targetId);
}

const NAV_ICON_BY_KIND = {
  default: Link2,
  none: CircleX,
  root: FolderOpen,
  menu: FolderOpen,
  story: Music,
  story_play: Play,
  story_home_step: Music,
};

function iconForKind(kind) {
  return NAV_ICON_BY_KIND[kind] ?? null;
}

function buildNavigationTargetOptions({
  t,
  value,
  allMenus = [],
  allStories = [],
  currentStoryId = null,
  allowCurrentStory = false,
  includeNone = false,
  noneLabel,
  emptyLabel,
  includeDefault = true,
  includeNextStory = true,
  includeStoryPlay = true,
}) {
  const unnamedLabel = t('editorsStory.navSelect.unnamedLabel');
  const options = [];
  if (value === '__mixed__') {
    options.push({
      value: '__mixed__',
      label: t('editorsStory.navSelect.mixedValuesLabel'),
      kind: 'default',
      disabled: true,
    });
  }
  if (includeDefault) {
    options.push({ value: '', label: emptyLabel ?? t('editorsStory.navSelect.chooseDestinationLabel'), kind: 'default' });
  }
  if (includeNone) options.push({ value: '__none__', label: noneLabel ?? t('editorsStory.navSelect.noTransitionLabel'), kind: 'none' });
  if (includeNextStory) {
    options.push({ value: NAV_TARGET_NEXT_STORY, label: t('editorsStory.navSelect.nextStoryLabel'), kind: 'story' });
  }
  for (const menu of allMenus) {
    options.push({
      value: encodeMenuNavigationTarget(menu.id),
      label: menu.name || unnamedLabel,
      kind: 'menu',
    });
  }
  const selectableStories = allStories.filter((s) => allowCurrentStory || s.id !== currentStoryId);
  for (const story of selectableStories) {
    options.push({
      value: encodeStoryNavigationTarget(story.id),
      label: story.name || unnamedLabel,
      kind: 'story',
    });
  }
  if (includeStoryPlay) {
    for (const story of selectableStories) {
      options.push({
        value: encodeStoryPlayNavigationTarget(story.id),
        label: t('editorsStory.navSelect.directPlaybackPrefix', { name: story.name || unnamedLabel }),
        kind: 'story_play',
      });
    }
  }
  for (const story of allStories.filter((s) => s.id !== currentStoryId && s.hasAfterPlaybackHomeStep)) {
    options.push({
      value: encodeStoryHomeStepNavigationTarget(story.id),
      label: t('editorsStory.navSelect.endReturnPrefix', { name: story.name || unnamedLabel }),
      kind: 'story_home_step',
    });
  }
  return options;
}

export function getControlDefs(t) {
  return [
    { key: 'autoplay', label: t('editorsStory.duringPlay.autoplayLabel'), def: true },
    { key: 'ok',       label: t('editorsStory.duringPlay.okLabel'),       def: true },
    { key: 'home',     label: t('editorsStory.duringPlay.homeLabel'),     def: true },
    { key: 'pause',    label: t('editorsStory.duringPlay.pauseSelectionLabel'), def: false },
    { key: 'wheel',    label: t('editorsStory.duringPlay.wheelLabel'),    def: false },
  ];
}

export const SEQUENCE_CONTROL_DEFAULTS = {
  autoplay: true,
  ok: false,
  home: true,
  pause: false,
  wheel: false,
};

export function normalizeSequenceStep(step = {}, index = 0, t = null) {
  const controls = step.controlSettings ?? {};
  return {
    id: step.id || crypto.randomUUID(),
    name: step.name || (t ? t('editorsStory.endSequence.stepNamePlaceholder', { n: index + 1 }) : `Étape ${index + 1}`),
    audio: step.audio ?? null,
    image: step.image ?? null,
    controlSettings: { ...SEQUENCE_CONTROL_DEFAULTS, ...controls },
    okTarget: normalizeNavigationTarget(step.okTarget),
    okChoiceTargets: Array.isArray(step.okChoiceTargets)
      ? step.okChoiceTargets.map(normalizeNavigationTarget).filter(Boolean)
      : [],
    homeTarget: normalizeNavigationTarget(step.homeTarget),
    homeFollowsOk: !!step.homeFollowsOk,
    homeNone: !!step.homeNone,
  };
}

export function resolveNavigationTargetId(target, currentMenuId = null) {
  const normalized = normalizeNavigationTarget(target);
  if (!normalized) return null;
  if (isRootNavigationTarget(normalized)) return 'root';
  if (isCurrentMenuNavigationTarget(normalized)) return currentMenuId ?? null;
  if (isNextStoryNavigationTarget(normalized)) return NAV_TARGET_NEXT_STORY;
  if (isStoryNavigationTarget(normalized)) return normalized;
  return decodeNavigationMenuId(normalized);
}

// Calcule le texte de destination effective pour les résumés de parcours.
// - Pour un value vide ou "root" → renvoie le défaut résolu (ex: "Quelle histoire...").
// - Pour "next_story" → renvoie soit le nom de l'histoire suivante si entry est fourni, soit la mention contextuelle.
// - Pour un menu/story explicite → null (pas de hint nécessaire).
//
// L'appelant passe `emptyResolvedLabel` qui décrit ce que "vide" signifie dans son contexte
// (héritage parent vs premier élément du pack vs etc).
export function getNavigationSelectHint({
  t,
  value,
  emptyResolvedLabel = null,
  entry = null,
  parentMenu = null,
  project = null,
}) {
  const unnamedLabel = t('editorsStory.navSelect.unnamedLabel');
  const normalized = normalizeNavigationTarget(value);
  if (!normalized) return emptyResolvedLabel;
  if (isRootNavigationTarget(normalized)) {
    const def = project?.rootEntries?.[0];
    if (!def) return t('editorsStory.navSelect.noEntriesInPack');
    return t('editorsStory.navSelect.firstPackEntry', { name: def.name || unnamedLabel });
  }
  if (isNextStoryNavigationTarget(normalized)) {
    if (!entry) return t('editorsStory.navSelect.nextStoryFromSource');
    const siblings = parentMenu ? (parentMenu.children ?? []) : (project?.rootEntries ?? []);
    const idx = siblings.findIndex((s) => s.id === entry.id);
    const next = idx >= 0 ? siblings.slice(idx + 1).find((s) => s.type === 'story') : null;
    if (next) return next.name || unnamedLabel;
    // Fallback Rust : si pas d'histoire suivante, retour vers le parent
    return parentMenu ? t('editorsStory.navSelect.parentSuffix', { name: parentMenu.name || unnamedLabel }) : t('editorsStory.navSelect.rootMenuLabel');
  }
  // Explicite — la valeur affichée dans le select est déjà la destination
  return null;
}

export function NavigationTargetSelect({
  value,
  onChange,
  allMenus,
  allStories,
  currentStoryId,
  allowCurrentStory = false,
  includeNone = false,
  noneLabel = null,
  emptyLabel = null,
  includeDefault = true,
  resolvedDefaultValue = null,
  resolvedDefaultLabel = null,
  resolvedDefaultKind = 'default',
  hideDefaultWhenResolved = false,
  style,
  includeNextStory = true,
  includeStoryPlay = true,
  size = 'default',
}) {
  const { t } = useTranslation();
  const effectiveEmptyLabel = emptyLabel ?? t('editorsStory.navSelect.chooseDestinationLabel');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef(null);
  const listboxId = useId();
  const rawSelectedValue = value ?? '';
  const normalizedResolvedValue = resolvedDefaultValue
    ? normalizeNavigationTarget(resolvedDefaultValue)
    : null;
  const baseOptions = useMemo(
    () => buildNavigationTargetOptions({
      t,
      value: rawSelectedValue,
      allMenus,
      allStories,
      currentStoryId,
      allowCurrentStory,
      includeNone,
      noneLabel,
      emptyLabel: effectiveEmptyLabel,
      includeDefault,
      includeNextStory,
      includeStoryPlay,
    }),
    [
      t,
      rawSelectedValue,
      allMenus,
      allStories,
      currentStoryId,
      allowCurrentStory,
      includeNone,
      noneLabel,
      effectiveEmptyLabel,
      includeDefault,
      includeNextStory,
      includeStoryPlay,
    ],
  );
  // Un « vrai » choix correspond à une ligne concrète de la liste (menu, histoire,
  // « Histoire suivante »…). Les cibles virtuelles (racine, dossier courant) et la
  // valeur vide n'ont pas de ligne dédiée : on les résout vers leur destination réelle
  // pour ne jamais afficher un libellé abstrait dans le déclencheur.
  const rawMatchesConcreteOption = !!rawSelectedValue
    && baseOptions.some((option) => option.value === rawSelectedValue && option.value !== '');
  const useResolvedValue = !!(normalizedResolvedValue && !rawMatchesConcreteOption);
  const selectedValue = useResolvedValue ? normalizedResolvedValue : rawSelectedValue;
  const hideResolvedDefault = !!(includeDefault && hideDefaultWhenResolved && useResolvedValue);
  const options = useMemo(
    () => (hideResolvedDefault
      ? baseOptions.filter((option) => option.value !== '')
      : baseOptions),
    [baseOptions, hideResolvedDefault],
  );
  const resolvedSelectedOption = useResolvedValue
    ? {
      value: normalizedResolvedValue,
      label: resolvedDefaultLabel || effectiveEmptyLabel,
      kind: resolvedDefaultKind || 'default',
    }
    : null;
  const selectableOptions = useMemo(
    () => options.filter((option) => !option.disabled),
    [options],
  );
  const selectedOption = options.find((option) => option.value === selectedValue)
    ?? resolvedSelectedOption
    ?? options.find((option) => option.value === '')
    ?? options[0];
  const SelectedIcon = iconForKind(selectedOption?.kind);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const selectedIndex = selectableOptions.findIndex((option) => option.value === selectedValue);
    setActiveIndex(Math.max(0, selectedIndex));
  }, [open, selectableOptions, selectedValue]);

  useEffect(() => {
    if (!open) return;
    const activeOption = rootRef.current?.querySelector(`[data-option-index="${activeIndex}"]`);
    activeOption?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  const selectOption = (option) => {
    if (!option || option.disabled) return;
    onChange(option.value || null);
    setOpen(false);
  };

  const moveActive = (delta) => {
    if (selectableOptions.length === 0) return;
    setActiveIndex((current) => (current + delta + selectableOptions.length) % selectableOptions.length);
  };

  const handleKeyDown = (event) => {
    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveActive(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveActive(-1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(Math.max(0, selectableOptions.length - 1));
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectOption(selectableOptions[activeIndex]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
    }
  };

  const activeOptionId = open && selectableOptions[activeIndex]
    ? `${listboxId}-option-${activeIndex}`
    : undefined;

  return (
    <div className="navigation-target-select" style={style}>
      <div
        ref={rootRef}
        className={`navigation-listbox ${open ? 'is-open' : ''} ${size === 'compact' ? 'is-compact' : ''}`}
      >
        <button
          type="button"
          className="navigation-listbox-trigger"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={activeOptionId}
          onClick={() => setOpen((current) => !current)}
          onKeyDown={handleKeyDown}
        >
          {SelectedIcon ? <SelectedIcon className="navigation-listbox-icon" strokeWidth={2} /> : null}
          <span className="navigation-listbox-label">{selectedOption?.label ?? effectiveEmptyLabel}</span>
          <span className="navigation-listbox-chevron" aria-hidden="true">⌄</span>
        </button>
        {open ? (
          <div id={listboxId} className="navigation-listbox-popover" role="listbox" tabIndex={-1}>
            {options.map((option) => {
              const optionIndex = selectableOptions.findIndex((candidate) => candidate.value === option.value);
              const isActive = optionIndex === activeIndex;
              const isSelected = option.value === selectedValue;
              const Icon = iconForKind(option.kind);
              return (
                <div key={`${option.value || 'empty'}:${option.label}`}>
                  <button
                    type="button"
                    role="option"
                    id={optionIndex >= 0 ? `${listboxId}-option-${optionIndex}` : undefined}
                    data-option-index={optionIndex >= 0 ? optionIndex : undefined}
                    aria-selected={isSelected}
                    disabled={option.disabled}
                    className={`navigation-listbox-option ${isActive ? 'is-active' : ''} ${isSelected ? 'is-selected' : ''}`}
                    onMouseEnter={() => {
                      if (optionIndex >= 0) setActiveIndex(optionIndex);
                    }}
                    onClick={() => selectOption(option)}
                  >
                    {Icon ? <Icon className="navigation-listbox-icon" strokeWidth={2} /> : null}
                    <span className="navigation-listbox-label">{option.label}</span>
                  </button>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
