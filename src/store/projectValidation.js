// Validation projet cote frontend.
//
// Contrat partage avec Rust : src-tauri/src/domain/validation.rs#validate_project_for_generation.
// Les regles "structurelles" doivent rester miroirs ; le test de parite
// scripts/validationParity.test.mjs + le module #[cfg(test)] de validation.rs ancrent
// 4 cas canoniques (pack valide, story sans audio, pack vide, simple sans audio racine).
//
// Regles partagees JS <-> Rust (toute divergence est un bug a corriger):
//   - Audio racine obligatoire (rootAudio).
//   - Image racine obligatoire, vignette obligatoire sur pack sauf si `sameImage`.
//   - Story : audio obligatoire, accessibilite disque verifiee.
//   - Story : itemImage obligatoire, itemAudio obligatoire sauf titre explicite silencieux.
//   - Zip : zipPath obligatoire et fichier accessible.
//   - Pack non-vide : au moins une histoire jouable.
//   - Cibles de navigation cassees (returnAfterPlay, returnOnHome, refs, sequences).
//
// Regles UX uniquement (cote JS, signalees a l'utilisateur en temps reel) :
//   - "duplicateId" : doublons d'ID dans rootEntries. Rust ne controle pas
//     (la generation cree des ids assainis distincts).
//   - "rootReservedId" : ID 'root' reserve. Rust applique implicitement.
//   - emptyMenu / emptyPack : warnings JS, Rust refuse via "aucune histoire".
//
// Si une regle est ajoutee : l'implementer des deux cotes, etendre
// validation-projects.json + le module tests::parity_* de Rust.
//
// Taxonomie UI actuelle :
//   - aucune issue bloquante/warning -> "Pack prêt" ;
//   - status "error" ou "warning" -> "À corriger".
// Les deux statuts empechent aujourd'hui la generation cote React
// (voir App.jsx/canGenerate et getGenerateErrors). La distinction interne
// reste utile pour diagnostiquer les erreurs structurelles, mais elle n'est
// pas exposee comme deux categories dans l'UI parent.

import { buildProjectIndex, getPlayableDescendantCount, visitProjectEntries } from './projectModel.js';
import { decodeNavigationMenuId, decodeNavigationStoryId, isCurrentMenuNavigationTarget, isNextStoryNavigationTarget, isRootNavigationTarget, isStoryHomeStepNavigationTarget, isStoryNavigationTarget, normalizeNavigationTarget } from './navigationTargets.js';
import { createValidationMessages, brokenField, emptyTarget, frenchFallbackT, missingField, missingTarget } from './validationMessages.js';
import { isStorySelectionAudioRequired } from './storyTitleStage.js';

