import { useMemo, useState } from 'react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { openPath } from '@tauri-apps/plugin-opener';
import {
  FunnelDoneState,
  FunnelDropZone,
  FunnelFooter,
  FunnelGenerationState,
  FunnelSectionHeader,
  FunnelShell,
  FunnelStepper,
  FunnelToolButton,
} from '../funnels';
import { CommunityPackMetadataModal } from './CommunityPackMetadataModal';
import {
  FixableCorrectionsList,
  ProcessLog,
  ReportView,
  TechnicalLog,
  titleNeedsCorrection,
} from './CommunityPackChecker';
import { useCommunityPackChecker } from './useCommunityPackChecker';
import { Download, FolderOpen, House, Package, TriangleAlert, Wrench } from '../icons/LucideLocal';
import { getLastExportDir, saveLastExportDir } from '../../hooks/useFileDialog';
import { basename } from '../../utils/fileUtils';
import { useTranslation } from '../../i18n/I18nContext';
import './CommunityPackChecker.css';
import './CommunityPackCheckerFunnel.css';

function buildSteps(t) {
  return [
    { key: 'pack', label: t('packChecker.funnel.stepPack') },
    { key: 'report', label: t('packChecker.funnel.stepReport') },
    { key: 'output', label: t('packChecker.funnel.stepOutput') },
  ];
}

function latestLine(lines) {
  return lines?.length ? lines[lines.length - 1] : '';
}

function correctionCount(t, result) {
  if (!result) return '';
  const parts = [];
  if (result.audioFixed) parts.push(t('packChecker.funnel.audioFixed', { count: result.audioFixed }));
  if (result.imageFixed) {
    parts.push(result.imageFixed > 1
      ? t('packChecker.funnel.imageFixedOther', { count: result.imageFixed })
      : t('packChecker.funnel.imageFixedOne', { count: result.imageFixed }));
  }
  if (result.metadataFixed) parts.push(t('packChecker.funnel.metadataFixed'));
  return parts.length ? parts.join(' · ') : t('packChecker.funnel.packFixedFallback');
}

