// Helpers purs (sans React) partages par l'UI du verificateur et l'export du
// rapport : formatteurs de mesures, construction des lignes audio/image, et
// predicats de conformite. Garde l'export texte independant de tout JSX.
// `t` (fonction de traduction i18n) est passe en parametre par les
// composants/fonctions appelantes plutot que capture via un hook, puisque ces
// helpers ne sont pas des composants React.

function formatNumber(value, digits = 1) {
  return typeof value === 'number' ? value.toFixed(digits).replace('.', ',') : null;
}

export function formatSeconds(t, value) {
  const formatted = formatNumber(value, 2);
  return formatted ? `${formatted} s` : t('packChecker.measures.notMeasured');
}

export function formatLufs(t, value) {
  const formatted = formatNumber(value, 1);
  return formatted ? `${formatted} LUFS` : t('packChecker.measures.notMeasured');
}

export function formatPeak(t, value) {
  const formatted = formatNumber(value, 1);
  return formatted ? `${formatted} dBTP` : t('packChecker.measures.notMeasured');
}

export function cleanLabel(t, label) {
  return (label || t('packChecker.common.roleFile'))
    .replace(/\.mp3 (item|Stage node)$/i, '')
    .replace(/\.png$/i, '')
    .replace(/ node$/i, '');
}

export function expectedImageOk(item) {
  return item?.width === 320 && item?.height === 240;
}

// Lignes de mesure audio. Les `key` servent aussi, cote problemes, a reperer
// quelle mesure est en defaut (voir hasMeasureIssue).
export function audioMeasureRows(t, item) {
  return [
    { key: 'format', label: t('packChecker.measures.format'), value: `${item?.codec || t('packChecker.measures.unknownCodec')} · ${item?.channels || t('packChecker.measures.channelsUnknown')}` },
    { key: 'sampleRate', label: t('packChecker.measures.sampleRate'), value: item?.sampleRate ? `${formatNumber(item.sampleRate / 1000, 1)} kHz` : t('packChecker.measures.notMeasured') },
    { key: 'silenceStart', label: t('packChecker.measures.silenceStart'), value: formatSeconds(t, item?.leadingSilenceSecs) },
    { key: 'silenceEnd', label: t('packChecker.measures.silenceEnd'), value: formatSeconds(t, item?.trailingSilenceSecs) },
    { key: 'volume', label: t('packChecker.measures.volume'), value: formatLufs(t, item?.integratedLufs) },
    { key: 'peak', label: t('packChecker.measures.peak'), value: formatPeak(t, item?.truePeakDb) },
  ];
}

export function imageMeasureRows(t, item) {
  return [
    { key: 'dimensions', label: t('packChecker.measures.dimensions'), value: item?.width && item?.height ? `${item.width}×${item.height}` : t('packChecker.measures.notMeasured') },
    { key: 'imageFormat', label: t('packChecker.measures.imageFormat'), value: item?.format || t('packChecker.measures.notMeasured') },
  ];
}

// Un fichier est conforme s'il n'a ni erreur ni avertissement : complement
// exact de ce qui apparait dans les cartes de problemes.
export function isConforming(status) {
  return status !== 'error' && status !== 'warning';
}

export function titleConforming(report) {
  const total = report?.titleSummary?.total ?? 0;
  const ok = report?.titleSummary?.ok ?? 0;
  return total > 0 && total - ok === 0;
}

export function structureConforming(report) {
  return Boolean(report?.structureSummary?.luniiCompatible && report?.structureSummary?.storyStudioEditable);
}
