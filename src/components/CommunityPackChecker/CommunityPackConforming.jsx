// Section « Ce qui est conforme » : miroir vert des cartes de problemes.
// Toute la donnee vient deja du rapport (report.audioItems / imageItems avec
// leur `status`, et les resumes pack-level) : aucun appel backend.

import { useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  FilePen,
  Image,
  Moon,
  Music,
  Network,
} from '../icons/LucideLocal';
import {
  Measure,
  audioMeasureRows,
  cleanLabel,
  formatLufs,
  formatSeconds,
  imageMeasureRows,
  isConforming,
  structureConforming,
  titleConforming,
} from './packCheckerMeasures';
import { useTranslation } from '../../i18n/I18nContext';

function IconFrame({ Icon }) {
  return <Icon className="checker-icon" aria-hidden="true" strokeWidth={2} absoluteStrokeWidth />;
}

function fileSummary(t, kind, item) {
  if (kind === 'audio') {
    return `${formatSeconds(t, item.leadingSilenceSecs)} / ${formatSeconds(t, item.trailingSilenceSecs)} · ${formatLufs(t, item.integratedLufs)}`;
  }
  const dimensions = item.width && item.height ? `${item.width}×${item.height}` : t('packChecker.measures.dimensionsUnknown');
  return `${dimensions} · ${item.format || t('packChecker.measures.formatUnknown')}`;
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
      Icon: Music,
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
      Icon: Image,
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
      Icon: FilePen,
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
      Icon: Network,
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
    Icon: Moon,
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

function ConformingMeasures({ rows, title }) {
  return (
    <div className="checker-tech-detail checker-tech-detail--facts">
      <div>
        <div className="checker-tech-title">{title}</div>
        {rows.map((row) => (
          <Measure key={row.key} label={row.label} value={row.value} status="ok" />
        ))}
      </div>
    </div>
  );
}

function ConformingFile({ t, kind, item, open, onToggle }) {
  const rows = kind === 'audio'
    ? audioMeasureRows(t, item)
    : [...imageMeasureRows(t, item), { key: 'expected', label: t('packChecker.measures.expected'), value: '320×240' }];
  const summary = fileSummary(t, kind, item);
  return (
    <div className="checker-mini-file">
      <button type="button" className="checker-mini-file-button" onClick={onToggle}>
        <span className="checker-role">{kind === 'audio' ? t('packChecker.common.roleAudio') : t('packChecker.common.roleImage')}</span>
        <span className="checker-mini-name" title={item.filePath || item.label}>{cleanLabel(t, item.label)}</span>
        <span className="checker-mini-problem" title={summary}>{summary}</span>
        <span className="checker-mini-severity checker-mini-severity--ok">{t('packChecker.common.severityOk')}</span>
        <ChevronDown className={`checker-mini-chevron ${open ? 'is-open' : ''}`} aria-hidden="true" />
      </button>
      {open ? <ConformingMeasures rows={rows} title={t('packChecker.detail.measuresTitle')} /> : null}
    </div>
  );
}

function ConformingGroupCard({ t, group, expanded, onToggle }) {
  const [openFile, setOpenFile] = useState(null);
  const Icon = group.Icon;
  return (
    <div className={`checker-group checker-group--ok checker-group--${group.id} ${expanded ? 'is-expanded' : ''}`}>
      <button type="button" className="checker-group-head" onClick={onToggle}>
        <span className="checker-group-icon"><IconFrame Icon={Icon} /></span>
        <span className="checker-group-copy">
          <span className="checker-group-title-row">
            <strong>{group.title}</strong>
            <span className="checker-group-badge">{t('packChecker.conforming.badge')}</span>
          </span>
          <span>{group.subtitle}</span>
        </span>
        <span className="checker-group-count">
          <strong>{group.metricStrong}</strong>
          <small>{group.metricSmall}</small>
        </span>
        <ChevronDown className="checker-group-chevron" aria-hidden="true" />
      </button>
      {expanded ? (
        <div className="checker-group-body">
          {group.mode === 'files' ? (
            <div className="checker-mini-list">
              {group.files.map((item) => {
                const fileId = item.filePath || item.label;
                return (
                  <ConformingFile
                    key={fileId}
                    t={t}
                    kind={group.kind}
                    item={item}
                    open={openFile === fileId}
                    onToggle={() => setOpenFile(openFile === fileId ? null : fileId)}
                  />
                );
              })}
            </div>
          ) : (
            <ConformingMeasures rows={group.facts} title={t('packChecker.detail.detailsTitle')} />
          )}
        </div>
      ) : null}
    </div>
  );
}

export function ConformingSection({ report }) {
  const { t } = useTranslation();
  const groups = useMemo(() => buildConformingGroups(t, report), [t, report]);
  const [expanded, setExpanded] = useState(null);
  if (!groups.length) return null;
  return (
    <div className="checker-conform">
      <div className="checker-conform-head">
        <IconFrame Icon={Check} />
        {t('packChecker.conforming.heading')}
      </div>
      <div className="checker-groups">
        {groups.map((group) => (
          <ConformingGroupCard
            key={group.id}
            t={t}
            group={group}
            expanded={expanded === group.id}
            onToggle={() => setExpanded(expanded === group.id ? null : group.id)}
          />
        ))}
      </div>
    </div>
  );
}
