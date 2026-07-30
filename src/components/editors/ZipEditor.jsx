import { pickZip } from '../../hooks/useFileDialog';
import { basename } from '../../utils/fileUtils';
import { Button } from '../common/Button';
import { useZipCover } from './useZipCover.js';
import { useTranslation } from '../../i18n/I18nContext';
import './EditorPanel.css';
import './ImageField.css';

function ZipCover({ zipPath, coverImage }) {
  // useZipCover gere le chargement de l'asset + la revocation de l'object URL
  // (l'ancienne implementation locale ne revoquait jamais -> fuite memoire).
  const { t } = useTranslation();
  const url = useZipCover(zipPath, coverImage);

  if (!url) return null;
  return (
    <div className="image-field" style={{ marginBottom: 12, flex: 'none' }}>
      <div className="media-label">{t('editorsCore.zipEditor.coverLabel')}</div>
      <div className="image-drop filled" style={{ cursor: 'default' }}>
        <img src={url} alt="" className="image-preview" />
      </div>
    </div>
  );
}

export function ZipEditor({ node, onUpdate, onDelete }) {
  const { t } = useTranslation();
  async function handlePick() {
    const picked = await pickZip();
    if (picked) {
      const name = basename(picked).replace(/\.(zip|7z)$/i, '');
      onUpdate({ zipPath: picked, name });
    }
  }

  const filename = node.zipPath ? basename(node.zipPath) : null;

  return (
    <>
      {node.coverImage && <ZipCover zipPath={node.zipPath} coverImage={node.coverImage} />}
      <div className="card">
        <div className="card-title">{t('editorsCore.zipEditor.infoTitle')}</div>
        <div className="field-row">
          <span className="field-label">{t('editorsCore.zipEditor.nameLabel')}</span>
          <input
            className="field-input"
            value={node.name || ''}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder={t('editorsCore.zipEditor.namePlaceholder')}
          />
        </div>
        <div className="field-row">
          <span className="field-label">{t('editorsCore.zipEditor.fileLabel')}</span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {filename || t('editorsCore.zipEditor.noFile')}
          </span>
          <Button size="sm" onClick={handlePick}>
            {filename ? t('editorsCore.zipEditor.replaceButton') : t('editorsCore.zipEditor.chooseButton')}
          </Button>
        </div>
      </div>

      <div className="info-box warn">
        {t('editorsCore.zipEditor.exportWarning')}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="danger-outline" onClick={onDelete}>
          {t('editorsCore.zipEditor.deleteButton')}
        </Button>
      </div>
    </>
  );
}
