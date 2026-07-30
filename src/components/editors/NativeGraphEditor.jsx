import { memo, useEffect, useMemo, useState } from 'react';
import { AudioField } from './AudioField';
import { ImageField } from './ImageField';
import { Toggle } from '../common/Toggle';
import { basename } from '../../utils/fileUtils';
import { useTranslation } from '../../i18n/I18nContext';

function cloneGraph(graph) {
  return structuredClone(graph);
}

function stageId(stage) {
  return stage?.uuid || stage?.id || '';
}

function stageKind(t, stage) {
  const controls = stage?.controlSettings ?? {};
  if (stage?.squareOne) return t('editorsCore.nativeGraph.stageKindStart');
  if (controls.wheel && !controls.autoplay) return t('editorsCore.nativeGraph.stageKindChoice');
  if (controls.autoplay) return t('editorsCore.nativeGraph.stageKindPlay');
  return t('editorsCore.nativeGraph.stageKindGeneric');
}

function stageLabel(t, stage, index) {
  const name = typeof stage?.name === 'string' ? stage.name.trim() : '';
  const audio = basename(stage?.audio);
  const suffix = stageId(stage).slice(0, 8);
  if (name && name !== 'Stage title') return name;
  if (audio) return audio.replace(/\.(mp3|ogg|wav|m4a)$/i, '');
  return `${stageKind(t, stage)} ${index + 1}${suffix ? ` · ${suffix}` : ''}`;
}

function transitionTargets(transition, actionById) {
  const actionId = transition?.actionNode;
  if (!actionId) return [];
  const options = actionById.get(actionId)?.options ?? [];
  if (!Array.isArray(options) || options.length === 0) return [];
  if (options.length > 1) return options.filter(Boolean);
  const optionIndex = Number.isInteger(transition?.optionIndex) ? transition.optionIndex : 0;
  return [options[Math.max(0, optionIndex)] ?? options[0]].filter(Boolean);
}

function updateStageInGraph(graph, selectedStageId, updater) {
  const next = cloneGraph(graph);
  const stages = next?.document?.stageNodes ?? [];
  const index = stages.findIndex((stage) => stageId(stage) === selectedStageId);
  if (index < 0) return graph;
  stages[index] = updater(stages[index]);
  return next;
}