function hasPath(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isBrokenPath(value, fileAudit = {}) {
  return hasPath(value) && fileAudit[value] === false;
}

function labelOrFallback(value, fallback) {
  return (value || '').trim() || fallback;
}

// status === 'error'   → vraie erreur structurelle (référence cassée, donnée corrompue)
// status === 'warning' → projet en construction (champ manquant, fichier introuvable, contenu vide)
// Les deux bloquent la génération ; seule la couleur d'affichage diffère.
function pushError(issues, id, text) {
  issues.push({ id, status: 'error', text });
}

function pushWarning(issues, id, text) {
  issues.push({ id, status: 'warning', text });
}

function collectProjectGraphStats(projectIndex) {
  return {
    entryIdCounts: projectIndex.entryIdCounts,
    menuMap: new Map(projectIndex.menuEntries.map((entry) => [entry.id, entry])),
    firstSimpleStory: projectIndex.firstSimpleStory,
    rootPlayableCount: projectIndex.rootPlayableCount,
  };
}

function validateNavigationTarget(issues, id, label, target, projectIndex, menuIds, t, VALIDATION_MESSAGES) {
  const normalized = normalizeNavigationTarget(target);
  if (!normalized) return;
  if (isRootNavigationTarget(normalized) || isCurrentMenuNavigationTarget(normalized) || isNextStoryNavigationTarget(normalized)) {
    return;
  }
  if (isStoryNavigationTarget(normalized)) {
    const storyId = decodeNavigationStoryId(normalized);
    const entry = storyId ? projectIndex.entryById.get(storyId) : null;
    if (!entry || entry.type !== 'story') {
      pushError(issues, id, missingTarget(label, 'histoire', t));
    } else if (isStoryHomeStepNavigationTarget(normalized) && !entry.afterPlaybackHomeStep) {
      pushError(issues, id, VALIDATION_MESSAGES.storyReturnLost(label));
    }
    return;
  }
  const menuId = decodeNavigationMenuId(normalized);
  if (!menuId || !menuIds.has(menuId)) {
    pushError(issues, id, missingTarget(label, 'dossier', t));
  } else if (getPlayableDescendantCount(projectIndex, menuId) === 0) {
    pushError(issues, id, emptyTarget(label, 'dossier', t));
  }
}

function validateStorySelectionItem(issues, item, fallbackName, fileAudit, t) {
  const name = labelOrFallback(item?.name, fallbackName);
  const itemId = item?.id ?? null;
  const selectionAudioRequired = isStorySelectionAudioRequired(item);
  if (!hasPath(item?.audio)) pushWarning(issues, itemId, missingField(name, 'histoire', { feminine: true, t }));
  else if (isBrokenPath(item?.audio, fileAudit)) pushWarning(issues, itemId, brokenField(name, 'histoire', t));
  if (!hasPath(item?.itemImage)) pushWarning(issues, itemId, missingField(name, 'image', { feminine: true, t }));
  else if (isBrokenPath(item?.itemImage, fileAudit)) pushWarning(issues, itemId, brokenField(name, 'image', t));
  if (!hasPath(item?.itemAudio) && selectionAudioRequired) pushWarning(issues, itemId, missingField(name, 'audio titre', { t }));
  else if (isBrokenPath(item?.itemAudio, fileAudit)) pushWarning(issues, itemId, brokenField(name, 'audio titre', t));
  if (hasPath(item?.afterPlaybackPromptAudio) && isBrokenPath(item?.afterPlaybackPromptAudio, fileAudit)) {
    pushWarning(issues, itemId, brokenField(name, "audio de fin d'histoire", t));
  }
  for (const [index, step] of (item?.afterPlaybackSequence ?? []).entries()) {
    if (!hasPath(step?.audio)) {
      pushWarning(issues, itemId, missingField(name, `audio de fin ${index + 1}`, { t }));
    } else if (isBrokenPath(step.audio, fileAudit)) {
      pushWarning(issues, itemId, brokenField(name, `audio de fin ${index + 1}`, t));
    }
  }
}

function validateZipItem(issues, item, fallbackName, fileAudit, t) {
  const name = labelOrFallback(item?.name, fallbackName);
  if (!hasPath(item?.zipPath)) pushWarning(issues, item?.id ?? null, missingField(name, 'zip', { t }));
  else if (isBrokenPath(item?.zipPath, fileAudit)) pushWarning(issues, item?.id ?? null, brokenField(name, 'zip', t));
}

export function getProjectValidationIssues(project, fileAudit = {}, providedProjectIndex = null, t = frenchFallbackT) {
  const issues = [];
  const VALIDATION_MESSAGES = createValidationMessages(t);
  const projectType = project?.projectType;
  const rootName = labelOrFallback(project?.projectName || project?.packMetadata?.title, t('validation.defaultPackName'));
  const rootMenuLabel = t('validation.rootMenuLabel');
  const endMessageLabel = t('validation.endMessageLabel');
  const autoNext = !!project?.globalOptions?.autoNext;
  const nightMode = !!project?.globalOptions?.nightMode;
  const hasEndNode = !autoNext && (nightMode || !!project?.nightModeAudio || !!project?.globalOptions?.endNode);
  const projectIndex = providedProjectIndex ?? buildProjectIndex(project);
  const { entryIdCounts, menuMap, firstSimpleStory, rootPlayableCount } = collectProjectGraphStats(projectIndex);
  const menuIds = new Set(menuMap.keys());

  if (!projectType) {
    pushWarning(issues, 'root', VALIDATION_MESSAGES.noProjectType);
    return issues;
  }

  for (const warning of project?.importWarnings ?? []) {
    pushWarning(
      issues,
      warning?.entryId ?? 'root',
      warning?.message || VALIDATION_MESSAGES.importedTransitionUnmodeled,
    );
  }

  for (const [entryId, count] of entryIdCounts.entries()) {
    if (count > 1) {
      pushError(issues, entryId, VALIDATION_MESSAGES.duplicateId(count, entryId));
    }
  }
  if (entryIdCounts.has('root')) {
    pushError(issues, 'root', VALIDATION_MESSAGES.rootReservedId);
  }

  if (!hasPath(project?.rootAudio)) pushWarning(issues, 'root', missingField(rootMenuLabel, 'audio intro', { t }));
  else if (isBrokenPath(project?.rootAudio, fileAudit)) pushWarning(issues, 'root', brokenField(rootMenuLabel, 'audio intro', t));
  if (!hasPath(project?.rootImage)) pushWarning(issues, 'root', missingField(rootMenuLabel, 'image de couverture', { feminine: true, t }));
  else if (isBrokenPath(project?.rootImage, fileAudit)) pushWarning(issues, 'root', brokenField(rootMenuLabel, 'image de couverture', t));
  const rootImageAsThumbnail = !!project?.sameImage;
  if (projectType === 'pack') {
    if (!rootImageAsThumbnail && !hasPath(project?.thumbnailImage)) {
      pushWarning(
        issues,
        'root',
        `${missingField(rootMenuLabel, 'image bibliothèque', { feminine: true, t })}${t('validation.thumbnailHint')}`,
      );
    } else if (!rootImageAsThumbnail && isBrokenPath(project?.thumbnailImage, fileAudit)) {
      pushWarning(issues, 'root', brokenField(rootMenuLabel, 'image bibliothèque', t));
    }
  } else if (!rootImageAsThumbnail && hasPath(project?.thumbnailImage) && isBrokenPath(project?.thumbnailImage, fileAudit)) {
    pushWarning(issues, 'root', brokenField(rootMenuLabel, 'image bibliothèque', t));
  }
  if (hasEndNode && !hasPath(project?.nightModeAudio)) {
    pushWarning(issues, 'end-node', missingField(endMessageLabel, 'audio', { t }));
  } else if (hasEndNode && isBrokenPath(project?.nightModeAudio, fileAudit)) {
    pushWarning(issues, 'end-node', brokenField(endMessageLabel, 'audio', t));
  }

  if (projectType === 'simple') {
    if (!hasPath(firstSimpleStory?.audio)) {
      pushWarning(issues, 'root', missingField(rootName, 'histoire', { feminine: true, t }));
    } else if (isBrokenPath(firstSimpleStory?.audio, fileAudit)) {
      pushWarning(issues, 'root', brokenField(rootName, 'histoire', t));
    }
    return issues;
  }

  const defaultCollectionName = t('validation.defaultCollectionName');
  const defaultElementName = t('validation.defaultElementName');

  visitProjectEntries(project, (entry, ancestors) => {
    const entryLabel = labelOrFallback(entry?.name, entry?.type === 'menu' ? defaultCollectionName : defaultElementName);
    const pathLabel = [...ancestors.map((parent) => labelOrFallback(parent?.name, defaultCollectionName)), entryLabel]
      .join(' / ');
    const entryId = typeof entry?.id === 'string' ? entry.id.trim() : '';
    if (!entryId) {
      pushError(issues, null, VALIDATION_MESSAGES.missingInternalId(pathLabel));
    } else if (entryId === 'root') {
      pushError(issues, entryId, VALIDATION_MESSAGES.reservedIdInvalid(pathLabel));
    }
    if (entry?.type === 'ref') {
      // Une reference est un pointeur pur : sa seule contrainte est de resoudre
      // vers une cible existante. On reutilise le resolveur de navigation.
      if (!hasPath(entry?.target)) {
        pushError(issues, entry?.id ?? null, VALIDATION_MESSAGES.refTargetMissing(pathLabel));
      } else {
        validateNavigationTarget(
          issues,
          entry?.id ?? null,
          `${entryLabel} — ${t('validation.refSuffix')}`,
          entry?.target,
          projectIndex,
          menuIds,
          t,
          VALIDATION_MESSAGES,
        );
      }
      return;
    }

    if (entry?.type !== 'menu' && entry?.type !== 'story' && entry?.type !== 'zip') {
      pushError(issues, entry?.id ?? null, VALIDATION_MESSAGES.unsupportedEntryType(pathLabel));
      return;
    }

    if (entry?.type === 'menu') {
      const menuId = entry?.id ?? null;
      const isSilentImportedContinuation = !!entry?.importedContinuation;
      if (!hasPath(entry?.audio) && !isSilentImportedContinuation) pushWarning(issues, menuId, missingField(pathLabel, 'audio', { t }));
      else if (isBrokenPath(entry?.audio, fileAudit)) pushWarning(issues, menuId, brokenField(pathLabel, 'audio', t));
      if (!hasPath(entry?.image) && !entry?.autoBlackImage) {
        pushWarning(issues, menuId, missingField(pathLabel, 'image', { feminine: true, t }));
      } else if (isBrokenPath(entry?.image, fileAudit)) {
        pushWarning(issues, menuId, brokenField(pathLabel, 'image', t));
      }
      if (getPlayableDescendantCount(projectIndex, entry.id) === 0) {
        pushWarning(issues, menuId, VALIDATION_MESSAGES.emptyMenu(pathLabel));
      }
      if (!autoNext && hasPath(entry?.returnAfterPlay)) {
        validateNavigationTarget(
          issues,
          menuId,
          `${entryLabel} — ${t('validation.storiesDestinationSuffix')}`,
          entry?.returnAfterPlay,
          projectIndex,
          menuIds,
          t,
          VALIDATION_MESSAGES,
        );
      }
      validateNavigationTarget(
        issues,
        menuId,
        `${entryLabel} — ${t('validation.folderHomeSuffix')}`,
        entry?.returnOnHome,
        projectIndex,
        menuIds,
        t,
        VALIDATION_MESSAGES,
      );
      return;
    }

    if (!autoNext && hasPath(entry?.returnAfterPlay)) {
      validateNavigationTarget(
        issues,
        entry?.id ?? null,
        `${entryLabel} — ${t('validation.endDestinationSuffix')}`,
        entry?.returnAfterPlay,
        projectIndex,
        menuIds,
        t,
        VALIDATION_MESSAGES,
      );
    }

    if (hasPath(entry?.returnOnHome)) {
      validateNavigationTarget(
        issues,
        entry?.id ?? null,
        `${entryLabel} — ${t('validation.homeButtonSuffix')}`,
        entry?.returnOnHome,
        projectIndex,
        menuIds,
        t,
        VALIDATION_MESSAGES,
      );
    }

    if (!entry?.titleReturnOnHomeNone) {
      validateNavigationTarget(
        issues,
        entry?.id ?? null,
        `${entryLabel} — ${t('validation.titleHomeSuffix')}`,
        entry?.titleReturnOnHome,
        projectIndex,
        menuIds,
        t,
        VALIDATION_MESSAGES,
      );
    }

    if (entry?.type === 'zip') validateZipItem(issues, entry, pathLabel, fileAudit, t);
    else {
      validateStorySelectionItem(issues, entry, pathLabel, fileAudit, t);
      if (!autoNext && hasPath(entry?.afterPlaybackPromptAudio)) {
        validateNavigationTarget(
          issues,
          entry?.id ?? null,
          `${entryLabel} — ${t('validation.finalPromptOkSuffix')}`,
          entry?.afterPlaybackPromptOkTarget,
          projectIndex,
          menuIds,
          t,
          VALIDATION_MESSAGES,
        );
        if (!entry?.afterPlaybackPromptHomeNone) {
          validateNavigationTarget(
            issues,
            entry?.id ?? null,
            `${entryLabel} — ${t('validation.finalPromptHomeSuffix')}`,
            entry?.afterPlaybackPromptHomeTarget,
            projectIndex,
            menuIds,
            t,
            VALIDATION_MESSAGES,
          );
        }
      }
      if (!autoNext && (entry?.afterPlaybackSequence ?? []).length > 0) {
        for (const [index, step] of entry.afterPlaybackSequence.entries()) {
          validateNavigationTarget(
            issues,
            entry?.id ?? null,
            `${entryLabel} — ${t('validation.endOkSuffix', { index: index + 1 })}`,
            step?.okTarget,
            projectIndex,
            menuIds,
            t,
            VALIDATION_MESSAGES,
          );
          if (!step?.homeFollowsOk && !step?.homeNone) {
            validateNavigationTarget(
              issues,
              entry?.id ?? null,
              `${entryLabel} — ${t('validation.endHomeSuffix', { index: index + 1 })}`,
              step?.homeTarget,
              projectIndex,
              menuIds,
              t,
              VALIDATION_MESSAGES,
            );
          }
        }
      }
    }
  }, projectIndex);

  if (rootPlayableCount === 0) {
    pushWarning(issues, 'root', VALIDATION_MESSAGES.emptyPack);
  }
  return issues;
}

export function getGenerateErrors(project, fileAudit = {}, t = frenchFallbackT) {
  return getProjectValidationIssues(project, fileAudit, null, t)
    .filter((issue) => issue.status === 'error' || issue.status === 'warning')
    .map((issue) => issue.text);
}
