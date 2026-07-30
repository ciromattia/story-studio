import { Toggle } from '../common/Toggle';
import { AudioField } from './AudioField';
import { NavigationTargetSelect } from './story/storyUtils';
import { Trash2 } from '../icons/LucideLocal';
import { collectEndMessagePresentations } from '../../store/generatedNavigation';
import {
  getEffectiveEndMessageControlState,
  summarizeEndMessagePlayback,
} from '../../store/endMessagePresentation';
import { EndMessagePlaybackControl } from './EndMessagePlaybackControl';
import { useTranslation } from '../../i18n/I18nContext';
import './EditorPanel.css';

export function EndNodeEditor({
  endNodeName,
  nightModeAudio,
  nightModeActive,
  nightModeReturn,
  nightModeHomeReturn,
  projectName,
  allMenus = [],
  allStories = [],
  onUpdateNightModeAudio,
  onUpdateNightMode,
  onUpdateNightModeReturn,
  onUpdateNightModeHomeReturn,
  onUpdateEndMessageAutoplay,
  onUpdateEndNodeName,
  onRemove,
  project = null,
  onExamineStory,
  onAttachStory,
}) {
  const { t } = useTranslation();
  const resolvedEndNodeName = endNodeName ?? t('editorsCore.endNodeEditor.defaultName');
  const hasAudio = typeof nightModeAudio === 'string' && nightModeAudio.trim().length > 0;
  const presentations = collectEndMessagePresentations(project);
  const globalStories = presentations.filter((item) => item.presentationKind === 'global');
  const localStories = presentations.filter((item) => item.presentationKind === 'local_prompt' || item.presentationKind === 'local_sequence');
  const controlStates = globalStories.map((item) => getEffectiveEndMessageControlState(
    item.navigation.endMessage.controls,
    item.effectiveHome,
  ));
  const playbackSummary = summarizeEndMessagePlayback(
    controlStates,
    project?.globalOptions?.endMessageAutoplay ?? true,
  );

  return (
    <>
      <div className="card">
        <div className="card-title-row">
          <div className="card-title">{t('editorsCore.endNodeEditor.title')}</div>
          <div className="card-copy card-copy--inline">
            {t('editorsCore.endNodeEditor.description')}
          </div>
        </div>

        <div className="field-row">
          <span className="field-label">{t('editorsCore.endNodeEditor.nameLabel')}</span>
          <input
            className="field-input"
            value={resolvedEndNodeName}
            onChange={(event) => onUpdateEndNodeName?.(event.target.value)}
            placeholder={t('editorsCore.endNodeEditor.namePlaceholder')}
          />
        </div>

        <AudioField
          label={t('editorsCore.endNodeEditor.audioLabel')}
          file={nightModeAudio}
          ttsTextSuggestion={resolvedEndNodeName || ''}
          ttsFilenameHint={`fin-histoire-${projectName || 'projet'}`}
          xttsTarget={{ kind: 'root', field: 'nightModeAudio' }}
          onPick={(file) => onUpdateNightModeAudio(file)}
          onClear={() => onUpdateNightModeAudio(null)}
        />

        {!hasAudio && (
          <div className="info-box warn">
            {t('editorsCore.endNodeEditor.audioRequiredWarning')}
          </div>
        )}
        {localStories.length > 0 && (
          <div className="end-node-local-list">
            <span className="field-label">{t('editorsCore.endNodeEditor.localStoriesLabel')}</span>
            {localStories.map((item) => (
              <div key={item.entry.id} className="end-node-local-list-row">
                <button type="button" className="link-button" onClick={() => onExamineStory?.(item.entry.id)}>
                  {t('editorsCore.endNodeEditor.examineButton', {
                    name: item.entry.name || t('editorsCore.endNodeEditor.examineDefaultName'),
                  })}
                </button>
                <button type="button" className="link-button" onClick={() => onAttachStory?.(item.entry.id)}>
                  {t('editorsCore.endNodeEditor.attachButton')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title-row">
          <div className="card-title">{t('editorsCore.endNodeEditor.duringTitle')}</div>
        </div>
        <div className="editor-setting-stack">
          <div className="editor-setting-row end-node-setting-row">
            <div className="editor-setting-copy end-node-setting-copy">
              <div className="editor-setting-title">{t('editorsCore.endNodeEditor.homeButtonTitle')}</div>
              <div className="editor-setting-desc">
                {t('editorsCore.endNodeEditor.homeButtonDesc')}
              </div>
            </div>
            <div className="editor-setting-control">
              <NavigationTargetSelect
                value={nightModeHomeReturn ?? ''}
                onChange={(value) => onUpdateNightModeHomeReturn?.(value)}
                allMenus={allMenus}
                allStories={allStories}
                currentStoryId={null}
                emptyLabel={t('editorsCore.endNodeEditor.homeButtonEmpty')}
                includeStoryPlay={false}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title-row">
          <div className="card-title">{t('editorsCore.endNodeEditor.afterTitle')}</div>
        </div>
        <div className="editor-setting-stack">
          <div className="editor-setting-row end-node-setting-row end-node-playback-row">
            <div className="editor-setting-copy">
              <div className="editor-setting-title">{t('editorsCore.endNodeEditor.whenNextTitle')}</div>
              <div className="editor-setting-desc">
                {t('editorsCore.endNodeEditor.whenNextDesc')}
              </div>
            </div>
            <EndMessagePlaybackControl
              summary={playbackSummary}
              onChange={onUpdateEndMessageAutoplay}
            />
          </div>
          <div className="editor-setting-row end-node-setting-row">
            <div className="editor-setting-copy end-node-setting-copy">
              <div className="editor-setting-title">{t('editorsCore.endNodeEditor.returnAfterTitle')}</div>
              <div className="editor-setting-desc">
                {nightModeReturn
                  ? t('editorsCore.endNodeEditor.returnAfterDescOverride')
                  : t('editorsCore.endNodeEditor.returnAfterDescDefault')}
              </div>
            </div>
            <div className="editor-setting-control">
              <NavigationTargetSelect
                value={nightModeReturn ?? ''}
                onChange={(value) => onUpdateNightModeReturn?.(value)}
                allMenus={allMenus}
                allStories={allStories}
                currentStoryId={null}
                emptyLabel={t('editorsCore.endNodeEditor.returnAfterEmpty')}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title-row">
          <div className="card-title">{t('editorsCore.endNodeEditor.settingsTitle')}</div>
        </div>
        <div className="editor-setting-stack">
          <div className="editor-setting-row is-toggle-row end-node-setting-row end-node-toggle-row">
            <Toggle on={nightModeActive} onChange={onUpdateNightMode} />
            <div className="editor-setting-copy end-node-setting-copy">
              <div className="editor-setting-title">{t('editorsCore.endNodeEditor.nightModeLabel')}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card card--danger card--danger-compact">
        <div className="card-danger-row">
          <button
            className="card-danger-trash"
            type="button"
            onClick={() => onRemove?.()}
            aria-label={t('editorsCore.endNodeEditor.deleteAriaLabel')}
            title={t('editorsCore.endNodeEditor.deleteTitle')}
          >
            <Trash2 className="card-danger-icon" />
          </button>
          <span className="card-danger-title">{t('editorsCore.endNodeEditor.deleteTitle')}</span>
          <p className="card-danger-desc">
            {t('editorsCore.endNodeEditor.deleteDesc')}
          </p>
        </div>
      </div>
    </>
  );
}