export function CommunityPackCheckerFunnel({ onClose }) {
  const { t } = useTranslation();
  const steps = useMemo(() => buildSteps(t), [t]);
  const checker = useCommunityPackChecker();
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState('collect');
  const [outputDir, setOutputDir] = useState(() => getLastExportDir() || '');
  const [metadataOpen, setMetadataOpen] = useState(false);
  const [result, setResult] = useState(null);
  const [localError, setLocalError] = useState('');

  const busy = phase === 'analyzing' || phase === 'fixing' || checker.status === 'analyzing' || checker.status === 'fixing';
  const canFix = useMemo(() => (
    (checker.report?.correctionsAvailable > 0 || titleNeedsCorrection(checker.report))
    && !busy
  ), [checker.report, busy]);
  const needsMetadata = titleNeedsCorrection(checker.report);
  const canOpenReport = !!checker.report;
  const canOpenCorrection = canOpenReport && canFix;
  const error = localError || checker.error;

  async function analyzePath(path) {
    const selected = String(path || '').trim();
    if (!selected) return;
    setLocalError('');
    setResult(null);
    setPhase('analyzing');
    const report = await checker.analyzePath(selected);
    setPhase('collect');
    if (report) setStep(1);
  }

  async function pickPack() {
    const selected = await openDialog({
      multiple: false,
      title: t('packChecker.funnel.pickPackTitle'),
      filters: [{ name: t('packChecker.funnel.pickPackFilter'), extensions: ['zip', '7z'] }],
    });
    if (selected) await analyzePath(Array.isArray(selected) ? selected[0] : selected);
  }

  async function chooseOutputDir() {
    const selected = await openDialog({
      directory: true,
      multiple: false,
      title: t('packChecker.funnel.outputDirTitle'),
      defaultPath: outputDir || getLastExportDir() || undefined,
    });
    const nextOutputDir = Array.isArray(selected) ? selected[0] : selected;
    if (!nextOutputDir) return null;
    setOutputDir(nextOutputDir);
    saveLastExportDir(nextOutputDir);
    return nextOutputDir;
  }

  async function fixPack(metadataPatch = null) {
    setMetadataOpen(false);
    setLocalError('');
    const selectedOutputDir = await chooseOutputDir();
    if (!selectedOutputDir) {
      return;
    }
    setPhase('fixing');
    const fixed = await checker.fixPack(metadataPatch, { outputDir: selectedOutputDir });
    setPhase(fixed ? 'done' : 'collect');
    if (fixed) setResult(fixed);
  }

  function handlePrimary() {
    if (step === 0) {
      // CTA actif seulement quand un pack est déjà choisi (zone de dépôt ou
      // bouton « Choisir un pack ») : le footer ne duplique plus le picker.
      if (checker.zipPath) void analyzePath(checker.zipPath);
      return;
    }
    if (step === 1) {
      if (!canFix) {
        onClose();
        return;
      }
      setStep(2);
      return;
    }
    if (needsMetadata) setMetadataOpen(true);
    else void fixPack(null);
  }

  function handleStepClick(index) {
    if (index === 0) setStep(0);
    if (index === 1 && canOpenReport) setStep(1);
    if (index === 2 && canOpenCorrection) setStep(2);
  }

  const primaryLabel = step === 0
    ? t('packChecker.funnel.primaryAnalyze')
    : step === 1
      ? (canFix ? t('packChecker.funnel.primaryCorrect') : t('packChecker.funnel.primaryFinish'))
      : t('packChecker.funnel.primaryCreateFixed');

  return (
    <FunnelShell
      icon={<Wrench />}
      title={t('packChecker.funnel.shellTitle')}
      subtitle={t('packChecker.funnel.shellSubtitle')}
      size="wide"
      onClose={busy ? () => {} : onClose}
      showChrome={phase === 'collect'}
      ariaLabel={t('packChecker.funnel.shellAriaLabel')}
      stepper={(
        <FunnelStepper
          steps={steps}
          current={step}
          onStepClick={handleStepClick}
        />
      )}
      footer={(
        <FunnelFooter
          onBack={() => setStep(Math.max(0, step - 1))}
          backDisabled={step === 0}
          stepLabel={t('packChecker.funnel.stepLabel', { current: step + 1, total: steps.length })}
          onPrimary={handlePrimary}
          primaryLabel={primaryLabel}
          primaryDisabled={busy || (step === 0 && !checker.zipPath)}
        />
      )}
    >
      {phase === 'analyzing' ? (
        <FunnelGenerationState
          title={t('packChecker.funnel.analyzingTitle')}
          hint={latestLine(checker.liveLog) || t('packChecker.funnel.analyzingHint')}
        />
      ) : phase === 'fixing' ? (
        <FunnelGenerationState
          title={t('packChecker.funnel.fixingTitle')}
          hint={latestLine(checker.liveLog) || t('packChecker.funnel.fixingHint')}
        />
      ) : phase === 'done' ? (
        <FunnelDoneState
          title={t('packChecker.funnel.doneTitle')}
          fileName={basename(result?.fixedZipPath) || result?.fixedZipPath}
          meta={correctionCount(t, result)}
        >
          <button type="button" className="funnel-btn" onClick={() => outputDir && openPath(outputDir)}>
            <FolderOpen />
            {t('packChecker.funnel.openFolder')}
          </button>
          <button type="button" className="funnel-btn" onClick={() => checker.exportReport('report')}>
            <Download />
            {t('packChecker.funnel.exportReport')}
          </button>
          <button type="button" className="funnel-btn funnel-btn-primary" onClick={onClose}>
            <House />
            {t('packChecker.funnel.finish')}
          </button>
        </FunnelDoneState>
      ) : (
        <div className="checker-root pack-checker-funnel">
          {step === 0 ? (
            <div className="funnel-step-content pack-checker-step">
              <FunnelSectionHeader
                icon={<Package />}
                title={t('packChecker.funnel.step0Title')}
                description={t('packChecker.funnel.step0Description')}
              />
              <FunnelDropZone
                icon={<Package />}
                title={t('packChecker.funnel.dropTitle')}
                hint={t('packChecker.funnel.dropHint')}
                disabled={busy}
                onFiles={(paths) => analyzePath(paths?.[0])}
              >
                <button type="button" className="funnel-btn" onClick={pickPack} disabled={busy}>
                  {t('packChecker.funnel.choosePack')}
                </button>
              </FunnelDropZone>
              {checker.zipPath ? (
                <div className="pack-checker-selected" title={checker.zipPath}>
                  <Package />
                  <span>{checker.zipPath}</span>
                </div>
              ) : null}
              <ProcessLog status={checker.status} lines={checker.liveLog} />
              {error ? <div className="funnel-error" role="alert">{error}</div> : null}
            </div>
          ) : step === 1 ? (
            <div className="funnel-step-content pack-checker-step pack-checker-step--report">
              <FunnelSectionHeader
                icon={<TriangleAlert />}
                title={t('packChecker.funnel.step1Title')}
                description={t('packChecker.funnel.step1Description')}
              />
              {error ? <div className="funnel-error" role="alert">{error}</div> : null}
              <ReportView
                report={checker.report}
                busy={busy}
                canFix={canFix}
                onExportReport={checker.exportReport}
                onFixPack={(metadataPatch) => fixPack(metadataPatch)}
                onStartFix={() => setStep(2)}
                showFixButton={false}
              />
              <TechnicalLog
                report={checker.report}
                onCopyLog={checker.copyLog}
                onExportLog={checker.exportReport}
                onExportJson={checker.exportReport}
              />
            </div>
          ) : (
            <div className="funnel-step-content pack-checker-step">
              <FunnelSectionHeader
                icon={<Wrench />}
                title={t('packChecker.funnel.step2Title')}
                description={t('packChecker.funnel.step2Description')}
              />
              <FixableCorrectionsList report={checker.report} />
              {checker.exportNotice ? <div className="info-box">{checker.exportNotice}</div> : null}
              {error ? <div className="funnel-error" role="alert">{error}</div> : null}
              <div className="pack-checker-inline-actions">
                <FunnelToolButton icon={<Download />} accent="neutral" onClick={() => checker.exportReport('report')}>
                  {t('packChecker.funnel.exportReport')}
                </FunnelToolButton>
              </div>
              {metadataOpen ? (
                <CommunityPackMetadataModal
                  report={checker.report}
                  busy={busy}
                  onCancel={() => setMetadataOpen(false)}
                  onSubmit={(metadataPatch) => fixPack(metadataPatch)}
                />
              ) : null}
            </div>
          )}
        </div>
      )}
    </FunnelShell>
  );
}
