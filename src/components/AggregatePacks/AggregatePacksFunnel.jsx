import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { openPath } from '@tauri-apps/plugin-opener';
import { stat } from '@tauri-apps/plugin-fs';
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
import {
  Crop,
  FolderOpen,
  House,
  Image,
  Mic,
  MoveDown,
  MoveUp,
  Package,
  Pause,
  Play,
  Scissors,
  Sparkles,
  Speech,
  Trash2,
  Upload,
} from '../icons/LucideLocal';
import { pickAudio, pickImage, pickMultipleZip, getLastExportDir, saveLastExportDir } from '../../hooks/useFileDialog';
import { copyMediaToWorkspace, projectToRustExport } from '../../store/projectIO';
import { createZipEntry, DEFAULT_PACK_METADATA, normalizeProjectData } from '../../store/projectModel';
import { sanitizeImportedName } from '../../store/projectStore';
import { useProjectContext } from '../../store/ProjectContext';
import { isTtsAvailable } from '../../store/xttsSettings';
import { parseConventionName, generateConventionName } from '../../utils/packConvention';
import { basename, basenameNoExt } from '../../utils/fileUtils';
import { logger } from '../../utils/logger';
import { useLocalFile } from '../../hooks/useLocalFile';
import { createAudioPlayer, disposeAudioPlayerRef } from '../../utils/audioPlayer';
import { useTranslation } from '../../i18n/I18nContext';
import './AggregatePacksFunnel.css';

const AudioEditorModal = lazy(() => import('../AudioEditorModal/AudioEditorModal')
  .then((module) => ({ default: module.AudioEditorModal })));
const ImageEditorModal = lazy(() => import('../ImageEditorModal/ImageEditorModal')
  .then((module) => ({ default: module.ImageEditorModal })));
const TextImagePromptModal = lazy(() => import('../TextImageGenerator/TextImagePromptModal')
  .then((module) => ({ default: module.TextImagePromptModal })));
const RecordModal = lazy(() => import('../RecordModal/RecordModal')
  .then((module) => ({ default: module.RecordModal })));
const GenerateVoiceModal = lazy(() => import('../GenerateVoiceModal/GenerateVoiceModal')
  .then((module) => ({ default: module.GenerateVoiceModal })));
const PackNameModal = lazy(() => import('../layout/PackNameModal')
  .then((module) => ({ default: module.PackNameModal })));

function buildSteps(t) {
  return [
    { key: 'packs', label: t('importFunnels.aggregate.stepPacks') },
    { key: 'audio', label: t('importFunnels.aggregate.stepAudio') },
    { key: 'image', label: t('importFunnels.aggregate.stepImage') },
    { key: 'metadata', label: t('importFunnels.aggregate.stepMetadata') },
  ];
}

