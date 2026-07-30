import { memo, useState } from 'react';
import { AudioField } from './AudioField';
import { ImageField } from './ImageField';
import { NativeGraphEditor } from './NativeGraphEditor';
import { Toggle } from '../common/Toggle';
import { TextImagePromptModal } from '../TextImageGenerator/TextImagePromptModal';
import { Trash2 } from '../icons/LucideLocal';
import { formatFrenchCount } from '../../utils/frenchText.js';
import { useTranslation } from '../../i18n/I18nContext';
import './EditorPanel.css';

const MENU_BEHAVIOR_CONTROLS = [
  {
    key: 'wheel',
    labelKey: 'behaviorWheelLabel',
    descKey: 'behaviorWheelDesc',
    def: true,
  },
  {
    key: 'autoplay',
    labelKey: 'behaviorAutoplayLabel',
    descKey: 'behaviorAutoplayDesc',
    def: false,
  },
  {
    key: 'pause',
    labelKey: 'behaviorPauseLabel',
    descKey: 'behaviorPauseDesc',
    def: false,
  },
];

export const MenuEditor = memo(function MenuEditor({ node, onUpdate, onDelete }) {
  const { t } = useTranslation();
  const isImportedContinuation = !!node.importedContinuation;
  const nativeGraph = node.nativeGraph ?? null;
  const nativeGraphStageCount = nativeGraph?.stageCount ?? nativeGraph?.document?.stageNodes?.length ?? 0;
  const nativeGraphActionCount = nativeGraph?.actionCount ?? nativeGraph?.document?.actionNodes?.length ?? 0;
  const [textImgModal, setTextImgModal] = useState(null);

  function handleRegenerate() {
    setTextImgModal({
      defaultText: node.name || '',
      onConfirm: (path) => { onUpdate({ image: path, autoGenerateImage: false }); },
    });
  }

  return (
    <>
      <div className="card">
        <div className="card-title-row">
          <div className="card-title">{t('editorsCore.menuEditor.title')}</div>
          <div className="card-copy card-copy--inline">{t('editorsCore.menuEditor.description')}</div>
        </div>

        <div className="field-row field-row--flush">
          <span className="field-label">{t('editorsCore.menuEditor.nameLabel')}</span>
          <input
            className="field-input"
            value={node.name || ''}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder={t('editorsCore.menuEditor.namePlaceholder')}
          />
          <span className="menu-count">
            {formatFrenchCount(
              node.children?.length ?? node.items?.length ?? 0,
              t('editorsCore.menuEditor.itemSingular'),
              t('editorsCore.menuEditor.itemPlural'),
            )}
          </span>
        </div>
        <div className="card-sep" />

        {node.importedContinuation && (
          <div className="sequence-note sequence-note--spaced">
            {t('editorsCore.menuEditor.importedContinuationNote', {
              sourceName: node.importedContinuation.sourceStoryName
                || t('editorsCore.menuEditor.importedContinuationDefaultSource'),
            })}
            {node.importedContinuation.sourceStepName
              ? t('editorsCore.menuEditor.importedContinuationStepSuffix', { stepName: node.importedContinuation.sourceStepName })
              : ''}.
          </div>
        )}
        {nativeGraph ? (
          <div className="sequence-note sequence-note--spaced">
            {t('editorsCore.menuEditor.nativeGraphNote', {
              stageCount: nativeGraphStageCount,
              actionCount: nativeGraphActionCount,
            })}
          </div>
        ) : null}
        {node.autoBlackImage ? (
          <>
            <AudioField
              label={t('editorsCore.menuEditor.selectionAudioLabel')}
              description={isImportedContinuation
                ? t('editorsCore.menuEditor.selectionAudioDescOptional')
                : t('editorsCore.menuEditor.selectionAudioDescRequired')}
              file={node.audio}
              required={!isImportedContinuation}
              ttsTextSuggestion={node.name || ''}
              ttsFilenameHint={`selection-${node.name || 'dossier'}`}
              xttsTarget={{ kind: 'menu', entryId: node.id, field: 'audio' }}
              onPick={(f) => onUpdate({ audio: f })}
              onClear={() => onUpdate({ audio: null })}
            />
          </>
        ) : (
          <div className="media-split">
            <div className="media-split-left">
              <div className="media-col-header">
                {t('editorsCore.menuEditor.imageColHeader')}
                <span className="media-col-subtitle">{t('editorsCore.menuEditor.imageColSubtitle')}</span>
              </div>
              <ImageField
                fieldId={`${node.id}:image`}
                file={node.image}
                extraActions={[
                  {
                    key: 'generate-text',
                    label: t('editorsCore.menuEditor.generateTitleImageLabel'),
                    icon: '✦',
                    onClick: handleRegenerate,
                    title: t('editorsCore.menuEditor.generateTitleImageTitle'),
                  },
                ]}
                onPick={(f) => onUpdate({ image: f, autoGenerateImage: false })}
                onClear={() => onUpdate({ image: null, autoGenerateImage: false })}
              />
            </div>
            <div className="media-split-divider" />
            <div className="media-split-right">
              <div className="media-col-header">
                {t('editorsCore.menuEditor.soundColHeader')}
                <span className="media-col-subtitle">
                  {isImportedContinuation
                    ? t('editorsCore.menuEditor.soundColSubtitleOptional')
                    : t('editorsCore.menuEditor.soundColSubtitleRequired')}
                </span>
              </div>
                <AudioField
                  label={t('editorsCore.menuEditor.selectionAudioLabel')}
                description={isImportedContinuation
                  ? t('editorsCore.menuEditor.selectionAudioDescOptional')
                  : t('editorsCore.menuEditor.selectionAudioDescRequired')}
                file={node.audio}
                required={!isImportedContinuation}
                ttsTextSuggestion={node.name || ''}
                ttsFilenameHint={`selection-${node.name || 'dossier'}`}
                xttsTarget={{ kind: 'menu', entryId: node.id, field: 'audio' }}
                onPick={(f) => onUpdate({ audio: f })}
                onClear={() => onUpdate({ audio: null })}
              />
            </div>
          </div>
        )}
      </div>

      {nativeGraph ? (
        <div className="card">
          <div className="card-title-row">
            <div className="card-title">{t('editorsCore.menuEditor.nativeGraphCardTitle')}</div>
            <div className="card-copy card-copy--inline">
              {t('editorsCore.menuEditor.nativeGraphCardCopy', {
                stageCount: nativeGraphStageCount,
                actionCount: nativeGraphActionCount,
              })}
            </div>
          </div>
          <NativeGraphEditor
            graph={nativeGraph}
            onChange={(nextGraph) => onUpdate({ nativeGraph: nextGraph })}
          />
        </div>
      ) : null}

      <div className="card menu-behavior-card">
        <div className="card-title-row">
          <div className="card-title">{t('editorsCore.menuEditor.settingsTitle')}</div>
          <div className="card-copy card-copy--inline">
            {t('editorsCore.menuEditor.settingsDesc')}
          </div>
        </div>

        <div className="menu-behavior-stack">
          <label className="sequence-control menu-behavior-control">
          <Toggle
            on={node.autoBlackImage || false}
            onChange={(v) => onUpdate({ autoBlackImage: v })}
            ariaLabel={t('editorsCore.menuEditor.transparentScreenAria')}
          />
            <div className="menu-behavior-copy">
              <span className="during-play-control-title">{t('editorsCore.menuEditor.transparentScreenTitle')}</span>
              <span className="menu-behavior-desc">
                {t('editorsCore.menuEditor.transparentScreenDesc')}
              </span>
            </div>
          </label>
          {MENU_BEHAVIOR_CONTROLS.map(({ key, labelKey, descKey, def }) => (
            <label key={key} className="sequence-control menu-behavior-control">
              <Toggle
                on={node.controlSettings?.[key] ?? def}
                onChange={(v) => onUpdate({ controlSettings: { ...node.controlSettings, [key]: v } })}
                ariaLabel={t(`editorsCore.menuEditor.${labelKey}`)}
              />
              <div className="menu-behavior-copy">
                <span className="during-play-control-title">{t(`editorsCore.menuEditor.${labelKey}`)}</span>
                <span className="menu-behavior-desc">{t(`editorsCore.menuEditor.${descKey}`)}</span>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="card card--danger card--danger-compact">
        <div className="card-danger-row">
          <button
            className="card-danger-trash"
            type="button"
            onClick={onDelete}
            aria-label={t('editorsCore.menuEditor.deleteAriaLabel')}
            title={t('editorsCore.menuEditor.deleteTitle')}
          >
            <Trash2 className="card-danger-icon" />
          </button>
          <span className="card-danger-title">{t('editorsCore.menuEditor.deleteTitle')}</span>
          <p className="card-danger-desc">
            {(() => {
              const count = node.children?.length ?? node.items?.length ?? 0;
              if (count === 0) return t('editorsCore.menuEditor.deleteDescEmpty');
              return t(count > 1
                ? 'editorsCore.menuEditor.deleteDescCountOther'
                : 'editorsCore.menuEditor.deleteDescCountOne', { count });
            })()}
          </p>
        </div>
      </div>

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
