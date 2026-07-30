import { memo, useEffect, useState } from 'react';
import { AudioField } from './AudioField';
import { ImageField } from './ImageField';
import { NativeGraphEditor } from './NativeGraphEditor';
import { Toggle } from '../common/Toggle';
import { TextImagePromptModal } from '../TextImageGenerator/TextImagePromptModal';
import { Info } from '../icons/LucideLocal';
import { KEYS, read, write } from '../../store/persistentSettings';
import { basename } from '../../utils/fileUtils';
import { formatFrenchCount } from '../../utils/frenchText.js';
import { useTranslation } from '../../i18n/I18nContext';
import './EditorPanel.css';
import './RootEditor.css';

export const RootEditor = memo(function RootEditor({ node, projectType, onUpdateRoot, onUpdateMedia, onUpdateStoryAudio }) {
  const { t } = useTranslation();
  const sameImage = !!node.sameImage;
  const nativeGraph = node.nativeGraph ?? null;
  const nativeGraphStageCount = nativeGraph?.stageCount ?? nativeGraph?.document?.stageNodes?.length ?? 0;
  const nativeGraphActionCount = nativeGraph?.actionCount ?? nativeGraph?.document?.actionNodes?.length ?? 0;
  const isSimple = projectType === 'simple';
  const simpleStoryName = node.packMetadata?.title || node.projectName || '';
  const rootTitle = isSimple ? simpleStoryName : (node.rootName || node.packMetadata?.title || node.projectName || '');

  const [simpleInfoDismissed, setSimpleInfoDismissed] = useState(
    () => read(KEYS.SIMPLE_MODE_INFO_DISMISS) === '1',
  );

  useEffect(() => {
    if (!isSimple) return;
    setSimpleInfoDismissed(read(KEYS.SIMPLE_MODE_INFO_DISMISS) === '1');
  }, [isSimple]);

  function dismissSimpleInfo() {
    setSimpleInfoDismissed(true);
    write(KEYS.SIMPLE_MODE_INFO_DISMISS, '1');
  }

  function handleSimpleNameChange(nextValue) {
    onUpdateRoot({ projectName: nextValue, packMetadata: { title: nextValue } });
  }

  function setSameImage(v) {
    onUpdateMedia('sameImage', v);
    if (v && node.rootImage) onUpdateMedia('thumbnailImage', node.rootImage);
  }

  const [textImgModal, setTextImgModal] = useState(null);

  function handleGenerateTextImage() {
    setTextImgModal({
      defaultText: rootTitle,
      onConfirm: (path) => {
        onUpdateMedia('rootImage', path);
        if (sameImage) onUpdateMedia('thumbnailImage', path);
        onUpdateMedia('autoGenerateRootImage', false);
      },
    });
  }

  function handleGenerateThumbnailTextImage() {
    setTextImgModal({
      defaultText: rootTitle,
      onConfirm: (path) => {
        onUpdateMedia('thumbnailImage', path);
        onUpdateMedia('autoGenerateRootImage', false);
      },
    });
  }

  function renderRootAudio() {
    return (
      <div className="root-audio-section">
        <div className="media-col-header">
          {t('editorsCore.rootEditor.soundColHeader')}
          <span className="media-col-subtitle">{t('editorsCore.rootEditor.soundColSubtitle')}</span>
        </div>
        <AudioField
          label={t('editorsCore.rootEditor.titleAudioLabel')}
          description={t('editorsCore.rootEditor.titleAudioDesc')}
          file={node.rootAudio}
          ttsTextSuggestion={rootTitle}
          ttsFilenameHint={`titre-${rootTitle || 'projet'}`}
          xttsTarget={{ kind: 'root', field: 'rootAudio' }}
          onPick={(f) => onUpdateMedia('rootAudio', f)}
          onClear={() => onUpdateMedia('rootAudio', null)}
        />
      </div>
    );
  }

  return (
    <>
      {nativeGraph ? (
        <div className="card">
          <div className="card-title-row">
            <div className="card-title">{t('editorsCore.rootEditor.nativeGraphCardTitle')}</div>
            <div className="card-copy card-copy--inline">
              {t('editorsCore.rootEditor.nativeGraphCardCopy', {
                stageCount: nativeGraphStageCount,
                actionCount: nativeGraphActionCount,
              })}
            </div>
          </div>
          <div className="sequence-note" style={{ margin: '0 16px 12px' }}>
            {t('editorsCore.rootEditor.nativeGraphNote')}
          </div>
          <NativeGraphEditor
            graph={nativeGraph}
            onChange={(nextGraph) => onUpdateMedia('nativeGraph', nextGraph)}
          />
        </div>
      ) : null}

      {isSimple && !simpleInfoDismissed ? (
        <div className="simple-mode-info" role="note">
          <span className="simple-mode-info-icon" aria-hidden="true">
            <Info className="chrome-icon" strokeWidth={1.9} absoluteStrokeWidth />
          </span>
          <div className="simple-mode-info-text">
            <strong>{t('editorsCore.rootEditor.simpleModeInfoTitle')}</strong>
            <span>
              {t('editorsCore.rootEditor.simpleModeInfoText')}
            </span>
          </div>
          <button
            type="button"
            className="simple-mode-info-dismiss"
            onClick={dismissSimpleInfo}
            aria-label={t('editorsCore.rootEditor.simpleModeInfoDismissAria')}
            title={t('editorsCore.rootEditor.simpleModeInfoDismissTitle')}
          >
            ×
          </button>
        </div>
      ) : null}

      <div className="card root-identity-card">
        <div className="card-title-row">
          <div className="card-title">{isSimple ? t('editorsCore.rootEditor.identityTitleSimple') : t('editorsCore.rootEditor.identityTitlePack')}</div>
          <div className="card-copy card-copy--inline">
            {isSimple
              ? t('editorsCore.rootEditor.identityDescSimple')
              : t('editorsCore.rootEditor.identityDescPack')}
          </div>
        </div>

        {projectType === 'pack' ? (
          <div className="root-card-name-row root-card-name-row--identity">
            <div className="field-row" style={{ marginBottom: 0, flex: 1 }}>
              <span className="field-label">{t('editorsCore.rootEditor.nameLabel')}</span>
              <input
                className="field-input"
                value={node.rootName ?? ''}
                onChange={(e) => onUpdateRoot({ rootName: e.target.value })}
                placeholder={t('editorsCore.rootEditor.namePlaceholder')}
              />
            </div>
            <span className="root-entry-count">
              {formatFrenchCount(
                node.rootEntries?.length ?? 0,
                t('editorsCore.rootEditor.entrySingular'),
                t('editorsCore.rootEditor.entryPlural'),
              )}
            </span>
          </div>
        ) : null}

        {isSimple ? (
          <div className="root-card-name-row root-card-name-row--simple root-card-name-row--identity">
            <div className="simple-name-field">
              <label className="simple-name-label" htmlFor="root-simple-name">{t('editorsCore.rootEditor.simpleNameLabel')}</label>
              <input
                id="root-simple-name"
                className="field-input simple-name-input"
                value={simpleStoryName}
                onChange={(e) => handleSimpleNameChange(e.target.value)}
                placeholder={t('editorsCore.rootEditor.simpleNamePlaceholder')}
              />
              <span className="simple-name-hint">{t('editorsCore.rootEditor.simpleNameHint')}</span>
            </div>
          </div>
        ) : null}

        <div className="card-sep" />

        <div className="root-media-section">
          {sameImage ? (
            <div className="media-split root-cover-media-split">
              <div className="media-split-left">
                <div className="media-col-header">
                  {t('editorsCore.rootEditor.imageColHeader')}
                  <span className="media-col-subtitle">
                    {isSimple
                      ? t('editorsCore.rootEditor.imageColSubtitleSimple')
                      : t('editorsCore.rootEditor.imageColSubtitlePack')}
                  </span>
                </div>
                <ImageField
                  fieldId="root:coverImage"
                  file={node.rootImage}
                  badge={t('editorsCore.rootEditor.coverBadge')}
                  formatHint={t('editorsCore.rootEditor.coverFormatHint')}
                  extraActions={[
                    {
                      key: 'generate-text',
                      label: t('editorsCore.rootEditor.generateTitleImageLabel'),
                      icon: '✦',
                      onClick: handleGenerateTextImage,
                      title: t('editorsCore.rootEditor.generateTitleImageTitle'),
                    },
                  ]}
                  onPick={(f) => {
                    onUpdateMedia('rootImage', f);
                    onUpdateMedia('thumbnailImage', f);
                    onUpdateMedia('autoGenerateRootImage', false);
                  }}
                  onClear={() => {
                    onUpdateMedia('rootImage', null);
                    onUpdateMedia('thumbnailImage', null);
                    onUpdateMedia('autoGenerateRootImage', false);
                  }}
                />
              </div>
              <div className="media-split-divider" />
              <div className="media-split-right">
                {renderRootAudio()}
              </div>
            </div>
          ) : (
            <>
              <div className="root-image-section">
                <div className="media-col-header">
                  {t('editorsCore.rootEditor.imageColHeader')}
                  <span className="media-col-subtitle">
                    {isSimple
                      ? t('editorsCore.rootEditor.imageColSubtitleSplitSimple')
                      : t('editorsCore.rootEditor.imageColSubtitleSplitPack')}
                  </span>
                </div>
                <div className="root-image-split-layout">
                  <div className="root-image-col root-image-col--lunii">
                    <div className="media-col-header">
                      {t('editorsCore.rootEditor.luniiImageColHeader')}
                      <span className="media-col-subtitle">{t('editorsCore.rootEditor.luniiImageColSubtitle')}</span>
                    </div>
                    <ImageField
                      align="start"
                      fieldId="root:rootImage"
                      file={node.rootImage}
                      badge={t('editorsCore.rootEditor.luniiBadge')}
                      formatHint={t('editorsCore.rootEditor.coverFormatHint')}
                      extraActions={[
                        {
                          key: 'generate-text',
                          label: t('editorsCore.rootEditor.generateTitleImageLabel'),
                          icon: '✦',
                          onClick: handleGenerateTextImage,
                          title: t('editorsCore.rootEditor.generateTitleImageTitle'),
                        },
                      ]}
                      onPick={(f) => { onUpdateMedia('rootImage', f); onUpdateMedia('autoGenerateRootImage', false); }}
                      onClear={() => { onUpdateMedia('rootImage', null); onUpdateMedia('autoGenerateRootImage', false); }}
                    />
                  </div>
                  <div className="root-image-col root-image-col--catalog">
                    <div className="media-col-header">
                      {t('editorsCore.rootEditor.catalogImageColHeader')}
                      <span className="media-col-subtitle">{t('editorsCore.rootEditor.catalogImageColSubtitle')}</span>
                    </div>
                    <ImageField
                      align="start"
                      fieldId="root:thumbnailImage"
                      file={node.thumbnailImage}
                      badge={t('editorsCore.rootEditor.catalogBadge')}
                      formatHint={t('editorsCore.rootEditor.catalogFormatHint')}
                      extraActions={[
                        {
                          key: 'generate-text',
                          label: t('editorsCore.rootEditor.generateTitleImageLabel'),
                          icon: '✦',
                          onClick: handleGenerateThumbnailTextImage,
                          title: t('editorsCore.rootEditor.generateThumbnailTitleImageTitle'),
                        },
                      ]}
                      onPick={(f) => onUpdateMedia('thumbnailImage', f)}
                      onClear={() => onUpdateMedia('thumbnailImage', null)}
                    />
                  </div>
                </div>
              </div>
              <div className="card-sep" />
              <div className="root-audio-below">
                {renderRootAudio()}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="card root-image-settings-card">
        <div className="card-title-row">
          <div className="card-title">{t('editorsCore.rootEditor.settingsTitle')}</div>
        </div>

        <label className="sequence-control root-image-sync-control">
          <Toggle
            on={sameImage}
            onChange={setSameImage}
            ariaLabel={t('editorsCore.rootEditor.sameImageAria')}
          />
          <div className="root-image-sync-copy">
            <span className="during-play-control-title">
              {t('editorsCore.rootEditor.sameImageLabel')}
            </span>
          </div>
        </label>
      </div>

      {isSimple && (
        <div className="card">
          <div className="card-title-row">
            <div className="card-title">{t('editorsCore.rootEditor.fullStoryTitle')}</div>
            <div className="card-copy card-copy--inline">{t('editorsCore.rootEditor.fullStoryDesc')}</div>
          </div>
          <AudioField
            label={t('editorsCore.rootEditor.fullStoryAudioLabel')}
            description={t('editorsCore.rootEditor.fullStoryAudioDesc')}
            file={node.storyAudio}
            ttsFilenameHint={`histoire-complete-${simpleStoryName || 'histoire'}`}
            xttsTarget={{ kind: 'rootStory', field: 'audio' }}
            onPick={(f) => {
              const autoName = basename(f)
                .replace(/\.(mp3|ogg|wav|m4a)$/i, '')
                .replace(/[-_]/g, ' ').trim();
              onUpdateStoryAudio(f);
              if (!simpleStoryName && autoName) handleSimpleNameChange(autoName);
            }}
            onClear={() => onUpdateStoryAudio(null)}
          />
        </div>
      )}

      {textImgModal && (
        <TextImagePromptModal
          defaultText={textImgModal.defaultText}
          onConfirm={(path) => { textImgModal.onConfirm(path); setTextImgModal(null); }}
          onCancel={() => setTextImgModal(null)}
        />
      )}
    </>
  );
});