function formatBytes(bytes, t) {
  if (!bytes || bytes <= 0) return '';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(mb >= 10 ? 0 : 1)} ${t('importFunnels.aggregate.unitMb')}`;
  return `${Math.max(1, Math.round(bytes / 1024))} ${t('importFunnels.aggregate.unitKb')}`;
}

function getSquareOne(data) {
  return (data?.stageNodes || []).find((node) => node?.squareOne === true) ?? null;
}

function getPackStoryCount(data) {
  const stages = Array.isArray(data?.stageNodes) ? data.stageNodes : [];
  return Math.max(0, stages.filter((stage) => !stage?.squareOne).length);
}

function defaultMetadataForPacks(packs, t) {
  const parsed = packs
    .map((pack) => parseConventionName(pack.name || pack.fileName))
    .filter(Boolean);
  const ages = parsed
    .map((item) => Number.parseInt(item.minAge, 10))
    .filter((age) => Number.isFinite(age) && age > 0);
  return {
    ...DEFAULT_PACK_METADATA,
    title: t('importFunnels.aggregate.defaultTitle'),
    minAge: ages.length ? String(Math.min(...ages)) : '3',
    version: 1,
  };
}

function buildAggregateProject({ packs, rootAudio, rootImage, metadata, t }) {
  return normalizeProjectData({
    version: 1,
    projectName: metadata.title || t('importFunnels.aggregate.defaultProjectName'),
    rootName: metadata.title || t('importFunnels.aggregate.defaultRootName'),
    packMetadata: metadata,
    projectType: 'pack',
    rootAudio,
    rootImage,
    thumbnailImage: rootImage,
    sameImage: true,
    // L'audio racine (menu agrégé) est le seul asset natif : il est harmonisé en
    // loudness et ses silences de bord normalisés. Les assets internes des ZIP
    // agrégés sont recopiés verbatim depuis l'archive et ne passent pas par la
    // pipeline audio — pas d'option exposée, ce traitement ne concerne que la racine.
    globalOptions: {
      silenceMode: 'normalize',
      harmonizeLoudness: true,
      autoNext: false,
      nightMode: false,
      aiImageGen: false,
    },
    rootEntries: packs.map((pack) => createZipEntry({
      name: pack.name,
      zipPath: pack.path,
      coverImage: pack.coverImage,
      coverAudio: pack.coverAudio,
    })),
  });
}

export function AggregatePacksFunnel({ onClose }) {
  const { t } = useTranslation();
  const { xttsSettings, onUpdateXttsSettings } = useProjectContext();
  const [step, setStep] = useState(0);
  const [packs, setPacks] = useState([]);
  const [loadingPacks, setLoadingPacks] = useState(false);
  const [rootAudio, setRootAudio] = useState('');
  const [rootImage, setRootImage] = useState('');
  const [metadata, setMetadata] = useState(() => defaultMetadataForPacks([], t));
  const [outputDir, setOutputDir] = useState(() => getLastExportDir() || '');
  const [phase, setPhase] = useState('collect'); // collect | generating | done
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [audioEditorOpen, setAudioEditorOpen] = useState(false);
  const [imageEditorOpen, setImageEditorOpen] = useState(false);
  const [textImageOpen, setTextImageOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const sessionDirRef = useRef('');
  const audioRef = useRef(null);
  const imageUrl = useLocalFile(rootImage);
  const audioUrl = useLocalFile(rootAudio);

  useEffect(() => {
    return () => {
      const sessionDir = sessionDirRef.current;
      if (sessionDir) invoke('cleanup_session_workspace', { path: sessionDir }).catch(() => {});
      disposeAudioPlayerRef(audioRef);
    };
  }, []);

  useEffect(() => {
    disposeAudioPlayerRef(audioRef);
    setAudioPlaying(false);
  }, [audioUrl]);

  useEffect(() => {
    if (packs.length === 0) return;
    setMetadata((current) => {
      if (current.title && current.title !== t('importFunnels.aggregate.defaultTitle')) return current;
      return { ...current, ...defaultMetadataForPacks(packs, t) };
    });
  }, [packs, t]);

  async function ensureSessionDir() {
    if (sessionDirRef.current) return sessionDirRef.current;
    const dir = await invoke('create_session_workspace');
    sessionDirRef.current = dir;
    return dir;
  }

  async function copyToSession(path, projectName = metadata.title || 'agregation') {
    if (!path) return path;
    const dir = await ensureSessionDir();
    return copyMediaToWorkspace(path, dir, undefined, projectName);
  }

  async function addPackPaths(paths) {
    const candidates = (paths || [])
      .filter((path) => /\.(zip|7z)$/i.test(path))
      .filter((path) => !packs.some((pack) => pack.path === path));
    if (candidates.length === 0) return;
    setLoadingPacks(true);
    setError('');
    try {
      const nextPacks = [];
      for (const path of candidates) {
        try {
          const json = await invoke('load_pack_zip', { zipPath: path });
          const data = JSON.parse(json);
          const sq = getSquareOne(data);
          const fileName = basename(path) || path;
          const parsed = parseConventionName(fileName);
          const title = sanitizeImportedName(data.title?.trim() || parsed?.title || basenameNoExt(path), fileName);
          let sizeBytes = 0;
          try {
            sizeBytes = Number((await stat(path))?.size || 0);
          } catch {}
          nextPacks.push({
            id: crypto.randomUUID(),
            path,
            fileName,
            name: title,
            coverImage: sq?.image || null,
            coverAudio: sq?.audio || null,
            storyCount: getPackStoryCount(data),
            sizeBytes,
          });
        } catch (packError) {
          setError(t('importFunnels.aggregate.packIgnored', { name: basename(path) || path, error: packError }));
        }
      }
      if (nextPacks.length) setPacks((current) => [...current, ...nextPacks]);
    } finally {
      setLoadingPacks(false);
    }
  }

  async function handleBrowsePacks() {
    const files = await pickMultipleZip();
    await addPackPaths(files);
  }

  async function handlePickAudio() {
    const path = await pickAudio();
    if (path) setRootAudio(path);
  }

  async function handleRecordAudio() {
    await ensureSessionDir();
    setRecordOpen(true);
  }

  async function handleGenerateVoice() {
    await ensureSessionDir();
    setVoiceOpen(true);
  }

  async function handleQueueFunnelVoice(job) {
    const sessionDir = await ensureSessionDir();
    const command = xttsSettings?.backend === 'piper' ? 'piper_generate_audio' : 'xtts_generate_audio';
    const generatedPath = await invoke(command, {
      settings: xttsSettings,
      request: {
        ...job.request,
        savePath: null,
        workspaceDir: sessionDir,
      },
    });
    if (generatedPath) setRootAudio(generatedPath);
  }

  function toggleAudioPreview() {
    if (!audioUrl) return;
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      setAudioPlaying(false);
      return;
    }

    const audio = audioRef.current ?? createAudioPlayer(audioUrl);
    audioRef.current = audio;
    audio.onended = () => setAudioPlaying(false);
    audio.onpause = () => setAudioPlaying(false);
    audio.play()
      .then(() => setAudioPlaying(true))
      .catch(() => setAudioPlaying(false));
  }

  async function handlePickImage() {
    const path = await pickImage();
    if (path) setRootImage(path);
  }

  function movePack(index, delta) {
    setPacks((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function removePack(id) {
    setPacks((current) => current.filter((pack) => pack.id !== id));
  }

  function canGoTo(index) {
    if (index <= step) return true;
    if (index >= 1 && packs.length === 0) return false;
    if (index >= 2 && !rootAudio) return false;
    if (index >= 3 && !rootImage) return false;
    return true;
  }

  function handlePrimary() {
    if (step < STEPS.length - 1) {
      if (canGoTo(step + 1)) setStep(step + 1);
      return;
    }
    void generate();
  }

  function saveMetadataDraft(draft) {
    setMetadata((current) => ({ ...current, ...draft }));
  }

  async function saveMetadataAndGenerate(draft) {
    const nextMetadata = { ...metadata, ...draft };
    setMetadata(nextMetadata);
    // Le dossier de sortie est choisi ici, au moment de générer (comme le flux
    // normal), plutôt que dans une étape dédiée en amont.
    const selected = await openDialog({
      directory: true,
      multiple: false,
      title: t('importFunnels.aggregate.outputDialogTitle'),
      defaultPath: outputDir || getLastExportDir() || undefined,
    });
    if (!selected) return;
    setOutputDir(selected);
    saveLastExportDir(selected);
    await generate(nextMetadata, selected);
  }

  async function generate(metadataOverride = metadata, outputFolder = outputDir) {
    const activeMetadata = { ...metadata, ...metadataOverride };
    if (!packs.length || !rootAudio || !rootImage || !activeMetadata.title?.trim() || !outputFolder) return;
    setPhase('generating');
    setProgress(0.05);
    setError('');
    let unlisten = null;
    let timer = null;
    try {
      const sessionDir = await ensureSessionDir();
      const preparedAudio = await copyToSession(rootAudio, activeMetadata.title || 'agregation');
      setProgress(0.12);
      const preparedImage = await copyToSession(rootImage, activeMetadata.title || 'agregation');
      setProgress(0.18);
      const preparedPacks = [];
      for (let index = 0; index < packs.length; index += 1) {
        const pack = packs[index];
        const copiedZip = await copyToSession(pack.path, activeMetadata.title || 'agregation');
        preparedPacks.push({ ...pack, path: copiedZip });
        setProgress(0.18 + ((index + 1) / packs.length) * 0.18);
      }

      const project = buildAggregateProject({
        packs: preparedPacks,
        rootAudio: preparedAudio,
        rootImage: preparedImage,
        metadata: activeMetadata,
      });
      const projectJson = JSON.stringify(projectToRustExport(project));
      unlisten = await listen('generate-log', () => {
        setProgress((current) => Math.min(0.94, current + 0.035));
      });
      timer = window.setInterval(() => {
        setProgress((current) => Math.min(0.9, current + 0.012));
      }, 350);
      logger.info(`aggregate-funnel:generate start count=${packs.length} output='${outputFolder}' session='${sessionDir}'`);
      const resultPath = await invoke('generate_pack', { projectJson, outputFolder });
      window.clearInterval(timer);
      timer = null;
      unlisten?.();
      unlisten = null;
      setProgress(1);
      let sizeBytes = 0;
      try {
        sizeBytes = Number((await stat(resultPath))?.size || 0);
      } catch {}
      setResult({
        path: resultPath,
        fileName: basename(resultPath) || `${generateConventionName(activeMetadata)}.zip`,
        sizeBytes,
        packCount: packs.length,
        storyCount: packs.reduce((sum, pack) => sum + (pack.storyCount || 0), 0),
      });
      if (sessionDirRef.current) {
        await invoke('cleanup_session_workspace', { path: sessionDirRef.current }).catch(() => {});
        sessionDirRef.current = '';
      }
      setPhase('done');
    } catch (generationError) {
      window.clearInterval(timer);
      unlisten?.();
      setError(t('importFunnels.aggregate.generationFailed', { error: generationError?.message ?? generationError }));
      setPhase('collect');
      if (sessionDirRef.current) {
        await invoke('cleanup_session_workspace', { path: sessionDirRef.current }).catch(() => {});
        sessionDirRef.current = '';
      }
    }
  }

  async function handleClose() {
    if (phase === 'generating') return;
    const sessionDir = sessionDirRef.current;
    if (sessionDir) {
      await invoke('cleanup_session_workspace', { path: sessionDir }).catch(() => {});
      sessionDirRef.current = '';
    }
    onClose?.();
  }

  const totalStories = packs.reduce((sum, pack) => sum + (pack.storyCount || 0), 0);
  const totalSize = packs.reduce((sum, pack) => sum + (pack.sizeBytes || 0), 0);
  const ttsAvailable = isTtsAvailable(xttsSettings);
  const primaryDisabled = (
    (step === 0 && (packs.length === 0 || loadingPacks))
    || (step === 1 && !rootAudio)
    || (step === 2 && !rootImage)
  );
  const previewProject = buildAggregateProject({ packs, rootAudio, rootImage, metadata, t });
  const STEPS = buildSteps(t);
  const generationPhases = [
    { label: t('importFunnels.aggregate.phaseAggregate'), status: progress >= 0.28 ? 'done' : 'active' },
    { label: t('importFunnels.aggregate.phaseLoudness'), status: progress < 0.28 ? 'todo' : progress >= 0.55 ? 'done' : 'active' },
    { label: t('importFunnels.aggregate.phaseImages'), status: progress < 0.55 ? 'todo' : progress >= 0.8 ? 'done' : 'active' },
    { label: t('importFunnels.aggregate.phaseZip'), status: progress < 0.8 ? 'todo' : progress >= 1 ? 'done' : 'active' },
  ];

  return (
    <FunnelShell
      icon={<Package />}
      title={t('importFunnels.aggregate.shellTitle')}
      subtitle={t('importFunnels.aggregate.shellSubtitle')}
      onClose={handleClose}
      showChrome={phase === 'collect'}
      size="wide"
      ariaLabel={t('importFunnels.aggregate.shellTitle')}
      stepper={(
        <FunnelStepper
          steps={STEPS}
          current={step}
          onStepClick={(index) => { if (canGoTo(index)) setStep(index); }}
          disabled={phase !== 'collect'}
        />
      )}
      footer={phase === 'collect' && step === STEPS.length - 1 ? null : (
        <FunnelFooter
          onBack={() => setStep((current) => Math.max(0, current - 1))}
          backDisabled={step === 0}
          stepLabel={t('importFunnels.aggregate.stepLabel', { current: step + 1, total: STEPS.length })}
          onPrimary={handlePrimary}
          primaryLabel={step === STEPS.length - 1 ? t('importFunnels.aggregate.primaryGenerate') : t('importFunnels.aggregate.primaryContinue')}
          primaryIcon={step === STEPS.length - 1 ? <Package /> : null}
          primaryDisabled={primaryDisabled}
        />
      )}
    >
      {phase === 'generating' && (
        <FunnelGenerationState
          title={t('importFunnels.aggregate.generatingTitle')}
          hint={t('importFunnels.aggregate.generatingHint')}
          phases={generationPhases}
          progress={progress}
        />
      )}

      {phase === 'done' && (
        <FunnelDoneState
          title={t('importFunnels.aggregate.doneTitle')}
          fileName={result?.fileName}
          meta={[
            formatBytes(result?.sizeBytes, t),
            t(
              (result?.storyCount ?? totalStories) === 1
                ? 'importFunnels.aggregate.doneStoryCountOne'
                : 'importFunnels.aggregate.doneStoryCountOther',
              { count: result?.storyCount ?? totalStories },
            ),
            t('importFunnels.aggregate.donePackCountAggregated', { count: result?.packCount ?? packs.length }),
          ].filter(Boolean).join(' · ')}
        >
          <FunnelToolButton icon={<FolderOpen />} accent="neutral" onClick={() => outputDir && openPath(outputDir)}>
            {t('importFunnels.aggregate.openFolder')}
          </FunnelToolButton>
          <button type="button" className="funnel-btn funnel-btn-primary" onClick={handleClose}>
            <span>{t('importFunnels.aggregate.finish')}</span>
            <House />
          </button>
        </FunnelDoneState>
      )}

      {phase === 'collect' && step === 0 && (
        <div className="funnel-step-content aggregate-step">
          <FunnelSectionHeader
            icon={<Package />}
            title={t('importFunnels.aggregate.selectPacksTitle')}
            description={t('importFunnels.aggregate.selectPacksDescription')}
          />
          <FunnelDropZone
            icon={<Upload />}
            title={t('importFunnels.aggregate.dropZoneTitle')}
            hint={t('importFunnels.aggregate.dropZoneHint')}
            onFiles={addPackPaths}
            disabled={loadingPacks}
          >
            <FunnelToolButton icon={<FolderOpen />} accent="neutral" onClick={handleBrowsePacks} disabled={loadingPacks}>
              {t('importFunnels.aggregate.browse')}
            </FunnelToolButton>
          </FunnelDropZone>

          {packs.length > 0 && (
            <div className="aggregate-pack-list">
              {packs.map((pack, index) => (
                <div className="aggregate-pack-row" key={pack.id}>
                  <span className="aggregate-pack-handle" aria-hidden="true">⋮⋮</span>
                  <span className="aggregate-pack-icon"><Package /></span>
                  <span className="aggregate-pack-copy">
                    <span className="aggregate-pack-name" title={pack.fileName}>{pack.fileName}</span>
                    <span className="aggregate-pack-meta">
                      {[formatBytes(pack.sizeBytes, t), t(pack.storyCount === 1 ? 'importFunnels.aggregate.storyCountShortOne' : 'importFunnels.aggregate.storyCountShortOther', { count: pack.storyCount })].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <button type="button" className="aggregate-icon-btn" onClick={() => movePack(index, -1)} disabled={index === 0} aria-label={t('importFunnels.aggregate.moveUp')}>
                    <MoveUp />
                  </button>
                  <button type="button" className="aggregate-icon-btn" onClick={() => movePack(index, 1)} disabled={index === packs.length - 1} aria-label={t('importFunnels.aggregate.moveDown')}>
                    <MoveDown />
                  </button>
                  <button type="button" className="aggregate-icon-btn" onClick={() => removePack(pack.id)} aria-label={t('importFunnels.aggregate.remove')}>
                    <Trash2 />
                  </button>
                </div>
              ))}
              <div className="aggregate-pack-list-foot">
                <span>
                  {t(packs.length === 1 ? 'importFunnels.aggregate.packCountOne' : 'importFunnels.aggregate.packCountOther', { count: packs.length })}
                  {' · '}
                  {t(totalStories === 1 ? 'importFunnels.aggregate.storyCountShortOne' : 'importFunnels.aggregate.storyCountShortOther', { count: totalStories })}
                </span>
                <span>{formatBytes(totalSize, t)}</span>
              </div>
            </div>
          )}
          {loadingPacks && <div className="aggregate-inline-note">{t('importFunnels.aggregate.loadingPacks')}</div>}
          {error && <div className="funnel-error" role="alert">{error}</div>}
        </div>
      )}

      {phase === 'collect' && step === 1 && (
        <div className="funnel-step-content aggregate-step">
          <FunnelSectionHeader
            icon={<Mic />}
            title={t('importFunnels.aggregate.audioStepTitle')}
            description={t('importFunnels.aggregate.audioStepDescription')}
          />
          <div className="aggregate-audio-card">
            <button
              type="button"
              className="aggregate-play-btn"
              disabled={!audioUrl}
              aria-label={audioPlaying ? t('importFunnels.aggregate.pauseAudio') : t('importFunnels.aggregate.playAudio')}
              onClick={toggleAudioPreview}
            >
              {audioPlaying ? <Pause /> : <Play />}
            </button>
            <div className="aggregate-wave" aria-hidden="true">
              {Array.from({ length: 42 }).map((_, index) => (
                <span key={index} style={{ height: `${10 + ((index * 13) % 30)}px` }} />
              ))}
            </div>
            <div className="aggregate-selected-file" title={rootAudio}>{rootAudio ? basename(rootAudio) : t('importFunnels.aggregate.noAudioSelected')}</div>
          </div>
          <div className="aggregate-tool-grid">
            <FunnelToolButton icon={<FolderOpen />} accent="neutral" block onClick={handlePickAudio}>
              {t('importFunnels.aggregate.chooseAudio')}
            </FunnelToolButton>
            <FunnelToolButton icon={<Mic />} accent="violet" variant="solid" block onClick={handleRecordAudio}>
              {t('importFunnels.aggregate.recordAudio')}
            </FunnelToolButton>
            {ttsAvailable && (
              <FunnelToolButton icon={<Speech />} accent="violet" variant="solid" block onClick={handleGenerateVoice}>
                {t('importFunnels.aggregate.generateVoice')}
              </FunnelToolButton>
            )}
            <FunnelToolButton icon={<Scissors />} accent="neutral" block onClick={async () => {
              if (!rootAudio) return;
              await ensureSessionDir();
              setAudioEditorOpen(true);
            }} disabled={!rootAudio}>
              {t('importFunnels.aggregate.editAudio')}
            </FunnelToolButton>
          </div>
        </div>
      )}

      {phase === 'collect' && step === 2 && (
        <div className="funnel-step-content aggregate-step">
          <FunnelSectionHeader
            icon={<Image />}
            title={t('importFunnels.aggregate.imageStepTitle')}
            description={t('importFunnels.aggregate.imageStepDescription')}
          />
          <div className="aggregate-image-layout">
            <div className="aggregate-image-preview">
              {imageUrl ? <img src={imageUrl} alt="" /> : (
                <div className="aggregate-image-placeholder">
                  <strong>{metadata.title || t('importFunnels.aggregate.defaultTitle')}</strong>
                  <span>
                    {t(
                      packs.length === 1
                        ? 'importFunnels.aggregate.imagePlaceholderPackCountOne'
                        : 'importFunnels.aggregate.imagePlaceholderPackCountOther',
                      { count: packs.length },
                    )}
                  </span>
                </div>
              )}
            </div>
            <div className="aggregate-image-actions">
              <FunnelToolButton icon={<FolderOpen />} accent="neutral" onClick={handlePickImage}>
                {t('importFunnels.aggregate.chooseImage')}
              </FunnelToolButton>
              <FunnelToolButton
                icon={<Sparkles />}
                accent="violet"
                variant="solid"
                onClick={async () => {
                  try {
                    await ensureSessionDir();
                    setTextImageOpen(true);
                  } catch (sessionError) {
                    setError(t('importFunnels.aggregate.prepareSessionFailed', { error: sessionError?.message ?? sessionError }));
                  }
                }}
              >
                {t('importFunnels.aggregate.generateTitleImage')}
              </FunnelToolButton>
              <FunnelToolButton icon={<Crop />} accent="violet" variant="outline" onClick={async () => {
                await ensureSessionDir();
                setImageEditorOpen(true);
              }} disabled={!rootImage}>
                {t('importFunnels.aggregate.editImage')}
              </FunnelToolButton>
              <div className="aggregate-inline-note">{t('importFunnels.aggregate.imageAutoCropHint')}</div>
            </div>
          </div>
        </div>
      )}

      {phase === 'collect' && step === 3 && (
        <div className="funnel-step-content aggregate-step aggregate-metadata-step">
          <FunnelSectionHeader
            icon={<Package />}
            title={t('importFunnels.aggregate.metadataStepTitle')}
            description={t('importFunnels.aggregate.metadataStepDescription')}
            trailing={<span className="funnel-badge">{t('importFunnels.aggregate.metadataPrefilledBadge')}</span>}
          />
          <Suspense fallback={null}>
            <PackNameModal
              open
              embedded
              packMetadata={metadata}
              project={previewProject}
              coverImage={rootImage}
              exportFolder={outputDir || null}
              onSave={saveMetadataDraft}
              onSaveAndGenerate={saveMetadataAndGenerate}
              onClose={() => setStep(2)}
            />
          </Suspense>
          {error && <div className="funnel-error" role="alert">{error}</div>}
        </div>
      )}

      {audioEditorOpen && rootAudio && (
        <Suspense fallback={null}>
          <AudioEditorModal
            filePath={rootAudio}
            savePath={null}
            workspaceDir={sessionDirRef.current || null}
            onConfirm={(result) => {
              const outputPath = typeof result === 'string' ? result : result?.output_path;
              if (outputPath) setRootAudio(outputPath);
              setAudioEditorOpen(false);
            }}
            onCancel={() => setAudioEditorOpen(false)}
          />
        </Suspense>
      )}

      {recordOpen && (
        <Suspense fallback={null}>
          <RecordModal
            savePath={null}
            workspaceDir={sessionDirRef.current || null}
            projectName={metadata.title || 'agregation'}
            onSaved={(path) => {
              if (path) setRootAudio(path);
              setRecordOpen(false);
            }}
            onClose={() => setRecordOpen(false)}
          />
        </Suspense>
      )}

      {voiceOpen && ttsAvailable && (
        <Suspense fallback={null}>
          <GenerateVoiceModal
            savePath={null}
            xttsSettings={xttsSettings}
            label={t('importFunnels.aggregate.voiceMenuLabel')}
            initialText={metadata.title || t('importFunnels.aggregate.defaultTitle')}
            filenameHint={`menu-${metadata.title || 'agregation'}`}
            target={null}
            onUpdateXttsSettings={onUpdateXttsSettings}
            onQueueGenerate={handleQueueFunnelVoice}
            onClose={() => setVoiceOpen(false)}
          />
        </Suspense>
      )}

      {imageEditorOpen && rootImage && (
        <Suspense fallback={null}>
          <ImageEditorModal
            sourcePath={rootImage}
            workspaceDir={sessionDirRef.current || ''}
            forceExport
            onConfirm={(path) => {
              if (path) setRootImage(path);
              setImageEditorOpen(false);
            }}
            onCancel={() => setImageEditorOpen(false)}
          />
        </Suspense>
      )}

      {textImageOpen && (
        <Suspense fallback={null}>
          <TextImagePromptModal
            defaultText={metadata.title || t('importFunnels.aggregate.defaultTitle')}
            workspaceDir={sessionDirRef.current || ''}
            onConfirm={(path) => {
              if (path) setRootImage(path);
              setTextImageOpen(false);
            }}
            onCancel={() => setTextImageOpen(false)}
          />
        </Suspense>
      )}
    </FunnelShell>
  );
}
