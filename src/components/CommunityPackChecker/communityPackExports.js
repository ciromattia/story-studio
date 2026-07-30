import {
  audioMeasureRows,
  cleanLabel,
  expectedImageOk,
  formatLufs,
  formatPeak,
  formatSeconds,
  imageMeasureRows,
  isConforming,
  structureConforming,
  titleConforming,
} from './packCheckerFormat.js';
import { formatPackAudioEdgeSilence } from '../../config/audioProcessing.js';
import { translate } from '../../i18n/index.js';

const EDGE_SILENCE_LABEL = formatPackAudioEdgeSilence();

// Repli français par défaut : préserve les appels existants (tests, code non
// encore migré) qui n'ont pas de `t` React à fournir.
function defaultT(key, vars) {
  return translate('fr', key, vars);
}

function severityLabel(t, severity) {
  switch (severity) {
    case 'error':
      return t('packChecker.common.severityError');
    case 'warning':
      return t('packChecker.common.severityWarning');
    case 'info':
      return t('packChecker.common.severityInfo');
    case 'ok':
      return t('packChecker.common.severityOk');
    default:
      return severity || t('packChecker.common.severityInfo');
  }
}

function verdictLabel(t, verdict) {
  switch (verdict) {
    case 'valid':
      return t('packChecker.export.verdictValid');
    case 'validWithWarnings':
      return t('packChecker.export.verdictValidWithWarnings');
    case 'needsFix':
      return t('packChecker.export.verdictNeedsFix');
    case 'invalid':
      return t('packChecker.export.verdictInvalid');
    default:
      return t('packChecker.export.verdictAnalyzed');
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function html(strings, ...values) {
  return strings.reduce((output, chunk, index) => (
    `${output}${chunk}${values[index] ?? ''}`
  ), '');
}

const ICONS = {
  audio: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 13 4 4L19 7"/></svg>',
  file: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z"/><path d="M14 2v5h5"/><path d="M10 14h4"/><path d="M10 18h2"/></svg>',
  image: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.5-3.5a2 2 0 0 0-3 0L5 21"/></svg>',
  info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
  moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a6 6 0 1 0 9 7.4A8.5 8.5 0 1 1 12 3z"/></svg>',
  network: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M12 8v4"/><path d="M5 16v-2a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2"/></svg>',
  package: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><path d="m4 7.5 8 4.5 8-4.5"/><path d="M12 12v9"/></svg>',
  warning: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 10 18H2z"/><path d="M12 9v5"/><path d="M12 18h.01"/></svg>',
  wrench: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.7 6.3a4 4 0 0 0-5 5L3 18v3h3l6.7-6.7a4 4 0 0 0 5-5l-2.4 2.4-2.8-2.8z"/></svg>',
};

function icon(name) {
  return ICONS[name] || ICONS.info;
}

function categoryStats(summary) {
  const total = summary?.total ?? 0;
  const ok = summary?.ok ?? 0;
  return {
    total,
    ok,
    needsFix: Math.max(0, total - ok),
  };
}

function issueText(issue) {
  return `${issue?.message || ''} ${issue?.autoFixDescription || ''} ${issue?.technicalDetails || ''}`.toLowerCase();
}

function hasMeasureIssue(issues, key) {
  const messages = (issues || []).map(issueText);
  switch (key) {
    case 'format':
      return messages.some((message) => message.includes('format') || message.includes('mono'));
    case 'sampleRate':
      return messages.some((message) => (
        message.includes('fréquence') || message.includes('frequence') || message.includes('échantillonnage')
      ));
    case 'silenceStart':
      return messages.some((message) => message.includes('silence') && (message.includes('début') || message.includes('debut')));
    case 'silenceEnd':
      return messages.some((message) => message.includes('silence') && message.includes('fin'));
    case 'volume':
      return messages.some((message) => message.includes('volume') || message.includes('niveau sonore'));
    case 'peak':
      return messages.some((message) => message.includes('crête') || message.includes('crete') || message.includes('satur') || message.includes('clipping'));
    case 'dimensions':
      return messages.some((message) => message.includes('dimension') || message.includes('taille'));
    case 'imageFormat':
      return messages.some((message) => message.includes('format'));
    default:
      return false;
  }
}

function itemMap(report) {
  const map = new Map();
  for (const item of report?.audioItems || []) map.set(item.filePath, { kind: 'audio', item });
  for (const item of report?.imageItems || []) map.set(item.filePath, { kind: 'image', item });
  return map;
}

function issuesByFilePath(report) {
  const map = new Map();
  for (const issue of report?.issues || []) {
    if (!issue.filePath) continue;
    if (!map.has(issue.filePath)) map.set(issue.filePath, []);
    map.get(issue.filePath).push(issue);
  }
  return map;
}

function uniqueIssueKey(issue) {
  return issue.filePath || `${issue.category}:${issue.label}:${issue.message}`;
}

function buildProblemSections(t) {
  return [
    {
      id: 'quality',
      title: t('packChecker.sections.quality.title'),
      badge: t('packChecker.sections.quality.badge'),
      bucket: 'listen',
      icon: 'warning',
      action: t('packChecker.sections.quality.exportAction'),
      match: (issue) => (
        issue.category === 'audio'
        && !issue.autoFixAvailable
        && (issue.message || '').toLowerCase().includes('satur')
      ),
    },
    {
      id: 'listen',
      title: t('packChecker.sections.listen.title'),
      badge: t('packChecker.sections.listen.badge'),
      bucket: 'listen',
      icon: 'info',
      action: t('packChecker.sections.listen.action'),
      match: (issue) => !issue.autoFixAvailable && issue.category !== 'structure' && issue.category !== 'title',
    },
    {
      id: 'silence',
      title: t('packChecker.sections.silence.title'),
      badge: t('packChecker.sections.silence.badge'),
      bucket: 'fix',
      icon: 'wrench',
      action: t('packChecker.sections.silence.action', { label: EDGE_SILENCE_LABEL }),
      match: (issue) => issue.autoFixAvailable && issue.category === 'audio' && issueText(issue).includes('silence'),
    },
    {
      id: 'volume',
      title: t('packChecker.sections.volume.title'),
      badge: t('packChecker.sections.volume.badge'),
      bucket: 'fix',
      icon: 'audio',
      action: t('packChecker.sections.volume.action'),
      match: (issue) => issue.autoFixAvailable && issue.category === 'audio' && issueText(issue).includes('volume'),
    },
    {
      id: 'audioFormat',
      title: t('packChecker.sections.audioFormat.title'),
      badge: t('packChecker.sections.audioFormat.badge'),
      bucket: 'fix',
      icon: 'wrench',
      action: t('packChecker.sections.audioFormat.action'),
      match: (issue) => {
        const message = issueText(issue);
        return issue.autoFixAvailable && issue.category === 'audio' && (
          message.includes('format') || message.includes('fréquence') || message.includes('mono')
        );
      },
    },
    {
      id: 'image',
      title: t('packChecker.sections.image.title'),
      badge: t('packChecker.sections.image.badge'),
      bucket: 'fix',
      icon: 'image',
      action: t('packChecker.sections.image.action'),
      match: (issue) => issue.autoFixAvailable && issue.category === 'image',
    },
    {
      id: 'title',
      title: t('packChecker.sections.title.title'),
      badge: t('packChecker.sections.title.badge'),
      bucket: 'fix',
      icon: 'file',
      action: t('packChecker.sections.title.exportAction'),
      match: (issue) => issue.category === 'title',
    },
    {
      id: 'structure',
      title: t('packChecker.sections.structure.title'),
      badge: t('packChecker.sections.structure.badge'),
      bucket: 'listen',
      icon: 'network',
      action: t('packChecker.sections.structure.action'),
      match: (issue) => issue.category === 'structure',
    },
  ];
}

function buildProblemGroups(t, report) {
  if (!report) return [];
  const byFile = issuesByFilePath(report);
  const files = itemMap(report);
  const used = new Set();
  const relevantIssues = (report.issues || []).filter((issue) => (
    issue.severity === 'error' || issue.severity === 'warning'
  ));

  return buildProblemSections(t).map((section) => {
    const records = [];
    const seen = new Set();
    for (const issue of relevantIssues) {
      if (used.has(issue) || !section.match(issue)) continue;
      used.add(issue);
      const key = uniqueIssueKey(issue);
      if (seen.has(key)) continue;
      seen.add(key);
      const fileIssues = issue.filePath ? (byFile.get(issue.filePath) || [issue]) : [issue];
      const fileEntry = issue.filePath ? files.get(issue.filePath) : null;
      records.push({
        id: `${section.id}:${key}`,
        issue,
        issues: fileIssues,
        sectionIssues: fileIssues.filter((candidate) => section.match(candidate)),
        item: fileEntry?.item || null,
        kind: fileEntry?.kind || issue.category,
      });
    }
    return {
      ...section,
      records,
      count: records.length,
      fixCount: section.id === 'title'
        ? records.length
        : records.reduce((sum, record) => (
          sum + record.issues.filter((issue) => issue.autoFixAvailable).length
        ), 0),
    };
  }).filter((group) => group.count > 0);
}

function silenceSummaryParts(t, issues, item) {
  const hasStart = issues.some((issue) => {
    const message = (issue.message || '').toLowerCase();
    return message.includes('début') || message.includes('debut');
  });
  const hasEnd = issues.some((issue) => (issue.message || '').toLowerCase().includes('fin'));
  const parts = [];
  if (hasStart) parts.push(t('packChecker.findings.silenceStart', { value: formatSeconds(t, item?.leadingSilenceSecs) }));
  if (hasEnd) parts.push(t('packChecker.findings.silenceEnd', { value: formatSeconds(t, item?.trailingSilenceSecs) }));
  return parts;
}

function measuredIssueSummary(t, issue, item, kind) {
  const message = issue.message || '';
  const lower = message.toLowerCase();
  if (kind === 'audio') {
    if (lower.includes('silence')) {
      const sides = silenceSummaryParts(t, [issue], item);
      return sides.length ? sides.join(' | ') : message;
    }
    if (lower.includes('volume')) {
      const lufs = item?.integratedLufs;
      return typeof lufs === 'number' && lufs > -10
        ? t('packChecker.findings.volumeTooHigh', { value: formatLufs(t, lufs) })
        : t('packChecker.findings.volumeTooLow', { value: formatLufs(t, lufs) });
    }
    if (lower.includes('fréquence')) {
      return t('packChecker.findings.sampleRateBad', {
        value: item?.sampleRate ? `${item.sampleRate} Hz` : t('packChecker.findings.sampleRateNotMeasured'),
      });
    }
    if (lower.includes('mono')) return t('packChecker.findings.notMono', { value: item?.channels || t('packChecker.findings.channelsNotMeasured') });
    if (lower.includes('format')) return t('packChecker.findings.audioFormatBad', { value: item?.codec || t('packChecker.findings.formatNotMeasured') });
  }
  if (kind === 'image') {
    const dimensions = item?.width && item?.height ? `${item.width}×${item.height}` : t('packChecker.findings.dimensionsNotMeasured');
    const format = item?.format || t('packChecker.findings.formatNotMeasured');
    if (lower.includes('format')) return t('packChecker.findings.imageFormatBad', { value: format });
    if (lower.includes('dimension') || lower.includes('taille')) return t('packChecker.findings.dimensionsBad', { value: dimensions });
    return t('packChecker.findings.imageBad', { dimensions, format });
  }
  return message;
}

function recordProblemSummary(t, record) {
  const scopedIssues = record.sectionIssues?.length ? record.sectionIssues : [record.issue];
  if (record.kind === 'audio') {
    if (scopedIssues.some((issue) => (issue.message || '').toLowerCase().includes('satur'))) {
      const peak = record.item?.truePeakDb;
      return typeof peak === 'number'
        ? t('packChecker.findings.saturatedWithPeak', { value: formatPeak(t, peak) })
        : t('packChecker.findings.saturatedSource');
    }
    const silenceIssues = scopedIssues.filter((issue) => (issue.message || '').toLowerCase().includes('silence'));
    if (silenceIssues.length > 0) {
      const parts = silenceSummaryParts(t, silenceIssues, record.item);
      if (parts.length > 0) return parts.join(' | ');
    }
    if (scopedIssues.some((issue) => (issue.message || '').toLowerCase().includes('volume'))) {
      const lufs = record.item?.integratedLufs;
      return typeof lufs === 'number' && lufs > -10
        ? t('packChecker.findings.volumeTooHigh', { value: formatLufs(t, lufs) })
        : t('packChecker.findings.volumeTooLow', { value: formatLufs(t, lufs) });
    }
  }
  if (record.kind === 'image') {
    return scopedIssues.map((issue) => measuredIssueSummary(t, issue, record.item, record.kind)).filter(Boolean).join(' · ');
  }
  return scopedIssues.map((issue) => measuredIssueSummary(t, issue, record.item, record.kind)).filter(Boolean).join(' · ');
}

function saturatedFileCount(groups) {
  return groups
    .filter((group) => group.id === 'quality')
    .reduce((sum, group) => sum + group.count, 0);
}

function summarizeGroups(t, groups, report) {
  const listenCount = groups
    .filter((group) => group.bucket === 'listen')
    .reduce((sum, group) => sum + group.count, 0);
  const fixCount = groups
    .filter((group) => group.bucket === 'fix')
    .reduce((sum, group) => sum + group.fixCount, 0);
  const saturatedCount = saturatedFileCount(groups);
  const hasBlocking = report?.verdict === 'invalid' || groups.some((group) => (
    group.bucket === 'listen' && group.records.some((record) => record.issue.severity === 'error')
  ));

  if (!groups.length) {
    return {
      tone: 'ok',
      icon: 'check',
      title: t('packChecker.summary.okTitle'),
      subtitle: t('packChecker.summary.okSubtitle'),
      listenCount,
      fixCount,
    };
  }
  if (hasBlocking) {
    return {
      tone: 'listen',
      icon: 'warning',
      title: t('packChecker.summary.blockingTitle'),
      subtitle: t('packChecker.summary.blockingSubtitle'),
      listenCount,
      fixCount,
    };
  }
  if (saturatedCount > 0) {
    return {
      tone: 'quality',
      icon: 'warning',
      title: fixCount > 0 ? t('packChecker.summary.qualityTitleWithFix') : t('packChecker.summary.qualityTitleNoFix'),
      subtitle: fixCount > 0
        ? t('packChecker.summary.qualitySubtitleWithFix')
        : t('packChecker.summary.qualitySubtitleNoFix'),
      listenCount,
      fixCount,
    };
  }
  if (listenCount > 0) {
    return {
      tone: 'listen',
      icon: 'info',
      title: listenCount === 1
        ? t('packChecker.summary.listenTitleOne')
        : t('packChecker.summary.listenTitleOther', { count: listenCount }),
      subtitle: t('packChecker.summary.listenSubtitle'),
      listenCount,
      fixCount,
    };
  }
  return {
    tone: 'fix',
    icon: 'wrench',
    title: t('packChecker.summary.fixTitle'),
    subtitle: t('packChecker.summary.fixSubtitle'),
    listenCount,
    fixCount,
  };
}

function fileSummary(t, kind, item) {
  if (kind === 'audio') {
    return `${formatSeconds(t, item?.leadingSilenceSecs)} / ${formatSeconds(t, item?.trailingSilenceSecs)} · ${formatLufs(t, item?.integratedLufs)}`;
  }
  const dimensions = item?.width && item?.height ? `${item.width}×${item.height}` : t('packChecker.measures.dimensionsUnknown');
  return `${dimensions} · ${item?.format || t('packChecker.measures.formatUnknown')}`;
}

function roleLabel(t, kind) {
  if (kind === 'audio') return t('packChecker.common.roleAudio');
  if (kind === 'image') return t('packChecker.common.roleImage');
  return t('packChecker.common.roleFile');
}

function measureRowsHtml(rows, badKeys = new Set()) {
  return rows.map((row) => {
    const status = badKeys.has(row.key) ? 'bad' : 'ok';
    return html`<div class="measure measure--${status}">
      <span>${icon(status === 'bad' ? 'warning' : 'check')}${escapeHtml(row.label)}</span>
      <strong>${escapeHtml(row.value)}</strong>
    </div>`;
  }).join('');
}

function recordDetailHtml(t, record) {
  const item = record.item;
  let rows = [];
  if (record.kind === 'audio') rows = audioMeasureRows(t, item);
  else if (record.kind === 'image') rows = [...imageMeasureRows(t, item), { key: 'expected', label: t('packChecker.measures.expected'), value: '320×240' }];
  else rows = [{ key: 'category', label: t('packChecker.measures.category'), value: record.issue.category || t('packChecker.common.severityInfo') }];
  const badKeys = new Set(rows.filter((row) => hasMeasureIssue(record.issues, row.key)).map((row) => row.key));
  return html`<div class="tech-detail">
    <div>
      <div class="tech-title">${escapeHtml(t('packChecker.detail.measuresTitle'))}</div>
      ${measureRowsHtml(rows, badKeys)}
    </div>
    <div>
      <div class="tech-title">${escapeHtml(t('packChecker.detail.exportActionsTitle'))}</div>
      ${record.issues.map((issue) => html`<div class="tech-action">
        ${icon(issue.autoFixAvailable ? 'wrench' : 'info')}
        <div>
          <strong>${escapeHtml(issue.autoFixDescription || issue.message)}</strong>
          ${issue.technicalDetails ? `<span>${escapeHtml(issue.technicalDetails)}</span>` : ''}
        </div>
      </div>`).join('')}
    </div>
  </div>`;
}

function problemGroupHtml(t, group, open = false) {
  return html`<details class="group group--${group.bucket} group--${group.id}" ${open ? 'open' : ''}>
    <summary class="group-head">
      <span class="group-icon">${icon(group.icon)}</span>
      <span class="group-copy">
        <span class="group-title-row">
          <strong>${escapeHtml(group.title)}</strong>
          <span class="group-badge">${escapeHtml(group.badge)}</span>
        </span>
        <span>${escapeHtml(group.action)}</span>
      </span>
      <span class="group-count"><strong>${group.count}</strong><small>${escapeHtml(group.count > 1 ? t('packChecker.common.fileOther') : t('packChecker.common.fileOne'))}</small></span>
    </summary>
    <div class="group-body">
      <div class="mini-list">
        ${group.records.map((record) => {
          const firstIssue = record.issue;
          return html`<details class="mini-file">
            <summary class="mini-file-row">
              <span class="role">${escapeHtml(roleLabel(t, record.kind))}</span>
              <span class="mini-name" title="${escapeHtml(firstIssue.filePath || firstIssue.label)}">${escapeHtml(cleanLabel(t, firstIssue.label))}</span>
              <span class="mini-problem">${escapeHtml(recordProblemSummary(t, record))}</span>
              <span class="mini-severity mini-severity--${escapeHtml(firstIssue.severity)}">${escapeHtml(severityLabel(t, firstIssue.severity))}</span>
            </summary>
            ${recordDetailHtml(t, record)}
          </details>`;
        }).join('')}
      </div>
    </div>
  </details>`;
}

function buildConformingGroups(t, report) {
  if (!report) return [];
  const groups = [];
  const audioFiles = (report.audioItems || []).filter((item) => isConforming(item.status));
  if (audioFiles.length) {
    groups.push({
      id: 'audio',
      title: t('packChecker.conforming.audioTitle'),
      subtitle: t('packChecker.conforming.audioSubtitle'),
      icon: 'audio',
      mode: 'files',
      kind: 'audio',
      files: audioFiles,
      metricStrong: String(audioFiles.length),
      metricSmall: audioFiles.length > 1 ? t('packChecker.common.fileOther') : t('packChecker.common.fileOne'),
    });
  }
  const imageFiles = (report.imageItems || []).filter((item) => isConforming(item.status));
  if (imageFiles.length) {
    groups.push({
      id: 'image',
      title: t('packChecker.conforming.imageTitle'),
      subtitle: t('packChecker.conforming.imageSubtitle'),
      icon: 'image',
      mode: 'files',
      kind: 'image',
      files: imageFiles,
      metricStrong: String(imageFiles.length),
      metricSmall: imageFiles.length > 1 ? t('packChecker.common.fileOther') : t('packChecker.common.fileOne'),
    });
  }
  if (titleConforming(report)) {
    groups.push({
      id: 'title',
      title: t('packChecker.conforming.titleTitle'),
      subtitle: t('packChecker.conforming.titleSubtitle'),
      icon: 'file',
      mode: 'facts',
      metricStrong: t('packChecker.conforming.titleMetric'),
      metricSmall: t('packChecker.conforming.titleMetricSmall'),
      facts: [
        { key: 'name', label: t('packChecker.conforming.factName'), value: report.packName || '—' },
        { key: 'title', label: t('packChecker.conforming.factTitle'), value: report.packTitle || '—' },
        { key: 'version', label: t('packChecker.conforming.factVersion'), value: String(report.packVersion ?? '—') },
      ],
    });
  }
  if (structureConforming(report)) {
    const structure = report.structureSummary || {};
    groups.push({
      id: 'structure',
      title: t('packChecker.conforming.structureTitle'),
      subtitle: t('packChecker.conforming.structureSubtitle'),
      icon: 'network',
      mode: 'facts',
      metricStrong: t('packChecker.conforming.structureMetric'),
      metricSmall: t('packChecker.tiles.stagesCount', { count: structure.stageCount ?? 0 }),
      facts: [
        { key: 'lunii', label: t('packChecker.conforming.factLunii'), value: structure.luniiCompatible ? t('packChecker.conforming.yes') : t('packChecker.conforming.no') },
        { key: 'editable', label: t('packChecker.conforming.factEditable'), value: structure.storyStudioEditable ? t('packChecker.conforming.yes') : t('packChecker.conforming.no') },
        { key: 'stories', label: t('packChecker.conforming.factStories'), value: String(structure.storyCount ?? 0) },
        { key: 'stages', label: t('packChecker.conforming.factStages'), value: String(structure.stageCount ?? 0) },
        { key: 'actions', label: t('packChecker.conforming.factActions'), value: String(structure.actionCount ?? 0) },
        { key: 'refAudio', label: t('packChecker.conforming.factRefAudio'), value: String(structure.referencedAudioCount ?? 0) },
        { key: 'refImage', label: t('packChecker.conforming.factRefImage'), value: String(structure.referencedImageCount ?? 0) },
      ],
    });
  }
  const nightDetected = Boolean(report.nightMode?.detected);
  groups.push({
    id: 'night',
    title: t('packChecker.conforming.nightTitle'),
    subtitle: nightDetected ? t('packChecker.conforming.nightDetected') : t('packChecker.conforming.nightAbsent'),
    icon: 'moon',
    mode: 'facts',
    metricStrong: nightDetected ? t('packChecker.conforming.nightMetricAvailable') : t('packChecker.conforming.nightMetricAbsent'),
    metricSmall: t('packChecker.conforming.nightMetricSmall'),
    facts: [
      { key: 'detected', label: t('packChecker.conforming.factNightMode'), value: nightDetected ? t('packChecker.conforming.nightMetricAvailable') : t('packChecker.conforming.nightMetricAbsent') },
      { key: 'blocking', label: t('packChecker.conforming.factBlocking'), value: t('packChecker.conforming.no') },
    ],
  });
  return groups;
}

function conformingGroupHtml(t, group, open = false) {
  return html`<details class="group group--ok group--${group.id}" ${open ? 'open' : ''}>
    <summary class="group-head">
      <span class="group-icon">${icon(group.icon)}</span>
      <span class="group-copy">
        <span class="group-title-row">
          <strong>${escapeHtml(group.title)}</strong>
          <span class="group-badge">${escapeHtml(t('packChecker.conforming.badge'))}</span>
        </span>
        <span>${escapeHtml(group.subtitle)}</span>
      </span>
      <span class="group-count"><strong>${escapeHtml(group.metricStrong)}</strong><small>${escapeHtml(group.metricSmall)}</small></span>
    </summary>
    <div class="group-body">
      ${group.mode === 'files' ? html`<div class="mini-list">
        ${group.files.map((item) => {
          const rows = group.kind === 'audio'
            ? audioMeasureRows(t, item)
            : [...imageMeasureRows(t, item), { key: 'expected', label: t('packChecker.measures.expected'), value: expectedImageOk(item) ? '320×240' : '320×240' }];
          return html`<details class="mini-file">
            <summary class="mini-file-row">
              <span class="role">${escapeHtml(roleLabel(t, group.kind))}</span>
              <span class="mini-name" title="${escapeHtml(item.filePath || item.label)}">${escapeHtml(cleanLabel(t, item.label))}</span>
              <span class="mini-problem">${escapeHtml(fileSummary(t, group.kind, item))}</span>
              <span class="mini-severity mini-severity--ok">${escapeHtml(t('packChecker.common.severityOk'))}</span>
            </summary>
            <div class="tech-detail tech-detail--facts">
              <div>
                <div class="tech-title">${escapeHtml(t('packChecker.detail.measuresTitle'))}</div>
                ${measureRowsHtml(rows)}
              </div>
            </div>
          </details>`;
        }).join('')}
      </div>` : html`<div class="tech-detail tech-detail--facts">
        <div>
          <div class="tech-title">${escapeHtml(t('packChecker.detail.detailsTitle'))}</div>
          ${measureRowsHtml(group.facts)}
        </div>
      </div>`}
    </div>
  </details>`;
}

function summaryTileHtml({ title, iconName, tone, strong, small, split, okLabel, needsFixLabel }) {
  return html`<div class="summary-tile summary-tile--${tone}">
    <div class="summary-head">${icon(iconName)}<span>${escapeHtml(title)}</span></div>
    ${split ? html`<div class="split-stat">
      <span class="split-ok"><strong>${split.ok}</strong> ${escapeHtml(okLabel)}</span>
      <span class="split-fix ${split.needsFix === 0 ? 'is-clean' : ''}"><strong>${split.needsFix}</strong> ${escapeHtml(needsFixLabel)}</span>
    </div>` : html`<div class="single-stat"><strong>${escapeHtml(strong)}</strong><span>${escapeHtml(small)}</span></div>`}
  </div>`;
}

function reportStyles() {
  return `
    :root {
      color-scheme: light;
      --bg0: #f3f6fb;
      --bg1: #ffffff;
      --bg2: #f7f9fc;
      --bg3: #edf2f7;
      --text: #1f2430;
      --muted: #748095;
      --border: #dfe6ef;
      --borderLt: #cfd8e7;
      --success-bg: #e8f7ee;
      --success-border: #76c795;
      --success-text: #21824b;
      --warning-bg: #fff5d8;
      --warning-border: #e3b84a;
      --warning-text: #9a6b00;
      --danger-bg: #ffe9e9;
      --danger-border: #f19a9a;
      --danger-text: #b03636;
      --listen-bg: #efedff;
      --listen-border: #aaa3f2;
      --listen-text: #6157cf;
      --font: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      --mono: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: linear-gradient(180deg, #edf1f7 0, #f8fafc 280px);
      color: var(--text);
      font-family: var(--font);
      font-size: 13px;
      line-height: 1.45;
    }
    svg {
      width: 18px;
      height: 18px;
      fill: none;
      stroke: currentColor;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-width: 2;
    }
    .document {
      width: min(1040px, calc(100vw - 32px));
      margin: 24px auto 36px;
      overflow: hidden;
      border: 1px solid var(--borderLt);
      border-radius: 12px;
      background: var(--bg1);
      box-shadow: 0 24px 70px rgba(37, 45, 64, 0.15);
    }
    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 16px 18px;
      border-bottom: 1px solid var(--border);
    }
    .modal-title {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }
    .drop-icon,
    .report-orb,
    .group-icon {
      display: grid;
      place-items: center;
      flex: 0 0 auto;
      border: 1px solid #9b8fec;
      border-radius: 9px;
      background: #efeaff;
      color: #695bd6;
    }
    .drop-icon { width: 34px; height: 34px; }
    .modal-title strong { display: block; font-size: 14px; font-weight: 750; }
    .modal-title span {
      display: block;
      max-width: 760px;
      overflow: hidden;
      color: var(--muted);
      font-family: var(--mono);
      font-size: 11px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .print-button {
      flex: 0 0 auto;
      padding: 7px 12px;
      border: 1px solid var(--borderLt);
      border-radius: 8px;
      background: var(--bg2);
      color: var(--text);
      cursor: pointer;
      font: inherit;
      font-size: 12px;
      font-weight: 650;
    }
    .print-button:hover { border-color: #9b8fec; background: #f1edff; }
    .report { display: flex; flex-direction: column; min-width: 0; }
    .report-verdict {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
      padding: 16px 18px;
      border-bottom: 1px solid var(--border);
    }
    .report-verdict--ok .report-orb { background: var(--success-bg); border-color: var(--success-border); color: var(--success-text); }
    .report-verdict--fix .report-orb { background: var(--warning-bg); border-color: var(--warning-border); color: var(--warning-text); }
    .report-verdict--listen .report-orb { background: var(--listen-bg); border-color: var(--listen-border); color: var(--listen-text); }
    .report-verdict--quality .report-orb { background: var(--danger-bg); border-color: var(--danger-border); color: var(--danger-text); }
    .report-orb { width: 40px; height: 40px; border-radius: 999px; }
    .report-copy { display: flex; flex: 1 1 auto; flex-direction: column; gap: 2px; min-width: 0; }
    .pack-name {
      overflow: hidden;
      color: var(--muted);
      font-family: var(--mono);
      font-size: 10px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .report-copy strong { font-size: 16px; line-height: 1.15; }
    .report-copy span:not(.pack-name) { color: var(--muted); font-size: 12px; }
    .report-callout {
      display: flex;
      align-items: center;
      gap: 7px;
      flex: 0 0 auto;
      padding: 7px 12px;
      border: 1px solid var(--listen-border);
      border-radius: 8px;
      background: var(--listen-bg);
      font-size: 12px;
    }
    .report-callout svg { color: var(--listen-text); }
    .summary-tiles {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 10px;
      padding: 14px 18px 0;
    }
    .summary-tile {
      min-width: 0;
      padding: 10px;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--bg2);
    }
    .summary-tile--ok { border-color: var(--success-border); background: var(--success-bg); }
    .summary-tile--fix { border-color: var(--warning-border); background: var(--warning-bg); }
    .summary-tile--listen { border-color: var(--listen-border); background: var(--listen-bg); }
    .summary-tile--danger { border-color: var(--danger-border); background: var(--danger-bg); }
    .summary-head {
      display: flex;
      align-items: center;
      gap: 7px;
      font-size: 11px;
      font-weight: 750;
    }
    .summary-head svg { width: 15px; height: 15px; }
    .summary-tile--ok .summary-head { color: var(--success-text); }
    .summary-tile--fix .summary-head { color: var(--warning-text); }
    .summary-tile--listen .summary-head { color: var(--listen-text); }
    .summary-tile--danger .summary-head { color: var(--danger-text); }
    .split-stat {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      margin-top: 8px;
    }
    .split-stat span,
    .single-stat {
      min-width: 0;
      padding: 7px 8px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.58);
      color: var(--muted);
      font-size: 10px;
      line-height: 1.2;
    }
    .split-stat strong,
    .single-stat strong {
      color: var(--text);
      font-family: var(--mono);
      font-size: 15px;
      line-height: 1;
    }
    .split-ok strong,
    .split-fix.is-clean strong { color: var(--success-text); }
    .split-fix strong { color: var(--warning-text); }
    .single-stat {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 8px;
      margin-top: 8px;
    }
    .single-stat span {
      min-width: 0;
      overflow: hidden;
      font-size: 10px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .empty,
    .section-head {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 14px 18px 0;
      color: var(--success-text);
      font-size: 12px;
      font-weight: 750;
    }
    .empty {
      padding: 10px 12px;
      border-radius: 8px;
      background: var(--bg2);
      font-weight: 500;
    }
    .groups {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 14px 18px;
    }
    .group {
      overflow: hidden;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--bg1);
      page-break-inside: avoid;
    }
    .group[open] { background: var(--bg2); }
    .group--fix[open] { border-color: var(--warning-border); }
    .group--listen[open] { border-color: var(--listen-border); }
    .group--quality[open] { border-color: var(--danger-border); }
    .group--ok[open] { border-color: var(--success-border); }
    .group-head {
      display: flex;
      align-items: center;
      gap: 13px;
      min-width: 0;
      padding: 13px 14px;
      cursor: pointer;
      list-style: none;
    }
    .group-head::-webkit-details-marker,
    .mini-file-row::-webkit-details-marker { display: none; }
    .group-icon { width: 40px; height: 40px; border-radius: 10px; }
    .group--listen .group-icon,
    .group--listen .group-badge { background: var(--listen-bg); color: var(--listen-text); border-color: var(--listen-border); }
    .group--fix .group-icon,
    .group--fix .group-badge { background: var(--warning-bg); color: var(--warning-text); border-color: var(--warning-border); }
    .group--quality .group-icon,
    .group--quality .group-badge { background: var(--danger-bg); color: var(--danger-text); border-color: var(--danger-border); }
    .group--ok .group-icon,
    .group--ok .group-badge { background: var(--success-bg); color: var(--success-text); border-color: var(--success-border); }
    .group-copy {
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      gap: 3px;
      min-width: 0;
    }
    .group-title-row {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }
    .group-title-row strong {
      overflow: hidden;
      font-size: 14px;
      font-weight: 750;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .group-title-row + span { color: var(--muted); font-size: 12px; line-height: 1.35; }
    .group-badge {
      display: inline-flex;
      align-items: center;
      min-height: 20px;
      padding: 0 8px;
      border: 1px solid;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 750;
      white-space: nowrap;
    }
    .group-count {
      display: flex;
      align-items: flex-end;
      flex: 0 0 auto;
      flex-direction: column;
      gap: 1px;
      min-width: 54px;
    }
    .group-count strong { font-family: var(--mono); font-size: 22px; line-height: 1; }
    .group--fix .group-count strong { color: var(--warning-text); }
    .group--listen .group-count strong { color: var(--listen-text); }
    .group--quality .group-count strong { color: var(--danger-text); }
    .group--ok .group-count strong { color: var(--success-text); }
    .group-count small { color: var(--muted); font-size: 10px; }
    .group-body { padding: 0 14px 12px; }
    .mini-file { border-top: 1px solid var(--border); }
    .mini-file-row {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      min-width: 0;
      padding: 8px 4px;
      cursor: pointer;
      list-style: none;
    }
    .role {
      flex: 0 0 auto;
      padding: 2px 5px;
      border-radius: 4px;
      background: var(--bg3);
      color: var(--muted);
      font-size: 9px;
      font-weight: 750;
      text-transform: uppercase;
    }
    .mini-name {
      flex: 1 1 34%;
      min-width: 0;
      overflow: hidden;
      font-size: 12px;
      font-weight: 650;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .mini-problem {
      flex: 1.2 1 42%;
      min-width: 150px;
      overflow: hidden;
      color: var(--muted);
      font-size: 11px;
      line-height: 1.25;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .mini-severity {
      flex: 0 0 auto;
      color: var(--muted);
      font-size: 10px;
      font-weight: 750;
    }
    .mini-severity--error { color: var(--danger-text); }
    .mini-severity--warning { color: var(--warning-text); }
    .mini-severity--ok { color: var(--success-text); }
    .tech-detail {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 2px 28px;
      margin: 2px 0 12px;
      padding: 10px 12px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--bg1);
    }
    .tech-detail--facts { grid-template-columns: 1fr; }
    .tech-title {
      margin-bottom: 4px;
      color: var(--muted);
      font-size: 10px;
      font-weight: 750;
      text-transform: uppercase;
    }
    .measure {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 10px;
      padding: 4px 0;
      border-bottom: 1px solid var(--border);
    }
    .measure span {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--muted);
      font-size: 11px;
    }
    .measure svg { width: 12px; height: 12px; }
    .measure--ok svg { color: var(--success-text); }
    .measure--bad svg { color: var(--danger-text); }
    .measure strong {
      font-family: var(--mono);
      font-size: 11px;
      font-weight: 650;
    }
    .tech-action {
      display: flex;
      gap: 8px;
      padding: 5px 0;
      border-bottom: 1px solid var(--border);
    }
    .tech-action svg {
      width: 14px;
      height: 14px;
      margin-top: 1px;
      color: #695bd6;
    }
    .tech-action div {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .tech-action strong { font-size: 12px; font-weight: 650; }
    .tech-action span { color: var(--muted); font-size: 10px; line-height: 1.35; }
    .technical-log {
      margin: 0 18px 18px;
      overflow: hidden;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--bg2);
    }
    .technical-log summary {
      padding: 9px 10px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 750;
    }
    .technical-log pre {
      max-height: 360px;
      margin: 0;
      padding: 10px;
      overflow: auto;
      border-top: 1px solid var(--border);
      color: #3e495b;
      font-family: var(--mono);
      font-size: 10px;
      line-height: 1.45;
      white-space: pre-wrap;
    }
    @media (max-width: 720px) {
      .document { width: 100%; margin: 0; border-radius: 0; }
      .modal-header,
      .report-verdict { align-items: stretch; flex-direction: column; }
      .modal-title span { max-width: 100%; }
      .summary-tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .report-callout { width: fit-content; }
      .group-head { align-items: flex-start; }
      .mini-file-row { align-items: flex-start; flex-wrap: wrap; }
      .mini-problem { order: 3; flex-basis: 100%; min-width: 0; }
      .tech-detail { grid-template-columns: minmax(0, 1fr); }
    }
    @media (max-width: 480px) {
      .summary-tiles { grid-template-columns: minmax(0, 1fr); }
    }
    @media print {
      body { background: #fff; }
      .document {
        width: 100%;
        margin: 0;
        border: 0;
        border-radius: 0;
        box-shadow: none;
      }
      .print-button { display: none; }
      .technical-log pre { max-height: none; }
      details { break-inside: avoid; }
      details:not([open]) > *:not(summary) { display: block; }
    }
  `;
}

export function reportBaseName(report) {
  return String(report?.packName || 'rapport-pack')
    .replace(/\.(zip|7z)$/i, '')
    .replace(/[<>:"/\\|?*\[\]+]/g, '_')
    .trim() || 'rapport-pack';
}

export function formatTechnicalLog(report) {
  return (report?.technicalLog || []).join('\n');
}

export function formatDiagnosticJson(report) {
  return JSON.stringify(report, null, 2);
}

export function formatHtmlReport(report, t = defaultT) {
  if (!report) return '';
  const groups = buildProblemGroups(t, report);
  const summary = summarizeGroups(t, groups, report);
  const saturatedCount = saturatedFileCount(groups);
  const conformingGroups = buildConformingGroups(t, report);
  const audio = categoryStats(report.audioSummary);
  const images = categoryStats(report.imageSummary);
  const title = categoryStats(report.titleSummary);
  const titleOk = title.total > 0 && title.needsFix === 0;
  const structureOk = report.structureSummary?.luniiCompatible && report.structureSummary?.storyStudioEditable;
  const nightMode = Boolean(report.nightMode?.detected);
  const generatedAt = new Date().toLocaleString();
  const titleText = t('packChecker.export.docTitle', { packName: report.packName || t('packChecker.export.packAnalyzedFallback') });

  return html`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(titleText)}</title>
  <style>${reportStyles()}</style>
</head>
<body>
  <main class="document">
    <header class="modal-header">
      <div class="modal-title">
        <span class="drop-icon">${icon('package')}</span>
        <div>
          <strong>${escapeHtml(t('packChecker.export.headerTitle'))}</strong>
          <span title="${escapeHtml(report.packName || '')}">${escapeHtml(report.packName || t('packChecker.export.packAnalyzedFallback'))} · ${escapeHtml(generatedAt)}</span>
        </div>
      </div>
      <button class="print-button" type="button" onclick="window.print()">${escapeHtml(t('packChecker.export.print'))}</button>
    </header>
    <section class="report" aria-label="${escapeHtml(t('packChecker.summary.ariaLabel'))}">
      <div class="report-verdict report-verdict--${summary.tone}">
        <span class="report-orb">${icon(summary.icon)}</span>
        <div class="report-copy">
          <span class="pack-name">${escapeHtml(report.packName || t('packChecker.export.packAnalyzedFallback'))}</span>
          <strong>${escapeHtml(summary.title)}</strong>
          <span>${escapeHtml(summary.subtitle)}</span>
        </div>
        <div class="report-callout">
          ${icon('info')}
          <span><strong>${summary.listenCount}</strong> ${escapeHtml(t('packChecker.summary.toListenLabel'))} · <strong>${summary.fixCount}</strong> ${escapeHtml(t('packChecker.summary.proposedFixesLabel'))}</span>
        </div>
      </div>
      <div class="summary-tiles" aria-label="${escapeHtml(t('packChecker.summary.ariaLabel'))}">
        ${summaryTileHtml({
          title: t('packChecker.tiles.audio'),
          iconName: 'audio',
          tone: saturatedCount > 0 ? 'danger' : (audio.needsFix > 0 ? 'fix' : 'ok'),
          split: audio,
          okLabel: t('packChecker.tiles.ok'),
          needsFixLabel: t('packChecker.tiles.needsFix'),
        })}
        ${summaryTileHtml({
          title: t('packChecker.tiles.images'),
          iconName: 'image',
          tone: images.needsFix ? 'fix' : 'ok',
          split: images,
          okLabel: t('packChecker.tiles.ok'),
          needsFixLabel: t('packChecker.tiles.needsFix'),
        })}
        ${summaryTileHtml({
          title: t('packChecker.tiles.packTitle'),
          iconName: 'file',
          tone: titleOk ? 'ok' : 'fix',
          strong: titleOk ? t('packChecker.tiles.valid') : t('packChecker.tiles.toFix'),
          small: titleOk ? t('packChecker.tiles.conventionOk') : t('packChecker.tiles.metadata'),
        })}
        ${summaryTileHtml({
          title: t('packChecker.tiles.structure'),
          iconName: 'network',
          tone: structureOk ? 'ok' : 'listen',
          strong: structureOk ? t('packChecker.tiles.correct') : t('packChecker.tiles.manualCheck'),
          small: t('packChecker.tiles.stagesCount', { count: report.structureSummary?.stageCount ?? 0 }),
        })}
        ${summaryTileHtml({
          title: t('packChecker.tiles.nightMode'),
          iconName: 'moon',
          tone: nightMode ? 'ok' : 'neutral',
          strong: nightMode ? t('packChecker.tiles.available') : t('packChecker.tiles.absent'),
          small: nightMode ? t('packChecker.tiles.detectedInPack') : t('packChecker.tiles.nonBlocking'),
        })}
      </div>
      ${groups.length === 0 ? html`<div class="empty">${icon('check')}${escapeHtml(t('packChecker.emptyReport'))}</div>` : html`<div class="groups">
        ${groups.map((group, index) => problemGroupHtml(t, group, index === 0)).join('')}
      </div>`}
      ${conformingGroups.length ? html`<div class="section-head">${icon('check')}${escapeHtml(t('packChecker.conforming.heading'))}</div>
      <div class="groups">
        ${conformingGroups.map((group, index) => conformingGroupHtml(t, group, groups.length === 0 && index === 0)).join('')}
      </div>` : ''}
      <details class="technical-log">
        <summary>${escapeHtml(t('packChecker.technicalLog.summary'))}</summary>
        <pre>${escapeHtml(formatTechnicalLog(report))}</pre>
      </details>
    </section>
  </main>
</body>
</html>`;
}

export function formatReadableReport(report, t = defaultT) {
  if (!report) return '';
  const lines = [];
  lines.push(t('packChecker.export.mdTitle'));
  lines.push('');
  lines.push(t('packChecker.export.mdPackAnalyzed', { packName: report.packName }));
  lines.push(t('packChecker.export.mdVerdict', { verdict: verdictLabel(t, report.verdict) }));
  lines.push('');
  lines.push(t('packChecker.export.mdErrors', { count: report.summary?.errors ?? 0 }));
  lines.push(t('packChecker.export.mdWarnings', { count: report.summary?.warnings ?? 0 }));
  lines.push(t('packChecker.export.mdInfos', { count: report.summary?.infos ?? 0 }));
  lines.push(t('packChecker.export.mdOkItems', { count: report.summary?.ok ?? 0 }));
  lines.push(t('packChecker.export.mdCorrectionsAvailable', { count: report.correctionsAvailable ?? 0 }));
  lines.push('');
  lines.push(t('packChecker.export.mdSummaryHeading'));
  lines.push('');
  lines.push(t('packChecker.export.mdSummaryAudio', { ok: report.audioSummary?.ok ?? 0, total: report.audioSummary?.total ?? 0 }));
  lines.push(t('packChecker.export.mdSummaryImages', { ok: report.imageSummary?.ok ?? 0, total: report.imageSummary?.total ?? 0 }));
  lines.push(t('packChecker.export.mdSummaryStructure', {
    status: report.structureSummary?.luniiCompatible ? t('packChecker.export.mdSummaryStructureValid') : t('packChecker.export.mdSummaryStructureToFix'),
  }));
  lines.push(t('packChecker.export.mdSummaryEditable', {
    status: report.structureSummary?.storyStudioEditable ? t('packChecker.export.mdSummaryEditableSupported') : t('packChecker.export.mdSummaryEditableUnsupported'),
  }));
  lines.push(t('packChecker.export.mdSummaryNight', {
    status: report.nightMode?.detected ? t('packChecker.export.mdSummaryNightDetected') : t('packChecker.export.mdSummaryNightAbsent'),
  }));
  lines.push('');
  lines.push(t('packChecker.export.mdIssuesHeading'));
  lines.push('');
  const issues = report.issues || [];
  if (issues.length === 0) {
    lines.push(t('packChecker.export.mdNoIssues'));
  } else {
    for (const issue of issues) {
      lines.push(t('packChecker.export.mdIssueLine', { severity: severityLabel(t, issue.severity), label: issue.label, message: issue.message }));
      if (issue.filePath) lines.push(t('packChecker.export.mdIssueFile', { filePath: issue.filePath }));
      if (issue.technicalDetails) lines.push(t('packChecker.export.mdIssueDetail', { details: issue.technicalDetails }));
      if (issue.autoFixDescription) lines.push(t('packChecker.export.mdIssueFix', { fix: issue.autoFixDescription }));
    }
  }
  lines.push('');
  lines.push(t('packChecker.export.mdConformingHeading'));
  lines.push('');
  const conformingAudio = (report.audioItems || []).filter((item) => isConforming(item.status));
  if (conformingAudio.length) {
    lines.push(t('packChecker.export.mdConformingAudioHeading', { count: conformingAudio.length }));
    for (const item of conformingAudio) {
      const measures = audioMeasureRows(t, item).map((row) => `${row.label} : ${row.value}`).join(' · ');
      lines.push(`- ${cleanLabel(t, item.label)} — ${measures}`);
    }
    lines.push('');
  }
  const conformingImages = (report.imageItems || []).filter((item) => isConforming(item.status));
  if (conformingImages.length) {
    lines.push(t('packChecker.export.mdConformingImagesHeading', { count: conformingImages.length }));
    for (const item of conformingImages) {
      const measures = imageMeasureRows(t, item).map((row) => `${row.label} : ${row.value}`).join(' · ');
      lines.push(`- ${cleanLabel(t, item.label)} — ${measures}`);
    }
    lines.push('');
  }
  if (titleConforming(report)) {
    lines.push(t('packChecker.export.mdTitleHeading'));
    lines.push(t('packChecker.export.mdTitleName', { value: report.packName || '—' }));
    lines.push(t('packChecker.export.mdTitleTitle', { value: report.packTitle || '—' }));
    lines.push(t('packChecker.export.mdTitleVersion', { value: report.packVersion ?? '—' }));
    lines.push('');
  }
  if (structureConforming(report)) {
    const structure = report.structureSummary || {};
    lines.push(t('packChecker.export.mdStructureHeading'));
    lines.push(t('packChecker.export.mdStructureLunii', { value: structure.luniiCompatible ? t('packChecker.export.yes') : t('packChecker.export.no') }));
    lines.push(t('packChecker.export.mdStructureEditable', { value: structure.storyStudioEditable ? t('packChecker.export.yes') : t('packChecker.export.no') }));
    lines.push(t('packChecker.export.mdStructureStories', { count: structure.storyCount ?? 0 }));
    lines.push(t('packChecker.export.mdStructureStages', { count: structure.stageCount ?? 0 }));
    lines.push(t('packChecker.export.mdStructureActions', { count: structure.actionCount ?? 0 }));
    lines.push(t('packChecker.export.mdStructureRefAudio', { count: structure.referencedAudioCount ?? 0 }));
    lines.push(t('packChecker.export.mdStructureRefImage', { count: structure.referencedImageCount ?? 0 }));
    lines.push('');
  }
  lines.push(t('packChecker.export.mdNightHeading'));
  lines.push(t('packChecker.export.mdNightValue', { value: report.nightMode?.detected ? t('packChecker.export.mdNightAvailable') : t('packChecker.export.mdNightAbsent') }));
  lines.push(t('packChecker.export.mdBlocking'));
  lines.push('');
  lines.push(t('packChecker.export.mdTechnicalLogHeading'));
  lines.push('');
  lines.push('```text');
  lines.push(formatTechnicalLog(report));
  lines.push('```');
  return lines.join('\n');
}
