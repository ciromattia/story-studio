import { Button } from '../common/Button';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useTranslation } from '../../i18n/I18nContext';

export function MediaDeleteDialog({
  items,
  deleteDisk,
  canDeleteFromDisk,
  onDeleteDiskChange,
  onCancel,
  onConfirm,
}) {
  const { t } = useTranslation();
  useEscapeKey(!!items?.length, onCancel);

  if (!items?.length) return null;

  const usedItems = items.filter((item) => item.projectUsedCount > 0);
  const usedCount = usedItems.length;
  const actionLabel = deleteDisk ? t('mediaExplorer.deleteDialog.confirmDeleteForever') : t('mediaExplorer.deleteDialog.confirmRemove');

  return (
    // data-modal-surface : overlay à styles inline, reconnu par la garde des
    // raccourcis globaux (utils/modalSurfaces.js).
    <div data-modal-surface="" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div className="gen-modal" style={{ width: 380, maxWidth: '92vw' }}>
        <div className="gen-header">
          <span className="gen-title">
            {usedCount > 0
              ? (usedCount === 1
                ? t('mediaExplorer.deleteDialog.mediaStillUsedOne')
                : t('mediaExplorer.deleteDialog.mediaStillUsedOther', { count: usedCount }))
              : (deleteDisk ? t('mediaExplorer.deleteDialog.deleteForeverTitle') : t('mediaExplorer.deleteDialog.removeFromLibraryTitle'))}
          </span>
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {usedCount > 0 && (
            <div style={{ fontSize: 12, color: 'var(--warning-text)', lineHeight: 1.5 }}>
              {usedCount === 1
                ? t('mediaExplorer.deleteDialog.stillUsedWarningOne')
                : t('mediaExplorer.deleteDialog.stillUsedWarningOther', { count: usedCount })}
              <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                {usedItems.slice(0, 5).map((item) => (
                  <li key={item.id}>
                    {item.name} — {[...new Set(item.usages.map((usage) => usage.label).filter(Boolean))].slice(0, 3).join(', ')
                      || (item.projectUsedCount === 1
                        ? t('mediaExplorer.deleteDialog.usageFallbackOne', { count: item.projectUsedCount })
                        : t('mediaExplorer.deleteDialog.usageFallbackOther', { count: item.projectUsedCount }))}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {usedCount === 0 && (
            <>
              <label className="media-delete-option" onClick={() => onDeleteDiskChange(false)}>
                <input type="radio" readOnly checked={!deleteDisk} />
                <span>
                  <strong>{t('mediaExplorer.deleteDialog.removeOptionLabel')}</strong><br />
                  <small>{t('mediaExplorer.deleteDialog.removeOptionSub')}</small>
                </span>
              </label>
              {canDeleteFromDisk ? (
                <label className="media-delete-option" onClick={() => onDeleteDiskChange(true)}>
                  <input type="radio" readOnly checked={deleteDisk} />
                  <span>
                    <strong>{t('mediaExplorer.deleteDialog.deleteDiskOptionLabel')}</strong><br />
                    <small>{t('mediaExplorer.deleteDialog.deleteDiskOptionSub')}</small>
                  </span>
                </label>
              ) : (
                <div className="info-box">
                  {t('mediaExplorer.deleteDialog.diskDeleteUnavailableInfo')}
                </div>
              )}
            </>
          )}
        </div>
        <div className="gen-footer">
          {usedCount > 0 ? (
            <Button type="button" onClick={onCancel}>{t('mediaExplorer.deleteDialog.close')}</Button>
          ) : (
            <>
              <Button type="button" onClick={onCancel}>{t('mediaExplorer.deleteDialog.cancel')}</Button>
              <Button type="button" variant="danger" onClick={onConfirm}>{actionLabel}</Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
