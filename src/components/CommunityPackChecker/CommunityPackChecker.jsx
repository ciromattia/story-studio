import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../common/Button';
import { CommunityPackMetadataModal } from './CommunityPackMetadataModal';
import {
  Check,
  ChevronDown,
  CircleCheck,
  Download,
  FilePen,
  Image,
  Info,
  Loader2,
  Moon,
  Music,
  Network,
  Scissors,
  TriangleAlert,
  Wrench,
} from '../icons/LucideLocal';
import {
  Measure,
  audioMeasureRows,
  cleanLabel,
  expectedImageOk,
  formatLufs,
  formatPeak,
  formatSeconds,
  imageMeasureRows,
} from './packCheckerMeasures';
import { ConformingSection } from './CommunityPackConforming';
import { formatPackAudioEdgeSilence } from '../../config/audioProcessing';
import { useTranslation } from '../../i18n/I18nContext';
import './CommunityPackChecker.css';

const EDGE_SILENCE_LABEL = formatPackAudioEdgeSilence();

function buildProblemSections(t) {
  return [
    {
      id: 'quality',
      title: t('packChecker.sections.quality.title'),
      badge: t('packChecker.sections.quality.badge'),
      bucket: 'listen',
      Icon: TriangleAlert,
      explanation: t('packChecker.sections.quality.explanation'),
      action: t('packChecker.sections.quality.action'),
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
      Icon: Info,
      explanation: t('packChecker.sections.listen.explanation'),
      action: t('packChecker.sections.listen.action'),
      match: (issue) => !issue.autoFixAvailable && issue.category !== 'structure' && issue.category !== 'title',
    },
    {
      id: 'silence',
      title: t('packChecker.sections.silence.title'),
      badge: t('packChecker.sections.silence.badge'),
      bucket: 'fix',
      Icon: Scissors,
      explanation: t('packChecker.sections.silence.explanation'),
      action: t('packChecker.sections.silence.action', { label: EDGE_SILENCE_LABEL }),
      match: (issue) => issue.autoFixAvailable && issue.category === 'audio' && issue.message.toLowerCase().includes('silence'),
    },
    {
      id: 'volume',
      title: t('packChecker.sections.volume.title'),
      badge: t('packChecker.sections.volume.badge'),
      bucket: 'fix',
      Icon: Music,
      explanation: t('packChecker.sections.volume.explanation'),
      action: t('packChecker.sections.volume.action'),
      match: (issue) => issue.autoFixAvailable && issue.category === 'audio' && issue.message.toLowerCase().includes('volume'),
    },
    {
      id: 'audioFormat',
      title: t('packChecker.sections.audioFormat.title'),
      badge: t('packChecker.sections.audioFormat.badge'),
      bucket: 'fix',
      Icon: Wrench,
      explanation: t('packChecker.sections.audioFormat.explanation'),
      action: t('packChecker.sections.audioFormat.action'),
      match: (issue) => {
        const message = issue.message.toLowerCase();
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
      Icon: Image,
      explanation: t('packChecker.sections.image.explanation'),
      action: t('packChecker.sections.image.action'),
      match: (issue) => issue.autoFixAvailable && issue.category === 'image',
    },
    {
      id: 'title',
      title: t('packChecker.sections.title.title'),
      badge: t('packChecker.sections.title.badge'),
      bucket: 'fix',
      Icon: FilePen,
      explanation: t('packChecker.sections.title.explanation'),
      action: t('packChecker.sections.title.action'),
      match: (issue) => issue.category === 'title',
    },
    {
      id: 'structure',
      title: t('packChecker.sections.structure.title'),
      badge: t('packChecker.sections.structure.badge'),
      bucket: 'listen',
      Icon: Network,
      explanation: t('packChecker.sections.structure.explanation'),
      action: t('packChecker.sections.structure.action'),
      match: (issue) => issue.category === 'structure',
    },
  ];
}

function IconFrame({ Icon }) {
  return <Icon className="checker-icon" aria-hidden="true" strokeWidth={2} absoluteStrokeWidth />;
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
    if (lower.includes('mono')) {
      return t('packChecker.findings.notMono', { value: item?.channels || t('packChecker.findings.channelsNotMeasured') });
    }
    if (lower.includes('format')) {
      return t('packChecker.findings.audioFormatBad', { value: item?.codec || t('packChecker.findings.formatNotMeasured') });
    }
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
    return scopedIssues
      .map((issue) => measuredIssueSummary(t, issue, record.item, record.kind))
      .filter(Boolean)
      .join(' · ');
  }

  return scopedIssues
    .map((issue) => measuredIssueSummary(t, issue, record.item, record.kind))
    .filter(Boolean)
    .join(' · ');
}

