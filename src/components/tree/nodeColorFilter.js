import { TREE_COLOR_PALETTE } from './treeOperations.js';
import { translate } from '../../i18n/index.js';

// Repli français par défaut : préserve les appels existants (tests, code non
// encore migré) qui n'ont pas de `t` React à fournir.
function defaultT(key, vars) {
  return translate('fr', key, vars);
}

function normalizeNodeColor(color) {
  return typeof color === 'string' ? color.trim().toLowerCase() : '';
}

function getNodeColorLabel(color, t = defaultT) {
  const normalized = normalizeNodeColor(color);
  const colorLabels = new Map([
    ['#e24b4a', t('tree.colors.red')],
    ['#ef9f27', t('tree.colors.orange')],
    ['#f0c84b', t('tree.colors.yellow')],
    ['#5fbf6b', t('tree.colors.green')],
    ['#3d9be9', t('tree.colors.blue')],
    ['#7c6af7', t('tree.colors.purple')],
    ['#d95bb4', t('tree.colors.pink')],
  ]);
  return colorLabels.get(normalized)
    ?? (normalized ? t('tree.colors.genericLabel', { hex: normalized }) : t('tree.colors.unknownLabel'));
}

export function buildUsedNodeColors(colors, t = defaultT) {
  const counts = new Map();
  for (const color of colors ?? []) {
    const normalized = normalizeNodeColor(color);
    if (normalized) counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }

  const paletteOrder = new Map(TREE_COLOR_PALETTE.map((color, index) => [normalizeNodeColor(color), index]));
  return [...counts]
    .sort(([left], [right]) => {
      const leftOrder = paletteOrder.get(left) ?? Number.POSITIVE_INFINITY;
      const rightOrder = paletteOrder.get(right) ?? Number.POSITIVE_INFINITY;
      return leftOrder - rightOrder || left.localeCompare(right);
    })
    .map(([color, count]) => ({ color, count, label: getNodeColorLabel(color, t) }));
}

export function collectProjectUsedNodeColors(project, projectIndex, t = defaultT) {
  return buildUsedNodeColors([
    project?.treeColor,
    ...(projectIndex?.flatEntries ?? []).map(({ entry }) => entry?.treeColor),
  ], t);
}

export function matchesNodeColor(color, selectedColors) {
  if (!selectedColors || selectedColors.size === 0) return true;
  return selectedColors.has(normalizeNodeColor(color));
}

export function toggleNodeColorFilter(selectedColors, color) {
  const normalized = normalizeNodeColor(color);
  const next = new Set(selectedColors ?? []);
  if (!normalized) return next;
  if (next.has(normalized)) next.delete(normalized);
  else next.add(normalized);
  return next;
}
