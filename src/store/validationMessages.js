// Validation shown in the React UI is an early, user-friendly warning layer.
// Rust remains the final generation contract and may reject additional cases.
// All helpers below use a unified em-dash separator.
//
// i18n: every exported helper takes an optional trailing `t` (from
// useTranslation()). When omitted (e.g. scripts/*.test.mjs calling these
// functions directly), `frenchFallbackT` reproduces the historical hardcoded
// French strings by reading straight from the `validation` French locale
// dictionary — the single source of truth for that wording.
import frValidation from '../i18n/locales/fr/validation.js';

function getPath(dict, key) {
  return key.split('.').reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), dict);
}

function interpolate(template, vars) {
  if (!vars) return template;
  return String(template).replace(/\{\{(\w+)\}\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
}

export function frenchFallbackT(key, vars) {
  const path = key.startsWith('validation.') ? key.slice('validation.'.length) : key;
  const value = getPath(frValidation, path);
  return value == null ? key : interpolate(value, vars);
}

const FIELD_LABEL_KEYS = Object.freeze({
  audio: 'audio',
  'audio intro': 'audioIntro',
  'audio titre': 'audioTitre',
  histoire: 'histoire',
  image: 'image',
  'image de couverture': 'imageCouverture',
  'image bibliothèque': 'imageBibliotheque',
  zip: 'zip',
  "audio de fin d'histoire": 'endOfStoryAudio',
});

function fieldLabel(field, t) {
  const key = FIELD_LABEL_KEYS[field];
  if (key) return t(`validation.fieldLabels.${key}`);
  const stepMatch = /^audio de fin (\d+)$/.exec(field || '');
  if (stepMatch) return t('validation.fieldLabels.endOfStepAudio', { index: stepMatch[1] });
  return field ? String(field) : t('validation.fieldLabels.element');
}

const TARGET_KIND_KEYS = Object.freeze({
  histoire: 'histoire',
  dossier: 'dossier',
});

function targetKindLabel(what, t) {
  const key = TARGET_KIND_KEYS[what];
  return key ? t(`validation.targetKinds.${key}`) : String(what || '');
}

export function missingField(label, field, { feminine = false, t = frenchFallbackT } = {}) {
  void feminine;
  return t('validation.missingField', { label, field: fieldLabel(field, t) });
}

export function brokenField(label, field, t = frenchFallbackT) {
  return t('validation.brokenField', { label, field: fieldLabel(field, t).toLowerCase() });
}

export function missingTarget(label, what, t = frenchFallbackT) {
  return t('validation.missingTarget', { label, what: targetKindLabel(what, t) });
}

export function emptyTarget(label, what, t = frenchFallbackT) {
  return t('validation.emptyTarget', { label, what: targetKindLabel(what, t) });
}

export function createValidationMessages(t = frenchFallbackT) {
  return Object.freeze({
    noProjectType: t('validation.noProjectType'),
    importedTransitionUnmodeled: t('validation.importedTransitionUnmodeled'),
    rootReservedId: t('validation.rootReservedId'),
    missingInternalId: (label) => t('validation.missingInternalId', { label }),
    unsupportedEntryType: (label) => t('validation.unsupportedEntryType', { label }),
    refTargetMissing: (label) => t('validation.refTargetMissing', { label }),
    reservedIdInvalid: (label) => t('validation.reservedIdInvalid', { label }),
    duplicateId: (count, entryId) => t('validation.duplicateId', { count, entryId }),
    storyReturnLost: (label) => t('validation.storyReturnLost', { label }),
    emptyMenu: (label) => t('validation.emptyMenu', { label }),
    emptyPack: t('validation.emptyPack'),
  });
}

// Repli statique lié au français, utilisé par les call sites historiques
// (scripts/*.test.mjs) qui importent VALIDATION_MESSAGES sans jamais fournir `t`.
export const VALIDATION_MESSAGES = createValidationMessages();