function issueText(issue) {
  return `${issue.message || ''} ${issue.autoFixDescription || ''} ${issue.technicalDetails || ''}`.toLowerCase();
}

function hasMeasureIssue(record, key) {
  const messages = record.issues.map(issueText);
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

function roleLabel(t, record) {
  const raw = record.item?.itemType || record.issue?.itemType || record.issue?.category || t('packChecker.common.roleFile');
  if (raw === 'image') return t('packChecker.common.roleImage');
  if (raw === 'audio') return t('packChecker.common.roleAudio');
  return raw;
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

function buildItemMap(report) {
  const map = new Map();
  for (const item of report?.audioItems || []) {
    map.set(item.filePath, { kind: 'audio', item });
  }
  for (const item of report?.imageItems || []) {
    map.set(item.filePath, { kind: 'image', item });
  }
  return map;
}

function uniqueIssueKey(issue) {
  return issue.filePath || `${issue.category}:${issue.label}:${issue.message}`;
}

function buildProblemGroups(t, report) {
  if (!report) return [];
  const itemMap = buildItemMap(report);
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
      const itemEntry = issue.filePath ? itemMap.get(issue.filePath) : null;
      const allFileIssues = issue.filePath ? (issuesByFilePath(report).get(issue.filePath) || [issue]) : [issue];
      records.push({
        id: `${section.id}:${key}`,
        issue,
        issues: allFileIssues,
        sectionIssues: allFileIssues.filter((candidate) => section.match(candidate)),
        item: itemEntry?.item || null,
        kind: itemEntry?.kind || issue.category,
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
      Icon: CircleCheck,
      title: t('packChecker.summary.okTitle'),
      subtitle: t('packChecker.summary.okSubtitle'),
      listenCount,
      fixCount,
    };
  }
  if (hasBlocking) {
    return {
      tone: 'listen',
      Icon: TriangleAlert,
      title: t('packChecker.summary.blockingTitle'),
      subtitle: t('packChecker.summary.blockingSubtitle'),
      listenCount,
      fixCount,
    };
  }
  // Audio saturé : défaut de qualité que la correction ne résout pas → on ne
  // promet jamais « corrigeable en un clic », on conseille de repartir d'une
  // source propre.
  if (saturatedCount > 0) {
    return {
      tone: 'quality',
      Icon: TriangleAlert,
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
      Icon: Info,
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
    Icon: Wrench,
    title: t('packChecker.summary.fixTitle'),
    subtitle: t('packChecker.summary.fixSubtitle'),
    listenCount,
    fixCount,
  };
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

export function titleNeedsCorrection(report) {
  return (report?.titleSummary?.warnings || 0) > 0 || (report?.titleSummary?.errors || 0) > 0;
}

function SummaryTile({ title, Icon, tone = 'neutral', children }) {
  return (
    <div className={`checker-summary-tile checker-summary-tile--${tone}`}>
      <div className="checker-summary-tile-head">
        <IconFrame Icon={Icon} />
        <span>{title}</span>
      </div>
      {children}
    </div>
  );
}

function SplitStat({ t, ok, needsFix }) {
  return (
    <div className="checker-split-stat">
      <span className="checker-split-stat-ok"><strong>{ok}</strong> {t('packChecker.tiles.ok')}</span>
      <span className={`checker-split-stat-fix ${needsFix === 0 ? 'is-clean' : ''}`}>
        <strong>{needsFix}</strong> {t('packChecker.tiles.needsFix')}
      </span>
    </div>
  );
}

function SummaryTiles({ t, report, saturatedCount = 0 }) {
  const audio = categoryStats(report.audioSummary);
  const images = categoryStats(report.imageSummary);
  const title = categoryStats(report.titleSummary);
  const titleOk = title.total > 0 && title.needsFix === 0;
  const structureOk = report.structureSummary?.luniiCompatible && report.structureSummary?.storyStudioEditable;
  const nightMode = Boolean(report.nightMode?.detected);
  return (
    <div className="checker-summary-tiles" aria-label={t('packChecker.summary.ariaLabel')}>
      <SummaryTile title={t('packChecker.tiles.audio')} Icon={Music} tone={saturatedCount > 0 ? 'danger' : (audio.needsFix > 0 ? 'fix' : 'ok')}>
        <SplitStat t={t} ok={audio.ok} needsFix={audio.needsFix} />
      </SummaryTile>
      <SummaryTile title={t('packChecker.tiles.images')} Icon={Image} tone={images.needsFix ? 'fix' : 'ok'}>
        <SplitStat t={t} ok={images.ok} needsFix={images.needsFix} />
      </SummaryTile>
      <SummaryTile title={t('packChecker.tiles.packTitle')} Icon={FilePen} tone={titleOk ? 'ok' : 'fix'}>
        <div className="checker-single-stat">
          <strong>{titleOk ? t('packChecker.tiles.valid') : t('packChecker.tiles.toFix')}</strong>
          <span>{titleOk ? t('packChecker.tiles.conventionOk') : t('packChecker.tiles.metadata')}</span>
        </div>
      </SummaryTile>
      <SummaryTile title={t('packChecker.tiles.structure')} Icon={Network} tone={structureOk ? 'ok' : 'listen'}>
        <div className="checker-single-stat">
          <strong>{structureOk ? t('packChecker.tiles.correct') : t('packChecker.tiles.manualCheck')}</strong>
          <span>{t('packChecker.tiles.stagesCount', { count: report.structureSummary?.stageCount ?? 0 })}</span>
        </div>
      </SummaryTile>
      <SummaryTile title={t('packChecker.tiles.nightMode')} Icon={Moon} tone={nightMode ? 'ok' : 'neutral'}>
        <div className="checker-single-stat">
          <strong>{nightMode ? t('packChecker.tiles.available') : t('packChecker.tiles.absent')}</strong>
          <span>{nightMode ? t('packChecker.tiles.detectedInPack') : t('packChecker.tiles.nonBlocking')}</span>
        </div>
      </SummaryTile>
    </div>
  );
}

function TechnicalDetail({ t, record }) {
  const item = record.item;
  return (
    <div className="checker-tech-detail">
      <div>
        <div className="checker-tech-title">{t('packChecker.detail.measuresTitle')}</div>
        {record.kind === 'audio' ? (
          audioMeasureRows(t, item).map((row) => (
            <Measure
              key={row.key}
              label={row.label}
              value={row.value}
              status={hasMeasureIssue(record, row.key) ? 'bad' : 'ok'}
            />
          ))
        ) : record.kind === 'image' ? (
          <>
            {imageMeasureRows(t, item).map((row) => (
              <Measure
                key={row.key}
                label={row.label}
                value={row.value}
                status={hasMeasureIssue(record, row.key) ? 'bad' : 'ok'}
              />
            ))}
            <Measure label={t('packChecker.measures.expected')} value="320×240" status={expectedImageOk(item) ? 'ok' : 'bad'} />
          </>
        ) : (
          <Measure label={t('packChecker.measures.category')} value={record.issue.category} status={record.issue.severity === 'ok' ? 'ok' : 'bad'} />
        )}
      </div>
      <div>
        <div className="checker-tech-title">{t('packChecker.detail.actionsTitle')}</div>
        {record.issues.map((issue, index) => (
          <div className="checker-tech-action" key={`${issue.message}-${index}`}>
            <IconFrame Icon={issue.autoFixAvailable ? Wrench : Info} />
            <div>
              <strong>{issue.autoFixDescription || issue.message}</strong>
              {issue.technicalDetails ? <span>{issue.technicalDetails}</span> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniFile({ t, record, open, onToggle }) {
  const firstIssue = record.issue;
  const issueSummary = recordProblemSummary(t, record);
  return (
    <div className="checker-mini-file">
      <button type="button" className="checker-mini-file-button" onClick={onToggle}>
        <span className="checker-role">{roleLabel(t, record)}</span>
        <span className="checker-mini-name" title={firstIssue.filePath || firstIssue.label}>
          {cleanLabel(t, firstIssue.label)}
        </span>
        <span className="checker-mini-problem" title={issueSummary}>
          {issueSummary}
        </span>
        <span className={`checker-mini-severity checker-mini-severity--${firstIssue.severity}`}>
          {severityLabel(t, firstIssue.severity)}
        </span>
        <ChevronDown className={`checker-mini-chevron ${open ? 'is-open' : ''}`} aria-hidden="true" />
      </button>
      {open ? <TechnicalDetail t={t} record={record} /> : null}
    </div>
  );
}

function ProblemGroupCard({ t, group, expanded, onToggle, countValue = group.count, countLabel = null }) {
  const [openFile, setOpenFile] = useState(null);
  const Icon = group.Icon;
  const displayedCountLabel = countLabel || (countValue > 1 ? t('packChecker.common.fileOther') : t('packChecker.common.fileOne'));
  return (
    <div className={`checker-group checker-group--${group.bucket} checker-group--${group.id} ${expanded ? 'is-expanded' : ''}`}>
      <button type="button" className="checker-group-head" onClick={onToggle}>
        <span className="checker-group-icon"><IconFrame Icon={Icon} /></span>
        <span className="checker-group-copy">
          <span className="checker-group-title-row">
            <strong>{group.title}</strong>
            <span className="checker-group-badge">{group.badge}</span>
          </span>
          <span>{group.bucket === 'fix' ? group.action : group.explanation}</span>
        </span>
        <span className="checker-group-count">
          <strong>{countValue}</strong>
          <small>{displayedCountLabel}</small>
        </span>
        <ChevronDown className="checker-group-chevron" aria-hidden="true" />
      </button>
      {expanded ? (
        <div className="checker-group-body">
          <div className="checker-mini-list">
            {group.records.map((record) => (
              <MiniFile
                key={record.id}
                t={t}
                record={record}
                open={openFile === record.id}
                onToggle={() => setOpenFile(openFile === record.id ? null : record.id)}
              />
            ))}
          </div>
          {group.bucket === 'listen' ? (
            <div className="checker-group-help">
              <IconFrame Icon={Info} />
              {t('packChecker.groupHelp')}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function FixableCorrectionsList({ report }) {
  const { t } = useTranslation();
  const groups = useMemo(
    () => buildProblemGroups(t, report).filter((group) => group.bucket === 'fix'),
    [t, report],
  );

  if (!groups.length) {
    return (
      <div className="checker-empty checker-empty--success">
        <IconFrame Icon={Check} />
        {t('packChecker.emptyFixable')}
      </div>
    );
  }

  return (
    <div className="checker-groups checker-groups--preview">
      {groups.map((group) => (
        <ProblemGroupCard
          key={group.id}
          t={t}
          group={group}
          expanded
          onToggle={() => {}}
          countValue={group.fixCount}
          countLabel={group.fixCount > 1 ? t('packChecker.common.correctionOther') : t('packChecker.common.correctionOne')}
        />
      ))}
    </div>
  );
}

export function ReportView({ report, busy, canFix, onExportReport, onFixPack, onStartFix, showFixButton = true }) {
  const { t } = useTranslation();
  const groups = useMemo(() => buildProblemGroups(t, report), [t, report]);
  const summary = useMemo(() => summarizeGroups(t, groups, report), [t, groups, report]);
  const saturatedCount = useMemo(() => saturatedFileCount(groups), [groups]);
  const [expanded, setExpanded] = useState(groups[0]?.id || null);
  const [metadataOpen, setMetadataOpen] = useState(false);
  if (!report) return null;
  const SummaryIcon = summary.Icon;

  function startFixFlow() {
    if (onStartFix) {
      onStartFix();
      return;
    }
    setMetadataOpen(true);
  }

  return (
    <div className="checker-report">
      <div className={`checker-report-verdict checker-report-verdict--${summary.tone}`}>
        <span className="checker-report-orb"><IconFrame Icon={SummaryIcon} /></span>
        <div className="checker-report-copy">
          <div className="checker-pack-name" title={report.packName}>{report.packName}</div>
          <strong>{summary.title}</strong>
          <span>{summary.subtitle}</span>
        </div>
        <div className="checker-report-callout">
          <Info className="checker-icon" aria-hidden="true" />
          <span><strong>{summary.listenCount}</strong> {t('packChecker.summary.toListenLabel')} · <strong>{summary.fixCount}</strong> {t('packChecker.summary.proposedFixesLabel')}</span>
        </div>
      </div>

      <SummaryTiles t={t} report={report} saturatedCount={saturatedCount} />

      {groups.length === 0 ? (
        <div className="checker-empty checker-empty--success">
          <IconFrame Icon={Check} />
          {t('packChecker.emptyReport')}
        </div>
      ) : (
        <div className="checker-groups">
          {groups.map((group) => (
            <ProblemGroupCard
              key={group.id}
              t={t}
              group={group}
              expanded={expanded === group.id}
              onToggle={() => setExpanded(expanded === group.id ? null : group.id)}
            />
          ))}
        </div>
      )}

      <ConformingSection report={report} />

      <div className="checker-report-footer">
        <span>{t('packChecker.footer.correctionsReady', { count: summary.fixCount })}</span>
        <Button size="sm" onClick={() => onExportReport('report')}>
          <Download className="checker-button-icon" aria-hidden="true" />
          {t('packChecker.footer.exportReport')}
        </Button>
        {showFixButton ? (
          <button
            type="button"
            className="chrome-toolbar-cta checker-correction-cta"
            onClick={startFixFlow}
            disabled={!canFix || busy}
          >
            {busy ? t('packChecker.footer.correcting') : t('packChecker.footer.correctPack')}
          </button>
        ) : null}
      </div>

      {metadataOpen && !onStartFix ? (
        <CommunityPackMetadataModal
          report={report}
          busy={busy}
          onCancel={() => setMetadataOpen(false)}
          onSubmit={(metadataPatch) => {
            setMetadataOpen(false);
            onFixPack(metadataPatch);
          }}
        />
      ) : null}
    </div>
  );
}

export function TechnicalLog({ report, onCopyLog, onExportLog, onExportJson }) {
  const { t } = useTranslation();
  if (!report) return null;
  return (
    <details className="checker-log">
      <summary>{t('packChecker.technicalLog.summary')}</summary>
      <div className="checker-log-actions">
        <Button size="sm" onClick={onCopyLog}>{t('packChecker.technicalLog.copyLog')}</Button>
        <Button size="sm" onClick={() => onExportLog('log')}>{t('packChecker.technicalLog.exportLog')}</Button>
        <Button size="sm" onClick={() => onExportJson('json')}>{t('packChecker.technicalLog.exportJson')}</Button>
      </div>
      <pre>{(report.technicalLog || []).join('\n')}</pre>
    </details>
  );
}

export function ProcessLog({ status, lines }) {
  const { t } = useTranslation();
  const linesRef = useRef(null);
  useEffect(() => {
    const node = linesRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [lines]);

  if (!lines?.length) return null;
  const title = status === 'fixing'
    ? t('packChecker.processLog.fixing')
    : status === 'analyzing'
      ? t('packChecker.processLog.analyzing')
      : t('packChecker.processLog.idle');
  return (
    <div className={`checker-process-log ${status === 'idle' ? 'is-idle' : 'is-active'}`}>
      <div className="checker-process-log-head">
        {status !== 'idle' ? <IconFrame Icon={Loader2} /> : <IconFrame Icon={CircleCheck} />}
        <strong>{title}</strong>
      </div>
      <div className="checker-process-log-lines" ref={linesRef} aria-live="polite">
        {lines.map((line, index) => (
          <div key={`${index}-${line}`}>{line}</div>
        ))}
      </div>
    </div>
  );
}
