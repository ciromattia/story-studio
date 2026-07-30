import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open, save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { openPath } from '@tauri-apps/plugin-opener';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  formatDiagnosticJson,
  formatHtmlReport,
  formatReadableReport,
  formatTechnicalLog,
  reportBaseName,
} from './communityPackExports';
import { isTauriRuntime } from '../../utils/tauriRuntime';
import { useTranslation } from '../../i18n/I18nContext';

function buildExports(t) {
  return {
    report: {
      extension: 'html',
      label: t('packChecker.hook.exportLabelReport'),
      filter: { name: t('packChecker.hook.filterReport'), extensions: ['html'] },
      content: (report) => formatHtmlReport(report, t),
    },
    markdown: {
      extension: 'md',
      label: t('packChecker.hook.exportLabelMarkdown'),
      filter: { name: t('packChecker.hook.filterMarkdown'), extensions: ['md'] },
      content: (report) => formatReadableReport(report, t),
    },
    log: {
      extension: 'txt',
      label: t('packChecker.hook.exportLabelLog'),
      filter: { name: t('packChecker.hook.filterLog'), extensions: ['txt'] },
      content: formatTechnicalLog,
    },
    json: {
      extension: 'json',
      label: t('packChecker.hook.exportLabelJson'),
      filter: { name: t('packChecker.hook.filterJson'), extensions: ['json'] },
      content: formatDiagnosticJson,
    },
  };
}

export function useCommunityPackChecker() {
  const { t } = useTranslation();
  const EXPORTS = useMemo(() => buildExports(t), [t]);
  const [zipPath, setZipPath] = useState('');
  const [report, setReport] = useState(null);
  const [fixedResult, setFixedResult] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [exportNotice, setExportNotice] = useState('');
  const [liveLog, setLiveLog] = useState([]);
  const statusRef = useRef(status);

  const appendLiveLog = useCallback((line) => {
    if (!line) return;
    setLiveLog((current) => [...current, line].slice(-10));
  }, []);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (!isTauriRuntime()) return undefined;
    let cancelled = false;
    let unlisten = null;
    listen('community-pack-checker-log', (event) => {
      if (statusRef.current !== 'analyzing' && statusRef.current !== 'fixing') return;
      appendLiveLog(String(event.payload || ''));
    }).then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    });
    return () => {
      cancelled = true;
      if (unlisten) unlisten();
    };
  }, [appendLiveLog]);

  const analyzePath = useCallback(async (path, options = {}) => {
    const nextPath = String(path || '').trim();
    if (!nextPath) return null;
    setZipPath(nextPath);
    setFixedResult(null);
    setError('');
    setExportNotice('');
    statusRef.current = 'analyzing';
    setStatus('analyzing');
    if (options.appendLog) {
      appendLiveLog(options.label || t('packChecker.hook.reanalyzeRequested'));
    } else {
      setLiveLog([t('packChecker.hook.analyzeRequested')]);
    }
    try {
      const nextReport = await invoke('analyze_community_pack', {
        zipPath: nextPath,
      });
      setReport(nextReport);
      const finalLines = (nextReport?.technicalLog || []).slice(-3);
      setLiveLog((current) => [
        ...current,
        ...finalLines,
        t('packChecker.hook.analyzeComplete'),
      ].slice(-9));
      statusRef.current = 'idle';
      setStatus('idle');
      return nextReport;
    } catch (err) {
      appendLiveLog(t('packChecker.hook.analyzeInterrupted', { error: err }));
      setError(String(err));
      statusRef.current = 'idle';
      setStatus('idle');
      return null;
    }
  }, [appendLiveLog, t]);

  const pickPack = useCallback(async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: t('packChecker.funnel.pickPackFilter'), extensions: ['zip', '7z'] }],
    });
    if (selected) {
      await analyzePath(Array.isArray(selected) ? selected[0] : selected);
    }
  }, [analyzePath, t]);

  const fixPack = useCallback(async (metadataPatch = null, options = {}) => {
    if (!zipPath) return null;
    setError('');
    setExportNotice('');
    statusRef.current = 'fixing';
    setStatus('fixing');
    setLiveLog([t('packChecker.hook.fixRequested')]);
    try {
      const result = await invoke('create_fixed_community_pack', {
        zipPath,
        outputDir: options.outputDir || null,
        metadataPatch,
      });
      appendLiveLog(t('packChecker.hook.fixedZipCreated', { path: result.fixedZipPath }));
      appendLiveLog(t('packChecker.hook.reanalyzingFixed'));
      // La réanalyse réinitialise fixedResult (via analyzePath) : on positionne
      // donc le résultat APRÈS, pour que la bannière « ZIP corrigé » persiste.
      await analyzePath(result.fixedZipPath, {
        appendLog: true,
        label: t('packChecker.hook.analyzingFixedZip'),
      });
      setFixedResult(result);
      statusRef.current = 'idle';
      setStatus('idle');
      return result;
    } catch (err) {
      appendLiveLog(t('packChecker.hook.fixInterrupted', { error: err }));
      setError(String(err));
      statusRef.current = 'idle';
      setStatus('idle');
      return null;
    }
  }, [analyzePath, appendLiveLog, zipPath, t]);

  const exportReport = useCallback(async (kind) => {
    if (!report || !EXPORTS[kind]) return;
    const config = EXPORTS[kind];
    const defaultName = `${reportBaseName(report)} - ${kind}.${config.extension}`;
    const target = await save({
      defaultPath: defaultName,
      filters: [config.filter],
    });
    if (!target) return;
    try {
      await writeTextFile(target, config.content(report));
      setExportNotice(t('packChecker.hook.exported', { label: config.label }));
    } catch (err) {
      setError(t('packChecker.hook.exportFailed', { error: err }));
    }
  }, [report, EXPORTS, t]);

  const copyLog = useCallback(async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(formatTechnicalLog(report));
      setExportNotice(t('packChecker.hook.logCopied'));
    } catch {
      setError(t('packChecker.hook.logCopyFailed'));
    }
  }, [report, t]);

  const openFixedLocation = useCallback(async () => {
    if (!fixedResult?.fixedZipPath) return;
    try {
      await openPath(fixedResult.fixedZipPath);
    } catch (err) {
      setError(t('packChecker.hook.openFixedFailed', { error: err }));
    }
  }, [fixedResult, t]);

  return {
    zipPath,
    report,
    fixedResult,
    status,
    error,
    exportNotice,
    liveLog,
    analyzePath,
    pickPack,
    fixPack,
    exportReport,
    copyLog,
    openFixedLocation,
  };
}
