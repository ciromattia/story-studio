import { useEffect, useMemo, useState } from 'react';
import { exists } from '@tauri-apps/plugin-fs';
import { CircleCheck, Image, Package, RotateCcw, TriangleAlert } from '../icons/LucideLocal';
import { Tooltip } from '../common/Tooltip';
import { Button } from '../common/Button';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useLocalFile } from '../../hooks/useLocalFile';
import { generateConventionName, getExportPackName } from '../../utils/packConvention';
import { generateUuid } from '../../utils/uuid';
import { shouldPromptRegenerateImportedUuid } from '../../store/projectHelpers';
import { useTranslation } from '../../i18n/I18nContext';
import './PackNameModal.css';

const AGE_CHIPS = ['2', '3', '6', '9', '12'];

function normalizeVersion(value) {
  const parsed = Number.parseInt(String(value || '').replace(/\D/g, ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function defaultDraft(packMetadata = {}) {
  return {
    title: '',
    author: '',
    version: 1,
    minAge: '3',
    producer: '',
    bonus: '',
    description: '',
    uuid: '',
    originalUuid: '',
    namingMode: 'convention',
    legacyExportName: '',
    legacyName: '',
    ...packMetadata,
  };
}

function normalizeDraft(draft) {
  const namingMode = draft.namingMode === 'legacy' ? 'legacy' : 'convention';
  return {
    ...draft,
    title: String(draft.title || '').trim(),
    author: String(draft.author || '').trim(),
    producer: String(draft.producer || '').trim(),
    bonus: String(draft.bonus || '').trim(),
    description: String(draft.description || '').trim(),
    uuid: String(draft.uuid || '').trim(),
    originalUuid: String(draft.originalUuid || '').trim(),
    minAge: String(draft.minAge || '3').replace(/\D/g, '') || '3',
    version: normalizeVersion(draft.version),
    namingMode,
  };
}

function countStats(project) {
  let stories = 0;
  let media = 0;

  function countMedia(...values) {
    for (const value of values) {
      if (typeof value === 'string' && value.trim()) media += 1;
    }
  }

  countMedia(project?.rootAudio, project?.rootImage, project?.thumbnailImage, project?.nightModeAudio);
  function walk(entries = []) {
    for (const entry of entries) {
      if (entry.type === 'story' || entry.type === 'zip') stories += 1;
      countMedia(entry.audio, entry.image, entry.itemAudio, entry.itemImage, entry.zipPath, entry.coverAudio, entry.coverImage);
      if (entry.type === 'menu') walk(entry.children || []);
    }
  }
  walk(project?.rootEntries || []);
  return { stories, media };
}

function filenameTokens(exportName, emptyTitleHint) {
  if (!exportName) return [{ kind: 'empty', text: emptyTitleHint, insert: '' }];
  const tokens = [];
  let rest = String(exportName || '');
  const ageMatch = rest.match(/^(\d+\+\])/);
  if (ageMatch) {
    const value = ageMatch[1];
    tokens.push({ kind: 'age', text: value, insert: value.replace(/\]$/, '') });
    rest = rest.slice(value.length);
  }

  const authorIndex = rest.indexOf('[by_');
  const body = authorIndex === -1 ? rest : rest.slice(0, authorIndex);
  const byPart = authorIndex === -1 ? '' : rest.slice(authorIndex);
  if (body) tokens.push({ kind: 'title', text: body, insert: body.replace(/_/g, ' ') });

  if (byPart) {
    const versionMatch = byPart.match(/([_-]V\d+)$/i);
    const author = versionMatch ? byPart.slice(0, byPart.length - versionMatch[1].length) : byPart;
    if (author) tokens.push({ kind: 'author', text: author, insert: author.replace(/^\[by_/, '').replace(/_/g, ' ') });
    if (versionMatch) tokens.push({ kind: 'version', text: versionMatch[1], insert: versionMatch[1].replace(/[^\d]/g, '') });
  }

  tokens.push({ kind: 'ext', text: '.zip', insert: '' });
  return tokens;
}

export function PackNameModal({
  open,
  packMetadata = {},
  project = null,
  coverImage = null,
  exportFolder = null,
  generateDisabled = false,
  embedded = false,
  promptRegenerateUuid = false,
  onSave,
  onSaveAndGenerate,
  onClose,
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(() => defaultDraft(packMetadata));
  const [saving, setSaving] = useState(null);
  const [collision, setCollision] = useState('unknown');
  const coverUrl = useLocalFile(coverImage);
  useEscapeKey(open && !embedded, onClose);

  useEffect(() => {
    if (open) {
      setDraft(defaultDraft(packMetadata));
      setSaving(null);
    }
  }, [open, packMetadata]);

  const normalizedDraft = useMemo(() => normalizeDraft(draft), [draft]);
  const showImportedUuidHint = promptRegenerateUuid
    && shouldPromptRegenerateImportedUuid(normalizedDraft);
  const exportName = useMemo(() => {
    if (normalizedDraft.namingMode === 'legacy' && normalizedDraft.legacyExportName) {
      return getExportPackName(normalizedDraft);
    }
    return generateConventionName(normalizedDraft);
  }, [normalizedDraft]);
  const tokens = useMemo(() => filenameTokens(exportName, t('layout.packNameModal.emptyTitleHint')), [exportName, t]);
  const stats = useMemo(() => countStats(project), [project]);
  const hasExportName = normalizedDraft.namingMode === 'legacy'
    ? !!normalizedDraft.legacyExportName
    : !!normalizedDraft.title;
  const currentAge = String(draft.minAge || '3').replace(/\D/g, '') || '3';
  const customAgeValue = AGE_CHIPS.includes(currentAge) ? '' : currentAge;

  useEffect(() => {
    if (!open || !exportFolder || !exportName) {
      setCollision('unknown');
      return undefined;
    }
    let cancelled = false;
    const fullPath = `${exportFolder.replace(/[\\/]+$/, '')}/${exportName}.zip`;
    exists(fullPath)
      .then((found) => {
        if (!cancelled) setCollision(found ? 'collision' : 'free');
      })
      .catch(() => {
        if (!cancelled) setCollision('unknown');
      });
    return () => {
      cancelled = true;
    };
  }, [open, exportFolder, exportName]);

  if (!open) return null;

  function updateField(field, value) {
    setDraft((current) => ({
      ...current,
      [field]: field === 'version' ? normalizeVersion(value) : value,
      namingMode: field === 'uuid' ? current.namingMode : 'convention',
    }));
  }

  function regenerateUuid() {
    updateField('uuid', generateUuid());
  }

  function updateAge(value) {
    updateField('minAge', String(value || '').replace(/\D/g, ''));
  }

  async function submit(kind) {
    // La proposition de régénération d'UUID (nouvelle révision d'un pack importé)
    // est gérée en amont de la génération dans App.jsx (handleSavePackMetadata),
    // via un dialogue in-app awaitable — pour qu'elle soit résolue AVANT l'ouverture
    // du sélecteur de dossier de sortie (dialogue natif OS qui passerait devant).
    const payload = normalizeDraft(draft);
    setSaving(kind);
    try {
      if (kind === 'generate') await onSaveAndGenerate?.(payload);
      else await onSave?.(payload);
    } finally {
      setSaving(null);
    }
  }

  const collisionText = collision === 'collision'
    ? t('layout.packNameModal.preview.collision')
    : collision === 'free'
      ? t('layout.packNameModal.preview.free')
      : exportFolder
        ? t('layout.packNameModal.preview.checking')
        : t('layout.packNameModal.preview.noFolder');
  const generateButtonDisabled = !!saving || !hasExportName || generateDisabled;
  const generateButtonTooltip = saving
    ? t('layout.packNameModal.actions.tooltipBusy')
    : !hasExportName
      ? t('layout.packNameModal.actions.tooltipNeedTitle')
      : generateDisabled
        ? t('layout.packNameModal.actions.tooltipBlocked')
        : t('layout.packNameModal.actions.tooltipReady');

  const modalContent = (
    <div className={`pack-meta-modal${embedded ? ' pack-meta-modal--embedded' : ''}`} onClick={(event) => event.stopPropagation()}>
      <header className="pack-meta-header">
        <span className="pack-meta-header-icon"><Package className="chrome-icon" strokeWidth={2} absoluteStrokeWidth /></span>
        <div className="pack-meta-heading">
          <span className="pack-meta-eyebrow">{t('layout.packNameModal.title')}</span>
          <h2 title={exportName || undefined}>{exportName || t('layout.packNameModal.title')}</h2>
        </div>
        <Button variant="icon" className="modal-close pack-meta-close" onClick={onClose} aria-label={t('layout.packNameModal.close')}>×</Button>
      </header>

      <div className="pack-meta-body">
        <aside className="pack-meta-cover-panel">
          <span className="pack-meta-cover-label">{t('layout.packNameModal.cover.label')}</span>
          <div className="pack-meta-cover">
            {coverUrl ? <img src={coverUrl} alt="" /> : <Image className="pack-meta-cover-empty" strokeWidth={1.7} absoluteStrokeWidth />}
          </div>
          <div className="pack-meta-cover-copy">
            <span>{coverUrl ? t('layout.packNameModal.cover.defined') : t('layout.packNameModal.cover.empty')}</span>
            <small>{t('layout.packNameModal.cover.notEditable')}</small>
          </div>
        </aside>

        <section className="pack-meta-form">
          <div className="pack-meta-field-row">
            <label>{t('layout.packNameModal.fields.title.label')}</label>
            <input className="pack-meta-input" value={draft.title || ''} onChange={(event) => updateField('title', event.target.value)} placeholder={t('layout.packNameModal.fields.title.placeholder')} />
          </div>

          <div className="pack-meta-field-row">
            <label>{t('layout.packNameModal.fields.age.label')}</label>
            <div className="pack-meta-age-control">
              <div className="pack-meta-age-chips" role="group" aria-label={t('layout.packNameModal.fields.age.groupAria')}>
                {AGE_CHIPS.map((age) => (
                  <button
                    key={age}
                    type="button"
                    className={`pack-meta-age-chip ${currentAge === age ? 'is-active' : ''}`}
                    onClick={() => updateAge(age)}
                  >
                    {age}+
                  </button>
                ))}
              </div>
              <div className={`pack-meta-age-custom ${customAgeValue ? 'is-active' : ''}`}>
                <span>{t('layout.packNameModal.fields.age.customLabel')}</span>
                <div className="pack-meta-age-custom-value">
                  <input
                    className="pack-meta-input pack-meta-age-other"
                    value={customAgeValue}
                    onChange={(event) => updateAge(event.target.value)}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    aria-label={t('layout.packNameModal.fields.age.customAria')}
                    placeholder={t('layout.packNameModal.fields.age.customPlaceholder')}
                  />
                  <span aria-hidden="true">+</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pack-meta-field-row">
            <label>{t('layout.packNameModal.fields.author.label')}</label>
            <input className="pack-meta-input" value={draft.author || ''} onChange={(event) => updateField('author', event.target.value)} placeholder={t('layout.packNameModal.fields.author.placeholder')} />
          </div>

          <div className="pack-meta-field-row">
            <label>{t('layout.packNameModal.fields.version.label')}</label>
            <div className="pack-meta-version-grid">
              <input className="pack-meta-input pack-meta-version-input" type="number" min="1" value={draft.version || 1} onChange={(event) => updateField('version', event.target.value)} />
              <div className="pack-meta-inline-field">
                <span>{t('layout.packNameModal.fields.producer.label')}</span>
                <input className="pack-meta-input" value={draft.producer || ''} onChange={(event) => updateField('producer', event.target.value)} placeholder={t('layout.packNameModal.fields.producer.placeholder')} />
              </div>
            </div>
          </div>

          <div className="pack-meta-field-row">
            <label>{t('layout.packNameModal.fields.bonus.label')} <span>{t('layout.packNameModal.fields.bonus.tag')}</span></label>
            <input className="pack-meta-input" value={draft.bonus || ''} onChange={(event) => updateField('bonus', event.target.value)} placeholder={t('layout.packNameModal.fields.bonus.placeholder')} />
          </div>

          <div className="pack-meta-field-row is-textarea">
            <label>{t('layout.packNameModal.fields.description.label')} <span>{t('layout.packNameModal.fields.description.tag')}</span></label>
            <textarea className="pack-meta-input pack-meta-textarea" value={draft.description || ''} onChange={(event) => updateField('description', event.target.value)} rows={3} placeholder={t('layout.packNameModal.fields.description.placeholder')} />
          </div>

          <div className="pack-meta-field-row">
            <label>{t('layout.packNameModal.fields.uuid.label')}</label>
            <div className="pack-meta-uuid-control">
              <input className="pack-meta-input pack-meta-uuid-input" value={draft.uuid || ''} onChange={(event) => updateField('uuid', event.target.value)} placeholder={t('layout.packNameModal.fields.uuid.placeholder')} />
              <Tooltip text={t('layout.packNameModal.fields.uuid.regenerate')} wrap>
                <Button variant="icon" className="pack-meta-uuid-button" onClick={regenerateUuid} aria-label={t('layout.packNameModal.fields.uuid.regenerate')}>
                  <RotateCcw className="chrome-icon" strokeWidth={2} absoluteStrokeWidth />
                </Button>
              </Tooltip>
            </div>
          </div>
          {showImportedUuidHint ? (
            <div className="pack-meta-field-row">
              <span />
              <p className="pack-meta-uuid-hint">{t('layout.packNameModal.fields.uuid.importedHint')}</p>
            </div>
          ) : null}
        </section>
      </div>

      <div className="pack-meta-preview">
        <div className="pack-meta-preview-head">
          <span className="pack-meta-preview-label">{t('layout.packNameModal.preview.label')}</span>
          <div className={`pack-meta-status is-${collision}`}>
            {collision === 'collision' ? <TriangleAlert className="chrome-icon" strokeWidth={2} absoluteStrokeWidth /> : <CircleCheck className="chrome-icon" strokeWidth={2} absoluteStrokeWidth />}
            <span>{collisionText}</span>
          </div>
        </div>
        <div className="pack-meta-filename" title={exportName ? `${exportName}.zip` : ''}>
          {tokens.map((token, index) => (
            <span key={`${token.kind}-${index}-${token.text}`} className={`pack-meta-token is-${token.kind}`}>{token.text}</span>
          ))}
        </div>
      </div>

      <footer className="pack-meta-footer">
        <div className="pack-meta-summary">
          <strong>{stats.stories}</strong> {stats.stories > 1 ? t('layout.packNameModal.footer.storiesMany') : t('layout.packNameModal.footer.storiesOne')}
          <span>{stats.media} {stats.media > 1 ? t('layout.packNameModal.footer.mediaMany') : t('layout.packNameModal.footer.mediaOne')}</span>
        </div>
        <div className="pack-meta-actions">
          <Button onClick={onClose} disabled={saving}>{t('layout.packNameModal.actions.cancel')}</Button>
          <Button onClick={() => submit('save')} disabled={saving}>{saving === 'save' ? t('layout.packNameModal.actions.applying') : t('layout.packNameModal.actions.apply')}</Button>
          <Tooltip text={generateButtonTooltip} wrap>
            <Button
              variant="primary"
              onClick={() => submit('generate')}
              disabled={generateButtonDisabled}
              aria-label={generateButtonTooltip}
            >
              {saving === 'generate' ? t('layout.packNameModal.actions.preparing') : t('layout.packNameModal.actions.applyAndGenerate')}
            </Button>
          </Tooltip>
        </div>
      </footer>
    </div>
  );

  if (embedded) return modalContent;

  return (
    <div className="modal-overlay pack-meta-overlay" onClick={onClose}>
      {modalContent}
    </div>
  );
}
