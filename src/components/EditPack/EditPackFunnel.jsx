import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  FunnelShell,
  FunnelSectionHeader,
  FunnelDropZone,
  FunnelToolButton,
  FunnelGenerationState,
} from '../funnels';
import { Eye, FolderOpen, Package, TriangleAlert, Undo2, Upload } from '../icons/LucideLocal';
import { pickFolder, pickZip } from '../../hooks/useFileDialog';
import { basename } from '../../utils/fileUtils';
import { KEYS, read as readSetting } from '../../store/persistentSettings';
import { useTranslation } from '../../i18n/I18nContext';

const ARCHIVE_RE = /\.(zip|7z)$/i;

/**
 * Funnel « Modifier un pack », monté sur le châssis commun des funnels.
 * Enchaîne, sans quitter l'overlay : zone de dépôt (fichier/dossier) →
 * vérification d'éditabilité → décompression in-funnel → l'éditeur s'ouvre avec
 * le pack décompressé. Si non éditable : proposition de simulation.
 *
 * @param {Object}   props
 * @param {Function} props.onClose
 * @param {Function} props.onLand     async ({ zipPath, packLabel }) — session +
 *   extraction + atterrissage éditeur. Lève en cas d'échec.
 * @param {Function} props.onSimulate async ({ zipPath, packLabel }) — ouvre le
 *   simulateur (lecture seule).
 */
