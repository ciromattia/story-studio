import { useEffect, useMemo, useState } from 'react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { exists, readDir } from '@tauri-apps/plugin-fs';
import { AppModalPortal } from '../common/AppModalPortal';
import { useTranslation } from '../../i18n/I18nContext';
import {
  Check,
  ChevronDown,
  CircleX,
  FolderOpen,
  Link2,
  Loader2,
  Search,
  TriangleAlert,
  X,
} from '../icons/LucideLocal';
import { basename, dirname, joinPath, pathKey } from '../../utils/fileUtils';
import { candidatePathsForRelinkRoot, mediaKindFromPath } from '../../store/missingMediaRelink';
import './MissingMediaRelinkModal.css';

const MAX_SCAN_FILES = 12000;

function buildInitialRows(missingMedia) {
  return missingMedia.map((item) => ({
    ...item,
    status: 'missing',
    replacementPath: '',
    matches: [],
  }));
}

function isResolved(row) {
  return row.status === 'found' && Boolean(row.replacementPath);
}

// Coupe le nom à la dernière extension pour styliser celle-ci à part.
function splitFileName(fileName) {
  const name = String(fileName || '');
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return [name, ''];
  return [name.slice(0, dot), name.slice(dot)];
}

function rowMeta(row, t) {
  if (isResolved(row)) return t('storySettings.relink.statusResolved');
  if (row.status === 'ambiguous') {
    const count = row.matches.length;
    return t(count === 1 ? 'storySettings.relink.statusAmbiguousOne' : 'storySettings.relink.statusAmbiguousOther', { count });
  }
  const labels = row.labels ?? [];
  if (labels.length === 0) return t('storySettings.relink.statusMissing');
  const extra = labels.length > 2 ? t('storySettings.relink.extraLabelsSuffix', { count: labels.length - 2 }) : '';
  return `${labels.slice(0, 2).join(' · ')}${extra}`;
}

async function findFirstExisting(candidates) {
  for (const candidate of candidates) {
    if (await exists(candidate)) return candidate;
  }
  return null;
}

