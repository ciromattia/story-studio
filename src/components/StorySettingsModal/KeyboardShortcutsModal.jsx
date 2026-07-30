import { useMemo, useState } from 'react';
import { Button } from '../common/Button';
import { useTranslation } from '../../i18n/I18nContext';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import {
  DEFAULT_SHORTCUTS,
  SHORTCUT_DEFINITIONS,
  SHORTCUT_SCOPES,
  findShortcutConflict,
  formatShortcut,
  resetKeyboardShortcuts,
  resetKeyboardShortcutsForScope,
  shortcutFromEvent,
} from '../../store/keyboardShortcuts';
import { normalizeFrenchSearchText } from '../../utils/frenchText.js';
import './KeyboardShortcutsModal.css';

function matchesQuery(definition, shortcut, query) {
  if (!query) return true;
  const haystack = [
    definition.label,
    definition.scope,
    formatShortcut(shortcut),
  ].filter(Boolean).join(' ');
  return normalizeFrenchSearchText(haystack).includes(query);
}

export function KeyboardShortcutsModal({
  shortcuts,
  onChange,
  onClose,
}) {
  const { t } = useTranslation();
  const [captureId, setCaptureId] = useState(null);
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');

  const normalizedQuery = useMemo(
    () => normalizeFrenchSearchText(query).trim(),
    [query],
  );

  const sections = useMemo(() => SHORTCUT_SCOPES.map((scope) => {
    const items = SHORTCUT_DEFINITIONS.filter((d) => d.scope === scope.id)
      .filter((d) => matchesQuery(d, shortcuts?.[d.id] ?? d.defaultShortcut, normalizedQuery));
    return { scope, items };
  }).filter((section) => section.items.length > 0), [shortcuts, normalizedQuery]);

  function handleKeyDown(event, definition) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setCaptureId(null);
      setMessage('');
      return;
    }

    const nextShortcut = shortcutFromEvent(event);
    if (!nextShortcut) return;
    event.preventDefault();
    event.stopPropagation();

    const conflict = findShortcutConflict(shortcuts, definition.id, nextShortcut);
    if (conflict) {
      const scopeLabel = SHORTCUT_SCOPES.find((s) => s.id === conflict.scope)?.label || conflict.scope;
      setMessage(t('storySettings.shortcuts.conflictMessage', { label: conflict.label, scope: scopeLabel }));
      return;
    }

    onChange({ ...shortcuts, [definition.id]: nextShortcut });
    setCaptureId(null);
    setMessage('');
  }

  function handleResetAll() {
    const defaults = resetKeyboardShortcuts();
    onChange(defaults);
    setCaptureId(null);
    setMessage('');
  }

  function handleResetScope(scopeId) {
    onChange(resetKeyboardShortcutsForScope(shortcuts, scopeId));
    setCaptureId(null);
    setMessage('');
  }

  // Escape : annule la capture en cours, sinon ferme la modale. Via la pile
  // partagée pour passer devant les Préférences ouvertes dessous, quel que
  // soit l'élément qui a le focus.
  useEscapeKey(true, () => {
    if (captureId) {
      setCaptureId(null);
      setMessage('');
      return;
    }
    onClose();
  });

  return (
    <div
      className="modal-overlay"
      onClick={(event) => {
        event.stopPropagation();
        onClose();
      }}
    >
      <div
        className="modal-box keyboard-shortcuts-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <span>{t('storySettings.shortcuts.title')}</span>
          <Button variant="icon" className="modal-close" onClick={onClose}>✕</Button>
        </div>

        <div className="keyboard-shortcuts-body">
          <div className="keyboard-shortcuts-lead">
            {t('storySettings.shortcuts.lead')}
          </div>

          <input
            type="search"
            className="keyboard-shortcuts-search"
            placeholder={t('storySettings.shortcuts.searchPlaceholder')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />

          {sections.length === 0 ? (
            <div className="keyboard-shortcuts-empty">{t('storySettings.shortcuts.noResultsMessage', { query })}</div>
          ) : null}

          {sections.map(({ scope, items }) => {
            const editableInScope = items.some((d) => !d.readOnly);
            return (
              <div key={scope.id} className="keyboard-shortcuts-section">
                <div className="keyboard-shortcuts-section-head">
                  <div className="keyboard-shortcuts-section-title">
                    {scope.label}
                    {scope.id === 'a11y' ? (
                      <span className="keyboard-shortcuts-fixed-badge">{t('storySettings.shortcuts.readOnlyBadge')}</span>
                    ) : null}
                  </div>
                  {editableInScope ? (
                    <button
                      type="button"
                      className="keyboard-shortcuts-section-reset"
                      onClick={() => handleResetScope(scope.id)}
                      title={t('storySettings.shortcuts.resetScopeTitle', { scope: scope.label })}
                    >
                      {t('storySettings.shortcuts.resetScopeButton')}
                    </button>
                  ) : null}
                </div>
                {scope.description ? (
                  <div className="keyboard-shortcuts-section-desc">{scope.description}</div>
                ) : null}
                <div className="keyboard-shortcuts-list">
                  {items.map((definition) => {
                    const currentShortcut = shortcuts?.[definition.id] ?? definition.defaultShortcut;
                    if (definition.readOnly) {
                      return (
                        <div key={definition.id} className="keyboard-shortcut-row is-readonly">
                          <div className="keyboard-shortcut-info">
                            <div className="opts-row-label">{definition.label}</div>
                            {definition.readOnlyReason ? (
                              <div className="opts-row-sub">{definition.readOnlyReason}</div>
                            ) : null}
                          </div>
                          <div className="keyboard-shortcut-keys">
                            <kbd className="kbd">{formatShortcut(definition.defaultShortcut)}</kbd>
                            {(definition.aliases || []).map((alias, idx) => (
                              <kbd key={idx} className="kbd">{formatShortcut(alias)}</kbd>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={definition.id} className="keyboard-shortcut-row">
                        <div className="keyboard-shortcut-info">
                          <div className="opts-row-label">{definition.label}</div>
                          <div className="opts-row-sub">
                            {t('storySettings.shortcuts.defaultLabel', { shortcut: formatShortcut(DEFAULT_SHORTCUTS[definition.id] ?? definition.defaultShortcut) })}
                          </div>
                        </div>
                        <button
                          type="button"
                          className={`keyboard-shortcut-capture ${captureId === definition.id ? 'is-capturing' : ''}`}
                          onClick={() => {
                            setCaptureId(definition.id);
                            setMessage('');
                          }}
                          onKeyDown={(event) => captureId === definition.id && handleKeyDown(event, definition)}
                        >
                          {captureId === definition.id ? t('storySettings.shortcuts.capturingLabel') : formatShortcut(currentShortcut)}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {message ? <div className="keyboard-shortcuts-message">{message}</div> : null}

          <div className="keyboard-shortcuts-actions">
            <Button onClick={handleResetAll}>{t('storySettings.shortcuts.resetAllButton')}</Button>
            <Button variant="primary-violet" onClick={onClose}>{t('storySettings.shortcuts.closeButton')}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