export function EditPackFunnel({ onClose, onLand, onSimulate }) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState('collect'); // collect | busy | readOnly | unsupported
  const [busy, setBusy] = useState({ title: '', hint: '' });
  const [error, setError] = useState('');
  const [pending, setPending] = useState(null); // { zipPath, packLabel }
  const allowUnsupportedExtraction = readSetting(KEYS.ALLOW_UNSUPPORTED_PACK_EXTRACTION) === 'true';

  async function processPack(path, kind) {
    if (!path) return;
    setError('');
    setBusy({ title: t('shell.editPack.busyVerifyTitle'), hint: t('shell.editPack.busyVerifyHint') });
    setPhase('busy');
    try {
      const packLabel = basename(path);
      const isFolder = kind === 'folder' || (kind === 'auto' && !ARCHIVE_RE.test(path));
      const zipPath = isFolder
        ? await invoke('convert_folder_pack_to_zip', { folderPath: path })
        : path;
      const report = await invoke('classify_pack_editability', { zipPath });
      if (!report?.authoringEditable) {
        setPending({ zipPath, packLabel, report });
        setPhase(report?.readOnlyInspectable ? 'readOnly' : 'unsupported');
        return;
      }
      setBusy({ title: t('shell.editPack.busyExtractTitle'), hint: t('shell.editPack.busyExtractHint') });
      await onLand({ zipPath, packLabel });
      onClose();
    } catch (e) {
      setError(t('shell.editPack.errorOpenFailed', { message: e?.message ?? e }));
      setPhase('collect');
    }
  }

  const handleDrop = (paths) => processPack(paths?.[0], 'auto');
  const handleBrowseFile = async () => { const p = await pickZip(); if (p) processPack(p, 'file'); };
  const handleBrowseFolder = async () => { const p = await pickFolder(); if (p) processPack(p, 'folder'); };

  async function handleSimulate() {
    if (!pending) return;
    setBusy({ title: t('shell.editPack.busySimulateTitle'), hint: t('shell.editPack.busySimulateHint') });
    setPhase('busy');
    try {
      await onSimulate(pending);
      onClose();
    } catch (e) {
      setError(t('shell.editPack.errorSimulateFailed', { message: e?.message ?? e }));
      setPhase(pending?.report?.readOnlyInspectable ? 'readOnly' : 'unsupported');
    }
  }

  async function handleForceExtract() {
    if (!pending || !allowUnsupportedExtraction) return;
    setBusy({ title: t('shell.editPack.busyForceExtractTitle'), hint: t('shell.editPack.busyForceExtractHint') });
    setPhase('busy');
    try {
      await onLand({ ...pending, allowUnsupported: true });
      onClose();
    } catch (e) {
      setError(t('shell.editPack.errorForceExtractFailed', { message: e?.message ?? e }));
      setPhase(pending?.report?.readOnlyInspectable ? 'readOnly' : 'unsupported');
    }
  }

  return (
    <FunnelShell
      icon={<Package />}
      title={t('shell.editPack.title')}
      onClose={onClose}
      showChrome={false}
      fitContent
      ariaLabel={t('shell.editPack.title')}
    >
      {phase === 'busy' && <FunnelGenerationState title={busy.title} hint={busy.hint} />}

      {phase === 'collect' && (
        <div className="funnel-step-content">
          <FunnelSectionHeader
            icon={<Upload />}
            title={t('shell.editPack.collectSectionTitle')}
            description={t('shell.editPack.collectSectionDescription')}
          />
          <FunnelDropZone
            title={t('shell.editPack.dropzoneTitle')}
            hint={t('shell.editPack.dropzoneHint')}
            onFiles={handleDrop}
          >
            <FunnelToolButton icon={<Package />} accent="neutral" onClick={handleBrowseFile}>
              {t('shell.editPack.importZipButton')}
            </FunnelToolButton>
            <FunnelToolButton icon={<FolderOpen />} accent="neutral" onClick={handleBrowseFolder}>
              {t('shell.editPack.importFolderButton')}
            </FunnelToolButton>
          </FunnelDropZone>
          {error && <div className="funnel-error" role="alert">{error}</div>}
        </div>
      )}

      {phase === 'readOnly' && (
        <div className="funnel-step-content">
          <FunnelSectionHeader
            icon={<TriangleAlert />}
            title={t('shell.editPack.readOnlyTitle')}
            description={allowUnsupportedExtraction
              ? t('shell.editPack.readOnlyDescriptionWithAdvanced')
              : t('shell.editPack.readOnlyDescriptionDefault')}
          />
          {pending?.report?.reason && (
            <div className="funnel-error" role="status">{pending.report.reason}</div>
          )}
          {!allowUnsupportedExtraction && (
            <div className="funnel-warning" role="status">
              {t('shell.editPack.advancedHint')}
            </div>
          )}
          <div className="funnel-dropzone-actions" style={{ justifyContent: 'flex-start' }}>
            {allowUnsupportedExtraction && (
              <FunnelToolButton icon={<TriangleAlert />} accent="neutral" onClick={handleForceExtract}>
                {t('shell.editPack.forceExtractButton')}
              </FunnelToolButton>
            )}
            <FunnelToolButton icon={<Eye />} accent="violet" variant="solid" onClick={handleSimulate}>
              {t('shell.editPack.simulateButton')}
            </FunnelToolButton>
            <FunnelToolButton
              icon={<Undo2 />}
              accent="neutral"
              onClick={() => { setPending(null); setError(''); setPhase('collect'); }}
            >
              {t('shell.editPack.chooseAnotherButton')}
            </FunnelToolButton>
          </div>
        </div>
      )}

      {phase === 'unsupported' && (
        <div className="funnel-step-content">
          <FunnelSectionHeader
            icon={<TriangleAlert />}
            title={t('shell.editPack.unsupportedTitle')}
            description={allowUnsupportedExtraction
              ? t('shell.editPack.unsupportedDescriptionWithAdvanced')
              : t('shell.editPack.unsupportedDescriptionDefault')}
          />
          {pending?.report?.reason && (
            <div className="funnel-error" role="status">{pending.report.reason}</div>
          )}
          {!allowUnsupportedExtraction && (
            <div className="funnel-warning" role="status">
              {t('shell.editPack.advancedHint')}
            </div>
          )}
          <div className="funnel-dropzone-actions" style={{ justifyContent: 'flex-start' }}>
            {allowUnsupportedExtraction && (
              <FunnelToolButton icon={<TriangleAlert />} accent="neutral" onClick={handleForceExtract}>
                {t('shell.editPack.attemptExtractButton')}
              </FunnelToolButton>
            )}
            <FunnelToolButton
              icon={<Undo2 />}
              accent="neutral"
              onClick={() => { setPending(null); setError(''); setPhase('collect'); }}
            >
              {t('shell.editPack.chooseAnotherButton')}
            </FunnelToolButton>
          </div>
        </div>
      )}
    </FunnelShell>
  );
}
