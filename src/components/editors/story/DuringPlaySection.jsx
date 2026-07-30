import { useState } from 'react';
import { Toggle } from '../../common/Toggle';
import { Tooltip } from '../../common/Tooltip';
import { encodeMenuNavigationTarget } from '../../../store/navigationTargets';
import { getGeneratedStoryNavigation } from '../../../store/generatedNavigation';
import { generatedTargetIdToSelectValue, NavigationTargetSelect } from './storyUtils';
import { StoryDisclosure } from './StoryDisclosure';
import { useTranslation } from '../../../i18n/I18nContext';
import {
  createSilentStoryTitleUpdate,
  isExplicitSilentStoryTitle,
  TITLE_CONTROL_DEFAULTS,
} from '../../../store/storyTitleStage';

function getPlayControls(t) {
  return [
    {
      key: 'pause',
      label: t('editorsStory.duringPlay.pauseLabel'),
      onText: t('editorsStory.duringPlay.pauseOnText'),
      offText: t('editorsStory.duringPlay.pauseOffText'),
      def: false,
    },
  ];
}

function getTitleControls(t) {
  return [
    { key: 'autoplay', label: t('editorsStory.duringPlay.autoplayLabel'), tip: t('editorsStory.duringPlay.autoplayTip'), def: false },
    { key: 'ok',       label: t('editorsStory.duringPlay.okLabel'),       tip: t('editorsStory.duringPlay.okTip'),       def: true },
    { key: 'home',     label: t('editorsStory.duringPlay.homeLabel'),     tip: t('editorsStory.duringPlay.homeTip'),     def: true },
    { key: 'pause',    label: t('editorsStory.duringPlay.pauseSelectionLabel'), tip: t('editorsStory.duringPlay.pauseSelectionTip'), def: false },
    { key: 'wheel',    label: t('editorsStory.duringPlay.wheelLabel'),    tip: t('editorsStory.duringPlay.wheelTip'),    def: true },
  ];
}

let duringPlaySelectionAdvancedOpen = false;

export function DuringPlaySection({ node, project = null, allMenus = [], allStories = [], parentMenu = null, onUpdate }) {
  const { t } = useTranslation();
  const PLAY_CONTROLS = getPlayControls(t);
  const TITLE_CONTROLS = getTitleControls(t);
  const [showAdvanced, setShowAdvanced] = useState(duringPlaySelectionAdvancedOpen);
  const controls = node.controlSettings ?? {};
  const titleControls = node.titleControlSettings ?? {};
  const navigation = getGeneratedStoryNavigation(node, parentMenu, project, project?.rootEntries ?? []);
  const parentMenuTarget = parentMenu?.id ? encodeMenuNavigationTarget(parentMenu.id) : null;
  const pauseEnabled = controls.pause ?? PLAY_CONTROLS[0].def;
  const homeEnabled = controls.home ?? true;
  const silentSelectionEnabled = isExplicitSilentStoryTitle(node);
  const effectiveHomeSelectValue = navigation.storyHome.effectiveTargetId
    ? generatedTargetIdToSelectValue(navigation.storyHome.effectiveTargetId)
    : null;
  const homeSelectValue = node.returnOnHome ?? effectiveHomeSelectValue ?? parentMenuTarget ?? '';
  const includeHomeDefaultOption = !parentMenuTarget || homeSelectValue === '';

  return (
    <div className="card during-play-card">
      <div className="card-title-row">
        <div className="card-title">{t('editorsStory.duringPlay.sectionTitle')}</div>
        <div className="card-copy card-copy--inline">
          {t('editorsStory.duringPlay.sectionDesc')}
        </div>
      </div>

      <div className="during-play-stack">
        <div className="sequence-controls during-play-toggles">
          {PLAY_CONTROLS.map(({ key, label, onText, offText, def }) => (
            <label key={key} className="sequence-control">
              <Toggle
                on={controls[key] ?? def}
                onChange={(v) => onUpdate({ controlSettings: { ...controls, [key]: v } })}
                ariaLabel={label}
              />
              <Tooltip text={pauseEnabled ? onText : offText} placement="above" style={{ minWidth: 0 }}>
                <span className="during-play-control-title">{label}</span>
              </Tooltip>
            </label>
          ))}
        </div>

        <div className="during-play-home">
          <div className="sequence-control during-play-home-head">
            <Toggle
              on={homeEnabled}
              onChange={(v) => onUpdate({
                controlSettings: { ...controls, home: v },
                ...(v ? {} : { returnOnHome: null, returnOnHomeNone: true }),
              })}
              ariaLabel={t('editorsStory.duringPlay.homeAria')}
            />
            <Tooltip
              text={homeEnabled
                ? t('editorsStory.duringPlay.homeEnabledTip')
                : t('editorsStory.duringPlay.homeDisabledTip')}
              placement="above"
              style={{ minWidth: 0 }}
            >
              <span className="during-play-control-title">{t('editorsStory.duringPlay.homeAria')}</span>
            </Tooltip>
            {homeEnabled ? (
              <>
                <span className="during-play-destination-label">{t('editorsStory.duringPlay.destinationLabel')}</span>
                <div className="during-play-home-select">
                  <NavigationTargetSelect
                    value={homeSelectValue}
                    onChange={(target) => onUpdate({ returnOnHome: target || null, returnOnHomeNone: false })}
                    allMenus={allMenus}
                    allStories={allStories}
                    currentStoryId={node.id}
                    emptyLabel={t('editorsStory.duringPlay.returnToHomeMenu')}
                    includeDefault={includeHomeDefaultOption}
                    includeStoryPlay={false}
                    size="compact"
                  />
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <StoryDisclosure
        open={showAdvanced}
        onToggle={() => setShowAdvanced((v) => {
          const next = !v;
          duringPlaySelectionAdvancedOpen = next;
          return next;
        })}
      >
        <div className="story-advanced-row">
          <div className="story-advanced-copy">
            <div className="story-advanced-title">{t('editorsStory.duringPlay.selectionScreenTitle')}</div>
            <div className="story-advanced-desc">
              {t('editorsStory.duringPlay.selectionScreenDesc')}
            </div>
          </div>
        </div>
        <div className="story-advanced-controls">
          <div className="sequence-controls">
            {TITLE_CONTROLS.map(({ key, label, tip, def }) => (
              <label key={key} className="sequence-control">
                <Tooltip text={tip} placement="above">
                  <span style={{ flex: 1 }}>{label}</span>
                </Tooltip>
                <Toggle
                  on={titleControls[key] ?? TITLE_CONTROL_DEFAULTS[key] ?? def}
                  onChange={(v) => onUpdate({
                    titleControlSettings: { ...TITLE_CONTROL_DEFAULTS, ...titleControls, [key]: v },
                  })}
                />
              </label>
            ))}
            <label className="sequence-control">
              <Tooltip
                text={t('editorsStory.duringPlay.silentSelectionTip')}
                placement="above"
              >
                <span style={{ flex: 1 }}>{t('editorsStory.duringPlay.silentSelectionLabel')}</span>
              </Tooltip>
              <Toggle
                on={silentSelectionEnabled}
                onChange={(enabled) => onUpdate(enabled
                  ? createSilentStoryTitleUpdate(node.titleControlSettings)
                  : { silentTitleStage: false })}
                ariaLabel={t('editorsStory.duringPlay.silentSelectionLabel')}
              />
            </label>
          </div>
        </div>
      </StoryDisclosure>
    </div>
  );
}