export const NativeGraphEditor = memo(function NativeGraphEditor({ graph, onChange }) {
  const { t } = useTranslation();
  const stages = graph?.document?.stageNodes ?? [];
  const actions = graph?.document?.actionNodes ?? [];
  const [filter, setFilter] = useState('');
  const [selectedStageId, setSelectedStageId] = useState(() => stageId(stages.find((stage) => stage.squareOne) ?? stages[0]));

  const actionById = useMemo(
    () => new Map(actions.map((action) => [action.id, action])),
    [actions],
  );
  const stageById = useMemo(
    () => new Map(stages.map((stage, index) => [stageId(stage), { stage, index }])),
    [stages],
  );
  const orderedStages = useMemo(
    () => [...stages]
      .map((stage, index) => ({ stage, index, id: stageId(stage), label: stageLabel(t, stage, index) }))
      .sort((a, b) => {
        if (a.stage.squareOne) return -1;
        if (b.stage.squareOne) return 1;
        const ay = a.stage.position?.y ?? 0;
        const by = b.stage.position?.y ?? 0;
        if (ay !== by) return ay - by;
        return (a.stage.position?.x ?? 0) - (b.stage.position?.x ?? 0);
      }),
    [stages, t],
  );
  const visibleStages = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return orderedStages;
    return orderedStages.filter(({ stage, label, id }) => (
      label.toLowerCase().includes(q)
      || id.toLowerCase().includes(q)
      || basename(stage.audio).toLowerCase().includes(q)
      || basename(stage.image).toLowerCase().includes(q)
    ));
  }, [filter, orderedStages]);

  useEffect(() => {
    if (!selectedStageId || !stageById.has(selectedStageId)) {
      setSelectedStageId(stageId(stages.find((stage) => stage.squareOne) ?? stages[0]));
    }
  }, [selectedStageId, stageById, stages]);

  const selectedInfo = stageById.get(selectedStageId) ?? null;
  const selectedStage = selectedInfo?.stage ?? null;
  const selectedIndex = selectedInfo?.index ?? 0;
  const selectedLabel = selectedStage ? stageLabel(t, selectedStage, selectedIndex) : '';
  const okTargets = selectedStage ? transitionTargets(selectedStage.okTransition, actionById) : [];
  const homeTargets = selectedStage ? transitionTargets(selectedStage.homeTransition, actionById) : [];

  function updateSelectedStage(patch) {
    if (!selectedStage) return;
    onChange(updateStageInGraph(graph, selectedStageId, (stage) => ({ ...stage, ...patch })));
  }

  function updateControl(key, value) {
    updateSelectedStage({
      controlSettings: {
        ...(selectedStage.controlSettings ?? {}),
        [key]: value,
      },
    });
  }

  function targetName(targetId) {
    const info = stageById.get(targetId);
    return info ? stageLabel(t, info.stage, info.index) : (targetId || t('editorsCore.nativeGraph.unknownDestination'));
  }

  if (!graph || stages.length === 0) return null;

  return (
    <div className="native-graph-editor">
      <div className="native-graph-toolbar">
        <div className="native-graph-stat"><strong>{stages.length}</strong><span>stages</span></div>
        <div className="native-graph-stat"><strong>{actions.length}</strong><span>actions</span></div>
        <input
          className="field-input native-graph-filter"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder={t('editorsCore.nativeGraph.filterPlaceholder')}
        />
      </div>

      <div className="native-graph-layout">
        <div className="native-graph-list" role="listbox" aria-label={t('editorsCore.nativeGraph.stagesListAriaLabel')}>
          {visibleStages.map(({ stage, index, id, label }) => (
            <button
              key={id}
              className={`native-graph-row ${id === selectedStageId ? 'is-selected' : ''}`}
              onClick={() => setSelectedStageId(id)}
              type="button"
            >
              <span className="native-graph-row-kind">{stageKind(t, stage)}</span>
              <span className="native-graph-row-main">{label}</span>
              <span className="native-graph-row-meta">#{index + 1}</span>
            </button>
          ))}
        </div>

        {selectedStage ? (
          <div className="native-graph-detail">
            <div className="field-row">
              <span className="field-label">{t('editorsCore.nativeGraph.nameLabel')}</span>
              <input
                className="field-input"
                value={selectedStage.name || ''}
                onChange={(event) => updateSelectedStage({ name: event.target.value })}
                placeholder={selectedLabel}
              />
              <span className="native-graph-id">{stageId(selectedStage).slice(0, 8)}</span>
            </div>

            <div className="sequence-controls">
              {['wheel', 'autoplay', 'pause', 'ok', 'home'].map((key) => (
                <div className="sequence-control" key={key}>
                  <span>{key}</span>
                  <Toggle
                    on={!!selectedStage.controlSettings?.[key]}
                    onChange={(value) => updateControl(key, value)}
                  />
                </div>
              ))}
            </div>

            <div className="native-graph-media">
              <div>
                <div className="media-col-header">
                  {t('editorsCore.nativeGraph.imageColHeader')}
                  <span className="media-col-subtitle">{t('editorsCore.nativeGraph.imageColSubtitle')}</span>
                </div>
                <ImageField
                  compact
                  fieldId={`stage:${stageId(selectedStage)}:image`}
                  file={selectedStage.image}
                  onPick={(file) => updateSelectedStage({ image: file })}
                  onClear={() => updateSelectedStage({ image: null })}
                />
              </div>
              <div>
                <div className="media-col-header">
                  {t('editorsCore.nativeGraph.soundColHeader')}
                  <span className="media-col-subtitle">{t('editorsCore.nativeGraph.soundColSubtitle')}</span>
                </div>
                <AudioField
                  label={t('editorsCore.nativeGraph.audioLabel')}
                  file={selectedStage.audio}
                  required={false}
                  ttsTextSuggestion={selectedStage.name || selectedLabel}
                  ttsFilenameHint={`graphe-${selectedLabel || 'stage'}`}
                  onPick={(file) => updateSelectedStage({ audio: file })}
                  onClear={() => updateSelectedStage({ audio: null })}
                />
              </div>
            </div>

            <div className="native-graph-targets">
              <div className="native-graph-target-group">
                <span className="native-graph-target-title">{t('editorsCore.nativeGraph.okGroupTitle')}</span>
                {okTargets.length > 0
                  ? okTargets.map((target) => <span className="native-graph-target" key={target}>{targetName(target)}</span>)
                  : <span className="native-graph-target is-empty">{t('editorsCore.nativeGraph.noDestination')}</span>}
              </div>
              <div className="native-graph-target-group">
                <span className="native-graph-target-title">{t('editorsCore.nativeGraph.homeGroupTitle')}</span>
                {homeTargets.length > 0
                  ? homeTargets.map((target) => <span className="native-graph-target" key={target}>{targetName(target)}</span>)
                  : <span className="native-graph-target is-empty">{t('editorsCore.nativeGraph.noDestination')}</span>}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
});
