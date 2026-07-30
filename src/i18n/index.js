import frDict from './locales/fr/index.js';
import enDict from './locales/en/index.js';
import itDict from './locales/it/index.js';

export const DEFAULT_LOCALE = 'fr';
export const SUPPORTED_LOCALES = ['fr', 'en', 'it'];

const DICTIONARIES = { fr: frDict, en: enDict, it: itDict };

// Résout la locale système (`navigator.language`, ex: "it-IT") vers l'une des
// locales supportées, avec repli sur le français si aucune correspondance.
export function detectSystemLocale() {
  if (typeof navigator === 'undefined' || !navigator.language) return DEFAULT_LOCALE;
  const short = navigator.language.slice(0, 2).toLowerCase();
  return SUPPORTED_LOCALES.includes(short) ? short : DEFAULT_LOCALE;
}

function getPath(dict, key) {
  return key.split('.').reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), dict);
}

function interpolate(template, vars) {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
}

// `key` est un chemin pointé "namespace.cle" (ex: "toolbar.newProject").
// Repli : locale demandée -> français -> la clé elle-même (pour repérer les
// traductions manquantes sans casser l'affichage).
export function translate(locale, key, vars) {
  const dict = DICTIONARIES[locale] || DICTIONARIES[DEFAULT_LOCALE];
  const value = getPath(dict, key) ?? getPath(DICTIONARIES[DEFAULT_LOCALE], key);
  if (value == null) return key;
  return interpolate(value, vars);
}