async function scanFolderByName(rootDir, wantedNames) {
  const wanted = new Set([...wantedNames].map((name) => String(name).toLowerCase()));
  const matches = new Map([...wanted].map((name) => [name, []]));
  let scanned = 0;

  async function walk(dir) {
    if (scanned >= MAX_SCAN_FILES) return;
    let entries = [];
    try {
      entries = await readDir(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = joinPath(dir, entry.name);
      if (entry.isDirectory) {
        await walk(fullPath);
        if (scanned >= MAX_SCAN_FILES) return;
        continue;
      }
      if (!entry.isFile && entry.children == null) continue;
      scanned += 1;
      const key = String(entry.name || basename(fullPath)).toLowerCase();
      if (wanted.has(key)) matches.get(key).push(fullPath);
      if (scanned >= MAX_SCAN_FILES) return;
    }
  }

  await walk(rootDir);
  return { matches, scanned, truncated: scanned >= MAX_SCAN_FILES };
}

function mergeResolvedRows(rows, resolvedByPath) {
  return rows.map((row) => {
    const resolved = resolvedByPath.get(pathKey(row.path));
    if (!resolved) return row;
    return { ...row, ...resolved };
  });
}

// Rôle représentatif d'un groupe : préfixes distincts des libellés (avant « : »).
function groupRoleSummary(rows) {
  const roles = new Set();
  for (const row of rows) {
    for (const label of row.labels ?? []) {
      const role = String(label).split(':')[0].trim();
      if (role) roles.add(role);
    }
  }
  const list = [...roles];
  if (list.length === 0) return '';
  if (list.length === 1) return list[0];
  return `${list[0]} +${list.length - 1}`;
}

// Regroupe les médias par dossier d'origine, en préservant l'ordre des lignes.
function groupRowsByFolder(rows) {
  const groups = new Map();
  for (const row of rows) {
    const dir = dirname(row.path) || row.path;
    const key = pathKey(dir);
    let group = groups.get(key);
    if (!group) {
      group = { key, dir, rows: [] };
      groups.set(key, group);
    }
    group.rows.push(row);
  }
  return [...groups.values()];
}

function rowMatchesQuery(row, query) {
  if (!query) return true;
  const haystack = `${row.fileName} ${row.path} ${(row.labels ?? []).join(' ')}`.toLowerCase();
  return haystack.includes(query);
}

function rowMatchesFilter(row, filter) {
  if (filter === 'resolved') return isResolved(row);
  if (filter === 'remaining') return !isResolved(row);
  return true;
}

export function MissingMediaRelinkModal({ missingMedia, workspaceDir = '', onApply, onClose }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState(() => buildInitialRows(missingMedia));
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [scanningKey, setScanningKey] = useState('');
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    setRows(buildInitialRows(missingMedia));
    setQuery('');
    setFilter('all');
    setCollapsed(new Set());
  }, [missingMedia]);

  const total = rows.length;
  const resolvedRows = useMemo(() => rows.filter(isResolved), [rows]);
  const resolvedCount = resolvedRows.length;
  const remainingCount = total - resolvedCount;
  const replacements = useMemo(() => Object.fromEntries(
    resolvedRows.map((row) => [row.path, row.replacementPath]),
  ), [resolvedRows]);

  const groups = useMemo(() => groupRowsByFolder(rows), [rows]);
  const normalizedQuery = query.trim().toLowerCase();

  const visibleGroups = useMemo(() => (
    groups
      .map((group) => ({
        ...group,
        visibleRows: group.rows.filter(
          (row) => rowMatchesQuery(row, normalizedQuery) && rowMatchesFilter(row, filter),
        ),
      }))
      .filter((group) => group.visibleRows.length > 0)
  ), [groups, normalizedQuery, filter]);

  async function runFolderScan(folder, targetRows) {
    const directResolved = new Map();
    const unresolved = [];
    for (const row of targetRows) {
      const direct = await findFirstExisting(candidatePathsForRelinkRoot(row.path, folder));
      if (direct) {
        directResolved.set(pathKey(row.path), {
          status: 'found',
          replacementPath: direct,
          matches: [direct],
        });
      } else {
        unresolved.push(row);
      }
    }

    const resolved = new Map(directResolved);
    if (unresolved.length > 0) {
      const names = new Set(unresolved.map((row) => row.fileName));
      const scanResult = await scanFolderByName(folder, names);
      for (const row of unresolved) {
        const rowMatches = scanResult.matches.get(row.fileName.toLowerCase()) ?? [];
        if (rowMatches.length === 1) {
          resolved.set(pathKey(row.path), { status: 'found', replacementPath: rowMatches[0], matches: rowMatches });
        } else if (rowMatches.length > 1) {
          resolved.set(pathKey(row.path), { status: 'ambiguous', replacementPath: '', matches: rowMatches });
        } else {
          resolved.set(pathKey(row.path), { status: 'missing', replacementPath: '', matches: [] });
        }
      }
    }
    setRows((current) => mergeResolvedRows(current, resolved));
  }

  async function handleChooseGroupFolder(group) {
    if (scanningKey || applying) return;
    const folder = await openDialog({
      directory: true,
      multiple: false,
      title: t('storySettings.relink.chooseGroupFolderDialogTitle'),
      defaultPath: group.dir || workspaceDir || dirname(group.rows[0]?.path),
    });
    if (!folder) return;
    setScanningKey(group.key);
    try {
      await runFolderScan(folder, group.rows);
    } finally {
      setScanningKey('');
    }
  }

  async function handleScanWorkspace() {
    if (!workspaceDir || scanningKey || applying) return;
    setScanningKey('__workspace__');
    try {
      await runFolderScan(workspaceDir, rows);
    } finally {
      setScanningKey('');
    }
  }

  async function handleChooseFile(row) {
    if (applying) return;
    const file = await openDialog({
      multiple: false,
      title: t('storySettings.relink.chooseFileDialogTitle', { fileName: row.fileName }),
      defaultPath: dirname(row.path) || workspaceDir,
    });
    if (!file) return;
    setRows((current) => current.map((item) => (
      pathKey(item.path) === pathKey(row.path)
        ? { ...item, status: 'found', replacementPath: file, matches: [file], kind: mediaKindFromPath(file) }
        : item
    )));
  }

  function handleAmbiguousChoice(row, value) {
    setRows((current) => current.map((item) => (
      pathKey(item.path) === pathKey(row.path)
        ? { ...item, status: value ? 'found' : 'ambiguous', replacementPath: value }
        : item
    )));
  }

  function toggleGroup(key) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleApply() {
    if (resolvedCount === 0 || applying) return;
    setApplying(true);
    try {
      await onApply(replacements, { saveAfter: true });
    } finally {
      setApplying(false);
    }
  }

  const progressPct = total === 0 ? 0 : Math.round((resolvedCount / total) * 100);

  return (
    <AppModalPortal>
      <div className="relink-modal" role="dialog" aria-label={t('storySettings.relink.ariaLabel')} onClick={(event) => event.stopPropagation()}>
        <header className="relink-head">
          <span className="relink-head-icon"><Link2 /></span>
          <span className="relink-head-title">{t('storySettings.relink.title')}</span>
          <span className="relink-head-count">
            {remainingCount > 0
              ? t(remainingCount === 1 ? 'storySettings.relink.remainingCountOne' : 'storySettings.relink.remainingCountOther', { count: remainingCount })
              : t('storySettings.relink.allLinked')}
          </span>
          <span className="relink-spacer" />
          <button type="button" className="relink-icon-btn" aria-label={t('storySettings.relink.closeAriaLabel')} onClick={onClose} disabled={applying}>
            <X />
          </button>
        </header>

        <div className="relink-subhead">
          <div className="relink-progress">
            <span className="relink-progress-label">
              <b>{resolvedCount}</b> {t('storySettings.relink.progressSeparator')} <b>{total}</b>
            </span>
            <div className="relink-bar"><div className="relink-bar-fill" style={{ width: `${progressPct}%` }} /></div>
          </div>
          <div className="relink-toolbar">
            <label className="relink-search">
              <Search />
              <input
                type="text"
                placeholder={t('storySettings.relink.filterPlaceholder')}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <div className="relink-segmented" role="group" aria-label={t('storySettings.relink.filterGroupAriaLabel')}>
              <button type="button" className="relink-seg" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
                {t('storySettings.relink.filterAll')} <span className="relink-seg-n">{total}</span>
              </button>
              <button type="button" className="relink-seg" aria-pressed={filter === 'remaining'} onClick={() => setFilter('remaining')}>
                {t('storySettings.relink.filterRemaining')} <span className="relink-seg-n">{remainingCount}</span>
              </button>
              <button type="button" className="relink-seg" aria-pressed={filter === 'resolved'} onClick={() => setFilter('resolved')}>
                {t('storySettings.relink.filterResolved')} <span className="relink-seg-n">{resolvedCount}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="relink-scroll">
          {visibleGroups.length === 0 && (
            <div className="relink-empty">
              <Search />
              <span>{t('storySettings.relink.emptyFilterMessage')}</span>
            </div>
          )}

          {visibleGroups.map((group) => {
            const groupRemaining = group.rows.filter((row) => !isResolved(row)).length;
            const groupResolved = groupRemaining === 0;
            const isCollapsed = collapsed.has(group.key);
            const isScanning = scanningKey === group.key;
            const groupRole = groupRoleSummary(group.rows);
            return (
              <div
                key={group.key}
                className={`relink-group${groupResolved ? ' is-resolved' : ''}${isCollapsed ? ' is-collapsed' : ''}`}
              >
                <div className="relink-ghead">
                  <button
                    type="button"
                    className="relink-ghead-chev"
                    aria-label={isCollapsed ? t('storySettings.relink.expandAriaLabel') : t('storySettings.relink.collapseAriaLabel')}
                    onClick={() => toggleGroup(group.key)}
                  >
                    <ChevronDown />
                  </button>
                  <span className="relink-ghead-icon">{groupResolved ? <Check /> : <FolderOpen />}</span>
                  <div className="relink-ghead-main">
                    <div className="relink-ghead-path" title={group.dir}>{group.dir}</div>
                    <div className="relink-ghead-sub">
                      {groupResolved
                        ? t(group.rows.length === 1 ? 'storySettings.relink.groupResolvedCountOne' : 'storySettings.relink.groupResolvedCountOther', { count: group.rows.length })
                        : t(groupRemaining === 1 ? 'storySettings.relink.groupMissingCountOne' : 'storySettings.relink.groupMissingCountOther', { count: groupRemaining })}
                      {groupRole && ` · ${groupRole}`}
                    </div>
                  </div>
                  {group.rows.length > 1 && (
                    <button
                      type="button"
                      className="relink-gbtn"
                      onClick={() => handleChooseGroupFolder(group)}
                      disabled={Boolean(scanningKey) || applying}
                    >
                      {isScanning ? <Loader2 className="relink-spin" /> : <FolderOpen />}
                      {groupResolved ? t('storySettings.relink.editFolderButton') : t('storySettings.relink.chooseFolderButton')}
                    </button>
                  )}
                </div>

                <div className="relink-glist">
                  {group.visibleRows.map((row) => {
                    const resolved = isResolved(row);
                    const [base, ext] = splitFileName(row.fileName);
                    return (
                      <div className={`relink-row is-${row.status}`} key={row.path}>
                        <span className="relink-row-orb">
                          {resolved ? <Check /> : row.status === 'ambiguous' ? <TriangleAlert /> : <CircleX />}
                        </span>
                        <div className="relink-row-main">
                          <div className="relink-row-name" title={row.path}>
                            {base}<span className="relink-row-ext">{ext}</span>
                          </div>
                          <div className="relink-row-meta">
                            <span className="relink-kind">{row.kind}</span>
                            <span title={resolved ? row.replacementPath : undefined}>{rowMeta(row, t)}</span>
                          </div>
                        </div>
                        {!resolved && (
                          <div className="relink-row-actions">
                            {row.status === 'ambiguous' && (
                              <select
                                className="relink-row-select"
                                value={row.replacementPath}
                                onChange={(event) => handleAmbiguousChoice(row, event.target.value)}
                                disabled={applying}
                              >
                                <option value="">{t('storySettings.relink.chooseOptionPlaceholder')}</option>
                                {row.matches.map((match) => (
                                  <option key={match} value={match}>{match}</option>
                                ))}
                              </select>
                            )}
                            <button
                              type="button"
                              className="relink-row-cta"
                              onClick={() => handleChooseFile(row)}
                              disabled={applying}
                            >
                              {t('storySettings.relink.chooseButton')}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <footer className="relink-foot">
          <button type="button" className="relink-btn relink-btn-ghost" onClick={onClose} disabled={applying}>
            {t('storySettings.relink.dismissAllButton')}
          </button>
          {workspaceDir && (
            <button
              type="button"
              className="relink-btn relink-btn-ghost"
              onClick={handleScanWorkspace}
              disabled={Boolean(scanningKey) || applying}
              title={workspaceDir}
            >
              {scanningKey === '__workspace__' ? <Loader2 className="relink-spin" /> : <FolderOpen />}
              {t('storySettings.relink.searchWorkspaceButton')}
            </button>
          )}
          <span className="relink-spacer" />
          <span className="relink-foot-status"><b>{resolvedCount}</b> / {total} {t('storySettings.relink.readyToApplyLabel')}</span>
          <button
            type="button"
            className="relink-btn relink-btn-primary"
            onClick={handleApply}
            disabled={resolvedCount === 0 || applying}
          >
            {applying && <Loader2 className="relink-spin" />}
            {applying ? t('storySettings.relink.applyingButton') : t('storySettings.relink.applyButton')}
          </button>
        </footer>
      </div>
    </AppModalPortal>
  );
}
