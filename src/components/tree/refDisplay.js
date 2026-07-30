// Rendu minimal d'un nœud `ref` dans l'arbre.
//
// Une `ref` est un pointeur pur : elle n'a pas de nom propre, son libellé est dérivé
// de sa cible. On résout l'id d'entrée ciblé via l'encodage navigation existant, puis
// on affiche « ↪ <nom cible> » (ou « ↩ … » pour un retour). Aucune ligne d'arbre n'est
// ajoutée pour une ref hébergée (badge) — ce helper ne sert qu'aux refs rendues en feuille.

import { refTargetEntryId } from '../../store/navigationTargets.js';
import { translate } from '../../i18n/index.js';

export { refTargetEntryId };

// Repli français par défaut : préserve les appels existants (tests, code non
// encore migré) qui n'ont pas de `t` React à fournir.
function defaultT(key, vars) {
  return translate('fr', key, vars);
}

// { targetId, label, isReturn } pour afficher une ref en feuille d'arbre.
// `entryById` : Map id → entrée (pour résoudre le nom de la cible).
// `t` : fonction de traduction (useTranslation), pour le libellé de repli.
export function buildRefDisplay(entry, entryById = new Map(), t = defaultT) {
  const targetId = refTargetEntryId(entry?.target);
  const explicit = typeof entry?.label === 'string' ? entry.label.trim() : '';
  const targetName = targetId ? (entryById.get(targetId)?.name ?? '').trim() : '';
  const name = explicit || targetName || t('tree.refDisplay.unknownTarget');
  const isReturn = entry?.refKind === 'return';
  return { targetId, label: `${isReturn ? '↩' : '↪'} ${name}`, isReturn };
}
