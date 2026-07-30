import { useEffect, useRef } from 'react';
import { FilePen, FolderOpen, House, Save } from '../icons/LucideLocal';
import { useTranslation } from '../../i18n/I18nContext';
import './ProjectMenuPopover.css';

function ToolbarIcon({ Icon, className = 'chrome-icon' }) {
  return <Icon className={className} aria-hidden="true" strokeWidth={2} absoluteStrokeWidth />;
}

function ProjectMenuItem({ disabled = false, onClick, children }) {
  return (
    <button
      className="project-menu-item"
      role="menuitem"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export function ProjectMenuPopover({
  open,
  onOpenChange,
  trigger,
  shortcutLabels,
  onNewProject,
  onOpenProject,
  onSaveProject,
  onSaveProjectAs,
  saveState,
}) {
  const { t } = useTranslation();
  const wrapRef = useRef(null);
  const closeTimerRef = useRef(null);

  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    function onPointerDown(event) {
      if (!wrapRef.current?.contains(event.target)) onOpenChange?.(false);
    }

    function onKeyDown(event) {
      if (event.key === 'Escape') onOpenChange?.(false);
    }

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onOpenChange]);

  function openPopover() {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    onOpenChange?.(true);
  }

  function scheduleClose() {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => onOpenChange?.(false), 140);
  }

  function handleAction(action) {
    onOpenChange?.(false);
    action?.();
  }

  return (
    <div
      className={`project-menu-wrap ${open ? 'is-open' : ''}`}
      ref={wrapRef}
      onPointerEnter={openPopover}
      onPointerLeave={scheduleClose}
      onMouseEnter={openPopover}
      onMouseLeave={scheduleClose}
      onFocus={openPopover}
    >
      {trigger({ openPopover })}

      {open ? (
        <>
          <div className="project-menu-bridge" aria-hidden="true" />
          <div className="project-menu" role="menu">
            <div className="project-menu-head">
              <strong>{t('layout.projectMenuPopover.head.title')}</strong>
              <span>{saveState === 'ok' ? t('layout.projectMenuPopover.head.subtitleSaved') : t('layout.projectMenuPopover.head.subtitleDefault')}</span>
            </div>
            <ProjectMenuItem onClick={() => handleAction(onNewProject)}>
              <ToolbarIcon Icon={House} />
              <span>
                <strong>{t('layout.projectMenuPopover.items.backHome')}</strong>
                <small>{shortcutLabels.newProject}</small>
              </span>
            </ProjectMenuItem>
            <ProjectMenuItem onClick={() => handleAction(onOpenProject)}>
              <ToolbarIcon Icon={FolderOpen} />
              <span>
                <strong>{t('layout.projectMenuPopover.items.openProject')}</strong>
                <small>{shortcutLabels.openProject}</small>
              </span>
            </ProjectMenuItem>
            <span className="project-menu-sep" />
            <ProjectMenuItem onClick={() => handleAction(onSaveProject)}>
              <ToolbarIcon Icon={Save} />
              <span>
                <strong>{t('layout.projectMenuPopover.items.saveProject')}</strong>
                <small>{shortcutLabels.saveProject}</small>
              </span>
            </ProjectMenuItem>
            <ProjectMenuItem onClick={() => handleAction(onSaveProjectAs)}>
              <ToolbarIcon Icon={FilePen} />
              <span>
                <strong>{t('layout.projectMenuPopover.items.saveAs')}</strong>
                <small>{shortcutLabels.saveAs}</small>
              </span>
            </ProjectMenuItem>
          </div>
        </>
      ) : null}
    </div>
  );
}
